import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GarmentItem } from '../types/wardrobe';
import { getFabricTexture } from '../utils/proceduralTextures';
import { BodyPoints, emptyPoints, wrapGarment } from './garmentWrap';

/**
 * Realistic store-style mannequin.
 *
 * Loads a smooth, rigged human figure (public/models/mannequin.glb — the Mixamo
 * "X Bot" shipped with the three.js examples), stands it straight with arms
 * lowered and gives it a glossy fibreglass finish.
 *
 * Body type: a "female" option reshapes the figure in its bind pose (narrower
 * shoulders, defined waist, wider hips, bust, smaller head, slightly shorter).
 *
 * Clothes are built from the figure's own surface: each garment is the matching
 * body region pushed outwards (looser where real clothes hang away from the
 * body), then smoothed so it reads as fabric rather than a bodysuit, and skinned
 * to the same skeleton.
 */

const MODEL_URL = import.meta.env.BASE_URL + 'models/mannequin.glb';

export type BodyType = 'male' | 'female';

type Part = 'head' | 'torso' | 'hips' | 'shoulder' | 'upperArm' | 'forearm' | 'hand' | 'legs' | 'feet';

export interface Outfit {
  jacket: GarmentItem | null;
  top: GarmentItem;
  bottom: GarmentItem;
  shoes: GarmentItem;
}

export interface RealisticMannequin {
  root: THREE.Group;
  setOutfit(outfit: Outfit, maxAnisotropy: number): void;
  setBodyType(type: BodyType): void;
  dispose(): void;
}

const LONG_SLEEVE_TOPS = new Set(['black-hoodie', 'sky-oxford']);

function partForBone(name: string): Part {
  if (/Foot|Toe/.test(name)) return 'feet';
  if (/UpLeg|Leg/.test(name)) return 'legs';
  if (/Hand/.test(name)) return 'hand';
  if (/ForeArm/.test(name)) return 'forearm';
  if (/Shoulder/.test(name)) return 'shoulder';
  if (/Arm/.test(name)) return 'upperArm';
  if (/Spine/.test(name)) return 'torso';
  if (/Hips/.test(name)) return 'hips';
  return 'head';
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));

/** Per-mesh vertex data, classified once in the bind (T) pose. */
interface Source {
  mesh: THREE.SkinnedMesh;
  pos: THREE.BufferAttribute;
  original: Float32Array;
  nor: THREE.BufferAttribute;
  skinIndex: THREE.BufferAttribute;
  skinWeight: THREE.BufferAttribute;
  index: THREE.BufferAttribute | null;
  parts: Part[];
}

function prepare(mesh: THREE.SkinnedMesh): Source {
  const g = mesh.geometry;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const skinIndex = g.attributes.skinIndex as THREE.BufferAttribute;
  const skinWeight = g.attributes.skinWeight as THREE.BufferAttribute;
  const bones = mesh.skeleton.bones;
  const parts: Part[] = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    let bestW = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(i, k);
      if (w > bestW) {
        bestW = w;
        best = skinIndex.getComponent(i, k);
      }
    }
    parts[i] = partForBone(bones[best]?.name || '');
  }
  return {
    mesh,
    pos,
    original: Float32Array.from(pos.array as ArrayLike<number>),
    nor: g.attributes.normal as THREE.BufferAttribute,
    skinIndex,
    skinWeight,
    index: g.index,
    parts,
  };
}

/**
 * Copy the selected triangles of a source, push them out along their normals by
 * `offset`, then relax the surface (Taubin smoothing, which doesn't shrink) so
 * plate seams and small body details disappear the way they do under fabric.
 */
