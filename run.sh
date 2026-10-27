#!/usr/bin/env bash
# QE Analog Topology 실행.
#   ./run.sh             전체 화면
#   ./run.sh --windowed  창 모드(개발용)
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

if [ ! -x node_modules/.bin/electron ]; then
  echo "의존성 설치 중…"
  npm install --no-audit --no-fund
fi

# VS Code 터미널 등에서 상속되면 Electron 이 Node 로만 동작한다.
unset ELECTRON_RUN_AS_NODE

[ "${1:-}" = "--windowed" ] && export TOPOLOGY_WINDOWED=1

exec node_modules/.bin/electron .
