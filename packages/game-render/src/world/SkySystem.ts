import type { DayClock } from "@afd/game-core";
import {
  BackSide,
  Color,
  DataTexture,
  DirectionalLight,
  HemisphereLight,
  LinearFilter,
  LinearSRGBColorSpace,
  Mesh,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Uniform,
  UnsignedByteType,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/**
 * Day and night skies are CC0 pure-sky HDRIs from Poly Haven (1k):
 * - day: kloofendal_43d_clear_puresky — Greg Zaal
 * - night: qwantani_night_puresky — Greg Zaal, Jarod Guest
 * Files live in apps/web/public/sky/. One map cannot cover both hours,
 * so the dome crossfades the two across the existing day clock.
 */
const DAY_URL = "/sky/day.hdr";
const NIGHT_URL = "/sky/night.hdr";

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vDir = worldPos.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform float dayFactor;
uniform float duskFactor;
uniform float dawnFactor;
uniform float yaw;
varying vec3 vDir;

vec2 equirectUv(vec3 dir) {
  float u = atan(dir.z, dir.x) * 0.15915494 + 0.5;
  float v = asin(clamp(dir.y, -1.0, 1.0)) * 0.31830989 + 0.5;
  return vec2(u, v);
}

vec3 tonemap(vec3 c) {
  return c / (1.0 + c);
}

void main() {
  vec3 dir = normalize(vDir);
  float c = cos(yaw);
  float s = sin(yaw);
  dir = vec3(c * dir.x - s * dir.z, dir.y, s * dir.x + c * dir.z);
  vec2 uv = equirectUv(dir);
  vec3 day = tonemap(texture2D(dayMap, uv).rgb * 0.9);
  vec3 night = tonemap(texture2D(nightMap, uv).rgb * 6.0);
  float t = smoothstep(0.16, 0.58, dayFactor);
  vec3 col = mix(night, day, t);
  // Hour-based warm ramps (dawn cool-pink, dusk orange) — not just dayFactor mid-band.
  float dusk = duskFactor;
  float dawn = dawnFactor;
  col = mix(col, col * vec3(1.32, 0.58, 0.36), dusk * 0.55);
  col = mix(col, col * vec3(1.15, 0.72, 0.85), dawn * 0.35);
  gl_FragColor = vec4(col, 1.0);
}
`;

function solidTexture(hex: number): DataTexture {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const tex = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  tex.colorSpace = LinearSRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class SkySystem {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  /** Pale horizon color. Ground and water fade into this same value. */
  readonly haze = new Color(0x9eb4cc);
  private readonly dayHaze = new Color(0x9eb4cc);
  private readonly duskHaze = new Color(0xd09070);
  private readonly nightHaze = new Color(0x1a2436);
  private dome: Mesh;
  private material: ShaderMaterial;
  private uniforms: {
    dayMap: Uniform<Texture>;
    nightMap: Uniform<Texture>;
    dayFactor: Uniform<number>;
    duskFactor: Uniform<number>;
    dawnFactor: Uniform<number>;
    yaw: Uniform<number>;
  };
  private dayMap: Texture;
  private nightMap: Texture;
  private loadedDay: Texture | null = null;
  private loadedNight: Texture | null = null;

  constructor(private scene: Scene) {
    this.sun = new DirectionalLight(0xffe6c8, 1.35);
    this.hemi = new HemisphereLight(0x9eb6d0, 0x3a4540, 0.55);
    scene.fog = null;
    scene.background = this.haze;
    scene.add(this.sun);
    scene.add(this.hemi);

    this.dayMap = solidTexture(0x6a8aaa);
    this.nightMap = solidTexture(0x0a0e18);
    this.uniforms = {
      dayMap: new Uniform(this.dayMap),
      nightMap: new Uniform(this.nightMap),
      dayFactor: new Uniform(1),
      duskFactor: new Uniform(0),
      dawnFactor: new Uniform(0),
      yaw: new Uniform(0),
    };
    this.material = new ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });
    this.dome = new Mesh(new SphereGeometry(9000, 128, 64), this.material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    this.dome.visible = false;
    scene.add(this.dome);

    const loader = new RGBELoader();
    loader.load(DAY_URL, (tex) => {
      this.loadedDay = this.prepareHdr(tex);
      this.tryEnable();
    });
    loader.load(NIGHT_URL, (tex) => {
      this.loadedNight = this.prepareHdr(tex);
      this.tryEnable();
    });
  }

  get fogNear(): number {
    return 1600;
  }

  get fogFar(): number {
    return 4200;
  }

  get fogTint(): Color {
    return this.haze;
  }

  update(clock: DayClock, wx = 0, wz = 0, wy = 400): void {
    const d = clock.dayFactor;
    const dusk = clock.duskFactor;
    const dawn = clock.dawnFactor;
    const dir = clock.sunDir;
    this.sun.position.set(dir.x * 200, dir.y * 200, dir.z * 200);
    this.sun.intensity = 0.12 + d * 1.35;
    this.sun.color.setHex(dusk > 0.25 ? 0xffc090 : dawn > 0.25 ? 0xffe0d0 : 0xffe6c8);
    this.hemi.intensity = 0.12 + d * 0.5;
    this.hemi.color.setHex(d > 0.4 ? 0x9eb6d0 : 0x4a5a78);
    this.hemi.groundColor.setHex(d > 0.4 ? 0x3a4540 : 0x121820);

    // Haze: day → dusk/dawn warmth → deep night.
    if (d > 0.4) {
      this.haze.copy(this.dayHaze).lerp(this.duskHaze, Math.max(dusk, dawn * 0.65));
    } else if (d > 0.15) {
      this.haze.copy(this.duskHaze).lerp(this.nightHaze, 1 - (d - 0.15) / 0.25);
    } else {
      this.haze.copy(this.nightHaze);
    }
    if (this.scene.background instanceof Color) {
      this.scene.background.copy(this.haze);
    }

    this.uniforms.dayFactor.value = d;
    this.uniforms.duskFactor.value = dusk;
    this.uniforms.dawnFactor.value = dawn;
    this.uniforms.yaw.value = Math.atan2(dir.x, dir.z);
    this.dome.position.set(wx, wy, wz);
  }

  dispose(): void {
    this.scene.remove(this.sun);
    this.scene.remove(this.hemi);
    this.scene.remove(this.dome);
    this.sun.dispose();
    this.dome.geometry.dispose();
    this.material.dispose();
    this.dayMap.dispose();
    this.nightMap.dispose();
    this.loadedDay?.dispose();
    this.loadedNight?.dispose();
  }

  private prepareHdr(tex: Texture): Texture {
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.colorSpace = LinearSRGBColorSpace;
    return tex;
  }

  private tryEnable(): void {
    if (!this.loadedDay || !this.loadedNight) return;
    this.uniforms.dayMap.value = this.loadedDay;
    this.uniforms.nightMap.value = this.loadedNight;
    this.dome.visible = true;
  }
}
