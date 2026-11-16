# USD.AI: the protocol, the loans and the credit risk (primary-source research, cycle 1)

Scope: protocol mechanics, loan book, credit risk, entities, yield, liquidity, third-party views. CHIP tokenomics are
out of scope (another reviewer). Research date 2026-11-17. Every fact has a source and the date it was read.
"(self-reported)" marks company claims that no independent source confirms. "UNVERIFIED" marks what could not be checked.

Sources read in full this cycle:
- **Docs:** all 48 pages listed in https://docs.usd.ai/llms.txt, fetched as `.md` on 2026-11-17. This includes the Terms of Service, last modified 2026-09-25.
- **Proof of Loans:** The Network Firm's agreed-upon-procedures report, snapshot 2026-07-15, signed 2026-08-25, 9 pages.
- **Blog:** all 108 posts in usd.ai/sitemap.xml, plus 20 older posts linked from them (2025-08 to 2026-01).
- **App:** loan-level data embedded in https://app.usd.ai/loans, fetched 2026-11-17 and captured 2026-11-16 20:40 UTC. It covers 18 positions and 21 deal records with every repayment event.
- **Governance:** forum topics 39, 40 and 44 at governance.chipfoundation.ai, and Snapshot space usdai.eth.
- **Aave ARFC thread 23260:** all 13 posts, including Chaos Labs (2026-04-01) and LlamaRisk (2026-04-03 and 2026-07-17).
- **Jupiter Lend risk report:** 2026-09-09.
- **SEC filings:**
  - Corvex: 10-Q of 2026-11-12, and 8-Ks of 2026-11-12 and 2026-11-16.
  - QumulusAI: 424B4 of 2026-07-15 and 10-Q of 2026-11-10.
  - Duos: 424B5 of 2026-06-17, 8-K of 2026-06-11, and 8-K/PR of 2026-10-05.
  - Axe Compute: 8-K/PR of 2026-10-05.
  - HIVE: 8-K of 2026-10-29 and 10-Q of 2026-11-09.
  - SharonAI: 8-K of 2026-10-01 and 424B3 of 2026-08-21.
  - Forum Markets: 8-K of 2026-04-08.
  - iPower: 424B3 of 2026-11-05.
- **X:** read signed in, 2026-11-17.

Not read:
- The Lighthouse YTD PDF (usd.ai/reports/lighthouse-ytd-2026.pdf, 32 pages) is all images, with no text layer.
- Messari / Blockworks "A Valuation of USD.AI ($CHIP)" is walled. The company's Chinese translation of it is on its blog (usdai-chip-valuation-report-cn, 2026-03-24) and was skimmed only for its credit-loss assumptions.
- Blockworks "CHIP Rips?" was not opened (it is about tokenomics).
- The audit PDFs were not opened.
- Reddit: the agent CLI returned HTTP 403.
- The 1kx revenue report mention was not verified.

---

## 1. The protocol: how it is built

### 1.1 Three layers (docs: usdai/how-it-works, technical-overview/technical-protocol-overview, borrower/onchain-offchain-interplay)

| Layer | What it is | Key verbatim line |
|---|---|---|
| USDai | ERC-20, 1:1 PYUSD-backed, no yield | "USDai is a fully-backed synthetic dollar collateralized by PYUSD" … "USDai does not accrue yield." |
| sUSDai | ERC-4626 vault, ERC-7540 async redeem | "Unlike USDai, sUSDai is not a stablecoin, but is a free floating token, representing shares in an assortment of targeted lending positions and unallocated USDai." |
| Loans | LoanRouterV2 records terms and routes payments; legal claim is offchain | "This is where the loan is actually legally enforceable" (offchain layer). "The Onchain Record … is the authoritative lender register … Absent manifest error, the Onchain Record is determinative evidence of payment status." |

- **Share pricing.** "The deposit share price is computed from the optimistic net asset value, while the redemption share price is computed from the conservative net asset value." In a default, "the loan in question stops accruing interest". Recovery is booked once: NAV_T = NAV_T⁻ + Π − V. Here Π = min(max(R, F), V), where R is sale proceeds, F the warrantied price and V the frozen claim. The same docs add: "The above assumes full and timely payment on a valid claim. Coverage carve-outs, claim-eligibility conditions, and insurer counterparty risk are not modeled." (technical-protocol-overview, read 2026-11-17)
- **Default recording is manual.** "USD.AI records the default onchain manually, which can lag a day or two (e.g., over a weekend)." (how-it-works). The FAQ adds that USD.AI "records it onchain by calling liquidate on the loan".
- **The on-chain liquidator is an auction.** LlamaRisk's review of the LoanRouter code says collateral goes to `collateralLiquidator`, "sold at an English auction … A 7-day auction window still exists" (Aave thread post 9, 2026-04-03). The Dec 2025 router upgrade post confirms "an English auction fee mechanism for defaults". The current docs describe an offchain process instead: replacement operator, then whole-SPV sale, then ITAD. The two paths are not reconciled anywhere in the docs.
- **Operational roles.** "`STRATEGY_ADMIN_ROLE` … operations are scheduled offchain and executed by a multisig." The docs also say "The pause role can only be deployed by the CHIP Foundation in a few urgent cases."

### 1.2 Contracts and upgrades (LlamaRisk changelog, Aave thread post 10, 2026-07-17)
- USDai v1.4 (2026-01-23): base token migrated from M0's wM to PYUSD; blacklist added. USDai v1.5 (2026-04-24): supply cap removed; pause added.
- StakedUSDai v1.9 (2026-06-24): "Migrate from LoanRouter to LoanRouterV2. Add support for EscrowTimelock. Temporarily remove support for DepositTimelock."
- LoanRouterV2 (`0x1c2ed170…e12f`) is still missing from docs/technical-overview/contract-addresses, which lists only v1 `0x0C2E…97D1` (read 2026-11-17).

### 1.3 Admin keys (LlamaRisk, 2026-04-03 and 2026-07-17)
- Multisig A, 3/3, holds DEFAULT_ADMIN on USDai and sUSDai. Multisig B, 2/4, holds PAUSE_ADMIN. Multisig C, 3/4, holds STRATEGY_ADMIN.
- The proxy admin is owned by a TimelockController with a "2-day minDelay". Its PROPOSER role is a 3/3 multisig.
- LlamaRisk (2026-04-03): "Multisigs are likely still under the control of the USD.AI team." The same three signer addresses appear on all three multisigs.

### 1.4 Audits (docs/technical-overview/audits; file names read 2026-11-17)

