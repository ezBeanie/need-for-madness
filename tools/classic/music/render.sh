#!/bin/sh
# Renders the original game's music for the classic look, as its RadicalMod did (the module
# rendered once at the stage's rate and loudness, played back at 22000 Hz), to mp3 files
# and their loops (public/data/classic/music/loops.json). Needs a JDK, ffmpeg and the
# original's source (its ds/nfm and ibxm classes and OBJ/music).
# usage: tools/classic/music/render.sh <the original's src directory>
set -e
src="$1"
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../../public/data/classic/music"
work="$(mktemp -d)"
javac -nowarn -d "$work" -sourcepath "$src" "$src"/ds/nfm/*.java "$src"/ds/nfm/mod/*.java \
  "$src"/ds/nfm/xm/*.java "$src"/ibxm/*.java "$here/Render.java"
render() { # name, module zip, its rate, loudness, tempo
  java -cp "$work" Render "$src/OBJ/music/$2" "$work/$1.wav" \
    "$(( $3 * 44000 / 8000 ))" "$(( $4 * 8 / 10 ))" "$5" > "$work/$1.loop"
  ffmpeg -loglevel error -y -i "$work/$1.wav" -ar 22050 -ac 1 -b:a 64k "$out/$1.mp3"
}
# the menus: the original's interface track (its loadimod)
java -cp "$work" Render "$src/OBJ/music/interface.zip" "$work/interface.wav" 44000 160 125 \
  > "$work/interface.loop"
ffmpeg -loglevel error -y -i "$work/interface.wav" -ar 22050 -ac 1 -b:a 64k "$out/interface.mp3"
# this game's stages 1 to 17 are remakes of the original's 11 to 27 (its loadstrack)
render stage1 stage11.zip 8000 120 125
render stage2 stage12.zip 7200 260 125
render stage3 stage13.zip 8000 270 125
render stage4 stage14.zip 8000 190 125
render stage5 stage15.zip 7800 162 125
render stage6 stage16.zip 7600 220 125
render stage7 stage17.zip 7500 300 125
render stage8 stage18.zip 7900 200 125
render stage9 stage19.zip 7900 200 125
render stage10 stage20.zip 7300 232 125
render stage11 stage21.zip 7900 370 125
render stage12 stage22.zip 7900 290 125
render stage13 stage23.zip 7600 222 125
render stage14 stage24.zip 8000 230 125
render stage15 stage25.zip 8000 220 125
render stage16 stage26.zip 8000 261 125
render stage17 party.zip 7600 400 125
# the loops, in seconds: where playing goes back to, and from where
{
  printf "{\n"
  first=1
  for loop in "$work"/*.loop; do
    name="$(basename "$loop" .loop)"
    set -- $(cat "$loop")
    [ $first = 1 ] || printf ",\n"
    first=0
    printf '  "%s": [%s, %s]' "$name" "$(echo "scale=4; $5 / 22000" | bc)" "$(echo "scale=4; $7 / 22000" | bc)"
  done
  printf "\n}\n"
} > "$out/loops.json"
rm -rf "$work"
