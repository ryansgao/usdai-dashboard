# CHIP, end to end: research from primary sources (cycle 1, 2026-11-17)

Scope: the CHIP token only. Protocol, loans and credit risk are covered elsewhere. Every fact carries a source and the
date it was read; **[verified on-chain]** marks a contract read or log pull of my own; **[unverified]** marks an
aggregator or a single secondary source. Prices are from the dashboard's CoinGecko pull (`data/raw/coingecko`, last
point 2026-11-16 00:00 UTC, $0.0270; live $0.0275 on Blockscout 2026-11-17). Scratch data and scripts:

---

## 1. Supply

### 1.1 Allocation: the docs pie, confirmed on-chain

The docs (`docs.usd.ai/governance/tokenomics.md`, read 2026-11-17) show the allocation only as two images. Both were
downloaded and read:
`…/uploads%2FTt56s5xfAl0NH0wNsuVe%2Fchip-token-distribution%20(1).png` and `…/uploads%2FlUnsWL41cS7ETgXLxyjA%2Fchip-token-unlock.png`
(gitbook-x-prod.appspot.com). The pie reads: **Investors 29.6%, Ecosystem Bootstrapping 27.5%, Core Contributors
23.1%, Reserves 19.8%** ("Total $CHIP Supply: 10,000,000,000").

The docs text, verbatim:
- Contributors: "0% vests before month 12, 33% vests at month 12, and the remaining 67% vests in equal monthly installments over the following 24 months."
- Investors: "0% unlocks before month 12, 33% unlocks at month 12, and the remaining 67% unlocks in equal monthly increments over the subsequent 24 months."
- Ecosystem: "27.5% of CHIP is reserved to bootstrap protocol liquidity … The first 10% was distributed during Season 1 (The Allo Game)."
- Reserve: "19.8% is the residual reserves for future grants, partnerships, research & development". The text gives no schedule.

**On-chain ledger [verified on-chain, Blockscout Arbitrum transfers].** All 10B CHIP were minted on 2026-03-31 08:25 UTC
to Safe `0xE23796fBDa930646e903c2c94a6Ed1312409ca05` (labelled "Ecosystem Bootstrapping" by Binance Research). On
2026-04-24 17:44–17:45 UTC that Safe funded the wallets Binance Research lists for each tranche:

| Tranche | Wallets (Binance Research labels) | Funded 2026-04-24 | Share | Docs |
|---|---|---:|---:|---:|
| Investors | `0x3369…c42b` 1,162.3M; `0x5744…1Ce8` 1,798.6M | 2,960.9M | 29.6% | 29.6% |
| Core contributors | 7 wallets, largest `0xd734…8c75` 1,648.5M | 2,309.2M | 23.1% | 23.1% |
| Reserve | `0x403f…` 500.0M, `0xd6D8…` 120.0M, `0x45F3…` 695.8M, `0x8e80…` 659.9M | 1,975.7M | 19.8% | 19.8% |
| Ecosystem | `0x30Ac…0Fb3` 500.0M, plus everything the Safe kept or sent elsewhere | 2,754.2M | 27.5% | 27.5% |

The pie and the chain agree to 0.1%. Messari's 23.5% / 19.5% (data "as of 2026-02-25", in USD.AI's Chinese
translation of the report) is superseded.

**Lockups are not enforced on-chain.** Every insider and reserve wallet above is a plain account (EOA), not a vesting
contract (Blockscout `is_contract: false`), and the CHIP token has no vesting logic. Investor wallets have already
moved tokens to sub-wallets:
- `0x3369…` sent 583.3M to `0x7e8d…8baB` (2026-05-15), plus 41.7M, 20.5M, 8.4M and 1.25M to others.
- `0x5744…` sent 327.3M to `0x62b9…0C0E` and 166.7M to `0x36ae…F1AE` (2026-05-20), plus small transfers through
  2026-11-13.

The large sub-wallets have not moved since. So the 12-month lock is a contractual or custodial promise, not a code rule.

### 1.2 The unlock curve: docs chart, measured

The chart was read pixel by pixel at every month position. Values are cumulative and stacked, in B CHIP; the
reading error is about ±0.02B.

| Chart mark | Ecosystem | + Investors | + Contributors | + Reserve = total |
|---|---:|---:|---:|---:|
| Q2'26 | 1.985 | — | — | 1.985 |
| Q1'27 | 2.180 | 2.180 | 2.180 | 2.180 |
| Q2'27 | 2.448 | 3.678 (inv 1.230) | 4.653 (con 0.975) | 5.463 (res 0.810) |
| Q1'28 | 2.576 | 4.543 (inv 1.967) | 6.109 (con 1.566) | 7.406 (res 1.297) |
| Q1'29 | 2.740 | 5.688 (inv 2.948) | 8.034 (con 2.346) | 9.971 (res 1.937) |

What the measurements show:
- **Investors, contributors and the reserve all follow the same curve.** Each is at 0 at Q1'27, about 41–42% at Q2'27
  (= 33% + 3 × 2.79%), 66.5% at Q1'28 (= 33% + 12 × 2.79%, exact) and about 100% at Q1'29. The chart therefore puts
  the reserve on the documented insider schedule, and starts the vesting clock at the Q1'26 mark.
- **Ecosystem**: 2.0B at TGE, about 16M/month to Q1'27, a step of about +0.27B over Q1'27–Q2'27, then about
  14M/month to 2.74–2.75B. This is the source of "2B unlocked in the first quarter after TGE, then 750M over 2 years
  9 months": that phrase describes the **ecosystem tranche only**.

### 1.3 Reconciling the circulating figures

