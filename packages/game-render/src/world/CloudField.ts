import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

const CLUSTERS = 24;
const RECYCLE = 8600;
const SPAWN_NEAR = 1600;
const SPAWN_FAR = 6800;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorld = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform vec3 sunDir;
uniform float dayFactor;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec4 tex = texture2D(map, vUv);
  if (tex.a < 0.03) discard;

  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  vec3 n = normalize(vec3(p.x, sqrt(max(0.0, 1.0 - r2)), p.y));
  float ndl = dot(n, normalize(sunDir)) * 0.5 + 0.5;
  vec3 dayLit = mix(vec3(0.62, 0.70, 0.80), vec3(1.0, 0.99, 0.97), ndl);
  vec3 night = vec3(0.28, 0.32, 0.42);
  vec3 col = mix(night, dayLit, clamp(dayFactor, 0.0, 1.0));
  col *= tex.rgb;

  float dist = distance(cameraPosition, vWorld);
  float fog = smoothstep(fogNear, fogFar, dist);
  // Inside the puff the card would fill the screen. Ease it into a veil.
  float veil = smoothstep(40.0, 240.0, dist);
  col = mix(col, fogColor, fog);
  float alpha = tex.a * mix(0.14, 0.8, veil) * (1.0 - fog * 0.92);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

interface Cluster {
  group: Group;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function fallbackTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(64, 70, 8, 64, 64, 60);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.45, "rgba(236,242,248,0.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function prepareMap(tex: Texture): Texture {
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Cumulus cards in world space. They drift with the wind and are recycled
 * past the horizon. Nothing here collides: the jet flies through the puffs.
 */
export class CloudField {
  readonly group = new Group();
  private readonly geo = new PlaneGeometry(1, 1);
  private readonly sunDir = new Vector3(0.4, 0.8, 0.3);
  private readonly fogColor = new Color(0x8eb4d0);
  private readonly dayFactor = { value: 1 };
  private readonly fogNear = { value: 500 };
  private readonly fogFar = { value: 7500 };
  private readonly mats: ShaderMaterial[] = [];
  private readonly fallback: CanvasTexture;
  private readonly clusters: Cluster[] = [];
  private loaded: Texture[] = [];

  constructor() {
    this.group.name = "CloudField";
    this.fallback = fallbackTexture();
    const loader = new TextureLoader();
    const maps = [this.fallback, this.fallback];
    this.mats.push(this.makeMaterial(maps[0]!), this.makeMaterial(maps[1]!));

    loader.load("/sky/cloud_a.png?v=round", (tex) => {
      this.loaded.push(prepareMap(tex));
      this.mats[0]!.uniforms.map!.value = tex;
    });
    loader.load("/sky/cloud_b.png?v=round", (tex) => {
      this.loaded.push(prepareMap(tex));
      this.mats[1]!.uniforms.map!.value = tex;
    });

    for (let i = 0; i < CLUSTERS; i++) {
      this.clusters.push(this.makeCluster(i));
    }
    this.seed(0, 0);
  }

  /** Scatter a first ring around the jet so the sky is not empty at spawn. */
  seed(wx: number, wz: number): void {
    for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i]!;
      const near = i < 8;
      this.place(cluster, wx, wz, i * 19.7, near ? SPAWN_NEAR : 2800, near ? 4200 : SPAWN_FAR);
    }
  }

  update(
    dt: number,
    wx: number,
    wz: number,
    dayFactor: number,
    sun: { x: number; y: number; z: number },
    fog: { color: Color; near: number; far: number },
  ): void {
    this.dayFactor.value = dayFactor;
    this.sunDir.set(sun.x, sun.y, sun.z);
    this.fogColor.copy(fog.color);
    this.fogNear.value = fog.near;
    this.fogFar.value = fog.far;

    for (let i = 0; i < this.clusters.length; i++) {
      const cluster = this.clusters[i]!;
      cluster.x += cluster.vx * dt;
      cluster.z += cluster.vz * dt;
      const dx = cluster.x - wx;
      const dz = cluster.z - wz;
      if (dx * dx + dz * dz > RECYCLE * RECYCLE) {
        this.place(cluster, wx, wz, i * 13.1 + cluster.x * 0.001, 5400, SPAWN_FAR);
      }
      cluster.group.position.set(cluster.x, cluster.y, cluster.z);
    }
  }

  dispose(): void {
    this.geo.dispose();
    for (const mat of this.mats) mat.dispose();
    this.fallback.dispose();
    for (const tex of this.loaded) tex.dispose();
  }

  private makeMaterial(map: Texture): ShaderMaterial {
    const mat = new ShaderMaterial({
      uniforms: {
        map: { value: map },
        sunDir: { value: this.sunDir },
        dayFactor: this.dayFactor,
        fogColor: { value: this.fogColor },
        fogNear: this.fogNear,
        fogFar: this.fogFar,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: NormalBlending,
      premultipliedAlpha: true,
      fog: false,
      toneMapped: false,
    });
    return mat;
  }

  private makeCluster(index: number): Cluster {
    const group = new Group();
    group.name = `Cloud${index}`;
    const puffs = 6 + Math.floor(hash(index + 3) * 4);
    for (let i = 0; i < puffs; i++) {
      const mat = this.mats[(index + i) % this.mats.length]!;
      const mesh = new Mesh(this.geo, mat);
      mesh.frustumCulled = true;
      mesh.raycast = () => {};
      const ang = hash(index * 17 + i * 5) * Math.PI * 2;
      const rad = hash(index * 9 + i * 3) * 0.28;
      mesh.position.set(
        Math.cos(ang) * rad,
        (hash(index * 4 + i) - 0.5) * 0.5,
        Math.sin(ang) * rad,
      );
      const s = 0.55 + hash(index + i * 11) * 0.62;
      mesh.scale.set(s, s, 1);
      mesh.rotation.y = hash(index + i * 13) * Math.PI;
      mesh.rotation.x = (hash(index * 8 + i * 2) - 0.5) * 0.4;
      group.add(mesh);
    }
    const span = (220 + hash(index * 21) * 260) * 1.25;
    group.scale.setScalar(span);
    this.group.add(group);
    return { group, x: 0, z: 0, y: 800, vx: 0, vz: 0 };
  }

  private place(cluster: Cluster, wx: number, wz: number, salt: number, minR: number, maxR: number): void {
    const ang = hash(salt + 1.3) * Math.PI * 2;
    const dist = minR + hash(salt + 4.7) * (maxR - minR);
    cluster.x = wx + Math.cos(ang) * dist;
    cluster.z = wz + Math.sin(ang) * dist;
    cluster.y = 460 + hash(salt + 8.2) * 1100;
    const wind = 6 + hash(salt + 2.2) * 8;
    const wobble = (hash(salt + 6.4) - 0.5) * 0.35;
    cluster.vx = Math.cos(0.55 + wobble) * wind;
    cluster.vz = Math.sin(0.55 + wobble) * wind;
    cluster.group.position.set(cluster.x, cluster.y, cluster.z);
  }
}
