"""Peer credit protocols for the CHIP valuation table: a governance or value-accrual token on top of a
yield-bearing dollar. llama = DefiLlama protocol slug, gecko = CoinGecko id of the governance token."""
PEERS = [
    {"key": "maple", "name": "Maple", "token": "SYRUP", "llama": "maple", "gecko": "syrup",
     "note": "private credit to crypto firms; syrupUSDC; buybacks from revenue"},
    {"key": "ethena", "name": "Ethena", "token": "ENA", "llama": "ethena", "gecko": "ethena",
     "note": "basis-trade dollar USDe. DefiLlama books almost none of its yield as protocol revenue, so its revenue multiple is not comparable"},
    {"key": "gaib", "name": "GAIB", "token": "GAIB", "llama": "gaib", "gecko": "gaib",
     "note": "the other GPU-credit dollar (AID / sAID). DefiLlama reports no deposits for it"},
]
