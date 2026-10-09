#!/usr/bin/env bash
set -euo pipefail
command -v ffmpeg >/dev/null || { echo 'FAIL: ffmpeg missing'; exit 1; }
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
test -f "$FONT" || { echo 'FAIL: renderer font missing'; exit 1; }
mkdir -p hub/media
# 720x1280, 12 seconds, no third-party footage/music, honest product info.
# The video is a KIVZUNO motion-typography product introduction, not a fake demo.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i 'color=c=0x0e2528:s=720x1280:r=24:d=12' \
  -f lavfi -i 'anullsrc=channel_layout=stereo:sample_rate=44100' \
  -vf "drawbox=x=0:y=0:w=iw:h=65:color=0xc7ef9b:t=fill,\
drawbox=x=0:y=1200:w=iw:h=80:color=0xc7ef9b:t=fill,\
drawtext=fontfile=$FONT:text='KIVZUNO':fontcolor=0xf5f6e9:fontsize=55:x=62:y=128,\
drawtext=fontfile=$FONT:text='DOG WALKERS':fontcolor=0xc7ef9b:fontsize=55:x=54:y=426:enable='between(t,0,3.6)',\
drawtext=fontfile=$FONT:text='TIRED OF TYPING':fontcolor=0xffffff:fontsize=43:x=54:y=516:enable='between(t,0,3.6)',\
drawtext=fontfile=$FONT:text='THE SAME UPDATES?':fontcolor=0xffffff:fontsize=37:x=54:y=588:enable='between(t,0,3.6)',\
drawtext=fontfile=$FONT:text='PET WALK REPORT':fontcolor=0xc7ef9b:fontsize=48:x=48:y=426:enable='between(t,3.6,7.8)',\
drawtext=fontfile=$FONT:text='Add notes and photos':fontcolor=0xffffff:fontsize=33:x=75:y=525:enable='between(t,3.6,7.8)',\
drawtext=fontfile=$FONT:text='Save a polished PDF':fontcolor=0xffffff:fontsize=33:x=75:y=595:enable='between(t,3.6,7.8)',\
drawtext=fontfile=$FONT:text='SHARE VIA WHATSAPP':fontcolor=0xc7ef9b:fontsize=39:x=61:y=426:enable='between(t,7.8,12)',\
drawtext=fontfile=$FONT:text='FREE TO TRY':fontcolor=0xffffff:fontsize=54:x=110:y=527:enable='between(t,7.8,12)',\
drawtext=fontfile=$FONT:text='NO SIGN UP':fontcolor=0xffffff:fontsize=40:x=144:y=610:enable='between(t,7.8,12)',\
drawtext=fontfile=$FONT:text='PET WALK REPORT':fontcolor=0x173630:fontsize=36:x=170:y=1216" \
  -t 12 -c:v libx264 -preset veryfast -crf 25 -pix_fmt yuv420p \
  -c:a aac -b:a 64k -movflags +faststart \
  hub/media/pet-walk-report-promo-20261009.mp4
test -s hub/media/pet-walk-report-promo-20261009.mp4
echo 'PASS: local 9:16 royalty-free KIVZUNO promotion rendered'
