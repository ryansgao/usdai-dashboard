# USD.AI and CHIP: research notes

> **First-pass notes (2026-11-16).** Superseded where they conflict by the primary-source studies in this folder:
> `protocol-and-loans.md` (loan book with named borrowers, attestation, yield sources, liquidity, credit risk) and
> `chip-token.md` (allocation from the docs' images, month-by-month unlocks, buyback on-chain trace, governance,
> holders). Known corrections: CHIP launched Apr 21 (not Apr 30); the April 2027 unlock includes the reserve (~2.4B);
> the $1M buyback was announced Oct 26; the Duos "GLX sale" was a payoff by the borrower's buyer; USDai was backed
> by USDC and wrapped M before Feb 2026.

Working notes behind the dashboard. Every fact carries the date it was checked and its source. Numbers from the
protocol's own blog are marked *(self-reported)*; on-chain figures are reproduced by `pipeline/` and shown on the
page. Checked 2026-11-16 unless marked.

## 1. What USD.AI is, in one paragraph

USD.AI lends stablecoins to companies that buy GPUs (neoclouds), with the GPUs as collateral. Depositors put in
PYUSD and get **USDai**, a dollar token 100% backed by PYUSD that earns nothing. Staking USDai gives **sUSDai**, a
vault share whose price rises as borrowers pay interest and as idle cash earns a T-bill style yield. Exits from
sUSDai go through a 30-day redemption queue, because the cash is out on loan. **CHIP** is the governance token. It
has no legal claim on revenue, but since 28 Oct 2026 the company has bought CHIP with protocol income and proposed
to make that permanent.

## 2. Mechanism, with parameters

### USDai (docs.usd.ai/depositor/usdai)
- "USDai is a stablecoin fully backed by PYUSD." Mint on Arbitrum, Ethereum, Base, Plasma; Arbitrum is the hub
  (the other chains hold LayerZero OFT copies, bridged through adapters on Arbitrum).
- No yield on USDai itself. Minting and redemption permissionless at contract level; AML controls on frontend and
  contract.
- The PYUSD inside earns PayPal's 4.5% PYUSD incentive (borrower docs; Jupiter risk report 2026-09-09: "$288.4M in
  PYUSD (52.3% of reserves) at 4.5% APY"). That yield is harvested into sUSDai as "base yield".
- USDai's own fee switch is off; the company says it will turn on once USDai outstanding reaches "$20 billion"
  (compounding-economics post, 2026-10-28).

### sUSDai (docs.usd.ai/depositor/susdai; blog "How sUSDai yield works", 2026-11-02)
- ERC-4626 style vault with ERC-7540 asynchronous redemption. Price-accruing, not rebasing.
- Yield sources: borrower interest (loans 7-15% APR by LTV and offtake type; "mid-teens APR" in borrower docs),
  base yield on idle PYUSD, escrow interest (loans in escrow earn 6-8%, new escrows targeted at 10%+).
- **10% protocol fee on sUSDai yield** ("10% of the yield earned, not ten percentage points of APY"). This is the
  "sUSDai net interest margin" (NIM). On-chain the base-yield part shows up as `BaseYieldDeposited(depositedAmount,
  adminFee)`.
- **Two share prices**: deposit price accrues every second and prorates expected repayments; redemption price
  counts interest only once it is paid. Both net of the 10% fee.
- **Redemptions**: global 30-day epoch, FIFO from available cash; "The protocol does not prematurely terminate or
  liquidate active GPU loans to satisfy redemptions." Unfilled requests roll to the next epoch. Payment day moving to
  the 2nd of each month (needs a contract upgrade). QEV (bid for queue priority) is described but the sUSDai page
  says it is "planned but not yet implemented".
- New loans only up to **90% sUSDai utilization**.
- **CHIP Hurdle Rate (CHR)**: if a 30-day period earns under 7% annualized on the deposit price, the CHIP Foundation
  donates USDai to the vault to bring it to 7%, "subject to available capital", never above 7%. First use:
  127,927.66 USDai donated 2026-11-01 18:54 UTC for the period 15 Oct-1 Nov (17.79 days). Deposit price 1.118800
  (Oct 15) -> 1.122360 projected without donation (6.53% annualized) -> 1.122617 target (7%). 497.84M shares
  outstanding; 105.31M shares redeemed in that period. Redeemers left +1.04 pts behind, so holders who stayed
  earned ~8.04%. Funded later by a Yield Reserve (treasury first, then 40% of gain on sale).

