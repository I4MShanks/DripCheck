import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Eye, EyeOff, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { GarmentItem, GarmentCategory } from '../types/wardrobe';
import {
  getContactShadowTexture,
  getFabricTexture,
  getTurntablePlinthTexture,
} from '../utils/proceduralTextures';

interface MannequinViewport3DProps {
  jacket: GarmentItem | null;
  top: GarmentItem;
  bottom: GarmentItem;
  shoes: GarmentItem;
  canvasId: string;
  silhouetteLabel: string;
  fitBalance: number;
  shufflePulse: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSelectSlotCategory?: (category: GarmentCategory) => void;
}

interface ProjectedTag {
  id: 'jacket' | 'top' | 'bottom' | 'shoes';
  badge: string;
  label: string;
  price: number;
  dotColor: string;
  badgeColor: string;
  x: number;
  y: number;
  visible: boolean;
  alignRight?: boolean;
}

const _projVec = new THREE.Vector3();
const _worldAnchor = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/* ---------- Smooth geometry + fabric helpers ---------- */

// Box with softly rounded edges (radius is clamped to fit the box).
function rbox(w: number, h: number, d: number, r = 0.008) {
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
  return new RoundedBoxGeometry(w, h, d, 4, rr);
}

// Tapered capsule centred on the origin along Y (drop-in for CylinderGeometry):
// round ends hide the joints between limb segments.
function limb(rTop: number, rBottom: number, length: number, radial = 48) {
  const pts: THREE.Vector2[] = [];
  const half = length / 2;
  const capSteps = 10;
  const capH = 0.6;
  for (let i = 0; i <= capSteps; i++) {
    const a = -Math.PI / 2 + (i / capSteps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * rBottom + 1e-5, -half + Math.sin(a) * rBottom * capH));
  }
  for (let i = 1; i < 16; i++) {
    const t = i / 16;
    pts.push(new THREE.Vector2(rBottom + (rTop - rBottom) * t, -half + length * t));
  }
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop + 1e-5, half + Math.sin(a) * rTop * capH));
  }
  return new THREE.LatheGeometry(pts, radial);
}

// Turns a coarse lathe profile into a smooth curve.
function smooth(points: THREE.Vector2[], samples = 64) {
  return new THREE.SplineCurve(points).getPoints(samples);
}

// Cloth-like material: woven bump from the fabric texture plus soft sheen at grazing angles.
function fabricMaterial(tex: THREE.Texture, roughness: number, metalness = 0.02, sheen = 0.7) {
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    bumpMap: tex,
    bumpScale: 1.4,
    roughness,
    metalness,
    sheen,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0.32, 0.32, 0.32),
  });
}

function disposeGroupContents(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => materials.add(m));
      } else if (mesh.material) {
        materials.add(mesh.material);
      }
    }
  });

  group.clear();
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}

function buildMannequinBody(mannequinGroup: THREE.Group) {
  // Satin-lacquered display mannequin finish
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2c33,
    roughness: 0.42,
    metalness: 0.06,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
  });

  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x17181c,
    roughness: 0.48,
    metalness: 0.35,
  });

  // Sculpted featureless head
  const headGeo = new THREE.SphereGeometry(0.105, 64, 48);
  headGeo.scale(0.86, 1.18, 0.96);
  const head = new THREE.Mesh(headGeo, bodyMat);
  head.position.set(0, 1.69, 0.01);
  head.castShadow = true;
  mannequinGroup.add(head);

  // Neck column + collar seam ring
  const neck = new THREE.Mesh(limb(0.052, 0.06, 0.14), bodyMat);
  neck.position.set(0, 1.52, 0);
  neck.castShadow = true;
  mannequinGroup.add(neck);

  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.007, 16, 64), jointMat);
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, 1.465, 0);
  mannequinGroup.add(neckRing);

  // Sculpted Lathe Torso core (pelvis to collar)
  const torsoProfile = [
    new THREE.Vector2(0.135, 0.86),
    new THREE.Vector2(0.148, 0.95),
    new THREE.Vector2(0.138, 1.08),
    new THREE.Vector2(0.168, 1.24),
    new THREE.Vector2(0.185, 1.37),
    new THREE.Vector2(0.135, 1.44),
    new THREE.Vector2(0.062, 1.47),
  ];
  const torsoGeo = new THREE.LatheGeometry(smooth(torsoProfile), 64);
  torsoGeo.scale(1.12, 1, 0.72);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.castShadow = true;
  torso.receiveShadow = true;
  mannequinGroup.add(torso);

  // Pelvis base block
  const pelvisGeo = new THREE.SphereGeometry(0.142, 48, 32);
  pelvisGeo.scale(1.12, 0.72, 0.74);
  const pelvis = new THREE.Mesh(pelvisGeo, bodyMat);
  pelvis.position.set(0, 0.87, 0);
  mannequinGroup.add(pelvis);

  // Left & Right Arms (Upper arm, Elbow joint, Forearm, Wrist ring, Hand)
  [-1, 1].forEach((side) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.225, 1.38, 0);
    armPivot.rotation.z = side * 0.13;
    armPivot.rotation.x = 0.05;

    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.056, 40, 28), bodyMat);
    armPivot.add(shoulderBall);

    const upperArm = new THREE.Mesh(limb(0.05, 0.043, 0.28), bodyMat);
    upperArm.position.set(0, -0.14, 0);
    upperArm.castShadow = true;
    armPivot.add(upperArm);

    const forearmPivot = new THREE.Group();
    forearmPivot.position.set(0, -0.28, 0);
    forearmPivot.rotation.x = -0.14;
    forearmPivot.rotation.z = -side * 0.04;

    const forearm = new THREE.Mesh(limb(0.041, 0.031, 0.25), bodyMat);
    forearm.position.set(0, -0.125, 0);
    forearm.castShadow = true;
    forearmPivot.add(forearm);

    const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0045, 12, 48), jointMat);
    wristRing.rotation.x = Math.PI / 2;
    wristRing.position.set(0, -0.245, 0);
    forearmPivot.add(wristRing);

    const handGeo = new THREE.SphereGeometry(0.05, 32, 24);
    handGeo.scale(0.4, 1.08, 0.62);
    const hand = new THREE.Mesh(handGeo, bodyMat);
    hand.position.set(0, -0.305, 0.01);
    hand.castShadow = true;
    forearmPivot.add(hand);

    armPivot.add(forearmPivot);
    mannequinGroup.add(armPivot);
  });

  // Left & Right Legs (underneath trousers)
  [-1, 1].forEach((side) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.095, 0.84, 0);
    legGroup.rotation.z = side * 0.018;

    const thigh = new THREE.Mesh(limb(0.072, 0.056, 0.42), bodyMat);
    thigh.position.set(0, -0.21, 0);
    legGroup.add(thigh);

    const calf = new THREE.Mesh(limb(0.054, 0.038, 0.36), bodyMat);
    calf.position.set(0, -0.59, 0);
    legGroup.add(calf);

    mannequinGroup.add(legGroup);
  });
}