| Auditor | Date | Scope per file name | Findings |
|---|---|---|---|
| Cantina | 2025-05-12 | USDai/sUSDai | not read |
| ktl (Kais Tlili) | 2025-05-14 | not stated | not read |
| ktl | 2025-10-29 | Loan Router (per LlamaRisk) | "1 high risk, 2 medium risk, 2 informational … All issues were either fixed or acknowledged" (LlamaRisk, 2026-04-03) |
| ktl | 2025-11-27 | Loan Router follow-up | "2 informational" (LlamaRisk) |
| Quantstamp | 2026-02-03 | not stated | not read |
| ktl | 2026-03-12 (parts 1 and 2) | not stated | not read |
| ktl | 2026-07-03 | likely LoanRouterV2 / StakedUSDai v1.9 (timing) | not read; UNVERIFIED scope |

- Bug bounty: Cantina (live link in the docs).
- LlamaRisk (2026-07-17) noted that "updates following [March 2026] have yet to be reattested". The July 3 ktl report postdates that remark.
- QEV contracts: "to be audited before any transition away from FIFO" (depositor FAQ).

### 1.5 Oracles (docs/technical-overview/3rd-party-data)
- Chainlink sUSDai/USDai exchange-rate feeds on Ethereum, Base and BNB, and USDai/USD and sUSDai/USD market feeds.
- Atlas feed 1110: 0.1% deviation, 1-hour heartbeat.
- Lending markets price sUSDai with `convertToAssets()` times PYUSD/USD, plus a CAPO growth cap. LlamaRisk recommended a maximum yearly growth of 16% (2026-07-17).

### 1.6 Compute IQ (governance post 40, 2026-10-19; blog usdai-underwriting-and-risk-management, rev. 2026-11-02)
- 100-point score; "Deals scoring below 60 are not financeable". Three pillars: operator, customer, contract. The metrics are listed in the post.
- "Governance sets the three pillars and the minimum score. The underwriting team may adjust individual metrics and point allocations." The weights are withheld. Conor Moore on the forum (2026-10-22): "without the specific scores for each defined to maintain some edge".
- The "~$25B" behind Compute IQ is loan **demand reviewed** ("nearly 700 GPU financing deals", blog gpu-residual-value-insurance, 2026-11-10). It is not loan performance data.

---

## 2. The team and the company

### 2.1 Entities and who earns what

| Entity | What it is | Earns | Source |
|---|---|---|---|
| CHIP Foundation (formerly USD.AI Foundation) | Cayman Islands foundation company; counterparty to the Terms of Service; holds the IP; owns GPU Finance | sUSDai NIM, i.e. 10% of sUSDai yield, proposed to fund CHIP buybacks "net of CHIP Foundation costs"; manages the Yield Reserve | ToS 2026-09-25; borrower/overview; blog compounding-economics-of-chip 2026-10-28 |
| GPU Finance Ltd. | "a BVI business company and wholly owned subsidiary of CHIP Foundation"; lender of record for sUSDai; agent on older loans | holds the vault's loan participations | ToS "Agent" definition; attestation p.1 |
| GPU Servicer LLC | "rules-bound administrative and collateral agent" on more recent loans | not disclosed. Ownership not disclosed. No SEC hits | borrower/overview; EDGAR full-text search returned 0 hits |
| USD.AI Inc. (formerly Permian Labs Inc., Delaware) | builds the protocol; originates (gpuloans.com), underwrites (Compute IQ), sells loans (GLX), services | origination fees "about 2 to 3% of each loan"; 60% of positive gain on sale; platform fees | compounding-economics 2026-10-28; GLX CRFC post 44 |
| Permian Labs Inc. as lender | "also the lender of record on certain In-Scope Loans" | not disclosed | attestation p.1 |
| Project Barker, Inc. ("Barkr") | residual value warranty counterparty to USD.AI Foundation, reinsured by Munich Re (aiSure) | warranty premium; LlamaRisk: "Barker takes 5% of the total insured value" | attestation App. 3; Aave post 9 |

Renaming, verbatim from 2026-10-28: "The CHIP protocol (previously USD.AI protocol) … CHIP Foundation (previously USD.AI Foundation) … USD.AI Inc. (previously Permian Labs)."

Observed fees:
- **Corvex:** "paid an upfront fee of $150 thousand" on $7.5M, which is 2.0%. Effective rate 14.8% against a 10% coupon, including $279k of legal fees (Corvex 10-Q, 2026-11-12).
- **HIVE:** "After deducting a 1.5% agent fee and estimated escrow interest, the lender is depositing net proceeds of approximately $125.4 million" (HIVE 10-Q, 2026-11-09).

### 2.2 People and lineage
- **David Choi**, CEO and co-founder, is @0xZergs. Source: "Written by David Choi (@0xZergs), CEO and Co-Founder of Permian Labs" (blog the-interest-rate-of-intelligence, 2026-04-28).
- **Conor Moore**, COO and co-founder (multiple PRs).
- **Ivan Sergeev**, CTO. "USD.AI Inc.'s CTO, Ivan Sergeev" (docs/usdai/infrafi-market); team page "Ivan S – CTO".
- Team page (usd.ai/team, 2026-11-17): 24 named staff.
- **Evan Meagher**, former CoreWeave CFO, joined as senior advisor (blog 2026-01-14).
- **MetaStreet lineage.**
  - The router upgrade post links code at github.com/metastreet-labs/usdai-loan-router-contracts (blog gpu-loan-router-timelock-upgrade, 2025-12-09).
  - LlamaRisk: "Previously, Metastreet, a permissionless lending protocol, enabled USD.AI to create lending pools … A LoanRouter contract has since replaced this component" (2026-04-03).
  - A Bitget page says the company was founded in 2021 by Choi, Moore and Sergeev. That page is AI-generated: UNVERIFIED.

### 2.3 Funding

| Date | Round | Amount | Source |
|---|---|---|---|
| 2025-08-14 | Series A led by Framework Ventures | ~$13M ($13.4M per press summaries) | docs media-coverage (CoinDesk link returned HTTP 429; the amount comes from search results, so UNVERIFIED to the dollar) |
| 2025-08-26 | YZi Labs strategic | undisclosed | yzilabs.com blog. Also lists "Framework, Dragonfly, DCG, Delphi, and Fintech Collective" as backers |
| 2025-09-22 | Bullish | $4M | bullish.com PR |
| Oct/Nov 2025 | Coinbase Ventures in Permian Labs | undisclosed | blog 2025-11-17 |
| 2026 Q1 | CHIP ICO | ~$8.8M | Chaos Labs, Aave post 7: "raised approximately $8.8 million … may be used as a backstop" |
| June 2026 | DISH (EchoStar) strategic | undisclosed | June recap |
| 2026-04 | "Strategic institutional fundraise … @ $300m FDV" | TBA | Choi, 2026-04-28 (self-reported) |

---

## 3. The loans

