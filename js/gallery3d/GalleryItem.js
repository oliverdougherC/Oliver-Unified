import * as THREE from 'three';
import { gsap } from 'gsap';
import { fragmentShader, vertexShader } from './shaders.js';

const TEXTURE_LOAD_TIMEOUT_MS = 15000;
const FRONT_PANE_GEOMETRY = new THREE.PlaneGeometry(1, 1, 1, 1);
const BACK_PANE_GEOMETRY = new THREE.PlaneGeometry(1, 1, 1, 1);

let GLASS_BODY_GEOMETRY = null;
let sharedFallback = null;

function getSharedFallbackTexture() {
  if (!sharedFallback) {
    const pixel = new Uint8Array([242, 242, 242, 255]);
    sharedFallback = new THREE.DataTexture(pixel, 1, 1, THREE.RGBAFormat);
    sharedFallback.needsUpdate = true;
    sharedFallback.colorSpace = THREE.SRGBColorSpace;
  }
  return sharedFallback;
}

function clampExposure(value) {
  return Math.min(1.02, Math.max(0.98, Number(value) || 1));
}

function roundedRectPath(path, width, height, radius) {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.max(0.001, Math.min(radius, hw - 0.001, hh - 0.001));

  path.moveTo(-hw + r, -hh);
  path.lineTo(hw - r, -hh);
  path.quadraticCurveTo(hw, -hh, hw, -hh + r);
  path.lineTo(hw, hh - r);
  path.quadraticCurveTo(hw, hh, hw - r, hh);
  path.lineTo(-hw + r, hh);
  path.quadraticCurveTo(-hw, hh, -hw, hh - r);
  path.lineTo(-hw, -hh + r);
  path.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  path.closePath();
}

function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  roundedRectPath(shape, width, height, radius);
  return shape;
}

function getGlassBodyGeometry() {
  if (GLASS_BODY_GEOMETRY) return GLASS_BODY_GEOMETRY;

  const slab = createRoundedRectShape(1, 1, 0.08);
  GLASS_BODY_GEOMETRY = new THREE.ExtrudeGeometry(slab, {
    depth: 1,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 8,
    bevelSize: 0.011,
    bevelThickness: 0.022,
    curveSegments: 28
  });
  GLASS_BODY_GEOMETRY.center();
  return GLASS_BODY_GEOMETRY;
}

