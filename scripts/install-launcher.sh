#!/usr/bin/env bash
# QE Analog Topology 를 앱 목록(Activities)에 등록한다. --autostart 를 주면 로그인 시 자동 실행.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cat > "$APPS/qe-analog-topology.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=QE Analog Topology
Comment=QE Analog Computer 의 3D Topology 화면
Exec=$ROOT/run.sh
Icon=$ROOT/assets/icon.svg
Terminal=false
Categories=System;
DESKTOP
echo "등록됨: $APPS/qe-analog-topology.desktop"

if [ "${1:-}" = "--autostart" ]; then
  mkdir -p "$HOME/.config/autostart"
  cp "$APPS/qe-analog-topology.desktop" "$HOME/.config/autostart/"
  echo "자동 실행 등록됨: $HOME/.config/autostart/qe-analog-topology.desktop"
fi
