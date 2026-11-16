"""Live reads of USD.AI contracts on Arbitrum through a public RPC (no key). View functions only.

Selectors are the first 4 bytes of keccak256("name()"), written out so this file needs no dependency.
Outputs a flat dict, every amount in whole tokens (18 decimals divided out), plus the block it was read at.
"""
import datetime as dt, json, os, urllib.request

RPC = "https://arb1.arbitrum.io/rpc"
UA = "Mozilla/5.0 (X11; Linux x86_64) research-dashboard"
SUSDAI = "0x0B2b2B2076d95dda7817e785989fE353fe955ef9"
CHIP = "0x0C1c1C109FE34733fca54b82d7B46B75CFb71F6e"
SCHIP = "0x0D2d2D20962F2468566F4D1a4DdeB482915C4D4A"
USDAI = "0x0A1a1A107E45b7Ced86833863f482BC5f4ed82EF"

# name -> (contract, selector, number of 32-byte words returned)
CALLS = {
    "vault_total_assets": (SUSDAI, "0x01e1d114", 1),
    "vault_nav": (SUSDAI, "0xc1590cd7", 1),
    "vault_total_shares": (SUSDAI, "0x3a98ef39", 1),
    "vault_supply_arbitrum": (SUSDAI, "0x18160ddd", 1),
    "vault_bridged_supply": (SUSDAI, "0x11c301e0", 1),
    "vault_cash": (SUSDAI, "0x7bb98a68", 2),               # balances(): (cash, cash set aside for redemptions)
    "vault_loans": (SUSDAI, "0x66518b81", 2),              # loanRouterBalances(): (principal, accrued)
    "vault_deposit_timelock": (SUSDAI, "0x37d0a739", 1),   # depositTimelockBalance(): loans funded, hardware not yet live
    "vault_claimable_base_yield": (SUSDAI, "0x927c9b01", 1),
    "vault_deposit_price": (SUSDAI, "0x1eb510a1", 1),
    "vault_redemption_price": (SUSDAI, "0xecab31a0", 1),
    "vault_redemption_time": (SUSDAI, "0x1b235437", 1),
    "vault_queue": (SUSDAI, "0xf4a6564d", 5),              # redemptionQueueInfo(): index, head, tail, pending, balance
    "usdai_supply_arbitrum": (USDAI, "0x18160ddd", 1),
    "chip_supply_arbitrum": (CHIP, "0x18160ddd", 1),
    "schip_supply": (SCHIP, "0x18160ddd", 1),
    "schip_assets": (SCHIP, "0x01e1d114", 1),
}


def call(to, data, block="latest"):
    body = {"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": to, "data": data}, block]}
    req = urllib.request.Request(RPC, data=json.dumps(body).encode(), headers={"content-type": "application/json", "user-agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.loads(r.read())
    if "error" in out:
        raise RuntimeError(out["error"])
    return out["result"]


def selectors_ok():
    """Recompute selectors when pycryptodome is present (the build environment has it)."""
    try:
        from Crypto.Hash import keccak
    except ImportError:
        return
    names = {"vault_total_assets": "totalAssets()", "vault_nav": "nav()", "vault_total_shares": "totalShares()",
             "vault_supply_arbitrum": "totalSupply()", "vault_bridged_supply": "bridgedSupply()", "vault_cash": "balances()",
             "vault_loans": "loanRouterBalances()", "vault_deposit_timelock": "depositTimelockBalance()",
             "vault_claimable_base_yield": "claimableBaseYield()", "vault_deposit_price": "depositSharePrice()",
             "vault_redemption_price": "redemptionSharePrice()", "vault_redemption_time": "redemptionTimestamp()",
             "vault_queue": "redemptionQueueInfo()"}
    for k, sig in names.items():
        sel = "0x" + keccak.new(digest_bits=256, data=sig.encode()).hexdigest()[:8]
        CALLS[k] = (CALLS[k][0], sel, CALLS[k][2])


def main(path):
    selectors_ok()
    blk = json.loads(urllib.request.urlopen(urllib.request.Request(RPC, data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}).encode(), headers={"content-type": "application/json", "user-agent": UA}), timeout=60).read())["result"]
    out = {"block": int(blk, 16), "read_utc": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")}
    for k, (to, sel, n) in CALLS.items():
        raw = call(to, sel, blk)[2:]
        words = [int(raw[64 * i: 64 * (i + 1)], 16) for i in range(n)]
        if k == "vault_redemption_time":
            out[k] = dt.datetime.fromtimestamp(words[0], dt.UTC).strftime("%Y-%m-%dT%H:%MZ")
        elif k == "vault_queue":
            out[k] = {"index": words[0], "head": words[1], "tail": words[2], "pending_shares": words[3] / 1e18, "balance": words[4] / 1e18}
        elif n == 2:
            out[k] = [w / 1e18 for w in words]
        else:
            out[k] = words[0] / 1e18
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(out, open(path, "w"), indent=1)
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw", "rpc", "state.json")), indent=1))
