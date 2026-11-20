#!/bin/bash
# Usage: ./render.sh deck.pptx outdir [first last]
# Exports the deck to PDF through Microsoft PowerPoint (addressing only this file's window by name),
# then rasterizes slides with pdftoppm.
set -e
SRC="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
# PowerPoint is sandboxed: it can only open files in the build folder it was granted, so render a copy from there.
DECK="/Users/ianche/Code/guitar-teacher/build/_render.pptx"
cp "$SRC" "$DECK"
NAME="_render.pptx"
OUT="$2"; mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
PDF="/Users/ianche/Code/guitar-teacher/build/_render.pdf"
rm -f "$PDF"
osascript -e "
with timeout of 300 seconds
tell application \"Microsoft PowerPoint\"
  open POSIX file \"$DECK\"
  set pres to presentation \"$NAME\"
  save pres in POSIX file \"$PDF\" as save as PDF
end tell
end timeout" >/dev/null
for i in $(seq 1 120); do [ -s "$PDF" ] && break; sleep 1; done
sleep 2
osascript -e "
with timeout of 60 seconds
tell application \"Microsoft PowerPoint\" to close presentation \"$NAME\" saving no
end timeout" >/dev/null || true
[ -s "$PDF" ] || { echo "PDF export failed"; exit 1; }
if [ -n "$3" ]; then
  pdftoppm -jpeg -r 80 -f "$3" -l "$4" "$PDF" "$OUT/s"
else
  rm -f "$OUT"/s-*.jpg
  pdftoppm -jpeg -r 80 "$PDF" "$OUT/s"
fi
ls -1 "$OUT" | grep -c jpg