function buildGarmentLayers(
  garmentGroup: THREE.Group,
  jacket: GarmentItem | null,
  top: GarmentItem,
  bottom: GarmentItem,
  shoes: GarmentItem,
  maxAnisotropy: number
) {
  disposeGroupContents(garmentGroup);

  // 1. BASE LAYER (TOP)
  const topTex = getFabricTexture(top.fabric, top.colorHex, maxAnisotropy);
  const topMat = fabricMaterial(topTex, top.fabric === 'cotton' ? 0.88 : 0.78);

  const teeProfile = [
    new THREE.Vector2(0.146, 0.87),
    new THREE.Vector2(0.156, 0.96),
    new THREE.Vector2(0.148, 1.08),
    new THREE.Vector2(0.178, 1.24),
    new THREE.Vector2(0.194, 1.37),
    new THREE.Vector2(0.148, 1.445),
    new THREE.Vector2(0.078, 1.468),
  ];
  const teeGeo = new THREE.LatheGeometry(smooth(teeProfile), 64);
  teeGeo.scale(1.13, 1, 0.74);
  const teeBody = new THREE.Mesh(teeGeo, topMat);
  teeBody.castShadow = true;
  teeBody.receiveShadow = true;
  garmentGroup.add(teeBody);

  // Ribbed crew collar
  const collarMat = topMat.clone();
  collarMat.roughness = 0.92;
  const crewCollar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 20, 64), collarMat);
  crewCollar.rotation.x = Math.PI / 2 + 0.08;
  crewCollar.position.set(0, 1.462, 0.01);
  garmentGroup.add(crewCollar);

  // Oxford shirt details if sky-oxford
  if (top.id === 'sky-oxford') {
    const placket = new THREE.Mesh(rbox(0.032, 0.45, 0.02), collarMat);
    placket.position.set(0, 1.19, 0.136);
    garmentGroup.add(placket);

    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xeae6df, roughness: 0.35, metalness: 0.1 });
    for (let i = 0; i < 5; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 12), buttonMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 1.38 - i * 0.085, 0.148 - i * 0.003);
      garmentGroup.add(btn);
    }

    [-1, 1].forEach((side) => {
      const collarLeaf = new THREE.Mesh(rbox(0.065, 0.048, 0.014), collarMat);
      collarLeaf.position.set(side * 0.056, 1.448, 0.072);
      collarLeaf.rotation.y = side * -0.45;
      collarLeaf.rotation.z = side * -0.25;
      garmentGroup.add(collarLeaf);
    });
  }

  // Hoodie structure if black-hoodie
  if (top.id === 'black-hoodie') {
    const hoodGeo = new THREE.TorusGeometry(0.115, 0.045, 28, 64, Math.PI * 1.35);
    const hood = new THREE.Mesh(hoodGeo, topMat);
    hood.position.set(0, 1.45, -0.045);
    hood.rotation.x = 0.55;
    hood.rotation.z = -0.5;
    hood.castShadow = true;
    garmentGroup.add(hood);

    const pocket = new THREE.Mesh(rbox(0.22, 0.14, 0.03), topMat);
    pocket.position.set(0, 0.99, 0.115);
    garmentGroup.add(pocket);
  }

  // Short sleeves if no outer jacket (or long sleeves for hoodie/oxford)
  if (!jacket) {
    const isLong = top.id === 'black-hoodie' || top.id === 'sky-oxford';
    [-1, 1].forEach((side) => {
      const sleevePivot = new THREE.Group();
      sleevePivot.position.set(side * 0.225, 1.38, 0);
      sleevePivot.rotation.z = side * 0.13;
      sleevePivot.rotation.x = 0.05;

      const upperSleeve = new THREE.Mesh(
        limb(0.068, isLong ? 0.058 : 0.064, isLong ? 0.29 : 0.21),
        topMat
      );
      upperSleeve.position.set(0, isLong ? -0.14 : -0.1, 0);
      upperSleeve.castShadow = true;
      sleevePivot.add(upperSleeve);

      if (isLong) {
        const lowerPivot = new THREE.Group();
        lowerPivot.position.set(0, -0.28, 0);
        lowerPivot.rotation.x = -0.14;
        lowerPivot.rotation.z = -side * 0.04;
        const lowerSleeve = new THREE.Mesh(limb(0.056, 0.044, 0.23), topMat);
        lowerSleeve.position.set(0, -0.115, 0);
        lowerSleeve.castShadow = true;
        lowerPivot.add(lowerSleeve);
        sleevePivot.add(lowerPivot);
      }
      garmentGroup.add(sleevePivot);
    });
  }

  // 2. OUTERWEAR / JACKET LAYER
  if (jacket) {
    const jTex = getFabricTexture(jacket.fabric, jacket.colorHex, maxAnisotropy);
    const jRoughness =
      jacket.fabric === 'ripstop'
        ? 0.56
        : jacket.fabric === 'corduroy'
        ? 0.86
        : jacket.fabric === 'knit'
        ? 0.92
        : 0.82;
    const jMat = fabricMaterial(
      jTex,
      jRoughness,
      jacket.fabric === 'ripstop' ? 0.08 : 0.02,
      jacket.fabric === 'ripstop' ? 0.3 : jacket.fabric === 'corduroy' ? 0.95 : 0.7
    );

    const isOpenFront = jacket.fabric === 'corduroy';

    if (isOpenFront) {
      // Back + sides wrap (270 degrees around back, leaving front center chest open to reveal Base Tee!)
      const jacketBackProfile = [
        new THREE.Vector2(0.168, 0.83),
        new THREE.Vector2(0.175, 0.96),
        new THREE.Vector2(0.172, 1.12),
        new THREE.Vector2(0.198, 1.27),
        new THREE.Vector2(0.214, 1.38),
        new THREE.Vector2(0.162, 1.45),
        new THREE.Vector2(0.088, 1.472),
      ];
      // Lathe covering -25 deg to +205 deg (around back and sides)
      const backWrapGeo = new THREE.LatheGeometry(
        smooth(jacketBackProfile),
        64,
        Math.PI * 0.14,
        Math.PI * 1.72
      );
      backWrapGeo.scale(1.15, 1, 0.78);
      const backWrap = new THREE.Mesh(backWrapGeo, jMat);
      backWrap.rotation.y = Math.PI / 2;
      backWrap.castShadow = true;
      backWrap.receiveShadow = true;
      garmentGroup.add(backWrap);

      // Left & Right front panels with horn buttons & utility chest flap pockets
      const accentHardwareMat = new THREE.MeshStandardMaterial({
        color: 0x1b1a18,
        roughness: 0.42,
        metalness: 0.25,
      });

      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(rbox(0.135, 0.57, 0.036), jMat);
        panel.position.set(side * 0.105, 1.125, 0.13);
        panel.rotation.y = side * 0.22;
        panel.rotation.x = -0.03;
        panel.castShadow = true;
        garmentGroup.add(panel);

        // Chest utility pocket + flap + button
        const pocket = new THREE.Mesh(rbox(0.088, 0.105, 0.022), jMat);
        pocket.position.set(side * 0.112, 1.22, 0.146);
        pocket.rotation.y = side * 0.24;
        garmentGroup.add(pocket);

        const flap = new THREE.Mesh(rbox(0.092, 0.032, 0.026), jMat);
        flap.position.set(side * 0.112, 1.262, 0.149);
        flap.rotation.y = side * 0.24;
        garmentGroup.add(flap);

        const pocketBtn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.008, 12),
          accentHardwareMat
        );
        pocketBtn.rotation.x = Math.PI / 2;
        pocketBtn.position.set(side * 0.114, 1.258, 0.163);
        garmentGroup.add(pocketBtn);

        // Spread shirt collar
        const collar = new THREE.Mesh(rbox(0.085, 0.056, 0.022), jMat);
        collar.position.set(side * 0.072, 1.456, 0.072);
        collar.rotation.y = side * -0.42;
        collar.rotation.z = side * -0.28;
        garmentGroup.add(collar);
      });

      // Placket front buttons down right edge
      for (let i = 0; i < 5; i++) {
        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 12),
          accentHardwareMat
        );
        btn.rotation.x = Math.PI / 2;
        btn.position.set(0.044, 1.35 - i * 0.105, 0.152 - i * 0.003);
        garmentGroup.add(btn);
      }
    } else {
      // Closed Zipped Technical Shell or Rib Knit Zip Cardigan
      const shellProfile = [
        new THREE.Vector2(0.166, jacket.fabric === 'ripstop' ? 0.89 : 0.84),
        new THREE.Vector2(0.175, 0.98),
        new THREE.Vector2(0.174, 1.12),
        new THREE.Vector2(0.202, 1.26),
        new THREE.Vector2(0.214, 1.38),
        new THREE.Vector2(0.158, 1.45),
        new THREE.Vector2(0.095, 1.49),
      ];
      const shellGeo = new THREE.LatheGeometry(smooth(shellProfile), 64);
      shellGeo.scale(1.15, 1, 0.78);
      const shellMesh = new THREE.Mesh(shellGeo, jMat);
      shellMesh.castShadow = true;
      shellMesh.receiveShadow = true;
      garmentGroup.add(shellMesh);

      // High storm / stand collar
      const stormCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.096, 0.102, 0.085, 64, 1, true),
        jMat
      );
      stormCollar.position.set(0, 1.49, 0.008);
      garmentGroup.add(stormCollar);

      // Center waterproof matte zipper or metallic knit zipper
      const zipMat = new THREE.MeshStandardMaterial({
        color: jacket.fabric === 'knit' ? 0x9ca3af : 0x111215,
        roughness: jacket.fabric === 'knit' ? 0.25 : 0.4,
        metalness: jacket.fabric === 'knit' ? 0.85 : 0.3,
      });
      const centerZip = new THREE.Mesh(rbox(0.016, 0.62, 0.02), zipMat);
      centerZip.position.set(0, 1.2, 0.151);
      garmentGroup.add(centerZip);

      if (jacket.fabric === 'ripstop') {
        [-1, 1].forEach((side) => {
          const chestZip = new THREE.Mesh(rbox(0.012, 0.16, 0.015), zipMat);
          chestZip.position.set(side * 0.115, 1.23, 0.145);
          chestZip.rotation.z = side * 0.16;
          garmentGroup.add(chestZip);
        });
      }
    }

    // Jacket Long Sleeves + Cuffs
    [-1, 1].forEach((side) => {
      const sleevePivot = new THREE.Group();
      sleevePivot.position.set(side * 0.228, 1.38, 0);
      sleevePivot.rotation.z = side * 0.13;
      sleevePivot.rotation.x = 0.05;

      const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 40, 28), jMat);
      sleevePivot.add(shoulderCap);

      const upperSleeve = new THREE.Mesh(limb(0.072, 0.062, 0.28), jMat);
      upperSleeve.position.set(0, -0.14, 0);
      upperSleeve.castShadow = true;
      sleevePivot.add(upperSleeve);

      const lowerPivot = new THREE.Group();
      lowerPivot.position.set(0, -0.28, 0);
      lowerPivot.rotation.x = -0.14;
      lowerPivot.rotation.z = -side * 0.04;

      const lowerSleeve = new THREE.Mesh(limb(0.061, 0.05, 0.22), jMat);
      lowerSleeve.position.set(0, -0.11, 0);
      lowerSleeve.castShadow = true;
      lowerPivot.add(lowerSleeve);

      const cuff = new THREE.Mesh(limb(0.052, 0.048, 0.045), jMat);
      cuff.position.set(0, -0.225, 0);
      lowerPivot.add(cuff);

      sleevePivot.add(lowerPivot);
      garmentGroup.add(sleevePivot);
    });
  }

  // 3. BOTTOMS / TROUSERS LAYER
  const bTex = getFabricTexture(bottom.fabric, bottom.colorHex, maxAnisotropy);
  const bMat = fabricMaterial(bTex, 0.86, 0.03, 0.5);

  // Waistband + Pelvis drape
  const waistGeo = new THREE.CylinderGeometry(0.158, 0.166, 0.14, 64);
  waistGeo.scale(1.13, 1, 0.76);
  const waist = new THREE.Mesh(waistGeo, bMat);
  waist.position.set(0, 0.85, 0);
  waist.castShadow = true;
  garmentGroup.add(waist);

  // Belt / dark buckle
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.45, metalness: 0.2 });
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.162, 0.034, 64), beltMat);
  belt.scale.set(1.13, 1, 0.76);
  belt.position.set(0, 0.895, 0);
  garmentGroup.add(belt);

  // Relaxed straight-leg trousers (Left & Right)
  [-1, 1].forEach((side) => {
    const pantLegGroup = new THREE.Group();
    pantLegGroup.position.set(side * 0.095, 0.82, 0);
    pantLegGroup.rotation.z = side * 0.018;

    const upperLeg = new THREE.Mesh(limb(0.098, 0.088, 0.38), bMat);
    upperLeg.position.set(0, -0.19, 0);
    upperLeg.castShadow = true;
    upperLeg.receiveShadow = true;
    pantLegGroup.add(upperLeg);

    const lowerLeg = new THREE.Mesh(limb(0.087, 0.078, 0.36), bMat);
    lowerLeg.position.set(0, -0.54, 0);
    lowerLeg.castShadow = true;
    lowerLeg.receiveShadow = true;
    pantLegGroup.add(lowerLeg);

    // Subtle hem cuff
    const hemCuff = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.01, 16, 48), bMat);
    hemCuff.rotation.x = Math.PI / 2;
    hemCuff.position.set(0, -0.715, 0);
    pantLegGroup.add(hemCuff);

    // Utilitarian 3D cargo pockets if cargo pants
    if (bottom.fabric === 'cargo') {
      const cargoPocket = new THREE.Mesh(rbox(0.045, 0.16, 0.115), bMat);
      cargoPocket.position.set(side * 0.088, -0.26, 0.01);
      cargoPocket.castShadow = true;
      pantLegGroup.add(cargoPocket);

      const cargoFlap = new THREE.Mesh(rbox(0.048, 0.036, 0.12), bMat);
      cargoFlap.position.set(side * 0.09, -0.175, 0.01);
      pantLegGroup.add(cargoFlap);
    }

    garmentGroup.add(pantLegGroup);
  });

  // 4. FOOTWEAR / KICKS LAYER (Grounded flush at y = 0)
  const sTex = getFabricTexture('leather', shoes.colorHex, maxAnisotropy);
  const isBoot = shoes.id === 'chelsea-boots';

  // Leather: light clearcoat for a polished sheen
  const upperShoeMat = new THREE.MeshPhysicalMaterial({
    map: sTex,
    bumpMap: sTex,
    bumpScale: 0.6,
    roughness: isBoot ? 0.4 : 0.48,
    metalness: 0.04,
    clearcoat: isBoot ? 0.6 : 0.3,
    clearcoatRoughness: 0.35,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    color: isBoot ? 0x111214 : 0xe4dfd3,
    roughness: 0.72,
    metalness: 0.02,
  });

  const laceMat = new THREE.MeshStandardMaterial({
    color: isBoot ? 0x1e2024 : 0xf4f1ea,
    roughness: 0.85,
  });

  [-1, 1].forEach((side) => {
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(side * 0.108, 0, 0.035);
    shoeGroup.rotation.y = side * -0.07;

    // Vulcanized or lugged sole grounded at y = 0..0.036
    const soleHeight = isBoot ? 0.042 : 0.034;
    const sole = new THREE.Mesh(rbox(0.094, soleHeight, 0.245, 0.012), soleMat);
    sole.position.set(0, soleHeight / 2, 0.01);
    sole.castShadow = true;
    sole.receiveShadow = true;
    shoeGroup.add(sole);

    // Toe cap rounded front
    const toeSole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.047, 0.047, soleHeight, 48),
      soleMat
    );
    toeSole.position.set(0, soleHeight / 2, 0.125);
    shoeGroup.add(toeSole);

    // Main leather vamp/upper
    const upperHeight = isBoot ? 0.11 : 0.068;
    const upper = new THREE.Mesh(rbox(0.088, upperHeight, 0.22, 0.022), upperShoeMat);
    upper.position.set(0, soleHeight + upperHeight / 2 - 0.004, 0.002);
    upper.castShadow = true;
    shoeGroup.add(upper);

    const toeUpper = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 40, 28),
      upperShoeMat
    );
    toeUpper.scale.set(0.98, 0.65, 1.15);
    toeUpper.position.set(0, soleHeight + 0.024, 0.11);
    toeUpper.castShadow = true;
    shoeGroup.add(toeUpper);

    if (isBoot) {
      // Chelsea boot ankle shaft + elastic gore
      const shaft = new THREE.Mesh(limb(0.056, 0.052, 0.13), upperShoeMat);
      shaft.position.set(0, soleHeight + 0.13, -0.045);
      shaft.castShadow = true;
      shoeGroup.add(shaft);

      const gore = new THREE.Mesh(rbox(0.095, 0.085, 0.055), laceMat);
      gore.position.set(0, soleHeight + 0.125, -0.042);
      shoeGroup.add(gore);
    } else {
      // Retro Court laces & tongue
      for (let i = 0; i < 3; i++) {
        const lace = new THREE.Mesh(rbox(0.056, 0.008, 0.012), laceMat);
        lace.position.set(0, soleHeight + 0.062 + i * 0.005, 0.055 - i * 0.024);
        shoeGroup.add(lace);
      }
    }

    garmentGroup.add(shoeGroup);
  });
}

