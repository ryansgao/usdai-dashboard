#!/bin/sh
# Screenshot every tab: 1440 light, 1440 dark, 390 phone. usage: tools/shots.sh <base-url> <out-dir>
set -e
D=$(dirname "$0"); mkdir -p "$2"
for t in overview deposits loans yield redemptions chip valuation method; do
  ( node "$D/shot.cjs" "$1?tab=$t" "$2/$t-light.png" 1440 900 light 1 >/dev/null
    node "$D/shot.cjs" "$1?tab=$t" "$2/$t-dark.png" 1440 900 dark 1 >/dev/null
    node "$D/shot.cjs" "$1?tab=$t" "$2/$t-phone.png" 390 844 light 1 >/dev/null ) &
done
wait
