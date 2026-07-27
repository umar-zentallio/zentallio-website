#!/usr/bin/env bash
# Reduce banner assets for production without visible loss at banner size.
# Re-encodes at CRF 28 and caps the long clips at 6 seconds.
# Run from the folder containing assets/.  Originals are backed up to assets-original/.
set -e
mkdir -p assets-original
for f in fashion ethnic kids sport footwear cosmetics fabric hometex marketplace; do
  [ -f "assets/$f-banner.mp4" ] || continue
  cp -n "assets/$f-banner.mp4" "assets-original/$f-banner.mp4"
  ffmpeg -y -v error -t 6 -i "assets-original/$f-banner.mp4" -an \
    -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart \
    "assets/$f-banner.mp4"
  printf "  %-12s %6s KB\n" "$f" $(( $(stat -c%s "assets/$f-banner.mp4") / 1024 ))
done
echo "total: $(du -ch assets/*.mp4 | tail -1 | cut -f1)"
