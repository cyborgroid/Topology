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

### ◈ 다이어그램 — 본 화면

블록 코딩처럼 구조를 쌓은 3D 다이어그램.

- **개념 블록 탑** — Topology.md 의 개념이 위에서 아래로 맞물려 쌓인다:
  ① 자연·양자(QE) → ② 하드웨어(Chassis, Circuit) → ③ 언어(Instrument) → ④ 화면(Topology) → ⑤ 지능·표현(AI, Graphic) → ⑥ 네트워크(Network, 전화번호, 데이터, VPN, WIFI, 빅데이터)
- **폴더 접목** — 실제 폴더가 개념 블록 바로 뒤에 붙는다
  (홈·바탕화면→Topology, 문서→Instrument, 템플릿→Circuit, 다운로드·공개→Network, 사진·비디오→Graphic, 음악→QE).
- **폴더 = 계단** — 폴더의 내용은 한 단계 뒤·아래의 판 위에 블록 격자로 놓인다. 깊이 들어갈수록 계단처럼 내려간다.
  다른 곳에 접목된 폴더는 `↗` 바로가기 블록으로 표시된다.

| 입력 | 동작 |
| --- | --- |
| 드래그 | 구조를 돌려 보기 |
| 클릭 | 블록 선택(오른쪽 정보 패널) |
| 스크롤 ↑ | 가리킨(없으면 선택한) 폴더로 들어가기 |
| 스크롤 ↓ | 상위로 나오기 |
| 더블클릭 | 폴더: 들어가기 · 파일: 기본 앱으로 열기 |
| Space / Shift+Space | 위에서 / 아래에서 보기 |
| Home · Backspace · Enter | 전체 보기 · 나오기 · 선택한 폴더로 들어가기 |
| 위쪽 경로 표시 | 눌러서 그 단계로 이동 |

폴더 탐색기 창은 없다. 폴더 이동은 스크롤로 한다.

### ▣ 데스크톱 — 3D 로 펼친 Digital OS

평소의 2D 데스크톱(바탕화면 아이콘, 창, 작업 표시줄)과 같지만, 창마다 깊이가 다른 층에 놓인다.

| 입력 | 동작 |
| --- | --- |
| 스크롤(빈 곳) | 층 사이를 앞뒤로 이동, 멈추면 가장 가까운 층에 맞춰짐 |
| 창 제목 표시줄 드래그 / 스크롤 | 층 안에서 이동 / 이 창의 깊이 바꾸기 |
| 오른쪽 깊이 표시 · PageUp/PageDown | 층으로 바로 이동 |
| 바탕화면 폴더 더블클릭 | 다이어그램 뷰의 그 폴더로 이동 |

내장 앱: 터미널(bash, 대화형 프로그램 제외), 시스템, 네트워크. 시작 메뉴에서 설치된 앱도 실행할 수 있다.

## 구조

- [run.sh](run.sh), [server/server.js](server/server.js) — 로컬 서버(정적 파일 + 토큰 보호 API)
- [vmware.sh](vmware.sh), [app/main.js](app/main.js), [app/preload.js](app/preload.js) — Electron 전체 화면 셸
- [app/os-api.js](app/os-api.js) — 실제 OS 연결(파일, 앱, nmcli, 시스템 정보). 두 실행 방식이 함께 쓴다
- [src/bridge.js](src/bridge.js) — 화면 쪽 API (Electron 이면 preload, 아니면 토큰으로 서버 호출)
- [src/core.js](src/core.js) — 렌더러와 뷰 전환
- [src/diagram.js](src/diagram.js) — 다이어그램 뷰: 블록, 판, 궤도 카메라, 스크롤 탐색
- [src/tower.js](src/tower.js) — 개념 블록 탑
- [src/filegraph.js](src/filegraph.js) — 실제 폴더/파일을 블록 판으로 심기
- [src/desktop.js](src/desktop.js) — 데스크톱 뷰: 바탕화면 벽, 층으로 놓인 창, 깊이 표시
- [src/taskbar.js](src/taskbar.js), [src/apps.js](src/apps.js) — 작업 표시줄·시작 메뉴, 내장 앱
- [src/topology.config.js](src/topology.config.js) — 개념, 층(TIERS), 관계, 폴더 접목(ANCHORS)
