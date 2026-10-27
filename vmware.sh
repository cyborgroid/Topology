#!/usr/bin/env bash
# VMware 게스트(Ubuntu 등)에서 QE Analog Topology 를 전체 화면 데스크톱 셸로 실행한다.
#   ./vmware.sh             전체 화면으로 실행
#   ./vmware.sh --windowed  창 모드로 실행
#   ./vmware.sh --install   게스트의 앱 목록과 로그인 자동 실행에 등록
set -euo pipefail
ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$ROOT"

if [ "${1:-}" = "--install" ]; then
  entry="[Desktop Entry]
Type=Application
Name=QE Analog Topology
Comment=QE Analog Computer 의 Topology 화면
Exec=$ROOT/vmware.sh
Icon=$ROOT/assets/icon.svg
Terminal=false
Categories=System;"
  mkdir -p "$HOME/.local/share/applications" "$HOME/.config/autostart"
  printf '%s\n' "$entry" > "$HOME/.local/share/applications/qe-analog-topology.desktop"
  printf '%s\n' "$entry" > "$HOME/.config/autostart/qe-analog-topology.desktop"
  echo "등록됨: 앱 목록 + 로그인 시 자동 실행"
  exit 0
fi

if [ ! -x node_modules/.bin/electron ]; then
  echo "의존성 설치 중…"
  npm install --no-audit --no-fund
fi

# VS Code 터미널 등에서 상속되면 Electron 이 Node 로만 동작한다.
unset ELECTRON_RUN_AS_NODE
[ "${1:-}" = "--windowed" ] && export TOPOLOGY_WINDOWED=1

# VMware 의 가상 GPU 는 WebGL 이 막히는 경우가 많아 소프트웨어 렌더링을 쓴다.
# 3D 가속을 켠 VM 에서 GPU 를 쓰려면 TOPOLOGY_GPU=1 ./vmware.sh
if [ "$(systemd-detect-virt 2>/dev/null || true)" = "vmware" ] && [ -z "${TOPOLOGY_GPU:-}" ]; then
  export TOPOLOGY_SOFTWARE_GL=1
fi

exec node_modules/.bin/electron .
