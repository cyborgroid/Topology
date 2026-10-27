# Topology

[Topology.md](Topology.md) 의 사양을 바탕으로 만든 QE Analog Computer 의 3D Topology 화면.

## 실행

```bash
python3 -m http.server 8000
```

브라우저에서 http://localhost:8000 을 연다. (ES 모듈이라 파일을 직접 열면 동작하지 않는다.)

## 조작

| 입력 | 동작 |
| --- | --- |
| Scroll | 전진 / 후진 |
| Shift + Scroll | 좌우 이동 |
| Space | 상승 |
| Shift + Space | 하강 |
| Drag | 시선 회전 |
| Click | 노드 설명 보기 |

Shift 를 누르고 있으면 스크롤 이동이 느려져 정밀하게 위치를 잡을 수 있다.

## 구조

- [index.html](index.html) — 화면 레이아웃과 HUD
- [src/main.js](src/main.js) — 물속 같은 3D 환경, 조작, 렌더링
- [src/topology.config.js](src/topology.config.js) — 노드(Topology, QE, Instrument, Chassis, Circuit, AI, Graphic, Network …)와 링크 정의. 사양이 바뀌면 이 파일만 고치면 된다.
