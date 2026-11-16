"""Fetch the public, keyless sources behind the USD.AI / CHIP deep dive into data/raw/.

Each source is saved verbatim; data/raw/manifest.json records URL, fetch time and status. A failed fetch
keeps the previous copy and is marked failed in the manifest, so a flaky API never blanks a chart.

  defillama/protocol.json        TVL (idle PYUSD) and "borrowed" (loan principal) history, Arbitrum
  defillama/fees.json            daily fees (all yield the protocol books)
  defillama/revenue.json         daily revenue (the protocol's admin fee)
  defillama/stablecoin.json      USDai circulating supply by chain
  defillama/pool_susdai.json     sUSDai vault APY + TVL history (DefiLlama yields)
  defillama/pool_pt_feb27.json   Pendle PT-sUSDai Feb 2027 implied fixed APY history
  coingecko/chip.json            CHIP market data now (price, supply, FDV, ATH)
  coingecko/chip_chart.json      CHIP daily price, market cap, volume since listing
  coingecko/btc_chart.json       BTC daily price (the "vs BTC" comparison)
  rpc/state.json                 live reads of the sUSDai vault (cash, loans, escrow, queue, share prices), CHIP and
                                 sCHIP supply, through a public Arbitrum RPC (pipeline/rpc_state.py)
  peers/*.json                   peer credit protocols for the valuation table (pipeline/peers.py)
"""
import datetime as dt, json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from peers import PEERS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
UA = "Mozilla/5.0 (X11; Linux x86_64) research-dashboard"

SOURCES = {
    "defillama/protocol.json": "https://api.llama.fi/protocol/usd-ai",
    "defillama/fees.json": "https://api.llama.fi/summary/fees/usd-ai?dataType=dailyFees",
    "defillama/revenue.json": "https://api.llama.fi/summary/fees/usd-ai?dataType=dailyRevenue",
    "defillama/stablecoin.json": "https://stablecoins.llama.fi/stablecoin/309",
    "defillama/pool_susdai.json": "https://yields.llama.fi/chart/712ce948-bd9e-4f4a-8916-b72c447f7578",
    "defillama/pool_pt_feb27.json": "https://yields.llama.fi/chart/b44dc004-56b7-48d0-97b6-da33ead5e6eb",
    "coingecko/chip.json": "https://api.coingecko.com/api/v3/coins/chip-2?localization=false&tickers=false&community_data=false&developer_data=false",
    "coingecko/chip_chart.json": "https://api.coingecko.com/api/v3/coins/chip-2/market_chart?vs_currency=usd&days=365&interval=daily",
    "coingecko/btc_chart.json": "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily",
}
for p in PEERS:
    if p.get("llama"):
        SOURCES[f"peers/{p['key']}-protocol.json"] = f"https://api.llama.fi/protocol/{p['llama']}"
        SOURCES[f"peers/{p['key']}-revenue.json"] = f"https://api.llama.fi/summary/fees/{p['llama']}?dataType=dailyRevenue"
        SOURCES[f"peers/{p['key']}-fees.json"] = f"https://api.llama.fi/summary/fees/{p['llama']}?dataType=dailyFees"
SOURCES["peers/coingecko-markets.json"] = ("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids="
                                           + ",".join(p["gecko"] for p in PEERS if p.get("gecko")))


def get(url):
    last = None
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"user-agent": UA, "accept": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
            json.loads(body)
            return body
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(8 * (i + 1) if "429" in str(e) else 2 * (i + 1))
    raise last


def main():
    mpath = os.path.join(RAW, "manifest.json")
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for rel, url in SOURCES.items():
        path = os.path.join(RAW, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        now = dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            body = get(url)
            open(path, "wb").write(body)
            man[rel] = {"url": url, "fetched_utc": now, "ok": True}
            print("ok  ", rel)
        except Exception as e:  # noqa: BLE001
            prev = man.get(rel, {})
            man[rel] = {**prev, "url": url, "last_attempt_utc": now, "ok": False, "error": str(e)[:200]}
            print("FAIL", rel, e, file=sys.stderr)
        if "coingecko" in url:
            time.sleep(4)  # keyless CoinGecko: stay well under its per-minute limit
    try:
        import rpc_state
        rpc_state.main(os.path.join(RAW, "rpc", "state.json"))
        man["rpc/state.json"] = {"url": rpc_state.RPC, "fetched_utc": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"), "ok": True}
        print("ok   rpc/state.json")
    except Exception as e:  # noqa: BLE001
        man.setdefault("rpc/state.json", {})["ok"] = False
        print("FAIL rpc/state.json", e, file=sys.stderr)
    json.dump(man, open(mpath, "w"), indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