| Figure | What it is | Verdict |
|---|---|---|
| 1.75B in April 2027 (our model) | 33% × (29.6% + 23.5%) of 10B | Wrong: leaves out the reserve and uses 23.5%. |
| **1.74B** ("at least", FuturesWire / newssignalsai, 2026-11-16) | 33% × (29.6% + 23.1%) | Correct for investors + contributors only. |
| **2.39B** | 33% × (29.6% + 23.1% + 19.8%) = 976.8 + 762.3 + 653.4M | **Docs-based cliff, including the reserve as the chart shows.** Plus ~15M of ecosystem that month → **≈2.41B new tokens in month 12 = 120% of today's 2B float.** |
| 2.76B (@Jimmyy_yyyy, 2026-11-09, "about 138% of today's reported float") | DefiLlama emissions model: investors 1,068.9M + contributors 836.2M + reserve 716.7M (≈36.1% each, i.e. 33% plus about one monthly step) + ecosystem tranche 141.67M, dated 2027-04-16 | Explained. Upper bound: assumes the first linear month lands with the cliff, and adds a modelled ecosystem tranche. DefiLlama's TGE date (2026-04-16) is also 5 days early. Source: `defillama-datasets.llama.fi/emissions/usd-ai` (`metadata.events`). |
| 2.0B circulating (CoinGecko, Binance Research, Blockscout) | The project-reported TGE float: "up to 2B or 20% of total token supply might be circulating" (Binance Research, 2026-05-22). Binance splits it as "Airdrop: 3% / ICO: 7% / Ecosystem Bootstrapping: 10%". | A flat reported number, not measured. See §6.3 for where those 2B actually sit. |

**Known vs assumed.** *Known*: tranche sizes (pie and chain agree), the 33% / 24-month rule for investors and
contributors (docs text), and the shape of the curve for all four tranches (docs chart). *Assumed*: (a) the exact
cliff day, which no source publishes: TGE + 12 = 2027-04-21; DefiLlama 2027-04-16; the chart's vesting clock starts
at the Q1'26 mark, so if its marks are quarter-ends the cliff would fall ~2027-03-31, one year after the mint;
(b) that the reserve follows the chart, since the docs text is silent; (c) the ecosystem drip, read off the chart.
Season 3's pool size is unpublished.

### 1.4 Month-by-month schedule, TGE to full unlock

Base case: docs vesting rule, with month 12 counted from the 2026-04-21 TGE; the reserve on the same rule (docs
chart); the ecosystem read off the docs chart. All values are cumulative M CHIP. The docs chart's own total at Q2'27
is 5,463M, against 5,448M in this table at month 15, which confirms the base case.

| # | Date (TGE + n months) | Investors | Contributors | Reserve | Ecosystem (chart) | Total unlocked | New this month | % of 10B |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2026-04-21 | 0 | 0 | 0 | 2,000 | 2,000 | +2,000 | 20.0% |
| 1 | 2026-05-21 | 0 | 0 | 0 | 2,015 | 2,015 | +15 | 20.1% |
| 2 | 2026-06-21 | 0 | 0 | 0 | 2,030 | 2,030 | +15 | 20.3% |
| 3 | 2026-07-21 | 0 | 0 | 0 | 2,045 | 2,045 | +15 | 20.4% |
| 4 | 2026-08-21 | 0 | 0 | 0 | 2,060 | 2,060 | +15 | 20.6% |
| 5 | 2026-09-21 | 0 | 0 | 0 | 2,075 | 2,075 | +15 | 20.8% |
| 6 | 2026-10-21 | 0 | 0 | 0 | 2,090 | 2,090 | +15 | 20.9% |
| 7 | 2026-11-21 | 0 | 0 | 0 | 2,105 | 2,105 | +15 | 21.1% |
| 8 | 2026-12-21 | 0 | 0 | 0 | 2,120 | 2,120 | +15 | 21.2% |
| 9 | 2027-01-21 | 0 | 0 | 0 | 2,135 | 2,135 | +15 | 21.4% |
| 10 | 2027-02-21 | 0 | 0 | 0 | 2,150 | 2,150 | +15 | 21.5% |
| 11 | 2027-03-21 | 0 | 0 | 0 | 2,165 | 2,165 | +15 | 21.6% |
| 12 | 2027-04-21 | 977 | 762 | 653 | 2,180 | 4,572 | +2,408 | 45.7% |
| 13 | 2027-05-21 | 1,059 | 827 | 709 | 2,269 | 4,864 | +292 | 48.6% |
| 14 | 2027-06-21 | 1,142 | 891 | 764 | 2,359 | 5,156 | +292 | 51.6% |
| 15 | 2027-07-21 | 1,225 | 956 | 819 | 2,448 | 5,448 | +292 | 54.5% |
| 16 | 2027-08-21 | 1,307 | 1,020 | 875 | 2,462 | 5,664 | +217 | 56.6% |
| 17 | 2027-09-21 | 1,390 | 1,085 | 930 | 2,477 | 5,881 | +217 | 58.8% |
| 18 | 2027-10-21 | 1,473 | 1,149 | 985 | 2,491 | 6,098 | +217 | 61.0% |
| 19 | 2027-11-21 | 1,555 | 1,214 | 1,040 | 2,506 | 6,315 | +217 | 63.1% |
| 20 | 2027-12-21 | 1,638 | 1,278 | 1,096 | 2,520 | 6,532 | +217 | 65.3% |
| 21 | 2028-01-21 | 1,721 | 1,343 | 1,151 | 2,534 | 6,748 | +217 | 67.5% |
| 22 | 2028-02-21 | 1,803 | 1,407 | 1,206 | 2,549 | 6,965 | +217 | 69.7% |
| 23 | 2028-03-21 | 1,886 | 1,472 | 1,261 | 2,563 | 7,182 | +217 | 71.8% |
| 24 | 2028-04-21 | 1,968 | 1,536 | 1,317 | 2,577 | 7,399 | +217 | 74.0% |
| 25 | 2028-05-21 | 2,051 | 1,601 | 1,372 | 2,592 | 7,615 | +217 | 76.2% |
| 26 | 2028-06-21 | 2,134 | 1,665 | 1,427 | 2,606 | 7,832 | +217 | 78.3% |
| 27 | 2028-07-21 | 2,216 | 1,730 | 1,483 | 2,621 | 8,049 | +217 | 80.5% |
| 28 | 2028-08-21 | 2,299 | 1,794 | 1,538 | 2,635 | 8,266 | +217 | 82.7% |
| 29 | 2028-09-21 | 2,382 | 1,859 | 1,593 | 2,649 | 8,483 | +217 | 84.8% |
| 30 | 2028-10-21 | 2,464 | 1,923 | 1,648 | 2,664 | 8,699 | +217 | 87.0% |
| 31 | 2028-11-21 | 2,547 | 1,988 | 1,704 | 2,678 | 8,916 | +217 | 89.2% |
| 32 | 2028-12-21 | 2,629 | 2,052 | 1,759 | 2,692 | 9,133 | +217 | 91.3% |
| 33 | 2029-01-21 | 2,712 | 2,117 | 1,814 | 2,707 | 9,350 | +217 | 93.5% |
| 34 | 2029-02-21 | 2,795 | 2,181 | 1,869 | 2,721 | 9,566 | +217 | 95.7% |
| 35 | 2029-03-21 | 2,877 | 2,246 | 1,925 | 2,736 | 9,783 | +217 | 97.8% |
| 36 | 2029-04-21 | 2,960 | 2,310 | 1,980 | 2,750 | 10,000 | +217 | 100.0% |