export class GalleryItem {
  constructor({ entry, textureLoader, maxAnisotropy = 1, qualityLevel = 1, isMobile = false }) {
    this.entry = entry;
    this.textureLoader = textureLoader;
    this.maxAnisotropy = maxAnisotropy;
    this.aspect = entry.aspect || 1.5;
    this.highResLoaded = false;
    this._loadTimer = null;

    this.isMobile = Boolean(isMobile);
    this.thicknessMin = this.isMobile ? 1.6 : 2.4;
    this.thicknessMax = this.isMobile ? 2.2 : 3.0;
    this.worldThickness = (this.thicknessMin + this.thicknessMax) * 0.5;

    this.uniforms = {
      u_image: { value: getSharedFallbackTexture() },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_time: { value: 0 },
      u_hoverState: { value: 0 },
      u_res: { value: new THREE.Vector2(1600, Math.round(1600 / this.aspect)) },
      u_planeRes: { value: new THREE.Vector2(420, 280) },
      u_depthPhase: { value: 0 },
      u_fresnelStrength: { value: 0.052 },
      u_refractionStrength: { value: 0.00085 },
      u_chromaticStrength: { value: 0.00002 },
      u_glossStrength: { value: 0.28 },
      u_grainAmount: { value: 0.00035 },
      u_qualityLevel: { value: qualityLevel },
      u_temperature: { value: entry.colorGrade?.temperature || 0 },
      u_tint: { value: entry.colorGrade?.tint || 0 },
      u_exposure: { value: clampExposure(entry.colorGrade?.exposure || 1) },
      u_opacity: { value: entry.scene?.opacity ?? 1 },
      u_cornerRadius: { value: 0.06 },
      u_edgeSoftness: { value: 0.008 },
      u_thickness: { value: this.worldThickness * 0.34 },
      u_materialMix: { value: 0.018 }
    };

    this.photoMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      side: THREE.FrontSide
    });

    this.glassBodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f8f8f8'),
      transparent: true,
      opacity: 0.056,
      roughness: 0.11,
      metalness: 0,
      transmission: 0.8,
      ior: 1.44,
      thickness: 0.3,
      clearcoat: 0.64,
      clearcoatRoughness: 0.18,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.backPaneMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f8f8f8'),
      transparent: true,
      opacity: 0.024,
      roughness: 0.22,
      metalness: 0,
      transmission: 0.26,
      ior: 1.4,
      thickness: 0.08,
      depthTest: true,
      depthWrite: false
    });

    this.photoFrontMesh = new THREE.Mesh(FRONT_PANE_GEOMETRY, this.photoMaterial);
    this.glassBodyMesh = new THREE.Mesh(getGlassBodyGeometry(), this.glassBodyMaterial);
    this.backPaneMesh = new THREE.Mesh(BACK_PANE_GEOMETRY, this.backPaneMaterial);

    this.photoFrontMesh.userData.galleryItem = this;
    this.glassBodyMesh.userData.galleryItem = this;
    this.backPaneMesh.userData.galleryItem = this;

    this.root = new THREE.Group();
    this.root.userData.galleryItem = this;
    this.root.add(this.backPaneMesh);
    this.root.add(this.glassBodyMesh);
    this.root.add(this.photoFrontMesh);

    this.mesh = this.root;
    this.interactionMesh = this.photoFrontMesh;
    // Backward-compatible aliases used by existing diagnostics.
    this.frontPhotoMesh = this.photoFrontMesh;
    this.backGlassMesh = this.backPaneMesh;
    this.edgeShellMesh = this.glassBodyMesh;

    this.baseScene = {
      x: entry.scene?.x || 0,
      y: entry.scene?.y || 0,
      z: entry.scene?.z || 0,
      scale: entry.scene?.scale || 1,
      rotX: entry.scene?.rotX || 0,
      rotY: entry.scene?.rotY || 0,
      rotZ: entry.scene?.rotZ || 0,
      opacity: entry.scene?.opacity ?? 1
    };

    this.currentOpacity = this.baseScene.opacity;
    this.currentDimensions = { width: 420, height: 280 };

    this.setQualityLevel(qualityLevel);
    this.loadThumbTexture();
  }

  getRaycastTarget() {
    return this.interactionMesh;
  }

  setViewportMode(isMobile) {
    this.isMobile = Boolean(isMobile);
    this.thicknessMin = this.isMobile ? 1.6 : 2.4;
    this.thicknessMax = this.isMobile ? 2.2 : 3.0;
    this.worldThickness = (this.thicknessMin + this.thicknessMax) * 0.5;
    this.uniforms.u_thickness.value = this.worldThickness * 0.34;
  }

  loadThumbTexture() {
    const src = this.entry.src?.thumb || this.entry.src?.medium;
    if (!src) return;
    this._loadTextureFromSrc(src);
  }

  loadHighResTexture() {
    if (this.highResLoaded) return;
    this.highResLoaded = true;

    const src = this.entry.src?.large || this.entry.src?.medium;
    if (!src) return;
    this._loadTextureFromSrc(src);
  }

  _loadTextureFromSrc(src) {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`Texture load timed out after ${TEXTURE_LOAD_TIMEOUT_MS}ms: ${src}`);
    }, TEXTURE_LOAD_TIMEOUT_MS);

    this.textureLoader.load(
      src,
      (texture) => {
        clearTimeout(timer);
        if (timedOut) return;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = this.maxAnisotropy;

        const prev = this.uniforms.u_image.value;
        this.uniforms.u_image.value = texture;

        if (texture.image && texture.image.width && texture.image.height) {
          this.aspect = texture.image.width / texture.image.height;
          this.uniforms.u_res.value.set(texture.image.width, texture.image.height);
        }

        if (prev && prev !== texture && prev !== sharedFallback) {
          prev.dispose();
        }
      },
      undefined,
      () => {
        clearTimeout(timer);
      }
    );
  }

  setQualityLevel(level) {
    const clamped = Math.min(1, Math.max(0.35, Number(level) || 1));
    this.uniforms.u_qualityLevel.value = clamped;
    this.uniforms.u_materialMix.value = 0.01 + clamped * 0.02;
  }

  getThicknessForPhase(phase) {
    const t = Math.min(1, Math.max(0, Number(phase) || 0));
    return this.thicknessMin + (this.thicknessMax - this.thicknessMin) * t;
  }

  setTransform(transform) {
    const phase = this.uniforms.u_depthPhase.value;
    const width = transform.height * this.aspect;
    const height = transform.height;
    const thickness = this.getThicknessForPhase(phase);
    const minDim = Math.max(Math.min(width, height), 1);
    const cornerRadiusWorld = Math.min(54, Math.max(22, minDim * 0.08));
    const normalizedRadius = Math.min(0.12, Math.max(0.02, cornerRadiusWorld / minDim));

    this.currentDimensions.width = width;
    this.currentDimensions.height = height;

    this.root.position.set(transform.x, transform.y, transform.z);
    this.root.rotation.set(transform.rotX, transform.rotY, transform.rotZ);

    this.photoFrontMesh.scale.set(width, height, 1);
    this.photoFrontMesh.position.set(0, 0, thickness * 0.5 + 0.03);

    this.backPaneMesh.scale.set(width * 0.992, height * 0.992, 1);
    this.backPaneMesh.position.set(0, 0, -thickness * 0.5 - 0.018);

    this.glassBodyMesh.scale.set(width, height, thickness);
    this.glassBodyMesh.position.set(0, 0, 0);

    this.uniforms.u_planeRes.value.set(width, height);
    this.uniforms.u_cornerRadius.value = normalizedRadius;
    this.uniforms.u_opacity.value = transform.opacity;
    this.uniforms.u_thickness.value = thickness;
    this.currentOpacity = transform.opacity;

    this.backPaneMaterial.opacity = 0.012 + phase * 0.016;
    this.glassBodyMaterial.opacity = 0.034 + phase * 0.022;

    this.root.visible = transform.visible && transform.opacity > 0.02;
  }

  setDepthProfile(profile) {
    this.uniforms.u_depthPhase.value = profile.depthPhase;
    this.uniforms.u_fresnelStrength.value = profile.fresnel;
    this.uniforms.u_refractionStrength.value = profile.refraction;
    this.uniforms.u_chromaticStrength.value = profile.chromatic;
    this.uniforms.u_glossStrength.value = profile.gloss;
    this.uniforms.u_grainAmount.value = profile.grain;
  }

  setHoverState(isHovering, uv) {
    if (uv) {
      this.uniforms.u_mouse.value.set(uv.x, uv.y);
    }

    gsap.to(this.uniforms.u_hoverState, {
      value: isHovering ? 1 : 0,
      duration: isHovering ? 0.6 : 0.36,
      ease: isHovering ? 'power3.out' : 'power2.out',
      overwrite: true
    });
  }

  update(time) {
    this.uniforms.u_time.value = time;
  }

  dispose() {
    gsap.killTweensOf(this.uniforms.u_hoverState);

    this.photoMaterial.dispose();
    this.glassBodyMaterial.dispose();
    this.backPaneMaterial.dispose();

    const tex = this.uniforms.u_image.value;
    if (tex && tex !== sharedFallback) {
      tex.dispose();
    }
  }
}
