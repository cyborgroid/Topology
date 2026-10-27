# QE Analog Topology

[Topology.md](Topology.md) 사양으로 만드는 **QE Analog Topology** — Digital OS 를 대신하는 Analog 화면.
화면은 실제 컴퓨터의 파일·앱·네트워크·시스템과 연결된다.

## 실행

| 스크립트 | 용도 |
| --- | --- |
| `./run.sh` | 로컬에서 띄우고 **접속 주소만 출력**한다. 그 주소를 VS Code 의 *Open Integrated Browser* 로 연다. Ctrl+C 로 종료. |
| `./vmware.sh` | VMware 게스트(Ubuntu 등)에서 **전체 화면 데스크톱 셸**로 실행한다. `--windowed` 창 모드, `--install` 앱 목록·자동 실행 등록. |

`run.sh` 는 의존성이 필요하다(`npm install`). 출력 주소의 `token` 은 실행할 때마다 새로 만들어지며,
토큰 없는 요청은 OS 연결(API)을 쓸 수 없다. 서버는 127.0.0.1 에서만 열린다.

`vmware.sh` 는 의존성이 없으면 설치하고, VMware 가상 GPU 에서는 소프트웨어 렌더링을 쓴다
(3D 가속을 켠 VM 에서 GPU 를 쓰려면 `TOPOLOGY_GPU=1 ./vmware.sh`).

## 두 가지 뷰 (작업 표시줄 또는 Tab 으로 전환)

### ◈ 회로 — 본 화면

Topology 전체가 하나의 **PCB 회로**다. 층은 겹겹이 쌓인 기판 레이어, 개념은 칩, 관계는 구리 배선이고,
다른 층끼리는 비아(via)로 이어진다. 배선 위로 신호가 흐른다.

① 자연·양자(QE) → ② 하드웨어(Chassis, Circuit) → ③ 언어(Instrument) → ④ 화면(Topology)
→ ⑤ 지능·표현(AI, Graphic) → ⑥ 네트워크(Network, 전화번호, 데이터, VPN, WIFI, 빅데이터)

| 입력 | 동작 |
| --- | --- |
| 왼쪽 드래그 | 회전 |
| 오른쪽 드래그 | 이동 |
| 스크롤 / 가운데 드래그 | 다가가기 · 물러나기 (Shift+스크롤 = 천천히) |
| 클릭 | 칩 선택 — 그 칩의 배선만 밝아지고 신호가 흐른다 |
| 더블클릭 | 칩으로 다가가기 · 빈 곳이면 전체 보기 |
| Home / Esc | 전체 보기 / 선택 해제 |

정보 패널의 **접목된 폴더** 버튼(예: Instrument → 📁 Documents)을 누르면 데스크톱 뷰에서 그 폴더 층이 열린다.

### ▣ 데스크톱 — 깊이로 펼친 Digital OS

평소 2D 데스크톱과 같은 화면이 깊이 방향으로 이어진다. 스크롤로 층 사이를 오가고,
멈추면 가장 가까운 층에 맞춰져 그 층이 평소 화면 그대로 보인다.

- **앞쪽** — 열린 창이 한 층씩
- **가운데** — 바탕화면
- **뒤쪽** — 폴더 층. 폴더를 클릭하면 그 내용이 바로 뒤에 새 층으로 생긴다(반투명하게 비쳐 보임).

| 입력 | 동작 |
| --- | --- |
| 스크롤 ↑ / ↓ | 안쪽(폴더 깊이)으로 / 바깥쪽(창)으로 |
| 폴더 클릭 / 더블클릭 | 뒤에 다음 층 만들기 / 그 층으로 들어가기 |
| 파일 더블클릭 | 기본 앱으로 열기 |
| 오른쪽 깊이 표시, PageUp/PageDown, Backspace | 층으로 바로 이동 |
| 창 제목 표시줄 드래그 / 스크롤 | 층 안에서 이동 / 이 창의 깊이 바꾸기 |

폴더 탐색기 창은 없다. 폴더 이동은 스크롤로 한다.
내장 앱: 터미널(bash, 대화형 프로그램 제외), 시스템, 네트워크. 시작 메뉴에서 설치된 앱도 실행할 수 있다.

## 구조

- [run.sh](run.sh), [server/server.js](server/server.js) — 로컬 서버(정적 파일 + 토큰 보호 API)
- [vmware.sh](vmware.sh), [app/main.js](app/main.js), [app/preload.js](app/preload.js) — Electron 전체 화면 셸
- [app/os-api.js](app/os-api.js) — 실제 OS 연결(파일, 앱, nmcli, 시스템 정보). 두 실행 방식이 함께 쓴다
- [src/bridge.js](src/bridge.js) — 화면 쪽 API (Electron 이면 preload, 아니면 토큰으로 서버 호출)
- [src/core.js](src/core.js) — 렌더러와 뷰 전환
- [src/diagram.js](src/diagram.js) — 회로 뷰: 기판, 칩, 배선·비아, 신호 펄스, 마우스 궤도 카메라
- [src/desktop.js](src/desktop.js) — 데스크톱 뷰: 창 층 · 바탕화면 · 폴더 층, 스크롤 깊이 이동
- [src/taskbar.js](src/taskbar.js), [src/apps.js](src/apps.js) — 작업 표시줄·시작 메뉴, 내장 앱
- [src/topology.config.js](src/topology.config.js) — 개념, 기판 층(TIERS), 배선(LINKS), 폴더 접목(ANCHORS)