Cliff in dollars: 2.41B × $0.027 ≈ **$65M**. Each month after the cliff: insiders and reserve unlock 202.4M
(investors 82.6M, contributors 64.5M, reserve 55.3M) plus 14–89M of ecosystem, about **$5.9M/month at $0.027**.

**What has actually left the ecosystem pool so far [verified on-chain]** (Foundation Safe `0xE237…` transfers):
- 560.5M to the Season 1 claim contract on Mar 31.
- About 604M on Apr 20–25 to ~20 launch counterparties: 125M, 165M, 75M, 56.7M, 26M, 25M ×3, 16M, 15M ×2, 14M,
  10M, … (exchange, market-maker and launch allocations; unlabelled).
- 280M to `0x17aB…` (Apr 30 and Jun 2; Binance lists it as "Reserve"). It has paid out ~309M to about 30 wallets in
  round sizes (70.83M, 35.42M, 21.25M, …).
- 100M to `0xDdB0…` on Aug 4, which pays `0x12dC…991B` in monthly-looking tranches (55.6M, then 13.9M ×3).
- 225M to the Season 2 claim contract on Oct 20.
- About 17M in small grants (Sep).

The Safe still holds 467.3M; `0x30Ac…` (Eco1) still holds 494.0M.

---

## 2. Launch history (exact dates)

