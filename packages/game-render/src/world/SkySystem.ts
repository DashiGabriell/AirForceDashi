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
uniform float yaw;
uniform vec3 uHaze;
uniform float camAlt;
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
  float dusk = smoothstep(0.2, 0.32, dayFactor) * (1.0 - smoothstep(0.4, 0.52, dayFactor));
  col = mix(col, col * vec3(1.28, 0.62, 0.4), dusk * 0.45);

  // Geometric horizon of a sphere the size of Earth, seen from camAlt.
  // A constant elevation is a small circle: in perspective it bows like a real horizon.
  float elev = asin(clamp(dir.y, -1.0, 1.0));
  float h = max(camAlt, 2.0);
  float dip = acos(clamp(6371000.0 / (6371000.0 + h), 0.0, 1.0));
  float limb = -dip;
  float below = smoothstep(limb + 0.015, limb - 0.06, elev);
  col = mix(col, uHaze, below);
  float band = exp(-pow((elev - limb) / 0.018, 2.0));
  vec3 limbTint = mix(vec3(1.0, 0.97, 0.92), vec3(1.0, 0.72, 0.48), dusk);
  col += band * limbTint * 0.2;
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
  readonly haze = new Color(0xd4e2ee);
  private readonly dayHaze = new Color(0xd4e2ee);
  private readonly duskHaze = new Color(0xe8a882);
  private readonly nightHaze = new Color(0x141c2c);
  private dome: Mesh;
  private material: ShaderMaterial;
  private uniforms: {
    dayMap: Uniform<Texture>;
    nightMap: Uniform<Texture>;
    dayFactor: Uniform<number>;
    yaw: Uniform<number>;
    uHaze: Uniform<Color>;
    camAlt: Uniform<number>;
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
      yaw: new Uniform(0),
      uHaze: new Uniform(this.haze),
      camAlt: new Uniform(400),
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
    const dir = clock.sunDir;
    this.sun.position.set(dir.x * 200, dir.y * 200, dir.z * 200);
    this.sun.intensity = 0.25 + d * 1.2;
    this.hemi.intensity = 0.2 + d * 0.45;

    if (d > 0.35) this.haze.copy(this.dayHaze).lerp(this.duskHaze, 1 - d);
    else this.haze.copy(this.duskHaze).lerp(this.nightHaze, 1 - d / 0.35);

    this.uniforms.dayFactor.value = d;
    this.uniforms.yaw.value = Math.atan2(dir.x, dir.z);
    this.uniforms.camAlt.value = Math.max(2, wy);
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
