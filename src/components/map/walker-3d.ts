"use client";

import * as maplibregl from "maplibre-gl";
import type * as THREE_NS from "three";
import type { PrecipKind } from "@/lib/weather";

/** Shared with walk-mode so it can re-add the layer after a style swap. */
export const WALKER_LAYER_ID = "nl-walker-3d";

/** Rendered height on screen, so the figure stays readable at any zoom. */
const TARGET_HEIGHT_PX = 90;
const BODY_HEIGHT_M = 1.75;

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
  /** 0 night to 1 bright clear day; dims the character's lighting. */
  daylight: number;
}

export interface Walker3D {
  layer: maplibregl.CustomLayerInterface;
  setPose: (pose: WalkerPose) => void;
  setWeather: (weather: WalkerWeather) => void;
  dispose: () => void;
}

/**
 * A low-poly person drawn into MapLibre's 3D scene with three.js. Built from
 * primitives (no model download) and animated procedurally.
 */
export async function createWalker3D(map: maplibregl.Map, start: WalkerPose): Promise<Walker3D> {
  const THREE = await import("three");

  let pose = { ...start };
  let weather: WalkerWeather = { precip: "none", daylight: 1 };
  let phase = 0;
  let lastFrame = performance.now();

  // --- Character (metres, y-up, facing +z) ---------------------------------
  const disposables: { dispose: () => void }[] = [];
  const mat = (color: number, extra: THREE_NS.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
    disposables.push(m);
    return m;
  };
  const geo = <G extends THREE_NS.BufferGeometry>(g: G) => {
    disposables.push(g);
    return g;
  };

  const skin = mat(0xc99a72);
  const shirt = mat(0x1f8f8a);
  const raincoat = mat(0xf2c230, { roughness: 0.35 });
  const winterCoat = mat(0x2f5fa8, { roughness: 0.9 });
  const trousers = mat(0x2b3448);
  const shoes = mat(0x1b1b1f);
  const hair = mat(0x241a14);
  const bag = mat(0x3c4a5c);

  const body = new THREE.Group();

  const torso = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.17, 0.42, 4, 12)), shirt);
  torso.position.y = 1.24;
  body.add(torso);

  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.12, 16, 12)), skin);
  head.position.y = 1.66;
  body.add(head);

  const hairCap = new THREE.Mesh(
    geo(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
    hair
  );
  hairCap.position.y = 1.68;
  hairCap.rotation.x = -0.25;
  body.add(hairCap);

  // Nose and backpack make the facing direction obvious from any angle.
  const nose = new THREE.Mesh(geo(new THREE.SphereGeometry(0.025, 8, 6)), skin);
  nose.position.set(0, 1.65, 0.12);
  body.add(nose);
  const backpack = new THREE.Mesh(geo(new THREE.BoxGeometry(0.28, 0.34, 0.14)), bag);
  backpack.position.set(0, 1.28, -0.22);
  body.add(backpack);

  const limb = (radius: number, length: number, material: THREE_NS.Material, x: number, y: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(geo(new THREE.CapsuleGeometry(radius, length, 4, 10)), material);
    mesh.position.y = -(length / 2 + radius);
    pivot.add(mesh);
    body.add(pivot);
    return pivot;
  };

  const legL = limb(0.07, 0.72, trousers, -0.1, 0.92);
  const legR = limb(0.07, 0.72, trousers, 0.1, 0.92);
  for (const leg of [legL, legR]) {
    const foot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.11, 0.07, 0.24)), shoes);
    foot.position.set(0, -0.9, 0.05);
    leg.add(foot);
  }
  const armL = limb(0.05, 0.5, shirt, -0.25, 1.46);
  const armR = limb(0.05, 0.5, shirt, 0.25, 1.46);
  const sleeves = [armL, armR].map((pivot) => pivot.children[0] as THREE_NS.Mesh);

  // Umbrella, shown only in the rain; held in the right hand.
  const umbrella = new THREE.Group();
  const shaft = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6)), shoes);
  shaft.position.y = 0.6;
  const canopy = new THREE.Mesh(
    geo(new THREE.ConeGeometry(0.8, 0.32, 16, 1, true)),
    mat(0xd6453d, { side: THREE.DoubleSide, roughness: 0.5 })
  );
  canopy.position.y = 1.25;
  umbrella.add(shaft, canopy);
  umbrella.position.set(0.28, 1.05, 0.12);
  umbrella.visible = false;
  body.add(umbrella);

  const shadow = new THREE.Mesh(
    geo(new THREE.CircleGeometry(0.42, 24)),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
  );
  disposables.push(shadow.material as THREE_NS.Material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;

  const character = new THREE.Group();
  character.add(body, shadow);

  const scene = new THREE.Scene();
  scene.add(character);
  const sky = new THREE.HemisphereLight(0xffffff, 0x5a6070, 1.6);
  scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 6, 4);
  scene.add(sun);

  const camera = new THREE.Camera();
  let renderer: THREE_NS.WebGLRenderer | null = null;

  const animate = (dt: number) => {
    const raining = weather.precip === "rain" || weather.precip === "drizzle" || weather.precip === "hail";
    const speed = Math.abs(pose.gait);
    const swing = Math.min(speed, 1) * (speed > 1 ? 0.85 : 0.6);
    phase += dt * (speed > 1 ? 13 : speed > 0 ? 8.5 : 0) * Math.sign(pose.gait || 1);

    const s = Math.sin(phase);
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.8;
    // The umbrella hand stays up.
    armR.rotation.x = raining ? -1.1 : s * swing * 0.8;
    armR.rotation.z = raining ? 0.25 : 0;
    body.position.y = speed > 0 ? Math.abs(s) * 0.05 : Math.sin(performance.now() / 600) * 0.008;
    body.rotation.x = speed > 1 ? 0.12 : 0;
    const top = raining ? raincoat : weather.precip === "snow" ? winterCoat : shirt;
    torso.material = top;
    sleeves.forEach((sleeve) => (sleeve.material = top));
    umbrella.visible = raining;
    sky.intensity = 0.55 + weather.daylight * 1.05;
    sun.intensity = 0.25 + weather.daylight * 1.35;
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
      animate(Math.min((now - lastFrame) / 1000, 0.1));
      lastFrame = now;

      const origin = maplibregl.MercatorCoordinate.fromLngLat([pose.lng, pose.lat], 0);
      const metresPerPx =
        (40075016.686 * Math.cos((pose.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      const exaggeration = Math.max(1, (TARGET_HEIGHT_PX * metresPerPx) / BODY_HEIGHT_M);
      const scale = origin.meterInMercatorCoordinateUnits() * exaggeration;

      // Scene x = east, y = up, z = south (after the X rotation and y flip).
      character.rotation.y = Math.PI - (pose.heading * Math.PI) / 180;
      const model = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z ?? 0)
        .scale(new THREE.Vector3(scale, -scale, scale))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
      camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix as unknown as number[])
        .multiply(model);

      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };

  return {
    layer,
    setPose: (next) => {
      pose = next;
    },
    setWeather: (next) => {
      weather = next;
    },
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      renderer = null;
    },
  };
}
