import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
} from "three";

interface Craft {
  root: Group;
  radius: number;
  alt: number;
  speed: number;
  phase: number;
}

export class AirTraffic {
  readonly group = new Group();
  private crafts: Craft[] = [];
  private mat = new MeshBasicMaterial({
    color: new Color(0x1c1e24),
    transparent: true,
    opacity: 0.9,
  });

  constructor() {
    this.crafts.push(this.spawn(3200, 2400, 110, 0));
    this.crafts.push(this.spawn(4800, 3100, 72, 1));
  }

  private spawn(radius: number, alt: number, speed: number, kind: number): Craft {
    const root = new Group();
    if (kind === 0) {
      this.box(root, 1.2, 0.55, 5.5, 0, 0, 0);
      this.box(root, 7.5, 0.12, 2.2, 0, 0.05, -0.2);
    } else {
      this.box(root, 2.2, 2.0, 18, 0, 0, 0);
      this.box(root, 22, 0.25, 3.2, 0, 0.15, 0.5);
      this.box(root, 0.25, 3.2, 2, 0, 2.4, 7.5);
    }
    this.group.add(root);
    return {
      root,
      radius,
      alt,
      speed,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private box(
    parent: Group,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const m = new Mesh(new BoxGeometry(w, h, d), this.mat);
    m.position.set(x, y, z);
    parent.add(m);
  }

  update(dt: number, wx: number, wz: number): void {
    for (const c of this.crafts) {
      c.phase += (c.speed / c.radius) * dt;
      const x = wx + Math.cos(c.phase) * c.radius;
      const z = wz + Math.sin(c.phase) * c.radius;
      c.root.position.set(x, c.alt, z);
      c.root.rotation.y = -c.phase + Math.PI * 0.5;
    }
  }

  /** World positions for free-flight radar blips. */
  contacts(): Array<{ x: number; y: number; z: number }> {
    return this.crafts.map((c) => ({
      x: c.root.position.x,
      y: c.root.position.y,
      z: c.root.position.z,
    }));
  }

  dispose(): void {
    this.mat.dispose();
    this.group.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
  }
}
