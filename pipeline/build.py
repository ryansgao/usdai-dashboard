# /// script
# requires-python = ">=3.11"
# dependencies = ["pycryptodome", "eth-abi"]
# ///
"""Every number on the page: data/raw/ -> site/data/data.js (window.USDAI) + CSV downloads.

Day boundaries are UTC. A figure is "as of" the last complete UTC day (META.as_of). Money is in USD; USDai,
PYUSD and USDC are counted at $1 (USDai is fully backed by PYUSD; the page says so).

Decimals: v1 loans were made in PYUSD/USDC (6 decimals), v2 loans in USDai (18). Router events do not carry the
token, so amounts are scaled by size: a raw value above 1e15 is an 18-decimal amount (1e15 in 6 decimals would be
a $1B single payment). See amt().
"""
import collections, csv, datetime as dt, gzip, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import decode  # noqa: E402
from peers import PEERS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
SITE = os.path.join(ROOT, "site")
SEC_YR = 365 * 86400
VAULT = "0x0b2b2b2076d95dda7817e785989fe353fe955ef9"
ZERO = "0x" + "0" * 40

CONTRACTS = {
    "USDai": "0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF",
    "sUSDai": "0x0B2b2B2076d95dda7817e785989fE353fe955ef9",
    "CHIP": "0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e",
    "sCHIP": "0x0D2d2D20962F2468566F4D1a4DdeB482915C4D4A",
    "Loan Router v1": "0x0C2ED170F2bB1DF1a44292Ad621B577b3C9597D1",
    "Loan Router v2": "0x1c2ed170de32846316784c4fd58a5e3c7563e12f",
}


def J(rel):
    p = os.path.join(RAW, rel)
    return json.load(open(p)) if os.path.exists(p) else None


def day(ts):
    return dt.datetime.fromtimestamp(ts, dt.UTC).strftime("%Y-%m-%d")


def amt(v):
    v = int(v)
    return v / 1e18 if v > 1e15 else v / 1e6


def rate_yr(per_sec):
    """Router / vault rates are per second, scaled 1e18."""
    return per_sec * SEC_YR / 1e18


def r2(x, n=2):
    return None if x is None else round(x, n)


# ---------------------------------------------------------------- load
manifest = J("manifest.json") or {}
state = J("chain/state.json") or {}
TODAY = dt.datetime.now(dt.UTC).date()
AS_OF = (TODAY - dt.timedelta(days=1)).isoformat()  # last complete UTC day

S = decode.rows("susdai")
L1 = decode.rows("loans")
L2 = decode.rows("loans2")
U = decode.rows("usdai")
CH = decode.rows("chip")
SC = decode.rows("schip")

daily = collections.defaultdict(dict)   # d -> fields
monthly = collections.defaultdict(lambda: collections.defaultdict(float))


def add(d, k, v):
    daily[d][k] = daily[d].get(k, 0.0) + v


def madd(d, k, v):
    monthly[d[:7]][k] += v


# ---------------------------------------------------------------- sUSDai vault
price_by_day = {}
supply_delta = collections.defaultdict(float)
depositors = collections.defaultdict(set)
req_by_id = {}
waits = []                      # (request day, processed day, days, usd)
redeemers_by_payout = collections.defaultdict(lambda: collections.defaultdict(float))
dep_by_owner = collections.defaultdict(float)
red_by_owner = collections.defaultdict(float)
for r in S:
    d = day(r["ts"])
    ev = r["event"]
    if ev == "Deposit":
        a, s = r["assets"] / 1e18, r["shares"] / 1e18
        if s > 1 and a > 1:
            price_by_day[d] = a / s
        add(d, "deposits", a); madd(d, "deposits", a)
        supply_delta[d] += s
        depositors[d[:7]].add(r["owner"])
        dep_by_owner[r["owner"]] += a
    elif ev == "Transfer":
        pass   # mint/burn here includes OFT bridging (burned on Arbitrum, minted elsewhere): not used for supply
    elif ev == "RedeemRequest":
        req_by_id[r["requestId"]] = r
        add(d, "redeem_req_shares", r["shares"] / 1e18)
        add(d, "q_in", r["shares"] / 1e18)
        madd(d, "redeem_req_shares", r["shares"] / 1e18)
    elif ev == "RedemptionProcessed":
        a = r["amount"] / 1e18
        red_by_owner[r["controller"]] += a
        add(d, "q_out", r["fulfilledShares"] / 1e18)
        redeemers_by_payout[d][r["controller"]] += a
        q = req_by_id.get(r["redemptionId"])
        if q and a > 0:
            waits.append((day(q["ts"]), d, (r["ts"] - q["ts"]) / 86400, a))
    elif ev == "RedemptionsServiced":
        a = r["amount"] / 1e18
        add(d, "redeemed", a); madd(d, "redeemed", a)
        supply_delta[d] -= r["shares"] / 1e18
    elif ev == "BaseYieldDeposited":
        a, f = r["depositedAmount"] / 1e18, r["adminFee"] / 1e18
        madd(d, "base_yield", a); madd(d, "fee_base", f)
    elif ev == "Donated":
        madd(d, "donation", r["usdaiAmount"] / 1e18)
        add(d, "donation", r["usdaiAmount"] / 1e18)
    elif ev in ("LoanEscrowTimelockWithdrawn", "LoanEscrowTimelockCancelled", "LoanEscrowTimelockInterestRepaid"):
        madd(d, "escrow_interest", amt(r["interestAmount"]) if amt(r["interestAmount"]) > 1 else 0)

# ---------------------------------------------------------------- loans
loans = {}       # hash -> record
borrowers = set()