### Loans (docs.usd.ai/borrower/overview, usdai/risks-and-mitigants)
- Non-recourse loans to bankruptcy-remote SPVs that own the GPUs. Monthly payments, "mid-teens APR and 3-year
  principal amortization". Lender of record GPU Finance Ltd.; agent GPU Servicer LLC; escrow agent Wilmington Trust.
- Debt service reserve ~10% of gross loan (borrower page) / 1-3 months of peak debt service (risks page).
- Limits (first governance proposal, Oct 2026): blended LTV <= 80% (70-80% per loan), quarterly portfolio DSCR
  >= 1.15x, Compute IQ score >= 60, utilization <= 90%. Collateral: NVIDIA B200/B300/GB200/GB300/VR200, AMD
  MI455X/MI430X; Cerebras/Etched only with contracted offtake.
- Default path: default interest from the day after a missed payment; agent first keeps the operator running, then
  sells the SPV whole, then sells servers through ITAD firms.
- **Escrow stage**: a loan is first funded into escrow while hardware ships and installs; it earns the escrow rate
  (6-8%) until released into an operating loan. On-chain: `LoanEscrowTimelockDeposited/Withdrawn/Cancelled` and
  `LoanDepositTimelockDeposited/Cancelled` on the sUSDai vault.
- **GLX (GPU Loan Exchange)**, launched 2026-10-01: loans can be sold whole or in part to institutions after
  "seasoning" (target weighted holding period ~90 days). First sale: the $98.1M Duos Edge AI facility ("closed at
  par"). NexGen Cloud $106M facility (1,728 B300s, Finland) financed through GLX on 2026-10-29 with Silver Point and
  Victory Park taking positions at origination. "$200M+ through GLX in its first month" *(self-reported)*. Sale
  spread today "about 1 to 2%", target 5-6% once ABS markets open.
- **Proof of Loans**: agreed-upon-procedures report by The Network Firm LLP, snapshot 2026-07-15 (not an audit).

### On-chain contracts (Arbitrum; docs.usd.ai/technical-overview/contract-addresses, Sourcify exact match)
| Contract | Address | Implementation (2026-11-16) |
|---|---|---|
| USDai | 0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF | USDai 0xe6ee…a6f9 |
| sUSDai | 0x0B2b2B2076d95dda7817e785989fE353fe955ef9 | StakedUSDai 0xb4ff…d055 |
| Loan Router (v1) | 0x0C2ED170F2bB1DF1a44292Ad621B577b3C9597D1 | LoanRouter 0xa546…fc8b |
| **Loan Router v2** | **0x1c2ed170de32846316784c4fd58a5e3c7563e12f** | LoanRouterV2 0x5f4f…f671 |
| CHIP | 0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e | Chip 0x13ae…a03f |
| sCHIP | 0x0D2d2D20962F2468566F4D1a4DdeB482915C4D4A | StakedChip 0x188f…bc49 |
| Base Yield Escrow | 0x9Ddfd49AC4689CF894203794d792dcB38E4b1A9E | BaseYieldEscrow 0x3eff…8acb |
| Deposit Timelock | 0x0D710CC05f34d2eaD9fbA3c78d53d76a0623c9F8 | DepositTimelock 0x95bb…344c |

Finding: **Loan Router v2 is not in the docs' address list.** All 17 loans still open on v1 were moved to it by
`LoanMigratedOut` between 2026-06-26 and 2026-07-03 (tx 0xd7be…9cf1 shows the v1 router burning the lender NFT and v2
minting a new one to the sUSDai vault). v2's `LoanOriginated` carries the whole loan terms (borrower, tranches with
lender, amount and rate, duration), so the loan book can be rebuilt with rates from events alone. v2 also has
`LoanBreached` (a covenant or payment breach flag) and `LoanRefinanced`.

## 3. CHIP

- Governance token, 10,000,000,000 max supply, OFT on Arbitrum/Base/Ethereum + Solana (NTT).
- Live April 2026 (ICO on USD.AI's own sale; TGE 2026-04-30 per Blockmedia). Launch FDV ~$300M (Pine Analytics,
  2026-01-28) after an ICO priced at "$270M / $190M FDV" levels.
