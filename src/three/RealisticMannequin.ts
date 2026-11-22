import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GarmentItem } from '../types/wardrobe';
import { getFabricTexture } from '../utils/proceduralTextures';

/**
 * Realistic store-style mannequin.
 *
 * Loads a smooth, rigged human figure (public/models/mannequin.glb — the Mixamo
 * "X Bot" shipped with the three.js examples), stands it straight with arms
 * lowered, gives it a glossy fibreglass finish, and builds clothes from the
 * figure's own surface: each garment is the matching body region (torso, arms,
 * legs, feet) pushed outwards along its normals and skinned to the same
 * skeleton, so clothes follow the body's real curves.
 */

const MODEL_URL = import.meta.env.BASE_URL + 'models/mannequin.glb';

type Part = 'head' | 'torso' | 'hips' | 'upperArm' | 'forearm' | 'hand' | 'legs' | 'feet';

export interface Outfit {
  jacket: GarmentItem | null;
  top: GarmentItem;
  bottom: GarmentItem;
  shoes: GarmentItem;
}

export interface RealisticMannequin {
  root: THREE.Group;
  setOutfit(outfit: Outfit, maxAnisotropy: number): void;
  dispose(): void;
}

const LONG_SLEEVE_TOPS = new Set(['black-hoodie', 'sky-oxford']);

function partForBone(name: string): Part {
  if (/Foot|Toe/.test(name)) return 'feet';
  if (/UpLeg|Leg/.test(name)) return 'legs';
  if (/Hand/.test(name)) return 'hand';
  if (/ForeArm/.test(name)) return 'forearm';
  if (/Shoulder|Arm/.test(name)) return 'upperArm';
  if (/Spine/.test(name)) return 'torso';
  if (/Hips/.test(name)) return 'hips';
  return 'head';
}

/** Per-mesh vertex data, classified once in the bind (T) pose. */
interface Source {
  mesh: THREE.SkinnedMesh;
  pos: THREE.BufferAttribute;
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
    nor: g.attributes.normal as THREE.BufferAttribute,
    skinIndex,
    skinWeight,
    index: g.index,
    parts,
  };
}