| Date (UTC) | Event | Source |
|---|---|---|
| 2025-08-20 | $13.4M Series A announced (see §3) | usd.ai/stories/usdai-raises-13M-to-scale-ai-infra |
| 2026-01-27 | USD.AI Foundation and $CHIP announced: "ICO and TGE will happen in Q1 2026"; "CHIP does not entitle holders to protocol revenue." | usd.ai/blog/usdai-foundation-chip |
| 2026-02-09 | ICO terms: CoinList, $0.03, $300M FDV, 700M CHIP (7%), 100% unlocked at TGE; KYC Feb 10–27 | usd.ai/blog/chip-ico-airdrop |
| 2026-02-12 | **Level Up** offer published (see below); "TGE for CHIP will be in March" | usd.ai/blog/level-up-finale |
| 2026-02-18 | Allo Game Season 1 ends; points frozen; no "alignment" = points burned | usd.ai/blog/allo-game-to-flatiron-level-up-guide |
| 2026-02-18–25 | Level Up offer window; YT multipliers raised to 60× for the final week | same |
| 2026-02-19 | Season 2 "Flatiron" starts | Allo S2→S3 post |
| 2026-02-22 23:00 – 02-27 23:00 | CoinList ICO. **Amount raised not published** in anything read. Dealroom lists a "$19M token sale, March 2026" **[unverified]**, which would be ~633M CHIP at $0.03. | — |
| 2026-03-02 | Messari "A Valuation of USD.AI ($CHIP)" (Jake Koch-Gallup) | Chinese translation on usd.ai/blog/usdai-chip-valuation-report-cn |
| 2026-03-31 08:25 | 10B CHIP minted to Foundation Safe; Season 1 claim contract funded with 560.5M; claims start (218M claimed on Apr 1, before any trading) **[verified on-chain]** | Blockscout, HyperSync |
| 2026-04-13–15 | Binance HODLer snapshot (BNB in Simple Earn / On-Chain Yields); 25M CHIP, 63rd HODLer project | Binance Research; secondary press **[unverified on Binance's own page]** |
| 2026-04-20 | Level Up airdrop participants paid in USDC (tx `0x01ac76f2…`) | chip-is-live post |
| **2026-04-21** | **TGE and trading.** Day-1 spot: Upbit, Robinhood, Binance, Bybit, Coinbase, Bithumb, Aerodrome, Kraken, KuCoin, MEXC, HTX, Bitvavo, Nexo, Gate. Perps: Binance, OKX, Bitget, Hyperliquid, Lighter. | usd.ai/blog/usdai-april-recap; chip-is-live |
| 2026-04-21–28 | "$CHIP peak 24-hour volume hit $1.3B"; Solana via Sunrise; Binance HODLer airdrop (distributed Apr 28 per secondary press); Anchorage custody; Cantor Fitzgerald brief | April recap |
| 2026-04-23 01:38 | ATH $0.140189 (CoinGecko) | CoinGecko |
| 2026-05-05 | Listed on Bitstamp by Robinhood | x.com/RobinhoodCrypto/status/2051674536286761357 |
| 2026-05-30 | Season 1 / ICO claim deadline. 27.4M was left unclaimed in the S1 contract and still sits there **[verified on-chain]** | chip-is-live; RPC |
| 2026-06-17 | Level Up 4-month maturity | chip-is-live |
| 2026-10-14 23:59 | Season 2 ends (ran Feb 19 – Oct 14) | Allo S2→S3 post |
| 2026-10-15 | Season 3 "Metropolitan" starts, runs to 2027-04-14; 8-month Level Up matures (CHIP plus USDC refund of the difference) | same |
| 2026-10-19/20 | Governance forum live; Season 2 claims open Oct 20 15:00 UTC (225M, "no lockup, no vesting", until 2027-01-31) | chip-governance-is-live; S2 post |
| 2026-10-26 14:02 | $1M buyback announced by USD.AI Inc. | X |
| 2026-10-28 11:00 | "The Compounding Economics of CHIP" proposal published | blog |
| 2026-10-27–30 | Two Snapshot votes pass (origination parameters; GLX sale parameters) | Snapshot |
| 2026-11-03 | @Chip_foundation X account opens; "USD.AI Foundation" renamed CHIP Foundation, "Permian Labs" renamed USD.AI Inc. | X; compounding post |

**Level Up, exactly** (usd.ai/blog/level-up-finale, 2026-02-12):
- *ICO path.* "BOOST OWN: Lock for 4 months — Full Refund Rights for 4 months @ $300m at anytime — Discount valuation
  of $270m FDV if held through maturity." "MAX OWN: Lock for 8 months … Discount valuation of $190m if held through
  maturity." Refund: "return your CHIP tokens and receive 100% of your original USDC/USDT contribution". Early unlock
  forfeits both rights.
- *Airdrop path* ("Premium Buyout"). BOOST EARN: $350M implied valuation; MAX EARN: $420M; "Capital for the premium
  buyout is sourced from other investors"; irreversible.
- *Qualifying.* "For every 1 $CHIP … USDai: ~0.18 YT, sUSDai: ~0.40 YT" (Pendle YTs locked).

**Level Up outcome [verified on-chain]** (vault `0x7297…90A2`):
- The vault took in 83.8M CHIP from the claim contract.
- 77.0M was withdrawn on Apr 21–24, when CHIP traded at $0.06–0.11 (2–3.7× the ICO price). Those holders gave up the
  refund and discount rights.
- 3.68M was claimed at the 8-month maturity on Oct 15.
- Refunds returned only ~0.30M CHIP to the Foundation (Aug 8–20, `withdrawRefund`).

**Season 1 airdrop [verified on-chain]** (claim contract `0x9A81…6a71`, implementation `ChipClaim`):
- 560.5M deposited; 533.1M claimed by **10,552 wallets**; top 10 claimers 46.5%, top 100 81.2%.
- 83.8M of the claims went into the Level Up vault.
- Binance labels this one address for both "Ecosystem Bootstrapping-Airdrop" and "-ICO", so the 560.5M probably mixes
  the airdrop (3% = 300M per Binance) and part of the ICO. The split is not resolvable from public data.

**Season 2 [verified on-chain]** (claim contract `0x0963…60f7`):
- 225M deposited Oct 20; **126.6M (56%) claimed by 2,116 wallets** by Nov 16 (57.3M on day 1); top 10 claimers 51%.
- 98.4M is still unclaimed (deadline 2027-01-31).
- The largest claim, 23.3M, went to an Avocado smart wallet (`0x4F6F…`). "The pool also covers CHIP for integration
  partners" (S2 post).

**Allo points mechanics:**
- S1 (to Feb 18): points plus an "alignment" choice of ICO or Airdrop; "If you have no alignment when the Allo Game
  ends, your Allo points will be burned."
- S2 Flatiron: "Multipliers range from 1x to 40x"; sCHIP earned "10x Allo™ points, based on dollar value staked";
  referral bonus 10%, up to 20% for approved creators.
- S2 result: ~955B points; the top 100 wallets earned 73%; Pendle and Fluid earned ~87% of deposit points.
- S3 multipliers (points per $ per day): sUSDai in wallet 1×, single-asset collateral 3×, Fluid smart collateral 4×,
  Pendle/Exponent LP 4×, sUSDai YT 6×, locked YT sUSDai (Feb 25 2027 expiry) 10×; USDai in wallet 2×, USDai DEX LP
  8×, USDai Pendle LP 8×, USDai YT 10×, locked YT USDai 15×; **CHIP LPs 12×**. "Locked CHIP and sCHIP do not earn
  Season 3 points." No referrals.
- Emissions per the Compounding post: 3% of supply in S1, 2.25% in S2. S3 size unpublished.

---

## 3. Investors and cost basis

| Round | Date | Amount | Lead / participants | Valuation | Source |
|---|---|---|---|---|---|
| Series A | 2025-08-20 | "$13 million" (title: $13.4M) | **Framework Ventures** (lead); Dragonfly, Arbitrum, Big Brain Holdings, CMT Digital, Hermeneutic Investments, FWL Capital, Flowdesk | $52M post **[unverified, Dealroom]** | usd.ai/stories/usdai-raises-13M-to-scale-ai-infra |
| Strategic | 2025-08-26 | undisclosed | YZi Labs | — | secondary press **[unverified]** |
| Round | 2025-09 | $4M | Bullish Global (per Dealroom) | $65M **[unverified]** | Dealroom |
| Debt facility | 2026-08 | $100M | Bullish | n/a (debt, not equity) | usd.ai blog "usdai-100m-bullish-gpu-financing-facility" |

No source states the token warrants. **Estimate, labelled as such:**
- If the ~$17.4M of disclosed equity bought the whole 2.96B investor tranche, cost is **≈$0.0059/CHIP** (FDV-equivalent
  ≈$59M). The Dealroom post-money values give $0.0052–0.0065 (valuation ÷ 10B).
- At $0.027, investors are **~4–5× in profit** before the cliff.
- ICO buyers at $0.03 are at −10%. Level Up MAX buyers ($190M FDV = $0.019) are at +42%. BOOST buyers ($270M =
  $0.027) are flat.

---

## 4. Value accrual: what is proposed and what is decided

Read in full: the Compounding Economics post (2026-10-28), the hurdle-rate post (2026-11-02), the Foundation post
(2026-01-27), CHIP Is Live (2026-04-22), CHIP Governance Is Live (2026-10-19), the October recap (2026-11-03), and
@0xZergs and @USDai_Official on X.

**Decided and done:**
- **One discretionary purchase**: "$1M of $CHIP bought back by USDAI Inc. 22,343,372 $CHIP purchased with USDC at an
  average price of $0.044756 across multiple exchanges." (X, 2026-10-26 14:02 UTC). The buyer is **USD.AI Inc., the
  company**, not the protocol or the Foundation. The money is the company's own: the Compounding post says "Any excess
  [origination fees] may fund CHIP purchases at USD.AI Inc.'s discretion, held by USD.AI Inc."
  @0xZergs: "we just did our 1st open market purchase of CHIP" (Oct 28).
- **The CHIP Hurdle Rate** (Foundation donations to sUSDai). The first donation was 127,927.66 USDai (Nov 1). The
  ongoing mechanism "will be finalized in an upcoming governance proposal", which had not been posted as of Nov 17.

**Proposed only** (blog, Oct 28; *not* on the forum, *not* voted on as of 2026-11-17):
> "The proposal is for all sUSDai net interest margin (NIM), net of CHIP Foundation costs, to go to programmatic CHIP purchases from today."

- *Who buys*: "the protocol purchases it with revenue". sUSDai NIM is the 10% protocol fee on sUSDai yield. Executed
  by the CHIP Foundation (implied, not stated).
- *Netted first*: "CHIP Foundation costs". The amount is not disclosed anywhere read.
- *Where the CHIP goes*: undecided. "Tokens held by CHIP Foundation or retired reduce circulating supply; tokens
  redistributed as rewards do not. The final mechanism will make that split explicit." "Programmatic describes how an
  approved allocation is executed, not a fixed purchase amount or an outcome."
- *Net deflation* requires "protocol purchases exceeding new issuance". After that, rewards move "from seasons to a
  monthly schedule funded by revenue". This is called "the hardening objective, not an automatic result".
- *Other revenue lines*: USDai NIM is off until a "$20 billion" marker ("not an automatic trigger"). Origination fees
  (2–3%) go to USD.AI Inc. Gain on sale is split 60% to USD.AI Inc. and 40% to the Yield Reserve; this split is
  **voted** in the GLX proposal (see §5). Platform revenue is "TBD".
- *Commit and compound*: "USD.AI Inc is another proxy of an entity purchasing CHIP over time, as a way to have
  institutional participants who would otherwise be unable to purchase CHIP, to get a proxied exposure through an
  equity vehicle (known as commit & compound)." @0xZergs (2026-07-01): "instead of 'buyback and burn' think 'commit
  and compound'". On 2026-10-28: "1) programmatic buybacks (once fully optimized) 2) discretionary buybacks (still
  optimizing/compounding)".

