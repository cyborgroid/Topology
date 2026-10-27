// 작은 상태 벡터 시뮬레이터. 큐비트 k 는 기저 상태 인덱스의 k 번째 비트다.
export class QuantumState {
  constructor(n) {
    this.n = n;
    this.dim = 1 << n;
    this.re = new Float64Array(this.dim);
    this.im = new Float64Array(this.dim);
    this.re[0] = 1;   // |00…0⟩
  }

  // 2x2 복소 행렬 m = [[a, b], [c, d]], 각 원소는 [실수부, 허수부]
  apply1(q, [[a, b], [c, d]]) {
    const { re, im } = this;
    const bit = 1 << q;
    for (let i = 0; i < this.dim; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = a[0] * xr - a[1] * xi + b[0] * yr - b[1] * yi;
      im[i] = a[0] * xi + a[1] * xr + b[0] * yi + b[1] * yr;
      re[j] = c[0] * xr - c[1] * xi + d[0] * yr - d[1] * yi;
      im[j] = c[0] * xi + c[1] * xr + d[0] * yi + d[1] * yr;
    }
  }

  h(q) {
    const s = Math.SQRT1_2;
    this.apply1(q, [[[s, 0], [s, 0]], [[s, 0], [-s, 0]]]);
  }

  rx(q, t) {
    const c = Math.cos(t / 2), s = Math.sin(t / 2);
    this.apply1(q, [[[c, 0], [0, -s]], [[0, -s], [c, 0]]]);
  }

  ry(q, t) {
    const c = Math.cos(t / 2), s = Math.sin(t / 2);
    this.apply1(q, [[[c, 0], [-s, 0]], [[s, 0], [c, 0]]]);
  }

  cx(control, target) {
    const { re, im } = this;
    const cb = 1 << control, tb = 1 << target;
    for (let i = 0; i < this.dim; i++) {
      if (!(i & cb) || (i & tb)) continue;
      const j = i | tb;
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // 큐비트 q 의 블로흐 벡터 (x, y, z). 길이가 1 보다 짧으면 다른 큐비트와 얽혀 있다.
  bloch(q) {
    const { re, im } = this;
    const bit = 1 << q;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < this.dim; i++) {
      if (i & bit) continue;
      const j = i | bit;
      x += 2 * (re[i] * re[j] + im[i] * im[j]);
      y += 2 * (re[i] * im[j] - im[i] * re[j]);
      z += re[i] * re[i] + im[i] * im[i] - re[j] * re[j] - im[j] * im[j];
    }
    return [x, y, z];
  }
}
