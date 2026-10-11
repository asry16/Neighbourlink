"use client";

import * as maplibregl from "maplibre-gl";
import type * as THREE_NS from "three";
import type { PrecipKind } from "@/lib/weather";

/** Shared with walk-mode so it can re-add the layer after a style swap. */
export const WALKER_LAYER_ID = "nl-walkers-3d";

/** Rendered height on screen, so figures stay readable at any zoom. */
const TARGET_HEIGHT_PX = 90;
const BODY_HEIGHT_M = 1.75;
/** Characters farther than this from the camera centre aren't drawn. */
const DRAW_RADIUS_M = 4000;

export interface WalkerPose {
  lat: number;
  lng: number;
  /** Compass heading, degrees clockwise from north. */
  heading: number;
  /** 0 idle, 1 walking, >1 running; negative when stepping backward. */
  gait: number;
}

export interface WalkerWeather {
  precip: PrecipKind;
  /** 0 night to 1 bright clear day; dims the lighting. */
  daylight: number;
  /** Poor air: everyone wears a face mask. */
  mask?: boolean;
}

export interface Crowd3D {
  layer: maplibregl.CustomLayerInterface;
  /** Add or move a character; `color` is their outfit (hex). */
  upsert: (id: string, pose: WalkerPose, color: string) => void;
  remove: (id: string) => void;
  /** Local weather applies to everyone in view. */
  setWeather: (weather: WalkerWeather) => void;
  dispose: () => void;
}

/**
 * Low-poly people drawn into MapLibre's 3D scene with three.js. Built from
 * primitives (no model download) and animated procedurally; one layer and
 * one renderer for the whole crowd.
 */