def loan_rec(h, **kw):
    rec = loans.setdefault(h, {"hash": h, "router": None, "start": None, "borrower": None, "principal": None,
                               "vault_principal": None, "rate": None, "term_days": None, "status": "active",
                               "currency": None, "interest_paid": 0.0, "principal_paid": 0.0, "events": []})
    rec.update({k: v for k, v in kw.items() if v is not None})
    return rec


TOKENS = {"0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC", "0x46850ad61c2b7d64d08c9c754f45254596696984": "PYUSD",
          "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef": "USDai"}
for r in L1:
    d = day(r["ts"])
    if r["event"] == "LoanOriginated":
        loan_rec(r["loanTermsHash"], router="v1", start=d, borrower=r["borrower"], principal=amt(r["principal"]),
                 currency=TOKENS.get(r["currencyToken"], r["currencyToken"]))
        borrowers.add(r["borrower"])
    elif r["event"] == "LoanMigratedOut":
        loan_rec(r["loanTermsHash"], status="moved to v2", moved=d)
    elif r["event"] == "LoanRepaid":
        x = loan_rec(r["loanTermsHash"])
        x["interest_paid"] += amt(r["interest"]); x["principal_paid"] += amt(r["principal"]) + amt(r["prepayment"])
        if r["isRepaid"]:
            x["status"] = "repaid"; x["end"] = d
for r in L2:
    d = day(r["ts"])
    if r["event"] == "LoanOriginated":
        t = decode.loan_terms(r["loanTerms"])
        tr = [x for x in t["trancheSpecs"] if x["amount"] > 1e21]           # drop the 1-token placeholder tranche
        tot = sum(x["amount"] for x in tr) / 1e18
        vt = [x for x in tr if x["lender"].lower() == VAULT]
        loan_rec(r["loanTermsHash"], router="v2", start=d, borrower=t["borrower"], principal=tot,
                 vault_principal=sum(x["amount"] for x in vt) / 1e18,
                 rate=rate_yr(vt[0]["rate"]) if vt else None, term_days=t["repaymentSpec"]["totalDurationDays"],
                 currency=TOKENS.get(t["currencyToken"].lower(), t["currencyToken"]))
        borrowers.add(t["borrower"].lower())
    elif r["event"] == "LoanRefinanced":
        old = loan_rec(r["oldLoanTermsHash"]); old["status"] = "refinanced"; old["end"] = d
        t = decode.loan_terms(r["newLoanTerms"])
        tr = [x for x in t["trancheSpecs"] if x["amount"] > 1e21 or x["amount"] > 1e9 and x["amount"] < 1e15]
        vt = [x for x in tr if x["lender"].lower() == VAULT]
        loan_rec(r["newLoanTermsHash"], router="v2", start=d, borrower=t["borrower"],
                 principal=sum(amt(x["amount"]) for x in tr), vault_principal=sum(amt(x["amount"]) for x in vt),
                 rate=rate_yr(vt[0]["rate"]) if vt else None, term_days=t["repaymentSpec"]["totalDurationDays"],
                 currency=TOKENS.get(t["currencyToken"].lower(), t["currencyToken"]), refi_of=r["oldLoanTermsHash"])
    elif r["event"] == "LoanRepaid":
        x = loan_rec(r["loanTermsHash"])
        x["interest_paid"] += amt(r["interest"]); x["principal_paid"] += amt(r["principal"]) + amt(r["prepayment"])
        if x["borrower"] is None:
            x["borrower"] = r["borrower"]; x["router"] = x["router"] or "v2"
        if r["isRepaid"]:
            x["status"] = "repaid"; x["end"] = d
    elif r["event"] == "LoanBreached":
        loan_rec(r["loanTermsHash"], status="breached", breached=d)
    elif r["event"] == "LoanLiquidated":
        loan_rec(r["loanTermsHash"], status="liquidated", liquidated=d)

# v1 -> v2 migration: the v2 lender position minted in the same transaction as LoanMigratedOut is the same loan.
# Its later payments are folded back into the v1 row, so a moved loan shows its whole history in one line.
# Several loans can move in one transaction: pair them in log order (the n-th loan out is the n-th new loan id in).
mig_tx = collections.defaultdict(list)
for r in L1:
    if r["event"] == "LoanMigratedOut":
        mig_tx[r["tx"]].append(r["loanTermsHash"])
new_tx = collections.defaultdict(list)
for r in L2:
    if r["event"] == "LenderPositionMinted" and r["tx"] in mig_tx and r["loanTermsHash"] not in new_tx[r["tx"]]:
        new_tx[r["tx"]].append(r["loanTermsHash"])
v2_of = {}
for tx, olds in mig_tx.items():
    news = new_tx.get(tx, [])
    if len(news) == len(olds):
        v2_of.update(dict(zip(news, olds)))
# Two Apr 29 loans were re-issued under new ids on Jul 14, 2026 (tx 0x94aa38ab…, lender positions minted with no
# LoanOriginated); same borrower addresses as the originals' v2 ids. Linked explicitly.
REISSUED = {"0x71e912bb": "0x0357ad95", "0x81c8c979": "0xd02b09c8"}
full = {h[:10]: h for h in loans}
for new8, old8 in REISSUED.items():
    if new8 in full and old8 in full:
        v2_of[full[new8]] = full[old8]
# a refinance continues the same loan under a new id; follow it back to the first id
for x in list(loans.values()):
    if x.get("refi_of"):
        v2_of.setdefault(x["hash"], x["refi_of"])
def root(h):
    seen = set()
    while h in v2_of and h not in seen:
        seen.add(h); h = v2_of[h]
    return h
