-- USD.AI and CHIP deep dive: Allium SQL (Snowflake dialect, Arbitrum schema).
-- Drafts written against Allium's documented raw log and token transfer tables. NOT yet executed inside Allium:
-- someone with an Allium account should run each, fix column names if a table differs from the docs, and save it.
-- Every query reproduces a series this repo currently builds from Envio HyperSync (pipeline/fetch_chain.py), so the
-- two can be checked against each other.
--
-- Decoding raw logs by hand: non-indexed uint256 arguments are 32-byte words in `data`, in ABI order.
-- word(n) = to_number(substr(data, 3 + 64*n, 64), 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
-- Amounts are 18 decimals (USDai, sUSDai, CHIP) except loans on router v1 (PYUSD / USDC, 6 decimals).
--
-- Contracts (Arbitrum)
--   sUSDai            0x0b2b2b2076d95dda7817e785989fe353fe955ef9
--   USDai             0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef
--   Loan Router v1    0x0c2ed170f2bb1df1a44292ad621b577b3c9597d1
--   Loan Router v2    0x1c2ed170de32846316784c4fd58a5e3c7563e12f   (not in USD.AI's published list; loans moved here Jun-Jul 2026)
--   CHIP              0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e
--   sCHIP             0x0d2d2d20962f2468566f4d1a4ddeb482915c4d4a
-- Event topics
--   Deposit(address,address,uint256,uint256)                          0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7
--   RedemptionsServiced(uint256 shares,uint256 amount,bool all)        0xa16c24a7ff42567beaea6e484e0f9da2f5950beb8523be465dbcd288ab4ca13b
--   RedemptionProcessed(uint256 id,address controller,uint256,uint256,uint256) 0xef5d8c8f5b4947e487ae10a82c87ae1412c59796bc090a48308808168dead668
--   BaseYieldDeposited(uint256 depositedAmount,uint256 adminFee)       0xb39b4ae6957990aa62a3e88956dbfa7dff34092422f81aa4fa62eef0f2cf040b
--   Donated(address donor,uint256 usdaiAmount)                         0x2a01595cddf097c90216094025db714da3f4e5bd8877b56ba86a24ecead8e543
--   LenderRepaid(bytes32,address lender,uint8,uint256 principal,uint256 interest,uint256 prepay)  0x2d713aa89716a52d3ffc47fb2d25ee7c52c810a1d6214fa953d9fe39095a46e2 (both routers)
--   LoanOriginated v1 (bytes32,address borrower,address token,uint256 principal,uint256 fee)       0xa421bb93639c7d8972b43af40cd5da06b01f5b436c450343d863b2ca916db25a

-- @name susdai_flows_daily
-- @title sUSDai deposits, redemption payouts and shares outstanding per day
with ev as (
  select date_trunc('day', block_timestamp) as day, topic0, data
  from arbitrum.raw.logs
  where address = '0x0b2b2b2076d95dda7817e785989fe353fe955ef9'
    and topic0 in ('0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7',
                   '0xa16c24a7ff42567beaea6e484e0f9da2f5950beb8523be465dbcd288ab4ca13b')
), d as (
  select day,
    sum(iff(topic0 = '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7', to_number(substr(data, 3, 64), repeat('X', 64)) / 1e18, 0)) as deposited_usdai,
    sum(iff(topic0 = '0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7', to_number(substr(data, 67, 64), repeat('X', 64)) / 1e18, 0)) as shares_minted,
    sum(iff(topic0 = '0xa16c24a7ff42567beaea6e484e0f9da2f5950beb8523be465dbcd288ab4ca13b', to_number(substr(data, 67, 64), repeat('X', 64)) / 1e18, 0)) as redeemed_usdai,
    sum(iff(topic0 = '0xa16c24a7ff42567beaea6e484e0f9da2f5950beb8523be465dbcd288ab4ca13b', to_number(substr(data, 3, 64), repeat('X', 64)) / 1e18, 0)) as shares_redeemed
  from ev group by 1
)
select day, deposited_usdai, redeemed_usdai, deposited_usdai / nullif(shares_minted, 0) as deposit_share_price,
       sum(shares_minted - shares_redeemed) over (order by day) as shares_outstanding
from d where day < current_date order by day;

-- @name vault_income_monthly
-- @title Cash booked by sUSDai per month: loan interest, PYUSD base yield (with the 10% admin fee), Foundation top-ups
with repaid as (
  select date_trunc('month', block_timestamp) as m,
         to_number(substr(data, 67, 64), repeat('X', 64)) as interest_raw
  from arbitrum.raw.logs
  where address in ('0x0c2ed170f2bb1df1a44292ad621b577b3c9597d1', '0x1c2ed170de32846316784c4fd58a5e3c7563e12f')
    and topic0 = '0x2d713aa89716a52d3ffc47fb2d25ee7c52c810a1d6214fa953d9fe39095a46e2'
    and topic2 = '0x0000000000000000000000000b2b2b2076d95dda7817e785989fe353fe955ef9'   -- lender = sUSDai vault
), base as (
  select date_trunc('month', block_timestamp) as m,
         to_number(substr(data, 3, 64), repeat('X', 64)) / 1e18 as base_yield,
         to_number(substr(data, 67, 64), repeat('X', 64)) / 1e18 as admin_fee
  from arbitrum.raw.logs
  where address = '0x0b2b2b2076d95dda7817e785989fe353fe955ef9'
    and topic0 = '0xb39b4ae6957990aa62a3e88956dbfa7dff34092422f81aa4fa62eef0f2cf040b'
)
select m,
  (select sum(iff(interest_raw > 1e15, interest_raw / 1e18, interest_raw / 1e6)) from repaid r where r.m = x.m) as loan_interest,
  (select sum(base_yield) from base b where b.m = x.m) as base_yield,
  (select sum(admin_fee) from base b where b.m = x.m) as admin_fee_on_base_yield
from (select m from repaid union select m from base) x
order by m;

-- @name redemption_payouts
-- @title Each monthly payout: amount, wallets, share taken by the ten largest
with p as (
  select date_trunc('day', block_timestamp) as day,
         '0x' || substr(topic2, 27, 40) as controller,
         to_number(substr(data, 67, 64), repeat('X', 64)) / 1e18 as usdai
  from arbitrum.raw.logs
  where address = '0x0b2b2b2076d95dda7817e785989fe353fe955ef9'
    and topic0 = '0xef5d8c8f5b4947e487ae10a82c87ae1412c59796bc090a48308808168dead668'
), w as (select day, controller, sum(usdai) as usdai from p group by 1, 2),
r as (select day, controller, usdai, row_number() over (partition by day order by usdai desc) as rk from w)
select day, sum(usdai) as paid, count(*) as wallets, sum(iff(rk <= 10, usdai, 0)) / sum(usdai) as top10_share
from r group by 1 having sum(usdai) > 100000 order by 1;

-- @name chip_holders_daily
-- @title CHIP holders on Arbitrum (balance above 1 CHIP), per day
with t as (
  select block_timestamp, from_address as a, -amount as d from arbitrum.assets.erc20_token_transfers
  where token_address = '0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e'
  union all
  select block_timestamp, to_address, amount from arbitrum.assets.erc20_token_transfers
  where token_address = '0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e'
), daily as (select date_trunc('day', block_timestamp) as day, a, sum(d) as d from t group by 1, 2),
bal as (select day, a, sum(d) over (partition by a order by day) as balance from daily),
days as (select distinct day from daily)
select days.day, count_if(b.balance > 1) as holders
from days join bal b on b.day = (select max(day) from bal b2 where b2.a = b.a and b2.day <= days.day)
group by 1 order by 1;
