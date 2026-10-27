# QE Analog Topology

[Topology.md](Topology.md) 사양으로 만드는 **QE Analog Topology** — Digital OS 의 데스크톱을 대신하는 3D Analog 화면.
웹 페이지가 아니라 이 컴퓨터 위에서 직접 실행되는 데스크톱 셸(Electron)이며, 실제 파일·앱·네트워크·시스템과 연결된다.

## 실행

```bash
./run.sh              # 전체 화면
./run.sh --windowed   # 창 모드(개발용)
```

처음 실행하면 의존성을 자동으로 설치한다(Node.js / npm 필요).
GPU 가 없는 환경(VM 등)에서는 `TOPOLOGY_SOFTWARE_GL=1 ./run.sh` 로 소프트웨어 렌더링을 쓴다.

앱 목록(Activities)에 등록하려면:

```bash
scripts/install-launcher.sh               # 앱 목록에 등록
scripts/install-launcher.sh --autostart   # + 로그인 시 자동 실행
```

## 조작

| 입력 | 동작 |
| --- | --- |
| Scroll | 전진 / 후진 |
| Shift + Scroll | 좌우 이동 |
| Space / Shift + Space | 상승 / 하강 |
| Drag (빈 공간) | 시선 회전 |
| Home 키, ◎ 버튼 | 원위치 |
| 노드 클릭 | 개념 노드: 설명 창 · 폴더 노드: 펼치기/접기 |
| 노드 더블클릭 | 폴더: 파일 창 · 파일: 기본 앱으로 열기 |
| 창 제목 표시줄 | 드래그 = 이동, 스크롤 = 앞뒤(깊이) 이동, 더블클릭 = 정면으로 |

## 화면 구성

- **Topology 그래프** — [Topology.md](Topology.md) 의 개념(Topology, QE, Instrument, Chassis, Circuit, AI, Graphic, Network …).
- **파일 시스템 접목** — 실제 폴더와 파일이 그래프 노드로 자란다. 홈 폴더는 개념 노드에 접목된다
  (문서→Instrument, 다운로드·공개→Network, 사진·비디오→Graphic, 음악→QE, 템플릿→Circuit, 홈·바탕화면→Topology).
  매핑은 [src/topology.config.js](src/topology.config.js) 의 `ANCHORS` 에서 바꾼다.
- **3D 데스크톱** — 창은 3D 공간에 떠 있는 실제 창이다. 바탕화면 아이콘은 실제 바탕화면 폴더 내용이다.
- **작업 표시줄** — 시작 메뉴(내장 앱 + 설치된 앱 실행), 열린 창, Topology 좌표, 네트워크, 배터리, 시계.
- **내장 앱** — 파일, 터미널(bash, 대화형 프로그램 제외), 시스템, 네트워크.

## 구조

- [run.sh](run.sh) — 실행 진입점
- [app/main.js](app/main.js) — Electron 메인 프로세스: 화면 창, OS 연결(파일, 앱, nmcli, 시스템 정보)
- [app/preload.js](app/preload.js) — 화면에 노출하는 OS API(`window.topology`)
- [src/scene.js](src/scene.js) — 물속 3D 공간, 카메라 조작, 노드/링크 그래프
- [src/filegraph.js](src/filegraph.js) — 실제 파일 시스템을 그래프에 심고 펼치기
- [src/desktop.js](src/desktop.js) — 3D 창, 작업 표시줄, 시작 메뉴, 바탕화면 아이콘
- [src/apps.js](src/apps.js) — 내장 앱
- [src/topology.config.js](src/topology.config.js) — 개념 노드, 링크, 폴더 접목 매핑, 조작 설정