- Allocation (Messari/Blockworks; docs show it only as an image): investors 29.6%, ecosystem bootstrapping 27.5%
  (first 10% to Season 1 airdrop), core contributors 23.1-23.5%, reserve 19.5-19.8%. Investors and contributors:
  12-month cliff from TGE, 33% at month 12, rest monthly over 24 months -> **first big unlock ~2027-04-30**.
  Reserve is Foundation-controlled with no published schedule (Blockworks).
- Emissions: 3% of supply in Season 1, 2.25% in Season 2 (compounding-economics post). Season 2 airdrop 225M CHIP
  claimable with no lockup until 2027-01-31. Season 3 runs to 2027-04-14.
- "CHIP does not entitle holders to protocol revenue" (Foundation post, 2026-01-27).
- sCHIP: staking exists ("live and earning Allo points") but docs: "Staking of CHIP is currently not in use for
  any protocol functions." Planned as an insurance module (first-loss backstop for sUSDai).
- Governance forum live 2026-10-19 (governance.chipfoundation.ai). Three topics as of 2026-11-16: origination
  parameters, GLX sale parameters, welcome. No buyback / fee-routing proposal posted yet.

### Buybacks
- **2026-10-28**: USD.AI Inc. (the company, not the protocol) bought **22,343,372 CHIP at 0.044756 USDC = $1.0M**
  "across multiple exchanges" (October recap, 2026-11-03). CHIP +19% that day (AMBCrypto via KuCoin).
- Same day, proposal "The Compounding Economics of CHIP": route **all sUSDai NIM, net of CHIP Foundation costs,
  to programmatic CHIP purchases "from today"**. Origination fees (2-3% per loan) and most gain on sale reinvested
  by the company; 40% of gain on sale to the Yield Reserve. "Net deflation is the hardening objective, not an
  automatic result of purchases."
- Earlier: 2026-10-12, CHIP +29% in a day on David Choi's "commit-and-compound" framing (an operating company buys
  and holds CHIP rather than burning it).
- Company's revenue claim: "$1B of deposits produces roughly $20 million to $40 million of revenue a year";
  "$1B in originations ... $30M in annual revenue" (Jan post). Targets, not results.

## 4. Self-reported metrics over time (protocol blog)

| As of | TVL | Loans / financing | Net APY | Source |
|---|---|---|---|---|
| 2026-01-28 | $656M | ~$70M pipeline, ~10% utilization | 6.87% | Pine Analytics |
| 2026-06-08 | $398M | $202M deployed, 13 active loans, largest $98.1M | 7.0% avg YTD | Lighthouse YTD report |
| 2026-08-01 | ~$400M (peak ~$700M near TGE) | 11 active ~$100M at 11.5% avg + 3 escrow $153.8M at 11.6% | 7.69% (Jul 31) | Blockmedia |
| 2026-09-09 | $551.2M; sUSDai $463.6M | $288.4M idle PYUSD (52.3%) | 8.28% gross / 7.03% net | Jupiter Lend risk report |
| 2026-10-02 | $659M+ | $420M+ lifetime deployed | 6.9% | September recap |
| 2026-11-03 | $474M | $531M lifetime across 20 financings | 7.00% (with CHR) | October recap |
| 2026-11-04 | $468M sUSDai | $306.3M lent across 18 loans; pipeline $237M | 6.88% net / 8.14% gross | thelearningpill |

Revenue claims: ARR $1.1M (2025), $4.0M (Q1 2026), Q2 2026 "annualized DAO ARR" $30M (Lighthouse); gross profit
$963,740 Q1 -> $5.1M Q2 (Blockmedia). Definitions differ; not comparable to DefiLlama's revenue series.

## 5. Third-party data (DefiLlama, fetched 2026-11-16)

- Protocol `usd-ai`: TVL = idle PYUSD + claimable yield; loan principal reported separately as "borrowed".
  2026-10-31: TVL $274.3M, borrowed $306.1M. 2026-11-03: TVL $168.4M. 2026-11-15: TVL $157.2M, borrowed $305.5M.
  **~$106M left between 31 Oct and 3 Nov**, the first redemption payout under the hurdle-rate regime (to check
  against `RedemptionsServiced` on-chain).
- Hallmarks: deposit caps raised to $250M (2025-09-12) and $500M (2025-09-26).
- Fees all-time $31.6M, revenue (admin fee) all-time $7.96M; 30d fees $2.67M, revenue $267k. Fee "genuine spikes":
  2026-04-28 PYUSD yields harvested; 2026-06-04 $3M origination fee from Duos Edge AI.
