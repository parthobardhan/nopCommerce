#!/usr/bin/env bash
# usage: render_cast.sh <cast> <out.mp4> [speed] [idle_limit]
set -euo pipefail
cast=$1; out=$2; speed=${3:-1}; idle=${4:-2}
gif=${out%.mp4}.gif
THEME="0d0d0d,e6e6e6,1c1c1c,ff6b6b,6bd968,f5c451,7aa2ff,c792ea,5fd7d7,d0d0d0,555555,ff8787,87ff87,ffd787,a3bfff,d7afff,87ffff,ffffff"
/tmp/agg --theme "$THEME" --font-size ${FS:-20} --line-height 1.4 --speed "$speed" --idle-time-limit "$idle" \
  --last-frame-duration 2 --fps-cap 30 --no-loop "$cast" "$gif"
ffmpeg -y -loglevel error -i "$gif" -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p" -c:v libx264 -crf 18 "$out"
ffprobe -v error -show_entries stream=width,height:format=duration -of csv=p=0 "$out"
