"use client";

import React, { useEffect, useRef } from "react";
import type { PrecipKind, WeatherScene } from "@/lib/weather";

interface Particle {
  x: number;
  y: number;
  len: number;
  speed: number;
  size: number;
  phase: number;
}

interface Splash {
  x: number;
  y: number;
  age: number;
  hail: boolean;
}

interface Blob {
  x: number;
  y: number;
  r: number;
}

const MAX_PARTICLES = 900;
/** Values ease toward their targets so weather changes fade, not snap. */
const EASE_PER_S = 0.8;

const approach = (cur: number, target: number, dt: number) =>
  cur + (target - cur) * Math.min(1, dt * EASE_PER_S * 2);

/**
 * Screen-space weather over the 3D map: cloud shadows, sun glare, night,
 * fog haze, rain / drizzle / snow / hail, wind streaks and lightning. Driven
 * by a WeatherScene; motion follows the real wind relative to the camera.
 */
export function WeatherOverlay({
  scene,
  getBearing,
  smog = 0,
}: {
  scene: WeatherScene;
  getBearing: () => number;
  /** Air-pollution haze, 0..1 (from the India AQI category). */
  smog?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef(scene);
  const bearingRef = useRef(getBearing);
  useEffect(() => {
    sceneRef.current = scene;
    bearingRef.current = getBearing;
  }, [scene, getBearing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const spawn = (anywhere: boolean): Particle => ({
      x: Math.random() * (width + 240) - 120,
      y: anywhere ? Math.random() * height : -40 - Math.random() * 80,
      len: 0.6 + Math.random() * 0.8,
      speed: 0.7 + Math.random() * 0.6,
      size: 0.6 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    });
    const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => spawn(true));
    const splashes: Splash[] = [];
    const streaks: Particle[] = Array.from({ length: 40 }, () => spawn(true));
    const clouds: Blob[] = Array.from({ length: 6 }, () => ({
      x: Math.random() * 1.4 - 0.2,
      y: 0.25 + Math.random() * 0.75,
      r: 0.25 + Math.random() * 0.25,
    }));
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.2,
      r: 0.5 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
    }));

    // Eased state; precipitation fades out before a kind switch.
    const cur = { precip: 0, cloud: 0, night: 0, wind: 0 };
    let kind: PrecipKind = "none";

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const s = sceneRef.current;

      const targetPrecip = s.precip === kind ? s.precipIntensity : 0;
      cur.precip = approach(cur.precip, targetPrecip, dt);
      if (s.precip !== kind && cur.precip < 0.02) kind = s.precip;
      cur.cloud = approach(cur.cloud, s.cloudCover, dt);
      cur.night = approach(cur.night, s.isDay ? 0 : 1, dt);
      cur.wind = approach(cur.wind, s.windKmh, dt);

      // Horizontal screen drift from the real wind seen from this bearing.
      const towardDeg = s.windFromDeg + 180 - bearingRef.current();
      const driftDir = Math.sin((towardDeg * Math.PI) / 180);
      const drift = driftDir * Math.min(cur.wind, 70) * 9;

      ctx.clearRect(0, 0, width, height);

      // Stars on clear nights, in the sky band above the horizon.
      const starAlpha = cur.night * Math.max(0, 1 - cur.cloud * 1.4);
      if (starAlpha > 0.02) {
        for (const st of stars) {
          ctx.globalAlpha = starAlpha * (0.55 + 0.45 * Math.sin(t * 2 + st.phase));
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(st.x * width, st.y * height, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Drifting cloud shadows on the ground (daytime, broken cloud).
      const shadowStrength = (1 - cur.night) * cur.cloud * (1 - Math.max(0, cur.cloud - 0.85) * 4) * 0.16;
      if (shadowStrength > 0.01) {
        const cloudDrift = (driftDir || 0.3) * Math.max(cur.wind, 8) * 1.2;
        for (const c of clouds) {
          c.x += (cloudDrift * dt) / width;
          if (c.x > 1.4) c.x = -0.4;
          if (c.x < -0.4) c.x = 1.4;
          const cx = c.x * width;
          const cy = c.y * height;
          const r = c.r * Math.max(width, height);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(10, 16, 28, ${shadowStrength})`);
          g.addColorStop(1, "rgba(10, 16, 28, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }

      // Precipitation.
      const count = Math.round(MAX_PARTICLES * (reduceMotion ? 0.3 : 1) * cur.precip);
      if (count > 0) {
        if (kind === "rain" || kind === "drizzle") {
          const drizzle = kind === "drizzle";
          ctx.lineCap = "round";
          ctx.strokeStyle = `rgba(205, 222, 245, ${(drizzle ? 0.25 : 0.3) + cur.precip * 0.3})`;
          ctx.lineWidth = drizzle ? 0.8 : 1 + cur.precip * 0.6;
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const p = particles[i];
            const vy = p.speed * (drizzle ? 650 : 1100 + cur.precip * 400);
            const len = p.len * (drizzle ? 9 : 24);
            p.y += vy * dt;
            p.x += drift * dt;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - (drift / vy) * len, p.y - len);
            if (p.y > height) {
              if (!drizzle && Math.random() < 0.35)
                splashes.push({ x: p.x, y: height * (0.45 + Math.random() * 0.55), age: 0, hail: false });
              particles[i] = spawn(false);
            } else if (p.x < -140 || p.x > width + 140) particles[i] = spawn(false);
          }
          ctx.stroke();
        } else if (kind === "snow") {
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          for (let i = 0; i < count; i++) {
            const p = particles[i];
            p.y += p.speed * 90 * dt;
            p.x += (drift * 0.5 + Math.sin(t * 1.3 + p.phase) * 22) * dt;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1 + p.size * 2.2, 0, Math.PI * 2);
            ctx.fill();
            if (p.y > height || p.x < -140 || p.x > width + 140) particles[i] = spawn(false);
          }
        } else if (kind === "hail") {
          ctx.fillStyle = "rgba(240, 246, 255, 0.95)";
          for (let i = 0; i < count; i++) {
            const p = particles[i];
            const vy = p.speed * 1300;
            p.y += vy * dt;
            p.x += drift * 1.1 * dt;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.4 + p.size * 1.4, 0, Math.PI * 2);
            ctx.fill();
            if (p.y > height) {
              if (Math.random() < 0.5)
                splashes.push({ x: p.x, y: height * (0.45 + Math.random() * 0.55), age: 0, hail: true });
              particles[i] = spawn(false);
            } else if (p.x < -140 || p.x > width + 140) particles[i] = spawn(false);
          }
        }
      }

      // Rain rings and bouncing hail on the ground.
      for (let i = splashes.length - 1; i >= 0; i--) {
        const sp = splashes[i];
        sp.age += dt;
        const life = sp.hail ? 0.35 : 0.3;
        if (sp.age > life) {
          splashes.splice(i, 1);
          continue;
        }
        const k = sp.age / life;
        ctx.globalAlpha = 1 - k;
        if (sp.hail) {
          ctx.fillStyle = "#f2f6ff";
          ctx.beginPath();
          ctx.arc(sp.x + k * 6, sp.y - Math.sin(k * Math.PI) * 14, 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const r = 2 + sp.age * 22;
          ctx.strokeStyle = "rgba(215, 228, 248, 0.55)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, r, r * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (splashes.length > 300) splashes.splice(0, splashes.length - 300);

      // Wind streaks once it's breezy enough to notice.
      const windAlpha = Math.min(Math.max((cur.wind - 18) / 40, 0), 1) * (reduceMotion ? 0.4 : 1);
      if (windAlpha > 0.02) {
        const dir = driftDir >= 0 ? 1 : -1;
        const speed = Math.max(Math.abs(drift), cur.wind * 6) * dir;
        ctx.strokeStyle = cur.night > 0.5 ? "rgba(200, 210, 230, 0.12)" : "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const n = Math.round(streaks.length * windAlpha);
        for (let i = 0; i < n; i++) {
          const st = streaks[i];
          st.x += speed * st.speed * 1.4 * dt;
          const len = 60 + st.len * 120;
          const y = st.y + Math.sin(t * 2 + st.phase) * 6;
          ctx.moveTo(st.x, y);
          ctx.lineTo(st.x - len * dir, y);
          if (st.x > width + 200 || st.x < -200) {
            streaks[i] = { ...spawn(true), x: dir > 0 ? -150 : width + 150 };
          }
        }
        ctx.stroke();
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  // Lightning: an occasional double flash during thunderstorms.
  useEffect(() => {
    const el = flashRef.current;
    if (!scene.thunder || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const strike = () => {
      el.animate(
        [{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0.1 }, { opacity: 0.4 }, { opacity: 0 }],
        { duration: 650, easing: "ease-out" }
      );
      timer = setTimeout(strike, 6000 + Math.random() * 9000);
    };
    timer = setTimeout(strike, 2500);
    return () => clearTimeout(timer);
  }, [scene.thunder]);

  const wet = scene.precip === "none" ? 0 : 0.3 + scene.precipIntensity * 0.4;
  const overcast = scene.isDay ? Math.max(0, scene.cloudCover - 0.5) * 0.5 : 0;
  const glare = scene.isDay ? Math.max(0, 1 - scene.cloudCover * 1.6) : 0;
  const tint = "transition-opacity duration-[1500ms] absolute inset-0";

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Night */}
      <div
        className={tint}
        style={{
          background: "linear-gradient(to bottom, rgb(4 8 22 / 0.7), rgb(8 14 30 / 0.45) 40%, rgb(8 14 30 / 0.55))",
          opacity: scene.isDay ? 0 : 1,
        }}
      />
      {/* Overcast grey and wet gloom */}
      <div className={tint} style={{ background: "rgb(70 78 90 / 0.5)", opacity: overcast }} />
      <div
        className={tint}
        style={{
          background: "linear-gradient(to bottom, rgb(20 28 42 / 0.55), rgb(20 28 42 / 0.15) 55%, rgb(20 28 42 / 0.3))",
          opacity: wet,
        }}
      />
      {/* Fog haze, thickest toward the horizon */}
      <div
        className={tint}
        style={{
          background: scene.isDay
            ? "linear-gradient(to bottom, rgb(222 226 230 / 0.95), rgb(215 220 225 / 0.55) 45%, rgb(215 220 225 / 0.3))"
            : "linear-gradient(to bottom, rgb(60 66 76 / 0.9), rgb(50 56 66 / 0.5) 45%, rgb(50 56 66 / 0.3))",
          opacity: scene.fog,
        }}
      />
      {/* Sun glare on clear days; a warm cast in a heatwave */}
      <div
        className={tint}
        style={{
          background: "radial-gradient(circle at 85% 0%, rgb(255 228 160 / 0.45), rgb(255 228 160 / 0) 55%)",
          opacity: glare,
        }}
      />
      <div className={tint} style={{ background: "rgb(255 140 50 / 0.12)", opacity: scene.hot ? 1 : 0 }} />
      {/* Smog: brown-grey haze, densest at the horizon */}
      <div
        className={tint}
        style={{
          background:
            "linear-gradient(to bottom, rgb(150 128 96 / 0.85), rgb(140 122 98 / 0.45) 50%, rgb(120 108 92 / 0.25))",
          opacity: smog,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div ref={flashRef} className="absolute inset-0 bg-white opacity-0" />
    </div>
  );
}