### 3.1 Loan process, structure and default path
- **Four phases.** PO funding into escrow at Wilmington Trust (Joint Written Instructions from 2 of 3: Lender, Bridge, Independent Custodian). Then build and ship. Then install and verify (Aravolta monitoring). Then escrow release, bridge repaid, amortization starts.
  - "At the moment of escrow funding, yield begins accruing … (typically 5-7%)" (borrower/overview).
  - The escrow longstop is "120–150 day[s]" (blog gpu-financing-usdai-gpu-backed-loan, 2026-08-26).
- **Terms.** "Loans cover up to 80% of deployment cost … Terms run 3–5 years with straight-line monthly amortization." The underwriting model assumes "a conservative four-year useful life". Minimum loan about $5M. DSCR is tested quarterly at 1.15x:
  - first breach: cash sweep;
  - two consecutive breaches: cure period;
  - no cure: default.
  - Sources: blogs usdai-underwriting-and-risk-management and gpu-depreciation.
- **Grace.** "never longer than 30 days" (borrower FAQ). Every loan in the app data has gracePeriodDuration = 2,592,000 s (30 days). Grace-period default rates are set per loan, at 5–15%/yr extra (app). Corvex: "10.0% per annum (15.0% upon default)".
- **Default path.** After default the borrower loses its reserve and collection accounts, and Requisite Lenders (two-thirds) direct the Agent. The order of remedies is: replacement operator; "sell the SPV as a whole, accepting only offers that repay lenders in full"; then "If no acceptable SPV sale is reached within about three months, ITAD firms provide sale quotes" (borrower/partners). LlamaRisk lists 16 Barker-approved ITADs.
- **Bankruptcy carve-out.** "The loan is non-recourse to the parent except under its limited guaranty, which covers losses caused by 'bad acts,' including a voluntary bankruptcy filing."
- **Older loans.** "earlier iterations … leveraged warehouse receipts" (CALIBER, retired October 2026). The borrower page says "In all cases, bankruptcy remote SPVs are used". **The attestation contradicts this**: "Per Management, dedicated borrower SPVs were not utilized for loans classified as Non-Standard" (footnote 1).

### 3.2 Proof of Loans: every number in the report
The Network Firm LLP, agreed-upon procedures, engaged by USD.AI Foundation. Snapshot 2026-07-15, report dated 2026-08-25.
- Scope limits, verbatim: "We did not perform procedures to determine the completeness of the population of loans" … no findings on "the collectability of, or borrower performance under, the In-Scope Loans; the existence, condition, location, the fair market value or resale value of the GPU assets".
- Rate footnote: "Rates are not stated on a uniform basis … not comparable across loans and do not represent an effective interest rate".

| Loan | Type | Disbursed | Principal | Stated rate | Collateral value | LTV | Maturity | Servers / GPUs | Site | Warranty max payout, initial → at snapshot |
|---|---|---|---|---|---|---|---|---|---|---|
| LOAN-001 | Non-Std | 2026-03-11 | $525,875.92 | 12.00% | $928,000.00 | 56.67% | 2028-08-09 | 4 H200 servers (32 GPUs) | Montréal | $808,748.75 → $621,347.01 |
| LOAN-003 | Non-Std | 2026-02-07 | $310,350.00 | 13.50% | $413,800.00 | 75.00% | 2029-02-07 | 4 RTX PRO 6000 (32) | Montréal | $287,089.71 → $265,015.43 |
| LOAN-004 | Non-Std | 2026-01-28 | $2,296,940.10 | 15.00% | $3,281,343.00 | 70.00% | 2029-01-27 | 8 B200 (64) | Saint-Denis, France | $2,609,307.97 → $2,087,713.15 |
| LOAN-005 | Std | 2026-02-17 | $4,282,443.62 | 12.00% | $6,117,776.60 | 70.00% | 2029-02-01 | 9 B300 + 18 RTX PRO 6000 | Philadelphia | $5,016,739 → $4,488,941 |
| LOAN-006 | Std | 2026-03-04 | $9,800,000.00 | 11.50% | $15,764,706.68 | 62.16% | 2029-02-16 | 10 H200 + 38 B200 | Spring, TX | $9,804,318 → $8,372,525 |
| LOAN-007 | Non-Std | 2026-03-09 | $232,650.00 | 13.50% | $310,200.00 | 75.00% | 2029-03-07 | 3 RTX PRO 6000 | Montréal | $215,317.29 → $198,761.57 |
| LOAN-008 | Non-Std | 2026-03-20 | $196,524.00 | 15.00% | $245,655.00 | 80.00% | 2029-03-18 | 3 RTX PRO 6000 | Spring, TX | $239,584 → $181,420 |
| LOAN-009 | Non-Std | 2026-04-06 | $26,821,643.82 | 10.00% | $38,316,634.02 | 70.00% | 2029-04-05 | 72 B300 (576) | Newport, WA | $24,735,943 → $24,398,438 |
| LOAN-010 | Std | 2026-04-17 | $16,395,614.34 | 12.00% | $20,494,517.92 | 80.00% | 2029-04-01 | 75 H200 (600) | N. Kansas City, MO | $12,476,140 → $9,925,100 |
| LOAN-011 | Std | 2026-04-29 | $11,295,783.00 | 11.50% | $14,119,728.18 | 80.00% | 2029-02-16 | 32 B200 (256) | Spring, TX | $8,329,293 → $6,607,039 |
| LOAN-012 | Std | 2026-04-29 | $34,055,508.00 | 12.00% | $42,734,149.72 | 79.69% | 2029-04-29 | 96 B200 (768) | Falkenberg, Sweden | $25,466,818.18 → $21,855,091.20 |
| LOAN-013 | Std | escrowed | $98,135,008.28 | 12.00% | $142,688,795.97 | 68.78% | n/a | 288 B300 | Columbus, GA | no warranty issued yet |
| LOAN-014 | Std | escrowed | $15,331,685.00 | 15.00% | $19,164,605.73 | 80.00% | n/a | 34 B300 | Philadelphia | no warranty issued yet |

LOAN-002 does not appear in the report. All warranty counterparties are "Project Barker, Inc. and USD.AI Foundation", signed by both.

Totals (computed from the report):
- **All 13 loans:** $219.68M principal against $304.58M collateral, so 72.1% weighted LTV. Weighted stated rate 11.95%.
- **The 11 funded loans:** $106.21M principal against $142.73M collateral, so 74.4% LTV. Weighted stated rate 11.47%. Initial warranty payout $89.99M = 84.7% of principal and 63.1% of collateral. Snapshot payout $79.00M, 87.8% of the initial.
- **Escrowed:** $113.47M, of which Duos is $98.1M = 44.7% of all in-scope principal.
- **Warranty decay.** The warranty max payout falls fastest on the newest, highest-LTV loans:

  | Loan | Payout lost | Over |
  |---|---|---|
  | LOAN-010 (H200) | −20.4% | 89 days |
  | LOAN-011 (B200) | −20.7% | 77 days |
  | LOAN-012 (B200) | −14.2% | 77 days |
  | LOAN-009 (B300) | −1.4% | 100 days |

  Straight-line amortization over 36 months repays only ~2.8% of principal a month. On LOAN-010 the payout covered ~76% of principal at origination and ~66% of outstanding principal three months later.

