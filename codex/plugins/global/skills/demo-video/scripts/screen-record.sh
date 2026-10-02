#!/usr/bin/env bash
# screen-record.sh - record the front browser window (or a rect / the whole screen) with macOS
# screencapture, no Playwright script needed. Drive the browser live while it records.
#
#   screen-record.sh start <out.mp4> [--app "Google Chrome"|--rect x,y,w,h|--screen] [--max <seconds>]
#   screen-record.sh stop  <out.mp4> [--keep-mov]  # stops, converts the raw .mov to H.264 MP4, deletes the .mov
#   screen-record.sh status
#
# First use asks macOS for Screen Recording permission for the terminal app; grant it once.
set -euo pipefail
usage(){ sed -n 2,9p "$0" | sed 's/^# \{0,1\}//'; }
[[ $# -lt 1 ]] && { usage; exit 2; }
cmd="$1"; shift
pidfile_for(){ echo "${1%.*}.pid"; }
mov_for(){ echo "${1%.*}.mov"; }
case "$cmd" in
  start)
    out="${1:?out.mp4 required}"; shift; mov="$(mov_for "$out")"
    app="Google Chrome"; rect=""; max=""; mode="app"
    while (( $# )); do case "$1" in
      --app) app="$2"; mode="app"; shift 2;;
      --rect) rect="$2"; mode="rect"; shift 2;;
      --screen) mode="screen"; shift;;
      --max) max="$2"; shift 2;;
      *) echo "screen-record.sh: unknown option $1" >&2; exit 2;;
    esac; done
    if [[ "$mode" == "app" ]]; then
      # AppleScript gives {left, top, right, bottom} of the front window of that app.
      b="$(osascript -e "tell application \"$app\" to get bounds of front window" 2>/dev/null | tr -d ' ')" || true
      if [[ -z "$b" ]]; then echo "screen-record.sh: no front window for '$app'; use --rect or --screen" >&2; exit 3; fi
      IFS=, read -r l t r btm <<<"$b"; rect="$l,$t,$((r-l)),$((btm-t))"
      osascript -e "tell application \"$app\" to activate" >/dev/null 2>&1 || true
    fi
    args=(-v -x)
    [[ -n "$max" ]] && args+=(-V "$max")
    [[ "$mode" != "screen" ]] && args+=(-R "$rect")
    rm -f "$out" "$mov"
    screencapture "${args[@]}" "$mov" & echo $! > "$(pidfile_for "$out")"
    sleep 1
    kill -0 "$(cat "$(pidfile_for "$out")")" 2>/dev/null || { echo "screen-record.sh: screencapture exited at once; grant Screen Recording permission to this terminal app in System Settings > Privacy & Security" >&2; exit 4; }
    echo "recording ${mode}${rect:+ $rect} -> $out (pid $(cat "$(pidfile_for "$out")"))";;
  stop)
    out="${1:?out.mp4 required}"; shift; keep=0; [[ "${1:-}" == "--keep-mov" ]] && keep=1; mov="$(mov_for "$out")"
    pf="$(pidfile_for "$out")"; [[ -f "$pf" ]] || { echo "screen-record.sh: no recording for $out" >&2; exit 3; }
    pid="$(cat "$pf")"; kill -INT "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
    rm -f "$pf"
    [[ -s "$mov" ]] || { echo "screen-record.sh: $mov is empty" >&2; exit 5; }
    command -v ffmpeg >/dev/null || { echo "screen-record.sh: ffmpeg not installed (brew install ffmpeg); raw recording kept at $mov" >&2; exit 6; }
    ffmpeg -y -loglevel error -i "$mov" -vcodec libx264 -pix_fmt yuv420p -movflags +faststart "$out"
    (( keep )) || rm -f "$mov"
    echo "wrote $out";;
  status) ls "${TMPDIR:-/tmp}"/*.pid 2>/dev/null; pgrep -fl "screencapture -v" || echo "no recording running";;
  -h|--help) usage;;
  *) echo "screen-record.sh: unknown command $cmd" >&2; usage; exit 2;;
esac