/** Copy the selected triangles of a source, pushed out along normals by `offset`. */
function garmentGeometry(
  src: Source,
  select: (i: number) => boolean,
  offset: (i: number) => number
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

  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let v = 0; v < count; v++) {
    const m = map[v];
    if (m < 0) continue;
    const d = offset(v);
    for (let k = 0; k < 3; k++) {
      const nv = nor.getComponent(v, k);
      P[m * 3 + k] = pos.getComponent(v, k) + nv * d;
      N[m * 3 + k] = nv;
    }
    for (let k = 0; k < 4; k++) {
      SI[m * 4 + k] = skinIndex.getComponent(v, k);
      SW[m * 4 + k] = skinWeight.getComponent(v, k);
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

export async function loadRealisticMannequin(): Promise<RealisticMannequin> {
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

  // Classify vertices in the bind (T) pose, before posing the arms.
  const sources = meshes.map(prepare);

  // Pose: straight stance with the arms lowered to the sides.
  model.updateMatrixWorld(true);
  // Match bones by suffix: loaders may rename "mixamorig:LeftArm" to "mixamorigLeftArm".
  const findBone = (suffix: string) => {
    let found: THREE.Object3D | undefined;
    model.traverse((o) => {
      if (!found && (o as THREE.Bone).isBone && o.name.endsWith(suffix)) found = o;
    });
    return found;
  };
  const rotateBone = (boneName: string, zAngle: number, xAngle: number) => {
    const bone = findBone(boneName);
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
  rotateBone('LeftArm', -1.25, 0.05);
  rotateBone('RightArm', 1.25, 0.05);
  rotateBone('LeftForeArm', -0.1, 0.12);
  rotateBone('RightForeArm', 0.1, 0.12);

  // Reference heights/widths measured on the plates mesh.
  const ref = sources.find((s) => s.mesh.name === 'Beta_Surface') || sources[0];
  let hipSum = 0, hipN = 0, armMin = Infinity, elbowX = 0;
  for (let i = 0; i < ref.pos.count; i++) {
    if (ref.parts[i] === 'hips') {
      hipSum += ref.pos.getY(i);
      hipN++;
    }
    if (ref.parts[i] === 'upperArm') {
      const ax = Math.abs(ref.pos.getX(i));
      armMin = Math.min(armMin, ax);
      elbowX = Math.max(elbowX, ax);
    }
  }
  const waistY = hipN ? hipSum / hipN + 0.03 : 1.0;
  const shortSleeveX = armMin + (elbowX - armMin) * 0.55;

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
      ...extra,
    });
  }

  function addGarment(
    select: (s: Source, i: number) => boolean,
    offset: (s: Source, i: number) => number,
    mat: THREE.Material
  ) {
    for (const src of sources) {
      const geo = garmentGeometry(src, (i) => select(src, i), (i) => offset(src, i));
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

  const isTorso = (s: Source, i: number) =>
    s.parts[i] === 'torso' || (s.parts[i] === 'hips' && s.pos.getY(i) >= waistY - 0.07);
  const isPants = (s: Source, i: number) =>
    s.parts[i] === 'legs' || (s.parts[i] === 'hips' && s.pos.getY(i) < waistY + 0.02);

  const root = new THREE.Group();
  root.add(model);

  return {
    root,
    setOutfit({ jacket, top, bottom, shoes }, maxAnisotropy) {
      clearClothes();

      // Trousers: hips + legs, ending just above the shoes.
      addGarment(
        (s, i) => isPants(s, i) && s.pos.getY(i) > 0.09,
        () => 0.005,
        fabric(bottom, bottom.fabric === 'denim' ? 0.8 : 0.88, maxAnisotropy)
      );

      // Top: torso plus short or long sleeves.
      const longTop = LONG_SLEEVE_TOPS.has(top.id);
      const thick = top.id === 'black-hoodie' ? 0.014 : 0.009;
      addGarment(
        (s, i) =>
          isTorso(s, i) ||
          (s.parts[i] === 'upperArm' && (longTop || Math.abs(s.pos.getX(i)) < shortSleeveX)) ||
          (longTop && s.parts[i] === 'forearm'),
        () => thick,
        fabric(top, 0.86, maxAnisotropy)
      );

      // Jacket: a looser layer over torso, hips and full arms.
      if (jacket) {
        addGarment(
          (s, i) =>
            isTorso(s, i) ||
            (s.parts[i] === 'hips' && s.pos.getY(i) > waistY - 0.13) ||
            s.parts[i] === 'upperArm' ||
            s.parts[i] === 'forearm',
          (s, i) => (s.parts[i] === 'forearm' ? 0.02 : 0.03),
          fabric(jacket, jacket.fabric === 'ripstop' ? 0.5 : 0.84, maxAnisotropy, {
            sheen: jacket.fabric === 'ripstop' ? 0.2 : 0.55,
          })
        );
      }

      // Shoes: the feet, plus a sole band underneath.
      const boot = shoes.id === 'chelsea-boots';
      addGarment(
        (s, i) => s.parts[i] === 'feet' || (boot && s.parts[i] === 'legs' && s.pos.getY(i) < 0.16),
        () => 0.012,
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(shoes.colorHex),
          roughness: boot ? 0.38 : 0.5,
          clearcoat: boot ? 0.7 : 0.35,
          clearcoatRoughness: 0.3,
        })
      );
      addGarment(
        (s, i) => s.parts[i] === 'feet' && s.pos.getY(i) < 0.035,
        () => 0.016,
        new THREE.MeshStandardMaterial({ color: boot ? 0x121316 : 0xe9e4d8, roughness: 0.75 })
      );
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
