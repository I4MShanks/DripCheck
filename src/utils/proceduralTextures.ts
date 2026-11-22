import * as THREE from 'three';
import { FabricStyle } from '../types/wardrobe';

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getFabricTexture(
  fabric: FabricStyle,
  baseHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const key = `${fabric}:${baseHex}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const baseColor = new THREE.Color(baseHex);
    const r = Math.round(baseColor.r * 255);
    const g = Math.round(baseColor.g * 255);
    const b = Math.round(baseColor.b * 255);

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, size, size);

    if (fabric === 'corduroy') {
      for (let x = 0; x < size; x += 4) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(x, 0, 1.5, size);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(x + 2, 0, 1, size);
      }
      for (let y = 0; y < size; y += 3) {
        ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, y, size, 1);
      }
    } else if (fabric === 'ripstop') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < size; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    } else if (fabric === 'knit') {
      for (let x = 0; x < size; x += 8) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(x, 0, 2, size);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x + 3, 0, 2, size);
      }
      for (let y = 0; y < size; y += 6) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillRect(0, y, size, 1.5);
      }
    } else if (fabric === 'denim' || fabric === 'cargo') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let i = -size; i < size * 2; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }
      if (fabric === 'denim') {
        for (let i = 0; i < 900; i++) {
          const px = (i * 73) % size;
          const py = (i * 137) % size;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
          ctx.fillRect(px, py, 2, 1);
        }
      }
    } else if (fabric === 'cotton') {
      for (let i = 0; i < 1400; i++) {
        const px = (i * 53) % size;
        const py = (i * 97) % size;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
        ctx.fillRect(px, py, 1.5, 1.5);
      }
    } else if (fabric === 'leather') {
      for (let i = 0; i < 800; i++) {
        const px = (i * 61) % size;
        const py = (i * 113) % size;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

export function getTurntablePlinthTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const key = 'plinth-dial';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, size * 0.48);
    grad.addColorStop(0, '#272930');
    grad.addColorStop(0.7, '#1b1c21');
    grad.addColorStop(1, '#121316');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle precision degree ring
    ctx.strokeStyle = 'rgba(202, 243, 0, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(227, 226, 230, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.37, 0, Math.PI * 2);
    ctx.stroke();

    // 360-degree tick marks around perimeter
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 90 === 0;
      const rInner = isMajor ? size * 0.405 : size * 0.418;
      const rOuter = size * 0.43;
      ctx.strokeStyle = isMajor ? 'rgba(202, 243, 0, 0.72)' : 'rgba(201, 198, 192, 0.25)';
      ctx.lineWidth = isMajor ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * rInner, cy + Math.sin(rad) * rInner);
      ctx.lineTo(cx + Math.cos(rad) * rOuter, cy + Math.sin(rad) * rOuter);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  textureCache.set(key, texture);
  return texture;
}

export function getContactShadowTexture(): THREE.CanvasTexture {
  const key = 'contact-shadow';
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      10,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}
