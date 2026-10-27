#!/usr/bin/env bash
# QE Analog Topology 를 로컬에서 띄우고 접속 주소만 출력한다.
# 그 주소를 VS Code 의 "Open Integrated Browser" 로 연다. 브라우저를 직접 열거나 다른 작업은 하지 않는다.
# Ctrl+C 로 종료.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

if [ ! -f node_modules/three/build/three.module.js ]; then
  echo "node_modules 가 없습니다. 먼저 npm install 을 실행하세요." >&2
  exit 1
fi

exec node server/server.js