function garmentGeometry(
  src: Source,
  select: (i: number) => boolean,
  offset: (i: number) => number,
  smoothIterations: number
): THREE.BufferGeometry | null {
  const { pos, nor, skinIndex, skinWeight, index } = src;
  const count = pos.count;
  const triCount = index ? index.count / 3 : count / 3;
  const vi = (t: number, c: number) => (index ? index.getX(t * 3 + c) : t * 3 + c);

  const map = new Int32Array(count).fill(-1);
  const out: number[] = [];
  let n = 0;
  for (let t = 0; t < triCount; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const hits = (select(a) ? 1 : 0) + (select(b) ? 1 : 0) + (select(c) ? 1 : 0);
    if (hits < 2) continue;
    for (const v of [a, b, c]) {
      if (map[v] < 0) map[v] = n++;
      out.push(map[v]);
    }
  }
  if (!n) return null;

  const P = new Float32Array(n * 3);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let v = 0; v < count; v++) {
    const m = map[v];
    if (m < 0) continue;
    const d = offset(v);
    for (let k = 0; k < 3; k++) P[m * 3 + k] = pos.getComponent(v, k) + nor.getComponent(v, k) * d;
    for (let k = 0; k < 4; k++) {
      SI[m * 4 + k] = skinIndex.getComponent(v, k);
      SW[m * 4 + k] = skinWeight.getComponent(v, k);
    }
  }

  // Weld duplicate vertices (UV seams) so smoothing and normals don't tear.
  const weld = new Int32Array(n);
  const keyToId = new Map<string, number>();
  let w = 0;
  for (let m = 0; m < n; m++) {
    const key = `${Math.round(P[m * 3] * 2e4)},${Math.round(P[m * 3 + 1] * 2e4)},${Math.round(P[m * 3 + 2] * 2e4)}`;
    let id = keyToId.get(key);
    if (id === undefined) {
      id = w++;
      keyToId.set(key, id);
    }
    weld[m] = id;
  }
  const W = new Float32Array(w * 3);
  for (let m = 0; m < n; m++) for (let k = 0; k < 3; k++) W[weld[m] * 3 + k] = P[m * 3 + k];
  const nbrs: Set<number>[] = Array.from({ length: w }, () => new Set<number>());
  for (let t = 0; t < out.length; t += 3) {
    const a = weld[out[t]], b = weld[out[t + 1]], c = weld[out[t + 2]];
    nbrs[a].add(b).add(c);
    nbrs[b].add(a).add(c);
    nbrs[c].add(a).add(b);
  }
  const nbrList = nbrs.map((s) => Array.from(s));
  const tmp = new Float32Array(w * 3);
  const relax = (factor: number) => {
    for (let i = 0; i < w; i++) {
      const list = nbrList[i];
      if (!list.length) {
        for (let k = 0; k < 3; k++) tmp[i * 3 + k] = W[i * 3 + k];
        continue;
      }
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const j of list) sum += W[j * 3 + k];
        const avg = sum / list.length;
        tmp[i * 3 + k] = W[i * 3 + k] + factor * (avg - W[i * 3 + k]);
      }
    }
    W.set(tmp);
  };
  for (let it = 0; it < smoothIterations; it++) {
    relax(0.5);
    relax(-0.53);
  }

  // Smooth normals on the welded surface.
  const WN = new Float32Array(w * 3);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t < out.length; t += 3) {
    const a = weld[out[t]], b = weld[out[t + 1]], c = weld[out[t + 2]];
    e1.set(W[b * 3] - W[a * 3], W[b * 3 + 1] - W[a * 3 + 1], W[b * 3 + 2] - W[a * 3 + 2]);
    e2.set(W[c * 3] - W[a * 3], W[c * 3 + 1] - W[a * 3 + 1], W[c * 3 + 2] - W[a * 3 + 2]);
    fn.crossVectors(e1, e2);
    for (const v of [a, b, c]) {
      WN[v * 3] += fn.x;
      WN[v * 3 + 1] += fn.y;
      WN[v * 3 + 2] += fn.z;
    }
  }

  const N = new Float32Array(n * 3);
  for (let m = 0; m < n; m++) {
    const id = weld[m];
    const len = Math.hypot(WN[id * 3], WN[id * 3 + 1], WN[id * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) {
      P[m * 3 + k] = W[id * 3 + k];
      N[m * 3 + k] = WN[id * 3 + k] / len;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geo.setIndex(out);
  return geo;
}

export async function loadRealisticMannequin(initialBody: BodyType = 'male'): Promise<RealisticMannequin> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const model = gltf.scene;

  // Glossy off-white fibreglass, like a shop-window mannequin.
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8e4dc,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
  });

  // The figure is made of body plates plus ball joints; clothes must cover both.
  const meshes: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.material = bodyMat;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    if (m.isSkinnedMesh) meshes.push(m);
  });
  if (!meshes.length) throw new Error('Mannequin model has no skinned surface');

  // Classify vertices in the bind (T) pose.
  const sources = meshes.map(prepare);
  const ref = sources.find((s) => s.mesh.name === 'Beta_Surface') || sources[0];

  // Reference measurements from the figure itself (bind pose, metres).
  let height = 0, hipSum = 0, hipN = 0, armMin = Infinity, elbowX = 0, armYSum = 0, armN = 0;
  for (let i = 0; i < ref.pos.count; i++) {
    const y = ref.original[i * 3 + 1];
    height = Math.max(height, y);
    if (ref.parts[i] === 'hips') {
      hipSum += y;
      hipN++;
    }
    if (ref.parts[i] === 'upperArm') {
      const ax = Math.abs(ref.original[i * 3]);
      armMin = Math.min(armMin, ax);
      elbowX = Math.max(elbowX, ax);
      armYSum += y;
      armN++;
    }
  }
  const H = height || 1.8;
  const waistY = hipN ? hipSum / hipN + 0.03 : 0.56 * H;
  const shortSleeveX = armMin + (elbowX - armMin) * 0.55;
  const armAxisY = armN ? armYSum / armN : 0.79 * H;

  // Bones we reshape or pose (matched by suffix: loaders may drop the "mixamorig:" colon).
  const findBone = (suffix: string) => {
    let found: THREE.Object3D | undefined;
    model.traverse((o) => {
      if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o;
    });
    return found;
  };
  const bones = {
    leftArm: findBone('LeftArm'),
    rightArm: findBone('RightArm'),
    leftUpLeg: findBone('LeftUpLeg'),
    rightUpLeg: findBone('RightUpLeg'),
  };
  const restPositions = new Map<THREE.Object3D, THREE.Vector3>();
  Object.values(bones).forEach((b) => b && restPositions.set(b, b.position.clone()));

  /** Shift a bone sideways in world space (positive = away from the centre line). */
  const shiftBone = (bone: THREE.Object3D | undefined, outward: number) => {
    if (!bone || !bone.parent) return;
    const rest = restPositions.get(bone)!;
    bone.position.copy(rest);
    model.updateMatrixWorld(true);
    const world = bone.getWorldPosition(new THREE.Vector3());
    world.x += Math.sign(world.x || 1) * outward;
    bone.position.copy(bone.parent.worldToLocal(world));
    model.updateMatrixWorld(true);
  };

  model.updateMatrixWorld(true);
  const armX = Math.abs(bones.leftArm?.getWorldPosition(new THREE.Vector3()).x ?? 0.18);

  /** Reshape the bind-pose surface for the chosen body type. */
  const shoulderNarrow = 0.88; // female shoulder width factor
  function applyBody(type: BodyType) {
    const female = type === 'female';
    for (const src of sources) {
      const arr = src.pos.array as Float32Array;
      const o = src.original;
      for (let i = 0; i < src.pos.count; i++) {
        let x = o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2];
        if (female) {
          const part = src.parts[i];
          if (part === 'torso' || part === 'hips' || part === 'shoulder') {
            // narrower shoulders, defined waist, wider hips, bust
            x *= 1 - (1 - shoulderNarrow) * smoothstep(0.66 * H, 0.8 * H, y);
            const waist = gauss(y, 0.6 * H, 0.045 * H);
            x *= 1 - 0.1 * waist;
            z *= 1 - 0.07 * waist;
            const hips = gauss(y, 0.51 * H, 0.05 * H);
            x *= 1 + 0.1 * hips;
            z *= 1 + 0.06 * hips;
            if (z > 0) z += 0.038 * gauss(y, 0.71 * H, 0.032 * H) * gauss(Math.abs(x), 0.085, 0.045);
          } else if (part === 'upperArm' || part === 'forearm') {
            // slimmer arms (T-pose arms run along x)
            y = armAxisY + (y - armAxisY) * 0.88;
            z *= 0.88;
          } else if (part === 'legs') {
            // thighs follow the wider hips, slightly slimmer calves
            x += Math.sign(x) * 0.012 * smoothstep(0.28 * H, 0.47 * H, y);
          } else if (part === 'head') {
            const cy = 0.93 * H;
            if (y > 0.86 * H) {
              x *= 0.95;
              z *= 0.95;
              y = cy + (y - cy) * 0.95;
            }
          }
        }
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = z;
      }
      src.pos.needsUpdate = true;
      src.mesh.geometry.computeBoundingSphere();
    }
    // Move the arm joints in with the narrower shoulders, the hip joints out with wider hips.
    shiftBone(bones.leftArm, female ? -armX * (1 - shoulderNarrow) : 0);
    shiftBone(bones.rightArm, female ? -armX * (1 - shoulderNarrow) : 0);
    shiftBone(bones.leftUpLeg, female ? 0.01 : 0);
    shiftBone(bones.rightUpLeg, female ? 0.01 : 0);
    root.scale.setScalar(female ? 0.95 : 1);
  }

  // Pose: straight stance with the arms lowered to the sides.
  model.updateMatrixWorld(true);
  const rotateBone = (bone: THREE.Object3D | undefined, zAngle: number, xAngle: number) => {
    if (!bone || !bone.parent) return;
    const parentQ = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentQ);
    const worldRot = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), zAngle)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), xAngle));
    // local' = parent^-1 * worldRot * parent * local
    bone.quaternion.premultiply(parentQ.clone().invert().multiply(worldRot).multiply(parentQ));
    model.updateMatrixWorld(true);
  };
  rotateBone(bones.leftArm, -1.25, 0.05);
  rotateBone(bones.rightArm, 1.25, 0.05);
  rotateBone(findBone('LeftForeArm'), -0.1, 0.12);
  rotateBone(findBone('RightForeArm'), 0.1, 0.12);

  const clothes = new THREE.Group();
  clothes.name = 'garments';
  meshes[0].parent!.add(clothes);

  function fabric(
    item: GarmentItem,
    roughness: number,
    maxAnisotropy: number,
    extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}
  ) {
    const color = new THREE.Color(item.colorHex);
    // Fine weave as bump only; colour comes straight from the garment.
    const weave = getFabricTexture(item.fabric, item.colorHex, maxAnisotropy).clone();
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
    weave.repeat.set(6, 6);
    weave.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0,
      bumpMap: weave,
      bumpScale: 0.5,
      sheen: 0.45,
      sheenRoughness: 0.65,
      sheenColor: color.clone().lerp(new THREE.Color(1, 1, 1), 0.25),
      side: THREE.DoubleSide, // open hems and cuffs show the inside
      ...extra,
    });
  }

  function addGarment(
    select: (s: Source, i: number) => boolean,
    offset: (s: Source, i: number) => number,
    mat: THREE.Material,
    smoothIterations = 8
  ) {
    for (const src of sources) {
      const geo = garmentGeometry(src, (i) => select(src, i), (i) => offset(src, i), smoothIterations);
      if (!geo) continue;
      const mesh = new THREE.SkinnedMesh(geo, mat);
      mesh.position.copy(src.mesh.position);
      mesh.quaternion.copy(src.mesh.quaternion);
      mesh.scale.copy(src.mesh.scale);
      mesh.bind(src.mesh.skeleton, src.mesh.bindMatrix);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      clothes.add(mesh);
    }
  }

  function clearClothes() {
    const mats = new Set<THREE.Material>();
    clothes.children.slice().forEach((o) => {
      const m = o as THREE.Mesh;
      m.geometry.dispose();
      mats.add(m.material as THREE.Material);
      clothes.remove(o);
    });
    mats.forEach((mat) => {
      (mat as THREE.MeshPhysicalMaterial).bumpMap?.dispose();
      mat.dispose();
    });
  }

  const Y = (s: Source, i: number) => s.pos.getY(i);
  const isArm = (p: Part) => p === 'shoulder' || p === 'upperArm';
  const isTorso = (s: Source, i: number) =>
    s.parts[i] === 'torso' || (s.parts[i] === 'hips' && Y(s, i) >= waistY - 0.07);
  const isPants = (s: Source, i: number) =>
    s.parts[i] === 'legs' || (s.parts[i] === 'hips' && Y(s, i) < waistY + 0.02);
  // Extra room where the body narrows (waist, below the chest): clothes hang straight there.
  const waistEase = (y: number) => 0.022 * gauss(y, 0.6 * H, 0.06 * H);

  const root = new THREE.Group();
  root.add(model);

  let bodyType: BodyType = initialBody;
  let lastOutfit: Outfit | null = null;
  let lastAniso = 4;
  applyBody(bodyType);

  /** Gather current (body-shaped) bind-pose points matching a predicate, with their skinning. */
  function gather(select: (s: Source, i: number) => boolean): BodyPoints {
    const pts = emptyPoints();
    for (const s of sources) {
      for (let i = 0; i < s.pos.count; i++) {
        if (!select(s, i)) continue;
        pts.xyz.push(s.pos.getX(i), s.pos.getY(i), s.pos.getZ(i));
        for (let k = 0; k < 4; k++) {
          pts.skinIndex.push(s.skinIndex.getComponent(i, k));
          pts.skinWeight.push(s.skinWeight.getComponent(i, k));
        }
      }
    }
    return pts;
  }

  function addWrapped(geo: THREE.BufferGeometry | null, mat: THREE.Material) {
    if (!geo) return;
    const src = sources[0];
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.position.copy(src.mesh.position);
    mesh.quaternion.copy(src.mesh.quaternion);
    mesh.scale.copy(src.mesh.scale);
    mesh.bind(src.mesh.skeleton, src.mesh.bindMatrix);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    clothes.add(mesh);
  }

  function buildOutfit({ jacket, top, bottom, shoes }: Outfit, maxAnisotropy: number) {
    clearClothes();

    // Body landmarks in the current (possibly reshaped) bind pose.
    let shoulderTop = 0, crotchY = Infinity, wristX = 0;
    for (const s of sources) {
      for (let i = 0; i < s.pos.count; i++) {
        const p = s.parts[i], y = s.pos.getY(i);
        if (p === 'torso' || p === 'shoulder') shoulderTop = Math.max(shoulderTop, y);
        if (p === 'hips') crotchY = Math.min(crotchY, y);
        if (p === 'forearm') wristX = Math.max(wristX, Math.abs(s.pos.getX(i)));
      }
    }
    const neckY = shoulderTop + 0.03;
    const armStart = Math.max(0.05, armMin - 0.05);

    // Points for each body region (T-pose).
    const torsoPts = gather((s, i) => {
      const p = s.parts[i];
      if (p === 'torso' || p === 'hips') return true;
      if (p === 'legs') return s.pos.getY(i) > crotchY - 0.03; // thigh tops reach up the hip sides
      if (p === 'shoulder') return Math.abs(s.pos.getX(i)) < armMin + 0.02;
      return p === 'head' && s.pos.getY(i) < neckY;
    });
    const armPts = (side: 1 | -1) =>
      gather((s, i) => {
        const p = s.parts[i];
        if (Math.sign(s.pos.getX(i)) !== side) return false;
        if (p === 'shoulder') return Math.abs(s.pos.getX(i)) > armMin - 0.03;
        return p === 'upperArm' || p === 'forearm';
      });
    const legPts = (side: 1 | -1) =>
      gather((s, i) => (s.parts[i] === 'legs' || s.parts[i] === 'hips') && Math.sign(s.pos.getX(i)) === side);
    const allPts = gather(() => true);

    // ---- Trousers: waist band + two straight-falling legs ----
    const legEase = bottom.fabric === 'cargo' ? 0.03 : 0.018;
    const pantsTubes = [
      {
        pts: torsoPts,
        opts: { axis: 'y' as const, from: crotchY - 0.04, to: waistY, slices: 10, ease: () => 0.004 },
      },
      ...([1, -1] as const).map((side) => ({
        pts: legPts(side),
        opts: {
          axis: 'y' as const,
          from: 0.085,
          to: crotchY + 0.02,
          slices: 44,
          ease: (t: number) => legEase - 0.006 * t,
          hang: 0.986,
        },
      })),
    ];
    addWrapped(wrapGarment(allPts, pantsTubes), fabric(bottom, bottom.fabric === 'denim' ? 0.8 : 0.88, maxAnisotropy));

    // ---- Top: hangs straight from the chest; sleeves loose ----
    const longTop = LONG_SLEEVE_TOPS.has(top.id);
    const hoodie = top.id === 'black-hoodie';
    const topEase = hoodie ? 0.03 : 0.018;
    const hemY = waistY - (hoodie ? 0.1 : 0.08);
    const sleeveEnd = longTop ? wristX - 0.01 : shortSleeveX;
    const topTubes = [
      {
        pts: torsoPts,
        opts: { axis: 'y' as const, from: hemY, to: neckY, slices: 40, ease: (t: number) => topEase * (0.5 + 0.5 * Math.min(1, (1 - t) * 3)), hang: 0.985 },
      },
      // Under a jacket the shirt's sleeves are hidden; leaving them out avoids poke-through.
      ...(jacket ? [] : ([1, -1] as const)).map((side) => ({
        pts: armPts(side),
        opts: {
          axis: 'x' as const,
          side,
          from: armStart - 0.02,
          to: sleeveEnd,
          slices: longTop ? 34 : 14,
          ease: (t: number) => topEase + (longTop ? 0.004 : 0.01 * t),
          hang: longTop ? 0.975 : 0.99,
          hangFrom: 'from' as const,
        },
      })),
    ];
    addWrapped(wrapGarment(allPts, topTubes), fabric(top, 0.86, maxAnisotropy));

    // ---- Jacket: boxy outer layer ----
    if (jacket) {
      const shell = jacket.fabric === 'ripstop';
      const jEase = shell ? 0.05 : 0.042;
      const jacketTubes = [
        {
          pts: torsoPts,
          opts: { axis: 'y' as const, from: waistY - 0.16, to: neckY + 0.02, slices: 42, ease: () => jEase, hang: 0.995 },
        },
        ...([1, -1] as const).map((side) => ({
          pts: armPts(side),
          opts: {
            axis: 'x' as const,
            side,
            from: armStart,
            to: wristX - 0.02,
            slices: 36,
            ease: () => jEase,
            hang: 0.975,
            hangFrom: 'from' as const,
          },
        })),
      ];
      addWrapped(
        wrapGarment(allPts, jacketTubes),
        fabric(jacket, shell ? 0.5 : 0.84, maxAnisotropy, { sheen: shell ? 0.2 : 0.55 })
      );
    }

    // Shoes: the feet, plus a sole band underneath.
    const boot = shoes.id === 'chelsea-boots';
    addGarment(
      (s, i) => s.parts[i] === 'feet' || (boot && s.parts[i] === 'legs' && Y(s, i) < 0.16),
      () => 0.014,
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(shoes.colorHex),
        roughness: boot ? 0.38 : 0.5,
        clearcoat: boot ? 0.7 : 0.35,
        clearcoatRoughness: 0.3,
      }),
      4
    );
    addGarment(
      (s, i) => s.parts[i] === 'feet' && Y(s, i) < 0.035,
      () => 0.018,
      new THREE.MeshStandardMaterial({ color: boot ? 0x121316 : 0xe9e4d8, roughness: 0.75 }),
      2
    );
  }

  return {
    root,
    setOutfit(outfit, maxAnisotropy) {
      lastOutfit = outfit;
      lastAniso = maxAnisotropy;
      buildOutfit(outfit, maxAnisotropy);
    },
    setBodyType(type) {
      if (type === bodyType) return;
      bodyType = type;
      applyBody(type);
      if (lastOutfit) buildOutfit(lastOutfit, lastAniso);
    },
    dispose() {
      clearClothes();
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      bodyMat.dispose();
    },
  };
}
