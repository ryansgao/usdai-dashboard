"""Fact gate, run after every build: the rebuilt history must agree with the contracts' own live numbers.
Prints one line per check (ok / FAIL) and exits 1 on any failure."""
import datetime as dt, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, "site", "data", "data.js")).read()
d = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
K, rpc = d["kpi"], d["kpi"].get("rpc") or {}
fails = 0


def check(name, cond, detail):
    global fails
    print(("ok   " if cond else "FAIL ") + name + ": " + detail)
    fails += 0 if cond else 1


def near(a, b, tol):
    return a is not None and b is not None and abs(a - b) <= tol * abs(b)


check("sUSDai assets vs vault nav()", near(K["susdai_assets"], rpc.get("vault_nav"), 0.01),
      f"rebuilt {K['susdai_assets']:,.0f} vs contract {rpc.get('vault_nav') or 0:,.0f}")
check("shares vs totalShares()", near(K["susdai_supply"], rpc.get("vault_total_shares"), 0.01),
      f"rebuilt {K['susdai_supply']:,.0f} vs contract {rpc.get('vault_total_shares') or 0:,.0f}")
lent_rpc = (K.get("vault_loans") or 0) + (K.get("vault_escrow") or 0)
check("DefiLlama borrowed vs vault loans + escrow", near(K["lent"], lent_rpc, 0.03), f"{K['lent']:,.0f} vs {lent_rpc:,.0f}")
age = (dt.date.today() - dt.date.fromisoformat(d["meta"]["as_of"])).days
check("data is recent", age <= 3, f"as of {d['meta']['as_of']} ({age} days)")
check("CHIP price present", bool(K.get("chip_price")), str(K.get("chip_price")))
bad = [k for k, v in K.items() if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf")))]
check("no NaN or infinite KPI", not bad, ", ".join(bad) or "none")
sys.exit(1 if fails else 0)
