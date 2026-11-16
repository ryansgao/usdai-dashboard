# USD.AI and CHIP deep dive

A research dashboard on [USD.AI](https://usd.ai): the protocol that lends stablecoins to GPU operators, the sUSDai
vault that funds those loans, and CHIP, its governance token. Built by Blockchain at Berkeley in the same format as
our Venice (VVV / DIEM) deep dive, for Allium's Terminal deep dives.

Open `site/index.html` through any static file server (`python3 -m http.server --directory site`). Tabs are URL
states (`?tab=overview|vault|loans|yield|redemptions|chip|valuation|method`).

## What it shows

| Tab | Question |
|---|---|
| Overview | How big is the vault, how much is lent, what holders earn, and how the money moves |
| Deposits | USDai and sUSDai: what the vault holds today (cash, live loans, escrow), deposits and exits per month |
| Loans | Every loan on both Loan Router contracts, escrow facilities, interest paid back to the vault |
| Yield | The share price, trailing yield against Pendle's fixed rate, where the vault's income comes from |
| Redemptions | Every monthly payout, how concentrated it was, and the queue for the next one |
| CHIP | Price, the October 28 buyback, the April 2027 unlock, and a calculator for how big USD.AI must get for the fee to matter |
| Valuation | CHIP next to Maple, Ethena and GAIB; the case for and against with what would change it |
| Method | Sources, definitions, limits, contracts |

## Findings worth checking first

- **Loan Router v2** (`0x1c2ed170de32846316784c4fd58a5e3c7563e12f`) is not in USD.AI's published address list. The
  17 loans open on v1 moved to it between 2026-06-26 and 2026-07-03; v2's `LoanOriginated` carries the full loan
  terms (tranche amounts and rates), so the loan book can be rebuilt from events.
- Two-thirds of sUSDai shares live on other chains: bridging burns shares on Arbitrum (`bridgedSupply()`), so
  Arbitrum `totalSupply()` understates the vault by about 3x. Shares outstanding = deposits minus serviced
  redemptions, which matches `totalShares()` exactly.
- The vault held $134M cash, $177M in live loans and $129M in escrow on 2026-11-16 (contract reads).
- $118M was paid to redeemers on 2026-11-01; ten wallets took 57% of it.
- At the last 30 days' pace, the 10% protocol fee buys about $3M of CHIP a year, against ~1.75B CHIP (investors and
  contributors) unlocking from April 2027.

## Pipeline

```
pipeline/fetch_public.py   DefiLlama, CoinGecko, live contract reads (rpc_state.py) -> data/raw/
pipeline/fetch_chain.py    Arbitrum event logs via Envio HyperSync (free token) -> data/raw/chain/  (not committed: large, reproducible)
pipeline/build.py          every number on the page -> site/data/data.js, site/downloads/*.csv
pipeline/check_facts.py    rebuilt history vs the contracts' own nav() and totalShares(); freshness
refresh.sh                 all of the above + a headless render check (tools/render_check.cjs)
sql/queries.sql            the same series as Allium SQL drafts, for running inside Allium
research/                  research notes with sources and dates
```

ABIs in `data/abi/` are the verified implementations from Sourcify (exact match). Requirements: Python 3.11+ with
`uv`; Node + `playwright` for the render check.

## Data notes

- USDai, PYUSD and USDC are counted at $1.
- Figures are as of the last complete UTC day; contract reads carry their own timestamp.
- Unlocks are modelled from published allocation shares and the 12-month cliff; the Foundation reserve has no
  published schedule and is left out.
- Not investment advice. The authors may hold CHIP, USDai or sUSDai.