export const MannequinViewport3D: React.FC<MannequinViewport3DProps> = ({
  jacket,
  top,
  bottom,
  shoes,
  canvasId,
  silhouetteLabel,
  fitBalance,
  shufflePulse,
  isFullscreen = false,
  onToggleFullscreen,
  onSelectSlotCategory,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [autoSpin, setAutoSpin] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [azimuthDeg, setAzimuthDeg] = useState(8);
  const [webglFallback, setWebglFallback] = useState(false);
  const [projectedTags, setProjectedTags] = useState<ProjectedTag[]>([]);

  const sceneRefs = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    garmentGroup?: THREE.Group;
    mannequinRoot?: THREE.Group;
    anchors?: {
      jacket: THREE.Object3D;
      top: THREE.Object3D;
      bottom: THREE.Object3D;
      shoes: THREE.Object3D;
    };
    maxAnisotropy: number;
    requestRender: () => void;
    targetAzimuthRad: number | null;
    autoSpinRef: boolean;
  }>({
    maxAnisotropy: 4,
    requestRender: () => {},
    targetAzimuthRad: null,
    autoSpinRef: false,
  });

  const latestPropsRef = useRef({ jacket, top, bottom, shoes, showPins });
  latestPropsRef.current = { jacket, top, bottom, shoes, showPins };

  useEffect(() => {
    sceneRefs.current.autoSpinRef = autoSpin;
    if (autoSpin) {
      sceneRefs.current.targetAzimuthRad = null;
      sceneRefs.current.requestRender();
    }
  }, [autoSpin]);

  // Initialize Three.js Scene once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(mount.clientWidth, 300);
    const initH = Math.max(mount.clientHeight, 360);
    renderer.setSize(initW, initH);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy() || 4, 8);
    sceneRefs.current.maxAnisotropy = maxAnisotropy;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x16171b);
    scene.fog = new THREE.FogExp2(0x16171b, 0.085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, initW / initH, 0.1, 40);
    camera.position.set(0.45, 1.16, 3.25);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.94, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2.35;
    controls.maxDistance = 4.9;
    controls.minPolarAngle = 0.42;
    controls.maxPolarAngle = 1.62;
    controls.rotateSpeed = 0.82;

    // 3-Point Editorial Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xb7c8e1, 0x1a1917, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.15);
    keyLight.position.set(2.4, 3.8, 2.8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -1.6;
    keyLight.shadow.camera.right = 1.6;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa3c2e0, 0.85);
    fillLight.position.set(-2.6, 2.0, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf3f7cc, 1.35);
    rimLight.position.set(-0.6, 2.8, -3.2);
    scene.add(rimLight);

    // Studio Floor & 360 Turntable Plinth
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x141519,
      roughness: 0.92,
      metalness: 0.05,
    });
    const studioFloor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), floorMat);
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.y = -0.042;
    studioFloor.receiveShadow = true;
    scene.add(studioFloor);

    const plinthTopTex = getTurntablePlinthTexture(maxAnisotropy);
    const plinthSideMat = new THREE.MeshStandardMaterial({
      color: 0x1e2026,
      roughness: 0.55,
      metalness: 0.35,
    });
    const plinthTopMat = new THREE.MeshStandardMaterial({
      map: plinthTopTex,
      roughness: 0.62,
      metalness: 0.25,
    });
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.66, 0.04, 48),
      [plinthSideMat, plinthTopMat, plinthSideMat]
    );
    plinth.position.y = -0.02;
    plinth.receiveShadow = true;
    scene.add(plinth);

    // Contact shadow grounding plane
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({
        map: getContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.68,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.002;
    scene.add(contactShadow);

    // Minimalist Background Studio Light Stand Silhouettes (Matching Screenshot Depth)
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x1f2127,
      roughness: 0.6,
      metalness: 0.4,
    });
    [
      [-2.1, -2.3, 0.35],
      [2.15, -2.4, -0.4],
    ].forEach(([sx, sz, rotY]) => {
      const stand = new THREE.Group();
      stand.position.set(sx, -0.04, sz);
      stand.rotation.y = rotY;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 2.5, 10), standMat);
      pole.position.y = 1.25;
      stand.add(pole);
      const softbox = new THREE.Mesh(rbox(0.45, 0.65, 0.14), standMat);
      softbox.position.set(0, 2.15, 0.05);
      softbox.rotation.x = 0.18;
      stand.add(softbox);
      scene.add(stand);
    });

    // Mannequin Root + Body + Swappable Garments
    const mannequinRoot = new THREE.Group();
    scene.add(mannequinRoot);

    const bodyGroup = new THREE.Group();
    buildMannequinBody(bodyGroup);
    mannequinRoot.add(bodyGroup);

    const garmentGroup = new THREE.Group();
    mannequinRoot.add(garmentGroup);

    // 3D Anchor nodes for projected apparel touch targets
    const jacketAnchor = new THREE.Object3D();
    jacketAnchor.position.set(-0.2, 1.26, 0.16);
    mannequinRoot.add(jacketAnchor);

    const topAnchor = new THREE.Object3D();
    topAnchor.position.set(0.14, 1.12, 0.17);
    mannequinRoot.add(topAnchor);

    const bottomAnchor = new THREE.Object3D();
    bottomAnchor.position.set(-0.17, 0.62, 0.12);
    mannequinRoot.add(bottomAnchor);

    const shoesAnchor = new THREE.Object3D();
    shoesAnchor.position.set(0.16, 0.08, 0.14);
    mannequinRoot.add(shoesAnchor);

    // Build initial garments
    const initial = latestPropsRef.current;
    buildGarmentLayers(
      garmentGroup,
      initial.jacket,
      initial.top,
      initial.bottom,
      initial.shoes,
      maxAnisotropy
    );

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Coalesced Render-on-Demand & Software-WebGL Pacer
    let frameId = 0;
    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let lastClockMs = performance.now();

    function updateProjectedOverlays() {
      const w = mount?.clientWidth || initW;
      const h = mount?.clientHeight || initH;
      const { jacket: j, top: t, bottom: b, shoes: s, showPins: pins } = latestPropsRef.current;

      const az = controls.getAzimuthalAngle();
      const deg = ((Math.round((az * 180) / Math.PI) % 360) + 360) % 360;
      setAzimuthDeg(deg);

      if (!pins) {
        setProjectedTags([]);
        return;
      }

      const items: Array<{
        id: ProjectedTag['id'];
        obj: THREE.Object3D;
        badge: string;
        label: string;
        price: number;
        dotColor: string;
        badgeColor: string;
        alignRight?: boolean;
      }> = [
        ...(j
          ? [
              {
                id: 'jacket' as const,
                obj: jacketAnchor,
                badge: 'JACKET',
                label: j.shortLabel,
                price: j.price,
                dotColor: '#caf300',
                badgeColor: '#caf300',
                alignRight: false,
              },
            ]
          : []),
        {
          id: 'top',
          obj: topAnchor,
          badge: 'BASE',
          label: t.shortLabel,
          price: t.price,
          dotColor: '#e3e2e6',
          badgeColor: '#b7c8e1',
          alignRight: true,
        },
        {
          id: 'bottom',
          obj: bottomAnchor,
          badge: 'BOTTOM',
          label: b.shortLabel,
          price: b.price,
          dotColor: '#c5c9ac',
          badgeColor: '#c5c9ac',
          alignRight: false,
        },
        {
          id: 'shoes',
          obj: shoesAnchor,
          badge: 'KICKS',
          label: s.shortLabel,
          price: s.price,
          dotColor: '#caf300',
          badgeColor: '#caf300',
          alignRight: true,
        },
      ];

      const nextTags: ProjectedTag[] = items.map((item) => {
        item.obj.getWorldPosition(_worldAnchor);
        _projVec.copy(_worldAnchor).project(camera);
        const sx = ((_projVec.x + 1) / 2) * w;
        const sy = ((-_projVec.y + 1) / 2) * h;
        return {
          id: item.id,
          badge: item.badge,
          label: item.label,
          price: item.price,
          dotColor: item.dotColor,
          badgeColor: item.badgeColor,
          x: THREE.MathUtils.clamp(sx, 28, w - 28),
          y: THREE.MathUtils.clamp(sy, 54, h - 54),
          visible: _projVec.z < 1,
          alignRight: item.alignRight,
        };
      });

      setProjectedTags(nextTags);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        const delta = Math.min((now - lastClockMs) / 1000, 0.1);
        lastClockMs = now;
        renderDirty = false;

        let needsFollowUp = false;

        // Smooth auto-spin 360 mode
        if (sceneRefs.current.autoSpinRef) {
          const offset = camera.position.clone().sub(controls.target);
          offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, delta * 0.9);
          camera.position.copy(controls.target).add(offset);
          needsFollowUp = true;
        }

        // Smooth exponential damping to target preset azimuth angle
        if (sceneRefs.current.targetAzimuthRad !== null) {
          const currentAz = controls.getAzimuthalAngle();
          let diff = sceneRefs.current.targetAzimuthRad - currentAz;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          if (Math.abs(diff) < 0.01) {
            sceneRefs.current.targetAzimuthRad = null;
          } else {
            const step = THREE.MathUtils.damp(0, diff, 8, delta);
            const offset = camera.position.clone().sub(controls.target);
            offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, step);
            camera.position.copy(controls.target).add(offset);
            needsFollowUp = true;
          }
        }

        const didDamp = controls.update();
        if (didDamp && !isSoftwareGl) {
          needsFollowUp = true;
        }

        renderer.render(scene, camera);
        updateProjectedOverlays();

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsFollowUp) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    const onControlStart = () => {
      sceneRefs.current.targetAzimuthRad = null;
      if (sceneRefs.current.autoSpinRef) {
        setAutoSpin(false);
      }
    };
    const onControlChange = () => {
      requestRender();
    };

    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    const handleResize = () => {
      if (!mount) return;
      const w = Math.max(mount.clientWidth, 260);
      const h = Math.max(mount.clientHeight, 300);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFallback(true);
    };
    const handleContextRestored = () => {
      setWebglFallback(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    sceneRefs.current = {
      ...sceneRefs.current,
      renderer,
      scene,
      camera,
      controls,
      garmentGroup,
      mannequinRoot,
      anchors: {
        jacket: jacketAnchor,
        top: topAnchor,
        bottom: bottomAnchor,
        shoes: shoesAnchor,
      },
      requestRender,
    };

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      disposeGroupContents(mannequinRoot);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Garment 3D Meshes when outfit items change
  useEffect(() => {
    const { garmentGroup, maxAnisotropy, requestRender } = sceneRefs.current;
    if (!garmentGroup) return;
    buildGarmentLayers(garmentGroup, jacket, top, bottom, shoes, maxAnisotropy);
    requestRender();
  }, [jacket, top, bottom, shoes]);

  // Re-project pins when toggled
  useEffect(() => {
    sceneRefs.current.requestRender();
  }, [showPins, isFullscreen]);

  // Subtle 360 spin flourish when Shuffle Fit is triggered
  useEffect(() => {
    if (shufflePulse === 0) return;
    const { controls, requestRender } = sceneRefs.current;
    if (!controls) return;
    const current = controls.getAzimuthalAngle();
    sceneRefs.current.targetAzimuthRad = current + Math.PI * 0.45;
    requestRender();
  }, [shufflePulse]);

  const snapToAngle = (deg: number) => {
    setAutoSpin(false);
    sceneRefs.current.targetAzimuthRad = (deg * Math.PI) / 180;
    sceneRefs.current.requestRender();
  };

  const angleLabel =
    azimuthDeg < 45 || azimuthDeg >= 315
      ? 'FRONT'
      : azimuthDeg >= 45 && azimuthDeg < 135
      ? 'RIGHT'
      : azimuthDeg >= 135 && azimuthDeg < 225
      ? 'BACK'
      : 'LEFT';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${
        isFullscreen ? 'h-full min-h-[75vh]' : 'aspect-[4/5]'
      } rounded-[2rem] bg-[#1b1b1f] overflow-hidden shadow-2xl select-none`}
    >
      {/* Dedicated WebGL Mount (isolated from React HUD overlays) */}
      {!webglFallback ? (
        <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1b1b1f] p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-[#292a2d] flex items-center justify-center mb-3">
            <RotateCw className="w-8 h-8 text-[#caf300]" />
          </div>
          <p className="font-display text-base font-semibold text-[#e3e2e6]">3D Viewport Standby</p>
          <p className="font-body text-xs text-[#c9c6c0] mt-1 max-w-xs">
            Interactive outfit layers active: {jacket?.name || top.name} + {bottom.name}
          </p>
        </div>
      )}

      {/* Subtle top-left editorial metadata stamp */}
      <div className="absolute top-4 left-4 flex flex-col gap-0.5 pointer-events-none z-10">
        <span className="font-mono-tech text-[9px] font-semibold text-[#8f9378] tracking-widest uppercase">
          {canvasId}
        </span>
        <span className="font-mono-tech text-[9px] font-semibold text-[#c9c6c0] tracking-tight uppercase">
          {silhouetteLabel}
        </span>
      </div>

      {/* Quick Canvas Actions (Top Right) */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <button
          type="button"
          onClick={() => setAutoSpin((prev) => !prev)}
          title={autoSpin ? 'Pause 360° Rotation' : 'Auto-Rotate 360°'}
          aria-label={autoSpin ? 'Pause 360 Rotation' : 'Auto Rotate 360'}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
            autoSpin
              ? 'bg-[#caf300] text-[#171e00]'
              : 'bg-[#343538]/90 text-[#e3e2e6] hover:bg-[#38393c]'
          }`}
        >
          <RotateCw className={`w-4 h-4 ${autoSpin ? 'animate-spin' : ''}`} style={{ animationDuration: '3.5s' }} />
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen 3D' : 'Inspect 3D Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen 3D' : 'Inspect 3D Fullscreen'}
            className="w-11 h-11 rounded-full bg-[#343538]/90 text-[#e3e2e6] hover:bg-[#38393c] flex items-center justify-center transition-transform active:scale-90 shadow-lg"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowPins((prev) => !prev)}
          title={showPins ? 'Hide Garment Tags' : 'Show Garment Tags'}
          aria-label={showPins ? 'Hide Garment Tags' : 'Show Garment Tags'}
          className="w-11 h-11 rounded-full bg-[#343538]/90 text-[#c9c6c0] hover:text-[#e3e2e6] flex items-center justify-center transition-transform active:scale-90 shadow-lg"
        >
          {showPins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Projected 3D Apparel Touch Targets */}
      {showPins &&
        projectedTags.map((tag) => {
          if (!tag.visible) return null;
          const slotCat: GarmentCategory =
            tag.id === 'jacket'
              ? 'jackets'
              : tag.id === 'top'
              ? 'tops'
              : tag.id === 'bottom'
              ? 'pants'
              : 'shoes';
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelectSlotCategory?.(slotCat)}
              style={{
                left: `${tag.x}px`,
                top: `${tag.y}px`,
                transform: tag.alignRight ? 'translate(-92%, -50%)' : 'translate(-8%, -50%)',
              }}
              className={`absolute z-10 flex items-center gap-1.5 transition-opacity duration-150 hover:scale-105 active:scale-95 ${
                tag.alignRight ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: tag.dotColor }}
              />
              <span className="px-2.5 py-1 rounded-full bg-[#0d0e11]/92 border border-white/10 shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="font-mono-tech text-[9px] font-semibold tracking-wider uppercase"
                  style={{ color: tag.badgeColor }}
                >
                  {tag.badge}
                </span>
                <span className="font-mono-tech text-[9px] font-medium text-[#e3e2e6]">
                  {tag.label} · ${tag.price}
                </span>
              </span>
            </button>
          );
        })}

      {/* Bottom-Left Fit Balance Pill */}
      <div className="absolute bottom-3.5 left-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#292a2d]/90 pointer-events-none z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#caf300]" />
        <span className="font-mono-tech text-[9px] font-semibold text-[#c5c9ac] tracking-wider">
          FIT BALANCE {fitBalance.toFixed(1)}
        </span>
      </div>

      {/* Bottom-Right 360° Interactive Orbit Angle Strip */}
      <div className="absolute bottom-3.5 right-4 flex items-center gap-1 px-2 py-1 rounded-full bg-[#0d0e11]/90 border border-white/10 z-20">
        <span className="font-mono-tech text-[9px] font-semibold text-[#caf300] px-1.5">
          {azimuthDeg}° {angleLabel}
        </span>
        {[
          { deg: 0, label: '0°' },
          { deg: 90, label: '90°' },
          { deg: 180, label: '180°' },
          { deg: 270, label: '270°' },
        ].map((preset) => {
          const isNear = Math.abs(((azimuthDeg - preset.deg + 540) % 360) - 180) < 20;
          return (
            <button
              key={preset.deg}
              type="button"
              onClick={() => snapToAngle(preset.deg)}
              className={`px-1.5 py-0.5 rounded-full font-mono-tech text-[9px] font-semibold transition-colors ${
                isNear
                  ? 'bg-[#caf300] text-[#171e00]'
                  : 'text-[#c9c6c0] hover:text-[#e3e2e6]'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
