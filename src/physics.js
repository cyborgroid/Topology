// 회로의 물리: 블록 씨앗 = 질량. 시스템 회로를 3D 유기체처럼 움직이게 한다.
//  - 자리 용수철: 수학 자리(차원 D 가 정한 씨앗 + 사용자가 옮겨 둔 만큼)로 당긴다
//  - 연결 용수철: 이어진 블록끼리 수학 자리에서의 거리를 지키려 한다 — 하나를 끌면 회로가 따라온다
//  - 밀어내기: 너무 가까운 씨앗끼리 밀어낸다 (영역이 찌그러지지 않게)
//  - 감쇠: 움직임이 잦아들어 구조가 자리를 잡는다
const K_REST = 7, K_LINK = 5, K_PUSH = 30, PUSH_R = 2.4, DAMP = 5.5;

export class Physics {
  bodies = new Map();   // id -> { p: [x,y,z], v: [x,y,z], rest: [x,y,z] }
  links = [];           // { a, b, len }
  held = null;          // { id, p } — 손으로 잡은 씨앗은 손을 따른다

  // 수학 자리와 연결을 맞춘다. 새 씨앗은 제자리에서 태어난다.
  sync(rest, links) {
    for (const id of this.bodies.keys()) if (!rest.has(id)) this.bodies.delete(id);
    for (const [id, p] of rest) {
      const b = this.bodies.get(id);
      if (b) b.rest = [...p];
      else this.bodies.set(id, { p: [...p], v: [0, 0, 0], rest: [...p] });
    }
    this.links = links.filter(([a, b]) => rest.has(a) && rest.has(b) && a !== b).map(([a, b]) => {
      const ra = rest.get(a), rb = rest.get(b);
      return { a, b, len: Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]) };
    });
  }

  hold(id, p) { this.held = { id, p: [...p] }; }
  release() {
    const b = this.held && this.bodies.get(this.held.id);
    if (b) b.v = [0, 0, 0];   // 놓은 자리에 멈춘다
    this.held = null;
  }
  pos(id) { return this.bodies.get(id)?.p; }

  // 한 프레임. 운동 에너지(Σv²)를 돌려준다 — 0 에 가까우면 구조가 자리를 잡은 것
  step(dt) {
    const list = [...this.bodies.entries()];
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    const h = dt / steps;
    let energy = 0;
    for (let s = 0; s < steps; s++) {
      const f = new Map(list.map(([id, b]) => [id, b.rest.map((r, i) => K_REST * (r - b.p[i]) - DAMP * b.v[i])]));
      for (const { a, b, len } of this.links) {
        const pa = this.bodies.get(a).p, pb = this.bodies.get(b).p;
        const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const L = Math.hypot(...d) || 1e-6;
        const k = (K_LINK * (L - len)) / L;
        for (let i = 0; i < 3; i++) { f.get(a)[i] += k * d[i]; f.get(b)[i] -= k * d[i]; }
      }
      for (let x = 0; x < list.length; x++) {
        for (let y = x + 1; y < list.length; y++) {
          const pa = list[x][1].p, pb = list[y][1].p;
          const d = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
          const L = Math.hypot(...d);
          if (L >= PUSH_R || L < 1e-6) continue;
          const k = (K_PUSH * (PUSH_R - L)) / L;
          for (let i = 0; i < 3; i++) { f.get(list[x][0])[i] -= k * d[i]; f.get(list[y][0])[i] += k * d[i]; }
        }
      }
      energy = 0;
      for (const [id, b] of list) {
        if (this.held?.id === id) {
          b.v = this.held.p.map((v, i) => (v - b.p[i]) / h);
          b.p = [...this.held.p];
          energy += 1;   // 잡고 있는 동안은 계속 움직이는 중
          continue;
        }
        for (let i = 0; i < 3; i++) {
          b.v[i] += f.get(id)[i] * h;
          b.p[i] += b.v[i] * h;
        }
        energy += b.v[0] ** 2 + b.v[1] ** 2 + b.v[2] ** 2;
      }
    }
    return energy;
  }
}
