# /// script
# requires-python = ">=3.11"
# dependencies = ["pycryptodome", "eth-abi"]
# ///
"""Pull USD.AI event logs from Arbitrum (the hub chain) through Envio HyperSync, incrementally.

Stand-in for Allium's arbitrum.raw.logs / arbitrum.assets.erc20_token_transfers until someone with an
Allium account runs the SQL in ../sql/. Each set is a list of log filters; every row keeps the raw log so
build.py decodes it with the verified ABIs in data/abi/ (fetched from Sourcify, exact match):

  row = [block, block_ts, tx_hash, log_index, address, topic0, topic1, topic2, topic3, data]

Sets:
  susdai       sUSDai vault (0x0B2b…5ef9): deposits, withdrawals, redemption requests and payouts,
               base-yield deposits with the admin fee, donations, loan escrow/deposit timelocks, mints/burns
  loans        Loan Router v1 (0x0C2E…97D1): originations, repayments, liquidations, migrations out
  loans2       Loan Router v2 (0x1c2e…e12f): the same plus full loan terms (tranches, rates), breaches, refinances
  usdai        USDai (0x0A1a…82EF): mints/burns (from/to 0x0) and its PYUSD Deposited/Withdrawn/Harvested
  chip         CHIP (0x0C1c…1F6e): every Transfer on Arbitrum (holders, exchange flows, buybacks)
  schip        sCHIP (0x0D2d…4D4A): stake (Deposit) and unstake (Withdraw)
  base_yield   Base Yield Escrow (0x9Ddf…1A9E): T-bill style yield deposits and harvests

Incremental and resumable: data/raw/chain/state.json records the last block scanned per set, saved after every
batch; a run resumes from there and appends new gzip members.

Token: ENVIO_API_TOKEN in the environment, or a file named by ENVIO_TOKEN_FILE holding a line
ENVIO_API_TOKEN=... (free Envio account). Never printed.
Run:   uv run pipeline/fetch_chain.py [--only set1,set2] [--reset set1,set2]
"""
import datetime as dt, gzip, json, os, sys, time, urllib.request
from Crypto.Hash import keccak

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "raw", "chain")
ABI = os.path.join(ROOT, "data", "abi")
STATE = os.path.join(OUT, "state.json")
URL = "https://arbitrum.hypersync.xyz/query"
START = 330_000_000  # 2025-04-29, before USDai's first mint

SUSDAI = "0x0b2b2b2076d95dda7817e785989fe353fe955ef9"
USDAI = "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef"
ROUTER = "0x0c2ed170f2bb1df1a44292ad621b577b3c9597d1"
ROUTER2 = "0x1c2ed170de32846316784c4fd58a5e3c7563e12f"  # LoanRouterV2; loans migrated here Jun-Jul 2026 (not in the docs' address list)
CHIP = "0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e"
SCHIP = "0x0d2d2d20962f2468566f4d1a4ddeb482915c4d4a"
BASE_YIELD = "0x9ddfd49ac4689cf894203794d792dcb38e4b1a9e"
Z = "0x" + "0" * 64


def sig(e):
    s = e["name"] + "(" + ",".join(i["type"] for i in e["inputs"]) + ")"
    return "0x" + keccak.new(digest_bits=256, data=s.encode()).hexdigest()


def topics(abi_name, names):
    abi = json.load(open(os.path.join(ABI, abi_name + ".json")))
    return [sig(e) for e in abi if e.get("type") == "event" and e["name"] in names]


def sets():
    T = topics("usdai", ["Transfer"])
    vault_events = ["Deposit", "Withdraw", "RedeemRequest", "RedemptionProcessed", "RedemptionsServiced",
                    "BaseYieldDeposited", "Donated", "ReferredDeposit", "LoanDepositTimelockDeposited",
                    "LoanDepositTimelockCancelled", "LoanEscrowTimelockDeposited", "LoanEscrowTimelockCancelled",
                    "LoanEscrowTimelockInterestRepaid", "LoanEscrowTimelockWithdrawn"]
    router_events = ["LoanOriginated", "LoanRepaid", "LenderRepaid", "LenderLiquidationRepaid", "LoanLiquidated",
                     "LoanCollateralLiquidated", "LoanMigratedOut", "LenderPositionMinted", "LenderPositionsBurned"]
    return {
        "susdai": [{"address": [SUSDAI], "topics": [topics("susdai", vault_events)]},
                   {"address": [SUSDAI], "topics": [T, [Z]]}, {"address": [SUSDAI], "topics": [T, [], [Z]]}],
        "loans": [{"address": [ROUTER], "topics": [topics("loanrouter", router_events)]}],
        "loans2": [{"address": [ROUTER2], "topics": [topics("loanrouter2", router_events + [
            "LoanBreached", "LoanRefinanced", "LenderRefinanceRepaid"])]}],
        "usdai": [{"address": [USDAI], "topics": [topics("usdai", ["Deposited", "Withdrawn", "Harvested"])]},
                  {"address": [USDAI], "topics": [T, [Z]]}, {"address": [USDAI], "topics": [T, [], [Z]]}],
        "chip": [{"address": [CHIP], "topics": [T]}],
        "schip": [{"address": [SCHIP], "topics": [topics("schip", ["Deposit", "Withdraw"])]}],
        "base_yield": [{"address": [BASE_YIELD]}],
    }


