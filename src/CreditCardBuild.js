import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import WithLessLogoDark from './static/withless-logo-dark.svg';

// CreditCardBuild: a self-contained Three.js canvas that renders a stylized credit card
// Features:
// - continuous gentle rotation
// - click to flip between front and back with smooth animation
// - metallic gradient texture generated on a canvas for a subtle metallic look

export default function CreditCardBuild({ width = 600, height = 380, animationType = 'idle' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene, camera, renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6);

    // Safe renderer creation: jsdom used by Jest doesn't implement canvas.getContext,
    // so creating a WebGLRenderer will throw. Wrap in try/catch and skip initialization
    // when WebGL isn't available (tests or non-browser environments).
    let renderer;
    try {
      // quick feature-detect: try creating a canvas context
      const testCanvas = document.createElement('canvas');
      testCanvas.getContext && testCanvas.getContext('2d');
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      // Environment doesn't support WebGL (e.g. Jest/jsdom). Skip 3D init.
      // Return a noop cleanup function to satisfy React effect contract.
      // eslint-disable-next-line no-console
      console.warn('WebGL not available — skipping Three.js initialization.', err && err.message ? err.message : err);
      return () => {};
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Recent versions of three.js use outputColorSpace instead of outputEncoding
    // and provide SRGBColorSpace constant.
    if ('outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
      // fallback for older versions that expose sRGBEncoding
    }
    mount.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    // Utility: create a canvas texture with metallic gradient
    function createMetallicGradient(w = 1024, h = 640, baseColor = '#0b6cf0') {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // metallic gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      // subtle bands
      grad.addColorStop(0.0, '#0f1724');
      grad.addColorStop(0.15, shadeColor(baseColor, -10));
      grad.addColorStop(0.35, shadeColor(baseColor, 18));
      grad.addColorStop(0.6, shadeColor(baseColor, -6));
      grad.addColorStop(1.0, '#031027');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Add a soft highlight band
      ctx.globalCompositeOperation = 'lighter';
      const bandGrad = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.85);
      bandGrad.addColorStop(0.0, 'rgba(255,255,255,0.02)');
      bandGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      bandGrad.addColorStop(1.0, 'rgba(255,255,255,0.02)');
      ctx.fillStyle = bandGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'source-over';

      // tiny noise to simulate brushed metal
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() - 0.5) * 6; // noise magnitude
        data[i] = clamp(data[i] + v, 0, 255);
        data[i + 1] = clamp(data[i + 1] + v, 0, 255);
        data[i + 2] = clamp(data[i + 2] + v, 0, 255);
      }
      ctx.putImageData(imageData, 0, 0);

      return new THREE.CanvasTexture(canvas);
    }

    // Utility: create card face texture (front/back)
    function createCardFace({ w = 1024, h = 640 } = {}) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const corner = Math.round(w / 1024);
      const cardW = w;
      const cardH = h;
      const cardX = 0;
      const cardY = 0;

      function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
      }

      // prepare logo image (async)
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      let logoLoaded = false;
      logoImg.onload = () => {
        logoLoaded = true;
        tex.needsUpdate = true;
      };
      logoImg.onerror = () => {
        logoLoaded = false;
      };
      logoImg.src = WithLessLogoDark;

      // create texture
      const tex = new THREE.CanvasTexture(canvas);
      tex.format = THREE.RGBAFormat;

      // element positions and sizes (computed once)
      const logoW = Math.round(cardW / 340 * 60);
      const logoH = Math.round(cardW / 340 * 47);
      const logoX = cardX + cardW - logoW - Math.round(cardW * 0.06);
      const logoY = cardY + Math.round(cardH * 0.06);
      const chipW = Math.round(cardW * 0.08);
      const chipH = Math.round(cardH * 0.1);
      const chipX = cardX + Math.round(cardW * 0.06);
      const chipY = cardY + Math.round(cardH * 0.3);
      const wifiCX = cardX + Math.round(cardW * 0.88);
      const wifiCY = cardY + Math.round(cardH * 0.45);
      const mcR = Math.round(cardH * 0.08);
      const mcX = cardX + Math.round(cardW * 0.85);
      const mcY = cardY + Math.round(cardH * 0.8);

      // helper draws
      function drawBase(alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.clearRect(0, 0, w, h);
        roundRect(ctx, cardX, cardY, cardW, cardH, corner);
        ctx.fillStyle = 'rgb(58,242,174)';
        ctx.fill();

        // inner gloss
        const innerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
        innerGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        innerGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = innerGrad;
        ctx.save();
        roundRect(ctx, cardX, cardY, cardW, cardH, corner);
        ctx.clip();
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.restore();

        // border
        ctx.lineWidth = Math.max(2, Math.round(w * 0.0025));
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        roundRect(ctx, cardX + 1, cardY + 1, cardW - 2, cardH - 2, corner - 1);
        ctx.stroke();
        ctx.restore();
      }

      function drawLogo(alpha = 1) {
        if (!logoLoaded) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
        ctx.restore();
      }

      function drawChip(alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#d4c08a';
        roundRect(ctx, chipX, chipY, chipW, chipH, Math.round(chipH * 0.12));
        ctx.fill();
        ctx.restore();
      }

      function drawNumbers(alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgb(7,19,43)';
        ctx.font = Math.round(cardH * 0.085) + 'px monospace';
        ctx.fillText('4242 4242 4242 4242', cardX + Math.round(cardW * 0.06), cardY + Math.round(cardH * 0.60));
        ctx.font = Math.round(cardH * 0.06) + 'px sans-serif';
        ctx.fillText('CARDHOLDER NAME', cardX + Math.round(cardW * 0.06), cardY + Math.round(cardH * 0.70));
        ctx.fillText('12/34', cardX + Math.round(cardW * 0.06), cardY + Math.round(cardH * 0.86));
        ctx.restore();
      }

      function drawWifi(alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(153,146,146)';
        ctx.lineWidth = Math.max(2, Math.round(cardW * 0.006));
        ctx.lineCap = 'round';
        ctx.save();
        ctx.translate(wifiCX, wifiCY);
        ctx.rotate(Math.PI / 2);
        for (let i = 0; i < 3; i++) {
          const r = Math.max(4, Math.round(cardH * 0.02)) * (1.6 + i * 0.9);
          ctx.beginPath();
          ctx.arc(0, 0, r, Math.PI * 1.25, Math.PI * 1.75);
          ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
      }

      function drawMC(alpha = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        // left
        ctx.beginPath();
        ctx.arc(mcX - mcR * 0.4, mcY, mcR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(235,75,50,0.95)';
        ctx.fill();
        // right
        ctx.beginPath();
        ctx.arc(mcX + mcR, mcY, mcR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,153,51,0.95)';
        ctx.fill();
        // overlap
        ctx.beginPath();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(255,180,100,0.25)';
        ctx.arc(mcX, mcY, mcR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }

      // update(progress) draws incremental steps. progress 0..1
      // step mapping (fractions):
      // 0.00-0.15: card appears (scale/alpha)
      // 0.15-0.40: fill background fully
      // 0.40-0.55: logo
      // 0.55-0.70: chip
      // 0.70-0.85: numbers
      // 0.85-0.95: wifi
      // 0.95-1.00: mastercard
      function update(p) {
        // clamp
        const progress = Math.max(0, Math.min(1, p));
        // clear
        ctx.clearRect(0, 0, w, h);

        // appearance alpha (card fade/scale not applied to canvas itself, texture consumer can scale the mesh if desired)
        const baseAlpha = progress < 0.15 ? progress / 0.15 : 1;
        drawBase(baseAlpha);

        // logo
        const logoStart = 0.40, logoEnd = 0.55;
        if (progress > logoStart) {
          const t = Math.max(0, Math.min(1, (progress - logoStart) / (logoEnd - logoStart)));
          drawLogo(t);
        }

        // chip
        const chipStart = 0.55, chipEnd = 0.70;
        if (progress > chipStart) {
          const t = Math.max(0, Math.min(1, (progress - chipStart) / (chipEnd - chipStart)));
          drawChip(t);
        }

        // numbers
        const numStart = 0.70, numEnd = 0.85;
        if (progress > numStart) {
          const t = Math.max(0, Math.min(1, (progress - numStart) / (numEnd - numStart)));
          drawNumbers(t);
        }

        // wifi
        const wifiStart = 0.85, wifiEnd = 0.95;
        if (progress > wifiStart) {
          const t = Math.max(0, Math.min(1, (progress - wifiStart) / (wifiEnd - wifiStart)));
          drawWifi(t);
        }

        // mastercard
        const mcStart = 0.95, mcEnd = 1.0;
        if (progress > mcStart) {
          const t = Math.max(0, Math.min(1, (progress - mcStart) / (mcEnd - mcStart)));
          drawMC(t);
        }

        tex.needsUpdate = true;
      }

      // initial blank texture
      update(0);

      // return texture and update function
      return { texture: tex, update };
    }

    const metalTex = createMetallicGradient(1024, 640, '#0b6cf0');
    if ('colorSpace' in metalTex) metalTex.colorSpace = THREE.SRGBColorSpace;
    metalTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const frontTex = createCardFace();
    const backTex = createCardFace();
    if ('colorSpace' in frontTex) frontTex.colorSpace = THREE.SRGBColorSpace;
    if ('colorSpace' in backTex) backTex.colorSpace = THREE.SRGBColorSpace;
    frontTex.anisotropy = backTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Card geometry and material
    const cardWidth = 3.7; // aspect ~1.78
    const cardHeight = 2.3;
    const cardDepth = 0.06;
    const geom = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);

    // Materials for each side: map front/back to appropriate faces
    // BoxGeometry has 6 groups; we can create an array of 6 materials
    const materialFront = new THREE.MeshStandardMaterial({
      map: frontTex.texture,
      metalness: 0.8,
      roughness: 0.25,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const materialBack = new THREE.MeshStandardMaterial({
      map: backTex.texture,
      metalness: 0.8,
      roughness: 0.25,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
    });
    const materialEdge = new THREE.MeshStandardMaterial({
      map: metalTex,
      metalness: 0.95,
      roughness: 0.15,
      color: '#cfcfcf',
    });

    // Box materials order: +X, -X, +Y, -Y, +Z, -Z
    // We'll set +Z as front and -Z as back (depending on geometry orientation)
    const materials = [materialEdge, materialEdge, materialEdge, materialEdge, materialFront, materialBack];

    const card = new THREE.Mesh(geom, materials);

    // Slight bevel-ish rotation to show 3D
    card.rotation.x = -0.08;
    scene.add(card);

    // Build animation state (used when animationType === 'build')
    let buildStart = null;
    let buildDone = false;
    const BUILD_DURATION = 2800; // ms

    // State for animation
    let targetRotationY = 0;
    let autoRotateSpeed = 0.0025;


    // Handle resize
    function onWindowResize() {
      const rect = mount.getBoundingClientRect();
      const w = rect.width || width;
      const h = rect.height || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    window.addEventListener('resize', onWindowResize);

    // Animation loop
    let lastTime = performance.now();
    let rafId = null;
    function animate(t) {
      rafId = requestAnimationFrame(animate);
      const dt = t - lastTime; // ms
      lastTime = t;
      const s = t * 0.001; // seconds

      // If we're in a "build" animation, drive the front texture's update sequence
      if (animationType === 'build' && !buildDone) {
        if (buildStart === null) buildStart = t;
        const p = Math.max(0, Math.min(1, (t - buildStart) / BUILD_DURATION));
        // update the front face drawing according to progress
        try {
          frontTex.update(p);
        } catch (e) {
          // defensive: if frontTex doesn't provide update, ignore
        }
        // animate mesh scale and material opacity from 0.3->1 and 0->1
        const scale = 0.3 + 0.7 * easeOutCubic(p);
        card.scale.set(scale, scale, scale);
        materialFront.opacity = p;
        materialBack.opacity = p;
        materialEdge.opacity = p;
        if (p >= 1) {
          buildDone = true;
        }
      }

      // Choose rotate speed by animation type
      let baseAutoRotate = autoRotateSpeed;
      if (animationType === 'spin') baseAutoRotate = 0.0155; // faster
      if (animationType === 'idle') baseAutoRotate = 0.0025;

      // auto rotation around Y
      const currentY = card.rotation.y;
      const spin = baseAutoRotate * dt;
      let newY = currentY + spin;

      // ease towards targetRotationY when flipping
      const ease = 0.08;
      const dy = shortestAngleDiff(newY, targetRotationY);
      newY = newY + dy * ease;
      card.rotation.y = newY;

      // Additional per-type effects
      if (animationType === 'pulse') {
        // subtle breathing scale
        const scale = 1 + 0.04 * Math.sin(s * 6);
        card.scale.set(scale, scale, scale);
      } else {
        card.scale.set(1, 1, 1);
      }

      if (animationType === 'sway') {
        // gentle roll/sway
        card.rotation.z = 0.12 * Math.sin(s * 1.6);
      } else {
        // keep small default tilt
        card.rotation.z = card.rotation.z * 0.92;
      }

      if (animationType === 'glint') {
        // move directional light to create glint across card
        dir.position.x = Math.cos(s * 2.0) * 6;
        dir.position.z = Math.sin(s * 2.0) * 6;
        dir.position.y = 4 + Math.sin(s * 1.2) * 1.2;
      }

      // render
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      // cancel the RAF we created above
      if (typeof rafId === 'number') cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onWindowResize);
      mount.removeChild(renderer.domElement);

      // dispose geometries and textures
      geom.dispose();
      materialFront.map && materialFront.map.dispose();
      materialBack.map && materialBack.map.dispose();
      materialEdge.map && materialEdge.map.dispose();
      materialFront.dispose();
      materialBack.dispose();
      materialEdge.dispose();
      renderer.dispose();
    };
  }, [width, height, animationType]);

  return (
    <div
      ref={mountRef}
      style={{ width: width + 'px', height: height + 'px', touchAction: 'none' }}
    />
  );
}

// helper functions (kept outside component to avoid re-declaration if the module reloads)
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function shadeColor(hex, percent) {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x0000ff;
  const newR = Math.round((t - R) * p) + R;
  const newG = Math.round((t - G) * p) + G;
  const newB = Math.round((t - B) * p) + B;
  return `rgb(${newR},${newG},${newB})`;
}

function shortestAngleDiff(current, target) {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

function easeOutCubic(t) {
  return (--t) * t * t + 1;
}
