import * as THREE from 'three';

/**
 * Builds loose garments as smooth fabric tubes wrapped around body regions.
 *
 * For each slice along a limb/torso axis, the body's outermost extent is
 * measured in every direction; the tube follows that envelope (so fabric rests
 * on the chest, shoulder blades and hips but bridges the hollows between them),
 * gets extra ease, and can be made to "hang" — never narrowing faster than
 * fabric would fall — which gives straight-hanging shirts and straight-leg
 * trousers instead of a bodysuit.
 */

/** Sample points with the skinning data of the body vertex they came from. */
export interface BodyPoints {
  xyz: number[];
  skinIndex: number[]; // 4 per point
  skinWeight: number[]; // 4 per point
}

export function emptyPoints(): BodyPoints {
  return { xyz: [], skinIndex: [], skinWeight: [] };
}

export interface TubeOptions {
  /** Axis the tube runs along: 'y' (torso, legs) or 'x' (T-pose arms). */
  axis: 'x' | 'y';
  /** For x-axis tubes: +1 for the figure's left arm (x > 0), -1 for the right. */
  side?: 1 | -1;
  /** Range along the axis (for x-axis tubes, measured as distance from the centre line). */
  from: number;
  to: number;
  slices: number;
  around?: number;
  /** Extra room (metres) at fraction t in [0,1] from `from` to `to`. */
  ease: (t: number) => number;
  /**
   * Hang: walking from `hangStart` side towards `from`, the radius may only shrink
   * by this factor per slice (1 = perfectly straight). Omit for a fitted tube.
   */
  hang?: number;
  /** Which end the fabric hangs from: 'to' (default — e.g. shoulders) or 'from'. */
  hangFrom?: 'from' | 'to';
}

interface Tube {
  positions: Float32Array;
  index: number[];
}

function buildTube(pts: BodyPoints, o: TubeOptions): Tube | null {
  const S = o.slices;
  const K = o.around ?? 48;
  const span = o.to - o.from;
  const step = span / S;
  const n = pts.xyz.length / 3;

  // Coordinates: u along the axis, (a, b) across it.
  const uOf = (i: number) => (o.axis === 'y' ? pts.xyz[i * 3 + 1] : pts.xyz[i * 3] * (o.side ?? 1));
  const aOf = (i: number) => (o.axis === 'y' ? pts.xyz[i * 3] : pts.xyz[i * 3 + 1]);
  const bOf = (i: number) => pts.xyz[i * 3 + 2];

  const ca = new Float32Array(S + 1), cb = new Float32Array(S + 1), cn = new Float32Array(S + 1);
  const band: number[][] = Array.from({ length: S + 1 }, () => []);
  for (let i = 0; i < n; i++) {
    const u = uOf(i);
    const jf = (u - o.from) / step;
    if (jf < -1 || jf > S + 1) continue;
    const j0 = Math.max(0, Math.floor(jf - 1.5)), j1 = Math.min(S, Math.ceil(jf + 1.5));
    for (let j = j0; j <= j1; j++) {
      if (Math.abs(jf - j) <= 1.5) {
        band[j].push(i);
        ca[j] += aOf(i);
        cb[j] += bOf(i);
        cn[j]++;
      }
    }
  }
  if (!cn.some((c) => c > 0)) return null;
  for (let j = 0; j <= S; j++) {
    if (cn[j]) {
      ca[j] /= cn[j];
      cb[j] /= cn[j];
    }
  }
  // Fill empty slices from the nearest filled one, then smooth the centre line.
  for (let j = 0; j <= S; j++) {
    if (cn[j]) continue;
    let d = 1;
    while (d <= S) {
      if (j - d >= 0 && cn[j - d]) { ca[j] = ca[j - d]; cb[j] = cb[j - d]; break; }
      if (j + d <= S && cn[j + d]) { ca[j] = ca[j + d]; cb[j] = cb[j + d]; break; }
      d++;
    }
  }
  // A wandering centre line (the body's mass shifts slice to slice) shows up as ripples, so iron it flat.
  for (let pass = 0; pass < 40; pass++) {
    const a2 = ca.slice(), b2 = cb.slice();
    for (let j = 1; j < S; j++) {
      ca[j] = (a2[j - 1] + 2 * a2[j] + a2[j + 1]) / 4;
      cb[j] = (b2[j - 1] + 2 * b2[j] + b2[j + 1]) / 4;
    }
  }

  // Outermost extent per (slice, direction).
  const R: Float32Array[] = Array.from({ length: S + 1 }, () => new Float32Array(K));
  for (let j = 0; j <= S; j++) {
    for (const i of band[j]) {
      const da = aOf(i) - ca[j], db = bOf(i) - cb[j];
      const r = Math.hypot(da, db);
      const k = Math.floor(((Math.atan2(db, da) + Math.PI) / (2 * Math.PI)) * K) % K;
      if (r > R[j][k]) R[j][k] = r;
    }
    // Fill empty directions by interpolating around the ring.
    const row = R[j];
    if (!row.some((r) => r > 0)) continue;
    for (let k = 0; k < K; k++) {
      if (row[k] > 0) continue;
      let l = 1, r = 1;
      while (row[(k - l + K) % K] <= 0) l++;
      while (row[(k + r) % K] <= 0) r++;
      row[k] = (row[(k - l + K) % K] * r + row[(k + r) % K] * l) / (l + r);
    }
  }
  for (let j = 0; j <= S; j++) {
    if (R[j].some((r) => r > 0)) continue;
    const near = R.find((_, jj) => Math.abs(jj - j) <= S && R[jj].some((r) => r > 0)) || R[j];
    R[j].set(near);
  }

  // Envelope: a ring rests on its high points (like fabric), so take a rolling max around it,
  // then blur around and along the tube.
  for (let j = 0; j <= S; j++) {
    const row = R[j], src = row.slice();
    for (let k = 0; k < K; k++) {
      row[k] = Math.max(src[(k - 1 + K) % K], src[k], src[(k + 1) % K]);
    }
  }
  // Remember the true envelope: smoothing may add room but must never pull fabric inside the body.
  const envelope = R.map((r) => r.slice());
  for (let pass = 0; pass < 6; pass++) {
    for (let j = 0; j <= S; j++) {
      const row = R[j], src = row.slice();
      for (let k = 0; k < K; k++) row[k] = (src[(k - 1 + K) % K] + 2 * src[k] + src[(k + 1) % K]) / 4;
    }
  }
  // Long blur along the tube irons out the bands left by the body's plate edges.
  for (let pass = 0; pass < 24; pass++) {
    const copy = R.map((r) => r.slice());
    for (let j = 1; j < S; j++) {
      for (let k = 0; k < K; k++) R[j][k] = (copy[j - 1][k] + 2 * copy[j][k] + copy[j + 1][k]) / 4;
    }
  }

  for (let j = 0; j <= S; j++) for (let k = 0; k < K; k++) R[j][k] = Math.max(R[j][k], envelope[j][k]);
  // One light pass to soften any edges the floor above re-introduced.
  for (let j = 0; j <= S; j++) {
    const row = R[j], src = row.slice();
    for (let k = 0; k < K; k++) row[k] = Math.max(src[k], (src[(k - 1 + K) % K] + 2 * src[k] + src[(k + 1) % K]) / 4);
  }

  // Hang: fabric falls from the top edge and can't cling into hollows below it.
  if (o.hang) {
    const top = o.hangFrom === 'from' ? 0 : S;
    const dir = top === S ? -1 : 1;
    for (let j = top + dir; j >= 0 && j <= S; j += dir) {
      for (let k = 0; k < K; k++) R[j][k] = Math.max(R[j][k], R[j - dir][k] * o.hang);
    }
  }

  const positions = new Float32Array((S + 1) * K * 3);
  for (let j = 0; j <= S; j++) {
    const u = o.from + step * j;
    const e = o.ease(j / S);
    for (let k = 0; k < K; k++) {
      const th = ((k + 0.5) / K) * 2 * Math.PI - Math.PI;
      const r = R[j][k] + e;
      const a = ca[j] + r * Math.cos(th), b = cb[j] + r * Math.sin(th);
      const v = (j * K + k) * 3;
      if (o.axis === 'y') {
        positions[v] = a;
        positions[v + 1] = u;
        positions[v + 2] = b;
      } else {
        positions[v] = u * (o.side ?? 1);
        positions[v + 1] = a;
        positions[v + 2] = b;
      }
    }
  }
  const index: number[] = [];
  for (let j = 0; j < S; j++) {
    for (let k = 0; k < K; k++) {
      const a = j * K + k, b = j * K + ((k + 1) % K), c = (j + 1) * K + k, d = (j + 1) * K + ((k + 1) % K);
      // Keep normals pointing outwards (x-axis tubes on the +x side wind the other way).
      if (o.axis === 'x' && (o.side ?? 1) > 0) index.push(a, b, c, b, d, c);
      else index.push(a, c, b, b, c, d);
    }
  }
  return { positions, index };
}

