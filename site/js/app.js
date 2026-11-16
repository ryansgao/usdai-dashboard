/* USD.AI and CHIP deep dive: pages as tabs (?tab=), each chart with its own range, interval and menu. Numbers come
   from window.USDAI (pipeline/build.py); words are written here next to the figures they describe, and any sentence
   whose direction depends on the data is chosen by a small function, so a refresh cannot leave stale wording. */
(function () {
  const V = window.USDAI || {}, K = V.kpi || {}, META = V.meta || {};
  const F = VC.F, C = VC.compact, MINUS = VC.MINUS;
  const $ = (s, el = document) => el.querySelector(s);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ok = (v) => v != null && isFinite(v);
  const pct = (v, d = 0) => (!ok(v) ? "–" : (v < 0 ? MINUS : "") + Math.abs(v * 100).toFixed(d) + "%");
  const m$ = (v, d = 1) => (!ok(v) ? "–" : "$" + (v / 1e6).toFixed(d) + "M");
  const vM = (v, d = 1) => (!ok(v) ? "–" : (v < 0 ? MINUS : "") + (Math.abs(v) / 1e6).toFixed(d) + "M");
  const xx = (v, d = 1) => (!ok(v) ? "–" : v.toFixed(d) + "×");
  const parse = VC.parse;
  const day = (s) => (s ? VC.fmtDay(parse(String(s).slice(0, 10))) : "–");
  const D = V.daily || [], MON = V.monthly || [];
  const AS_OF = META.as_of || (D.length ? D[D.length - 1].d : "");
  const YEAR = AS_OF.slice(0, 4);
  const monRow = (k) => MON.find((m) => m.m === k);
  // "October" in the current year, "October 2025" otherwise
  const monName = (k) => (!k ? "–" : d3.utcFormat(k.slice(0, 4) === YEAR ? "%B" : "%B %Y")(parse(k + "-01")));
  const timeUTC = (s) => { if (!s) return ""; const t = new Date(s.replace(/Z?$/, "Z").replace("+00:00Z", "Z")); return isNaN(t) ? "" : d3.utcFormat("%b %-d, %Y, %H:%M")(t); };
  const twice = (r) => (r < 1.5 ? "about the same as" : r < 2.5 ? "about twice" : r < 3.5 ? "about three times" : `about ${Math.round(r)} times`);
  const arrow = (d, f = (v) => pct(v, 1)) => (!ok(d) ? "" : `<span class="${d > 0 ? "up" : d < 0 ? "down" : "flat"}">${d > 0 ? "↑" : d < 0 ? "↓" : ""} ${f(Math.abs(d))}</span>`);
  const retFmt = (v) => (Math.abs(v) >= 1 ? d3.format(",.0f")(v * 100) : (v * 100).toFixed(1)) + "%";
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
  // signed changes read by colour: gain green, loss red, zero muted (theme's --gain / --loss)
  const sgnCls = (v) => (!ok(v) || v === 0 ? "muted" : v > 0 ? "up" : "down");
  const ICON = {
    dl: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 2.5v7.5m0 0 3-3m-3 3-3-3M3 12.5h10"/></svg>',
    img: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1"/><path d="m3 11 3.5-3.5 2.5 2.5 1.5-1.5L13 11"/></svg>',
    link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.7.7M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.7-.7"/></svg>',
    full: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    more: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>',
    copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/></svg>',
    ext: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5"/></svg>',
  };

  /* ---------- numbers the words use ----------
     Every sentence below reads its figures from K (kpi) or the tables. A sentence whose direction depends on the data
     (up or down, bigger or smaller) picks its verb with a small test next to it. */
  const RPC = K.rpc || {};
  const usdM = (v, d = 0) => (!ok(v) ? "–" : "$" + (v / 1e6).toFixed(d) + "M");
  const usdB = (v) => (!ok(v) ? "–" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : usdM(v, 0));
  const chipP = (v) => (!ok(v) ? "–" : "$" + (v < 0.1 ? v.toFixed(4) : v.toFixed(3)));
  const yrs = (m) => (!ok(m) ? "–" : m < 24 ? Math.round(m) + " months" : (m / 12).toFixed(m < 120 ? 1 : 0) + " years");
  const monthOf = (s) => (s ? d3.utcFormat("%B %Y")(parse(s.slice(0, 7) + "-01")) : "–");
  const dayOf = (s) => (s ? d3.utcFormat("%b %-d")(parse(s.slice(0, 10))) : "–");
  const lentNow = (K.vault_loans || 0) + (K.vault_escrow || 0);
  const lentShare = ok(K.vault_nav) && K.vault_nav ? lentNow / K.vault_nav : K.lent_share;
  const LP = K.last_payout || {};
  const PAY = V.payouts || [];
  const bigPay = PAY.slice().sort((a, b) => b.usd - a.usd);
  const feeYr = ok(K.fee_last_month) ? K.fee_last_month * 12 : null;
  const unlockUSD = K.unlock_cliff_usd;
  const LOANS = V.loans || [];
  const firstLoan = LOANS.find((l) => l.start);
  const rates = (K.v2_rates || []).filter((r) => r > 0.02 && r < 0.3);
  const rateRange = rates.length ? `${pct(Math.min(...rates), 1)} to ${pct(Math.max(...rates), 1)}` : "–";
  const chg30 = K.chip_change_30d, btc30 = K.btc_change_30d;
  const W = {
    thesis: () => `sUSDai holds ${usdM(K.vault_nav)} and has ${pct(lentShare)} of it lent to GPU operators or set aside for loans waiting on hardware. Holders earned ${pct(K.apy_30d, 1)} a year over the last 30 days. CHIP, the governance token, has no legal claim on that income; since October 28 the company has been buying it with the protocol's 10% fee, which comes to about ${usdM(K.fee_last_month, 2)} a month.`,
    loansRead: () => `The first loan went out on ${firstLoan ? day(firstLoan.start) : "–"}. On-chain we count ${K.loans_total} loans to ${K.borrowers} borrower addresses, ${usdM(K.originated_usd)} in all, and ${usdM(K.vault_escrow)} sits in escrow today for hardware still being installed. Newer loans charge ${rateRange} a year over three years.`,
    exitRead: () => `Deposits leave once a month, in bulk. ${usdM(LP.usd)} went out on ${dayOf(LP.d)}, the ${bigPay[0] && bigPay[0].d === LP.d ? "largest payout so far" : bigPay[1] && bigPay[1].d === LP.d ? "second-largest payout after " + monthOf(bigPay[0].d) + "'s " + usdM(bigPay[0].usd) : "latest big payout"}, and ten wallets took ${pct(LP.top10)} of it. The vault paid it without selling loans because it held cash.`,
    chipRead: () => `At the current pace the fee buys about ${usdM(feeYr, 1)} of CHIP a year, ${pct(K.buyback_yield_on_mcap, 1)} of its market cap. In ${monthOf(K.unlock_date)} about ${(K.unlock_cliff_chip / 1e9).toFixed(2)}B CHIP from investors and contributors unlock, worth ${usdM(unlockUSD)} today: ${yrs(K.buyback_months_for_cliff)} of buybacks.`,
    vsBuyback: () => !ok(K.chip_price) ? "" : K.chip_price < K.buyback_1m_price ? `At ${chipP(K.chip_price)} it trades ${pct(1 - K.chip_price / K.buyback_1m_price)} below the $0.0448 the company paid on October 28.` : `At ${chipP(K.chip_price)} it trades above the $0.0448 the company paid on October 28.`,
    chipMove: () => !ok(chg30) ? "" : `CHIP is ${chg30 < 0 ? "down" : "up"} ${pct(Math.abs(chg30))} over 30 days${ok(btc30) ? `, against ${btc30 < 0 ? "a " + pct(Math.abs(btc30)) + " fall" : "a " + pct(btc30) + " rise"} in bitcoin` : ""}.`,
  };
  /* ---------- URL and per-chart state ----------
     Range, interval, scale and hidden series are kept per chart for the session, so they survive tab changes and the
     theme switch. A chart link carries them in the query for the linked chart only. */
  const TABS = [["overview", "Overview"], ["vault", "Deposits"], ["loans", "Loans"], ["yield", "Yield"], ["redemptions", "Redemptions"], ["chip", "CHIP"], ["valuation", "Valuation"], ["method", "Method"]];
  const q = new URLSearchParams(location.search);
  let tabQ = (q.get("tab") || "").toLowerCase();
  let tab = TABS.some((t) => t[0] === tabQ) ? tabQ : "overview";
  let ST = {};
  try { ST = JSON.parse(sessionStorage.getItem("usdai-charts") || "{}"); } catch (e) {}
  const saveST = () => { try { sessionStorage.setItem("usdai-charts", JSON.stringify(ST)); } catch (e) {} };
  // a deep link's chart state applies once, to the linked chart
  const hashSlug = (() => { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; } })();
  if (hashSlug && (q.get("range") || q.get("int"))) { ST[hashSlug] = { ...(ST[hashSlug] || {}), ...(q.get("range") ? { p: q.get("range") } : {}), ...(q.get("int") ? { g: q.get("int") } : {}) }; }
  const urlFor = (t, extra) => { const u = new URLSearchParams(location.search); u.delete("range"); u.delete("int"); if (t === "overview") u.delete("tab"); else u.set("tab", t); Object.entries(extra || {}).forEach(([k, v]) => u.set(k, v)); const s = u.toString(); return location.pathname + (s ? "?" + s : ""); };
  const writeURL = () => history.replaceState(history.state, "", urlFor(tab) + location.hash);

  /* ---------- copy to clipboard, with a fallback when the page may not use the clipboard ---------- */
  const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 1600); };
  function copyText(text, msg = "Link copied") {
    const legacy = () => {
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta); ta.select(); let done = false; try { done = document.execCommand("copy"); } catch (e) {} ta.remove();
      if (done) toast(msg); else window.prompt("Copy this link:", text);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => toast(msg), legacy); else legacy();
  }

  /* ---------- time windows and intervals ---------- */
  const LAST = AS_OF;
  const fromOf = (p, last = LAST) => {
    if (p === "All") return "0000-00-00";
    if (p === "YTD") return last.slice(0, 4) + "-01-01";
    return iso(d3.utcDay.offset(monthsAgo(parse(last), { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 }[p]), 1));
  };
  // calendar-safe: Mar 31 minus one month is Feb 28 (29), not Mar 3
  function monthsAgo(t, n) {
    const m = d3.utcMonth.offset(d3.utcMonth.floor(t), -n), dim = d3.utcDay.count(m, d3.utcMonth.offset(m, 1));
    return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(t.getUTCDate(), dim)));
  }
  const DAILY_P = ["1M", "3M", "6M", "YTD", "1Y", "All"], MONTH_P = ["6M", "YTD", "1Y", "All"];
  // Intervals a window can carry: 1M daily only; 3M daily or weekly; longer any.
  const intervalsFor = (p) => (p === "1M" ? ["D"] : p === "3M" ? ["D", "W"] : ["D", "W", "M"]);
  const INT_LABEL = { A: "Auto", D: "Daily", W: "Weekly", M: "Monthly" };
  const autoInt = (p, bars) => (!bars ? "D" : ["1M", "3M", "6M"].includes(p) ? "D" : "W");
  const iso = (d) => d.toISOString().slice(0, 10);
  const partText = (s, e, n, of) => +s === +e ? `${VC.fmtDay(s)}, ${n} of ${of} days` : partTextR(s, e, n, of);
  const partTextR = (s, e, n, of) => `${VC.fmtDayShort(s)}–${d3.utcFormat(+s === +e ? "%Y" : "%-d, %Y")(e).replace(/^(\d+), /, (m) => (s.getUTCMonth() === e.getUTCMonth() ? m : d3.utcFormat("%b ")(e) + m))}, ${n} of ${of} days`;
  // Group daily rows into calendar months or ISO weeks: flows are summed, levels take the last value, rates the mean.
  // A bucket with fewer days of data than the period has is marked as partial.
  function regroup(rows, g, agg) {
    const fields = Object.keys(agg);
    const start = (d) => (g === "M" ? d3.utcMonth.floor(parse(d)) : d3.utcMonday.floor(parse(d)));
    return d3.groups(rows, (r) => +start(r.d)).map(([k, rs]) => {
      const s = new Date(k), e = g === "M" ? d3.utcMonth.offset(s, 1) : d3.utcDay.offset(s, 7);
      const of = Math.round((e - s) / 864e5);
      const present = rs.filter((r) => fields.some((f) => r[f] != null));
      const o = { d: iso(s), period_start: iso(s), period_end: iso(d3.utcDay.offset(e, -1)), days: present.length, _last: present.length ? present[present.length - 1].d : null };
      fields.forEach((f) => {
        const vals = rs.map((r) => r[f]).filter((v) => v != null);
        o[f] = !vals.length ? null : agg[f] === "sum" ? d3.sum(vals) : agg[f] === "mean" ? d3.mean(vals) : vals[vals.length - 1];
      });
      if (present.length && present.length < of) o._part = partText(parse(present[0].d), parse(present[present.length - 1].d), present.length, of);
      return o;
    });
  }
  // Monthly table rows: mark months a source covers only in part (start or end of its history).
  const monthRows = (src) => MON.map((m) => {
    const dim = m.days_in_month || new Date(Date.UTC(+m.m.slice(0, 4), +m.m.slice(5, 7), 0)).getUTCDate();
    const n = m.days_covered ? (Array.isArray(src) ? Math.min(...src.map((k) => m.days_covered[k] ?? dim)) : m.days_covered[src]) : m.days;
    const cv = m.covered && (Array.isArray(src) ? m.covered[src[0]] : m.covered[src]);
    const r = { ...m, d: m.m + "-01" };
    if (n != null && n > 0 && n < dim) r._part = cv ? partText(parse(cv[0]), parse(cv[1]), n, dim) : `${n} of ${dim} days`;
    return r;
  });
  // CSV: real period dates, rounded values, formula-safe text, named for the chart, window and interval.
  const round = (v) => (typeof v === "number" ? (Math.abs(v) >= 100 ? Math.round(v * 100) / 100 : +v.toPrecision(6)) : typeof v === "string" && /^[=+\-@]/.test(v) && isNaN(+v) ? "'" + v : v);
  const csvRows = (rows) => rows.map((r) => { const o = {}; Object.keys(r).forEach((k) => { if (!k.startsWith("_")) o[k] = round(r[k]); }); return o; });

  /* ---------- figure: card with header controls, plot, source line under it ---------- */
  const BASIS = { onchain: "On-chain", thirdparty: "Third-party classification", modeled: "Modeled", reported: "Reported by USD.AI", mixed: "Mixed sources" };
  const srcText = (o) => [o.src, o.basis ? BASIS[o.basis] + (o.conf ? ", " + o.conf + " confidence" : "") : ""].filter(Boolean).join(". ");
  let ANIM = false;
  const SEEN = new Set();
  function fig({ slug, span = 6, title, sub, basis, conf, src, body, menu = [], ctl = "" }) {
    const srcLine = src || basis ? `<div class="src">${src ? "Source: " + src.replace(/\.\s*$/, "") + "." : ""}${basis ? ` <span class="basis">${BASIS[basis]}${conf ? ", " + conf + " confidence" : ""}.</span>` : ""}</div>` : "<div></div>";
    const el = h(`<section class="fig s${span}" id="${slug}"><div class="card">
      <div class="card-h"><div class="hi"><div class="t"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="cc">${ctl}
        <div class="dd more"><button class="ibtn" type="button" aria-label="Chart options" aria-haspopup="menu" aria-expanded="false" title="Download, link, full screen">${ICON.more}</button>
        <div class="menu" role="menu" hidden></div></div></div></div></div>
      <div class="card-b"></div></div>${srcLine}</section>`);
    const bodyEl = el.querySelector(".card-b");
    if (typeof body === "string") bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    const items = [...menu, { icon: "link", label: "Copy link to chart", run: () => copyText(location.origin + (el.__link ? el.__link() : urlFor(tab)) + "#" + slug) }, { icon: "full", k: "full", label: "Full screen", run: () => (el.__exitFull ? el.__exitFull() : fullScreen(el)) }];
    const m = el.querySelector(".menu");
    items.forEach((it) => { const b = h(`<button type="button" role="menuitem"${it.k ? ` data-k="${it.k}"` : ""}>${ICON[it.icon]}<span>${it.label}</span></button>`); b.addEventListener("click", () => { closeMenus(); it.run(); }); m.appendChild(b); });
    wireMenu(el.querySelector(".more"));
    return el;
  }
  // menus: one open at a time; Escape and outside clicks close them
  function closeMenus(except) { document.querySelectorAll(".dd .menu:not([hidden])").forEach((m) => { if (m.parentNode !== except) { m.hidden = true; const b = m.parentNode.querySelector("[aria-expanded]"); if (b) b.setAttribute("aria-expanded", "false"); } }); }
  function wireMenu(dd) {
    const b = dd.querySelector("button"), m = dd.querySelector(".menu");
    b.addEventListener("click", (e) => { e.stopPropagation(); const open = m.hidden; closeMenus(dd); m.hidden = !open; b.setAttribute("aria-expanded", String(open)); if (open) { const f = m.querySelector("a,button"); if (f) f.focus(); } });
    m.addEventListener("keydown", (e) => {
      const its = [...m.querySelectorAll("a,button")], i = its.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      if (e.key === "Escape") { closeMenus(); b.focus(); }
    });
  }
  document.addEventListener("click", (e) => { if (!e.target.closest(".dd")) closeMenus(); });

  // Full screen: the card fills the window; Escape or the scrim closes it.
  // Full screen: the card fills the window with a visible close button; Escape, the scrim, the button, the menu item
  // and the browser's Back all close it. Entering pushes a history entry so Back closes the card instead of leaving.
  let ignorePop = false;
  function fullScreen(el) {
    if (document.querySelector(".fig.full")) return;
    const scrim = h('<div class="scrim"></div>');
    const charts = [...el.querySelectorAll(".card-b .chart")];
    const more = el.querySelector(".more > button");
    const close = h(`<button type="button" class="ibtn fs-close" aria-label="Exit full screen" title="Exit full screen">${ICON.close}</button>`);
    const item = [...el.querySelectorAll(".menu [role=menuitem]")].find((m) => m.dataset.k === "full");
    const exit = (fromPop) => {
      if (!el.classList.contains("full")) return;
      el.classList.remove("full"); el.removeAttribute("role"); el.removeAttribute("aria-modal"); scrim.remove(); close.remove();
      if (item) item.querySelector("span").textContent = "Full screen";
      charts.forEach((c) => { delete c.dataset.h; if (c.__vc) c.__vc.draw(false); });
      document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; el.__exitFull = null;
      if (!fromPop && history.state && history.state.fs) { ignorePop = true; history.back(); }
      if (more) more.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key === "Escape") exit();
      if (e.key === "Tab") { const f = [...el.querySelectorAll("button, a, select, [tabindex='0']")].filter((x) => x.offsetParent); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    };
    document.body.appendChild(scrim); el.classList.add("full"); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.style.overflow = "hidden";
    el.querySelector(".card-h").appendChild(close);
    if (item) item.querySelector("span").textContent = "Exit full screen";
    history.pushState({ ...(history.state || {}), fs: el.id }, "");
    const room = Math.max(240, el.querySelector(".card").clientHeight - el.querySelector(".card-h").offsetHeight - 110);
    charts.forEach((c) => { if (c.__vc && c.__vc.cfg) { c.dataset.h = Math.round(room / charts.length); c.__vc.draw(false); } });
    scrim.addEventListener("click", () => exit()); close.addEventListener("click", () => exit()); document.addEventListener("keydown", onKey);
    el.__exitFull = exit;
    close.focus({ preventScroll: true });
  }

  /* opts.time = { rows, key: "d" | "m", def, agg: {field: "sum"|"mean"|"last"}, bars: bool, csvCols }
     build(rows, g, ctx) returns the chart config for the rows in the chosen window and interval. */
  function chartFig(opts, build) {
    const tm = opts.time, slug = opts.slug;
    const st = (ST[slug] = ST[slug] || {});
    const firstD = tm.rows.length ? (tm.key === "m" ? tm.rows[0].m + "-01" : tm.rows[0].d) : LAST;
    const lastD = tm.rows.length ? (tm.key === "m" ? tm.rows[tm.rows.length - 1].m + "-01" : tm.rows[tm.rows.length - 1].d) : LAST;
    const ref = tm.key === "m" ? lastD : LAST;
    // TradingView rule: a preset that would show the whole series anyway is not offered.
    let presets = (tm.key === "m" ? MONTH_P : DAILY_P).filter((x) => x === "All" || (tm.key === "m" ? monthsBack(x, ref) > firstD : fromOf(x) > firstD));
    if (presets.length < 2) presets = [];
    const def = presets.includes(tm.def) ? tm.def : presets.includes("1Y") && tm.key !== "m" ? "1Y" : "All";
    let p = presets.includes(st.p) ? st.p : def;
    const hasInt = !!tm.agg;
    let g = hasInt ? (["A", "D", "W", "M"].includes(st.g) ? st.g : "A") : null;
    let log = st.log != null ? st.log : null, cmp = !!st.cmp;
    const box = document.createElement("div");
    let body = box, list = null;
    if (opts.events) {
      body = h(`<div class="with-events${opts.eventsBelow ? " below" : ""}"><div class="plot"></div><div class="evs"></div></div>`);
      body.querySelector(".plot").appendChild(box); list = body.querySelector(".evs");
    }
    let readout = null;
    if (opts.readout) { readout = h('<div class="readout" aria-live="off"><span class="rv"></span><span class="rd"></span><span class="rt"></span></div>'); const wrap = document.createElement("div"); wrap.appendChild(readout); wrap.appendChild(body); body = wrap; }
    const ret = opts.returns ? (x) => { const rows = tm.rows.filter((r) => r.d >= fromOf(x) && r[opts.returns] != null); return rows.length > 1 ? rows[rows.length - 1][opts.returns] / rows[0][opts.returns] - 1 : null; } : null;
    const ctl = `${presets.length ? `<div class="rng${ret ? " ret" : ""}" role="group" aria-label="Time range">${presets.map((x) => { const r = ret && ret(x); return `<button type="button" data-p="${x}" aria-pressed="${x === p}">${x}${ret ? `<small class="${r > 0 ? "up" : r < 0 ? "down" : ""}">${ok(r) ? (r > 0 ? "+" : MINUS) + retFmt(Math.abs(r)) : ""}</small>` : ""}</button>`; }).join("")}</div>
      <select class="sel rng-sel" aria-label="Time range">${presets.map((x) => `<option value="${x}"${x === p ? " selected" : ""}>${x}</option>`).join("")}</select>` : ""}
      ${hasInt ? `<select class="sel int" aria-label="Interval"></select>` : ""}${opts.compare ? `<button type="button" class="chip cmp" aria-pressed="false" title="Index CHIP and BTC to 100 at the start of the range">vs BTC</button>` : ""}${opts.logToggle ? `<button type="button" class="chip log" aria-pressed="false" title="Logarithmic price scale">Log</button>` : ""}`;
    let cur = [], curG = "D";
    const menu = [
      { icon: "dl", label: "Download CSV", run: () => VC.download(`usdai_${slug}_${p || "all"}_${INT_LABEL[curG].toLowerCase()}_${AS_OF}.csv`, VC.toCSV(csvRows(cur.map((r) => { const o = curG === "D" && tm.key === "d" ? { date: r.d } : tm.key === "m" ? { month: r.m } : { period_start: r.period_start, period_end: r.period_end, days: r.days }; (opts.csvCols || []).forEach((c) => (o[c] = r[c])); return o; })))) },
      { icon: "img", label: "Download PNG", run: () => VC.exportPNG(el.querySelector(".card"), { title: el.querySelector("h3").textContent, sub: (el.querySelector(".sub") || {}).textContent || "", meta: `${p || "All"}, ${INT_LABEL[curG].toLowerCase()}. Data through ${day(AS_OF)}.`, src: srcText(opts), name: `usdai_${slug}_${p || "all"}_${INT_LABEL[curG].toLowerCase()}_${AS_OF}.png` }) },
    ];
    const el = fig({ ...opts, body, menu, ctl });
    if (opts.note) el.querySelector(".card-b").appendChild(h(`<p class="card-note">${opts.note}</p>`));
    el.__link = () => urlFor(tab, { ...(p ? { range: p } : {}), ...(hasInt ? { int: g } : {}) });
    const intSel = el.querySelector(".int"), logBtn = el.querySelector(".log"), cmpBtn = el.querySelector(".cmp");
    // Bars are never thinner than 3px: an interval whose bars would be is disabled, and Auto moves to the next coarser one.
    const barPx = (k) => {
      if (!tm.bars) return Infinity;
      const from = fromOf(p), d0 = parse(from === "0000-00-00" ? firstD : from < firstD ? firstD : from), days = Math.max(1, (parse(LAST) - d0) / 864e5);
      const plotW = Math.max(200, (box.clientWidth || el.clientWidth - 32 || 600) - 66);
      return (plotW / (days / ({ D: 1, W: 7, M: 30.44 }[k]))) * 0.75;
    };
    const autoFor = () => { const a = autoInt(p, tm.bars), order = ["D", "W", "M"]; return order.slice(order.indexOf(a)).find((k) => barPx(k) >= 3) || "M"; };
    const fillInt = () => {
      if (!intSel) return;
      const allowed = intervalsFor(p);
      const thin = (k) => barPx(k) < 3;
      if (g !== "A" && (!allowed.includes(g) || thin(g))) g = "A";
      const auto = autoFor();
      intSel.innerHTML = ["A", ...allowed].map((k) => `<option value="${k}"${k === g ? " selected" : ""}${k !== "A" && thin(k) ? ` disabled title="Bars would be under 3px wide at this range"` : ""}>${k === "A" ? `Auto (${INT_LABEL[auto].toLowerCase()})` : INT_LABEL[k] + (k !== "A" && thin(k) ? " (too dense)" : "")}</option>`).join("");
      intSel.style.display = allowed.length > 1 ? "" : "none";
    };
    // The readout always works on daily values for the chosen window, whatever the interval, so it agrees with the
    // return printed on the preset button; a hovered week or month is labelled by its period and its last day.
    let dailyWin = [];
    const setRO = (r) => {
      if (!readout) return;
      const k = opts.readout, v = dailyWin.filter((x) => x[k] != null);
      if (!v.length) return;
      const lastOf = (x) => (x && x._last ? v.find((d) => d.d === x._last) || x : x);
      const row = r ? lastOf(r) : v[v.length - 1];
      const per = r && r.period_start ? `${curG === "W" ? "Week of " + VC.fmtDayShort(parse(r.period_start)) : d3.utcFormat("%b %Y")(parse(r.period_start))}, last day ${day(row.d)}` : day(row.d);
      if (cmp) {
        const e = dailyWin.filter((x) => x.btc_price != null), er = e.length ? (r ? lastOf(r) : e[e.length - 1]) : null;
        readout.querySelector(".rv").textContent = "CHIP " + (row[k] / v[0][k] - 1 >= 0 ? "+" : MINUS) + retFmt(Math.abs(row[k] / v[0][k] - 1));
        readout.querySelector(".rd").innerHTML = er && er.btc_price ? `<span class="muted">BTC ${(er.btc_price / e[0].btc_price - 1 >= 0 ? "+" : MINUS) + retFmt(Math.abs(er.btc_price / e[0].btc_price - 1))}</span>` : "";
        readout.querySelector(".rt").textContent = `${per}, since ${day(v[0].d)}`;
        return;
      }
      const ch = row[k] / v[0][k] - 1;
      readout.querySelector(".rv").textContent = (opts.readoutFmt || F.usd2)(row[k]);
      readout.querySelector(".rd").innerHTML = arrow(ch, retFmt);
      readout.querySelector(".rt").textContent = r ? `${per}, since ${day(v[0].d)}` : `${day(row.d)}, ${p === "All" ? "since launch" : p === "YTD" ? "year to date" : "over " + p}`;
    };
    const draw = (animate) => {
      const from = tm.key === "m" ? monthsBack(p, ref) : fromOf(p);
      fillInt();
      const gEff = hasInt ? (g === "A" ? autoFor() : g) : tm.key === "m" ? "M" : "D";
      let rows;
      if (tm.key === "d") dailyWin = tm.rows.filter((r) => r.d >= from);
      if (tm.key === "m") rows = tm.rows.filter((r) => r.m + "-01" >= from);
      else {
        // a weekly or monthly view starts on a period boundary so the first bar is a whole period
        const snap = gEff === "W" ? iso(d3.utcMonday.floor(parse(from === "0000-00-00" ? firstD : from))) : gEff === "M" ? iso(d3.utcMonth.floor(parse(from === "0000-00-00" ? firstD : from))) : from;
        rows = tm.rows.filter((r) => r.d >= snap);
        if (gEff !== "D") rows = regroup(rows, gEff, tm.agg);
      }
      cur = rows; curG = gEff;
      const useLog = opts.logToggle && !cmp ? (log != null ? log : p === "All") : false;
      if (logBtn) { logBtn.setAttribute("aria-pressed", String(useLog)); logBtn.disabled = cmp; }
      if (cmpBtn) cmpBtn.setAttribute("aria-pressed", String(cmp));
      const c = build(rows, gEff, { p, cmp });
      c.period = tm.key === "m" ? "M" : gEff;
      if (opts.logToggle) c.logY = useLog;
      if (!c.tipDate) c.tipDate = gEff === "W" ? (d) => "Week of " + VC.fmtDay(d) : gEff === "M" ? (d) => VC.fmtMon(d) : undefined;
      c.aria = c.aria || el.querySelector("h3").textContent + ". " + ((el.querySelector(".sub") || {}).textContent || "");
      c.hidden = new Set(st.hidden || []);
      c.onHidden = (hs) => { st.hidden = [...hs]; saveST(); };
      if (readout) c.onHover = (r) => setRO(r);
      if (list) c.eventList = list;
      const anim = animate && !SEEN.has(slug);
      SEEN.add(slug);
      c.animate = anim;
      VC.timeChart(box, c);
      setRO(null);
    };
    const choose = (x) => {
      if (x === p) return;
      p = x; st.p = p; saveST();
      el.querySelectorAll(".rng [data-p]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === p)));
      const rs = el.querySelector(".rng-sel"); if (rs) rs.value = p;
      fillInt(); draw(false);
    };
    el.querySelectorAll(".rng [data-p]").forEach((b) => b.addEventListener("click", () => choose(b.dataset.p)));
    const rs = el.querySelector(".rng-sel"); if (rs) rs.addEventListener("change", () => choose(rs.value));
    if (intSel) intSel.addEventListener("change", () => { g = intSel.value; st.g = g; saveST(); draw(false); });
    if (cmpBtn) cmpBtn.addEventListener("click", () => { cmp = !cmp; st.cmp = cmp; saveST(); draw(false); });
    if (logBtn) logBtn.addEventListener("click", () => { log = logBtn.getAttribute("aria-pressed") !== "true"; st.log = log; saveST(); draw(false); });
    fillInt();
    requestAnimationFrame(() => draw(ANIM));
    return el;
  }
  // month-series windows: "6M" = the last six months including the current one
  function monthsBack(p, ref) {
    if (p === "All") return "0000-00-00";
    if (p === "YTD") return ref.slice(0, 4) + "-01-01";
    return iso(d3.utcMonth.offset(parse(ref.slice(0, 7) + "-01"), -({ "6M": 6, "1Y": 12 }[p] - 1)));
  }
  const grid = (...figs) => { const g = h('<div class="grid"></div>'); figs.forEach((f) => f && g.appendChild(f)); return g; };
  // a tab's intro: the lede on the left and its numbers on the right in one row (≥ 1200px), stacked below that.
  // Overview (cls "ov") keeps its strip under the lede across the full width.
  const intro = (lede, facts, cls = "") => h(`<section class="intro${facts ? (cls ? "" : " side n" + facts.length) : " solo"} ${cls}"><div class="lede">${lede}</div>${facts ? `<dl class="facts">${facts.map(([l, v, sub]) => `<div><dt>${l}</dt><dd class="fv">${v}</dd><dd class="fs">${sub || ""}</dd></div>`).join("")}</dl>` : ""}</section>`);
  // a page is a run of sections: a small header (title + one line) over its cards; space between sections, not lines
  const band = (key, ...nodes) => {
    const t = key;
    const id = "s-" + t[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const s = h(`<section class="band" id="${id}" aria-labelledby="${id}-h"><header class="band-h"><h2 id="${id}-h">${t[0]}</h2>${t[1] ? `<p>${t[1]}</p>` : ""}</header></section>`);
    nodes.flat().forEach((n) => n && s.appendChild(n));
    return s;
  };
  // group a page's blocks (after its intro) into sections: [[key, number of blocks], …]. A section groups two or more
  // cards; a key of null leaves a single card standing alone, under its own title, with no section heading over it
  // the first section after a tab's intro carries no heading of its own (owner, round 8b: the intro is already text, and
  // a title + subtitle under it is empty space): its cards follow the intro directly. The heading moves into the card
  // as its title where the card has none (Method's first block); otherwise it goes, kept as the section's label
  const leadIn = (view) => {
    const first = view.querySelector(":scope > .intro + .band, :scope > .intro + .doc .doc-body > .band:first-child");
    const hd = first && first.querySelector(":scope > .band-h");
    if (!hd) return;
    first.classList.add("lead"); first.removeAttribute("aria-labelledby"); first.setAttribute("aria-label", hd.querySelector("h2").textContent);
    const card = first.querySelector(":scope > .card");
    if (card && !card.querySelector(".card-h")) {
      const p = hd.querySelector("p");
      card.insertBefore(h(`<div class="card-h"><div class="hi"><div class="t"><h3 id="${hd.querySelector("h2").id}">${hd.querySelector("h2").innerHTML}</h3>${p ? `<div class="sub">${p.innerHTML}</div>` : ""}</div></div></div>`), card.firstChild);
      card.classList.add("titled");
    }
    hd.remove();
  };
  const sections = (view, plan) => { const kids = [...view.children].slice(1); let i = 0; plan.forEach(([key, n]) => { const part = kids.slice(i, i + n); if (key) view.appendChild(band(key, part)); else part.forEach((k) => view.appendChild(k)); i += n; }); };
  const copyBtn = (text, label) => `<button type="button" class="copy" data-copy="${esc(text)}" aria-label="Copy ${esc(label)}" title="Copy">${ICON.copy}</button>`;
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copyText(b.dataset.copy, "Address copied"); });
  const contractLine = (keys) => `<div class="cline">${keys.filter((k) => META.contracts && META.contracts[k]).map((k) => `<span>${k} <a class="addr" href="https://arbiscan.io/address/${META.contracts[k]}" target="_blank" rel="noopener">${short(META.contracts[k])}</a>${copyBtn(META.contracts[k], k + " contract address")}</span>`).join("")}</div>`;

  /* =====================================================================
     SHELL: built once
     ===================================================================== */
  // header: one row of figures, a 12px label over a 16px value; the as-of lines at the right
  const cell = (l, v, cls = "") => `<div class="h-cell ${cls}"><span class="h-l">${l}</span><span class="h-v">${v}</span></div>`;
  const chg = ok(chg30) ? `<span class="h-chg ${chg30 > 0 ? "up" : chg30 < 0 ? "down" : ""}">${chg30 > 0 ? "↑" : chg30 < 0 ? "↓" : ""} ${pct(Math.abs(chg30), 1)}</span>` : "";
  $("#quote").innerHTML = `<div class="h-cells">${cell("sUSDai assets", usdM(K.vault_nav))}${cell("Holder yield, 30 days", pct(K.apy_30d, 1))}${cell("CHIP", chipP(K.chip_price))}${chg ? cell("30-day change", chg, "xl") : ""}${cell("CHIP FDV", F.usd(K.chip_fdv), "xl")}</div>`;
  $("#h-meta").innerHTML = `<span>Data through ${day(AS_OF)}</span><span>Vault read ${RPC.read_utc ? timeUTC(RPC.read_utc) + " UTC" : "–"}</span>`;
  const centreQuote = () => {
    const qt = $("#quote"), inner = $(".top-in"), cells = $(".h-cells");
    qt.style.paddingLeft = qt.style.paddingRight = "";
    if (window.innerWidth <= 900) return;
    const cs = getComputedStyle(inner), gap = parseFloat(cs.columnGap) || 0;
    const L = inner.getBoundingClientRect().left + parseFloat(cs.paddingLeft), R = inner.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    const meta = $("#h-meta"), right = Math.min($(".acts").getBoundingClientRect().left, meta.offsetParent ? meta.getBoundingClientRect().left : Infinity);
    const leftW = $(".brand").getBoundingClientRect().right - L, rightW = R - right, side = Math.max(leftW, rightW);
    if (R - L - 2 * side - 2 * gap < cells.scrollWidth) return;
    qt.style.paddingLeft = side - leftW + "px"; qt.style.paddingRight = side - rightW + "px";
  };
  new ResizeObserver(centreQuote).observe($(".top-in"));
  if (document.fonts) document.fonts.ready.then(centreQuote);
  const tabsEl = $("#tabs-in");
  TABS.forEach(([id, label]) => tabsEl.appendChild(h(`<a href="${urlFor(id)}" data-tab="${id}">${label}</a>`)));
  const ink = document.createElement("span"); ink.className = "ink"; tabsEl.appendChild(ink);
  tabsEl.addEventListener("scroll", () => tabsEl.classList.toggle("end", tabsEl.scrollLeft + tabsEl.clientWidth >= tabsEl.scrollWidth - 2), { passive: true });
  $("#foot").innerHTML = `<div class="foot-in"><span>Built by <a href="https://blockchain.berkeley.edu" target="_blank" rel="noopener">Blockchain at Berkeley</a>. Data from Arbitrum (event logs and live contract reads), DefiLlama and CoinGecko. Chain data through ${day(META.chain_through || AS_OF)}.</span><span>Not investment advice. The authors may hold CHIP, USDai or sUSDai.</span></div>`;
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-tab]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); go(a.dataset.tab, true);
  });
  $("#share").addEventListener("click", () => copyText(location.href));
  wireMenu($("#dl-menu"));
  const themeBtn = $("#theme-btn");
  const syncTheme = () => themeBtn.setAttribute("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));
  syncTheme();
  const applyTheme = (dark, save) => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    if (save) try { localStorage.setItem("usdai-theme", dark ? "dark" : "light"); } catch (e) {}
    syncTheme(); VC.redrawAll();
  };
  themeBtn.addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") !== "dark", true));
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => { let saved = null; try { saved = localStorage.getItem("usdai-theme"); } catch (x) {} if (!saved) applyTheme(e.matches, false); });
  // print: always light, drawn at the paper width
  let printDark = false;
  window.addEventListener("beforeprint", () => { printDark = document.documentElement.getAttribute("data-theme") === "dark"; if (printDark) document.documentElement.setAttribute("data-theme", "light"); VC.redrawAll(); });
  window.addEventListener("afterprint", () => { if (printDark) document.documentElement.setAttribute("data-theme", "dark"); VC.redrawAll(); });

  function moveInk(animate = true) {
    const a = tabsEl.querySelector("a[aria-current]");
    if (!a) return;
    ink.classList.toggle("still", !animate || REDUCE());
    ink.style.width = a.offsetWidth + "px";
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    const l = a.offsetLeft - 24, r = a.offsetLeft + a.offsetWidth + 24;
    if (l < tabsEl.scrollLeft || r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollTo({ left: l, behavior: animate && !REDUCE() ? "smooth" : "auto" });
  }
  new ResizeObserver(() => moveInk(false)).observe(tabsEl);
  const REDUCE = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function syncChrome() {
    document.querySelectorAll("#tabs a[data-tab]").forEach((a) => (a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    document.title = (tab === "overview" ? "" : TABS.find((t) => t[0] === tab)[1] + " · ") + "USD.AI and CHIP · Deep dive";
  }
  function build(anim) {
    const view = $("#view");
    VC.dispose(view);
    const full = document.querySelector(".fig.full"); if (full && full.__exitFull) full.__exitFull(true);
    ANIM = !!anim && !REDUCE();
    view.innerHTML = "";
    try { PAGES[tab](view); leadIn(view); requestAnimationFrame(() => requestAnimationFrame(markScroll)); } catch (e) { console.error(e); view.innerHTML = `<p class="nojs">This page could not load its data. <button class="tbtn" type="button" onclick="location.reload()">Reload</button></p>`; }
    ANIM = false;
  }
  // where the tab bar rests before it sticks: the bottom of the (non-sticky) top bar. Reading the sticky bar itself
  // returns its stuck position, which equals the current scroll.
  const tabsTop = () => Math.round($("#top").getBoundingClientRect().bottom + window.scrollY);
  // a table wider than its card scrolls sideways with an edge fade and a pinned first column
  const markScroll = () => document.querySelectorAll("#view .tw").forEach((w) => w.classList.toggle("scroll", w.scrollWidth > w.clientWidth + 1));
  new ResizeObserver(() => markScroll()).observe(document.body);
  function scrollToHash() {
    if (!hashSlug) return;
    const el = document.getElementById(hashSlug);
    if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 60);
  }

  // Changing page: the shell stays; the old page slides out a little toward the side it came from and the new one
  // slides in from the side of the tab picked. Charts draw in only the first time they are seen.
  let swapId = 0;
  const scrollMem = {};
  window.addEventListener("popstate", () => {
    if (ignorePop) { ignorePop = false; return; }
    const full = document.querySelector(".fig.full");
    if (full && full.__exitFull) { full.__exitFull(true); return; }
    const t = (new URLSearchParams(location.search).get("tab") || "overview").toLowerCase();
    if (TABS.some((x) => x[0] === t)) go(t, false, true);
  });
  function go(t, push, fromHistory) {
    if (t === tab) { if (window.scrollY > tabsTop()) window.scrollTo({ top: tabsTop(), behavior: REDUCE() ? "auto" : "smooth" }); return; }
    scrollMem[tab] = window.scrollY;
    const order = TABS.map((x) => x[0]);
    const dir = order.indexOf(t) > order.indexOf(tab) ? 1 : -1;
    tab = t;
    if (push) history.pushState(null, "", urlFor(t));
    syncChrome(); moveInk(true);
    const view = $("#view");
    const top = tabsTop();
    const target = fromHistory && scrollMem[t] != null ? scrollMem[t] : window.scrollY > top + 1 ? top : null;
    if (REDUCE()) { build(true); if (target != null) window.scrollTo({ top: target }); return; }
    const id = ++swapId;
    view.style.minHeight = view.offsetHeight + "px";
    view.style.setProperty("--dir", dir);
    view.classList.remove("in"); view.classList.add("out");
    setTimeout(() => {
      if (id !== swapId) return;
      build(true);
      if (target != null) window.scrollTo({ top: target, behavior: "instant" });
      view.classList.remove("out"); view.classList.add("in");
      void view.offsetWidth;
      view.classList.remove("in");
      setTimeout(() => { if (id === swapId) view.style.minHeight = ""; }, 260);
    }, 120);
  }

  /* =====================================================================
     PAGES
     ===================================================================== */
  /* =====================================================================
     PAGES
     ===================================================================== */
  const PAGES = {};
  const EV = V.events || [];
  const evs = (pred) => EV.filter(pred).map((e) => ({ d: e.d, label: e.label, text: e.src ? "Source: " + e.src : "" }));
  // monthly rows carry a first-of-month date for the chart; the current month is marked as in progress
  const MROWS = MON.map((m) => {
    const dim = new Date(Date.UTC(+m.m.slice(0, 4), +m.m.slice(5, 7), 0)).getUTCDate();
    const r = { ...m, d: m.m + "-01" };
    if (m.m === AS_OF.slice(0, 7) && m.days < dim) r._part = `${m.days} of ${dim} days`;
    return r;
  });
  const rowsWith = (k) => D.filter((r) => r[k] != null);
  const addrLink = (a, label) => `<a class="addr" href="https://arbiscan.io/address/${a}" target="_blank" rel="noopener">${label || short(a)}</a>`;
  const txt = (s) => `<p>${s}</p>`;
  const staticFig = (o) => fig({ ...o, menu: o.menu || [] });

  /* ---------- Overview ---------- */
  PAGES.overview = (view) => {
    const tiles = [
      ["In the vault", usdM(K.vault_nav), `sUSDai's assets, read from the contract on ${dayOf(RPC.read_utc || AS_OF)}`],
      ["Lent or in escrow", pct(lentShare), `${usdM(K.vault_loans)} in live loans and ${usdM(K.vault_escrow)} waiting on hardware`],
      ["Holder yield", pct(K.apy_30d, 1), "Last 30 days, from the sUSDai share price, after the 10% fee"],
    ];
    const kv = [
      ["CHIP price", "CoinGecko", chipP(K.chip_price), arrow(chg30)],
      ["CHIP market cap", "Price × circulating supply", F.usd(K.chip_mcap), ""],
      ["CHIP fully diluted", "Price × 10B CHIP", F.usd(K.chip_fdv), ""],
      ["Protocol fee, 30 days", "DefiLlama revenue: the 10% cut of yield", usdM(K.fee_last_month, 2), ""],
      ["Waiting to redeem", `Paid ${dayOf(K.next_redemption)}`, usdM(K.queue_pending_usd, 1), ""],
      ["Market rate on sUSDai", "Pendle PT, Feb 2027, fixed", pct(K.pt_apy, 1), ""],
    ];
    view.appendChild(h(`<section class="intro ov"><div class="ov-top">
      <div class="ov-lead"><div class="lede"><p class="thesis">${W.thesis()}</p><p class="thesis" style="margin-top:12px">${W.chipMove()} ${W.vsBuyback()}</p></div>
        <div class="tiles">${tiles.map(([l, v, d]) => `<div class="tile"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join("")}</div></div>
      <div class="ov-side"><div class="kvcard"><table class="kv"><tbody>${kv.map(([l, def, v, d]) => `<tr><td><span class="lab">${l}</span><span class="def">${def}</span></td><td class="v">${v}</td><td class="d">${d}</td></tr>`).join("")}</tbody></table>
        <p class="kv-note">CHIP change over 30 days. USDai, PYUSD and USDC are counted at $1.</p></div></div></div>
      <div class="reads">
      <div><h3>The loans are real and getting bigger</h3><p>${W.loansRead()}</p></div>
      <div><h3>Money leaves in monthly waves</h3><p>${W.exitRead()}</p></div>
      <div><h3>The buyback is small next to the unlock</h3><p>${W.chipRead()}</p></div></div></section>`));
    view.appendChild(band(["Where the money is", "sUSDai's assets split into what is lent and what is not, with the dates that moved them."], grid(assetsChart(true))));
    const box = h('<div class="diagram"></div>');
    const flowEl = staticFig({ slug: "flow", span: 12, title: "How a dollar moves through USD.AI", sub: "Figures are the latest on-chain reads; the 10% fee and the buyback route are the protocol's stated rules", body: box, src: "USD.AI docs; Arbitrum contract reads; DefiLlama" });
    view.appendChild(grid(flowEl));
    requestAnimationFrame(() => { drawFlow(box); VC.observe(box, () => drawFlow(box)); });
    view.appendChild(grid(signals()));
  };

  function assetsChart(withEvents) {
    const rows = D.filter((r) => r.susdai_assets != null && r.lent != null).map((r) => ({ ...r, unlent: Math.max(0, r.susdai_assets - r.lent) }));
    const mar = rows.find((r) => r.d >= "2026-03-01") || {};
    return chartFig({ slug: "assets", span: 12, events: withEvents, title: `${pct(lentShare)} of sUSDai is lent, up from ${pct(mar.lent / mar.susdai_assets)} at the start of March`,
      sub: "sUSDai assets per day: loans and escrow (DefiLlama's borrowed) and the rest, mostly USDai cash", basis: "mixed", src: "Assets: sUSDai deposits and redemptions on Arbitrum × deposit share price; lent: DefiLlama usd-ai borrowed",
      csvCols: ["susdai_assets", "lent", "unlent", "share_price"],
      time: { rows, key: "d", def: "All", agg: { susdai_assets: "last", lent: "last", unlent: "last" } } },
      (r) => ({ data: r, height: 320, series: [
        { key: "lent", label: "Lent or in escrow", color: "--c-diem", type: "area", stack: "a", fmt: F.usd },
        { key: "unlent", label: "Not lent", color: "--c-float", type: "area", stack: "a", fmt: F.usd },
      ], total: "sUSDai assets", yFormat: F.usd, yMin: 0, events: withEvents ? evs(() => true) : undefined }));
  }

  /* ---------- flow diagram ----------
     Boxes and arrows on a fixed 1000-wide canvas, scaled to the card; under 640px it stacks into one column. */
  function drawFlow(el) {
    const W0 = el.clientWidth || 900, narrow = W0 < 640;
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const nodes = [
      { id: "dep", t: "Depositors", s: "PYUSD in", x: 0, y: 0 },
      { id: "usdai", t: "USDai", s: `${usdM(RPC.usdai_supply_arbitrum)} issued, backed 1:1 by PYUSD`, x: 1, y: 0 },
      { id: "vault", t: "sUSDai vault", s: `${usdM(K.vault_nav)}; holders earn ${pct(K.apy_30d, 1)}`, x: 2, y: 0 },
      { id: "loans", t: "GPU loans", s: `${usdM(K.vault_loans)} live, ${usdM(K.vault_escrow)} in escrow`, x: 3, y: 0 },
      { id: "pyusd", t: "PYUSD reserve yield", s: "PayPal's 4.5% incentive on idle PYUSD", x: 1, y: 1 },
      { id: "fee", t: "10% protocol fee", s: `${usdM(K.fee_last_month, 2)} in the last 30 days`, x: 2, y: 1 },
      { id: "chip", t: "CHIP buybacks", s: "Proposed: all of the fee, after Foundation costs", x: 3, y: 1 },
    ];
    const edges = [["dep", "usdai", "mint"], ["usdai", "vault", "stake"], ["vault", "loans", "lend"], ["loans", "vault", "interest + principal"], ["pyusd", "vault", "base yield"], ["vault", "fee", "10% of yield"], ["fee", "chip", "buy CHIP"]];
    const cols = narrow ? 1 : 4, bw = narrow ? W0 - 24 : 200, bh = 66, gx = narrow ? 0 : (W0 - 4 * bw) / 3, gy = 64;
    const pos = (n) => (narrow ? { x: 12, y: nodes.indexOf(n) * (bh + 34) + 8 } : { x: n.x * (bw + gx), y: n.y * (bh + gy) + 8 });
    const H = narrow ? nodes.length * (bh + 34) : 2 * bh + gy + 24;
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W0} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", "Flow of money through USD.AI");
    const defs = svg.append("defs");
    defs.append("marker").attr("id", "arr").attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse").append("path").attr("d", "M0,0L10,5L0,10z").attr("fill", css("--muted"));
    const P = Object.fromEntries(nodes.map((n) => [n.id, pos(n)]));
    if (!narrow) edges.forEach(([a, b, lab], i) => {
      const A = P[a], B = P[b];
      let x1, y1, x2, y2;
      if (A.y === B.y) { const back = B.x < A.x; x1 = back ? A.x : A.x + bw; x2 = back ? B.x + bw : B.x; y1 = y2 = A.y + bh / 2 + (a === "loans" ? 14 : b === "loans" ? -14 : 0); if (a === "loans") { x1 = A.x; x2 = B.x + bw; } }
      else if (A.x === B.x) { x1 = x2 = A.x + bw / 2 + (A.y > B.y ? -30 : 30); y1 = A.y > B.y ? A.y : A.y + bh; y2 = A.y > B.y ? B.y + bh : B.y; }
      else { x1 = A.x + bw; y1 = A.y + bh / 2; x2 = B.x + 20; y2 = B.y + bh; }
      svg.append("path").attr("d", `M${x1},${y1}L${x2},${y2}`).attr("stroke", css("--line-strong")).attr("stroke-width", 1.5).attr("fill", "none").attr("marker-end", "url(#arr)");
      svg.append("text").attr("x", (x1 + x2) / 2 + (A.x === B.x ? 6 : 0)).attr("y", (y1 + y2) / 2 - 5).attr("text-anchor", A.x === B.x ? "start" : "middle").style("font", "500 11px var(--sans)").style("fill", css("--muted")).text(lab);
    });
    nodes.forEach((n) => {
      const p = P[n.id];
      const g = svg.append("g").attr("transform", `translate(${p.x},${p.y})`);
      const hl = n.id === "chip" || n.id === "fee";
      g.append("rect").attr("width", bw).attr("height", bh).attr("rx", 4).attr("fill", css("--card")).attr("stroke", hl ? css("--primary") : css("--line-strong"));
      g.append("text").attr("x", 12).attr("y", 24).style("font", "600 14px var(--sans)").style("fill", css("--fg")).text(n.t);
      const words = n.s.split(" "), lines = [""];
      words.forEach((w) => { if ((lines[lines.length - 1] + " " + w).length > (narrow ? 60 : 30)) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + " " + w).trim(); });
      lines.slice(0, 2).forEach((l, i) => g.append("text").attr("x", 12).attr("y", 42 + i * 15).style("font", "400 12px var(--sans)").style("fill", css("--muted")).text(l));
      if (narrow && nodes.indexOf(n) < nodes.length - 1) svg.append("path").attr("d", `M${p.x + 24},${p.y + bh}L${p.x + 24},${p.y + bh + 30}`).attr("stroke", css("--line-strong")).attr("marker-end", "url(#arr)");
    });
  }

  /* ---------- signals: what to watch, each with its trend ---------- */
  function signals() {
    const last = (k, n) => D.slice(-n).map((r) => r[k]);
    const g30 = (k) => { const a = D.filter((r) => r[k] != null); if (a.length < 31) return null; return a[a.length - 1][k] / a[a.length - 31][k] - 1; };
    const sig = [
      { tab: "vault", name: "sUSDai assets", why: "Deposits are the fuel for new loans", now: usdM(K.vault_nav), spark: last("susdai_assets", 90), lean: g30("susdai_assets") < -0.05 ? ["Shrinking", "down"] : g30("susdai_assets") > 0.05 ? ["Growing", "up"] : ["Flat", "muted"] },
      { tab: "loans", name: "Share lent", why: "Idle cash dilutes the yield; too little cash slows exits", now: pct(lentShare), spark: last("lent_share", 90), lean: lentShare > 0.85 ? ["Near the 90% cap", "down"] : lentShare > 0.5 ? ["Mostly lent", "up"] : ["Mostly idle", "muted"] },
      { tab: "yield", name: "Holder yield, 30 days", why: "Above the 7% hurdle, no top-up is needed", now: pct(K.apy_30d, 1), spark: last("apy_30d", 90), lean: K.apy_30d >= 0.07 ? ["At or above 7%", "up"] : ["Below the hurdle", "down"] },
      { tab: "yield", name: "Pendle fixed rate", why: "What the market will lock in for sUSDai to Feb 2027", now: pct(K.pt_apy, 1), spark: last("pt_apy", 90), lean: K.pt_apy > K.apy_30d + 0.01 ? ["Priced above the vault", "muted"] : ["In line with the vault", "muted"] },
      { tab: "redemptions", name: "Waiting to redeem", why: `Requests to be paid on ${dayOf(K.next_redemption)}`, now: usdM(K.queue_pending_usd, 1), lean: K.queue_pending_usd > 0.1 * K.vault_nav ? ["Large", "down"] : ["Small", "up"] },
      { tab: "chip", name: "CHIP price", why: "Buybacks started on October 28", now: chipP(K.chip_price), spark: last("chip_price", 90), lean: chg30 < -0.2 ? ["Falling", "down"] : chg30 > 0.2 ? ["Rising", "up"] : ["Flat", "muted"] },
    ];
    const tb = h(`<div class="tw"><table class="t sig"><thead><tr><th>Signal</th><th class="r">Now</th><th class="hide-sm">Last 90 days</th><th>Reads as</th></tr></thead><tbody></tbody></table></div>`);
    sig.forEach((g) => {
      const tr = h(`<table><tr><td><a class="sig-a" href="${urlFor(g.tab)}" data-tab="${g.tab}">${esc(g.name)}</a><div style="color:var(--muted);font-size:13px;margin-top:2px">${esc(g.why)}</div></td><td class="r" style="white-space:nowrap">${g.now}</td><td class="hide-sm">${g.spark ? `<div style="width:120px;height:26px" class="sp"></div>` : ""}</td><td class="${g.lean[1]}" style="white-space:nowrap">${g.lean[0]}</td></tr></table>`).querySelector("tr");
      tb.querySelector("tbody").appendChild(tr);
      if (g.spark && g.spark.filter((v) => v != null).length > 2) requestAnimationFrame(() => VC.spark(tr.querySelector(".sp"), g.spark, { color: "--c-lead" }));
    });
    return staticFig({ slug: "signals", span: 12, title: "What to watch", sub: "Each line links to the tab with its chart", src: "Arbitrum, DefiLlama, CoinGecko. Our reading of each trend, not a forecast", body: tb });
  }

  /* ---------- Vault: USDai and sUSDai ---------- */
  PAGES.vault = (view) => {
    const bridged = K.vault_bridged_share;
    const usdaiInVault = ok(RPC.usdai_supply_arbitrum) && ok(K.vault_cash) ? K.vault_cash / RPC.usdai_supply_arbitrum : null;
    view.appendChild(intro(txt(`Depositors swap PYUSD for USDai one to one, then stake it as sUSDai to earn the loan yield. Almost nobody holds plain USDai: ${pct(usdaiInVault)} of the ${usdM(RPC.usdai_supply_arbitrum)} in existence sits inside the sUSDai vault as cash. One sUSDai is worth ${(K.share_price || 0).toFixed(4)} USDai today, and ${pct(bridged)} of all sUSDai shares live on other chains (Ethereum, Base, Plasma, Solana), bridged out from Arbitrum.`),
      [["sUSDai assets", usdM(K.vault_nav), "Contract read"], ["sUSDai shares", (K.vault_shares / 1e6).toFixed(1) + "M", `${pct(bridged)} on other chains`], ["USDai issued", usdM(RPC.usdai_supply_arbitrum), `${pct(usdaiInVault)} inside sUSDai`]]));
    const parts = [
      { label: "Live loans", value: K.vault_loans || 0, color: "--c-diem", note: "Principal outstanding on loans the vault holds (loanRouterBalances)" },
      { label: "Escrow, hardware not live", value: K.vault_escrow || 0, color: "--c-staked", note: "Funded loans waiting on delivery and installation (depositTimelockBalance)" },
      { label: "Cash", value: K.vault_cash || 0, color: "--c-float", note: "USDai held by the vault, available for redemptions and new loans" },
    ];
    const sb = h('<div style="padding:8px 0 4px"></div>');
    const comp = staticFig({ slug: "composition", span: 12, title: `Cash is ${pct((K.vault_cash || 0) / K.vault_nav)} of the vault after the November payout`, sub: `sUSDai's assets by kind, read from the contract on ${dayOf(RPC.read_utc)}`, basis: "onchain", conf: "high", src: "sUSDai view functions on Arbitrum: balances, loanRouterBalances, depositTimelockBalance", body: sb });
    requestAnimationFrame(() => VC.stackBar(sb, { parts, fmt: F.usd }));
    view.appendChild(grid(comp));
    view.appendChild(band(["Deposits and exits", "Money in each month against money paid out to redeemers."], grid(flowsChart(), depositorsChart()), grid(assetsChart(false))));
  };
  function flowsChart() {
    const rows = MROWS.map((m) => ({ ...m, neg_red: m.redeemed ? -m.redeemed : 0, net: (m.deposits || 0) - (m.redeemed || 0) }));
    const mar = MROWS.find((m) => m.m === "2026-03") || {};
    return chartFig({ slug: "flows", span: 8, title: `${monthOf(bigPay[0] && bigPay[0].d)} and ${monthOf(bigPay[1] && bigPay[1].d)} were the two big exits`, sub: "USDai deposited into sUSDai and USDai paid to redeemers, per month", basis: "onchain", conf: "high", src: "sUSDai Deposit and RedemptionsServiced events",
      csvCols: ["deposits", "redeemed", "net"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "deposits", label: "Deposited", color: "--c-buy", type: "bar", fmt: F.usd },
        { key: "neg_red", label: "Paid to redeemers", color: "--c-sell", type: "bar", fmt: (v) => F.usd(Math.abs(v)) },
        { key: "net", label: "Net", color: "--c-total", type: "line", fmt: F.usd },
      ], yFormat: F.usd, partLabel: "In progress" }));
  }
  function depositorsChart() {
    return chartFig({ slug: "depositors", span: 4, title: "Fewer wallets deposit directly on Arbitrum", sub: "Distinct wallets depositing into sUSDai per month. Deposits from other chains arrive through one bridge contract, so they count once", basis: "onchain", conf: "high", src: "sUSDai Deposit events, owner field",
      csvCols: ["depositors"], time: { rows: MROWS, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [{ key: "depositors", label: "Depositing wallets", color: "--c-lead", type: "bar", fmt: F.int }], yFormat: F.num, partLabel: "In progress" }));
  }

  /* ---------- Loans ---------- */
  PAGES.loans = (view) => {
    const active = LOANS.filter((l) => l.status === "active");
    view.appendChild(intro(txt(`Each loan finances one GPU deployment owned by a borrower's single-purpose company, with the servers as collateral and no claim on the borrower beyond them. Money goes out in two steps: first into escrow while hardware ships (earning 6 to 8%), then into the live loan, which amortizes over three years with monthly payments. ${W.loansRead()} Since October USD.AI also sells seasoned loans to institutions through its GPU Loan Exchange (GLX), which is how the vault got ${usdM((MROWS.find((m) => m.m === "2026-10") || {}).loan_principal_back)} of principal back in October.`),
      [["Loans on-chain", K.loans_total, `${K.borrowers} borrower addresses`], ["Lent since Dec 2025", usdM(K.originated_usd), "Live-loan principal at origination"], ["In escrow now", usdM(K.vault_escrow), "Hardware not yet live"]]));
    view.appendChild(grid(origChart(), cashBackChart()));
    view.appendChild(band(["Every loan", "From the two Loan Router contracts. Borrowers appear as addresses; USD.AI names some of them in its announcements."], grid(loanTable()), grid(escrowTable())));
  };
  function origChart() {
    return chartFig({ slug: "originations", span: 6, title: "Loans now come less often but in larger sizes", sub: "Principal of new live loans per month; escrow funding is shown separately", basis: "onchain", conf: "high", src: "LoanOriginated on Loan Router v1 and v2; LoanEscrowTimelockDeposited on sUSDai",
      csvCols: ["originated", "originated_n", "escrow_funded"], time: { rows: MROWS.filter((m) => m.m >= "2025-11"), key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "originated", label: "New live loans", color: "--c-diem", type: "bar", stack: "a", fmt: F.usd },
        { key: "escrow_funded", label: "Paid into escrow", color: "--c-staked", type: "bar", stack: "a", fmt: F.usd },
      ], yFormat: F.usd, partLabel: "In progress", tipNote: (x) => (x.originated_n ? `${x.originated_n} new loan${x.originated_n > 1 ? "s" : ""}` : "") }));
  }
  function cashBackChart() {
    const rows = MROWS.filter((m) => m.m >= "2025-11");
    const oct = MROWS.find((m) => m.m === "2026-10") || {};
    return chartFig({ slug: "cash-back", span: 6, title: `Borrowers paid the vault ${usdM(d3.sum(rows, (m) => m.loan_interest || 0), 1)} of interest so far`, sub: "Interest the sUSDai vault received from borrowers per month; principal returned is in the tooltip", basis: "onchain", conf: "high", src: "LenderRepaid events where the lender is the sUSDai vault, both routers. October's principal includes the $87M Duos Edge AI loan sold through GLX",
      csvCols: ["loan_interest", "loan_principal_back"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "loan_interest", label: "Interest", color: "--c-burn", type: "bar", fmt: F.usd },
      ], yFormat: F.usd, partLabel: "In progress", tipNote: (x) => (x.loan_principal_back ? `Principal back: ${F.usd(x.loan_principal_back)}` : "") }));
  }
  function loanTable() {
    const ST_TXT = { active: "Live", repaid: "Repaid", "moved to v2": "Live", refinanced: "Refinanced", breached: "Breach flagged", liquidated: "Liquidated" };
    // identical loans opened together (same day, borrower and size) share one row: "15 × $29.5K"
    const rows = d3.groups(LOANS.filter((l) => l.start), (l) => [l.start, l.borrower, Math.round(l.principal), l.status].join("|"))
      .map(([, ls]) => ({ ...ls[0], n: ls.length, interest_paid: d3.sum(ls, (l) => l.interest_paid) })).reverse();
    const body = rows.map((l) => `<tr><td>${day(l.start)}</td><td>${addrLink(l.borrower)}</td><td class="r">${l.n > 1 ? `${l.n} × ` : ""}${F.usd(l.principal)}</td><td class="r hide-sm">${l.rate ? pct(l.rate, 1) : "–"}</td><td class="r hide-sm">${l.term_days ? Math.round(l.term_days / 365) + " yr" : "–"}</td><td class="r hide-sm">${F.usd(l.interest_paid)}</td><td>${ST_TXT[l.status] || l.status}${l.router ? ` <span class="muted">${l.router}</span>` : ""}</td></tr>`).join("");
    return staticFig({ slug: "loan-list", span: 12, title: `${K.loans_total} loans, ${K.borrowers} borrowers`, sub: "Rate is the vault's tranche rate, written into router v2 loans only. Loans moved from v1 to v2 (v1→v2) carry their payments under both ids, added together here; a loan refinanced after the move may show less", basis: "onchain", conf: "high", src: "Loan Router v1 0x0C2E…97D1 and v2 0x1c2e…e12f on Arbitrum",
      menu: [{ icon: "dl", label: "Download CSV", run: () => VC.download(`usdai_loans_${AS_OF}.csv`, VC.toCSV(csvRows(LOANS.map((l) => ({ start: l.start, borrower: l.borrower, principal: l.principal, rate: l.rate, term_days: l.term_days, status: l.status, router: l.router, interest_paid: l.interest_paid, hash: l.hash }))))) }],
      body: `<div class="tw"><table class="t"><thead><tr><th>Start</th><th>Borrower</th><th class="r">Principal</th><th class="r hide-sm">Rate</th><th class="r hide-sm">Term</th><th class="r hide-sm">Interest paid</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function escrowTable() {
    const ST_TXT = { withdrawn: "Released into a live loan", cancelled: "Cancelled, cash returned", open: "Still in escrow" };
    const body = (V.escrows || []).slice().reverse().map((e) => `<tr><td>${day(e.d)}</td><td class="r">${F.usd(e.usd)}</td><td class="r">${pct(e.rate, 1)}</td><td>${ST_TXT[e.status] || e.status}${e.end ? ` <span class="muted">${dayOf(e.end)}</span>` : ""}</td></tr>`).join("");
    return staticFig({ slug: "escrow", span: 12, title: "Escrow: money set aside while servers are installed", sub: "Each row is one facility paid into escrow by the vault. The escrow rate is what the vault earns until the loan goes live", basis: "onchain", conf: "high", src: "LoanEscrowTimelock events on sUSDai; the $128.9M facility shows in the vault's deposit timelock balance",
      body: `<div class="tw"><table class="t"><thead><tr><th>Funded</th><th class="r">Amount</th><th class="r">Escrow rate</th><th>Outcome</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }

  /* ---------- Yield ---------- */
  PAGES.yield = (view) => {
    const p0 = (D.find((r) => r.share_price != null) || {});
    view.appendChild(intro(txt(`sUSDai does not pay out. Its share price rises as borrowers pay and as idle PYUSD earns PayPal's incentive, after a 10% protocol fee. It has gone from ${(p0.share_price || 1).toFixed(4)} on ${day(p0.d)} to ${(K.share_price || 0).toFixed(4)}. Since mid-October the CHIP Foundation tops the vault up to 7% a year when a month falls short; it paid ${usdM(K.donation, 2)} for the first period, ending November 1.`),
      [["Last 30 days", pct(K.apy_30d, 1), "From the share price"], ["DefiLlama APY", pct(K.apy_llama, 1), "Their sUSDai pool"], ["Pendle fixed rate", pct(K.pt_apy, 1), "PT-sUSDai, Feb 2027"]]));
    view.appendChild(grid(yieldChart()));
    view.appendChild(band(["Where the yield comes from", "Cash the vault booked each month, by source. Until February 2026 the share price rose ahead of the cash: six months of PYUSD yield arrived in one $7.8M batch on February 2."], grid(incomeChart(), priceChart())));
  };
  function yieldChart() {
    const rows = D.filter((r) => r.apy_30d != null);
    return chartFig({ slug: "yield", span: 12, events: true, title: K.pt_apy > K.apy_30d ? `The market prices sUSDai above its own trailing yield` : "Trailing yield against the market's fixed rate", sub: "30-day yield from the sUSDai share price, DefiLlama's APY, and Pendle's fixed rate for PT-sUSDai (Feb 2027)", basis: "mixed", src: "Share price from sUSDai deposits on Arbitrum; DefiLlama yields; Pendle via DefiLlama",
      csvCols: ["apy_30d", "apy_llama", "pt_apy", "share_price"], time: { rows, key: "d", def: "1Y", agg: { apy_30d: "mean", apy_llama: "mean", pt_apy: "mean" } } },
      (r) => ({ data: r, height: 300, yMin: 0, series: [
        { key: "apy_30d", label: "sUSDai, trailing 30 days", color: "--c-lead", type: "line", fmt: (v) => pct(v, 2), width: 1.75 },
        { key: "apy_llama", label: "DefiLlama APY", color: "--c-cmp", type: "line", fmt: (v) => pct(v, 2) },
        { key: "pt_apy", label: "Pendle fixed rate", color: "--c-burn", type: "line", fmt: (v) => pct(v, 2), dash: true },
      ], yFormat: F.pct0, refLines: [{ value: 0.07, label: "7% hurdle rate", color: "--muted", inDomain: true }],
        events: evs((e) => ["2026-04-30", "2026-10-01", "2026-11-01"].includes(e.d)) }));
  }
  function incomeChart() {
    const rows = MROWS.filter((m) => m.m >= "2025-07");
    return chartFig({ slug: "income", span: 8, title: `Loan interest was ${pct(((MROWS.find((m) => m.m === K.month_last_full) || {}).loan_share), 0)} of the vault's income in ${monthOf(K.month_last_full)}`, sub: "Cash booked by sUSDai per month, after the 10% fee. October's loan interest includes $1.6M collected when the Duos Edge AI loan was sold", basis: "onchain", conf: "high", src: "LenderRepaid (vault), BaseYieldDeposited, LoanEscrowTimelock interest, Donated, all on sUSDai and the Loan Routers",
      csvCols: ["loan_interest", "base_yield", "escrow_interest", "donation", "fee_base"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 280, series: [
        { key: "loan_interest", label: "Loan interest", color: "--c-burn", type: "bar", stack: "a", fmt: F.usd },
        { key: "escrow_interest", label: "Escrow interest", color: "--c-buyback", type: "bar", stack: "a", fmt: F.usd },
        { key: "base_yield", label: "PYUSD reserve yield", color: "--c-tier2", type: "bar", stack: "a", fmt: F.usd },
        { key: "donation", label: "Foundation top-up", color: "--primary", type: "bar", stack: "a", fmt: F.usd },
      ], total: "Booked", yFormat: F.usd, partLabel: "In progress" }));
  }
  function priceChart() {
    const rows = rowsWith("share_price");
    return chartFig({ slug: "share-price", span: 4, title: "One sUSDai, in USDai", sub: "Deposit share price, last deposit of each day", basis: "onchain", conf: "high", src: "sUSDai Deposit events: assets ÷ shares",
      csvCols: ["share_price"], time: { rows, key: "d", def: "All", agg: { share_price: "last" } } },
      (r) => ({ data: r, height: 280, yMin: "auto", series: [{ key: "share_price", label: "Share price", color: "--c-lead", type: "line", fmt: (v) => v.toFixed(4) }], yFormat: (v) => v.toFixed(2) }));
  }

  /* ---------- Redemptions ---------- */
  PAGES.redemptions = (view) => {
    view.appendChild(intro(txt(`Leaving sUSDai takes up to a month. A holder files a request at any time; on the monthly payment date the vault pays everyone in the queue, oldest first, from cash it has on hand. It does not call in or sell loans to do it. Big holders tend to file in the last days before the date, so the money-weighted wait is short even though the rule allows 30 days. ${W.exitRead()}`),
      [["Paid on " + dayOf(LP.d), usdM(LP.usd), `${LP.wallets} wallets`], ["Top 10 wallets", pct(LP.top10), "Share of that payout"], ["Queued for " + dayOf(K.next_redemption), usdM(K.queue_pending_usd, 1), "Requests waiting now"]]));
    view.appendChild(grid(payoutTable(), topRedeemers()));
  };
  function payoutTable() {
    const body = PAY.slice().reverse().map((p) => `<tr><td>${day(p.d)}</td><td class="r">${F.usd(p.usd)}</td><td class="r">${p.wallets}</td><td class="r">${pct(p.top10)}</td><td class="r hide-sm">${ok(p.wait_avg_days) ? p.wait_avg_days.toFixed(0) + " days" : "–"}</td></tr>`).join("");
    return staticFig({ slug: "payouts", span: 7, title: "Every monthly payout", sub: "Money-weighted wait runs from each request to its payment", basis: "onchain", conf: "high", src: "RedeemRequest and RedemptionProcessed events on sUSDai, matched by request id",
      menu: [{ icon: "dl", label: "Download CSV", run: () => VC.download(`usdai_payouts_${AS_OF}.csv`, VC.toCSV(csvRows(PAY.map((p) => ({ date: p.d, paid_usd: p.usd, wallets: p.wallets, top1: p.top1, top5: p.top5, top10: p.top10, wait_avg_days: p.wait_avg_days }))))) }],
      body: `<div class="tw"><table class="t"><thead><tr><th>Paid</th><th class="r">Amount</th><th class="r">Wallets</th><th class="r">Top 10 share</th><th class="r hide-sm">Average wait</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function topRedeemers() {
    const box = h("<div></div>");
    const el = staticFig({ slug: "top-redeemers", span: 5, title: `The ten largest exits on ${dayOf(LP.d)}`, sub: "USDai paid to each wallet in that payout", basis: "onchain", conf: "high", src: "RedemptionProcessed events, controller address", body: box });
    requestAnimationFrame(() => VC.hbars(box, { rows: (LP.largest || []).map((x) => ({ label: short(x.addr), value: x.usd, color: "--c-sell" })), fmt: F.usd, labelW: 110 }));
    return el;
  }

  /* ---------- CHIP ---------- */
  PAGES.chip = (view) => {
    view.appendChild(intro(txt(`CHIP votes on loan limits, eligible hardware and how the protocol's money is used. Its own terms say it gives no right to protocol revenue. On October 28 USD.AI Inc. bought 22.3M CHIP for $1M at $0.0448 and proposed sending all of sUSDai's 10% fee, after Foundation costs, to CHIP purchases from then on. ${W.chipMove()} Staking (sCHIP) exists but has no protocol use yet: ${(K.schip_staked_now / 1e6).toFixed(0)}M CHIP is staked, ${pct(K.schip_staked_now / 1e10, 2)} of supply.`),
      [["Price", chipP(K.chip_price), ok(chg30) ? `${chg30 < 0 ? "Down" : "Up"} ${pct(Math.abs(chg30))} in 30 days` : ""], ["Circulating", ((K.chip_circ || 0) / 1e9).toFixed(2) + "B", `of ${((K.chip_max || 1e10) / 1e9).toFixed(0)}B CHIP`], ["All-time high", chipP(K.chip_ath), dayOf(K.chip_ath_date)]]));
    view.appendChild(grid(chipChart()));
    view.appendChild(band(["Buybacks against unlocks", "What the fee can buy, set against the tokens that start unlocking in April 2027."], grid(unlockChart(), buybackFacts()), grid(calcBuyback())));
  };
  function chipChart() {
    const rows = rowsWith("chip_price");
    return chartFig({ slug: "chip-price", span: 12, events: true, readout: "chip_price", readoutFmt: (v) => chipP(v), returns: "chip_price", compare: true, title: `CHIP is ${pct(K.chip_price / K.chip_ath)} of its April high`, sub: "Daily price in USD", basis: "thirdparty", src: "CoinGecko (chip-2); BTC from CoinGecko",
      csvCols: ["chip_price", "chip_mcap", "chip_vol", "btc_price"], time: { rows, key: "d", def: "All", agg: { chip_price: "last", chip_mcap: "last", chip_vol: "sum", btc_price: "last" } } },
      (r, g, ctx) => {
        const events = evs((e) => e.d >= "2026-04-21" && ["2026-04-30", "2026-10-19", "2026-10-28", "2026-11-01"].includes(e.d));
        if (ctx.cmp) {
          const p0 = (r.find((x) => x.chip_price != null) || {}).chip_price, b0 = (r.find((x) => x.btc_price != null) || {}).btc_price;
          const ix = r.map((x) => ({ ...x, c_ix: x.chip_price != null ? (x.chip_price / p0) * 100 : null, b_ix: x.btc_price != null && b0 ? (x.btc_price / b0) * 100 : null }));
          const f = (v) => (v == null ? "–" : (v >= 100 ? "+" : MINUS) + Math.abs(v - 100).toFixed(1) + "%");
          return { data: ix, height: 320, yMin: "auto", series: [{ key: "c_ix", label: "CHIP", color: "--c-lead", type: "line", fmt: f, width: 1.75 }, { key: "b_ix", label: "BTC", color: "--c-cmp", type: "line", fmt: f }], yFormat: (v) => v.toFixed(0), events, refLines: [{ value: 100, label: "Start of range = 100", color: "--muted", inDomain: true }] };
        }
        return { data: r, height: 320, endLabel: true, yMin: "auto", series: [
          { key: "chip_price", label: "CHIP", color: "--c-lead", type: "line", fmt: (v) => chipP(v), width: 1.75 },
          { key: "chip_mcap", label: "Market cap", color: "--c-lead", type: "line", noLine: true, noLegend: true, fmt: F.usd },
          { key: "chip_vol", label: "Volume", color: "--c-lead", type: "line", noLine: true, noLegend: true, fmt: F.usd },
        ], yFormat: (v) => "$" + (v < 0.1 ? v.toFixed(2) : v.toFixed(2)), events, refLines: [{ value: 0.044756, label: "Oct 28 buyback price", color: "--primary", inDomain: false }] };
      });
  }
  function unlockChart() {
    const rows = (V.unlocks || []).map((u) => ({ ...u, d: u.m + "-01", unlock_usd: u.unlock * (K.chip_price || 0), buy_usd: K.fee_last_month }));
    return chartFig({ slug: "unlocks", span: 8, title: `${(K.unlock_cliff_chip / 1e9).toFixed(2)}B CHIP unlock in ${monthOf(K.unlock_date)}, then ${(K.unlock_monthly_chip / 1e6).toFixed(0)}M a month`, sub: "Investor and contributor CHIP unlocking per month at today's price, against a month of the 10% fee", basis: "modeled", src: "Schedule: 12-month cliff from the April 30, 2026 launch, 33% then 24 monthly steps (USD.AI docs); shares: investors 29.6%, contributors 23.5% (Messari). Fee: DefiLlama, last 30 days. Reserve and ecosystem tokens not included",
      csvCols: ["unlock", "unlock_usd", "buy_usd", "supply"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 280, logY: false, series: [
        { key: "unlock_usd", label: "Unlocking, at today's price", color: "--c-sell", type: "bar", fmt: F.usd },
        { key: "buy_usd", label: "A month of the fee", color: "--c-buy", type: "line", fmt: F.usd, width: 2 },
      ], yFormat: F.usd, tipNote: (x) => (x.unlock ? `${C(x.unlock)} CHIP` : "") }));
  }
  function buybackFacts() {
    const rows = [
      ["Fee, last 30 days", usdM(K.fee_last_month, 2), "DefiLlama revenue, which is the 10% cut"],
      ["Fee, last 12 months", usdM(K.fee_12m, 1), "Same source"],
      ["As a share of market cap", pct(K.buyback_yield_on_mcap, 1), "Fee × 12 ÷ market cap"],
      ["Each later monthly unlock", usdM(K.unlock_monthly_usd, 1), `${(K.unlock_monthly_chip / 1e6).toFixed(0)}M CHIP at today's price`],
      ["Fee covers of that", pct(K.buyback_share_of_monthly_unlock), "Months after the cliff"],
      ["The October 28 buyback", "$1.0M", "22.3M CHIP at $0.0448, paid by USD.AI Inc."],
    ];
    return staticFig({ slug: "buyback-facts", span: 4, title: "The buyback in numbers", sub: "At today's CHIP price", basis: "mixed", src: "DefiLlama; CoinGecko; usd.ai October recap",
      body: `<table class="kv" style="margin:4px 0"><tbody>${rows.map(([l, v, d]) => `<tr><td><span class="lab">${l}</span><span class="def">${d}</span></td><td class="v">${v}</td></tr>`).join("")}</tbody></table>` });
  }
  const setFill = (inp) => inp.style.setProperty("--fill", ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + "%");
  // What would it take for the fee to absorb the unlocks? Deposits and gross yield set the fee; the fee buys CHIP at the
  // chosen price; the answer is the share of each monthly unlock it absorbs and the years to absorb the cliff.
  function calcBuyback() {
    const st = (ST["calc-buyback"] = ST["calc-buyback"] || {});
    // "Today" reproduces the last 30 days: today's deposits, and the gross yield that gives the measured fee
    const dep0 = Math.round((K.vault_nav || 4e8) / 1e7) * 10, gy0 = ok(K.fee_last_month) && K.vault_nav ? Math.round(((K.fee_last_month * 12) / (K.vault_nav * 0.1)) * 1000) / 10 : 8, p0 = Math.round((K.chip_price || 0.03) * 1000) / 1000;
    const el = staticFig({ slug: "calc-buyback", span: 12, title: "How big must USD.AI get for buybacks to matter?", sub: "Set deposits, the gross yield and the CHIP price; the fee is 10% of gross yield, all of it spent on CHIP", basis: "modeled", src: "Model on this page's figures; the full fee going to buybacks is a proposal, not yet a governance decision",
      body: `<div class="calc"><div class="ctrl">
        <label><span class="lv">sUSDai deposits <b data-o="c1"></b></span><input data-i="c1" type="range" min="100" max="5000" step="10" value="${st.c1 ?? dep0}"></label>
        <div class="presets" role="group" aria-label="Deposit presets">${[["Today", dep0], ["$1B", 1000], ["$2.5B", 2500], ["$5B", 5000]].map(([l, v]) => `<button type="button" data-g="${v}">${l}</button>`).join("")}</div>
        <label><span class="lv">Gross yield on deposits <b data-o="c2"></b></span><input data-i="c2" type="range" min="4" max="14" step="0.1" value="${st.c2 ?? gy0}"></label>
        <label><span class="lv">CHIP price <b data-o="c3"></b></span><input data-i="c3" type="range" min="0.005" max="0.15" step="0.001" value="${st.c3 ?? p0}"></label>
      </div><div class="out"><div class="res" aria-live="polite"><div><div class="l">Fee a year, spent on CHIP</div><div class="v" data-o="r1"></div></div><div><div class="l">Share of each monthly unlock bought</div><div class="v" data-o="r2"></div></div><div><div class="l">Time to buy the April cliff</div><div class="v" data-o="r3"></div></div></div>
      <div class="hint">"Today" is ${usdM(K.vault_nav)} of deposits at ${gy0}% gross, the rate that reproduces the last 30 days' fee of ${usdM(K.fee_last_month, 2)}; it sits below the vault's own yield because the fee is booked in lumps. USD.AI's own target is $20M to $40M of revenue a year per $1B of deposits, counting origination fees and loan sales, which the proposal reinvests rather than spends on CHIP.</div></div></div>` });
    const o = (k) => el.querySelector(`[data-o="${k}"]`), inp = (k) => el.querySelector(`[data-i="${k}"]`), i = (k) => +inp(k).value;
    const run = () => {
      st.c1 = i("c1"); st.c2 = i("c2"); st.c3 = i("c3"); saveST();
      el.querySelectorAll("input[type=range]").forEach(setFill);
      el.querySelectorAll(".presets button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.g === i("c1"))));
      const dep = i("c1") * 1e6, gy = i("c2") / 100, p = i("c3");
      o("c1").textContent = dep >= 1e9 ? "$" + (dep / 1e9).toFixed(2) + "B" : "$" + (dep / 1e6).toFixed(0) + "M"; o("c2").textContent = gy.toLocaleString(undefined, { style: "percent", minimumFractionDigits: 1 }); o("c3").textContent = chipP(p);
      const fee = dep * gy * 0.1;
      o("r1").textContent = usdM(fee, 1);
      o("r2").textContent = pct(fee / 12 / (K.unlock_monthly_chip * p));
      o("r3").textContent = yrs((K.unlock_cliff_chip * p) / (fee / 12));
    };
    el.querySelectorAll("input").forEach((x) => x.addEventListener("input", run));
    el.querySelectorAll(".presets button").forEach((b) => b.addEventListener("click", () => { inp("c1").value = b.dataset.g; run(); }));
    requestAnimationFrame(run);
    return el;
  }

  /* ---------- Valuation ---------- */
  PAGES.valuation = (view) => {
    const me = (V.peers || []).find((p) => p.self) || {};
    view.appendChild(intro(txt(`CHIP is valued like a claim on a lender's fee stream, though it has no legal right to one. At ${F.usd(K.chip_fdv)} fully diluted it trades at ${ok(me.fdv_size) ? (me.fdv_size).toFixed(2) + "×" : "–"} the money it manages, and its market cap is ${ok(me.mcap_rev) ? me.mcap_rev.toFixed(0) + "×" : "–"} a year of the 10% fee. In January Pine Analytics called the launch price rich at 1.2× Ethena's and 2.9× Maple's FDV-to-TVL; its fully diluted value is now ${pct(1 - K.chip_fdv / 3e8, 0)} below that $300M launch value.`)));
    view.appendChild(grid(peersFig()));
    view.appendChild(grid(caseFig()));
  };
  function peersFig() {
    const x2 = (v) => (!ok(v) ? "–" : v < 10 ? v.toFixed(2) + "×" : v.toFixed(0) + "×");
    const body = (V.peers || []).map((p) => `<tr class="${p.self ? "hl" : ""}"><td><b>${esc(p.name)}</b> <span class="muted">${esc(p.token)}</span><span class="sub-n">${esc(p.note)}</span></td><td class="r">${p.size ? F.usd(p.size) : "–"}</td><td class="r">${F.usd(p.mcap)}</td><td class="r hide-sm">${F.usd(p.fdv)}</td><td class="r hide-sm">${F.usd(p.fees_yr)}</td><td class="r hide-sm">${F.usd(p.rev_yr)}</td><td class="r"><b>${x2(p.fdv_size)}</b></td><td class="r">${x2(p.mcap_rev)}</td></tr>`).join("");
    return staticFig({ slug: "peers", span: 12, title: "CHIP next to other lending tokens", sub: "Size is deposits plus loans outstanding. Yield generated is DefiLlama's fees; the protocol's cut is its revenue (for USD.AI, the 10% fee). Both are the last 30 days × 12", basis: "thirdparty", src: `DefiLlama protocol and revenue data; CoinGecko market data, ${day(AS_OF)}`,
      body: `<div class="tw"><table class="t peers"><thead><tr><th>Protocol</th><th class="r">Size</th><th class="r">Market cap</th><th class="r hide-sm">FDV</th><th class="r hide-sm">Yield generated a year</th><th class="r hide-sm">Protocol's cut a year</th><th class="r">FDV ÷ size</th><th class="r">Market cap ÷ cut</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function caseFig() {
    const rows = [
      ["for", "The loans pay", `Borrowers have paid the vault ${usdM(d3.sum(MROWS, (m) => m.loan_interest || 0), 1)} of interest on-chain; the loan list shows no breach or liquidation event.`, "A LoanBreached or LoanLiquidated event on either router"],
      ["for", "Loans can be sold at par", "The $98.1M Duos Edge AI loan was sold through GLX in October and the vault got its principal back.", "A GLX sale below par, or no second sale"],
      ["for", "The yield holds up when money leaves", `The vault paid ${usdM(LP.usd)} on ${dayOf(LP.d)} from cash, and the 30-day yield stayed at ${pct(K.apy_30d, 1)}.`, "A payout date that leaves requests unpaid"],
      ["against", "CHIP has no claim on anything", "The Foundation's own terms say CHIP gives no right to revenue; buybacks are a company decision and a proposal, not a rule.", "A passed governance vote that routes the fee on-chain"],
      ["against", "The unlock dwarfs the buyback", `${usdM(unlockUSD)} of CHIP unlocks in April 2027 against about ${usdM(feeYr, 1)} a year of fee.`, "Deposits several times larger, or a later unlock schedule"],
      ["against", "Few borrowers, a few big depositors", `${K.borrowers} borrower addresses; ten wallets took ${pct(LP.top10)} of the last payout.`, "More borrowers and a payout spread across more wallets"],
      ["against", "Yield needs a top-up", `The first 7% hurdle period needed a ${usdM(K.donation, 2)} donation; DefiLlama shows ${pct(K.apy_llama, 1)}.`, "Months above 7% with no donation"],
    ];
    const body = ["for", "against"].map((side) => `<tr class="grp"><th colspan="3" scope="colgroup">${side === "for" ? "For USD.AI and CHIP" : "Against"}</th></tr>${rows.filter((r) => r[0] === side).map((r) => `<tr><td><b>${r[1]}</b><div class="ev">${r[2]}</div></td><td>${r[3]}</td></tr>`).join("")}`).join("");
    return staticFig({ slug: "case", span: 12, title: "The case, with what would change it", sub: "Each argument with the event that would make us drop it", src: "This page's data; Pine Analytics (Jan 28, 2026); USD.AI blog posts", body: `<div class="tw"><table class="t checks"><thead><tr><th>Argument and evidence</th><th>Would change our mind</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }

  /* ---------- Method ---------- */
  PAGES.method = (view) => {
    view.appendChild(intro(txt("Where every number comes from, how it is computed, and what we could not measure.")));
    const sec = (id, t, html) => h(`<section class="band" id="${id}"><header class="band-h"><h2>${t}</h2></header><div class="card doc-card">${html}</div></section>`);
    const contracts = Object.entries(META.contracts || {}).map(([k, a]) => `<tr><td>${k}</td><td>${addrLink(a, a)} ${copyBtn(a, k)}</td></tr>`).join("");
    view.appendChild(sec("m-sources", "Sources", `<ul>
      <li><b>Arbitrum event logs</b>, pulled with Envio HyperSync and decoded with the contracts' verified ABIs (Sourcify): sUSDai deposits, redemption requests and payouts, base-yield deposits with the admin fee, escrow and donations; Loan Router v1 and v2 originations, repayments and refinances; CHIP and sCHIP.</li>
      <li><b>Live contract reads</b> through a public Arbitrum RPC: the vault's assets, cash, loans, escrow, share prices and redemption queue, read on ${timeUTC(RPC.read_utc)} UTC at block ${RPC.block || "–"}.</li>
      <li><b>DefiLlama</b>: the usd-ai protocol (deposits and loans outstanding as "borrowed"), fees and revenue, the sUSDai yield pool and Pendle's PT-sUSDai pool, and peer protocols.</li>
      <li><b>CoinGecko</b>: CHIP and BTC prices, market caps and volumes; peer token prices.</li>
      <li><b>USD.AI's docs and blog</b> for rules and events (the 10% fee, the 7% hurdle, the buyback, GLX). Their own metrics are marked as reported.</li></ul>`));
    view.appendChild(sec("m-defs", "Definitions", `<ul>
      <li><b>sUSDai assets</b>: shares issued by deposits minus shares redeemed, times the deposit share price. It matches the vault's own nav() to within 0.1% on the read date.</li>
      <li><b>Holder yield, 30 days</b>: the change in the deposit share price over 30 days, annualized without compounding. It is after the 10% fee.</li>
      <li><b>Lent or in escrow</b>: live-loan principal plus escrow, read from the vault. DefiLlama's "borrowed" is the same figure and gives the history.</li>
      <li><b>Loan amounts</b>: v1 loans were made in PYUSD or USDC (6 decimals), v2 loans in USDai (18 decimals); the events do not name the token, so amounts are scaled by size. A 1-token placeholder tranche on some v2 loans is ignored.</li>
      <li><b>Loan Router v2</b> (0x1c2e…e12f) is not in USD.AI's published address list. The 17 loans still open on v1 were moved to it between June 26 and July 3, 2026; we found it from the migration transactions.</li>
      <li><b>Unlocks</b> are modeled from the published shares and schedule; the reserve (19.5%) has no published schedule and is left out.</li></ul>`));
    view.appendChild(sec("m-limits", "What we could not measure", `<ul>
      <li>Borrower names. Addresses are shown; USD.AI names some borrowers in announcements, but we do not match them to addresses.</li>
      <li>Loans held by other lenders after a GLX sale, and anything that happens off-chain (insurance, SPV accounts).</li>
      <li>sUSDai and CHIP activity on Ethereum, Base, Plasma and Solana, beyond the bridged share count.</li></ul>`));
    view.appendChild(sec("m-contracts", "Contracts (Arbitrum)", `<div class="tw"><table class="t"><tbody>${contracts}</tbody></table></div>`));
  };

  // first render: no slide, charts draw in as they come into view
  if (q.get("tab") && q.get("tab") !== tab) writeURL();
  syncChrome(); moveInk(false);
  build(true);
  scrollToHash();
})();
