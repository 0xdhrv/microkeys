#!/bin/sh
# Renders the OG cards to site/public. Needs rsvg-convert, Berkeley Mono and Inter installed.
cd "$(dirname "$0")" || exit 1
rsvg-convert -w 1200 -h 630 home.svg -o ../../public/og.png
rsvg-convert -w 1200 -h 630 docs.svg -o ../../public/og-docs.png