for h, x in list(loans.items()):
    r0 = root(h)
    if r0 != h and r0 in loans:
        base = loans[r0]
        base["interest_paid"] += x["interest_paid"]; base["principal_paid"] += x["principal_paid"]
        base["status"] = x["status"] if x["status"] != "refinanced" else base["status"]
        base["router"] = "v1→v2" if base["router"] == "v1" else base["router"]
        for k in ("rate", "term_days"):
            if x.get(k) and not base.get(k):
                base[k] = x[k]
        if x.get("end"):
            base["end"] = x["end"]
        x["merged_into"] = r0
        if base["status"] == "moved to v2":
            base["status"] = "active"

# vault-side cash flows from both routers (the vault is the lender of record for sUSDai)
tx_principal = collections.defaultdict(float)
for r in L1 + L2:
    if r["event"] in ("LenderRepaid", "LenderLiquidationRepaid") and r["lender"].lower() == VAULT:
        tx_principal[(r["loanTermsHash"], day(r["ts"]))] += amt(r["principal"]) + amt(r.get("prepay", 0))
for r in L1 + L2:
    if r["event"] in ("LenderRepaid", "LenderLiquidationRepaid") and r["lender"].lower() == VAULT:
        d = day(r["ts"])
        pr = amt(r["principal"]) + amt(r.get("prepay", 0))
        sale = tx_principal[(r["loanTermsHash"], day(r["ts"]))] > 50e6   # a large loan paid off in one day: the GLX sale of Oct 1, 2026
        madd(d, "loan_interest_sale" if sale else "loan_interest", amt(r["interest"]))
        madd(d, "loan_principal_sale" if sale else "loan_principal_back", pr)
        add(d, "loan_interest", amt(r["interest"]))
REAL = lambda x: x["start"] and not x.get("refi_of") and (x["principal"] or 0) >= 1000   # drops two $5 / $1 test loans
for x in loans.values():
    if REAL(x):
        madd(x["start"], "originated", x["principal"] or 0)
        madd(x["start"], "originated_n", 1)

# escrow facilities (funded into escrow while hardware ships; rate per second on the event)
escrows = []
for r in S:
    if r["event"] == "LoanEscrowTimelockDeposited" and amt(r["usdaiAmount"]) > 1e6:
        escrows.append({"hash": r["loanTermsHash"], "d": day(r["ts"]), "usd": amt(r["usdaiAmount"]), "rate": rate_yr(r["interestRate"])})
esc_end = {}
for r in S:
    if r["event"] in ("LoanEscrowTimelockWithdrawn", "LoanEscrowTimelockCancelled"):
        esc_end[r["loanTermsHash"]] = (r["event"].replace("LoanEscrowTimelock", "").lower(), day(r["ts"]))
for e in escrows:
    e["status"], e["end"] = esc_end.get(e["hash"], ("open", None))
for e in escrows:
    # a deposit cancelled and re-made within days for the same amount is one facility, not two
    e["redo"] = e["status"] == "cancelled" and any(o is not e and abs(o["usd"] - e["usd"]) < 1 and o["d"] >= e["d"] and o["status"] != "cancelled" for o in escrows)
    if e["status"] != "cancelled":
        madd(e["d"], "escrow_funded", e["usd"])

# named borrowers, matched to USD.AI announcements by size and date (shown as "matched", never as fact)
NAMED = {"0x7330b176": ("Duos Edge AI", "$98.1M facility announced and funded June 2026; sold through GLX Oct 1, 2026 (usd.ai)"),
         "0x45e3c30b": ("Hydra Host", "$54.4M for 1,040 B300 GPUs, announced Sep 2026 (usd.ai)")}
for x in loans.values():
    nm = NAMED.get(x["hash"][:10])
    if nm:
        x["name"], x["name_src"] = nm
        x["name_matched"] = True
# live principal outstanding per loan and per borrower (vault's share; v2 known, v1 = principal less principal repaid)
by_borrower = collections.defaultdict(lambda: {"live": 0.0, "lent": 0.0, "n": 0, "rates": []})
for x in loans.values():
    if not REAL(x) or x.get("merged_into"):
        continue
    out_ = max(0.0, (x.get("vault_principal") or x["principal"] or 0) - x["principal_paid"]) if x["status"] in ("active", "breached") else 0.0
    x["outstanding"] = out_
    b = by_borrower[x["borrower"].lower()]
    b["live"] += out_; b["lent"] += x["principal"] or 0; b["n"] += 1
    if x.get("rate") and out_:
        b["rates"].append((x["rate"], out_))
    if x.get("name"):
        b["name"] = x["name"] + ("" if b["n"] == 1 and x["borrower"] else "")
        b["name_loan"] = x["start"]

# ---------------------------------------------------------------- USDai supply
usdai_delta = collections.defaultdict(float)
for r in U:
    if r["event"] == "Transfer":
        d = day(r["ts"]); v = r["value"] / 1e18
        if r["from"] == ZERO:
            usdai_delta[d] += v
        if r["to"] == ZERO:
            usdai_delta[d] -= v

# ---------------------------------------------------------------- CHIP (Arbitrum transfers) and sCHIP
chip_bal = collections.defaultdict(float)
chip_holders_by_day = {}
chip_xfer_by_day = collections.defaultdict(int)
if CH:
    last = None
    for r in CH:
        d = day(r["ts"]); v = r["value"] / 1e18
        if last and d != last:
            chip_holders_by_day[last] = sum(1 for b in chip_bal.values() if b > 1)
        chip_bal[r["from"]] -= v
        chip_bal[r["to"]] += v
        chip_xfer_by_day[d] += 1
        last = d
    if last:
        chip_holders_by_day[last] = sum(1 for b in chip_bal.values() if b > 1)
schip_delta = collections.defaultdict(float)
for r in SC:
    d = day(r["ts"])
    if r["event"] == "Deposit":
        schip_delta[d] += r["assets"] / 1e18
    elif r["event"] == "Withdraw":
        schip_delta[d] -= r["assets"] / 1e18