def token():
    if os.environ.get("ENVIO_API_TOKEN"):
        return os.environ["ENVIO_API_TOKEN"]
    f = os.environ.get("ENVIO_TOKEN_FILE")
    if f and os.path.exists(f):
        for line in open(f):
            if line.startswith("ENVIO_API_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("set ENVIO_API_TOKEN or ENVIO_TOKEN_FILE")


def post(body, tok):
    for i in range(8):
        try:
            req = urllib.request.Request(URL, data=json.dumps(body).encode(), method="POST",
                                         headers={"content-type": "application/json", "authorization": f"Bearer {tok}"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except Exception as e:
            print("  retry", i, type(e).__name__, file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise SystemExit("hypersync failed")


FIELDS = ["block_number", "transaction_hash", "log_index", "address", "topic0", "topic1", "topic2", "topic3", "data"]


def pull(name, filters, tok, state):
    """Resumable: each batch is appended to the set's file as its own gzip member and the state is saved after it,
    so an interrupted run loses at most one batch and the next run starts where it stopped."""
    path = os.path.join(OUT, name + ".jsonl.gz")
    st = state.get(name, {})
    frm = st["scanned_to"] + 1 if os.path.exists(path) and st.get("scanned_to") else START
    if frm == START and os.path.exists(path):
        os.remove(path)                       # no state for an existing file: start the set clean
    first, n, top = frm, 0, None
    last_ts = st.get("scanned_to_ts") or st.get("last_log_ts")
    while True:
        body = {"from_block": frm, "logs": filters, "field_selection": {"log": FIELDS, "block": ["number", "timestamp"]}}
        res = post(body, tok)
        time.sleep(4.2)  # free plan: 15 requests a minute
        lines = []
        for batch in res.get("data", []):
            bts = {b["number"]: int(b["timestamp"], 16) for b in batch.get("blocks", []) if b.get("timestamp")}
            for l in batch.get("logs", []):
                bn = l["block_number"]
                ts = bts.get(bn)
                lines.append(json.dumps([bn, ts, l["transaction_hash"], l["log_index"], l["address"].lower(),
                                         l.get("topic0"), l.get("topic1"), l.get("topic2"), l.get("topic3"),
                                         l.get("data") or "0x"]) + "\n")
                last_ts = ts or last_ts
        nxt, top = res.get("next_block"), res.get("archive_height")
        done = not nxt or (top and nxt >= top)
        scanned_to = ((top or nxt or frm) if done else nxt) - 1
        if lines:
            with gzip.open(path, "at") as f:
                f.writelines(lines)
            n += len(lines)
        state[name] = {"scanned_to": scanned_to, "last_log_ts": last_ts,
                       "updated_utc": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%MZ")}
        json.dump(state, open(STATE, "w"), indent=1)
        if done:
            break
        frm = nxt
        if n:
            print(f"  {name}: {n:,} rows, block {frm:,}/{top:,}", flush=True)
    print(f"{name}: +{n:,} rows, blocks {first:,}-{scanned_to:,}")


def main():
    os.makedirs(OUT, exist_ok=True)
    tok = token()
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    todo = sets()
    if "--only" in sys.argv:
        keep = sys.argv[sys.argv.index("--only") + 1].split(",")
        todo = {k: v for k, v in todo.items() if k in keep}
    if "--reset" in sys.argv:
        for k in sys.argv[sys.argv.index("--reset") + 1].split(","):
            state.pop(k, None)
            p = os.path.join(OUT, k + ".jsonl.gz")
            if os.path.exists(p):
                os.remove(p)
    for name, flt in todo.items():
        pull(name, flt, tok, state)


if __name__ == "__main__":
    main()