### 3.3 Loan book: every on-chain loan matched to a named deal

The on-chain list comes from `usdai-dashboard/site/downloads/usdai_loans.csv` (v1 and v2 routers, from 2025-12-05). Deal data comes from the attestation, the app records (fetched 2026-11-17), blog/X posts and SEC filings.

**Confidence:**
- **High:** amount to the dollar plus hardware and site agree across two or more sources.
- **Medium:** size and timing agree, but the borrower is not named in a primary source.
- **Low:** guess.

**Rate columns:** "Borrower rate" is from the loan document or filing. "Vault rate" is the sUSDai tranche rate in LoanRouterV2 or the app.

| Start (chain) | Principal | Borrower (named) | GPUs / site | Borrower rate | Vault rate | Status 2026-11-16 | Match evidence | Confidence |
|---|---|---|---|---|---|---|---|---|
| 2025-12-05 | $479,935 (USDC) | not named | unknown | n/a | n/a | repaid 2026-03-11 | Aug recap: "One financing had been repaid ahead of schedule" | Low |
| 2026-01-28 | $2,296,940.10 | not named (French operator) | 8 B200 servers, Saint-Denis | 15.0% | 14.0% (FiLo tranche $164k) | active, $1.72M outstanding | LOAN-004; "B200s sat in French customs" (blog 2025-11-06) | High (deal) / borrower unknown |
| 2026-02-07 | 4 × $77,587.50 = $310,350 | not named | 4 RTX PRO 6000, Montréal | 13.5% | 12.0% | active | LOAN-003 | High / borrower unknown |
| 2026-02-17 | $4,282,443.62 | **QumulusAI** (QMLS), draw 1 | 9 B300 + 18 RTX PRO 6000, Philadelphia | 12% | 10.5% | active, $3.32M | LOAN-005; X 2026-02-17 "70% LTV at 12% APR"; QMLS 10-Q "first draw … $4,282,000 … 12%" | High |
| 2026-03-05 | $9,800,000 | not named | 10 H200 + 38 B200, Spring TX | 11.5% (after 50 bp DSRA-in-USDai cut from 12%) | 10.0% | refinanced 2026-07-31 to $8.56M; $6.92M outstanding | LOAN-006; Choi: "a borrower drew $9.8m … The loan went from 12% to 11.5%" | High / borrower unknown |
| 2026-03-09 | 3 × $77,550 = $232,650 | same address as the Feb 7 RTX loans | 3 RTX PRO 6000, Montréal | 13.5% | 12.0% | active | LOAN-007 | High / borrower unknown |
| 2026-03-11 | $525,875.92 | not named | 4 H200 servers, Montréal | 12.0% | 10.5% | active | LOAN-001 | High / borrower unknown |
| 2026-03-12 | 15 × $29,510.19 | not named | unknown | n/a | n/a | all repaid by 2026-05-29 | not in the attestation (repaid before snapshot) | none |
| 2026-03-20 | $196,524 | not named | 3 RTX PRO 6000, Spring TX | 15.0% | 13.5% | active | LOAN-008 | High / borrower unknown |
| 2026-04-06 | $26,821,643.81 | **Crucible Capital** | 72 B300 (576 GPUs), Newport WA | 10.0% | 8.5% | active, $21.61M | LOAN-009 (Non-Standard, no SPV); blog 2026-04-06 "10.0% … 70% LTV" | High |
| 2026-04-17 | $16,395,614.34 | **QumulusAI**, draw 2 | 75 H200 servers (600 GPUs), N. Kansas City | 12% | 10.5% | active, $13.61M | LOAN-010; QMLS 10-Q; April recap | High |
| 2026-04-29 | $11,295,783 | not named | 32 B200 (256), Spring TX | 11.5% | 10.0% | active, $9.95M | LOAN-011; July recap "$11.3M … 11.5% APY, up from 7%" | High / borrower unknown |
| 2026-04-29 | $34,055,508 | **NexGen Cloud** | 96 B200 (768), Falkenberg Sweden | 12% | 10.5% | active, $30.27M | LOAN-012; PR 2026-06-25; June recap "768 NVIDIA B200 … 12% APY" | High |
| 2026-06-04 | $87,053,370.13 (first draw of the $98.1M) | **Duos Edge AI** (DUOT), Hydra Host operator | 288 B300 (2,304), Columbus GA | 12% | n/a | repaid 2026-10-01 | LOAN-013; Duos 424B5; Axe 8-K: debt "approximately $87.8 million" repaid at SPV sale | High |
| 2026-08-04 | $7,500,000 | **Corvex** (MOVE), Series A | 32 B200, DE (Mid-Atlantic 1) | 10.0% (15% default) | 8.5% | active, $7.14M | Corvex 10-Q: funded 2026-08-03, matures 2029-09-01, reserve $724,565.50, fee $150k | High |
| 2026-08-07 | $15,331,684.59 | **QumulusAI**, draw 3 | 34 B300, Philadelphia | 15% | 13.5% | active, $14.48M | LOAN-014; QMLS 10-Q "August 6, 2026 … $15,332,000 … 15%" | High |
| 2026-08-21, repaid 08-24, re-originated 2026-10-16 | $4,565,269 | not named | 16 B200, TX | 13.5% | 12.0% | active | app "B200 [16] TX" | Medium |
| 2026-09-03 | $54,404,473.45 | **Hydra Host** (season-and-sell program) | 130 B300 servers (1,040 GPUs), Ohio | 10% (7% in escrow) | 8.5% | active, $52.89M | X 2026-07-20; Sept recap; app "B300 [130] OH" | High |
| 2026-09-14 | $9,561,607 | not named ("AI infrastructure platform for enterprise AI workloads") | 24 DGX B300 (192 GPUs), NE | 15% (app); X said "13%" | 13.5% | refinanced 2026-10-01, active, $9.30M | X 2026-09-14 "$10M … 192 NVIDIA B300 … Earning 13%" | High (deal) / borrower unknown |
| escrow 2026-09-23/24 | $6.44M + $122.45M = $128.9M | **HIVE Digital (BUZZ Alpha Cloud)** | 32 GB200 NVL72 (2,303–2,304 GPUs), Bell, Merritt BC; Cohere 3-year contract | 9.0% fixed, 3 years | escrow 6.5% | in escrow (offchain, Hypertec) | HIVE 8-K and 10-Q ($128.9M, 9.0%, GB200, 1.5% agent fee); Bennett Jones: "agent and lender, wholly-owned subsidiaries of USD.AI Foundation … first loan from USD.AI in Canada" | High (lender not named in HIVE's filing; size, rate, hardware, site and date all agree) |

**Upcoming deals in the app (stage 1 = term sheet):**
- B300 [216], "Sweden", $105.77M, 12.25%, 4 years. This is NexGen's $106M, which the PR places in **Finland**.
- B200 [130], DE, $38.25M, 15%. This is Corvex's "$38M committed … 1,000+ HGX B200" (Corvex 8-K 2026-11-16; 130 × 8 = 1,040).
- DGX B300 [72], NE, $32.05M, 15%. Likely the same borrower as the Sept 14 NE loan (Medium).
- B300 [128], no site, $44.5M, 11.5%. Unnamed.

**What the borrower addresses tell you.**
- The v1 address 0x6444… is the "borrower" for the Texas B200, NexGen and Duos loans. That address is an intermediary, not a borrower.
- Named borrowers by remaining principal on 2026-11-16:

  | Borrower | Outstanding | Notes |
  |---|---|---|
  | Hydra Host | $52.9M | |
  | QumulusAI | $31.4M | 3 loans; QMLS reports $32.5M at 9/30 |
  | NexGen | $30.3M | |
  | Crucible | $21.6M | |
  | Corvex | $7.1M | |

  Unnamed borrowers hold about $33M. The HIVE escrow adds $128.9M.

### 3.4 Facilities announced against money drawn

| Facility | Announced | Amount | What actually happened | Source |
|---|---|---|---|---|
| QumulusAI | 2025-10-09 | $500M | "non-binding memorandum of understanding … this is not a binding contract"; 70% loan-to-cost; drawn $4.28M + $16.4M + $15.33M = ~$36.0M | QMLS 424B4 2026-07-15; 10-Q 2026-11-10 |
| Quantum Solutions (TSE 2338) | 2025-12-09 | up to $200M "guidance facility" | no matching on-chain draw found | blog 2025-12-09 |
| Sharon AI (SHAZ) | 2026-01-22 | up to $500M "subject to execution of definitive documentation"; "US$65 million in initial GPU deployments" | no draw found. On 2026-09-28 Sharon signed a **US$356M syndicated facility with other lenders** (agent Global Loan Agency Services Australia): Facility A 7.25% rising to 9.95%, Facility B 9.95%, bullet at 42 months | SHAZ 8-K 2026-10-01 |
| BSQ Capital APAC JV | 2026-06-30 | $300M target, "path to $1BN" | no deals disclosed | PR |
| Bullish | 2026-08-28 | $100M "stablecoin-based liquidity facility provided to USD.AI" | structure (who borrows, terms) not disclosed. UNVERIFIED whether drawn | PR |
| K3 Capital | Sept 2026 | $40M "stablecoin revolving debt facility … collateralized by sUSDai" | "helps manage the mismatch between longer-duration GPU loans and faster-moving onchain liquidity" | Sept recap |
| Forum Markets (FRMM) | 2026-04-08 | bridge loans, "mid-teens", 60–120 days | "backed by a pre-committed loan takeout from USD.AI" | FRMM 8-K |

"$1.2B in approved facilities to QumulusAI, Sharon AI, and Quantum SKK" (blog 2026-01-27) produced about $36M of loans in ten months.

### 3.5 GLX and the Duos "sale"
- **GLX launch post, verbatim:** "By selling the loan to a new buyer, USD.AI frees up liquidity for sUSDai" (blog 2026-10-01). The October recap says the facility "was sold to an institutional buyer once it was seasoned and performing".
- **The borrower-side filings say something else:**
  - Axe Compute 8-K: "the Company (i) repaid in full the SPV's pre-existing debt of approximately $87.8 million and (ii) agreed to pay Duos a deferred purchase price of $715,000 per month for a period of 60 months".
  - Duos PR: "the approximately $98.1 million GPU equipment financing facility, together with the associated covenants and debt service, was satisfied by Axe Compute".
  - The Axe customer contract was extended from 3 to 5 years.
- **On chain:** principal back in full on 2026-10-01, with $1.61M of interest over ~4 months, of which the loan sat ~6 weeks in escrow at the 2026-07-15 snapshot.
- **Reading:** this looks like a payoff when the borrower changed hands. Who financed Axe's payoff is not disclosed, so "GLX institutional buyer" cannot be verified. At most, the loan "seasoned" for about 10 weeks after release from escrow.
- **GLX rules (Snapshot passed 2026-10-30):**
  - Ordinary sale at par or better; "Liquidity Sale" floor 99.5, "only for a verified liquidity shortfall", where a shortfall means "valid redemption requests past the 30-day wait exceed available liquidity".
  - Positive gain splits "60% to USD.AI Inc. for facilitating the sale; 40% to the Yield Reserve".
  - Disclosure is required for each sale. No sale disclosure for Duos was found on the forum.
- **Current spread (self-reported):** "today the sale spread is about 1 to 2% … target … 5 to 6% once ABS markets open" (2026-10-28).
- **NexGen $106M:** "Silver Point Capital and Victory Park Capital joined the lender group … four-year facility … 216 NVIDIA HGX B300 servers … Tier III data center in Finland … take-or-pay … leading AI inference platform" (PR 2026-10-29). "5% of the facility will be retained in sUSDai. Funding is expected in mid-December" (X 2026-10-29).

---

## 4. How the yield really works

### 4.1 Sources, from the app's own split (toplineMetrics captured 2026-11-16 20:40 UTC)
- Gross APY 8.02% = stablecoins (PYUSD) 1.60 + active loans 4.52 + escrowed 1.90.
- Net APY 6.77%. The CHIP hurdle is active at 7%.
- TVL $463.3M. `totalOriginatedVolume` $420.28M.

### 4.2 The PYUSD incentive: no T-bills, and a known end date
- **The program:** "PayPal and the USD.AI Foundation will introduce a customer incentive program offering 4.5% on up to $1 billion in deposits … expected to launch in early January, and will last for a year" (blog 2025-12-18).
- **The end date:** "promotional 4.5% APR, continuing up to the first 1B minted through USD.AI, or until March 1, 2027" (LlamaRisk, 2026-07-17).
- **How it reaches the vault:** it is harvested through BaseYieldEscrow. LlamaRisk's repo analysis found a single $7.82M batch on 2026-02-02.
- **What the docs still say:** sUSDai page: "Capital not actively deployed in GPU loans is allocated to short-term U.S. Treasury Bills … T-Bill positions can be liquidated". This is obsolete. The vault holds PYUSD/USDai, and PYUSD's own reserves are Paxos-held.
- **Effect:** about 1.6 points of gross yield end by 2027-03-01 unless PayPal renews. No renewal has been announced (UNVERIFIED).
- **Borrower DSRA in USDai:** this gives the borrower a rate cut funded by the same incentive: "The loan went from 12% to 11.5%" (Choi, 2026-04-28).

### 4.3 Fees: two layers
1. **Per-loan spread.** Borrower rate minus vault tranche rate is 1.5 points on every loan where both are known (10/8.5, 12/10.5, 15/13.5). In the app's repayment events, `interestSplit.admin` totals $1.03M against $6.51M to depositors (13.6%). The docs do not say what this layer funds. The 2026-10-28 post defines NIM as "10% of the yield sUSDai earns from GPU loan interest (after value insurance)", so the spread may pay the Barkr premium. UNVERIFIED.
2. **10% of sUSDai yield** ("10% of the yield earned, not ten percentage points of APY", 2026-10-28). It is visible on chain as `BaseYieldDeposited` adminFee = 10.0% of gross.
3. **Origination fee** of 2–3% (2.0% at Corvex, 1.5% agent fee at HIVE). It goes to USD.AI Inc.
4. **Gain on sale:** 60% to USD.AI Inc., 40% to the Yield Reserve.

- **Revenue promises, all self-reported:** "Per $1 billion of deposits … roughly $20 million to $40 million of revenue a year" (2026-10-28); "$1bn of originations … $25-40m" (2026-04-28).
- **USD.AI's own caution:** "there are significant costs in just the origination and structuring of a loan (upward of millions of dollars per loan at times)" (2026-10-28).

### 4.4 Escrow interest
"Funds in escrow earn up to a 7% APR, approximately 350 bps above T-bill rates" (blog 2026-04-29). Rates observed:

| Escrow | Rate | Source |
|---|---|---|
| Hydra | 7% | X 2026-07-20 |
| Texas B200 | 7% | July recap |
| HIVE $128.9M | 6.5% | app |
| New escrows | "10% or more" (target) | 2026-11-02 |

Where the money comes from: "borrowers pay yield on escrowed capital from day one … The OEM effectively finances the interim period" (April recap).

### 4.5 CHIP Hurdle Rate and Yield Reserve (mechanics only)
- "Each redemption period, it supports a 7% annualized rate on the deposit share price, subject to available capital." The reserve is "funded by the treasury first and by 40% of gain on sale over time" (2026-11-02, 2026-10-28).
- First donation: 127,927.66 USDai (2026-11-01).
- Disclaimer, verbatim: "The CHIP Hurdle Rate is not a guaranteed minimum."

---

## 5. Liquidity design

### 5.1 Redemptions
- **The cycle:** a global 30-day epoch; the queue closes on day 29; cash goes out FIFO; "Unfulfilled requests carry to the next 30-day epoch" (docs/depositor/susdai).
- **No forced sales:** "The protocol does not prematurely terminate or liquidate active GPU loans to satisfy redemptions."
- **Planned change:** borrower payments move to the 1st of the month and redemptions to the 2nd, which "need a contract upgrade first" (2026-11-02).
- **QEV is not active.** "No. Redemptions currently use a 30-day FIFO queue … the associated contracts are to be audited before any transition away from FIFO" (depositor FAQ). The risks table still lists QEV as a mitigant. The Jupiter report (2026-09-09) describes live bidding. That is wrong.
- **Instant buffer:** the FAQ mentions "a limited instant liquidity buffer (visible on-chain) … pre-funded protocol liquidity". Its size is not disclosed.

### 5.2 Cash that can meet the queue (computed from app repayment events)

| Month | Principal received | Interest received (depositor share) |
|---|---|---|
| 2026-07 | $2.65M | $0.97M |
| 2026-08 | $3.65M | $1.07M |
| 2026-09 | $2.94M | $0.89M |
| 2026-10 | $6.27M | $2.30M |

- Duos is excluded from these figures (its loan is not in the app records).
- Against the queue: the Nov 1 payout was $118.0M (repo); March 7 was $136.0M (repo); the March queue peak was ~127M shares against ~330M of unallocated USDai (LlamaRisk). Scheduled amortization, at roughly 3.5% of the $176.6M live book a month, covers about 7% of the Nov 1 payout. Redemptions so far were paid from idle PYUSD and the Duos payoff.
- **Founder's framing:** "With QEV, you get a MINIMUM 12% redemption a quarter along with a unutilized 20% buffer" (X @0xZergs, 2026-04-02). This holds only if utilization stays at or below 80%.

### 5.3 Utilization cap
- **The rule:** "maximum sUSDai utilization of 90% for deploying new loans" (risks-and-mitigants; Snapshot passed 2026-10-30).
- **Earlier commitments:** Chaos Labs (2026-04-01) recorded the team's commitment to an on-chain 80% stop, "not yet implemented". LlamaRisk (2026-07-17): governance outcomes "will not be programmatically implemented (for the relevant onchain parameters)".
- **Peak:** utilization reached "an all-time high of 78%" (2026-10-01).
- **Status:** no on-chain enforcement of 90% was found (UNVERIFIED).

### 5.4 Governance as practiced
- **Both parameter proposals** (origination, GLX sale) passed on Snapshot from 2026-10-27 to 2026-10-30 with 2,357,989,592 CHIP For, 0 Against, **3 voters, quorum 0** (hub.snapshot.org, read 2026-11-17).
- **The only outside critique** on the forum (user "Bobby", 2026-10-22): "Even the reliance 'Compute IQ score' is something that simply reads as 'trust me'". Reply from Conor Moore: "To-date, there have been no defaults across the loan book."

### 5.5 sUSDai in DeFi (DefiLlama yields, fetched 2026-11-17)

| Venue | sUSDai TVL |
|---|---|
| sUSDai vault (usd-ai pool) | $440.2M |
| Fluid lending, collateral (Arb, Eth, Plasma, Base) | $119.0M |
| Fluid DEX pools | $45.9M |
| Jupiter Lend (Solana) | $10.0M |
| Morpho (Eth, Arc) | ~$10.0M |
| Pendle (PT/YT, Feb and Jun 2027) | $8.3M; PT-Feb-27 implied 8.94% |
| Kamino | $3.0M |
| Curve | $1.4M |

- **Leverage in the vault:** about $142M of sUSDai (~32% of the vault) sits as lending collateral. Most of it is presumably looped (borrow stables, buy more sUSDai). Looping is promoted in the docs: "Loop for amplified yield … See loops.gpu.credit".
- **Unwind risk:** Chaos Labs (2026-04-01): "A synchronized unwind of these positions can create concentrated sell pressure on sUSDai in secondary markets", because exits must go through DEX depth or the 30-day queue.
- **Exit depth:** "Users can swap up to ~12.6M sUSDai ($13.8M) for USDC on Arbitrum within a 7.5% price impact" (LlamaRisk 2026-07-17).
- **Supporting facilities:** Fluid's $100M LaaS uses Fluid's own capital (blog 2026-06-29). K3's $40M revolver is collateralized by sUSDai.
- **Aave:** the ARFC passed on 2026-07-24. The LlamaRisk table shows sUSDai "Collateral enabled: No", supply cap 55M, E-mode LTV 89%/LT 91%. Live listing UNVERIFIED.
- **Jupiter Lend:** approved at "LTV: 88% | Liquidation Threshold: 90% … Borrow Cap: $25M initially" (2026-09-09).

---

## 6. Credit-risk evidence

### 6.1 Collateral value and rents
- **Rental indexes:** Silicon Data H100 $3.06/GPU-hr and Ornn $3.10 (2026-11-10), up from $2.00 (2025-12-09). B300 $7.68 and B200 $6.97 (2026-11-10). Source: USD.AI blogs h100-rental-price and b300-vs-b200, which cite silicondata.com. Read via USD.AI, so secondhand on the index values.
- **Server price:** B300 HGX about $600,000 per server, Q4 2026 (self-reported pricing research).
- **Depreciation:** USD.AI underwrites a 4-year life. Filers use 5–6 years. Jensen Huang at GTC Berlin, quoted by USD.AI: "really is probably eight to maybe more". A 2025 USD.AI post cites Hydra's longevity study: H100 resale "~80% … after 1.5 years … about 50%" after 3 years (secondhand).
- **Founder's case on depreciation:** "if we had existed 2-3 years ago and did a loan on a H100, it would have already paid down … profit-given-default" (X @0xZergs, 2026-02-22).
- **The warranty decay in §3.2** is the market-implied view. Barker's own payout schedule fell ~20% in under three months on H200 and B200.

### 6.2 What comparable lenders charge (SOFR 3.88% on 2026-11-09, NY Fed)

| Facility | Date | Rate | Note |
|---|---|---|---|
| IREN DDTL / private placement | Jun 2026 | SOFR+2.25% / ~SOFR+2.13% fixed; blended 6.00% | Microsoft offtake, Fitch A |
| CoreWeave DDTL 4.0 | Mar 2026 | SOFR+2.25% | A3 |
| CoreWeave $3.1B | May 2026 | SOFR+4.50% | Ba2, non-IG customers |
| CoreWeave DDTL 5.5 ($2.6B) | Aug 2026 | SOFR+5.50% | 5-yr debt against ~3-yr contracts |
| Lambda TLB / DDTL | Aug / Oct 2026 | SOFR+3.00% / 6.78% fixed | Baa2 / Baa1 |
| Nscale facilities | Feb–Aug 2026 | Term SOFR+2.375% to +5.50% | S-1 2026-09-18 |
| Sharon AI syndicate | Sep 2026 | 7.25→9.95% / 9.95% fixed, bullet | took this instead of the USD.AI facility |
| HIVE via USD.AI | Oct 2026 | 9.0% fixed, amortizing | IG offtaker (Cohere contract; Bell site) |
| USD.AI book | 2026 | 10–15% stated, weighted 11.95% | attestation |
| Forum Markets bridge | Apr 2026 | "mid-teens", 60–120 days | USD.AI takeout |
| GAIB sAID | Aug 2026 | ~10.2% APY (Portals.fi) | secondary source, UNVERIFIED |

Sources for the first five rows: USD.AI blog gpu-loan-rates, which links the issuers' PRs and SEC filings. Read secondhand through that post.

Reading: the USD.AI book prices at roughly SOFR+6 to +11, which is 400–600 bp over IG-backstopped deals. Moore claims this is "the same security package and credit profile as IG backstopped deals" (blog the-2t-compute-financing-middle-market, 2026-07-09). The attestation shows on-demand (offTake 0) loans and loans without an SPV, which weakens that claim.

### 6.3 Neocloud financing stress, and the named borrowers
- **Musk, primary source.** 2026-10-25, reply to @chamath: "As of the past few weeks, debt markets have almost entirely shut off access to money for any company that doesn't have substantial revenue independent of AI data centers. SpaceX closed $40B of debt for GPUs, but we're investment grade … That means the 200+ neoclouds are going to see guppy-level death and consolidation. Some will make it through, but not many." 14.2M views. https://x.com/elonmusk/status/2114434646914068862
- **The tape disagrees.** Sharon AI ($356M, 2026-09-28), Lambda ($1.008B, Oct), HIVE ($128.9M, Oct) and Corvex ($38M commitment, 2026-11-16) all closed GPU debt around that date.
- **QumulusAI (3 USD.AI loans, ~$31–32.5M):** its Q3 10-Q (2026-11-10) says losses "raise substantial doubt about the Company's ability to continue as a going concern". Figures: 9-month operating loss $54.75M, accumulated deficit $124.2M, cash $21.9M plus restricted $9.2M. "The Company's plans to alleviate the substantial doubt include completing additional approved draws under the USD.AI protocol." Its offset is a $211.9M revenue contract with a $21.2M prepayment received in October 2026. Its prospectus calls the USD.AI facility "not a binding contract". This is the clearest credit flag in the book.
- **Payment timing.** No missed payment beyond grace was found in the app events. All three QumulusAI loans paid on 2026-08-27 and then 2026-10-01, a 35-day gap. The RTX loan in TX had a 37-day gap (2026-08-12 → 09-18). The hurdle post: "some landed as late as Nov 6". No `LoanBreached` or liquidation event appears in the app data.
- **Who says there are no defaults:** LlamaRisk (2026-07-17): "no loan defaults, liquidations, or missed payments have been reported". Moore, 2026-10-22: "no defaults".
- **Duos** exited GPU ownership entirely: "Duos is now singularly focused on being the colocation landlord" (PR 2026-10-05).
- **Corvex** is small and growing: Q3 private placement $33M; $103M take-or-pay contract.
- **One operational error:** a negative sUSDai rebase in late January 2026 "caused by an error in which more funds than required were transferred into an escrow" (Chaos Labs, quoted by LlamaRisk 2026-07-17). The escrow also shows cancel-and-redo pairs (repo §8).
- **iPower** (Nasdaq: IPW) bought ~$1.0M of USDai/sUSDai in June 2026 and "sold all sUSDAI for approximately $1,002,381 … on August 14, 2026" (424B3 2026-11-05). This is evidence of a corporate treasury round-trip; no reason was given.

### 6.4 The residual value warranty: what it covers

| Claim | Who | Correct reading |
|---|---|---|
| "covering 100% of loan amounts at the protocol's 80% maximum LTV" | Jupiter Lend report, 2026-09-09 | Wrong. Initial payouts averaged 84.7% of principal; about 66% of outstanding on LOAN-010 within 3 months |
| "warranty effectively provides full protection against loss given default" | Chaos Labs, 2026-04-01 | Overstated. The docs say it "covers part of the shortfall" |
| "100% coverage instead of 5-10%" | @0xZergs, X 2026-10-01 | Same issue |
| "Barker would cover at least 80% of the insured assets" | LlamaRisk, 2026-04-03 | Based on "a sample warranty provided by the USD.AI team" |
| Docs (current) | docs borrower/partners | "Barkr covers part of the shortfall, subject to the warranty's conditions, including suspension during a market-wide shock … it does not apply to a sale of the SPV as a whole" |

- **Scope was narrowed.** It was "applied to all new GPU loans" (Feb 2026). The posts were revised in Oct 2026 to "where a deal includes it … required where the offtaker is not investment-grade or the compute is sold as on-demand rental". So IG-offtake loans such as HIVE may carry no warranty.
- **LlamaRisk exclusions:** "Macroeconomic shocks … insurance payouts will not occur". Also: "In the event of multiple defaults, coverage for new loans may be effected."
- **Implication:** the warranty helps in an isolated default with an orderly server sale. It is suspended in exactly the correlated, market-wide GPU price crash that Musk describes.

### 6.5 Legal and regulatory views
- **LlamaRisk (2026-04-03):** "existing legal opinions analyze only the warehouse receipts … not the USD.ai and sUSD.ai held by retail users"; "sUSDai may present a closer case to satisfying the Howey test"; "Permian Labs — a Delaware corporation — builds, operates, and markets the protocol".
- **Terms of Service (2026-09-25):** "USDAI, SUSDAI … HAVE NOT BEEN AND WILL NOT BE REGISTERED UNDER THE U.S. SECURITIES ACT"; "Solely by holding … sUSDai, a User does not obtain … a direct contractual claim against a specific borrower".
- **Enforcement abroad:** the ToS lists enforcement regimes in Canada, Singapore, Japan, Australia, the UK, Sweden, the BVI and France, which matches the book's geography. Chaos Labs: "Legal recognition of electronic documents of title and bailment agreements may not be consistent outside the United States."

---

## 7. Third-party research (what each adds)

| Source | Date | Key point | Read |
|---|---|---|---|
| Galaxy, "Inference Capital Markets" | 2026-07-13 | USD.AI is the "financing hardware" case; ~8% yield, loan book ~half of reserves; "~95% of book backed by long-term offtake" | digest only  |
| Chaos Labs (Aave) | 2025-10 (against), 2026-04-01 (for) | liquidity mismatch is "the most significant residual risk"; v3→v4 migration unwind risk; 20% reserve factor on USDai | full |
| LlamaRisk (Aave) | 2025-10 (against), 2026-04-03, 2026-07-17 | legal gap; warranty sample; admin keys; PYUSD end date; "no … missed payments" | full |
| Jupiter Lend | 2026-09-09 | approved at 88/90; contains errors (QEV live, 100% cover, "T-bill maturity proceeds") | full |
| Messari / Blockworks, "A Valuation of USD.AI ($CHIP)" | 2026-03-02 | walled. The company's Chinese copy states the base case sets liquidation fees to zero and "does not adopt a bank-style expected credit loss framework" | partial (company's Chinese translation) |
| castle_labs interview with @0xZergs | 2026-11-04 (X) | "Onchain is the warehouse. Banks, private credit funds and insurers are the permanent home."; misstates the first season-and-sell as the $106M NexGen deal | full (X thread) |
| Pine Analytics bear case | 2026-01-28 | covered in existing notes | not re-read |
| Weiss Ratings | n.d. | "the real test will happen if the borrowers fail all at once" | search snippet only |
| @Axel_Mnvn (holder) | 2026-10-28 (X) | buybacks from the 10% fee ≈ $218k/mo, while the scaling revenue lines go to USD.AI Inc. | full |

