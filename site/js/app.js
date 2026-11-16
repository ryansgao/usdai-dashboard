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
     Every sentence reads its figures from K (kpi) or the tables. A sentence whose direction depends on the data picks
     its verb with a small test next to it, so a refresh cannot leave stale wording. Money under $1M is written in K. */
  const RPC = K.rpc || {};
  const M$ = (v, d) => (!ok(v) ? "–" : Math.abs(v) >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(d ?? (Math.abs(v) >= 1e8 ? 0 : 1)) + "M" : Math.abs(v) >= 1e3 ? "$" + Math.round(v / 1e3) + "K" : "$" + Math.round(v));
  const usdM = (v, d) => M$(v, d);
  const chipP = (v) => (!ok(v) ? "–" : "$" + (v < 0.1 ? v.toFixed(4) : v.toFixed(3)));
  const yrs = (m) => (!ok(m) ? "–" : m > 600 ? "over 50 years" : m < 24 ? Math.round(m) + " months" : (m / 12).toFixed(m < 120 ? 1 : 0) + " years");
  const monthOf = (s) => (s ? d3.utcFormat("%B %Y")(parse(s.slice(0, 7) + "-01")) : "–");
  const dayOf = (s) => (s ? d3.utcFormat("%b %-d")(parse(s.slice(0, 10))) : "–");
  const bn = (v) => (!ok(v) ? "–" : (v / 1e9).toFixed(2) + "B");
  const lentNow = (K.vault_loans || 0) + (K.vault_escrow || 0);
  const lentShare = ok(K.vault_nav) && K.vault_nav ? lentNow / K.vault_nav : K.lent_share;
  const LP = K.last_payout || {};
  const PAY = V.payouts || [];
  const bigPay = PAY.slice().sort((a, b) => b.usd - a.usd);
  const FEE30 = K.fee_last_month, feeYr = ok(FEE30) ? FEE30 * 12 : null;
  const unlockUSD = K.unlock_cliff_usd;
  const LOANS = V.loans || [];
  const BOR = V.borrowers || [];
  const firstLoan = LOANS.find((l) => l.start);
  const rates = (K.v2_rates || []).filter((r) => r > 0.02 && r < 0.3);
  const rateRange = rates.length ? `${pct(Math.min(...rates), 1)} to ${pct(Math.max(...rates), 1)}` : "–";
  const chg30 = K.chip_change_30d, btc30 = K.btc_change_30d;
  const MON_BY = Object.fromEntries((V.monthly || []).map((m) => [m.m, m]));
  const OCT = MON_BY["2026-10"] || {};
  const topupLift = ok(K.apy_30d) && ok(K.apy_30d_ex) ? K.apy_30d - K.apy_30d_ex : null;
  // the month loan interest first beat PYUSD reserve yield and stayed ahead
  const overtook = (() => { const ms = (V.monthly || []).filter((m) => m.m < AS_OF.slice(0, 7)); let k = null; for (let i = ms.length - 1; i >= 0; i--) { if ((ms[i].loan_interest || 0) > (ms[i].base_yield || 0)) k = ms[i].m; else break; } return k; })();
  const top2 = BOR.filter((b) => !b.escrow).slice(0, 2);
  const W = {
    thesis: () => `sUSDai holds ${M$(K.vault_nav, 1)}, and ${pct(lentShare)} of it is lent to GPU operators or held in escrow for servers still being installed. Holders earned ${pct(K.apy_30d, 1)} a year over the last 30 days${ok(K.apy_30d_ex) && topupLift > 0.001 ? `, but only ${pct(K.apy_30d_ex, 1)} from the loans and reserves themselves: the rest is the Nov 1 step from the Foundation's top-up and the value redeemers left behind` : ""}. CHIP, the governance token, has no legal claim on that income. USD.AI Inc. bought $1.0M of CHIP with its own money (announced Oct 26) and proposed on Oct 28 that the protocol's 10% fee, about ${M$(FEE30)} a month, buy more. In ${monthOf(K.unlock_date)}, ${bn(K.unlock_cliff_chip)} CHIP from investors, contributors and the Foundation reserve unlock.`,
    loansRead: () => `${top2.length === 2 ? `${top2.map((b) => b.name || short(b.addr)).join(" and ")} hold ${pct(K.top2_live_share)} of the vault's live loans.` : ""} The vault has lent ${M$(K.originated_usd)} since ${firstLoan ? dayOf(firstLoan.start) + ", " + firstLoan.start.slice(0, 4) : "–"} across ${K.loans_big} loans over $100K (plus ${K.loans_small} small ones), at ${rateRange} on the loans that state a rate.`,
    exitRead: () => `${M$(LP.usd)} left on ${dayOf(LP.d)}, ${bigPay[0] && bigPay[0].d === LP.d ? "the largest payout so far" : `second only to ${monthOf(bigPay[0] && bigPay[0].d)}'s ${M$(bigPay[0] && bigPay[0].usd)}`}, and ten wallets took ${pct(LP.top10)} of it. The vault paid from cash. ${ok(K.sale_principal) && K.sale_principal > 0 ? `${M$(K.sale_principal)} of that cash came from its largest loan, repaid in full on Oct 1 when Axe Compute bought the borrower's GPU company.` : ""}`,
    chipRead: () => `At the last 30 days' pace the fee comes to ${M$(feeYr, 1)} a year, ${pct(K.buyback_yield_on_mcap, 1)} of CHIP's market cap. The April unlock is worth ${M$(unlockUSD)} at today's price: ${yrs(K.buyback_months_for_cliff)} of fee. ${C(K.s2_airdrop)} more CHIP from the Season 2 airdrop can be claimed now, with no lock-up.`,
    chipMove: () => !ok(chg30) ? "" : `CHIP is ${chg30 < 0 ? "down" : "up"} ${pct(Math.abs(chg30))} over 30 days${ok(btc30) ? `, bitcoin ${btc30 < 0 ? "down" : "up"} ${pct(Math.abs(btc30))}` : ""}.`,
    vsBuyback: () => !ok(K.chip_price) ? "" : K.chip_price < K.buyback_1m_price ? `At ${chipP(K.chip_price)} it trades ${pct(1 - K.chip_price / K.buyback_1m_price)} below the $0.0448 the company paid on October 28.` : `At ${chipP(K.chip_price)} it trades above the $0.0448 the company paid on October 28.`,
  };
  /* ---------- URL and per-chart state ----------
     Range, interval, scale and hidden series are kept per chart for the session, so they survive tab changes and the
     theme switch. A chart link carries them in the query for the linked chart only. */
  const TABS = [["overview", "Overview"], ["deposits", "Deposits"], ["loans", "Loans"], ["yield", "Yield"], ["redemptions", "Redemptions"], ["chip", "CHIP"], ["valuation", "Valuation"], ["method", "Method"]];
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const q = new URLSearchParams(location.search);
  let tabQ = (q.get("tab") || "").toLowerCase();
  if (tabQ === "vault") tabQ = "deposits";
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
    if (presets.length < 2 || tm.noRange) presets = [];
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
  $("#quote").innerHTML = `<div class="h-cells">${cell("sUSDai assets", M$(K.vault_nav, 1))}${cell("Holder yield, 30 days", pct(K.apy_30d, 1))}${cell("CHIP", chipP(K.chip_price))}${chg ? cell("30-day change", chg, "xl") : ""}${cell("CHIP FDV", M$(K.chip_fdv), "xl")}</div>`;
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
     PAGES. One tab per mechanism: deposits, loans, yield, redemptions, CHIP, valuation.
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
  const csvMenu = (name, rows) => [{ icon: "dl", label: "Download CSV", run: () => VC.download(`usdai_${name}_${AS_OF}.csv`, VC.toCSV(csvRows(rows))) }];
  // a "how it works" strip: numbered steps in one row, no boxes
  const steps = (items) => h(`<section class="howto"><ol>${items.map(([t, d]) => `<li><b>${t}</b><span>${d}</span></li>`).join("")}</ol></section>`);

  /* ---------- Overview ---------- */
  PAGES.overview = (view) => {
    const tiles = [
      ["In the vault", M$(K.vault_nav, 1), `sUSDai's assets, read from the contract on ${dayOf(RPC.read_utc || AS_OF)}`],
      ["Lent or in escrow", pct(lentShare), `${M$(K.vault_loans)} in live loans, ${M$(K.vault_escrow)} waiting on hardware`],
      ["Holder yield, 30 days", pct(K.apy_30d, 1), ok(K.apy_30d_ex) ? `Organic ${pct(K.apy_30d_ex, 1)} without the Nov 1 step; after the 10% fee` : "After the 10% fee"],
    ];
    const kv = [
      ["sUSDai assets", "Shares × deposit share price", M$(K.susdai_assets, 1), arrow(K.assets_change_30d)],
      ["Lent or in escrow", "Live loans plus escrow", M$(K.lent, 1), arrow(K.lent_change_30d)],
      ["Protocol fee, 30 days", "10% of yield; loan fees excluded", M$(FEE30), ""],
      ["Waiting to redeem", `Paid ${dayOf(K.next_redemption)}`, M$(K.queue_pending_usd, 1), ""],
      ["CHIP price", "Close, " + dayOf(AS_OF), chipP(K.chip_price), arrow(chg30)],
      ["CHIP fully diluted", "Price × 10B CHIP", M$(K.chip_fdv), arrow(chg30)],
    ];
    view.appendChild(h(`<section class="intro ov"><div class="ov-top">
      <div class="ov-lead"><div class="lede"><p class="thesis">${W.thesis()}</p></div>
        <div class="tiles">${tiles.map(([l, v, d]) => `<div class="tile"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join("")}</div></div>
      <div class="ov-side"><div class="kvcard"><table class="kv"><tbody>${kv.map(([l, def, v, d]) => `<tr><td><span class="lab">${l}</span><span class="def">${def}</span></td><td class="v">${v}</td><td class="d">${d}</td></tr>`).join("")}</tbody></table>
        <p class="kv-note">Changes over 30 days. USDai, PYUSD and USDC are counted at $1.</p></div></div></div>
      <div class="reads">
      <div><h3>The loans are few and large</h3><p>${W.loansRead()}</p></div>
      <div><h3>Money leaves once a month, in bulk</h3><p>${W.exitRead()}</p></div>
      <div><h3>The fee is small next to the unlock</h3><p>${W.chipRead()}</p></div></div></section>`));
    view.appendChild(band(["Where the money is", "sUSDai's assets, split into what is lent and what is not, with the six dates that moved them."], grid(assetsChart(true))));
    view.appendChild(grid(incomeChart(6), flowsChart(6)));
    const box = h('<div class="diagram"></div>');
    const flowEl = staticFig({ slug: "flow", span: 12, title: "How a dollar moves through USD.AI", sub: "Latest on-chain figures. The dashed link is a proposal, not yet a rule", body: box, src: "USD.AI docs; Arbitrum contract reads; DefiLlama" });
    view.appendChild(grid(flowEl));
    requestAnimationFrame(() => { drawFlow(box); VC.observe(box, () => drawFlow(box)); });
    view.appendChild(grid(signals()));
  };

  function assetsChart(withEvents) {
    const rows = D.filter((r) => r.susdai_assets != null && r.lent != null);
    const mar = rows.find((r) => r.d >= "2026-03-01") || {};
    const keep = ["2026-03-07", "2026-06-04", "2026-07-02", "2026-09-23", "2026-10-01", "2026-11-01"];
    return chartFig({ slug: "assets", span: 12, events: withEvents, eventsBelow: true, title: `${pct(lentShare)} of sUSDai is lent, up from ${pct(mar.lent / mar.susdai_assets)} at the start of March`,
      sub: "sUSDai assets per day: loans and escrow, and the rest (mostly USDai cash)", basis: "mixed", src: "Assets: sUSDai deposits and redemptions on Arbitrum × deposit share price; lent: DefiLlama usd-ai borrowed, which matches the vault's own loan and escrow balances",
      csvCols: ["susdai_assets", "lent", "unlent", "share_price"],
      time: { rows, key: "d", def: "All", agg: { susdai_assets: "last", lent: "last", unlent: "last" } } },
      (r) => ({ data: r, height: 300, series: [
        { key: "lent", label: "Lent or in escrow", color: "--c-diem", type: "area", stack: "a", fmt: F.usd },
        { key: "unlent", label: "Not lent", color: "--c-float", type: "area", stack: "a", fmt: F.usd },
      ], total: "sUSDai assets", yFormat: F.usdAx, yMin: 0, events: withEvents ? evs((e) => keep.includes(e.d)) : undefined }));
  }

  /* ---------- flow diagram ----------
     Wide (card ≥ 760px): three lanes, straight or right-angled edges only, amounts on the edges, the fee-to-CHIP link
     dashed because it is a proposal. Narrow: the same path as a numbered list, so nothing is drawn wrong on a phone. */
  function drawFlow(el) {
    const W0 = el.clientWidth || 900;
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    if (W0 < 760) {
      el.innerHTML = `<ol class="flow-list">
        <li><b>Depositors</b> swap PYUSD for USDai, one to one (${M$(RPC.usdai_supply_arbitrum)} issued).</li>
        <li><b>sUSDai vault</b> takes staked USDai (${M$(K.vault_nav, 1)}); holders earn ${pct(K.apy_30d, 1)}.</li>
        <li><b>GPU operators</b> borrow from the vault: ${M$(K.vault_loans)} in live loans, ${M$(K.vault_escrow)} in escrow. They pay interest and principal back each month.</li>
        <li><b>PYUSD reserve yield</b> (PayPal's 4.5% incentive, ending Mar 1, 2027 or at $1B) is paid into the vault on idle cash.</li>
        <li><b>10% of all yield</b> goes to the protocol: ${M$(FEE30)} in the last 30 days.</li>
        <li><b>CHIP buybacks</b>: proposed, all of the fee after Foundation costs.</li>
        <li><b>Redemptions</b> are paid once a month from cash: ${M$(LP.usd)} on ${dayOf(LP.d)}.</li></ol>`;
      return;
    }
    const bw = Math.min(220, (W0 - 120) / 4), bh = 62, gap = (W0 - 4 * bw) / 3, top = 54, row2 = top + bh + 92, H = row2 + bh + 16;
    const X = (c) => c * (bw + gap);
    const svg = d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W0} ${H}`).attr("height", H).attr("role", "img").attr("aria-label", "How money moves through USD.AI");
    const defs = svg.append("defs");
    const mk = (id, c) => defs.append("marker").attr("id", id).attr("viewBox", "0 0 10 10").attr("refX", 9).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto-start-reverse").append("path").attr("d", "M0,0L10,5L0,10z").attr("fill", c);
    mk("arr", css("--muted")); mk("arrO", css("--c-burn"));
    const mix = (c, a) => `color-mix(in srgb, ${c} ${a * 100}%, ${css("--card")})`;
    const kind = { money: css("--c-total"), vault: css("--c-diem"), yield: css("--c-burn"), chip: css("--c-lead") };
    const box = (c, y, t, s, k) => {
      const g = svg.append("g").attr("transform", `translate(${X(c)},${y})`);
      g.append("rect").attr("width", bw).attr("height", bh).attr("rx", 6).attr("fill", mix(kind[k], 0.08)).attr("stroke", mix(kind[k], 0.45));
      g.append("text").attr("x", bw / 2).attr("y", 25).attr("text-anchor", "middle").style("font", "600 14px var(--sans)").style("fill", css("--fg")).text(t);
      g.append("text").attr("x", bw / 2).attr("y", 44).attr("text-anchor", "middle").style("font", "400 12px var(--sans)").style("fill", css("--fg-2")).text(s);
    };
    const label = (x, y, l1, l2, anchor = "middle", c) => {
      const t = svg.append("text").attr("x", x).attr("y", y).attr("text-anchor", anchor).style("font", "500 12px var(--sans)").style("fill", c || css("--fg-2")).style("paint-order", "stroke").style("stroke", css("--card")).style("stroke-width", "4px").text(l1);
      if (l2) svg.append("text").attr("x", x).attr("y", y + 15).attr("text-anchor", anchor).style("font", "400 12px var(--sans)").style("fill", css("--muted")).style("paint-order", "stroke").style("stroke", css("--card")).style("stroke-width", "4px").text(l2);
      return t;
    };
    const path = (d, { dash, orange } = {}) => svg.append("path").attr("d", d).attr("fill", "none").attr("stroke", orange ? css("--c-burn") : css("--line-strong")).attr("stroke-width", 1.5).attr("stroke-dasharray", dash ? "5 4" : null).attr("marker-end", `url(#${orange ? "arrO" : "arr"})`);
    // lanes
    [["Depositors", 0], ["On Arbitrum", 1], ["Borrowers, off-chain hardware", 3]].forEach(([t, c]) => svg.append("text").attr("x", X(c)).attr("y", 14).style("font", "500 12px var(--sans)").style("fill", css("--muted")).text(t));
    box(0, top, "Depositors", "PYUSD in, USDai out", "money");
    box(1, top, "USDai", `${M$(RPC.usdai_supply_arbitrum)} issued, 1:1 PYUSD`, "money");
    box(2, top, "sUSDai vault", `${M$(K.vault_nav, 1)}; ${pct(K.apy_30d, 1)} to holders`, "vault");
    box(3, top, "GPU operators", `${K.borrowers} borrowers, ${rateRange}`, "vault");
    box(1, row2, "PYUSD reserve yield", "PayPal's 4.5% on idle cash", "yield");
    box(2, row2, "Protocol fee", `10% of yield: ${M$(FEE30)} / 30 days`, "yield");
    box(3, row2, "CHIP buybacks", "$1.0M bought Oct 28", "chip");
    const my = top + bh / 2;
    path(`M${X(0) + bw},${my}H${X(1) - 2}`); label((X(0) + bw + X(1)) / 2, my - 8, "mint 1:1");
    path(`M${X(1) + bw},${my}H${X(2) - 2}`); label((X(1) + bw + X(2)) / 2, my - 8, "stake");
    path(`M${X(2) + bw},${my - 12}H${X(3) - 2}`); label((X(2) + bw + X(3)) / 2, my - 20, "lend", `${M$(K.vault_loans)} live, ${M$(K.vault_escrow)} escrow`);
    path(`M${X(3)},${my + 14}H${X(2) + bw + 2}`, { orange: true }); label((X(2) + bw + X(3)) / 2, my + 32, `interest ${M$(K.loan_interest_total, 1)} so far`, "", "middle", css("--c-burn"));
    // PYUSD yield: right, then up into the vault's left port
    const px = X(2) + bw * 0.22;
    path(`M${X(1) + bw},${row2 + bh / 2}H${px}V${top + bh + 2}`, { orange: true }); label((X(1) + bw + px) / 2, row2 + bh / 2 - 8, "base yield", "", "middle", css("--c-burn"));
    path(`M${X(2) + bw / 2},${top + bh}V${row2 - 2}`, { orange: true }); label(X(2) + bw / 2 + 8, (top + bh + row2) / 2 + 4, "10% of yield", "", "start", css("--c-burn"));
    path(`M${X(2) + bw},${row2 + bh / 2}H${X(3) - 2}`, { dash: true }); label((X(2) + bw + X(3)) / 2, row2 + bh / 2 - 8, "proposed:", "all of the fee");
    // redemptions: over the top, back to depositors
    const ry = top - 18;
    path(`M${X(2) + bw * 0.78},${top}V${ry}H${X(0) + bw / 2}V${top - 2}`); label((X(0) + bw / 2 + X(2) + bw * 0.78) / 2, ry - 6, `redeem monthly: ${M$(LP.usd)} on ${dayOf(LP.d)}`);
  }

  /* ---------- signals: each row is a number, a dated comparison and one verdict for sUSDai holders or CHIP ---------- */
  function signals() {
    const last = (k, n) => D.slice(-n).map((r) => r[k]);
    const cover = ok(K.queue_pending_usd) && K.queue_pending_usd > 0 ? (K.vault_cash || 0) / K.queue_pending_usd : null;
    const sig = [
      { tab: "deposits", who: "sUSDai", name: "sUSDai assets", now: M$(K.susdai_assets, 1), why: `${K.assets_change_30d < 0 ? "Down" : "Up"} ${pct(Math.abs(K.assets_change_30d))} in 30 days, after ${M$(LP.usd)} was paid out on ${dayOf(LP.d)}`, spark: last("susdai_assets", 90), v: K.assets_change_30d < -0.1 ? "bad" : K.assets_change_30d > 0.05 ? "good" : "mixed" },
      { tab: "redemptions", who: "sUSDai", name: "Cash against the queue", now: ok(cover) ? Math.round(cover) + "×" : "–", why: `${M$(K.vault_cash, 1)} of cash against ${M$(K.queue_pending_usd, 1)} queued for ${dayOf(K.next_redemption)}`, spark: last("queue_usd", 90), v: cover > 3 ? "good" : cover > 1 ? "mixed" : "bad" },
      { tab: "yield", who: "sUSDai", name: "Holder yield, 30 days", now: pct(K.apy_30d, 1), why: `Organic ${pct(K.apy_30d_ex, 1)}, below the 7% hurdle, so another top-up of about ${M$(K.vault_nav * Math.max(0, 0.07 - K.apy_30d_ex) * 30 / 365)} is likely on ${dayOf(K.next_redemption)}`, spark: last("apy_30d_ex", 90), v: K.apy_30d_ex >= 0.07 ? "good" : "mixed" },
      { tab: "loans", who: "sUSDai", name: "QumulusAI's going-concern warning", now: M$((BOR.find((b) => b.name === "QumulusAI") || {}).live), why: "QumulusAI, a borrower on three loans, reported substantial doubt about continuing as a going concern in its 10-Q of Nov 10, 2026", v: "bad" },
      { tab: "loans", who: "sUSDai", name: "Two largest borrowers", now: pct(K.top2_live_share), why: `${top2.map((b) => b.name || short(b.addr)).join(" and ")}, of ${M$(K.live_principal)} in live loans`, v: K.top2_live_share > 0.4 ? "bad" : "mixed" },
      { tab: "chip", who: "CHIP", name: "Who votes", now: "1 delegate", why: "99.998% of the votes in both October proposals, delegated from Foundation reserve and contributor wallets; 3 voters each", v: "bad" },
      { tab: "chip", who: "CHIP", name: "Fee against the April unlock", now: yrs(K.buyback_months_for_cliff), why: `${M$(FEE30)} a month against ${M$(unlockUSD)} of CHIP unlocking in ${monthOf(K.unlock_date)}`, v: K.buyback_months_for_cliff > 24 ? "bad" : "mixed" },
      { tab: "chip", who: "CHIP", name: "CHIP price", now: chipP(K.chip_price), why: `${W.chipMove()} The Oct 28 buyback paid $0.0448`, spark: last("chip_price", 90), v: chg30 < -0.15 ? "bad" : chg30 > 0.15 ? "good" : "mixed" },
    ];
    const VERD = { good: ["Good for", "up"], mixed: ["Mixed for", "muted"], bad: ["Bad for", "down"] };
    const tb = h(`<div class="tw"><table class="t sig"><thead><tr><th>Signal</th><th class="r">Now</th><th class="hide-sm">Last 90 days</th><th>Reads as</th></tr></thead><tbody></tbody></table></div>`);
    sig.forEach((g) => {
      const tr = h(`<table><tr class="rowlink" data-href="${urlFor(g.tab)}" data-tabgo="${g.tab}"><td><a class="sig-a" href="${urlFor(g.tab)}" data-tab="${g.tab}">${esc(g.name)}</a><div class="why">${esc(g.why)}</div></td><td class="r nowrap">${g.now}</td><td class="hide-sm">${g.spark ? `<div class="sp"></div>` : ""}</td><td class="${VERD[g.v][1]} nowrap">${VERD[g.v][0]} ${g.who}</td></tr></table>`).querySelector("tr");
      tb.querySelector("tbody").appendChild(tr);
      if (g.spark && g.spark.filter((v) => v != null).length > 2) requestAnimationFrame(() => VC.spark(tr.querySelector(".sp"), g.spark, { color: "--c-lead" }));
    });
    tb.addEventListener("click", (e) => { const r = e.target.closest("tr[data-tabgo]"); if (r && !e.target.closest("a")) go(r.dataset.tabgo, true); });
    return staticFig({ slug: "signals", span: 12, title: "What to watch", sub: "Click a row for the tab with its chart", src: "Arbitrum, DefiLlama, CoinGecko. Our reading of each trend, not a forecast", body: tb });
  }

  /* ---------- Deposits: USDai and sUSDai ---------- */
  PAGES.deposits = (view) => {
    const bridged = K.vault_bridged_share;
    const usdaiInVault = ok(RPC.usdai_supply_arbitrum) && ok(K.vault_cash) ? K.vault_cash / RPC.usdai_supply_arbitrum : null;
    view.appendChild(intro(txt(`Since February 2026 deposits come in as PYUSD (before that, USDC and wrapped M, a tokenized T-bill), become USDai one to one, and are staked as sUSDai. Plain USDai is rarely held: ${pct(usdaiInVault)} of it sits in the vault as cash. Two-thirds of sUSDai lives on other chains.`),
      [["sUSDai shares", (K.vault_shares / 1e6).toFixed(1) + "M", `${pct(bridged)} bridged to Ethereum, Base, Plasma, Solana`], ["One sUSDai", (K.deposit_price || K.share_price || 0).toFixed(4) + " USDai", "Deposit share price"], ["USDai issued", M$(RPC.usdai_supply_arbitrum), `${pct(usdaiInVault)} inside sUSDai`]]));
    const parts = [
      { label: "Live loans", value: K.vault_loans || 0, color: "--c-diem", note: "Principal outstanding on loans the vault holds" },
      { label: "Escrow", value: K.vault_escrow || 0, color: "--c-staked", note: "Funded loans waiting on delivery and installation of the servers" },
      { label: "Cash", value: K.vault_cash || 0, color: "--c-float", note: "USDai in the vault, for redemptions and new loans" },
    ];
    const sb = h('<div class="sb-wrap"></div>');
    const comp = staticFig({ slug: "composition", span: 12, title: `Cash is ${pct((K.vault_cash || 0) / K.vault_nav)} of the vault after the November payout`, sub: `sUSDai's assets by kind, read from the contract on ${dayOf(RPC.read_utc)}`, basis: "onchain", conf: "high", src: "sUSDai view functions on Arbitrum: balances, loanRouterBalances, depositTimelockBalance", body: sb,
      menu: csvMenu("composition", parts.map((p) => ({ kind: p.label, usd: p.value }))) });
    requestAnimationFrame(() => VC.stackBar(sb, { parts, fmt: F.usd }));
    view.appendChild(grid(comp));
    view.appendChild(grid(flowsChart(12)));
    view.appendChild(grid(assetsChart(false)));
  };
  function flowsChart(span) {
    // the payout lands on the 1st, so the current month's redemptions are complete even while deposits are not
    const rows = MROWS.map((m) => ({ ...m, neg_red: m.redeemed ? -m.redeemed : 0 }));
    const b = bigPay.slice(0, 2).sort((x, y) => (x.d < y.d ? -1 : 1));
    return chartFig({ slug: "flows", span: span || 12, title: b.length === 2 ? `${monthOf(b[0].d)} and ${monthOf(b[1].d)} were the two big exits` : "Money in and money out", sub: "USDai deposited into sUSDai and paid to redeemers, per month", basis: "onchain", conf: "high", src: "sUSDai Deposit and RedemptionsServiced events",
      csvCols: ["deposits", "redeemed"], time: { rows, key: "m", def: span === 6 ? "1Y" : "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "deposits", label: "Deposited", color: "--c-buy", type: "bar", fmt: F.usd },
        { key: "neg_red", label: "Paid to redeemers", color: "--c-sell", type: "bar", fmt: (v) => F.usd(Math.abs(v)) },
      ], yFormat: F.usdAx, partLabel: "Deposits so far this month", tipNote: (x) => `Net ${F.usd((x.deposits || 0) - (x.redeemed || 0))}` }));
  }

  /* ---------- Loans ---------- */
  PAGES.loans = (view) => {
    view.appendChild(intro(txt(W.loansRead()),
      [["Live loans", M$(K.live_principal), "Vault principal outstanding"], ["Rate, where stated", pct(K.live_rate_wavg, 1), `Weighted on ${M$(K.live_rated_principal)} of live loans`], ["In escrow", M$(K.vault_escrow), "Hardware not yet live"]]));
    view.appendChild(steps([
      ["Escrow", "The vault funds a facility into escrow while servers ship and install. It earns 6 to 8% there."],
      ["Live loan", "The borrower's single-purpose company owns the GPUs, pays monthly and amortizes over three years. LTV at most 80%."],
      ["Repaid or sold", "Loans are repaid, or sold to institutions through GLX (launched October 2026). The first \"GLX sale\", Duos Edge AI, was in fact a payoff: Axe Compute bought the borrower's company on Sep 30 and repaid about $87.8M."],
      ["If it goes wrong", "Default interest from the day after a missed payment; the agent first keeps the operator running, then sells the company, then the servers."],
    ]));
    view.appendChild(grid(borrowerChart(), origChart()));
    view.appendChild(grid(interestChart(), principalChart()));
    view.appendChild(band(["Every loan", "From the two Loan Router contracts. Names are matched to USD.AI's announcements by size and date; the rest are addresses."], grid(loanTable()), grid(escrowTable(), reportedTable())));
  };
  function borrowerChart() {
    const box = h("<div></div>");
    const rows = BOR.filter((b) => b.live > 0);
    const el = staticFig({ slug: "borrowers", span: 6, title: `Three obligors hold ${pct(K.top3_committed_share)} of the money lent or committed`, sub: "Vault principal outstanding by borrower, with the escrow facility as its own obligor", basis: "onchain", conf: "high", src: "Loan Router v1 and v2 originations less principal repaid", body: box,
      menu: csvMenu("borrowers", BOR) });
    requestAnimationFrame(() => VC.hbars(box, { rows: rows.slice(0, 8).map((b) => ({ label: b.name || "Not named " + short(b.addr), value: b.live, color: b.escrow ? "--c-staked" : "--c-diem", note: b.inferred ? "$128.9M in escrow; matched to HIVE Digital's filings by size, 9% rate, GB200 hardware and BC site (lender not named there)" : `${b.n} loan${b.n > 1 ? "s" : ""}, ${M$(b.lent)} lent in all${b.addr ? ", " + short(b.addr) : ""}` })), fmt: F.usd, labelW: 150 }));
    return el;
  }
  function origChart() {
    return chartFig({ slug: "originations", span: 6, title: "Most of the money went out in five months", sub: "New live loans and escrow funding per month; cancelled escrow deposits are left out", basis: "onchain", conf: "high", src: "LoanOriginated on Loan Router v1 and v2; LoanEscrowTimelockDeposited on sUSDai, net of cancellations",
      csvCols: ["originated", "originated_n", "escrow_funded"], time: { rows: MROWS.filter((m) => m.m >= "2025-11"), key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "originated", label: "New live loans", color: "--c-diem", type: "bar", stack: "a", fmt: F.usd },
        { key: "escrow_funded", label: "Paid into escrow", color: "--c-staked", type: "bar", stack: "a", fmt: F.usd },
      ], yFormat: F.usdAx, partLabel: "In progress", tipNote: (x) => (x.originated_n ? `${x.originated_n} new loan${x.originated_n > 1 ? "s" : ""}. Escrow later becomes a live loan, so a facility can appear twice` : "Escrow later becomes a live loan, so a facility can appear twice") }));
  }
  function interestChart() {
    const rows = MROWS.filter((m) => m.m >= "2025-11");
    return chartFig({ slug: "interest", span: 6, title: `Borrowers have paid the vault ${M$(K.loan_interest_total, 1)} of interest`, sub: "Interest received by sUSDai per month. October holds two payment rounds (Oct 1 and Oct 30) and the interest settled at the loan sale", basis: "onchain", conf: "high", src: "LenderRepaid events where the lender is the sUSDai vault, both routers",
      csvCols: ["loan_interest", "loan_interest_sale"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "loan_interest", label: "Monthly payments", color: "--c-burn", type: "bar", stack: "a", fmt: F.usd },
        { key: "loan_interest_sale", label: "Settled at the Duos payoff", color: "--c-buyback", type: "bar", stack: "a", fmt: F.usd },
      ], yFormat: F.usdAx, partLabel: "In progress" }));
  }
  function principalChart() {
    const rows = MROWS.filter((m) => m.m >= "2025-11");
    return chartFig({ slug: "principal", span: 6, title: `One payoff returned ${M$(K.sale_principal)}, more than all scheduled repayments`, sub: "Principal returned to sUSDai per month: amortization and prepayment, and the Duos Edge AI loan repaid in full when Axe Compute bought the borrower", basis: "onchain", conf: "high", src: "LenderRepaid events (vault), both routers; a loan paid off in full on one day is counted as a sale",
      csvCols: ["loan_principal_back", "loan_principal_sale"], time: { rows, key: "m", def: "All", bars: true } },
      (r) => ({ data: r, height: 260, logY: false, series: [
        { key: "loan_principal_back", label: "Scheduled and prepaid", color: "--c-other", type: "bar", stack: "a", fmt: F.usd },
        { key: "loan_principal_sale", label: "Repaid at the Duos sale", color: "--c-diem", type: "bar", stack: "a", fmt: F.usd },
      ], yFormat: F.usdAx, partLabel: "In progress" }));
  }
  function loanTable() {
    const ST_TXT = { active: "Live", repaid: "Repaid", "moved to v2": "Live", refinanced: "Refinanced", breached: "Breach flagged", liquidated: "Liquidated" };
    const all = LOANS.filter((l) => l.start);
    const rows = d3.groups(all, (l) => [l.start, l.borrower, Math.round(l.principal), l.status].join("|"))
      .map(([, ls]) => ({ ...ls[0], n: ls.length, principal_all: d3.sum(ls, (l) => l.principal), interest_paid: d3.sum(ls, (l) => l.interest_paid) }))
      .sort((a, b) => (a.status === "repaid") - (b.status === "repaid") || b.principal_all - a.principal_all);
    const max = d3.max(rows, (r) => r.principal_all) || 1;
    const terms = (l) => (l.borrower_rate ? `${pct(l.borrower_rate, 1)}${l.rate ? `<span class="sub-n">vault ${pct(l.rate, 1)}</span>` : ""}` : l.rate ? `vault ${pct(l.rate, 1)}` : "–");
    const body = rows.map((l) => `<tr><td class="nowrap">${day(l.start)}</td><td>${l.name ? `<b>${l.name}</b>` : `<span class="muted">Not named</span>`}<span class="sub-n">${l.gpus ? esc(l.gpus) + " · " : ""}${addrLink(l.borrower)}</span></td><td class="r bar-cell"><span class="bar" style="width:${Math.max(2, (l.principal_all / max) * 80)}px"></span><span>${l.n > 1 ? `${l.n} × ${F.usd(l.principal)}` : F.usd(l.principal)}</span></td><td class="r hide-sm">${terms(l)}</td><td class="r hide-sm">${F.usd(l.interest_paid)}</td><td>${ST_TXT[l.status] || l.status}</td></tr>`).join("");
    const tot = `<tr class="tot"><td colspan="2"><b>Total</b>, ${K.loans_total} loans</td><td class="r"><b>${F.usd(K.originated_usd)}</b></td><td class="hide-sm"></td><td class="r hide-sm"><b>${F.usd(d3.sum(all, (l) => l.interest_paid))}</b></td><td></td></tr>`;
    return staticFig({ slug: "loan-list", span: 12, title: `${K.loans_big} loans over $100K, and ${K.loans_small} small ones`, sub: "Live loans first, largest first. Borrower rates from filings and the attestation; the vault's own tranche rate is about 1.5 points lower. Interest is what the borrower paid all lenders, across moves, re-issues and refinances. Some v2 loans carry a small second tranche paid to a servicer address",
      basis: "onchain", conf: "high", src: "Loan Router v1 0x0C2E…97D1 and v2 0x1c2e…e12f on Arbitrum",
      menu: csvMenu("loans", LOANS.map((l) => ({ start: l.start, name: l.name || "", borrower: l.borrower, principal: l.principal, outstanding: l.outstanding, rate: l.rate, term_days: l.term_days, status: l.status, router: l.router, interest_paid: l.interest_paid, hash: l.hash }))),
      body: `<div class="tw"><table class="t loans"><thead><tr><th>Start</th><th>Borrower</th><th class="r">Principal</th><th class="r hide-sm">Borrower pays</th><th class="r hide-sm">Interest paid</th><th>Status</th></tr></thead><tbody>${body}${tot}</tbody></table></div>` });
  }
  function escrowTable() {
    const ST_TXT = { withdrawn: "Became a live loan", cancelled: "Cancelled", open: "Still in escrow" };
    const es = (V.escrows || []).filter((e) => !e.redo).slice().reverse();
    const body = es.map((e) => `<tr><td class="nowrap">${dayOf(e.d)}</td><td class="r">${F.usd(e.usd)}</td><td class="r">${e.rate > 0 ? pct(e.rate, 1) : "–"}</td><td>${ST_TXT[e.status] || e.status}${e.end ? `<span class="sub-n">${dayOf(e.end)}</span>` : ""}</td></tr>`).join("");
    return staticFig({ slug: "escrow", span: 6, title: "Escrow: money set aside while servers are installed", sub: "One row per facility. Deposits cancelled and re-made the same week are shown once", basis: "onchain", conf: "high", src: "LoanEscrowTimelock events on sUSDai",
      menu: csvMenu("escrow", (V.escrows || []).map((e) => ({ funded: e.d, usd: e.usd, rate: e.rate, outcome: e.status, ended: e.end || "", duplicate_of_redo: e.redo }))),
      body: `<div class="tw"><table class="t"><thead><tr><th>Funded</th><th class="r">Amount</th><th class="r">Rate</th><th>Outcome</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function reportedTable() {
    const ours = `${K.loans_big} loans over $100K; ${M$(K.originated_usd)} lent since Dec 2025; ${M$(K.lent, 1)} lent or in escrow now`;
    const body = (V.reported || []).map((r) => `<tr><td class="nowrap">${dayOf(r.d)}</td><td>${esc(r.what)}<span class="sub-n">${esc(r.src)}</span></td></tr>`).join("");
    return staticFig({ slug: "reported", span: 6, title: "What USD.AI reports, against the chain", sub: `On-chain today: ${ours}. USD.AI's "lifetime" figures count facilities that other lenders funded and loans sold through GLX`, src: "USD.AI blog and reports; thelearningpill",
      body: `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Reported</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }

  /* ---------- Yield ---------- */
  PAGES.yield = (view) => {
    const gap = ok(K.deposit_price) && ok(K.redemption_price) ? 1 - K.redemption_price / K.deposit_price : null;
    view.appendChild(intro(txt(`sUSDai pays nothing out: its price rises as borrowers pay and as idle cash earns PayPal's PYUSD incentive, after a 10% fee. Since mid-October the CHIP Foundation tops up any 30-day period that earns under 7%.`),
      [["Last 30 days", pct(K.apy_30d, 1), `Organic ${pct(K.apy_30d_ex, 1)} without the Nov 1 step`], ["Pendle fixed rate", pct(K.pt_apy, 1), "Locked to Feb 2027"], ["Leaving costs", ok(gap) ? pct(gap, 2) : "–", "Redemption price below deposit price"]]));
    view.appendChild(grid(yieldChart()));
    view.appendChild(grid(hurdleFig(), incomeChart(6)));
  };
  function yieldChart() {
    const rows = D.filter((r) => r.apy_30d != null);
    return chartFig({ slug: "yield", span: 12, events: true, eventsBelow: true, title: `Organic yield has run near ${pct(K.apy_30d_ex, 1)} since mid-October; the Nov 1 step lifted the 30-day figure to ${pct(K.apy_30d, 1)}`, sub: "30-day yield from the sUSDai share price, with and without the Nov 1 step (top-up plus redeemers' leftover); Pendle's fixed rate for PT-sUSDai; the 7% hurdle since Oct 15", basis: "mixed", src: "Share price from sUSDai deposits on Arbitrum; Pendle PT-sUSDai Feb 2027 via DefiLlama",
      csvCols: ["apy_30d", "apy_30d_ex", "pt_apy", "share_price"], time: { rows, key: "d", def: "1Y", agg: { apy_30d: "mean", apy_30d_ex: "mean", pt_apy: "mean", hurdle: "mean" } } },
      (r) => ({ data: r, height: 300, yMin: 0, series: [
        { key: "apy_30d", label: "sUSDai, 30 days", color: "--c-lead", type: "line", fmt: (v) => pct(v, 2), width: 1.75 },
        { key: "apy_30d_ex", label: "Organic", color: "--c-cmp", type: "line", fmt: (v) => pct(v, 2) },
        { key: "pt_apy", label: "Pendle fixed rate", color: "--c-burn", type: "line", fmt: (v) => pct(v, 2) },
        { key: "hurdle", label: "7% hurdle", color: "--muted", type: "line", dash: true, fmt: (v) => pct(v, 0) },
      ], yFormat: F.pct0, tipNote: () => "Pendle's fixed rate mostly prices Allo points and a thin pool (about $4M), so it is not a forecast of vault yield",
        events: evs((e) => ["2026-10-01", "2026-11-01"].includes(e.d)) }));
  }
  function hurdleFig() {
    const box = h("<div></div>");
    const el = staticFig({ slug: "hurdle", span: 5, title: "The first top-up added 0.47 points", sub: "Oct 15 to Nov 1, 2026: deposit-price yield, the Foundation's 127,928 USDai donation, and the 7% target", basis: "reported", src: "USD.AI, \"How sUSDai yield works and the CHIP Hurdle Rate\" (Nov 2); donation on-chain (Donated event, Nov 1), sent from the same Safe that collects the 10% fee", body: box });
    el.querySelector(".card-b").appendChild(h(`<p class="card-note">Holders who stayed through the Nov 1 payout earned about 8.04%: redeemers left 1.04 points of not-yet-paid interest behind.</p>`));
    requestAnimationFrame(() => VC.waterfall(box, { height: 240, fmt: (v) => v.toFixed(2) + "%", axisFmt: (v) => v + "%", steps: [
      { label: "Earned", value: 6.53, kind: "start", color: "--c-burn" },
      { label: "Top-up", value: 0.47, kind: "delta", color: "--c-buyback" },
      { label: "Paid", value: 7.0, kind: "end", color: "--c-total" },
    ] }));
    return el;
  }
  function incomeChart(span) {
    const rows = MROWS.filter((m) => m.m >= "2025-07");
    return chartFig({ slug: "income", span: span === 6 ? 6 : 7, title: overtook ? `Loan interest has out-earned the PYUSD reserve since ${monthOf(overtook)}` : "Where the vault's income comes from", sub: "Cash booked by sUSDai per month, by source. Reserve yield is after the 10% fee; loan and escrow interest are what borrowers paid, before it. Until February 2026 USDai was backed by USDC and wrapped M; their yield arrived in one $7.8M batch on Feb 2. Since then PYUSD earns PayPal's 4.5% incentive, paid monthly", basis: "onchain", conf: "high", src: "LenderRepaid (vault), BaseYieldDeposited, LoanEscrowTimelock interest, Donated; sUSDai and the Loan Routers",
      csvCols: ["loan_interest", "loan_interest_sale", "base_yield", "escrow_interest", "donation", "fee_modeled"], time: { rows, key: "m", def: "6M", bars: true } },
      (r) => ({ data: r, height: 260, series: [
        { key: "loan_interest", label: "Loan interest", color: "--c-burn", type: "bar", stack: "a", fmt: F.usd },
        { key: "loan_interest_sale", label: "Interest at the loan sale", color: "--c-buyback", type: "bar", stack: "a", fmt: F.usd },
        { key: "escrow_interest", label: "Escrow interest", color: "--c-tier3", type: "bar", stack: "a", fmt: F.usd },
        { key: "base_yield", label: "PYUSD reserve yield", color: "--c-tier2", type: "bar", stack: "a", fmt: F.usd },
        { key: "donation", label: "Foundation top-up", color: "--c-tier1", type: "bar", stack: "a", fmt: F.usd },
      ], total: "Booked", yFormat: F.usdAx, partLabel: "In progress", tipNote: (x) => (x.fee_modeled ? `Protocol fee that month, estimated: ${F.usd(x.fee_modeled)}` : "") }));
  }

  /* ---------- Redemptions ---------- */
  PAGES.redemptions = (view) => {
    const cover = ok(K.queue_pending_usd) && K.queue_pending_usd > 0 ? (K.vault_cash || 0) / K.queue_pending_usd : null;
    view.appendChild(intro(txt(`A holder asks to leave at any time and is paid on the next monthly date, oldest request first, from cash the vault holds. The vault does not call in loans to pay. Large holders file just before the date, so the money-weighted wait is days, not a month.`),
      [["Paid on " + dayOf(LP.d), M$(LP.usd), `${LP.wallets} wallets; top 10 took ${pct(LP.top10)}`], ["Queued for " + dayOf(K.next_redemption), M$(K.queue_pending_usd, 1), ok(cover) ? `Cash covers it ${Math.round(cover)} times` : ""], ["Largest single exit", M$((LP.largest || [{}])[0].usd, 1), "On " + dayOf(LP.d)]]));
    view.appendChild(grid(payoutChart(), topRedeemers()));
    view.appendChild(grid(queueChart()));
    view.appendChild(grid(payoutTable()));
  };
  function payoutChart() {
    const rows = PAY.map((p) => ({ ...p, d: p.d }));
    return chartFig({ slug: "payouts-chart", span: 8, title: `Two payouts, March and November, were ${pct((bigPay[0].usd + bigPay[1].usd) / d3.sum(PAY, (p) => p.usd))} of everything paid`, sub: "USDai paid to redeemers on each monthly payout date", basis: "onchain", conf: "high", src: "RedemptionsServiced and RedemptionProcessed events on sUSDai",
      csvCols: ["usd", "wallets", "top10", "wait_avg_days"], time: { rows, key: "d", def: "All", noRange: true } },
      (r) => ({ data: r, height: 260, period: "D", series: [{ key: "usd", label: "Paid out", color: "--c-sell", type: "bar", fmt: F.usd }], yFormat: F.usdAx,
        tipNote: (x) => `${x.wallets} wallets; top 10 took ${pct(x.top10)}; money-weighted wait ${ok(x.wait_avg_days) ? x.wait_avg_days.toFixed(0) + " days" : "–"}` }));
  }
  function queueChart() {
    const rows = D.filter((r) => r.d >= "2025-09-01" && r.unlent != null);
    return chartFig({ slug: "queue", span: 12, title: "Requests pile up just before each payout date", sub: "USDai waiting in the redemption queue each day, against the vault's assets that are not lent", basis: "onchain", conf: "medium", src: "Queue: RedeemRequest minus RedemptionProcessed shares × share price. Not lent: sUSDai assets less DefiLlama borrowed",
      csvCols: ["queue_usd", "unlent"], time: { rows, key: "d", def: "6M", agg: { queue_usd: "last", unlent: "last" } } },
      (r) => ({ data: r, height: 260, yMin: 0, series: [
        { key: "unlent", label: "Not lent (mostly cash)", color: "--c-float", type: "area", fmt: F.usd },
        { key: "queue_usd", label: "Waiting to be paid", color: "--c-sell", type: "line", width: 1.75, fmt: F.usd },
      ], yFormat: F.usdAx }));
  }
  function payoutTable() {
    const body = PAY.slice().reverse().map((p) => `<tr><td class="nowrap">${day(p.d)}</td><td class="r">${F.usd(p.usd)}</td><td class="r">${p.wallets}</td><td class="r">${pct(p.top10)}</td><td class="r hide-sm">${ok(p.wait_avg_days) ? p.wait_avg_days.toFixed(0) + " days" : "–"}</td></tr>`).join("");
    return staticFig({ slug: "payouts", span: 12, title: "Every monthly payout", sub: "Money-weighted wait runs from each request to its payment", basis: "onchain", conf: "high", src: "RedeemRequest and RedemptionProcessed events on sUSDai, matched by request id",
      menu: csvMenu("payouts", PAY.map((p) => ({ date: p.d, paid_usd: p.usd, wallets: p.wallets, top1: p.top1, top5: p.top5, top10: p.top10, wait_avg_days: p.wait_avg_days }))),
      body: `<div class="tw"><table class="t"><thead><tr><th>Paid</th><th class="r">Amount</th><th class="r">Wallets</th><th class="r">Top 10 share</th><th class="r hide-sm">Average wait</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function topRedeemers() {
    const box = h("<div></div>");
    const el = staticFig({ slug: "top-redeemers", span: 4, title: `The ten largest exits on ${dayOf(LP.d)}`, sub: "Wallets or contracts; some may be lending markets or vaults that hold sUSDai for others", basis: "onchain", conf: "high", src: "RedemptionProcessed events, controller address", body: box,
      menu: csvMenu("top_redeemers", (LP.largest || []).map((x) => ({ address: x.addr, usd: x.usd }))) });
    requestAnimationFrame(() => VC.hbars(box, { rows: (LP.largest || []).map((x) => ({ label: short(x.addr), value: x.usd, color: "--c-sell", note: x.addr })), fmt: F.usd, labelW: 100 }));
    return el;
  }

  /* ---------- CHIP ---------- */
  PAGES.chip = (view) => {
    view.appendChild(intro(txt(`CHIP votes on loan limits, eligible hardware and how the protocol's money is used, and gives no right to revenue. In practice one delegate, backed by Foundation and contributor wallets, casts almost every vote. ${W.chipMove()} ${W.vsBuyback()}`),
      [["Price", chipP(K.chip_price), "Close, " + dayOf(AS_OF)], ["Circulating", bn(K.chip_circ), "of 10B CHIP"], ["Highest close", chipP(K.chip_ath_close), dayOf(K.chip_ath_close_date) + "; intraday " + chipP(K.chip_ath)]]));
    view.appendChild(grid(chipChart()));
    view.appendChild(band(["Buybacks against unlocks", "What the 10% fee can buy, against the CHIP that becomes sellable."], grid(unlockChart(), buybackFacts()), grid(calcBuyback())));
    view.appendChild(band(["Trading and staking", "Where CHIP trades and how much of it is staked."], grid(volumeChart(), stakedChart())));
  };
  function chipChart() {
    const rows = rowsWith("chip_price");
    return chartFig({ slug: "chip-price", span: 12, events: true, eventsBelow: true, readout: "chip_price", readoutFmt: chipP, returns: "chip_price", compare: true, title: `CHIP closed at ${pct(K.chip_price / K.chip_ath_close)} of its highest close`, sub: "Daily close in USD; with \"vs BTC\" both are set to 100 at the start of the range", basis: "thirdparty", src: "CoinGecko (chip-2, bitcoin)",
      csvCols: ["chip_price", "chip_mcap", "chip_vol", "btc_price"], time: { rows, key: "d", def: "All", agg: { chip_price: "last", chip_mcap: "last", chip_vol: "sum", btc_price: "last" } } },
      (r, g, ctx) => {
        const events = evs((e) => ["2026-04-21", "2026-10-19", "2026-10-26", "2026-11-01"].includes(e.d));
        if (ctx.cmp) {
          const p0 = (r.find((x) => x.chip_price != null) || {}).chip_price, b0 = (r.find((x) => x.btc_price != null) || {}).btc_price;
          const ix = r.map((x) => ({ ...x, c_ix: x.chip_price != null ? (x.chip_price / p0) * 100 : null, b_ix: x.btc_price != null && b0 ? (x.btc_price / b0) * 100 : null }));
          const f = (v) => (v == null ? "–" : (v >= 100 ? "+" : MINUS) + Math.abs(v - 100).toFixed(1) + "%");
          return { data: ix, height: 320, yMin: "auto", series: [{ key: "c_ix", label: "CHIP", color: "--c-lead", type: "line", fmt: f, width: 1.75 }, { key: "b_ix", label: "BTC", color: "--c-cmp", type: "line", fmt: f }], yFormat: (v) => v.toFixed(0), events };
        }
        const span = d3.extent(r, (x) => x.chip_price), fine = span[1] - span[0] < 0.05;
        return { data: r, height: 320, endLabel: true, yMin: "auto", series: [
          { key: "chip_price", label: "CHIP", color: "--c-lead", type: "line", fmt: chipP, width: 1.75 },
          { key: "chip_mcap", label: "Market cap", color: "--c-lead", type: "line", noLine: true, noLegend: true, fmt: F.usd },
        ], yFormat: (v) => "$" + v.toFixed(fine ? 3 : 2), events };
      });
  }
  function unlockChart() {
    const rows = (V.unlocks || []).map((u) => ({ ...u, d: u.m + "-01" }));
    return chartFig({ slug: "unlocks", span: 8, title: `By April 2029 the fee buys ${pct((rows[rows.length - 1] || {}).fee_chip / (rows[rows.length - 1] || {}).cum_chip)} of the CHIP that unlocks`, sub: "Cumulative CHIP that becomes sellable (Season 2 airdrop, then investors, contributors and reserve) against cumulative CHIP the fee buys, both at today's price", basis: "modeled", src: "Schedule: 12-month cliff from the Apr 21, 2026 launch, 33% then 24 monthly steps (USD.AI docs); investors 29.6%, contributors 23.1%, reserve 19.8% (docs' tokenomics images). Season 2: 225M CHIP (October recap). Later ecosystem rewards are not shown",
      csvCols: ["s2", "unlock", "cum_chip", "fee_chip", "cum_fee"], time: { rows, key: "m", def: "All", noRange: true } },
      (r) => ({ data: r, height: 280, yMin: 0, series: [
        { key: "cum_chip", label: "CHIP unlocked since Nov 2026", color: "--c-sell", type: "area", fmt: (v) => bn(v) + " CHIP" },
        { key: "fee_chip", label: "CHIP the fee buys", color: "--c-buy", type: "area", fmt: (v) => C(v) + " CHIP" },
      ], yFormat: (v) => (v / 1e9).toFixed(1) + "B", tipNote: (x) => `${F.usd(x.cum_chip * (K.chip_price || 0))} unlocked against ${F.usd(x.cum_fee)} of fee` }));
  }
  function buybackFacts() {
    const rows = [
      ["Fee, last 30 days", M$(FEE30), "DefiLlama revenue, loan-origination days removed"],
      ["Fee, last 12 months", M$(K.fee_12m, 1), "On-chain estimate: admin fee on reserve yield plus 10% of loan and escrow interest"],
      ["Loan origination fees, 12 months", M$(K.orig_fees_12m, 1), "Kept by the company under the proposal"],
      ["Fee as share of market cap", pct(K.buyback_yield_on_mcap, 1), "Last 30 days × 12 ÷ market cap"],
      ["Each monthly unlock after April", M$(K.unlock_monthly_usd, 1), `${C(K.unlock_monthly_chip)} CHIP at today's price`],
      ["October 26 buyback", "$1.0M", "22.3M CHIP at $0.0448, bought on exchanges by USD.AI Inc., delivered to Safe 0xcd9C…97c8; not from the fee"],
    ];
    return staticFig({ slug: "buyback-facts", span: 4, title: "The buyback in numbers", sub: "At today's CHIP price", basis: "mixed", src: "DefiLlama; Arbitrum; CoinGecko; usd.ai October recap",
      body: `<table class="kv" style="margin:4px 0"><tbody>${rows.map(([l, v, d]) => `<tr><td><span class="lab">${l}</span><span class="def">${d}</span></td><td class="v">${v}</td></tr>`).join("")}</tbody></table>` });
  }
  const setFill = (inp) => inp.style.setProperty("--fill", ((inp.value - inp.min) / (inp.max - inp.min)) * 100 + "%");
  // What would it take for the fee to absorb the unlocks? Deposits and gross yield set the fee; the fee buys CHIP at the
  // chosen price; the chart beside it accumulates both to April 2029.
  function calcBuyback() {
    const st = (ST["calc-buyback"] = ST["calc-buyback"] || {});
    const dep0 = Math.round((K.vault_nav || 4e8) / 1e6), gy0 = Math.round(((K.apy_30d || 0.07) / 0.9) * 1000) / 10, p0 = Math.round((K.chip_price || 0.03) * 10000) / 10000;
    const el = staticFig({ slug: "calc-buyback", span: 12, title: "How big must USD.AI get for buybacks to keep up?", sub: "The fee is 10% of gross yield and all of it buys CHIP. Today's gross yield is the 30-day holder yield ÷ 0.9", basis: "modeled", src: "Model on this page's figures; spending the whole fee on CHIP is a proposal, not a governance decision",
      body: `<div class="calc"><div class="ctrl">
        <label><span class="lv">sUSDai deposits <b data-o="c1"></b></span><input data-i="c1" type="range" min="100" max="5000" step="1" value="${st.c1 ?? dep0}"></label>
        <div class="presets" role="group" aria-label="Scenarios">${[["Today", dep0], ["$1B", 1000], ["$2.5B", 2500], ["$5B", 5000]].map(([l, v]) => `<button type="button" data-g="${v}">${l}</button>`).join("")}</div>
        <label><span class="lv">Gross yield on deposits <b data-o="c2"></b></span><input data-i="c2" type="range" min="4" max="14" step="0.1" value="${st.c2 ?? gy0}"></label>
        <label><span class="lv">CHIP price <b data-o="c3"></b></span><input data-i="c3" type="range" min="0.005" max="0.15" step="0.0001" value="${st.c3 ?? p0}"></label>
      </div><div class="out"><div class="res" aria-live="polite"><div><div class="l">Fee a year</div><div class="v" data-o="r1"></div></div><div><div class="l">Share of each monthly unlock bought</div><div class="v" data-o="r2"></div></div><div><div class="l">Time to buy the April cliff</div><div class="v" data-o="r3"></div></div></div><div class="cchart"></div>
      <div class="hint">USD.AI's own target is $20M to $40M of revenue a year per $1B of deposits, counting origination fees and loan sales, which the proposal keeps for the company.</div></div></div>` });
    const o = (k) => el.querySelector(`[data-o="${k}"]`), inp = (k) => el.querySelector(`[data-i="${k}"]`), i = (k) => +inp(k).value;
    const run = () => {
      st.c1 = i("c1"); st.c2 = i("c2"); st.c3 = i("c3"); saveST();
      el.querySelectorAll("input[type=range]").forEach(setFill);
      const today = i("c1") === dep0 && Math.abs(i("c2") - gy0) < 0.05 && Math.abs(i("c3") - p0) < 0.00005;
      el.querySelectorAll(".presets button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.g === i("c1") && (b.textContent !== "Today" || today))));
      const dep = i("c1") * 1e6, gy = i("c2") / 100, p = i("c3");
      o("c1").textContent = dep >= 1e9 ? "$" + (dep / 1e9).toFixed(2) + "B" : "$" + (dep / 1e6).toFixed(0) + "M"; o("c2").textContent = (gy * 100).toFixed(1) + "%"; o("c3").textContent = chipP(p);
      const fee = dep * gy * 0.1, share = fee / 12 / (K.unlock_monthly_chip * p);
      o("r1").textContent = M$(fee, 1);
      o("r2").textContent = share > 1 ? "All of it" : pct(share);
      o("r3").textContent = yrs((K.unlock_cliff_chip * p) / (fee / 12));
      let cb = 0; const pts = (V.unlocks || []).map((u) => { cb += fee / 12 / p; return { d: u.m + "-01", unl: u.cum_chip, buy: cb }; });
      VC.timeChart(el.querySelector(".cchart"), { data: pts, period: "M", height: 220, yMin: 0, series: [
        { key: "unl", label: "CHIP unlocked", color: "--c-sell", type: "line", fmt: (v) => bn(v) },
        { key: "buy", label: "CHIP bought", color: "--c-buy", type: "line", fmt: (v) => bn(v) },
      ], yFormat: (v) => (v / 1e9).toFixed(1) + "B", tipDate: (d) => VC.fmtMon(d) });
    };
    el.querySelectorAll("input").forEach((x) => x.addEventListener("input", run));
    el.querySelectorAll(".presets button").forEach((b) => b.addEventListener("click", () => { inp("c1").value = b.dataset.g; if (b.textContent === "Today") { inp("c2").value = gy0; inp("c3").value = p0; } run(); }));
    requestAnimationFrame(run);
    return el;
  }
  function volumeChart() {
    const rows = rowsWith("chip_vol");
    return chartFig({ slug: "chip-volume", span: 6, title: "Trading volume", sub: "CHIP traded per day across venues, USD", basis: "thirdparty", src: "CoinGecko",
      csvCols: ["chip_vol"], time: { rows, key: "d", def: "All", agg: { chip_vol: "sum" }, bars: true } },
      (r) => ({ data: r, height: 240, series: [{ key: "chip_vol", label: "Volume", color: "--c-lead", type: "bar", fmt: F.usd }], yFormat: F.usdAx }));
  }
  function stakedChart() {
    const rows = rowsWith("schip_staked").filter((r) => r.d >= "2026-04-15");
    return chartFig({ slug: "schip", span: 6, title: `${C(K.schip_staked_now)} CHIP is staked, ${pct((K.schip_staked_now || 0) / 1e10, 2)} of supply`, sub: "CHIP in the sCHIP contract: a 1:1 wrapper with no lock, no slashing and no yield. It peaked at 55.5M on Sep 23 and fell when Season 3 stopped paying points on it", basis: "onchain", conf: "high", src: "sCHIP Deposit and Withdraw events on Arbitrum",
      csvCols: ["schip_staked"], time: { rows, key: "d", def: "All", agg: { schip_staked: "last" } } },
      (r) => ({ data: r, height: 240, yMin: 0, series: [{ key: "schip_staked", label: "CHIP staked", color: "--c-lead", type: "area", fmt: (v) => C(v) + " CHIP" }], yFormat: (v) => C(v) }));
  }

  /* ---------- Valuation ---------- */
  PAGES.valuation = (view) => {
    const me = (V.peers || []).find((p) => p.self) || {};
    const maple = (V.peers || []).find((p) => p.name === "Maple") || {};
    const mYears = lastNum("mcap_years_fee");
    view.appendChild(intro(txt(`CHIP is priced like a claim on a lender's fees, though it carries no right to them. Per dollar it manages, its fully diluted value is ${ok(me.fdv_size) && ok(maple.fdv_size) ? Math.round(me.fdv_size / maple.fdv_size) + " times" : "–"} Maple's. In January Pine Analytics called the launch price rich; the FDV has since fallen ${pct(1 - K.chip_fdv / 3e8)} below that $300M launch value.`),
      [["FDV per $1 in sUSDai", ok(lastNum("fdv_per_dollar")) ? "$" + lastNum("fdv_per_dollar").toFixed(2) : "–", "Maple: $" + (maple.fdv_size || 0).toFixed(3)], ["Market cap in years of fee", ok(mYears) ? mYears.toFixed(0) + " years" : "–", "At the last 30 days' fee"], ["FDV against launch", pct(K.chip_fdv / 3e8 - 1), "$300M at launch (Pine Analytics)"]]));
    view.appendChild(grid(fdvChart(), yearsChart()));
    view.appendChild(grid(scenarioFig()));
    view.appendChild(grid(peersFig()));
    view.appendChild(grid(caseFig()));
  };
  const lastNum = (k) => { for (let i = D.length - 1; i >= 0; i--) if (D[i][k] != null) return D[i][k]; return null; };
  function fdvChart() {
    const rows = rowsWith("fdv_per_dollar");
    return chartFig({ slug: "fdv-per-dollar", span: 6, title: "CHIP's FDV per dollar in the vault", sub: "Fully diluted value ÷ sUSDai assets, daily", basis: "mixed", src: "CoinGecko price × 10B CHIP; sUSDai assets from Arbitrum",
      csvCols: ["fdv_per_dollar", "fdv", "susdai_assets"], time: { rows, key: "d", def: "All", agg: { fdv_per_dollar: "last" } } },
      (r) => ({ data: r, height: 240, yMin: 0, series: [{ key: "fdv_per_dollar", label: "FDV ÷ sUSDai assets", color: "--c-lead", type: "line", width: 1.75, fmt: (v) => "$" + v.toFixed(2) }], yFormat: (v) => "$" + v.toFixed(1) }));
  }
  function yearsChart() {
    const rows = rowsWith("mcap_years_fee").filter((r) => r.d >= "2026-06-01");   // launch weeks: fee near zero, ratio meaningless
    return chartFig({ slug: "years-of-fee", span: 6, title: "Market cap in years of the 10% fee", sub: "CHIP market cap ÷ (last 30 days of fee × 12), daily; loan-origination days removed", basis: "mixed", src: "CoinGecko; DefiLlama revenue",
      csvCols: ["mcap_years_fee", "chip_mcap", "fee_30d"], time: { rows, key: "d", def: "All", agg: { mcap_years_fee: "last" } } },
      (r) => ({ data: r, height: 240, yMin: 0, series: [{ key: "mcap_years_fee", label: "Years of fee", color: "--c-lead", type: "line", width: 1.75, fmt: (v) => v.toFixed(0) + " years" }], yFormat: (v) => v.toFixed(0) }));
  }
  function scenarioFig() {
    const deps = [K.vault_nav, 1e9, 2.5e9, 5e9], prices = [0.013, K.chip_price, 0.044756, 0.14];
    const gy = (K.apy_30d || 0.07) / 0.9;
    const cell = (dep, p) => { const s = (dep * gy * 0.1) / 12 / (K.unlock_monthly_chip * p); return s >= 1 ? "All" : pct(s); };
    const body = deps.map((dep, i) => `<tr${i === 0 ? ' class="hl"' : ""}><td><b>${M$(dep)}</b>${i === 0 ? ' <span class="muted">today</span>' : ""}</td>${prices.map((p, j) => `<td class="r${j === 1 && i === 0 ? " now" : ""}">${cell(dep, p)}</td>`).join("")}</tr>`).join("");
    return staticFig({ slug: "scenarios", span: 12, title: "Share of each monthly unlock the fee could buy", sub: `Rows: sUSDai deposits. Columns: CHIP price. Gross yield ${pct(gy, 1)}, 10% fee, all of it spent on CHIP; ${C(K.unlock_monthly_chip)} CHIP unlock each month after April 2027`, basis: "modeled", src: "Model on this page's figures",
      body: `<div class="tw"><table class="t grid4"><thead><tr><th>Deposits</th>${prices.map((p, j) => `<th class="r">${chipP(p)}<span class="sub-n">${["half today", "today", "Oct 28 buyback", "all-time high"][j]}</span></th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function peersFig() {
    const x2 = (v) => (!ok(v) ? "–" : v < 0.1 ? v.toFixed(3) + "×" : v < 10 ? v.toFixed(2) + "×" : Math.round(v) + "×");
    const ps = V.peers || [];
    const me = ps.find((p) => p.self) || {}, maple = ps.find((p) => p.name === "Maple") || {};
    const body = ps.map((p) => `<tr class="${p.self ? "hl" : ""}"><td><b>${esc(p.name)}</b> <span class="muted">${esc(p.token)}</span><span class="sub-n">${esc(p.note)}</span></td><td class="r">${p.size ? F.usd(p.size) : "–"}</td><td class="r">${F.usd(p.mcap)}</td><td class="r hide-sm">${F.usd(p.fdv)}</td><td class="r hide-sm">${F.usd(p.fees_yr)}</td><td class="r hide-sm">${F.usd(p.rev_yr)}</td><td class="r"><b>${x2(p.fdv_size)}</b></td><td class="r">${p.name === "Ethena" ? '<span class="muted">n/c</span>' : x2(p.mcap_rev)}</td></tr>`).join("");
    return staticFig({ slug: "peers", span: 12, title: ok(me.fdv_size) && ok(maple.fdv_size) ? `CHIP's FDV per dollar managed is ${Math.round(me.fdv_size / maple.fdv_size)} times Maple's` : "CHIP next to other lending tokens", sub: "Size is deposits plus loans outstanding (USD.AI: USDai issued plus loans). Yield generated is DefiLlama's fees; the protocol's cut is its revenue. Last 30 days × 12", basis: "thirdparty", src: `DefiLlama; CoinGecko, ${day(AS_OF)}`,
      menu: csvMenu("peers", ps.map((p) => ({ name: p.name, token: p.token, size: p.size, mcap: p.mcap, fdv: p.fdv, fees_yr: p.fees_yr, rev_yr: p.rev_yr, fdv_size: p.fdv_size, mcap_rev: p.mcap_rev }))),
      body: `<div class="tw"><table class="t peers"><thead><tr><th>Protocol</th><th class="r">Size</th><th class="r">Market cap</th><th class="r hide-sm">FDV</th><th class="r hide-sm">Yield a year</th><th class="r hide-sm">Protocol's cut</th><th class="r">FDV ÷ size</th><th class="r">Market cap ÷ cut</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }
  function caseFig() {
    // for an argument against, "holds today" is bad news, so the colour follows the side, not the word
    const yes = (b, side) => `<span class="st ${(b ? side === "for" : side !== "for") ? "st-up" : "st-down"}">${b ? "Holds today" : "Not today"}</span>`;
    const rows = [
      ["for", "The loans pay", `Borrowers have paid the vault ${M$(K.loan_interest_total, 1)} of interest; neither router shows a breach or liquidation event.`, "A LoanBreached or LoanLiquidated event", true],
      ["for", "A large loan came back in full", `The Duos Edge AI loan was repaid in full (${M$(K.sale_principal)}) on Oct 1 when Axe Compute bought the borrower's company. USD.AI calls it GLX's first season-and-sell; a sale to an outside lender has not yet been shown on-chain.`, "A sale below par, or no true GLX sale", true],
      ["against", "A borrower warns it may not survive", "QumulusAI, on three loans, reported going-concern doubt in its 10-Q (Nov 10, 2026).", "QumulusAI refinances or raises capital", true],
      ["for", "GPU rents are rising", "H100 rents up about 17% and B300 more than doubled since July (thelearningpill, Nov 4), which helps borrowers pay.", "Rental indexes falling below loan-era levels", true],
      ["against", "CHIP has no claim on anything", "The Foundation's terms say CHIP gives no right to revenue; the buyback was a company purchase and the fee routing is a proposal.", "A passed vote that routes the fee to CHIP on-chain", true],
      ["against", "Governance is one delegate", "Both October votes passed 100% with 3 voters; one delegate cast 99.998% of the votes, with power delegated from the reserve and contributor wallets. Lockups are promises: insider tokens sit in ordinary wallets.", "Independent delegates and on-chain vesting", true],
      ["against", "The unlock dwarfs the fee", `${M$(unlockUSD)} of CHIP unlocks in April 2027 against ${M$(feeYr, 1)} a year of fee.`, "Several times today's deposits, or a later schedule", true],
      ["against", "Few borrowers, a few big depositors", `Two borrowers hold ${pct(K.top2_live_share)} of live loans; ten wallets took ${pct(LP.top10)} of the last payout.`, "More borrowers; payouts spread across more wallets", true],
      ["against", "Part of the yield is PayPal's, and may end", "The PYUSD incentive pays 4.5% on idle cash and ends on Mar 1, 2027 or at $1B, whichever comes first (LlamaRisk). It is about 1.6 of the 8 gross yield points.", "A renewal announcement, or loan interest alone above 7%", true],
      ["against", "Organic yield is below the 7% promise", `Organic yield is ${pct(K.apy_30d_ex, 1)}; topping up to 7% at that rate costs about ${M$(K.vault_nav * Math.max(0, 0.07 - K.apy_30d_ex))} a year, most of the fee the proposal would send to CHIP.`, "Organic yield back above 7%", K.apy_30d_ex < 0.07],
      ["against", "GPUs lose value fast", "Collateral depreciates about 20% a year (Blockmedia) while loans amortize over three years.", "Resale prices for B200/B300 holding up", true],
    ];
    const body = ["for", "against"].map((side) => `<tr class="grp"><th colspan="3" scope="colgroup">${side === "for" ? "For USD.AI and CHIP" : "Against"}</th></tr>${rows.filter((r) => r[0] === side).map((r) => `<tr><td><b>${r[1]}</b><div class="ev">${r[2]}</div></td><td>${r[3]}</td><td>${yes(r[4], r[0])}</td></tr>`).join("")}`).join("");
    return staticFig({ slug: "case", span: 12, title: "The case, with what would change it", sub: "Each argument, the event that would make us drop it, and whether the data supports it today", src: "This page's data; Pine Analytics (Jan 28, 2026); Blockmedia (Aug 1); thelearningpill (Nov 4); USD.AI blog", body: `<div class="tw"><table class="t checks"><thead><tr><th>Argument and evidence</th><th>Would change our mind</th><th>Today</th></tr></thead><tbody>${body}</tbody></table></div>` });
  }

  /* ---------- Method ---------- */
  PAGES.method = (view) => {
    view.appendChild(intro(txt("Where every number comes from, how it is checked, and what we could not measure. The same series are written as Allium SQL at the end, ready to run in the Terminal.")));
    const sec = (id, t, html) => h(`<section class="band" id="${id}"><header class="band-h"><h2>${t}</h2></header><div class="card doc-card mdoc">${html}</div></section>`);
    const contracts = Object.entries(META.contracts || {}).map(([k, a]) => `<tr><td>${k}</td><td>${addrLink(a, short(a))} ${copyBtn(a, k)}</td></tr>`).join("");
    const nav = RPC.vault_nav, diff = ok(nav) && ok(K.susdai_assets) ? Math.abs(K.susdai_assets / nav - 1) : null;
    const checks = [
      ["sUSDai assets", M$(K.susdai_assets, 2), "Vault nav()", M$(nav, 2), ok(diff) ? pct(diff, 2) : "–"],
      ["sUSDai shares", ((K.susdai_supply || 0) / 1e6).toFixed(2) + "M", "totalShares()", ((K.vault_shares || 0) / 1e6).toFixed(2) + "M", ok(K.vault_shares) ? pct(Math.abs(K.susdai_supply / K.vault_shares - 1), 2) : "–"],
      ["Lent or in escrow (DefiLlama)", M$(K.lent, 2), "Vault loans + escrow", M$(lentNow, 2), lentNow ? pct(Math.abs(K.lent / lentNow - 1), 2) : "–"],
    ];
    view.appendChild(sec("m-checks", "Checking against the contracts", `<div class="tw"><table class="t"><thead><tr><th>Our figure</th><th class="r">Value</th><th>Contract says</th><th class="r">Value</th><th class="r">Gap</th></tr></thead><tbody>${checks.map((c) => `<tr><td>${c[0]}</td><td class="r">${c[1]}</td><td>${c[2]}</td><td class="r">${c[3]}</td><td class="r">${c[4]}</td></tr>`).join("")}</tbody></table></div><p class="note">Contract read at block ${RPC.block || "–"}, ${timeUTC(RPC.read_utc)} UTC. The build fails if a gap exceeds 1%.</p>`));
    view.appendChild(sec("m-sources", "Sources", `<dl class="defs">
      <dt>Arbitrum event logs</dt><dd>sUSDai deposits, redemption requests and payouts, reserve-yield deposits with the admin fee, escrow, donations; Loan Router v1 and v2 originations, repayments and refinances; CHIP and sCHIP. Pulled with Envio HyperSync, decoded with the contracts' verified ABIs (Sourcify).</dd>
      <dt>Live contract reads</dt><dd>The vault's assets, cash, loans, escrow, share prices and queue, read through a public Arbitrum RPC.</dd>
      <dt>DefiLlama</dt><dd>Loans outstanding ("borrowed") history, fees and revenue, Pendle's PT-sUSDai pool, peer protocols.</dd>
      <dt>CoinGecko</dt><dd>CHIP and BTC prices, market caps and volumes; peer token prices.</dd>
      <dt>USD.AI</dt><dd>Docs and blog for rules and events (the 10% fee, the 7% hurdle, the buyback, GLX). Their own figures are marked "reported".</dd></dl>`));
    view.appendChild(sec("m-defs", "Definitions", `<dl class="defs">
      <dt>sUSDai assets</dt><dd>Shares issued by deposits less shares redeemed, times the deposit share price.</dd>
      <dt>Holder yield, 30 days</dt><dd>The change in the deposit share price over 30 days, annualized without compounding, after the 10% fee. "Without the top-up" removes the Nov 1 donation's step from the price.</dd>
      <dt>Protocol fee</dt><dd>10% of sUSDai yield. Last 30 days: DefiLlama's revenue with the days of loan-origination fees removed. Twelve months: the admin fee recorded on each reserve-yield deposit plus one ninth of the loan and escrow interest the vault received.</dd>
      <dt>Loan amounts</dt><dd>v1 loans were made in PYUSD or USDC (6 decimals), v2 loans in USDai (18); the events do not name the token, so amounts are scaled by size. Two test loans ($5, $1) are left out.</dd>
      <dt>Loan Router v2</dt><dd>0x1c2e…e12f is not in USD.AI's published address list. The 17 loans still open on v1 moved to it between June 26 and July 3, 2026; payments before and after the move are added together.</dd>
      <dt>Loan payoff</dt><dd>A loan whose whole principal comes back on one day is shown separately; only the Duos Edge AI loan (Oct 1, 2026) qualifies. USD.AI presented it as a GLX sale; filings by Duos and Axe Compute show the borrower's buyer repaid it.</dd>
      <dt>Borrower names</dt><dd>Matched to SEC filings, the Proof of Loans attestation (Jul 15, 2026) and USD.AI's posts by exact amount, hardware and site. The $128.9M escrow facility matches HIVE Digital's filings by size, rate (9%), hardware and site; the lender is not named there, so that match is inferred.</dd>
      <dt>Unlocks</dt><dd>Modeled from the docs' tokenomics images: investors (29.6%), contributors (23.1%) and the Foundation reserve (19.8%) unlock 33% after a 12-month cliff from the April 21, 2026 launch, then monthly over 24 months. Our earlier figure of 1.75B left the reserve out; an X thread's 2.76B adds ecosystem emissions.</dd></dl>`));
    view.appendChild(sec("m-limits", "What we could not measure", `<ul>
      <li>Borrower names beyond the two that match an announcement by size and date.</li>
      <li>Loans after a GLX sale, and anything off-chain: insurance, the borrowers' companies, escrow accounts.</li>
      <li>sUSDai and CHIP holdings on Ethereum, Base, Plasma and Solana, beyond the bridged share count.</li>
      <li>Which of the largest redeemers are lending markets or vaults rather than end holders.</li></ul>`));
    const sql = (window.USDAI_SQL || []).map((q) => `<details class="sqlq"><summary><b>${esc(q.title)}</b> <span class="muted">${esc(q.name)}</span></summary><div class="sqlwrap">${copyBtn(q.sql, q.name)}<pre><code>${esc(q.sql)}</code></pre></div></details>`).join("");
    if (sql) view.appendChild(sec("m-sql", "Run it in Allium", `<p class="note">Snowflake SQL against Allium's Arbitrum tables. Drafts: not yet run inside Allium; column names may need a check.</p>${sql}`));
    view.appendChild(sec("m-contracts", "Contracts (Arbitrum)", `<div class="tw"><table class="t"><tbody>${contracts}</tbody></table></div>`));
  };

  // first render: no slide, charts draw in as they come into view
  if (q.get("tab") && q.get("tab") !== tab) writeURL();
  syncChrome(); moveInk(false);
  build(true);
  scrollToHash();
})();
