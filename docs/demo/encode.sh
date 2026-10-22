#!/usr/bin/env bash
# Turns capture.mjs output into docs/demo/demo.webm and demo.gif with a dockerized ffmpeg.
# Usage: docs/demo/encode.sh <scratch-dir>
set -euo pipefail

demo_dir=$(cd "$(dirname "$0")" && pwd)
work=$(cd "${1:?scratch dir required}" && pwd)
ffmpeg() { docker run --rm -v "$work:/in" -v "$demo_dir:/out" linuxserver/ffmpeg -hide_banner -loglevel error -y "$@"; }

# Skip the blank frame Chromium records before the first paint.
ffmpeg -ss 0.4 -i /in/raw.webm -an -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 /out/demo.webm
ffmpeg -ss 0.4 -i /in/raw.webm -vf "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none" /out/demo.gif
ls -lh "$demo_dir"/demo.*
