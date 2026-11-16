"""Decode the raw logs written by fetch_chain.py with the Sourcify-verified ABIs in data/abi/.

decode(row) -> {"event", "block", "ts", "tx", "li", "addr", <event args>}; unknown logs -> None.
Loan Router v2's LoanOriginated carries the whole LoanTermsV2 struct as bytes; loan_terms() unpacks it.
"""
import gzip, json, os
from Crypto.Hash import keccak
from eth_abi import decode as abi_decode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ABI_DIR = os.path.join(ROOT, "data", "abi")
CHAIN = os.path.join(ROOT, "data", "raw", "chain")

ADDR_ABI = {
    "0x0b2b2b2076d95dda7817e785989fe353fe955ef9": "susdai",
    "0x0c2ed170f2bb1df1a44292ad621b577b3c9597d1": "loanrouter",
    "0x1c2ed170de32846316784c4fd58a5e3c7563e12f": "loanrouter2",
    "0x0a1a1a107e45b7ced86833863f482bc5f4ed82ef": "usdai",
    "0x0c1c1c109fe34733fca54b82d7b46b75cfb71f6e": "chip",
    "0x0d2d2d20962f2468566f4d1a4ddeb482915c4d4a": "schip",
    "0x9ddfd49ac4689cf894203794d792dcb38e4b1a9e": "baseyield",
}


def _type(i):
    """ABI input -> canonical type string, tuples expanded."""
    t = i["type"]
    if t.startswith("tuple"):
        return "(" + ",".join(_type(c) for c in i["components"]) + ")" + t[5:]
    return t


def _sig(e):
    return "0x" + keccak.new(digest_bits=256, data=(e["name"] + "(" + ",".join(_type(i) for i in e["inputs"]) + ")").encode()).hexdigest()


_EVENTS, _ABIS = {}, {}
for addr, name in ADDR_ABI.items():
    abi = json.load(open(os.path.join(ABI_DIR, name + ".json")))
    _ABIS[name] = abi
    _EVENTS[addr] = {_sig(e): e for e in abi if e.get("type") == "event"}


def decode(row):
    bn, ts, tx, li, addr, t0, t1, t2, t3, data = row
    e = _EVENTS.get(addr, {}).get(t0)
    if not e:
        return None
    out = {"event": e["name"], "block": bn, "ts": ts, "tx": tx, "li": li, "addr": addr}
    topics = [t for t in (t1, t2, t3) if t]
    idx = [i for i in e["inputs"] if i.get("indexed")]
    non = [i for i in e["inputs"] if not i.get("indexed")]
    for i, t in zip(idx, topics):
        out[i["name"]] = abi_decode([_type(i)], bytes.fromhex(t[2:]))[0] if i["type"] not in ("bytes", "string") else t
    if non:
        vals = abi_decode([_type(i) for i in non], bytes.fromhex(data[2:]))
        for i, v in zip(non, vals):
            out[i["name"]] = v
    for k, v in list(out.items()):
        if isinstance(v, bytes) and len(v) == 32 and k.lower().endswith("hash"):
            out[k] = "0x" + v.hex()
    return out


def _terms_type():
    for f in _ABIS["loanrouter2"]:
        for i in f.get("inputs", []):
            if (i.get("internalType") or "").endswith("LoanTermsV2"):
                return i
    raise RuntimeError("LoanTermsV2 not in ABI")


_TERMS = _terms_type()


def loan_terms(b):
    """bytes of abi.encode(LoanTermsV2) -> dict."""
    (v,) = abi_decode([_type(_TERMS)], b)
    names = [c["name"] for c in _TERMS["components"]]
    d = dict(zip(names, v))
    d["repaymentSpec"] = dict(zip(["totalDurationDays", "day", "timezoneOffsetSeconds"], d["repaymentSpec"]))
    d["interestRateSpec"] = {"model": d["interestRateSpec"][0], "options": d["interestRateSpec"][1]}
    d["trancheSpecs"] = [dict(zip(["lender", "amount", "rate"], t)) for t in d["trancheSpecs"]]
    d["feeSpecs"] = [dict(zip(["kind", "recipient", "model", "options"], f)) for f in d["feeSpecs"]]
    return d


def rows(name):
    path = os.path.join(CHAIN, name + ".jsonl.gz")
    if not os.path.exists(path):
        return []
    out = []
    with gzip.open(path, "rt") as f:
        for line in f:
            d = decode(json.loads(line))
            if d:
                out.append(d)
    out.sort(key=lambda d: (d["block"], d["li"]))
    return out
