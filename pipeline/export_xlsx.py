# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl"]
# ///
"""Excel workbook of every table behind the page: site/data/data.js -> site/downloads/usdai-deep-dive-data.xlsx.
One sheet per table, a README sheet with sources and as-of dates. Run after build.py: uv run pipeline/export_xlsx.py"""
import json, os
from openpyxl import Workbook
from openpyxl.styles import Font

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, "site", "data", "data.js")).read()
d = json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))
wb = Workbook()
ws = wb.active; ws.title = "README"
for row in [["USD.AI and CHIP deep dive: data workbook"], ["Data through", d["meta"]["as_of"]], ["Built", d["meta"]["built_utc"]],
            ["Sources", "Arbitrum event logs (Envio HyperSync), live contract reads, DefiLlama, CoinGecko, USD.AI docs and posts"],
            ["Units", "USD; USDai, PYUSD and USDC counted at $1. Rates are annual fractions."], [],
            ["Sheet", "What it holds"], ["Daily", "One row per UTC day: vault, yield, queue, CHIP market"], ["Monthly", "Cash booked by the vault by source, flows, fee"],
            ["Loans", "Every on-chain loan, named where filings match"], ["Borrowers", "Live principal by borrower"], ["Payouts", "Each monthly redemption payout"],
            ["Escrow", "Facilities funded into escrow"], ["Unlocks", "Modeled CHIP unlocks against the fee"], ["Peers", "Valuation table"], ["Holders", "Largest CHIP holders, labelled"]]:
    ws.append(row)
ws["A1"].font = Font(bold=True, size=13)

def sheet(name, rows):
    if not rows:
        return
    w = wb.create_sheet(name)
    keys = list(dict.fromkeys(k for r in rows for k in r if not k.startswith("_")))
    w.append(keys)
    for c in w[1]:
        c.font = Font(bold=True)
    for r in rows:
        w.append([json.dumps(r.get(k)) if isinstance(r.get(k), (list, dict)) else r.get(k) for k in keys])
    w.freeze_panes = "A2"

sheet("Daily", d["daily"]); sheet("Monthly", d["monthly"])
sheet("Loans", [{k: v for k, v in l.items() if k != "events"} for l in d["loans"]])
sheet("Borrowers", d.get("borrowers", [])); sheet("Payouts", [{k: v for k, v in p.items() if k != "largest"} for p in d["payouts"]])
sheet("Escrow", d["escrows"]); sheet("Unlocks", d["unlocks"]); sheet("Peers", d["peers"])
sheet("Holders", [{"address": a, "chip_millions": m, "label": l} for a, m, l in d.get("holders", {}).get("top", [])])
out = os.path.join(ROOT, "site", "downloads", "usdai-deep-dive-data.xlsx")
wb.save(out)
print("wrote", out)