- Yields pool `712ce948…` (sUSDai, "30d unlock"): TVL $440.1M, APY 6.77% (2026-11-16).
- Pendle PT-sUSDai 25 Feb 2027: implied fixed 8.94%; PT-sUSDai 24 Jun 2027: 8.82% (market's price for locked
  sUSDai yield, above the vault's trailing APY).
- sUSDai as collateral: Fluid lending (Arbitrum, Ethereum, Plasma, Base ~ $120M), Morpho, Jupiter Lend, Kamino,
  Euler (Plasma), Curve/Fluid DEX pools.
- Stablecoins `309` (USDai): circulating $156.5M across Arbitrum, Plasma, Ethereum.

## 6. Views from analysts (for the bull / bear section)

- **Pine Analytics, "The Bear Case for $CHIP" (2026-01-28)**: "USD.AI is asking investors to pay more for less."
  TVL $656M but ~99% in Treasuries, ~$70M pipeline; launch FDV $300M = 1.2x Ethena's FDV/TVL, 2.9x Maple's; implied
  FDV at peers' multiples $105-250M. Borrowers pay 15-20% vs 4-5% for hyperscalers. Calls a rally "a short
  opportunity rather than a long-term hold".
- **Blockmedia (2026-08-01)**: bullish; "one of the few crypto protocols generating real cash flow amid the AI
  frenzy"; caveat "only two quarters of revenue data". GPU depreciation ~20%/yr.
- **Blockworks Research "CHIP Rips?"** and **Messari "A Valuation of USD.AI ($CHIP)"** (now on Blockworks): not
  readable without an account.
- **thelearningpill (2026-11-04)**: GPU rents rising (H100 +17%, B300 more than doubled since July); "the largest
  GPU vault has never had to liquidate a borrower"; timing risk toward mid-2027 capacity.
- **Elon Musk (late Oct 2026, via AMBCrypto)**: warned 200+ neocloud providers could fail as financing tightens;
  cited as context for CHIP's move on 28 Oct.

## 7. Open questions the data can answer

1. How big is the loan book on-chain, at what rates, to how many borrowers? (v1 + v2 router events)
2. How much of sUSDai's yield is loan interest vs PYUSD base yield vs escrow? (vault events)
3. How long do redemptions wait, and how big was the 1 Nov payout? (RedeemRequest / RedemptionsServiced)
4. How much NIM would a full buyback route send to CHIP per month, against unlocks and emissions?
5. Who holds CHIP, and is staking (sCHIP) growing without a use?

## Sources

- docs.usd.ai: depositor/usdai, depositor/susdai, depositor/susdai/queue-extractable-value, susdai-withdrawal-estimates,
  glx, governance/chip, governance/tokenomics, borrower/overview, usdai/risks-and-mitigants, usdai/proof-of-loans,
  technical-overview/contract-addresses, 3rd-party-data, app-guide/depositor/dashboards and loans (all 2026-11-16)
- usd.ai blog: usdai-foundation-chip (2026-01-27), chip-is-live, usdai-2026-ytd-report-lighthouse (2026-06-08),
  usdai-september-recap (2026-10-02), chip-governance-is-live (2026-10-19), compounding-economics-of-chip (2026-10-28),
  susdai-yield-chip-hurdle-rate (2026-11-02), usdai-october-recap-glx-106m-nexgen-1m-chip-buyback (2026-11-03)
- KuCoin flash (relaying Foresight / AMBCrypto), 2026-10-28; cryptonews.net / AMBCrypto 2026-10-12
- Pine Analytics substack 2026-01-28; Blockmedia research 1123140 (2026-08-01); thelearningpill substack 2026-11-04;
  Jupiter Lend sUSDai risk report (2026-09-09)
- DefiLlama API (protocol usd-ai, fees, yields pools, stablecoin 309), CoinGecko (chip-2), Sourcify (ABIs)

## 8. Findings from the on-chain build (2026-11-16)

- **Vault composition** (contract reads, block 524,680,321, 2026-11-16 07:11 UTC): nav $442.18M = cash $134.49M
  (`balances()`, plus $79.5k set aside for redemptions) + live-loan principal $176.60M (`loanRouterBalances()`, plus
  $0.81M accrued) + deposit timelock $128.90M (`depositTimelockBalance()`, the $128.9M facility still in escrow) +
  claimable base yield $0.49M. Deposit share price 1.126230, redemption share price 1.121564. Next redemption
  2026-12-01 06:00 UTC; 4.30M shares queued.
- **Shares**: `totalShares()` 392.62M = Arbitrum `totalSupply()` 124.07M + `bridgedSupply()` 264.24M (67% bridged out;
  the OFT burns on Arbitrum). Deposits minus serviced redemptions reproduces totalShares to the share. Oct 31: 497.83M
  shares, matching the blog's 497.84M.
- **USDai**: 156.08M on Arbitrum; 86% of it sits in the sUSDai vault as cash.
- **DefiLlama's split**: "TVL" = PYUSD backing USDai (≈ USDai supply), "borrowed" = vault loans + escrow ($305.5M vs
  contract $305.49M).
