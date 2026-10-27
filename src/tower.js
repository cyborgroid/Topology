// 개념 블록 탑: TIERS 순서대로 위에서 아래로 블록을 쌓고, 층마다 바닥판과 층 이름을 둔다.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { addNode, addDecor, setOverview, BLOCKS, ROOT } from './diagram.js';
import { GROUPS, NODES, TIERS } from './topology.config.js';

export const TIER_STEP = 2.1;
const GAP_X = 0.35;

export function buildTower() {
  const defs = Object.fromEntries(NODES.map((n) => [n.id, n]));
  let widest = 0;

  TIERS.forEach((tier, i) => {
    const y = -i * TIER_STEP;
    // 여러 블록이 한 층에 들어가면 첫 블록(주 개념) 뒤를 작은 구성원 블록으로 잇는다.
    const shapes = tier.blocks.map((_, j) => (tier.blocks.length > 2 && j > 0 ? BLOCKS.member : BLOCKS.concept));
    const width = shapes.reduce((s, b) => s + b.w, 0) + GAP_X * (shapes.length - 1);
    widest = Math.max(widest, width);

    let x = -width / 2;
    tier.blocks.forEach((id, j) => {
      const def = defs[id];
      const shape = shapes[j];
      addNode({
        id, name: def.name, kind: 'concept', color: GROUPS[def.group].color, shape,
        pos: new THREE.Vector3(x + shape.w / 2, y, 0),
        parentId: id === ROOT ? null : ROOT,
        data: { desc: def.desc, tier: tier.name },
      });
      x += shape.w + GAP_X;
    });

    const floor = addDecor(new THREE.Mesh(
      new THREE.BoxGeometry(width + 1.2, 0.12, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0b3a5a, transparent: true, opacity: 0.6 }),
    ));
    floor.position.set(0, y - 1.15, 0);

    const el = document.createElement('div');
    el.className = 'label label-tier';
    el.textContent = tier.name;
    const label = new CSS2DObject(el);
    label.center.set(1, 0.5);
    label.position.set(-width / 2 - 0.9, 1.15, 0);   // 바닥판 기준: 블록 높이의 왼쪽
    floor.add(label);
  });

  // 전체를 비스듬히 내려다보는 시점: 탑과 그 뒤로 뻗은 폴더 판이 함께 보인다.
  setOverview(new THREE.Vector3(0, -((TIERS.length - 1) * TIER_STEP) / 2 - 1, -5), 34);
  return widest;
}