---

## 8. What this changes on the dashboard: the ten facts most worth showing

| # | Fact | Chart or table | Data |
|---|---|---|---|
| 1 | The loan book has names. About $142M of live principal maps to 5 named borrowers, $33M to unnamed ones, and $128.9M (HIVE/BUZZ, 9%) sits in escrow | Loan-book table (§3.3), one row per loan: borrower, GPUs, site, borrower rate vs vault rate, outstanding, status, confidence badge | csv + app + filings |
| 2 | Independent check: 13 loans, 72.1% LTV, 11.95% weighted stated rate (attestation, 2026-07-15) | Per-loan bar: collateral value, principal, warranty payout initial → snapshot. The gap shows the equity cushion and the warranty | attestation |
| 3 | The warranty is not "100%": 84.7% of principal at origination, minus ~20% in 3 months on H200/B200; excluded in market-wide shocks; not paid on SPV sales | Two lines per loan over time: amortizing principal vs warranty max payout | attestation + amortization |
| 4 | Concentration and credit flags: QumulusAI (going-concern doubt, 10-Q 2026-11-10) is ~18% of live principal; Hydra ~30% | Treemap of outstanding by borrower, with a filing-flag marker | app + 10-Qs |
| 5 | About 1.6 of 8.02 gross APY points is a PayPal promotion ending by 2027-03-01 or at $1B; 1.9 points is escrow carry on one loan (HIVE) | Stacked bar of yield sources today, with a "what's left in March 2027" scenario bar | app toplineMetrics; LlamaRisk |
| 6 | $1.2B "approved" facilities became ~$36M of loans; Sharon AI borrowed $356M elsewhere | Announced vs drawn bar chart per facility | §3.4 |
| 7 | The first "GLX sale" was the borrower's acquirer paying off $87.8M after ~4 months | Timeline strip for Duos: escrow 06-04, snapshot 07-15, Axe deal 09-30, repayment 10-01, GLX launch 10-01 | filings + chain |
| 8 | Monthly repayments (~$8.6M in October) are small against redemption payouts ($118M on Nov 1); ~32% of sUSDai is posted as lending collateral | Monthly bars: principal + interest in, against redemptions out; side panel of DeFi collateral by venue | app events + repo + DefiLlama |
| 9 | Pricing: 10–15% (SOFR+6 to +11) against SOFR+2–5.5% for rated neocloud debt | Dot plot of facility rates by rating/offtake, USD.AI loans highlighted | §6.2 |
| 10 | Who earns what: protocol 10% NIM (buybacks) + 1.5-pt loan spread; USD.AI Inc. 2–3% origination + 60% of gain on sale; Yield Reserve 40% of gain on sale. Parameter votes passed with 3 voters | Flow diagram of a $10M loan's cash split by entity; a small "governance turnout" note | §2.1, §4.3, §5.4 |

## Open items for the next cycle
- Read the six ktl, Cantina and Quantstamp PDFs and list findings by severity.
- Find who funded Axe's $87.8M payoff. The Axe Q3 10-Q is due mid-November.
- OCR the Lighthouse YTD PDF.
- Confirm whether the 90% utilization cap and the Aave listing are live on chain.
- Identify the unnamed borrowers (Spring TX, Montréal, NE DGX B300, France).