# ---------------------------------------------------------------- third-party series
proto = J("defillama/protocol.json") or {}
tvl = {day(x["date"]): x["totalLiquidityUSD"] for x in proto.get("chainTvls", {}).get("Arbitrum", {}).get("tvl", [])}
borrowed = {day(x["date"]): x["totalLiquidityUSD"] for x in proto.get("chainTvls", {}).get("borrowed", {}).get("tvl", [])}
fees = {day(t): v for t, v in (J("defillama/fees.json") or {}).get("totalDataChart", [])}
rev = {day(t): v for t, v in (J("defillama/revenue.json") or {}).get("totalDataChart", [])}
pool = {x["timestamp"][:10]: x for x in (J("defillama/pool_susdai.json") or {}).get("data", [])}
pt = {x["timestamp"][:10]: x for x in (J("defillama/pool_pt_feb27.json") or {}).get("data", [])}
cg = J("coingecko/chip.json") or {}
cgc = J("coingecko/chip_chart.json") or {}
cg_price = {day(t / 1000): v for t, v in cgc.get("prices", [])}
cg_mcap = {day(t / 1000): v for t, v in cgc.get("market_caps", [])}
cg_vol = {day(t / 1000): v for t, v in cgc.get("total_volumes", [])}
btc = {day(t / 1000): v for t, v in (J("coingecko/btc_chart.json") or {}).get("prices", [])}
rpcs = J("rpc/state.json") or {}
stab = J("defillama/stablecoin.json") or {}