**Is the buyback on-chain? Partly [verified on-chain].** The purchases were made on centralised exchanges and are not
visible. The delivery is visible:
- Relay account `0x7391375e8b8Cbbe1e03A7EC1b3EE65961B38a2a6` withdrew from **Binance** (`0x3931…` "Binance 89",
  `0xB38e…` "Binance: Hot Wallet") and **Bybit** (`0xf89d…` "Bybit: Hot Wallet") on 2026-10-26.
- It sent 100 CHIP (08:26 UTC test) and then **22,343,272.96 CHIP** (19:46 UTC, tx
  `0x2bd55b0110f30fb4c47fe2c521940328b68509aff9fac98079e09aab419c3117`) to Gnosis Safe
  **`0xcd9CBb8490F9A8A155b250627a018d34d93e97c8`**. The balance, 22,343,372.96, matches the announcement to the token.
- The Safe has made **no outgoing transfer** and **has not delegated** (`getVotes` = 0) as of 2026-11-17. At $0.0275
  the holding is worth ~$0.61M (−39%).
- The relay is not exclusive to this buyback: it moved ~81M other CHIP between Oct 7 and Nov 11 to other accounts,
  so it is likely an OTC or execution desk. Its owner is unknown.
- **No further purchase**: no second announcement, and no inflow to the Safe since. Programmatic buying cannot have
  started, because the routing has not been voted.

**Money comparison (derived):**
- sUSDai NIM ≈ $267k over 30 days (DefiLlama revenue, read 2026-11-16, before Foundation costs) → ≈9.9M CHIP/month at
  $0.027 = **0.5% of float per month**, ≈$3.2M/yr. Others got similar figures: 0xMadaba "~$3.7M/yr"; @Axel_Mnvn
  "~$218k/mo … Covers ~1% of the cliff" over six months.
- **Against supply**: month-12 cliff ≈2.41B; then ~217M/month. A year of NIM buys ≈120M CHIP at today's price, ≈5% of
  the cliff.
- **Against the hurdle rate**: the first top-up cost $127.9k for 17.8 days (≈$2.6M a year if repeated). That is about
  as large as all of NIM. The two compete for the same scale of money, and the Yield Reserve is "funded by the
  treasury first".

---

## 5. Governance

**Forum** (governance.usd.ai redirects to governance.chipfoundation.ai). All topics and replies read 2026-11-17 via
`/latest.json` and `/t/<id>.json`:

| Topic | Created | Replies | Content |
|---|---|---|---|
| 39 Welcome to CHIP Governance | 10-14 | 0 | Process (CRFC ≥4 days → Snapshot → on-chain). On-chain governors: **Routine**: threshold 50M CHIP, quorum 3% of supply, voting 3 days, timelock 1 day. **High Impact**: threshold 125M CHIP, quorum 7%, voting 10 days, timelock 1 day. "Discourse will open for community participation at a later date." |
| 40 [CRFC] Origination Parameters | 10-19 | 1 community (@Bobby: the parameters read as "trust me"); @Conor (staff) replies "To-date, there have been no defaults across the loan book." | Max blended LTV 80%, DSCR ≥1.15×, Compute IQ ≥60, utilisation ≤90%, approved GPUs |
| 44 [CRFC] GLX sale parameters | 10-22 | 0 | Par minimum (99.5 only in a verified liquidity shortfall); **positive net gain 60% to USD.AI Inc. "for facilitating the sale", 40% to the Yield Reserve** |

