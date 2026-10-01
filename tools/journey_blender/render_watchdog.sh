#!/bin/bash
# Render frames RANGE (step 2) and restart Blender whenever one frame hangs for more than 4 minutes.
#   render_watchdog.sh OUT_DIR LOG START-END
OUT="$1"; LOG="$2"; RANGE="$3"
B="${BLENDER:-/c/Users/Thanvi/AppData/Local/Microsoft/WindowsApps/BlenderFoundation.Blender4.5LTS_ppwjx1n5r4v9t/blender-launcher.exe}"   # Store build: Smart App Control trusts it
HERE="$(cd "$(dirname "$0")" && pwd)"
a=${RANGE%-*}; z=${RANGE#*-}
missing() { for f in $(seq $a 2 $z); do n=$(printf "%s/f%04d.jpg" "$OUT" $f); [ -s "$n" ] || echo $f; done; }
while [ -n "$(missing)" ]; do
  for f in $(missing); do n=$(printf "%s/f%04d.jpg" "$OUT" $f); [ -f "$n" ] && [ ! -s "$n" ] && rm -f "$n"; done   # drop empty placeholders
  echo "start $(date +%T), missing $(missing | wc -l)" >> "$LOG.watch"
  "$B" -b -y --factory-startup -P "$(cygpath -w "$HERE/run_logged.py")" -- --pylog "$(cygpath -w "$LOG.py")" --res 1600x900 --samples 40 --out "$(cygpath -w "$OUT")" --anim 2 --range "$RANGE" --log "$(cygpath -w "$LOG")"
  sleep 15
  last=$(grep -c "^Saved" "$LOG"); t=$(date +%s)
  while tasklist | grep -qi "^blender.exe"; do
    sleep 10
    c=$(grep -c "^Saved" "$LOG")
    if [ "$c" != "$last" ]; then last=$c; t=$(date +%s); fi
    if [ $(( $(date +%s) - t )) -gt 240 ]; then echo "hang at $(date +%T), restarting" >> "$LOG.watch"; taskkill //F //IM blender.exe > /dev/null 2>&1; sleep 5; break; fi
  done
done
echo "done $(date +%T)" >> "$LOG.watch"
