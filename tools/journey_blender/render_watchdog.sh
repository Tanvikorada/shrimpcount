#!/bin/bash
# Render frames RANGE (step 2) and restart Blender whenever one frame hangs for more than 4 minutes.
#   render_watchdog.sh OUT_DIR LOG START-END
OUT="$1"; LOG="$2"; RANGE="$3"
B=/c/Users/Thanvi/tools/blender-4.5.14-windows-x64/blender.exe
HERE="$(cd "$(dirname "$0")" && pwd)"
a=${RANGE%-*}; z=${RANGE#*-}
missing() { for f in $(seq $a 2 $z); do n=$(printf "%s/f%04d.jpg" "$OUT" $f); [ -s "$n" ] || echo $f; done; }
while [ -n "$(missing)" ]; do
  for f in $(missing); do n=$(printf "%s/f%04d.jpg" "$OUT" $f); [ -f "$n" ] && [ ! -s "$n" ] && rm -f "$n"; done   # drop empty placeholders
  echo "start $(date +%T), missing $(missing | wc -l)" >> "$LOG.watch"
  "$B" -b -y --factory-startup -P "$(cygpath -w "$HERE/build.py")" -- --res 1600x900 --samples 40 --out "$(cygpath -w "$OUT")" --anim 2 --range "$RANGE" >> "$LOG" 2>&1 &
  pid=$!
  last=$(grep -c "^Saved" "$LOG"); t=$(date +%s)
  while kill -0 $pid 2>/dev/null; do
    sleep 10
    c=$(grep -c "^Saved" "$LOG")
    if [ "$c" != "$last" ]; then last=$c; t=$(date +%s); fi
    if [ $(( $(date +%s) - t )) -gt 240 ]; then echo "hang at $(date +%T), restarting" >> "$LOG.watch"; taskkill //F //IM blender.exe > /dev/null 2>&1; sleep 5; break; fi
  done
done
echo "done $(date +%T)" >> "$LOG.watch"