export async function createCrowd3D(map: maplibregl.Map): Promise<Crowd3D> {
  const THREE = await import("three");

  let weather: WalkerWeather = { precip: "none", daylight: 1 };
  let lastFrame = performance.now();

  // Shared geometry / materials; only outfit colours differ per person.
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const mat = (color: number | string, extra: THREE_NS.MeshStandardMaterialParameters = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra }));

  const G = {
    torso: track(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12)),
    head: track(new THREE.SphereGeometry(0.12, 16, 12)),
    hair: track(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    nose: track(new THREE.SphereGeometry(0.025, 8, 6)),
    mask: track(new THREE.SphereGeometry(0.105, 14, 8, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 2, Math.PI / 3.2)),
    bag: track(new THREE.BoxGeometry(0.28, 0.34, 0.14)),
    leg: track(new THREE.CapsuleGeometry(0.07, 0.72, 4, 10)),
    arm: track(new THREE.CapsuleGeometry(0.05, 0.5, 4, 10)),
    foot: track(new THREE.BoxGeometry(0.11, 0.07, 0.24)),
    shaft: track(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6)),
    canopy: track(new THREE.ConeGeometry(0.8, 0.32, 16, 1, true)),
    shadow: track(new THREE.CircleGeometry(0.42, 24)),
  };
  const M = {
    skin: mat(0xc99a72),
    trousers: mat(0x2b3448),
    shoes: mat(0x1b1b1f),
    hair: mat(0x241a14),
    bag: mat(0x3c4a5c),
    raincoat: mat(0xf2c230, { roughness: 0.35 }),
    winterCoat: mat(0x2f5fa8, { roughness: 0.9 }),
    mask: mat(0xf4f6f8, { side: THREE.DoubleSide, roughness: 0.9 }),
    canopy: mat(0xd6453d, { side: THREE.DoubleSide, roughness: 0.5 }),
    shadow: track(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })),
  };
  const shirts = new Map<string, THREE_NS.MeshStandardMaterial>();
  const shirtFor = (color: string) => {
    let m = shirts.get(color);
    if (!m) shirts.set(color, (m = mat(color)));
    return m;
  };

  interface Character {
    root: THREE_NS.Group;
    body: THREE_NS.Group;
    torso: THREE_NS.Mesh;
    sleeves: THREE_NS.Mesh[];
    legs: [THREE_NS.Group, THREE_NS.Group];
    arms: [THREE_NS.Group, THREE_NS.Group];
    umbrella: THREE_NS.Group;
    faceMask: THREE_NS.Mesh;
    shirt: THREE_NS.MeshStandardMaterial;
    pose: WalkerPose;
    phase: number;
  }

  const scene = new THREE.Scene();
  const sky = new THREE.HemisphereLight(0xffffff, 0x5a6070, 1.6);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 6, 4);
  scene.add(sky, sun);
  const camera = new THREE.Camera();
  let renderer: THREE_NS.WebGLRenderer | null = null;
  const characters = new Map<string, Character>();

  const build = (color: string, pose: WalkerPose): Character => {
    const shirt = shirtFor(color);
    const body = new THREE.Group();
    const torso = new THREE.Mesh(G.torso, shirt);
    torso.position.y = 1.24;
    const head = new THREE.Mesh(G.head, M.skin);
    head.position.y = 1.66;
    const hair = new THREE.Mesh(G.hair, M.hair);
    hair.position.y = 1.68;
    hair.rotation.x = -0.25;
    // Nose and backpack make the facing direction obvious from any angle.
    const nose = new THREE.Mesh(G.nose, M.skin);
    nose.position.set(0, 1.65, 0.12);
    const faceMask = new THREE.Mesh(G.mask, M.mask);
    faceMask.position.set(0, 1.66, 0.025);
    faceMask.scale.setScalar(1.12);
    faceMask.visible = false;
    const bag = new THREE.Mesh(G.bag, M.bag);
    bag.position.set(0, 1.28, -0.22);
    body.add(torso, head, hair, nose, faceMask, bag);

    const limb = (
      geometry: THREE_NS.BufferGeometry,
      material: THREE_NS.Material,
      x: number,
      y: number,
      len: number,
      r: number
    ) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = -(len / 2 + r);
      pivot.add(mesh);
      body.add(pivot);
      return pivot;
    };
    const legs: [THREE_NS.Group, THREE_NS.Group] = [
      limb(G.leg, M.trousers, -0.1, 0.92, 0.72, 0.07),
      limb(G.leg, M.trousers, 0.1, 0.92, 0.72, 0.07),
    ];
    for (const leg of legs) {
      const foot = new THREE.Mesh(G.foot, M.shoes);
      foot.position.set(0, -0.9, 0.05);
      leg.add(foot);
    }
    const arms: [THREE_NS.Group, THREE_NS.Group] = [
      limb(G.arm, shirt, -0.25, 1.46, 0.5, 0.05),
      limb(G.arm, shirt, 0.25, 1.46, 0.5, 0.05),
    ];

    const umbrella = new THREE.Group();
    const shaft = new THREE.Mesh(G.shaft, M.shoes);
    shaft.position.y = 0.6;
    const canopy = new THREE.Mesh(G.canopy, M.canopy);
    canopy.position.y = 1.25;
    umbrella.add(shaft, canopy);
    umbrella.position.set(0.28, 1.05, 0.12);
    umbrella.visible = false;
    body.add(umbrella);

    const shadow = new THREE.Mesh(G.shadow, M.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;

    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    root.add(body, shadow);
    scene.add(root);
    return {
      root,
      body,
      torso,
      sleeves: arms.map((a) => a.children[0] as THREE_NS.Mesh),
      legs,
      arms,
      umbrella,
      faceMask,
      shirt,
      pose,
      phase: Math.random() * Math.PI * 2,
    };
  };

  const animate = (c: Character, dt: number) => {
    const raining = weather.precip === "rain" || weather.precip === "drizzle" || weather.precip === "hail";
    const speed = Math.abs(c.pose.gait);
    const swing = Math.min(speed, 1) * (speed > 1 ? 0.85 : 0.6);
    c.phase += dt * (speed > 1 ? 13 : speed > 0 ? 8.5 : 0) * Math.sign(c.pose.gait || 1);
    const s = Math.sin(c.phase);
    c.legs[0].rotation.x = s * swing;
    c.legs[1].rotation.x = -s * swing;
    c.arms[0].rotation.x = -s * swing * 0.8;
    // The umbrella hand stays up.
    c.arms[1].rotation.x = raining ? -1.1 : s * swing * 0.8;
    c.arms[1].rotation.z = raining ? 0.25 : 0;
    c.body.position.y = speed > 0 ? Math.abs(s) * 0.05 : Math.sin(performance.now() / 600 + c.phase) * 0.008;
    c.body.rotation.x = speed > 1 ? 0.12 : 0;
    const top = raining ? M.raincoat : weather.precip === "snow" ? M.winterCoat : c.shirt;
    c.torso.material = top;
    c.sleeves.forEach((m) => (m.material = top));
    c.umbrella.visible = raining;
    c.faceMask.visible = !!weather.mask;
  };

  // Reused per frame to avoid allocations.
  const tmp = {
    origin: new THREE.Matrix4(),
    flip: new THREE.Matrix4().makeRotationX(Math.PI / 2),
    turn: new THREE.Matrix4(),
    scale: new THREE.Vector3(),
  };

  const layer: maplibregl.CustomLayerInterface = {
    id: WALKER_LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      if (!renderer) return;
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      sky.intensity = 0.55 + weather.daylight * 1.05;
      sun.intensity = 0.25 + weather.daylight * 1.35;

      // Everything is placed relative to the camera centre for precision.
      const centre = map.getCenter();
      const o = maplibregl.MercatorCoordinate.fromLngLat(centre, 0);
      const metresPerPx = (40075016.686 * Math.cos((centre.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      const exaggeration = Math.max(1, (TARGET_HEIGHT_PX * metresPerPx) / BODY_HEIGHT_M);
      const cosLat = Math.cos((centre.lat * Math.PI) / 180);

      for (const c of characters.values()) {
        const dx = (c.pose.lng - centre.lng) * 111_320 * cosLat;
        const dy = (c.pose.lat - centre.lat) * 111_320;
        c.root.visible = Math.hypot(dx, dy) < DRAW_RADIUS_M;
        if (!c.root.visible) continue;
        animate(c, dt);
        const p = maplibregl.MercatorCoordinate.fromLngLat([c.pose.lng, c.pose.lat], 0);
        const s = p.meterInMercatorCoordinateUnits() * exaggeration;
        // Scene x = east, y = up, z = south (after the X rotation and y flip).
        c.root.matrix
          .makeTranslation(p.x - o.x, p.y - o.y, (p.z ?? 0) - (o.z ?? 0))
          .scale(tmp.scale.set(s, -s, s))
          .multiply(tmp.flip)
          .multiply(tmp.turn.makeRotationY(Math.PI - (c.pose.heading * Math.PI) / 180));
        c.root.matrixWorldNeedsUpdate = true;
      }

      tmp.origin.makeTranslation(o.x, o.y, o.z ?? 0);
      camera.projectionMatrix
        .fromArray(args.defaultProjectionData.mainMatrix as unknown as number[])
        .multiply(tmp.origin);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };

  return {
    layer,
    upsert: (id, pose, color) => {
      const c = characters.get(id);
      if (!c) {
        characters.set(id, build(color, pose));
        return;
      }
      c.pose = pose;
      c.shirt = shirtFor(color);
    },
    remove: (id) => {
      const c = characters.get(id);
      if (c) {
        scene.remove(c.root);
        characters.delete(id);
      }
    },
    setWeather: (next) => {
      weather = next;
    },
    dispose: () => {
      characters.forEach((c) => scene.remove(c.root));
      characters.clear();
      disposables.forEach((d) => d.dispose());
      renderer = null;
    },
  };
}
