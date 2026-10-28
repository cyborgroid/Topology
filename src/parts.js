// 부품을 블록으로 짠다: 부품을 가져오는 것이 아니라, 같은 단위 블록을 엮는 방식(패턴)으로 그 블록의 기능을 드러낸다.
// 실제 부품 모형(물리)도, 영역 다면체(수학)도 아닌 개념적인 블록 구조. 모듈은 자기 영역 안의 칸 가운데
// 패턴에 맞는 칸에만 단위 블록을 놓는다.
//
// keep(c) 의 c = { d: 씨앗 칸에서의 칸 차이 [dx,dy,dz], r: 그 거리, surface: 코어 겉면 칸, border: 다른 모듈과 맞닿은 칸,
//                 axial: 핵 → 씨앗 방향 성분, radial: 그 방향에서 벗어난 거리 }
const mod = (x, m) => ((x % m) + m) % m;

export const PATTERNS = {
  data:       { name: '메모리 층', keep: (c) => mod(c.d[1], 2) === 0 || c.border },
  phone:      { name: '식별 묶음', keep: (c) => c.r <= 2.5 || c.border },
  wifi:       { name: '안테나 고리', keep: (c) => mod(Math.round(c.r), 3) === 0 || c.surface },
  vpn:        { name: '차폐 외피', keep: (c) => c.border || c.surface || c.r < 1 },
  network:    { name: '포트 채널', keep: (c) => (mod(c.d[0], 2) === 0 && mod(c.d[2], 2) === 0) || c.border },
  bigdata:    { name: '원판 더미', keep: (c) => mod(c.d[1], 3) !== 2 },
  qe:         { name: '양자 핵', keep: (c) => c.r <= 2.6 || c.border, glow: (c) => c.r <= 2.6 },
  instrument: { name: '제어 등뼈 · 빗살', keep: (c) => c.radial <= 1 || mod(c.d[0] + c.d[1] + c.d[2], 3) === 0 },
  ai:         { name: '연산 핀', keep: (c) => mod(c.d[0] + c.d[2], 2) === 0 || c.r <= 1.5 },
  graphic:    { name: '부채꼴', keep: (c) => c.r <= 1.5 || mod(Math.floor((Math.atan2(c.d[2], c.d[0]) + Math.PI) / (Math.PI / 4)), 2) === 0 },
  topology:   { name: '표시판', keep: (c) => c.surface || c.r <= 1 },
};
