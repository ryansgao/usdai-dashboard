/* Chart toolkit for the USD.AI deep dive. D3 v7, no other dependency.
   Grammar: horizontal gridlines only, compact ticks, straight line segments, legend under the plot (each item
   toggles its series), crosshair tooltip that also works by touch, period bars that span their period with the
   label under the bar, in-progress periods drawn lighter with a dashed outline, event markers numbered per chart.
   Colours are read from CSS variables at draw time, so every chart redraws on theme change and on resize. */
(function () {
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const color = (c) => (c && c.startsWith("--") ? css(c) : c);
  const parse = d3.utcParse("%Y-%m-%d");
  const fmtDay = d3.utcFormat("%b %-d, %Y");
  const fmtDayShort = d3.utcFormat("%b %-d");
  const fmtMon = d3.utcFormat("%b %Y");
  const MINUS = "−";
  const DAY = 864e5;

  // ---------- number formats: one formatter per unit, true minus signs ----------
  function compact(v, digits = 1, keep = false) {
    if (v == null || isNaN(v)) return "–";
    const s = v < 0 ? MINUS : "", a = Math.abs(v);
    const f = (x) => { const t = x.toFixed(digits); return keep ? t : t.replace(/\.0+$/, ""); };
    if (a >= 1e12) return s + f(a / 1e12) + "T";
    if (a >= 1e9) return s + f(a / 1e9) + "B";
    if (a >= 1e6) return s + f(a / 1e6) + "M";
    if (a >= 1e5) return s + (a / 1e3).toFixed(0) + "K";
    if (a >= 1e3) return s + f(a / 1e3) + "K";
    if (a >= 100) return s + a.toFixed(0);
    if (a >= 1) return s + (a >= 10 ? a.toFixed(digits === 0 ? 0 : 1) : a.toFixed(Math.max(digits, 1))).replace(/\.0+$/, "");
    if (a === 0) return "0";
    return s + a.toPrecision(2);
  }
  const signed = (v, f) => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? MINUS : "") + f(Math.abs(v)));
  const F = {
    usd: (v) => (v == null ? "–" : (v < 0 ? MINUS + "$" : "$") + compact(Math.abs(v), 1, Math.abs(v) >= 1e6)),
    usd2: (v) => (v == null ? "–" : (v < 0 ? MINUS : "") + "$" + d3.format(",.2f")(Math.abs(v))),
    usd0: (v) => (v == null ? "–" : (v < 0 ? MINUS : "") + "$" + d3.format(",.0f")(Math.abs(v))),
    num: (v) => compact(v),
    num1: (v) => compact(v, 1, true),
    int: (v) => (v == null ? "–" : (v < 0 ? MINUS : "") + d3.format(",.0f")(Math.abs(v))),
    pct: (v) => (v == null ? "–" : (v < 0 ? MINUS : "") + Math.abs(v * 100).toFixed(1) + "%"),
    pct0: (v) => (v == null ? "–" : (v < 0 ? MINUS : "") + Math.abs(v * 100).toFixed(0) + "%"),
    usdAx: (v) => (v == null ? "–" : (v < 0 ? MINUS + "$" : "$") + compact(Math.abs(v), 1)),   // axis ticks: no trailing .0
    chip: (v) => (v == null ? "–" : "$" + (Math.abs(v) < 0.1 ? v.toFixed(4) : v.toFixed(3))),
    x: (v) => (v == null ? "–" : v.toFixed(1) + "×"),
    signed,
  };

  // ---------- shared tooltip ----------
  function tipFor(el) {
    let t = el.querySelector(":scope > .tip");
    if (!t) { t = document.createElement("div"); t.className = "tip"; t.setAttribute("role", "status"); el.appendChild(t); }
    return t;
  }
  // Beside the pointer, flipped and clamped so it never leaves the chart box. On touch it sits at the top of the
  // plot, on the side away from the finger.
  function placeTip(el, t, x, y, touch) {
    const w = el.clientWidth, h = el.clientHeight, tw = t.offsetWidth, th = t.offsetHeight;
    let left = x + 16; if (left + tw > w) left = x - tw - 16; left = Math.max(0, Math.min(left, w - tw));
    let top = touch ? 0 : y - th / 2; top = Math.max(0, Math.min(top, Math.max(0, h - th)));
    t.style.left = left + "px"; t.style.top = top + "px";
  }
  // One document listener hides touch tooltips when the reader taps elsewhere.
  const openTips = new Set();
  document.addEventListener("pointerdown", (e) => { openTips.forEach((o) => { if (!o.el.contains(e.target)) { o.hide(); openTips.delete(o); } }); }, { passive: true });

  function swatch(s) {
    const i = document.createElement("i");
    const kind = s.type === "line" ? (s.dash ? "dash" : "line") : s.hatch ? "hatch" : "";
    if (kind) i.className = kind;
    const c = color(s.color);
    if (kind === "dash") i.style.borderColor = c; else i.style.background = c;
    if (s.hatch) { i.style.color = c; i.style.background = "transparent"; i.style.border = "1px solid " + c; }
    return i;
  }
  // Legend items are buttons: a click hides or shows that series. The last visible series cannot be hidden.
  // the order a reader sees stacked layers in, top first: d3's diverging stack puts positive layers upward in key order
  // and negative layers downward in key order, so positives reverse and negatives keep their order
  function visualStackOrder(series, rows) {
    const groups = {};
    series.forEach((s) => { if (s.stack && !s.noLine) (groups[s.stack] = groups[s.stack] || []).push(s); });
    const out = series.slice();
    Object.values(groups).forEach((ss) => {
      const sign = (s) => d3.sum(rows || [], (r) => r[s.key] || 0) >= 0;
      const ordered = ss.filter(sign).reverse().concat(ss.filter((s) => !sign(s)));
      const slots = ss.map((s) => out.indexOf(s)).sort((a, b) => a - b);
      slots.forEach((slot, i) => (out[slot] = ordered[i]));
    });
    return out;
  }
  function legend(series, hidden, onToggle, extra) {
    const L = document.createElement("div"); L.className = "legend";
    const shown = series.filter((s) => !s.noLegend);
    const canToggle = shown.length > 1 && onToggle;
    shown.forEach((s) => {
      const b = document.createElement(canToggle ? "button" : "span");
      if (canToggle) { b.type = "button"; b.setAttribute("aria-pressed", String(!hidden.has(s.key))); b.title = hidden.has(s.key) ? "Show " + s.label : "Hide " + s.label; }
      else b.className = "li";
      b.appendChild(swatch(s));
      b.appendChild(document.createTextNode(s.label));
      if (s.axis === "y2") { const em = document.createElement("em"); em.textContent = " (right axis)"; b.appendChild(em); }
      if (canToggle) b.addEventListener("click", () => {
        const vis = shown.filter((x) => !hidden.has(x.key));
        if (!hidden.has(s.key) && vis.length <= 1) return;
        onToggle(s.key);
      });
      L.appendChild(b);
    });
    (extra || []).forEach((x) => { const sp = document.createElement("span"); sp.className = "li"; const i = document.createElement("i"); i.className = x.cls; i.style.color = x.color; sp.appendChild(i); sp.appendChild(document.createTextNode(x.label)); L.appendChild(sp); });
    return L;
  }  // hovering a legend item fades every other series in that chart
  document.addEventListener("pointerover", (e) => {
    const it = e.target.closest && e.target.closest(".legend button, .legend .li");
    const ch = it && it.closest(".chart");
    document.querySelectorAll(".chart.isolating").forEach((c) => { if (c !== ch) { c.classList.remove("isolating"); c.querySelectorAll("[data-s]").forEach((n) => n.classList.remove("faded")); } });
    if (!ch) return;
    const lab = it.textContent.trim();
    ch.classList.add("isolating");
    ch.querySelectorAll("svg [data-s]").forEach((n) => n.classList.toggle("faded", n.getAttribute("data-s") !== lab));
  });


  let uid = 0;
  function hatchDef(svg, c, op = 0.12) {
    const id = "h" + ++uid;
    let defs = svg.select("defs"); if (defs.empty()) defs = svg.insert("defs", ":first-child");
    const p = defs.append("pattern").attr("id", id).attr("patternUnits", "userSpaceOnUse").attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 5).attr("height", 5).attr("fill", c).attr("opacity", op);
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("stroke", c).attr("stroke-width", 1.6);
    return `url(#${id})`;
  }
  const ios = new Set();
  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // First view only: the plot is revealed left to right when it first scrolls into view.
  function wipe(el, svg, g, x0, w, h) {
    if (reduced()) return;
    const id = "wp" + ++uid;
    const r = svg.append("clipPath").attr("id", id).append("rect").attr("x", x0).attr("y", -40).attr("height", h + 80).attr("width", 0);
    g.attr("clip-path", `url(#${id})`);
    const run = () => r.transition().duration(600).ease(d3.easeCubicOut).attr("width", w).on("end", () => { g.attr("clip-path", null); const n = r.node().parentNode; if (n) n.remove(); });
    if (!("IntersectionObserver" in window)) return run();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); ios.delete(io); run(); } }, { threshold: 0.2 });
    io.observe(el); ios.add(io);
  }

  /* ---------- x-axis ticks on month boundaries ----------
     Monthly bars get their label under the bar (tick at mid-month); everything else ticks on month starts. Ticks
     too close to either edge are dropped so labels never clip or collide with the y axis. */
  function monthTicks(x, plotW, period, narrow) {
    const [a, b] = x.domain();
    const spanDays = (b - a) / DAY;
    if (spanDays < 50) {
      const ts = x.ticks(Math.max(2, Math.min(6, Math.floor(plotW / (narrow ? 70 : 90)))));
      return { ticks: ts, fmt: fmtDayShort };
    }
    // the smallest month step that keeps labels at least ~56px apart (48px on a phone)
    const monthPx = plotW / (spanDays / 30.44), minGap = narrow ? 48 : 56;
    const step = [1, 2, 3, 6, 12].find((k) => k * monthPx >= minGap) || 12;
    let ts = d3.utcMonth.every(step).range(d3.utcMonth.floor(a), b);
    if (period === "M") ts = ts.map((t) => new Date((+t + +d3.utcMonth.offset(t, 1)) / 2));
    const [r0, r1] = x.range();
    const edge = period === "M" ? 2 : 14;
    ts = ts.filter((t) => x(t) >= r0 + edge && x(t) <= r1 + 2);
    if (ts.length < 2) ts = x.ticks(3);
    return { ticks: ts, fmt: d3.utcFormat(spanDays > 150 ? "%b \u2019%y" : "%b %-d") };
  }
  function logTicks(dom) {
    const [lo, hi] = dom;
    for (const set of [[1, 2, 3, 5], [1, 2, 5], [1, 3], [1]]) {
      const out = [];
      for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++) set.forEach((m) => { const v = m * Math.pow(10, e); if (v >= lo && v <= hi) out.push(v); });
      if (out.length <= 7) return out.length >= 3 ? out : null;
    }
    return null;
  }

  /* ---------- time chart ----------
     cfg = { data:[{d:'YYYY-MM-DD', _part?:'tooltip text when the period is in progress', ...}],
             period: 'D'|'W'|'M' (what one row covers), series:[{key,label,color,type:'line'|'area'|'bar', stack, axis,
             dash, hatch, width, fmt, noLegend, noLine, noTip}], yFormat, y2Format, height, yMin, yMax, logY,
             events:[{d,label,text}], eventList: element, refLines:[{value,label,color}], zeroLine, total: label,
             tipNote(r), tipDate(d), endLabel, onHover(r|null), hidden: Set, onHidden(Set), animate, aria }
     Calling it again on the same element swaps the config and redraws; the resize observer is set up once. */
  function timeChart(el, cfg0) {
    if (el.__vc) { el.__vc.cfg = cfg0; el.__vc.hidden = new Set(cfg0.hidden || el.__vc.hidden); el.__vc.morph = true; el.__vc.draw(cfg0.animate); return el.__vc; }
    const st = { cfg: cfg0, hidden: new Set(cfg0.hidden || []) };
    const draw = (animate) => {
      const cfg = st.cfg;
      el.innerHTML = "";
      el.classList.add("chart");
      const all = cfg.series;
      const series = all.filter((s) => !st.hidden.has(s.key));
      const W = el.clientWidth || 600, H = +el.dataset.h || cfg.height || 260;
      const narrow = W < 520;
      const hasY2 = series.some((s) => s.axis === "y2" && !s.noLine);
      const hasEv = cfg.events && cfg.events.length;
      const M = { t: hasEv || cfg.topPad ? 34 : 12, r: hasY2 ? 52 : cfg.endLabel ? 58 : 14, b: 26, l: 52 };
      const period = cfg.period || "D";
      const data = cfg.data.map((r) => {
        const d = r._d || parse(r.d);
        if (!d) return null;
        const s = period === "M" ? d3.utcMonth.floor(d) : period === "W" ? d3.utcDay.floor(d) : d;
        const e = period === "M" ? d3.utcMonth.offset(s, 1) : period === "W" ? new Date(+s + 7 * DAY) : new Date(+s + DAY);
        return { ...r, _d: d, _s: s, _e: e, _x: period === "D" ? d : new Date((+s + +e) / 2) };
      }).filter(Boolean);
      if (!data.length) return;
      const bars = series.some((s) => s.type === "bar");
      const xd = bars ? [data[0]._s, data[data.length - 1]._e] : d3.extent(data, (r) => r._x);
      if (+xd[0] === +xd[1]) xd[1] = new Date(+xd[1] + DAY);
      const x = d3.scaleUtc().domain(xd).range([M.l, W - M.r]);
      const X = (r) => (bars && period === "D" ? x(new Date(+r._s + DAY / 2)) : x(r._x));
      // stacks
      const stacks = {};
      series.filter((s) => s.stack && !s.noLine).forEach((s) => { (stacks[s.stack] = stacks[s.stack] || []).push(s); });
      const stacked = {};
      Object.values(stacks).forEach((ss) => {
        const sk = d3.stack().keys(ss.map((s) => s.key)).value((r, k) => r[k] || 0).offset(d3.stackOffsetDiverging)(data);
        sk.forEach((layer, i) => (stacked[ss[i].key] = layer));
      });
      const yVals = (axis) => {
        const vals = [];
        series.filter((s) => (s.axis || "y") === axis && !s.noLine).forEach((s) => {
          if (stacked[s.key]) stacked[s.key].forEach((p) => { vals.push(p[0], p[1]); });
          else data.forEach((r) => { if (r[s.key] != null) vals.push(r[s.key]); });
        });
        (cfg.refLines || []).filter((rl) => (rl.axis || "y") === axis && rl.inDomain).forEach((rl) => vals.push(rl.value));
        return vals;
      };
      const yv = yVals("y");
      if (!yv.length) yv.push(0, 1);
      let y, lt = null;
      const pos = yv.filter((v) => v > 0);
      if (cfg.logY && pos.length) {
        y = d3.scaleLog().domain([d3.quantile(pos.sort(d3.ascending), bars ? 0.02 : 0) * 0.9, d3.max(pos) * 1.1]).range([H - M.b, M.t]).clamp(true);
        lt = logTicks(y.domain()) || d3.scaleLinear().domain(y.domain()).ticks(5).filter((t) => t > 0);
      } else {
        const mn = d3.min(yv), mx = d3.max(yv);
        const lo = cfg.yMin === "auto" ? (mn >= 0 ? Math.max(0, mn - (mx - mn) * 0.08) : mn - (mx - mn) * 0.08) : cfg.yMin != null ? cfg.yMin : Math.min(0, mn);
        let hi = cfg.yMax != null ? Math.max(cfg.yMax, mx) : mx || 1;
        if (cfg.clipQ && bars && !cfg.logY) { const tops = data.map((r) => d3.sum(series.filter((x) => x.stack && !x.noLine), (x) => r[x.key] || 0)).filter((v) => v > 0).sort(d3.ascending); const q = d3.quantile(tops, cfg.clipQ); if (q && mx > q * 2.5) { hi = q * 1.4; st.clipped = hi; } else st.clipped = null; } else st.clipped = null;
        y = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice(5).range([H - M.b, M.t]);
      }
      let y2 = null;
      if (hasY2) { const v2 = yVals("y2"); y2 = d3.scaleLinear().domain([cfg.y2Min != null ? cfg.y2Min : Math.min(0, d3.min(v2)), d3.max(v2) || 1]).nice(5).range([H - M.b, M.t]); }
      const yOf = (s) => ((s.axis || "y") === "y2" && y2 ? y2 : y);

      const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", cfg.aria || "Chart");
      const yF = cfg.yFormat || F.num, y2F = cfg.y2Format || F.num;
      const axL = () => { const a = d3.axisLeft(y); return lt ? a.tickValues(lt) : a.ticks(cfg.yTicks || (H < 200 ? 4 : 5)); };
      svg.append("g").attr("class", "grid").attr("transform", `translate(${M.l},0)`).call(axL().tickSize(-(W - M.l - M.r)).tickFormat(""));
      svg.append("g").attr("class", "ax y").attr("transform", `translate(${M.l},0)`).call(axL().tickFormat(yF).tickPadding(8));
      if (y2) svg.append("g").attr("class", "ax y").attr("transform", `translate(${W - M.r},0)`).call(d3.axisRight(y2).ticks(cfg.yTicks || 5).tickFormat(y2F).tickPadding(8));
      const mt = monthTicks(x, W - M.l - M.r, period, narrow);
      const axX = svg.append("g").attr("class", "ax x").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x).tickValues(mt.ticks).tickSizeOuter(0).tickSize(0).tickPadding(9).tickFormat(cfg.xFormat || mt.fmt));
      // a label that would run past the right edge is anchored at its end instead of dropped
      axX.selectAll(".tick").each(function (t) { const tx = d3.select(this).select("text"); const w = this.getBBox ? this.querySelector("text").getComputedTextLength() : 0; if (x(t) + w / 2 > W - 2) tx.attr("text-anchor", "end").attr("dx", "0.4em"); if (x(t) - w / 2 < M.l - 30) tx.attr("text-anchor", "start"); });
      if (y.domain()[0] < 0) svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", css("--line-strong"));

      const gPlot = svg.append("g");
      // bar geometry: each bar spans its period less a gap; stacked bars get 1px separators in the card colour
      const gap = period === "D" ? 0.25 : period === "W" ? 0.18 : 0.22;
      const bx = (r) => { const a = x(r._s), b = x(r._e), w = b - a; return { x: a + (w * gap) / 2, w: Math.max(1, w * (1 - gap)) }; };
      const card = css("--card");
      let anyPart = false;
      series.forEach((s) => {
        if (s.noLine) return;
        const c = color(s.color);
        const Y = yOf(s);
        const fill = s.hatch ? hatchDef(svg, c) : c;
        if (s.type === "bar") {
          const pts = stacked[s.key] ? stacked[s.key].map((p) => ({ r: p.data, a: p[0], b: p[1] })) : data.filter((r) => r[s.key] != null).map((r) => ({ r, a: 0, b: r[s.key] }));
          pts.forEach((p) => {
            const g = bx(p.r), part = !!p.r._part;
            if (part) anyPart = true;
            const y0 = Y(Math.max(p.a, p.b)), hh = Math.abs(Y(p.a) - Y(p.b));
            if (hh <= 0) return;
            gPlot.append("rect").attr("data-s", s.label).attr("x", g.x).attr("width", g.w).attr("y", y0).attr("height", hh)
              .attr("fill", part ? (s.hatch ? fill : c) : fill).attr("fill-opacity", part ? 0.38 : 1)
              .attr("stroke", part ? c : stacked[s.key] && g.w >= 4 ? card : null).attr("stroke-width", part ? 1 : stacked[s.key] && g.w >= 4 ? 1 : null)
              .attr("stroke-dasharray", part ? "3 2" : null);
          });
        } else if (s.type === "area" || stacked[s.key]) {
          const pts = stacked[s.key] ? stacked[s.key].map((p) => ({ x: X(p.data), a: p[0], b: p[1] })) : data.filter((r) => r[s.key] != null).map((r) => ({ x: X(r), a: Math.max(0, Y.domain()[0]), b: r[s.key] }));
          gPlot.append("path").attr("data-s", s.label).datum(pts).attr("d", d3.area().x((p) => p.x).y0((p) => Y(p.a)).y1((p) => Y(p.b))).attr("fill", fill).attr("opacity", s.hatch ? 1 : s.opacity != null ? s.opacity : stacked[s.key] ? 0.9 : 0.12);
          if (!stacked[s.key] || s.edge) gPlot.append("path").attr("data-s", s.label).datum(pts).attr("d", d3.line().x((p) => p.x).y((p) => Y(p.b))).attr("fill", "none").attr("stroke", c).attr("stroke-width", s.width || 1.6).attr("stroke-linejoin", "round");
        } else {
          if (s.fill) gPlot.append("path").datum(data.filter((r) => r[s.key] != null)).attr("d", d3.area().x(X).y0(H - M.b).y1((r) => Y(r[s.key]))).attr("fill", c).attr("opacity", 0.07);
          const line = d3.line().defined((r) => r[s.key] != null).x(X).y((r) => Y(r[s.key])).curve(s.step ? d3.curveStepAfter : d3.curveLinear);
          // lead lines (width >= 1.75) get a soft gradient under them, the way price charts do
          if ((s.width || 0) >= 1.75 && !s.dash) {
            const gid = "g" + Math.random().toString(36).slice(2, 8);
            const lg = svg.append("defs").append("linearGradient").attr("id", gid).attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
            lg.append("stop").attr("offset", "0%").attr("stop-color", c).attr("stop-opacity", 0.18);
            lg.append("stop").attr("offset", "100%").attr("stop-color", c).attr("stop-opacity", 0);
            gPlot.append("path").attr("data-s", s.label).datum(data.filter((r) => r[s.key] != null)).attr("d", d3.area().x(X).y0(H - M.b).y1((r) => Y(r[s.key]))).attr("fill", `url(#${gid})`);
          }
          gPlot.append("path").attr("data-s", s.label).datum(data).attr("d", line).attr("fill", "none").attr("stroke", c).attr("stroke-width", s.width || 1.6).attr("stroke-dasharray", s.dash ? "5 4" : null).attr("stroke-linejoin", "round");
        }
      });
      // bars cut at the top of a clipped axis carry their value
      if (st.clipped) data.forEach((r) => { const tot = d3.sum(series.filter((x) => x.stack && !x.noLine), (x) => r[x.key] || 0); if (tot > st.clipped) { const g = bx(r); gPlot.append("path").attr("d", `M${g.x - 1},${M.t + 6}l${g.w + 2},-4m0,6l${-g.w - 2},4`).attr("stroke", card).attr("stroke-width", 2); gPlot.append("text").attr("class", "refl").attr("x", Math.min(g.x + g.w + 4, W - M.r - 40)).attr("y", M.t + 10).style("fill", css("--fg-2")).text((cfg.yFormat || F.num)(tot)); } });
      // value label at the end of the lead line
      if (cfg.endLabel) {
        const s = series.find((z) => z.type === "line" && !z.noLine);
        const last = s && [...data].reverse().find((r) => r[s.key] != null);
        if (last) {
          const px = X(last), py = yOf(s)(last[s.key]);
          gPlot.append("circle").attr("cx", px).attr("cy", py).attr("r", 3).attr("fill", color(s.color)).attr("stroke", card).attr("stroke-width", 1.5);
          gPlot.append("text").attr("class", "endl").attr("x", px + 6).attr("y", py + 4).attr("text-anchor", "start").style("fill", color(s.color)).text((s.fmt || yF)(last[s.key]));
        }
      }
      // reference lines: label at the left end, above the line
      (cfg.refLines || []).forEach((rl) => {
        const Y = rl.axis === "y2" ? y2 : y; if (!Y) return;
        const yy = Y(rl.value); if (yy < M.t - 1 || yy > H - M.b) return;
        svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", yy).attr("y2", yy).attr("stroke", color(rl.color || "--fg-2")).attr("stroke-dasharray", "4 4").attr("stroke-width", 1.2);
        svg.append("text").attr("class", "refl").attr("x", M.l + 4).attr("y", yy - 6).style("fill", color(rl.color || "--fg-2")).text(rl.label);
      });

      // crosshair + tooltip (mouse and touch)
      const tip = tipFor(el);
      const xh = svg.append("g").attr("class", "xhair").style("display", "none");
      const band = xh.append("rect").attr("y", M.t).attr("height", H - M.t - M.b).attr("width", 0);
      xh.append("line").attr("y1", M.t).attr("y2", H - M.b);
      const dim = xh.append("rect").attr("class", "dim").attr("y", M.t).attr("height", H - M.t - M.b).attr("fill", card).attr("opacity", 0.3);
      const ghost = svg.append("line").attr("class", "ghost").attr("y1", M.t).attr("y2", H - M.b).style("display", "none");
      const meas = svg.append("g").attr("class", "meas").style("display", "none");
      meas.append("rect").attr("class", "mband").attr("y", M.t).attr("height", H - M.t - M.b);
      const mlabel = meas.append("text").attr("class", "mlabel").attr("y", M.t + 14);
      const lineSeries = series.filter((s) => s.type !== "bar" && !s.noLine);
      const dots = lineSeries.map((s) => xh.append("circle").attr("r", 3.5).attr("fill", color(s.color)));
      const idxAt = (mx) => {
        const t = x.invert(mx);
        if (bars) { const i = d3.bisector((r) => r._s).right(data, t) - 1; return Math.max(0, Math.min(data.length - 1, i)); }
        return d3.bisector((r) => r._x).center(data, t);
      };
      const scale = () => el.clientWidth / W;
      const hide = () => { xh.style("display", "none"); tip.style.opacity = 0; if (cfg.onHover) cfg.onHover(null); document.dispatchEvent(new CustomEvent("vc-xh", { detail: { t: null, src: el } })); };
      // another chart's crosshair: a faint guide at the same date, if this chart covers it
      if (st.onXh) document.removeEventListener("vc-xh", st.onXh);
      st.onXh = (e) => {
        if (!el.isConnected) { document.removeEventListener("vc-xh", st.onXh); return; }
        const { t, src } = e.detail; if (src === el) return;
        if (!t || t < x.domain()[0] || t > x.domain()[1]) { ghost.style("display", "none"); return; }
        ghost.style("display", null).attr("x1", x(t)).attr("x2", x(t));
      };
      document.addEventListener("vc-xh", st.onXh);
      // drag across the plot: the change in the lead series between the two dates
      const lead = lineSeries[0] || series.find((s) => !s.noLine);
      let drag = null;
      const measure = (i0, i1) => {
        const a = data[Math.min(i0, i1)], b = data[Math.max(i0, i1)];
        if (!a || !b || !lead || a[lead.key] == null || b[lead.key] == null || a === b) { meas.style("display", "none"); return; }
        const x0 = X(a), x1 = X(b), d = b[lead.key] - a[lead.key], pc = a[lead.key] ? d / Math.abs(a[lead.key]) : null;
        const days = Math.round((b._d - a._d) / DAY);
        meas.style("display", null).select(".mband").attr("x", x0).attr("width", Math.max(1, x1 - x0));
        const f = lead.fmt || yF;
        // a series already in percent (a yield) changes by points, not by a percent of itself
        const isPct = /%$/.test(f(b[lead.key]));
        const txt = isPct ? `${d >= 0 ? "+" : MINUS}${Math.abs(d * 100).toFixed(2)} points over ${days} days`
          : `${d >= 0 ? "+" : MINUS}${f(Math.abs(d)).replace(/^[−-]/, "")}${pc != null && isFinite(pc) ? `  (${pc >= 0 ? "+" : MINUS}${Math.abs(pc * 100).toFixed(1)}%)` : ""}  over ${days} days`;
        mlabel.attr("x", Math.min(Math.max(x0 + 6, M.l + 4), W - M.r - 220)).text(txt)
          .attr("class", "mlabel " + (d >= 0 ? "up" : "down"));
      };
      const show = (ev, touch) => {
        const [mx, my] = d3.pointer(ev, svg.node());
        const i = idxAt(mx), r = data[i];
        if (!r) return;
        const px = X(r);
        xh.style("display", null).select("line").attr("x1", px).attr("x2", px).style("display", bars ? "none" : null);
        dim.attr("x", px).attr("width", bars ? 0 : Math.max(0, W - M.r - px));
        document.dispatchEvent(new CustomEvent("vc-xh", { detail: { t: r._x, src: el } }));
        st.lastI = i;
        if (bars) { const g = bx(r); band.attr("x", g.x - 2).attr("width", g.w + 4); } else band.attr("width", 0);
        lineSeries.forEach((s, k) => {
          const v = stacked[s.key] ? stacked[s.key][i][1] : r[s.key];
          dots[k].attr("cx", px).attr("cy", v == null ? -99 : yOf(s)(v)).style("display", v == null ? "none" : null);
        });
        const at = (s) => {
          if (s.noLine) return Infinity;
          if (stacked[s.key]) { const p = stacked[s.key][i]; return yOf(s)((p[0] + p[1]) / 2); }
          const v = r[s.key];
          if (v == null) return Infinity;
          return s.type === "bar" ? yOf(s)(v / 2) : yOf(s)(v);
        };
        const tipSeries = all.filter((s) => !s.noTip && !st.hidden.has(s.key)).map((s, k) => ({ s, k, y: at(s) })).sort((a, b) => a.y - b.y || a.k - b.k).map((o) => o.s);
        const rows = tipSeries.map((s) => {
          const v = r[s.key], f = s.axis === "y2" ? y2F : yF;
          return `<div class="tr"><i style="background:${color(s.color)}"></i><span>${s.label}</span><b>${s.fmt ? s.fmt(v) : (cfg.tipFormat || f)(v)}</b></div>`;
        });
        if (cfg.total && series.filter((s) => s.stack).length > 1) {
          const tot = d3.sum(series.filter((s) => s.stack && !s.noLine), (s) => r[s.key] || 0);
          rows.unshift(`<div class="tr tot"><i></i><span>${cfg.total}</span><b>${(cfg.tipFormat || yF)(tot)}</b></div>`);
        }
        const note = cfg.tipNote ? cfg.tipNote(r) : "";
        tip.innerHTML = `<div class="tt">${(cfg.tipDate || fmtDay)(r._d, r)}</div>${rows.join("")}${r._part ? `<div class="note">${r._part}</div>` : ""}${note ? `<div class="note">${note}</div>` : ""}`;
        tip.style.opacity = 1;
        placeTip(el, tip, px * scale(), my * scale(), touch);
        if (cfg.onHover) cfg.onHover(r);
      };
      let down = false, idle = null;
      const tState = { el, hide };
      const arm = () => { clearTimeout(idle); idle = setTimeout(() => { hide(); openTips.delete(tState); }, 4000); };
      svg.append("rect").attr("class", "ov").attr("x", M.l).attr("y", M.t).attr("width", W - M.l - M.r).attr("height", H - M.t - M.b).attr("fill", "transparent")
        .on("pointerdown", (ev) => { if (ev.pointerType !== "mouse") { down = true; openTips.add(tState); show(ev, true); arm(); return; } const [mx] = d3.pointer(ev, svg.node()); drag = { i0: idxAt(mx) }; meas.style("display", "none"); })
        .on("pointermove", (ev) => { if (ev.pointerType === "mouse") { show(ev, false); if (drag && ev.buttons) { const [mx] = d3.pointer(ev, svg.node()); measure(drag.i0, idxAt(mx)); } return; } if (down) { show(ev, true); arm(); } })
        .on("pointerup pointercancel", (ev) => { if (ev.pointerType !== "mouse") { down = false; arm(); return; } drag = null; })
        .on("pointerleave", (ev) => { if (ev.pointerType === "mouse") { hide(); drag = null; } })
        .on("dblclick", () => meas.style("display", "none"));
      // keyboard: focus the chart, arrows step through the points, Escape clears
      svg.attr("tabindex", 0).attr("aria-keyshortcuts", "ArrowLeft ArrowRight Escape").on("mousedown", (ev) => ev.preventDefault()).on("keydown", (ev) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(ev.key)) return;
        ev.preventDefault();
        if (ev.key === "Escape") return hide();
        let i = st.lastI == null ? data.length - 1 : st.lastI;
        i = ev.key === "Home" ? 0 : ev.key === "End" ? data.length - 1 : Math.max(0, Math.min(data.length - 1, i + (ev.key === "ArrowRight" ? 1 : -1)));
        const r = data[i]; const px = X(r);
        const fake = { clientX: svg.node().getBoundingClientRect().left + px * scale(), clientY: svg.node().getBoundingClientRect().top + (M.t + 30) * scale() };
        show(fake, false);
      });

      let gEv = null;
      if (!hasEv && cfg.eventList) { cfg.eventList.innerHTML = ""; const we = cfg.eventList.closest(".with-events"); if (we) we.classList.add("noev"); }
      if (hasEv) gEv = eventMarkers({ el, svg, cfg, data, series, x, X, yOf, M, W, H, tip });
      const shownSeries = all.filter((s) => !s.noLegend);
      if (shownSeries.length > 1 || cfg.legend || anyPart) {
        const extra = anyPart ? [{ cls: "part", color: css("--faint"), label: cfg.partLabel || "In progress" }] : [];
        el.appendChild(legend(visualStackOrder(all, cfg.data), st.hidden, shownSeries.length > 1 ? (k) => { st.hidden.has(k) ? st.hidden.delete(k) : st.hidden.add(k); if (cfg.onHidden) cfg.onHidden(new Set(st.hidden)); draw(false); } : null, extra));
      }
      if (st.morph && !animate && !reduced()) { gPlot.style("opacity", 0.15).transition().duration(260).ease(d3.easeCubicOut).style("opacity", 1); }
      st.morph = false;
      if (animate) { if (gEv) gEv.raise(); wipe(el, svg, gPlot, M.l - 4, W - M.l - M.r + 8, H); if (gEv) { gEv.style("opacity", 0).transition().delay(450).duration(250).style("opacity", 1); } }
    };
    st.draw = draw; el.__vc = st;
    draw(cfg0.animate);
    observe(el, () => st.draw(false));
    return st;
  }

  /* ---------- event markers ----------
     Numbered 1…n in the order they appear in this chart. At rest: a grey dot on the line, a short stem and a grey
     numeral. Hovering a marker or its row in the list lights both in the accent colour and shows the event. */
  function eventMarkers({ el, svg, cfg, data, series, x, X, yOf, M, W, H, tip }) {
    const main = series.find((s) => s.type !== "bar" && !s.noLine) || series[0];
    const Y = yOf(main), dom = x.domain();
    const bis = d3.bisector((r) => r._x).center;
    const STEM = 12, GAPX = 21, GAPY = 21, R = 9.5;
    const evs = cfg.events.map((e) => ({ ...e, _d: parse(e.d) })).filter((e) => e._d >= dom[0] && e._d <= dom[1]).sort((a, b) => a._d - b._d);
    const placed = [];
    evs.forEach((e) => {
      const r = data[bis(data, e._d)];
      const v = r && r[main.key];
      if (v == null) return;
      const px = x(e._d), py = Y(v);
      const bxp = Math.max(M.l + R + 2, Math.min(px, W - M.r - R - 2));
      // the line near the badge: keep the badge clear of any point of the line within its width
      const near = data.filter((r) => r[main.key] != null && Math.abs(X(r) - bxp) <= R + 2).map((r) => Y(r[main.key]));
      const lineTop = near.length ? Math.min(py, ...near) : py;
      const clash = (yy) => placed.some((p) => Math.abs(p.x - bxp) < GAPX && Math.abs(p.y - yy) < GAPY);
      let my = lineTop - STEM - R;
      while (clash(my) && my > R) my -= GAPY;
      if (my < R) { const lineBot = near.length ? Math.max(py, ...near) : py; my = lineBot + STEM + R; while (clash(my)) my += GAPY; }
      my = Math.max(R, Math.min(my, H - M.b - R - 2));
      placed.push({ x: bxp, y: my, px, py, e, n: placed.length + 1 });
    });
    const g = svg.append("g").attr("class", "evm");
    const list = cfg.eventList;
    let ol = null;
    if (list) {
      list.innerHTML = "";
      const we = list.closest(".with-events"); if (we) we.classList.toggle("noev", !placed.length);
      if (placed.length) {
        const wrap = document.createElement("div"); wrap.className = "evs-wrap";
        const tg = document.createElement("button"); tg.type = "button"; tg.className = "evs-tg"; tg.textContent = `Show ${placed.length} event${placed.length > 1 ? "s" : ""}`;
        tg.setAttribute("aria-expanded", "false");
        tg.addEventListener("click", () => { const o = wrap.classList.toggle("open"); tg.setAttribute("aria-expanded", String(o)); tg.textContent = (o ? "Hide " : "Show ") + `${placed.length} event${placed.length > 1 ? "s" : ""}`; });
        ol = document.createElement("ol"); ol.className = "evl";
        wrap.appendChild(ol); wrap.appendChild(tg); list.appendChild(wrap);
      }
    }
    const nodes = placed.map((p) => {
      const m = g.append("g").attr("class", "ev").attr("tabindex", -1);
      m.append("line").attr("x1", p.px).attr("x2", p.x).attr("y1", p.py + (p.y < p.py ? -4 : 4)).attr("y2", p.y + (p.y < p.py ? R : -R));
      m.append("circle").attr("class", "pt").attr("cx", p.px).attr("cy", p.py).attr("r", 3);
      m.append("circle").attr("class", "disc").attr("cx", p.x).attr("cy", p.y).attr("r", R);
      m.append("text").attr("x", p.x).attr("y", p.y + 3.9).attr("text-anchor", "middle").text(p.n);
      m.append("circle").attr("class", "hit").attr("cx", p.x).attr("cy", p.y).attr("r", 9);
      let li = null;
      if (ol) {
        li = document.createElement("li");
        li.tabIndex = 0;
        li.innerHTML = `<span class="n">${p.n}</span><b></b><span class="dt">${fmtDay(p.e._d)}</span>`;
        li.querySelector("b").textContent = p.e.label;
        li.setAttribute("aria-label", `${p.e.label}, ${fmtDay(p.e._d)}. ${p.e.text || ""}`);
        ol.appendChild(li);
      }
      return { p, m, li };
    });
    const scale = () => el.clientWidth / W;
    const on = (k) => {
      nodes.forEach((o, i) => { o.m.classed("on", i === k); if (o.li) o.li.classList.toggle("on", i === k); });
      if (k == null) { tip.style.opacity = 0; return; }
      const { p } = nodes[k];
      nodes[k].m.raise();
      tip.innerHTML = `<div class="tt">${p.e.label}</div><div class="note" style="margin-top:0">${fmtDay(p.e._d)}</div>${p.e.text ? `<div class="note">${p.e.text}</div>` : ""}`;
      tip.style.opacity = 1;
      const tw = tip.offsetWidth, th = tip.offsetHeight, cx = p.x * scale(), cy = p.y * scale();
      tip.style.left = Math.max(0, Math.min(el.clientWidth - tw, cx - tw / 2)) + "px";
      tip.style.top = (cy - th - 14 >= 0 ? cy - th - 14 : cy + 16) + "px";
    };
    nodes.forEach((o, i) => {
      o.m.on("pointerenter", () => on(i)).on("pointerleave", () => on(null)).on("click", (ev) => { ev.stopPropagation(); on(i); });
      if (o.li) { o.li.addEventListener("pointerenter", () => on(i)); o.li.addEventListener("pointerleave", () => on(null)); o.li.addEventListener("focus", () => on(i)); o.li.addEventListener("blur", () => on(null)); }
    });
    return g;
  }

  /* ---------- one horizontal stacked bar with a legend table under it ----------
     cfg = { parts:[{key,label,value,color,hatch,note}], total, fmt, animate } */
  function stackBar(el, cfg) {
    const draw = (animate) => {
      el.innerHTML = ""; el.classList.add("chart");
      const W = el.clientWidth || 600, H = 46;
      const total = cfg.total || d3.sum(cfg.parts, (p) => p.value);
      const x = d3.scaleLinear().domain([0, total]).range([0, W]);
      const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", cfg.aria || "Stacked bar");
      const gAll = svg.append("g");
      const tip = tipFor(el), card = css("--card");
      const L = document.createElement("div"); L.className = "lg-t";
      let acc = 0;
      const items = cfg.parts.map((p) => {
        const c = color(p.color);
        const x0 = x(acc), w = x(acc + p.value) - x0; acc += p.value;
        const fill = p.hatch ? hatchDef(svg, c, 0.22) : c;
        const rect = gAll.append("rect").attr("x", x0).attr("y", 1).attr("width", Math.max(1, w)).attr("height", H - 2).attr("fill", fill).attr("stroke", card).attr("stroke-width", 1);
        const share = ((p.value / total) * 100).toFixed(1) + "%";
        const d = document.createElement("div");
        d.innerHTML = `<div class="nm"><i class="${p.hatch ? "hatch" : ""}" style="${p.hatch ? `color:${c};border:1px solid ${c}` : `background:${c}`}"></i><span></span></div><div class="v">${(cfg.fmt || F.num)(p.value)}<span>${share}</span></div>`;
        d.querySelector(".nm span").textContent = p.label;
        L.appendChild(d);
        const showTip = (mx, my) => {
          tip.innerHTML = `<div class="tt">${p.label}</div><div class="tr"><i style="background:${c}"></i><span>${(cfg.fmt || F.num)(p.value)}</span><b>${share}</b></div>${p.note ? `<div class="note">${p.note}</div>` : ""}`;
          tip.style.opacity = 1; placeTip(el, tip, mx, my);
        };
        const hi = (on) => { d.classList.toggle("on", on); rect.attr("opacity", on ? 0.85 : 1); };
        rect.on("pointermove", (ev) => { const [mx, my] = d3.pointer(ev, el); showTip(mx, my); hi(true); }).on("pointerleave", () => { tip.style.opacity = 0; hi(false); });
        d.addEventListener("pointerenter", () => { hi(true); showTip((x0 + w / 2) * (el.clientWidth / W), 10); });
        d.addEventListener("pointerleave", () => { hi(false); tip.style.opacity = 0; });
        return d;
      });
      el.appendChild(L);
      if (animate) wipe(el, svg, gAll, 0, W, H);
      return items;
    };
    draw(cfg.animate); observe(el, () => draw(false));
  }

  /* ---------- waterfall ----------
     cfg = { steps:[{label, value, kind:'start'|'delta'|'end', color, textColor, hatch, note}], fmt, axisFmt, height }
     Steps are never thinner than 4px, so a small step reads as small rather than absent. Under 480px wide it turns
     horizontal: one row per step, label column on the left, value at the end of the bar. */
  function waterfall(el, cfg) {
    const draw = (animate) => {
      el.innerHTML = ""; el.classList.add("chart");
      const W = el.clientWidth || 600;
      let run = 0;
      const bars = cfg.steps.map((s) => {
        if (s.kind === "start" || s.kind === "end") { const b = { ...s, a: 0, b: s.value }; run = s.value; return b; }
        const b = { ...s, a: run, b: run + s.value }; run += s.value; return b;
      });
      const fmt = cfg.fmt || F.num;
      const val = (b) => (b.kind === "delta" ? (b.value > 0 ? "+" : MINUS) + fmt(Math.abs(b.value)) : fmt(b.value));
      const max = d3.max(bars, (b) => Math.max(b.a, b.b)) * 1.08;
      const tip = tipFor(el);
      const horiz = W < 480;
      const H = horiz ? bars.length * 30 + 28 : +el.dataset.h || cfg.height || 280;
      const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", cfg.aria || "Waterfall");
      const gAll = svg.append("g");
      const hover = (g, b, c) => g.on("pointermove", (ev) => { const [mx, my] = d3.pointer(ev, el); tip.innerHTML = `<div class="tt">${b.label.replace(/\n/g, " ")}</div><div class="tr"><i style="background:${c}"></i><span>${b.kind === "delta" ? "Change" : "Level"}</span><b>${val(b)}</b></div>${b.note ? `<div class="note">${b.note}</div>` : ""}`; tip.style.opacity = 1; placeTip(el, tip, mx, my); }).on("pointerleave", () => (tip.style.opacity = 0));
      if (horiz) {
        const M = { l: 92, r: 56, t: 4, b: 22 };
        const xs = d3.scaleLinear().domain([0, max]).nice(4).range([M.l, W - M.r]);
        const yb = d3.scaleBand().domain(bars.map((b) => b.label)).range([M.t, H - M.b]).padding(0.25);
        svg.append("g").attr("class", "grid").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(xs).ticks(3).tickSize(-(H - M.b - M.t)).tickFormat(""));
        svg.append("g").attr("class", "ax x").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(xs).ticks(3).tickSize(0).tickPadding(6).tickFormat(cfg.axisFmt || F.num)).select(".domain").remove();
        gAll.raise();
        bars.forEach((b) => {
          const c = color(b.color || "--c-total");
          const g = gAll.append("g");
          const x0 = xs(Math.min(b.a, b.b)), w = Math.max(4, Math.abs(xs(b.a) - xs(b.b)));
          g.append("rect").attr("x", b.value < 0 && w === 4 ? xs(b.a) - 4 : x0).attr("y", yb(b.label)).attr("height", yb.bandwidth()).attr("width", w).attr("fill", b.hatch ? hatchDef(svg, c, 0.22) : c).attr("stroke", b.hatch ? c : null).attr("stroke-width", b.hatch ? 1 : null);
          g.append("text").attr("x", M.l - 8).attr("y", yb(b.label) + yb.bandwidth() / 2 + 4).attr("text-anchor", "end").style("font", "500 12px var(--sans)").style("fill", css("--fg-2")).text(b.label.replace(/\n/g, " "));
          g.append("text").attr("x", Math.max(xs(b.a), xs(b.b)) + 6).attr("y", yb(b.label) + yb.bandwidth() / 2 + 4).style("font", "600 12px var(--sans)").style("fill", color(b.textColor || "--fg")).text(val(b));
          hover(g, b, c);
        });
      } else {
        const M = { t: 30, r: 8, b: 40, l: 52 };
        const x = d3.scaleBand().domain(bars.map((b) => b.label)).range([M.l, W - M.r]).padding(0.3);
        const y = d3.scaleLinear().domain([0, max]).nice(5).range([H - M.b, M.t]);
        svg.append("g").attr("class", "grid").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r)).tickFormat(""));
        svg.append("g").attr("class", "ax y").attr("transform", `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5).tickPadding(8).tickFormat(cfg.axisFmt || F.num));
        bars.forEach((b, i) => {
          const c = color(b.color || "--c-total");
          const g = gAll.append("g");
          let top = y(Math.max(b.a, b.b)), hh = Math.abs(y(b.a) - y(b.b));
          if (hh < 4) { if (b.value < 0) top = y(b.a); hh = 4; }
          g.append("rect").attr("x", x(b.label)).attr("width", x.bandwidth()).attr("y", top).attr("height", hh).attr("fill", b.hatch ? hatchDef(svg, c, 0.22) : c).attr("stroke", b.hatch ? c : null).attr("stroke-width", b.hatch ? 1 : null);
          if (i < bars.length - 1) gAll.append("line").attr("x1", x(b.label) + x.bandwidth()).attr("x2", x(bars[i + 1].label)).attr("y1", y(b.b)).attr("y2", y(b.b)).attr("stroke", css("--line-strong")).attr("stroke-dasharray", "2 2");
          g.append("text").attr("x", x(b.label) + x.bandwidth() / 2).attr("y", top - 7).attr("text-anchor", "middle").style("font", "600 12px var(--sans)").style("fill", color(b.textColor || "--fg")).text(val(b));
          hover(g, b, c);
        });
        gAll.raise();
        const ax = svg.append("g").attr("class", "ax x").attr("transform", `translate(0,${H - M.b})`).call(d3.axisBottom(x).tickSize(0).tickPadding(10));
        ax.selectAll("text").each(function (d) {
          const t = d3.select(this); const parts = String(d).split("\n"); t.text(null);
          parts.forEach((p, k) => t.append("tspan").attr("x", 0).attr("dy", k ? "1.2em" : 0).text(p));
        });
      }
      if (animate) wipe(el, svg, gAll, 0, W, H);
    };
    draw(cfg.animate); observe(el, () => draw(false));
    el.__vc = { draw };
  }

  /* ---------- horizontal bars (one value per row) ----------
     cfg = { rows:[{label, value, color, note, sub}], fmt, max } */
  function hbars(el, cfg) {
    const draw = () => {
      el.innerHTML = ""; el.classList.add("chart");
      const W = el.clientWidth || 600, rowH = 30;
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = "500 13px Manrope, sans-serif"; const tw = d3.max(cfg.rows, (r) => ctx.measureText(r.label).width) || 60;
      ctx.font = "600 12px Manrope, sans-serif"; const vw = d3.max(cfg.rows, (r) => ctx.measureText((cfg.fmt || F.num)(r.value)).width) || 40;
      const lab = Math.min(Math.max(tw + 22, 80), W * 0.45);   // 12px inset from the card edge + 10px before the bar
      const H = cfg.rows.length * rowH + 4;
      const x = d3.scaleLinear().domain([0, cfg.max || d3.max(cfg.rows, (r) => r.value)]).range([lab, W - vw - 14]);
      const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", cfg.aria || "Bar chart");
      const tip = tipFor(el);
      cfg.rows.forEach((r, i) => {
        const g = svg.append("g").attr("transform", `translate(0,${i * rowH + 2})`);
        const c = color(r.color || "--c-lead");
        g.append("text").attr("x", lab - 10).attr("y", rowH / 2 + 2).attr("text-anchor", "end").style("font", "500 13px var(--sans)").style("fill", css("--fg-2")).text(r.label);
        g.append("rect").attr("x", lab).attr("y", 6).attr("height", rowH - 12).attr("width", Math.max(2, x(r.value) - lab)).attr("fill", c).attr("rx", 1);
        g.append("text").attr("x", x(r.value) + 6).attr("y", rowH / 2 + 2).style("font", "600 12px var(--sans)").style("fill", css("--fg")).text((cfg.fmt || F.num)(r.value));
        if (r.note) g.on("pointermove", (ev) => { const [mx, my] = d3.pointer(ev, el); tip.innerHTML = `<div class="tt">${r.label}</div><div class="note" style="margin-top:0">${r.note}</div>`; tip.style.opacity = 1; placeTip(el, tip, mx, my); }).on("pointerleave", () => (tip.style.opacity = 0));
      });
    };
    draw(); observe(el, draw);
  }

  /* ---------- sparkline ---------- */
  function spark(el, values, opts = {}) {
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth || 100, H = el.clientHeight || 28;
      const v = values.filter((d) => d != null);
      if (v.length < 2) return;
      const x = d3.scaleLinear().domain([0, values.length - 1]).range([1, W - 3]);
      const y = d3.scaleLinear().domain(d3.extent(v)).nice().range([H - 2, 2]);
      const c = color(opts.color || "--c-lead");
      const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", "100%").attr("height", H).attr("aria-hidden", "true");
      svg.append("path").datum(values).attr("d", d3.line().defined((d) => d != null).x((d, i) => x(i)).y((d) => y(d))).attr("fill", "none").attr("stroke", c).attr("stroke-width", 1.4).attr("stroke-linejoin", "round");
      let li = values.length - 1; while (li > 0 && values[li] == null) li--;
      svg.append("circle").attr("cx", x(li)).attr("cy", y(values[li])).attr("r", 2.2).attr("fill", c);
    };
    draw(); observe(el, draw);
  }

  // ---------- resize + theme ----------
  // Every drawing registers here; dispose(root) disconnects everything inside a page that is being replaced.
  const registry = new Map();
  function observe(el, fn) {
    const prev = registry.get(el); if (prev) prev.ro.disconnect();
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (!el.isConnected) return; if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; fn(); } });
    ro.observe(el);
    registry.set(el, { ro, fn });
  }
  function dispose(root) {
    registry.forEach((v, el) => { if (!root || root.contains(el) || !el.isConnected) { v.ro.disconnect(); registry.delete(el); delete el.__vc; } });
    openTips.forEach((o) => { if (!o.el.isConnected || (root && root.contains(o.el))) openTips.delete(o); });
    ios.forEach((io) => io.disconnect()); ios.clear();
  }
  function redrawAll() { registry.forEach((v, el) => { if (el.isConnected) v.fn(); }); }

  // ---------- CSV ----------
  function toCSV(rows, cols) {
    cols = cols || Object.keys(rows[0] || {}).filter((k) => !k.startsWith("_"));
    const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
    return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  }
  function download(name, data, type = "text/csv") {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ---------- PNG export: the card's title, subtitle, plot, legend and source line, at 2x ---------- */
  let fontData = null;
  async function fontCSS() {
    if (fontData == null) {
      try {
        const buf = await (await fetch("vendor/fonts/manrope-latin-wght-normal.woff2")).arrayBuffer();
        let bin = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
        fontData = `@font-face{font-family:"Manrope";src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");font-weight:200 800;}`;
      } catch (e) { fontData = ""; }
    }
    return fontData;
  }
  const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "font-style", "paint-order", "display", "visibility", "text-anchor", "dominant-baseline", "stroke-linejoin"];
  function inlineSVG(svg) {
    const clone = svg.cloneNode(true);
    const src = svg.querySelectorAll("*"), dst = clone.querySelectorAll("*");
    src.forEach((n, i) => {
      const cs = getComputedStyle(n), d = dst[i];
      PROPS.forEach((p) => { const v = cs.getPropertyValue(p); if (v) d.style.setProperty(p, v); });
    });
    clone.querySelectorAll(".ov, .xhair, .hit").forEach((n) => n.remove());
    const bb = svg.getBoundingClientRect();
    clone.setAttribute("width", bb.width); clone.setAttribute("height", bb.height);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return { clone, w: bb.width, h: bb.height };
  }
  function wrapText(ctx, text, maxW) {
    const words = text.split(/\s+/), lines = []; let cur = "";
    words.forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }
  async function exportPNG(card, { title, sub, meta, src, name }) {
    const svgs = [...card.querySelectorAll(".card-b svg")].filter((s) => !s.closest(".tip") && s.getBoundingClientRect().width > 50);
    if (!svgs.length) return;
    const fcss = await fontCSS();
    const S = 2, pad = 24, Wd = Math.max(...svgs.map((s) => s.getBoundingClientRect().width)) + pad * 2;
    const meas = document.createElement("canvas").getContext("2d");
    meas.font = "600 18px Manrope"; const tl = wrapText(meas, title, Wd - pad * 2);
    meas.font = "500 14px Manrope"; const sl = sub ? wrapText(meas, sub, Wd - pad * 2) : [];
    const leg = [...card.querySelectorAll(".legend button, .legend span.li, .lg-t > div")].map((b) => {
      const i = b.querySelector("i"); const cs = i ? getComputedStyle(i) : null;
      const dashed = !!(i && (i.classList.contains("part") || i.classList.contains("dash")));
      const c = cs ? (dashed || i.classList.contains("hatch") ? cs.borderTopColor : cs.backgroundColor) : "#999";
      return { c, t: b.textContent.trim().replace(/\s+/g, " "), off: b.getAttribute("aria-pressed") === "false", dashed, hatch: !!(i && i.classList.contains("hatch")) };
    }).filter((l) => !l.off);
    const evs = [...card.querySelectorAll(".evl li")].map((li) => ({ n: li.querySelector(".n").textContent, t: `${li.querySelector("b").textContent}, ${li.querySelector(".dt").textContent}` }));
    const parts = [];
    for (const s of svgs) {
      const { clone, w, h } = inlineSVG(s);
      const st = document.createElementNS("http://www.w3.org/2000/svg", "style"); st.textContent = fcss; clone.insertBefore(st, clone.firstChild);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
      const img = new Image(); img.src = url; await img.decode().catch(() => {});
      parts.push({ img, w, h, url });
    }
    meas.font = "500 12px Manrope";
    const evRows = Math.ceil(evs.length / 2), legH = leg.length ? 26 : 0, evH = evs.length ? evRows * 18 + 8 : 0;
    const SRC_FONT = "italic 400 11.5px Manrope"; meas.font = SRC_FONT; const srcL = wrapText(meas, (src ? "Source: " + src.replace(/\.?\s*$/, ". ") : "") + "Blockchain at Berkeley.", Wd - pad * 2);
    const H = pad + tl.length * 24 + sl.length * 20 + (meta ? 20 : 0) + 12 + d3.sum(parts, (p) => p.h + 8) + legH + evH + srcL.length * 17 + 24;
    const cv = document.createElement("canvas"); cv.width = Wd * S; cv.height = H * S;
    const ctx = cv.getContext("2d"); ctx.scale(S, S);
    ctx.fillStyle = css("--card"); ctx.fillRect(0, 0, Wd, H);
    let yy = pad + 16;
    ctx.fillStyle = css("--fg"); ctx.font = "600 18px Manrope"; tl.forEach((l) => { ctx.fillText(l, pad, yy); yy += 24; });
    ctx.fillStyle = css("--muted"); ctx.font = "500 14px Manrope"; sl.forEach((l) => { ctx.fillText(l, pad, yy - 2); yy += 20; });
    if (meta) { ctx.font = "500 12px Manrope"; ctx.fillText(meta, pad, yy - 2); yy += 20; }
    yy += 4;
    parts.forEach((p) => { ctx.drawImage(p.img, pad, yy, p.w, p.h); yy += p.h + 8; URL.revokeObjectURL(p.url); });
    if (leg.length) {
      ctx.font = "500 12px Manrope"; let lx = pad;
      leg.forEach((l) => {
        if (l.dashed || l.hatch) { ctx.strokeStyle = l.c; ctx.lineWidth = 1; ctx.setLineDash(l.dashed ? [3, 2] : []); ctx.strokeRect(lx + 0.5, yy + 2.5, 9, 9); ctx.setLineDash([]); }
        else { ctx.fillStyle = l.c; ctx.fillRect(lx, yy + 2, 10, 10); }
        ctx.fillStyle = css("--fg-2"); ctx.fillText(l.t, lx + 15, yy + 11); lx += 15 + ctx.measureText(l.t).width + 18;
      });
      yy += legH;
    }
    if (evs.length) {
      ctx.font = "500 12px Manrope"; ctx.fillStyle = css("--fg-2");
      const colW = (Wd - pad * 2) / 2;
      evs.forEach((e, i) => {
        const ex = pad + (i < evRows ? 0 : colW), ey = yy + 12 + (i % evRows) * 18;
        ctx.fillStyle = css("--fg"); ctx.beginPath(); ctx.arc(ex + 8, ey - 4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css("--card"); ctx.font = "600 10px Manrope"; ctx.textAlign = "center"; ctx.fillText(e.n, ex + 8, ey - 0.5); ctx.textAlign = "left";
        ctx.fillStyle = css("--fg-2"); ctx.font = "500 12px Manrope"; ctx.fillText(e.t, ex + 22, ey);
      });
      yy += evH;
    }
    ctx.fillStyle = css("--muted"); ctx.font = SRC_FONT;
    srcL.forEach((l) => { ctx.fillText(l, pad, yy + 14); yy += 17; });
    window.__lastExport = { title, sub, meta, src, srcFont: SRC_FONT, events: evs.map((e) => e.n + " " + e.t), legend: leg.map((l) => ({ label: l.t, dashed: l.dashed })), name };
    cv.toBlob((b) => download(name, b, "image/png"), "image/png");
  }

  window.VC = { observe, dispose, timeChart, stackBar, waterfall, hbars, spark, F, compact, css, color, redrawAll, toCSV, download, exportPNG, parse, fmtDay, fmtDayShort, fmtMon, MINUS };
})();