- **Loan Router v2** `0x1c2ed170de32846316784c4fd58a5e3c7563e12f` (impl LoanRouterV2 `0x5f4f17eb…f671`), not in the
  docs. v1 loans migrated 2026-06-26..07-03. v2 LoanOriginated encodes LoanTermsV2 (borrower, currency, tranches
  [lender, amount, rate per second ×1e18], 1095-day term, repayment day 2). New v2 loans (vault tranche rate):
  Aug 4 $7.5M 8.5%; Aug 7 $15.33M 13.5%; Aug 21 $4.57M 12% (repaid, re-originated Oct 16); Sep 3 $54.40M 8.5%
  (matches the Hydra Host facility size); Sep 14 $9.56M 11.5% (refinanced Oct 1 at 13.5%). Refinances on Jul 31:
  two migrated loans at 10%.
- v1 originations (6-decimal PYUSD/USDC): Dec 5 2025 $0.48M (first loan, USDC, repaid); Jan 28 $2.30M; Feb 7 4×$77.6k;
  Feb 17 $4.28M; Mar 5 $9.80M; Mar 9 3×$77.6k; Mar 11 $0.53M; Mar 12 15×$29.5k (one borrower, all repaid); Mar 20
  $0.20M; Apr 6 $26.82M; Apr 17 $16.40M; Apr 29 $11.30M + $34.06M; Jun 4 $87.05M (Duos Edge AI; sold via GLX Oct 2,
  principal back in full). Two test loans ($5, $1) excluded. Total 39 loans, 15 borrower addresses, $290.1M.
- **Escrow** events show cancel-and-redo pairs (Jul 10 $15.3M cancelled Aug 7 and re-funded; Sep 23 $122.45M first
  funded in 6-decimal units, cancelled Sep 24, redone in USDai). Escrow rate 7% (Jul-Aug), 6.5% (Sep).
- **Income booked by the vault**: PYUSD base yield arrived in one $7.82M batch on 2026-02-02 (six months of yield);
  before that the vault booked almost nothing while the share price rose ~7-11% a year. Admin fee = 10% of gross on
  every base-yield deposit (adminFee / (deposited + adminFee) = 0.100). Loan interest to the vault: $8.2M through Nov
  15, October $3.87M (incl. $1.6M collected at the Duos sale).
- **Redemption payouts**: Mar 7 2026 $136.0M (705 wallets, top 10 48%); Apr 6 $80.8M; Nov 1 $118.0M (629 wallets,
  top 10 57%, largest single wallet $12.6M); Oct 2 $32.4M, one wallet 96%. Money-weighted wait 2-14 days: big holders
  file just before the payment date.
- **CHIP**: close $0.0263 on Nov 15 (−41% in 30 days vs BTC −21%); $0.054 on Oct 28 (buyback day); ATH $0.140 Apr 23.
  BTC fell to ~$62k in the Nov 15 weekend sell-off (X, FuturesWire). sCHIP: 41.99M CHIP staked (0.42% of supply).
  An X thread (@Jimmyy_yyyy, Nov 9) puts the April unlock at 2.76B CHIP; our model (33% of investors 29.6% +
  contributors 23.5%) gives 1.75B. The difference is probably the Foundation reserve or ecosystem tokens; unresolved.
- **Recent news** (X, USD.AI account): USDai/sUSDai listed on Bullish (Nov 12); Bitwise sUSDai vaults on Jupiter
  (Nov 13); NexGen $106M facility to fund mid-December with 5% retained in sUSDai; CHIP Foundation X account opened
  Nov 3; 1kx revenue report (Oct 29) cites USD.AI at $300M+ originated.