There is no topic on NIM routing, buybacks or the hurdle rate. The last post was Oct 28 ("moved to Snapshot voting and
is closed").

**Snapshot** (space `usdai.eth`, "CHIP Foundation", strategy erc20-votes on the Arbitrum CHIP; hub.snapshot.org GraphQL):

| Proposal | Voting | Result | Voters |
|---|---|---|---|
| [CRFC Snapshot] Origination Parameters | 10-27 23:20 → 10-30 23:20 | For 2,357,989,592; Against 0 | 3 |
| [CRFC Snapshot] GLX sale parameters | 10-27 23:23 → 10-30 23:23 | For 2,357,989,592; Against 0 | 3 |

- `0x582c45aC2947abE3Cd6170B5D8d966CaECa67b6b` cast 2,357,951,454 votes (99.998%). It holds 0 CHIP.
  **[verified on-chain]** `delegates()` shows the votes come from:
  - reserve wallets `0x403f…`, `0x45F3…`, `0x8e80…` (and very probably `0xd6D8…`; the sum fits);
  - contributor wallets `0x6c00…` and `0xAdFe…`.
- The investor wallets, the largest contributor wallet and the ecosystem wallets have **not delegated**, so their
  votes are idle.
- The other two voters had 33,887 and 4,251 CHIP.
- Snapshot admin: `0x034d…FC6B`, which also took the very first Season 1 claim (team test).
- Implication: one Foundation and team delegate holds 23.6% of supply as votes, 3.4× the High-Impact quorum. Every
  vote so far has been decided by it.

**CHIP contract powers** (`data/abi/chip.json`): ERC20Votes with `TRANSFER_ADMIN_ROLE`, `REVOKE_DELEGATE_ADMIN_ROLE`
(an admin can revoke delegations), `isBlacklisted` and an upgradeable proxy.

---

## 6. sCHIP, holders and float

### 6.1 sCHIP (insurance module)

Contract `0x0D2d…4D4A` (proxy; implementation StakedChip). From the ABI and live RPC, 2026-11-17:
- ERC-4626 vault with CHIP as the asset. `convertToAssets(1e18)` = **1.000**: no reward accrues inside.
- Functions are deposit, mint, withdraw and redeem only: **no cooldown, no slashing function**. Pause and blacklist
  roles exist.
- totalSupply = totalAssets = **41,988,162.6 CHIP**, i.e. 0.42% of supply and 2.1% of float.
- History from the Deposit/Withdraw logs [verified on-chain]: 786 deposits (90.5M), 371 withdrawals (48.5M); 249
  current stakers, **top 10 = 94%**. 0.6M on Apr 21; 16.6M by Apr 30; 27.5M on Aug 1; **peak 55.5M on Sep 23**;
  50.2M on Oct 14 (end of S2); 45.1M on Oct 15; 42.0M now. Stakers left when S3 removed the points.

Docs today: "Staking of CHIP is currently not in use for any protocol functions. You can unstake any previously staked
CHIP". The January promise was "Stake CHIP in the insurance module to protect sUSDai holders against bad debt". X
threads claiming "staked CHIP can be used to cover the shortfall" describe a plan, not the contract.

### 6.2 Holders [verified, Arbiscan + Blockscout, 2026-11-17]

- **Arbitrum: 6,827 holders**; 2,106,156 transfers. Top 5 = 48.6% and top 10 = 71.6% of supply; 18 holders hold
  ≥1%. Wallets worth more than $1k: 535; more than $10k: 337.
- **Ethereum: 728 holders**, 8.51M CHIP bridged (Blockscout).
- Base and Solana: not read (Blockscout Base sits behind Cloudflare; Solscan not tried).

Top holders, labelled:

| Rank | Address | CHIP | Label |
|---|---|---:|---|
| 1 | 0xd734…8c75 | 1,640.4M | Core contributors (Binance Research) |
| 2 | 0x5744…1Ce8 | 1,281.5M | Investors |
| 3 | 0x45F3…f45b | 694.5M | Reserve (delegated to 0x582c) |
| 4 | 0x8e80…93dd | 659.9M | Reserve (delegated) |
| 5 | 0x7e8d…8baB | 583.3M | Investor sub-wallet (from 0x3369, May 15) |
| 6 | 0x3369…c42b | 507.3M | Investors |
| 7 | 0x403f…89cA | 500.0M | Reserve (delegated) |
| 8 | 0x30Ac…0Fb3 | 494.0M | Ecosystem |
| 9 | 0xE237…a05 | 467.3M | Foundation Safe (ecosystem; minted the supply) |
| 10 | 0x62b9…0C0E | 327.3M | Investor sub-wallet (from 0x5744) |
| 11 | 0x6c00…b2Cf | 214.1M | Contributors (delegated) |
| 12 | 0xF977…aceC | 182.1M | Binance: Hot Wallet 20 |
| 13 | 0xAdFe…576F | 169.4M | Contributors (delegated) |
| 14 | 0x36ae…F1AE | 166.7M | Investor sub-wallet |
| 15 | 0x07Cf…ACD | 129.3M | Upbit deposit |
| 16 | 0xd6D8…ae1 | 120.0M | Reserve |
| 17 | 0xffC1…cF4e | 114.3M | CHIP OAdapter (bridge lock, `OLockAdapter`) |
| 18 | 0x1d48…0270 | 100.0M | Unlabelled; withdrew 100M from Robinhood on 2026-11-11 |
| 19 | 0x0963…60f7 | 98.4M | Season 2 claim contract (unclaimed) |
| 20 | 0x841e…3a34 | 92.1M | Robinhood |
| 27 | 0x0D2d…4D4A | 42.0M | sCHIP |
| 30 | 0x4934…25e9D8 | 40.6M | Uniswap v3 pool |
| 37 | 0x9A81…6a71 | 27.4M | Season 1 claim contract (forfeited remainder) |
| 41 | 0xcd9C…97c8 | 22.3M | **USD.AI Inc. buyback Safe** |

### 6.3 Where the "2B circulating" sits

Out of the 10B supply:
- **The locked 8B**: insiders and reserve, 7.25B. Investors 2.96B (in 0x3369, 0x5744 and three sub-wallets);
  contributors 2.31B (7 wallets plus small grants); reserve 1.98B (4 wallets). Plus the not-yet-scheduled ecosystem
  remainder.
- **Ecosystem tokens still under Foundation control: ≈1.10B.** Eco1 494.0M, Foundation Safe 467.3M, S2 claim 98.4M,
  S1 claim 27.4M, `0x17aB` 15.9M.
- **Truly outside the project ≈1.65B.** Of this, labelled exchange wallets on Arbitrum hold **≈750M**: Binance 287M,
  Bybit 134M, Upbit 129M, Robinhood 96M, OKX 62M, Gate 22M, Kraken 6M, Bitvavo 6M, KuCoin 5M, Bithumb 3M. That is
  ≈45% of the real float, or 37% of the nominal 2B. Exchange deposit addresses below rank 150 are not counted, so
  this is a lower bound.
- Bridged out: 114.3M locked in the adapter.
- DEX pools: ≈43M on Arbitrum.
- Staked: 42M.
- Buyback Safe: 22.3M.

---

## 7. Market

Daily closes are CoinGecko 00:00 UTC points, so a move shows up the day after it happens.

| Date | Price | Move | Explanation (source) |
|---|---|---|---|
| 04-21 | $0.0636 | TGE | 14+ spot venues, 5 perp venues |
| 04-23 | $0.113 close (ATH $0.140 intraday) | +84% | Launch spike; volume $1.64B on CoinGecko ("peak 24-hour volume hit $1.3B", April recap) |
| 04-25 → 05-30 | $0.085 → $0.039 | −65% | 100%-unlocked ICO and airdrop supply. Season 1 claims reached 10,552 wallets. Level Up lockers withdrew 77M CHIP on Apr 21–24. Binance HODLer added 25M. Labelled exchange wallets received a net +735M CHIP from outside senders in the first 9 days (partial pull; includes market-maker inventory). |
| 05-09 | $0.0725 | +28% | Not explained by anything read |
| 08-09/10 | ATL $0.0216 | — | Volume fell to $3.7M/day by Aug 1 |
| 09-02 → 09-04 | $0.039 → $0.056 | +14%, +31% | BTC +5% on Sep 4; no CHIP-specific cause found |
| 10-10 → 10-11 | $0.052 → $0.068 | +30.7% | @0xZergs "The Copernican Model" (Oct 10 10:57 UTC) hints at token alignment |
| 10-13 | $0.058 | −15% | Season 2 ends Oct 14; claims open Oct 20 (57M claimed day 1) |
| 10-26 → 10-27 | $0.044 → $0.051 | +16.4% | $1M buyback (Oct 26 14:02 UTC). Same day: Musk's neocloud-financing remark (0xMadaba, X) |
| 10-28 → 10-30 | $0.054 → $0.043 | +5.7%, −8.9%, −12.5% | Compounding proposal "sell the news"; BTC −4.2% on Oct 30 |
| 11-06 | $0.0367 | −15.4% | BTC −5.5% |
| 11-15 | $0.0263 | −17.2% | BTC −6.1% sell-off; "flushes 17.7% on 2.3x volume" (Finora, X) |
| 30 days to 11-16 | | **CHIP −43% vs BTC −21%** | About 2× beta to a market-wide fall, plus a CHIP-specific overlay. The April-cliff narrative spread: @Jimmyy_yyyy Nov 9 "Brutal Cliff"; FuturesWire Nov 16 "at least 1.74 billion tokens – Apr 2027", "95% Bearish". Public shorts were posted (@RareFishhw from Nov 7, "+45%"). **No delisting, no insider-wallet selling and no scheduled unlock was found.** The only November insider transfer was 8.33M from `0x5744` to a fresh wallet that still holds it (Nov 13). The large November transfer was a **withdrawal** of 100M from Robinhood (Nov 11), which is accumulation or custody, not selling. |

From launch (Apr 22) to Nov 16: CHIP −56%, BTC −15%. Perps listed: Binance, OKX, Bitget, Hyperliquid, Lighter (plus
Pacifica per X). **Funding and open interest were not read** (gap). Venue volume split: CoinGecko tickers were not in
the saved file (gap).

---

## 8. Valuation work by others

| Analyst (date) | Method | Numbers | Read |
|---|---|---|---|
| **Messari**, Jake Koch-Gallup (2026-03-02). The report says it was commissioned by USD.AI. | Two lenses: (1) buyback-backed: 5-year distributable surplus × terminal multiple, discounted, × buyback ratio 50% × efficiency 75%; (2) insurance-capital solvency floor | **Buyback FDV $46.4M / $329.6M / $1.74B** (bear / base / bull). **Insurance floor FDV $270.1M / $275.6M / $503.2M.** Assumptions: GPU capex $250B in year 1; financeable share 15/25/35%; USD.AI share 0.5→1.5%, 0.75→1.75%, 1.0→2.5%; pipeline $469M→$2.36B (base); funding conversion 75→95%; borrower APR 15%; idle yield 3.6%; sUSDai cost 9.0→10.8%; Barkr warranty 0.5%; opex $5M + 0.25% of loans; multiples 8/15/25×; discount rates 25/20/15%; insurance coverage 7.0/4.5/3.5%, staking participation 25/40/55% | Full Chinese translation on usd.ai (English original walled on Messari / Blockworks). **Today's FDV ($270M) sits at Messari's base-case insurance floor and below its base buyback value.** But the insurance module does not exist in the contract, and buybacks are not yet voted. |
| **castle_labs** (2026-04-23) | CHIP FDV ÷ USDai market cap, against Ethena | "$ENA started trading at 5.7x, peaked at 9.4x, and hit lows of 0.2x. $CHIP started trading at 2.4x and is now trading at ~4x, with the $USDai market cap currently at $280m." | Same ratio today: FDV $270M ÷ USDai $156M (DefiLlama, Nov 16) = **1.7×**; market cap ÷ USDai = 0.35×. castle_labs' Nov 4 piece is an interview with the CEO, with no valuation. |
| **@Jimmyy_yyyy** (2026-11-09) | Scorecard | "Token Economics — 4/10 … Overall Grade — C"; "I'd want several months of executed, fee-funded buybacks before calling CHIP cheap" | Retail. Quotes DefiLlama's 2.76B. |
| **0xMadaba / @Axel_Mnvn** (2026-10-28) | Buyback sizing | ~$3.7M/yr; ~$218k/mo ≈ 4M CHIP/mo at $0.05 | Matches the §4 figure |
| Pine Analytics "The Bear Case for $CHIP" (2026-01-28) | Peer multiples | Taken secondhand from the existing notes: FDV/TVL 1.2× Ethena and 2.9× Maple; peer-implied FDV $105–250M | **Not re-read this cycle** |
| Blockworks Research "CHIP Rips?"; Blockmedia 1123140 | — | — | **Not read** (walled or budget). Gap. |

**Comparable designs** (search results; aggregator-grade, **[unverified]** unless noted):
- **Maple SYRUP**: staking ended (MIP-019, late 2025). 25% of revenue goes to a "Syrup Strategic Fund" for buybacks.
  MIP-021 (first buyback Aug 2026) ties buybacks to monthly revenue, reportedly rising to 30% above $2M of revenue.
  Example: 2M SYRUP bought with 25% of November-2025 revenue. A tracker shows 2026 H1 revenue $52.3M, of which
  $1.7M went to token holders (≈3%).
- **Ethena ENA**: fee-switch proposal (Aug 2026, Snapshot `ethenagovernance.eth`). ~95–100% of net revenue to ENA
  purchases, but only once USDe supply reaches **$7.5B** (it was ~$4.1B in late August). Final status not verified.
- **CHIP comparison**: the proposal sends 100% of sUSDai NIM (net of Foundation costs), but NIM is only ~10% of vault
  yield. Today that is ≈$3.2M/yr, i.e. **≈5.9% of a $54M market cap** or 1.2% of FDV a year, if it is passed and run
  at today's revenue.
- Sky and GAIB: not researched (budget). Gap.

---

## 9. What this changes on the dashboard: the ten facts most worth showing

| # | Fact | Chart or table | Data source |
|---|---|---|---|
| 1 | **Month-12 cliff ≈2.41B CHIP (120% of float, ≈$65M), then ~217M/month to Apr 2029.** The reserve vests on the same curve. | Stacked area of cumulative unlocked supply by tranche (the §1.4 table), with a "today" line and a cliff annotation; a bar for new tokens per month | §1.4 table (docs text + measured docs chart); add DefiLlama's 2.76B as a dashed alternative |
| 2 | **The pie is confirmed on-chain, but lockups are not enforced by code** (insider wallets are ordinary accounts) | Sankey from the minting Safe to the tranche wallets (Apr 24 funding), each labelled with its contract type | Blockscout transfers of `0xE237…a05`; Binance Research wallet list |
| 3 | **Where the 2B float actually sits**: ~1.10B Foundation-controlled, ~750M on exchanges, the rest in user hands, DEX pools, bridge and staking | Single horizontal 100% bar (waffle), split Foundation / exchanges / bridge / DEX / sCHIP / buyback Safe / other holders | Arbiscan top-150 with labels plus Blockscout holders; RPC `balanceOf` |
| 4 | **The buyback is verifiable**: 22,343,372.96 CHIP delivered from Binance and Bybit to Safe `0xcd9C…`, unmoved and undelegated; no second buyback | Timeline with the X announcement, the on-chain delivery tx, and the Safe balance line (flat) | HyperSync CHIP Transfer logs for `0x7391…` and `0xcd9C…` |
| 5 | **Proposed buyback vs supply**: NIM ≈$267k/month buys ≈10M CHIP, against a 2.41B cliff | Two bars on one scale (12 months of NIM-funded buying vs cliff vs one post-cliff month), plus a price-sensitivity slider | DefiLlama revenue (`/summary/fees/usd-ai`, dataType revenue) + §1.4 |
| 6 | **Hurdle-rate top-ups compete with buybacks for the same money** ($127.9k for 17.8 days ≈ half a month of NIM) | Monthly paired bars: NIM vs CHR donation vs CHIP purchased | sUSDai `Donated` events (in `susdai.jsonl.gz`) + DefiLlama revenue |
| 7 | **Governance is one delegate**: 2.358B votes (23.6% of supply) cast 99.998% of both Snapshot votes; 3 voters in total | Stacked bar of voting power per proposal; a small table of which wallets delegate to `0x582c…` | Snapshot GraphQL (`usdai.eth`); CHIP `delegates()` / `getVotes()` |
| 8 | **Launch distribution and its result**: S1 claimed by 10,552 wallets; Level Up 92% withdrawn in 4 days; S2 56% claimed by 2,116 wallets, 98.4M left before Jan 31 | Cumulative-claims curves for the S1 and S2 contracts; a callout for the Level Up vault | HyperSync logs of `0x9A81…`, `0x0963…`, `0x7297…` |
| 9 | **sCHIP is a points wrapper, not insurance**: no slashing or cooldown; staked peaked at 55.5M (Sep 23) and fell when S3 removed the points | Line of staked CHIP with Season boundaries marked; a spec card listing the contract functions | `schip.jsonl.gz` Deposit/Withdraw; ABI; RPC |
| 10 | **Price against what moved it**, plus cost bases: investors ≈$0.006, ICO $0.03, Level Up $0.019 / $0.027, buyback $0.0448; 30-day beta to BTC ≈2× | Price line with dated event markers (§7) and horizontal cost-basis lines; small multiple of CHIP vs BTC indexed to 100 | CoinGecko `chip-2` and `bitcoin` market_chart; §3; X / blog dates |

Also worth one line on the CHIP tab: the Messari scenario FDVs ($46M / $330M / $1.74B) against today's $270M, with the
note that it was commissioned by USD.AI and assumes an insurance module the contract does not have.