# ---------------------------------------------------------------- daily table
first = min([d for d in price_by_day] + [d for d in tvl if tvl[d] > 0])
d0 = dt.date.fromisoformat(first)
rows = []
price = None
sup = usdai = schip = qsh = don_ps = 0.0
prev_price, recent_steps = None, []
cur = d0
while cur.isoformat() <= AS_OF:
    d = cur.isoformat()
    price = price_by_day.get(d, price)
    sup += supply_delta.get(d, 0.0)
    usdai += usdai_delta.get(d, 0.0)
    schip += schip_delta.get(d, 0.0)
    x = daily.get(d, {})
    qsh += x.get("q_in", 0.0) - x.get("q_out", 0.0)
    if x.get("donation") and price and prev_price:
        # the payout day's whole step above a normal day: the top-up plus value left behind by redeemers
        normal = sorted(recent_steps)[len(recent_steps) // 2] if recent_steps else 0.0
        don_ps += max(0.0, (price - prev_price) - normal)
    if price and prev_price:
        recent_steps = (recent_steps + [price - prev_price])[-14:]
    prev_price = price
    row = {"d": d, "share_price": r2(price, 6), "susdai_supply": r2(sup, 0),
           "susdai_assets": r2(sup * price, 0) if price else None,
           "usdai_supply": r2(usdai, 0) if U else None,
           "idle": r2(tvl.get(d), 0), "lent": r2(borrowed.get(d), 0),
           "deposits": r2(x.get("deposits", 0.0), 0), "redeemed": r2(x.get("redeemed", 0.0), 0),
           "redeem_req_usd": r2(x.get("redeem_req_shares", 0.0) * (price or 1), 0),
           "loan_interest": r2(x.get("loan_interest", 0.0), 0),
           "fees": r2(fees.get(d), 0), "revenue": r2(rev.get(d), 0),
           "apy_llama": r2(pool[d]["apy"] / 100, 5) if d in pool and pool[d].get("apy") is not None else None,
           "pt_apy": r2(pt[d]["apy"] / 100, 5) if d in pt and pt[d].get("apy") is not None else None,
           "chip_price": r2(cg_price.get(d), 6), "btc_price": r2(btc.get(d), 0), "chip_mcap": r2(cg_mcap.get(d), 0), "chip_vol": r2(cg_vol.get(d), 0),
           "chip_holders": chip_holders_by_day.get(d), "chip_transfers": chip_xfer_by_day.get(d) if CH else None,
           "schip_staked": r2(schip, 0) if SC else None,
           "queue_usd": r2(max(0.0, qsh) * (price or 1), 0), "price_ex_topup": r2(price - don_ps, 6) if price else None,
           "hurdle": 0.07 if d >= "2026-10-15" else None}
    rows.append(row)
    cur += dt.timedelta(days=1)
# fill forward holder counts across days without transfers
lh = None
for r in rows:
    if r["chip_holders"] is None and lh is not None and CH:
        r["chip_holders"] = lh
    lh = r["chip_holders"] if r["chip_holders"] is not None else lh
# trailing 30-day yield from the deposit share price (annualized, simple)
byd = {r["d"]: r for r in rows}
for r in rows:
    p = r["share_price"]
    back = (dt.date.fromisoformat(r["d"]) - dt.timedelta(days=30)).isoformat()
    p0 = byd.get(back, {}).get("share_price")
    young = r["d"] < (d0 + dt.timedelta(days=60)).isoformat()   # launch weeks: tiny base, the rate means nothing
    r["apy_30d"] = r2((p / p0 - 1) * 365 / 30, 5) if p and p0 and not young else None
    q, q0 = r["price_ex_topup"], byd.get(back, {}).get("price_ex_topup")
    r["apy_30d_ex"] = r2((q / q0 - 1) * 365 / 30, 5) if q and q0 and not young else None
    r["unlent"] = r2(max(0.0, r["susdai_assets"] - r["lent"]), 0) if r["susdai_assets"] and r["lent"] is not None else None
    r["total_assets"] = r2((r["idle"] or 0) + (r["lent"] or 0), 0) if r["idle"] is not None else None
    r["lent_share"] = r2(r["lent"] / r["susdai_assets"], 4) if r["lent"] and r["susdai_assets"] else None
    r["fdv"] = r2(r["chip_price"] * 1e10, 0) if r["chip_price"] else None
    r["fdv_per_dollar"] = r2(r["fdv"] / r["susdai_assets"], 4) if r["fdv"] and r["susdai_assets"] else None
# market cap in years of fee: trailing-30-day DefiLlama revenue, origination-fee days removed (revenue == fees)
orig_days = {d for d in rev if rev[d] and fees.get(d) and rev[d] >= 0.99 * fees[d] and rev[d] > 50_000}
for i, r in enumerate(rows):
    win = rows[max(0, i - 29): i + 1]
    f30 = sum((w["revenue"] or 0) for w in win if w["d"] not in orig_days)
    r["fee_30d"] = r2(f30, 0) if len(win) == 30 else None
    r["mcap_years_fee"] = r2(r["chip_mcap"] / (f30 * 12), 2) if r["chip_mcap"] and f30 > 0 and len(win) == 30 else None

# ---------------------------------------------------------------- monthly table
mon = []
for m in sorted(monthly):
    x = monthly[m]
    income = x["loan_interest"] + x["loan_interest_sale"] + x["base_yield"] + x["escrow_interest"]
    mrow = {"m": m, **{k: r2(v, 0) for k, v in x.items()},
            "income_net": r2(income, 0),
            "fee_modeled": r2(x["fee_base"] + (x["loan_interest"] + x["loan_interest_sale"] + x["escrow_interest"]) / 9, 0),  # admin fee on base yield (on-chain) + 10% of gross loan/escrow interest
            "orig_fees": r2(sum(rev[d] for d in orig_days if d.startswith(m)), 0),
            "depositors": len(depositors.get(m, ())),
            "loan_share": r2(x["loan_interest"] / income, 4) if income else None}
    mon.append(mrow)
for mrow in mon:
    p = [r["share_price"] for r in rows if r["d"].startswith(mrow["m"]) and r["share_price"]]
    mrow["share_price_end"] = r2(p[-1], 6) if p else None
    mrow["days"] = sum(1 for r in rows if r["d"].startswith(mrow["m"]))

# ---------------------------------------------------------------- redemptions
pay_days = sorted(redeemers_by_payout)
payouts = []
for d in pay_days:
    by = sorted(redeemers_by_payout[d].values(), reverse=True)
    tot = sum(by)
    if tot < 1e5:
        continue
    payouts.append({"d": d, "usd": r2(tot, 0), "wallets": len(by), "top1": r2(by[0] / tot, 4),
                    "top5": r2(sum(by[:5]) / tot, 4), "top10": r2(sum(by[:10]) / tot, 4)})
# merge payouts within 2 days (the 1 Nov payout came in seven transactions)
merged = []
for p in payouts:
    if merged and (dt.date.fromisoformat(p["d"]) - dt.date.fromisoformat(merged[-1]["d"])).days <= 2:
        merged[-1]["usd"] += p["usd"]; merged[-1]["wallets"] += p["wallets"]
    else:
        merged.append(dict(p))
wait_by_payout = collections.defaultdict(list)
for qd, pd, w, a in waits:
    wait_by_payout[pd[:7]].append((w, a))
for p in merged:
    ws = wait_by_payout.get(p["d"][:7], [])
    if ws:
        tot = sum(a for _, a in ws)
        p["wait_avg_days"] = r2(sum(w * a for w, a in ws) / tot, 1)
        p["wait_max_days"] = r2(max(w for w, _ in ws), 1)
# concentration of the latest big payout, by wallet (redeemers summed across the payout's transactions)
last_pay = merged[-1] if merged else None
if last_pay:
    lp = collections.defaultdict(float)
    for d in pay_days:
        if abs((dt.date.fromisoformat(d) - dt.date.fromisoformat(last_pay["d"])).days) <= 2:
            for w, a in redeemers_by_payout[d].items():
                lp[w] += a
    s = sorted(lp.items(), key=lambda kv: -kv[1]); tot = sum(v for _, v in s)
    last_pay.update({"wallets": len(s), "top1": r2(s[0][1] / tot, 4), "top5": r2(sum(v for _, v in s[:5]) / tot, 4),
                     "top10": r2(sum(v for _, v in s[:10]) / tot, 4),
                     "largest": [{"addr": a, "usd": r2(v, 0)} for a, v in s[:10]]})
# biggest net depositors still in (deposits minus redemptions), share of current assets
net = {a: dep_by_owner[a] - red_by_owner.get(a, 0) for a in dep_by_owner}

# ---------------------------------------------------------------- loan list
loan_list = []
for x in sorted(loans.values(), key=lambda v: v["start"] or "9999"):
    if not x["start"] or (x["principal"] or 0) < 1000 or x.get("merged_into"):
        continue
    loan_list.append({k: (r2(v, 4) if isinstance(v, float) else v) for k, v in x.items() if k != "events"})
active_v2 = [x for x in loans.values() if x["router"] == "v2" and x["status"] in ("active", "breached")]

# ---------------------------------------------------------------- KPIs
last = rows[-1]
def lastv(k):
    for r in reversed(rows):
        if r.get(k) is not None:
            return r[k], r["d"]
    return None, None

rows_by = {r["d"]: r for r in rows}
def ago(k, n):
    d = (dt.date.fromisoformat(AS_OF) - dt.timedelta(days=n)).isoformat()
    return rows_by.get(d, {}).get(k)

md = cg.get("market_data", {})
# every CHIP figure is the close of the as-of day, like the charts; CoinGecko's live quote is kept for reference
price_live = (md.get("current_price") or {}).get("usd")
price_now = cg_price.get(AS_OF) or price_live
p30 = cg_price.get((dt.date.fromisoformat(AS_OF) - dt.timedelta(days=30)).isoformat())
circ = md.get("circulating_supply"); total = md.get("total_supply"); maxs = md.get("max_supply")
last_full = [m for m in mon if m["days"] >= 28 and m["m"] < AS_OF[:7]]
lm = last_full[-1] if last_full else None
# the buyback budget: the 10% fee, measured by DefiLlama as revenue, last 30 days
nim_month = lastv("fee_30d")[0]           # DefiLlama revenue, last 30 days, origination-fee days removed
yr_income = sum(m["income_net"] for m in mon if m["m"] > (dt.date.fromisoformat(AS_OF) - dt.timedelta(days=365)).isoformat()[:7] and m["m"] < AS_OF[:7])
kpi = {
    "as_of": AS_OF,
    "susdai_assets": lastv("susdai_assets")[0], "susdai_supply": lastv("susdai_supply")[0],
    "share_price": lastv("share_price")[0], "apy_30d": lastv("apy_30d")[0], "apy_llama": lastv("apy_llama")[0],
    "pt_apy": lastv("pt_apy")[0],
    "lent": lastv("lent")[0], "idle": lastv("idle")[0], "lent_share": lastv("lent_share")[0],
    "lent_30d": ago("lent", 30), "idle_30d": ago("idle", 30), "assets_30d": ago("susdai_assets", 30),
    "usdai_supply": lastv("usdai_supply")[0] if U else None,
    "usdai_circ_llama": sum((stab.get("currentChainBalances") or {}).get(c, {}).get("peggedUSD", 0) for c in (stab.get("currentChainBalances") or {})) if stab else None,
    "chip_price": price_now, "chip_price_live": price_live, "chip_mcap": cg_mcap.get(AS_OF) or (md.get("market_cap") or {}).get("usd"),
    "chip_fdv": price_now * (md.get("max_supply") or 1e10) if price_now else None,
    "chip_circ": circ, "chip_total": total, "chip_max": maxs, "chip_ath": (md.get("ath") or {}).get("usd"),
    "chip_ath_date": ((md.get("ath_date") or {}).get("usd") or "")[:10], "chip_atl": (md.get("atl") or {}).get("usd"),
    "chip_atl_date": ((md.get("atl_date") or {}).get("usd") or "")[:10],
    "chip_change_30d": price_now / p30 - 1 if price_now and p30 else None,
    "chip_vol_24h": (md.get("total_volume") or {}).get("usd"),
    "chip_holders": lastv("chip_holders")[0], "chip_holders_30d": ago("chip_holders", 30),
    "schip_staked": lastv("schip_staked")[0],
    "loans_total": len([x for x in loans.values() if REAL(x)]),
    "borrowers": len({x["borrower"].lower() for x in loans.values() if REAL(x)}),
    "originated_usd": sum(x["principal"] or 0 for x in loans.values() if REAL(x)),
    "escrow_usd": sum(e["usd"] for e in escrows),
    "v2_rates": sorted({round(x["rate"], 4) for x in loans.values() if x.get("rate")}),
    "month_last_full": lm["m"] if lm else None,
    "income_last_month": lm["income_net"] if lm else None, "loan_interest_last_month": lm.get("loan_interest") if lm else None,
    "base_yield_last_month": lm.get("base_yield") if lm else None,
    "fee_last_month": nim_month, "income_12m": yr_income,
    "fee_12m": sum(m["fee_modeled"] or 0 for m in mon if m["m"] > (dt.date.fromisoformat(AS_OF) - dt.timedelta(days=365)).isoformat()[:7] and m["m"] < AS_OF[:7]),
    "orig_fees_12m": sum(rev[d] for d in orig_days if d > (dt.date.fromisoformat(AS_OF) - dt.timedelta(days=365)).isoformat()),
    "apy_30d_ex": lastv("apy_30d_ex")[0], "assets_change_30d": (lastv("susdai_assets")[0] / ago("susdai_assets", 30) - 1) if ago("susdai_assets", 30) else None,
    "lent_change_30d": (lastv("lent")[0] / ago("lent", 30) - 1) if ago("lent", 30) else None,
    "chip_ath_close": max(cg_price.values()) if cg_price else None,
    "chip_ath_close_date": max(cg_price, key=cg_price.get) if cg_price else None,
    "tge_date": "2026-04-21",
    "deposit_price": rpcs.get("vault_deposit_price"), "redemption_price": rpcs.get("vault_redemption_price"),
    "loans_big": len([x for x in loans.values() if REAL(x) and x["principal"] >= 1e5]),
    "loans_small": len([x for x in loans.values() if REAL(x) and x["principal"] < 1e5]),
    "live_principal": sum(b["live"] for b in by_borrower.values()),
    "live_rated_principal": sum(o for b in by_borrower.values() for _, o in b["rates"]),
    "live_rate_wavg": (sum(rt * o for b in by_borrower.values() for rt, o in b["rates"]) / sum(o for b in by_borrower.values() for _, o in b["rates"])) if any(b["rates"] for b in by_borrower.values()) else None,
    "loan_interest_total": sum((m.get("loan_interest") or 0) + (m.get("loan_interest_sale") or 0) for m in mon),
    "sale_principal": sum(m.get("loan_principal_sale") or 0 for m in mon),
    "fees_12m": sum(v for t, v in (J("defillama/fees.json") or {}).get("totalDataChart", [])[-365:]),
    "llama_fees_30d": (J("defillama/fees.json") or {}).get("total30d"), "llama_rev_30d": (J("defillama/revenue.json") or {}).get("total30d"),
    "llama_rev_all": (J("defillama/revenue.json") or {}).get("totalAllTime"),
    "last_payout": last_pay,
    "donation": sum(m.get("donation", 0) or 0 for m in mon),
    "rpc": rpcs,
    "vault_cash": (rpcs.get("vault_cash") or [None])[0], "vault_loans": (rpcs.get("vault_loans") or [None])[0],
    "vault_escrow": rpcs.get("vault_deposit_timelock"), "vault_nav": rpcs.get("vault_nav"),
    "vault_shares": rpcs.get("vault_total_shares"), "vault_bridged_share": (rpcs.get("vault_bridged_supply") or 0) / rpcs["vault_total_shares"] if rpcs.get("vault_total_shares") else None,
    "queue_pending_usd": ((rpcs.get("vault_queue") or {}).get("pending_shares") or 0) * (rpcs.get("vault_redemption_price") or 1) if rpcs else None,
    "next_redemption": rpcs.get("vault_redemption_time"),
    "schip_staked_now": rpcs.get("schip_assets"),
    "btc_change_30d": (btc[AS_OF] / btc[(dt.date.fromisoformat(AS_OF) - dt.timedelta(days=30)).isoformat()] - 1) if btc.get(AS_OF) and btc.get((dt.date.fromisoformat(AS_OF) - dt.timedelta(days=30)).isoformat()) else None,
}
# CHIP buyback arithmetic: what the 10% fee could buy against the next unlock
UNLOCK_DATE = "2027-04-21"   # 12 months after CHIP went live (first trades Apr 21, 2026; "$CHIP Is Live", Apr 22); 33% of investors + contributors
INV, CONTRIB = 0.296, 0.235  # Messari; contributors 23.1-23.5% across sources, the larger is used
cliff = 0.33 * (INV + CONTRIB) * 10_000_000_000
monthly_after = 0.67 * (INV + CONTRIB) * 10_000_000_000 / 24
kpi.update({"unlock_date": UNLOCK_DATE, "unlock_cliff_chip": cliff, "unlock_monthly_chip": monthly_after,
            "unlock_cliff_usd": cliff * price_now if price_now else None,
            "unlock_monthly_usd": monthly_after * price_now if price_now else None,
            "buyback_months_for_cliff": (cliff * price_now / nim_month) if price_now and nim_month else None,
            "buyback_share_of_monthly_unlock": (nim_month / (monthly_after * price_now)) if price_now and nim_month else None,
            "buyback_yield_on_mcap": (nim_month * 12 / kpi["chip_mcap"]) if nim_month and kpi["chip_mcap"] else None,
            "buyback_1m_chip": 22_343_372, "buyback_1m_usd": 1_000_000, "buyback_1m_price": 0.044756})

# unlock schedule (modelled): months from Nov 2026 to Apr 2029; reserve and ecosystem have no published schedule
S2 = 225_000_000          # Season 2 airdrop, claimable with no lock-up until Jan 31, 2027 (October recap)
sched = []
cum_chip = cum_fee = 0.0
m0 = dt.date(2026, 11, 1)
after = 0
for i in range(30):
    y, mth = divmod(m0.month - 1 + i, 12)
    mk_ = dt.date(m0.year + y, mth + 1, 1).isoformat()[:7]
    s2 = S2 if mk_ == "2026-11" else 0.0
    inv = cliff if mk_ == "2027-04" else (monthly_after if mk_ > "2027-04" and after < 24 else 0.0)
    if mk_ > "2027-04" and inv:
        after += 1
    cum_chip += s2 + inv
    cum_fee += nim_month or 0
    sched.append({"m": mk_, "s2": r2(s2, 0), "unlock": r2(inv, 0), "cum_chip": r2(cum_chip, 0),
                  "cum_usd": r2(cum_chip * price_now, 0) if price_now else None, "cum_fee": r2(cum_fee, 0),
                  "fee_chip": r2(cum_fee / price_now, 0) if price_now else None})
kpi["s2_airdrop"] = S2

# borrowers, largest live principal first
borrower_rows = sorted(({"addr": a_, "name": b_.get("name"), "name_loan": b_.get("name_loan"), "live": r2(b_["live"], 0), "lent": r2(b_["lent"], 0), "n": b_["n"],
                         "rate": r2(sum(rt * o for rt, o in b_["rates"]) / sum(o for _, o in b_["rates"]), 4) if b_["rates"] else None}
                        for a_, b_ in by_borrower.items()), key=lambda r: (-r["live"], -r["lent"]))
open_esc = sum(e["usd"] for e in escrows if e["status"] == "open")
if open_esc:
    borrower_rows.append({"addr": "", "name": "Escrow facility", "name_loan": None, "live": r2(open_esc, 0), "lent": r2(open_esc, 0), "n": 1, "rate": 0.065, "escrow": True})
    borrower_rows.sort(key=lambda r: -r["live"])
tot_live = sum(r["live"] for r in borrower_rows) or 1
kpi["top3_committed_share"] = sum(r["live"] for r in borrower_rows[:3]) / tot_live
loan_rows = [r for r in borrower_rows if not r.get("escrow")]
tot_loans = sum(r["live"] for r in loan_rows) or 1
kpi["top1_live_share"] = loan_rows[0]["live"] / tot_loans if loan_rows else None
kpi["top2_live_share"] = sum(r["live"] for r in loan_rows[:2]) / tot_loans if loan_rows else None
kpi["top1_lent_share"] = max(r["lent"] for r in borrower_rows) / (kpi["originated_usd"] or 1) if borrower_rows else None

# what USD.AI says vs what the chain shows (research notes, section 4)
REPORTED = [
    {"d": "2026-06-08", "what": "TVL $398M, $202M deployed, 13 active loans", "src": "Lighthouse YTD report"},
    {"d": "2026-10-02", "what": "TVL $659M+, $420M+ lifetime deployed, net APY 6.9%", "src": "September recap"},
    {"d": "2026-11-03", "what": "TVL $474M, $531M lifetime across 20 financings, net APY 7.00%", "src": "October recap"},
    {"d": "2026-11-04", "what": "sUSDai TVL $468M, $306.3M lent across 18 loans", "src": "thelearningpill"},
]

# ---------------------------------------------------------------- peers
mk = {c["id"]: c for c in (J("peers/coingecko-markets.json") or [])}
peers = []
def rev365(js):
    if not js:
        return None
    ch = js.get("totalDataChart", [])
    return sum(v for t, v in ch[-365:]) if ch else None
for p in PEERS:
    pr = J(f"peers/{p['key']}-protocol.json") or {}
    cct = pr.get("currentChainTvls", {})
    tv = sum(v for k, v in cct.items() if "-" not in k and k not in ("borrowed", "staking", "pool2", "vesting", "offers"))
    bw = cct.get("borrowed")
    c = mk.get(p["gecko"], {})
    r30 = (J(f"peers/{p['key']}-revenue.json") or {}).get("total30d")
    f30 = (J(f"peers/{p['key']}-fees.json") or {}).get("total30d")
    peers.append({"name": p["name"], "token": p["token"], "note": p["note"], "tvl": tv, "borrowed": bw,
                  "mcap": c.get("market_cap"), "fdv": c.get("fully_diluted_valuation"), "price": c.get("current_price"),
                  "rev_yr": r30 * 12 if r30 else None, "fees_yr": f30 * 12 if f30 else None})
peers.insert(0, {"name": "USD.AI", "token": "CHIP", "note": "GPU loans; buys CHIP with its 10% fee (proposed)", "self": True,
                 "tvl": kpi["idle"], "borrowed": kpi["lent"], "mcap": kpi["chip_mcap"], "fdv": kpi["chip_fdv"], "price": price_now,
                 "rev_yr": (kpi["llama_rev_30d"] or 0) * 12 or None, "fees_yr": (kpi["llama_fees_30d"] or 0) * 12 or None})
for p in peers:
    size = (p["tvl"] or 0) + (p["borrowed"] or 0)
    p["size"] = size
    p["fdv_size"] = p["fdv"] / size if p["fdv"] and size else None
    p["mcap_rev"] = p["mcap"] / p["rev_yr"] if p["mcap"] and p["rev_yr"] else None

# ---------------------------------------------------------------- events (dated, sourced)
EVENTS = [
    ("2025-09-26", "Deposit cap raised to $500M", "DefiLlama hallmark"),
    ("2026-01-27", "Foundation and CHIP announced", "usd.ai blog"),
    ("2026-03-07", "$136M redeemed in one payout", "On-chain, RedemptionsServiced"),
    ("2026-04-21", "CHIP starts trading", "CoinGecko first price; usd.ai \"$CHIP Is Live\", Apr 22"),
    ("2026-06-04", "$98.1M Duos Edge AI loan funded", "usd.ai; DefiLlama fee spike"),
    ("2026-07-02", "Open loans moved to Loan Router v2", "On-chain, LoanMigratedOut"),
    ("2026-09-23", "$122M escrow for the $128.9M facility", "On-chain; usd.ai Sep 23"),
    ("2026-10-01", "GLX launches; Duos loan sold", "usd.ai Oct 1"),
    ("2026-10-19", "CHIP governance forum opens", "usd.ai Oct 19"),
    ("2026-10-28", "$1M CHIP buyback; fee-to-buyback proposal", "usd.ai Oct 28, Nov 3"),
    ("2026-11-01", "First hurdle-rate top-up; $118M redeemed", "On-chain, Donated + RedemptionsServiced"),
]
events = [{"d": d, "label": l, "src": s} for d, l, s in EVENTS]

meta = {
    "as_of": AS_OF, "built_utc": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%MZ"), "contracts": CONTRACTS,
    "chain_through": day(max(v.get("last_log_ts") or 0 for v in state.values())) if state else None,
    "sources": {k: v.get("fetched_utc") for k, v in manifest.items()},
    "first_day": rows[0]["d"],
}
out = {"meta": meta, "kpi": kpi, "daily": rows, "monthly": mon, "loans": loan_list, "escrows": escrows,
       "borrowers": borrower_rows, "reported": REPORTED,
       "payouts": merged, "events": events, "peers": peers, "unlocks": sched}
os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
with open(os.path.join(SITE, "data", "data.js"), "w") as f:
    f.write("window.USDAI=" + json.dumps(out, separators=(",", ":"), default=str) + ";\n")

# Allium SQL for the Method tab: blocks in sql/queries.sql start with "-- @name" and "-- @title"
qs = []
for blk in open(os.path.join(ROOT, "sql", "queries.sql")).read().split("-- @name ")[1:]:
    lines = blk.split("\n")
    title = next((l[len("-- @title "):] for l in lines if l.startswith("-- @title ")), lines[0].strip())
    qs.append({"name": lines[0].strip(), "title": title, "sql": "\n".join(l for l in lines[1:] if not l.startswith("-- @title")).strip()})
with open(os.path.join(SITE, "data", "sql.js"), "w") as f:
    f.write("window.USDAI_SQL=" + json.dumps(qs) + ";\n")

# CSV downloads
os.makedirs(os.path.join(SITE, "downloads"), exist_ok=True)
for name, rs in (("usdai_daily", rows), ("usdai_monthly", mon), ("usdai_loans", loan_list)):
    keys = list(dict.fromkeys(k for r in rs for k in r.keys()))
    with open(os.path.join(SITE, "downloads", name + ".csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
        for r in rs:
            w.writerow({k: (json.dumps(v) if isinstance(v, (list, dict)) else v) for k, v in r.items()})
print(json.dumps({k: kpi[k] for k in ("susdai_assets", "apy_30d", "lent", "idle", "loans_total", "borrowers", "originated_usd",
                                      "income_last_month", "fee_last_month", "chip_price", "chip_mcap", "buyback_months_for_cliff")}, default=str, indent=1))