/** Nearest-sample lookup so each garment vertex borrows the skinning of the body under it. */
function makeNearest(pts: BodyPoints) {
  const cell = 0.05;
  const grid = new Map<string, number[]>();
  const n = pts.xyz.length / 3;
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) {
    const k = key(pts.xyz[i * 3], pts.xyz[i * 3 + 1], pts.xyz[i * 3 + 2]);
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  }
  return (x: number, y: number, z: number) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let best = -1, bestD = Infinity;
    for (let r = 1; r <= 4 && best < 0; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const d = (pts.xyz[i * 3] - x) ** 2 + (pts.xyz[i * 3 + 1] - y) ** 2 + (pts.xyz[i * 3 + 2] - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
    }
    if (best < 0) {
      for (let i = 0; i < n; i++) {
        const d = (pts.xyz[i * 3] - x) ** 2 + (pts.xyz[i * 3 + 1] - y) ** 2 + (pts.xyz[i * 3 + 2] - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    return best;
  };
}

/** Build one skinned-ready geometry from several tubes around the same body points. */
export function wrapGarment(skinFrom: BodyPoints, tubes: Array<{ pts: BodyPoints; opts: TubeOptions }>) {
  const built = tubes.map((t) => buildTube(t.pts, t.opts)).filter((t): t is Tube => !!t);
  if (!built.length || !skinFrom.xyz.length) return null;
  const total = built.reduce((s, t) => s + t.positions.length / 3, 0);
  const P = new Float32Array(total * 3);
  const SI = new Uint16Array(total * 4), SW = new Float32Array(total * 4);
  const index: number[] = [];
  const nearest = makeNearest(skinFrom);
  let base = 0;
  for (const t of built) {
    const cnt = t.positions.length / 3;
    P.set(t.positions, base * 3);
    for (const i of t.index) index.push(i + base);
    for (let v = 0; v < cnt; v++) {
      const s = nearest(t.positions[v * 3], t.positions[v * 3 + 1], t.positions[v * 3 + 2]);
      for (let k = 0; k < 4; k++) {
        SI[(base + v) * 4 + k] = skinFrom.skinIndex[s * 4 + k];
        SW[(base + v) * 4 + k] = skinFrom.skinWeight[s * 4 + k];
      }
    }
    base += cnt;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
