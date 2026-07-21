"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/*
 * CaptureOrb — the hero capture surface rendered as a cinematic, candlelit ember
 * field. A tokenized radial base (behind) keeps a luminous ORB identity even before
 * the canvas paints / if canvas is unavailable; a single DPR-aware canvas draws the
 * embers with additive glow on top. All colour comes from the domain tokens at
 * runtime (invariant #4 — no hardcoded hex): warm ochre from --dom-money, cool tint
 * from --dom-skills / --dom-health. The reserved XP amber never appears here.
 *
 * Export interface is frozen so CaptureLauncher / CaptureSheet need zero changes.
 * Decorative only (aria-hidden) — the pressable button owns the a11y.
 */

type RGB = { r: number; g: number; b: number };

/** Parse a token value (hex or rgb()) read from CSS custom properties into RGB.
 * No hex literals here — the string is always the runtime-resolved token value. */
function parseColor(raw: string): RGB {
  const v = raw.trim();
  if (v.startsWith("#")) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const n = Number.parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m = v.match(/[\d.]+/g);
  if (m && m.length >= 3) return { r: Number(m[0]), g: Number(m[1]), b: Number(m[2]) };
  return { r: 255, g: 255, b: 255 }; // safe fallback if a token is missing
}

const rgba = (c: RGB, a: number) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;
/** Lighten toward white for the warm glow highlight (keeps it token-derived). */
const lighten = (c: RGB, f: number): RGB => ({ r: c.r + (255 - c.r) * f, g: c.g + (255 - c.g) * f, b: c.b + (255 - c.b) * f });

interface Ember {
  a: number;    // base orbital angle
  r: number;    // base radius as a fraction of the orb radius
  spd: number;  // angular drift (rad/s, signed for cw/ccw)
  bs: number;   // radial "breath" speed
  br: number;   // radial breath amplitude
  tw: number;   // twinkle speed
  ph: number;   // phase offset
  size: number; // sprite size as a fraction of the orb radius
  alpha: number;// base opacity
  sprite: number;
}

/** ~34 embers, warm-biased: mostly money-ochre, a few cool skills/health. */
function makeEmbers(): Ember[] {
  const arr: Ember[] = [];
  for (let i = 0; i < 34; i++) {
    const warm = Math.random() < 0.72;
    const sprite = warm ? (Math.random() < 0.5 ? 0 : 1) : (Math.random() < 0.6 ? 2 : 3);
    arr.push({
      a: Math.random() * Math.PI * 2,
      r: 0.24 + Math.random() * 0.66,
      spd: (0.12 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
      bs: 0.5 + Math.random() * 1.2,
      br: 0.02 + Math.random() * 0.07,
      tw: 1.2 + Math.random() * 2.4,
      ph: Math.random() * Math.PI * 2,
      size: 0.05 + Math.random() * 0.11,
      alpha: 0.45 + Math.random() * 0.5,
      sprite,
    });
  }
  return arr;
}

/** Pre-render a soft radial dot sprite in the given token colour (cheap to blit). */
function makeSprite(c: RGB): HTMLCanvasElement {
  const S = 48;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const sc = cv.getContext("2d");
  if (!sc) return cv;
  const g = sc.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, rgba(c, 1));
  g.addColorStop(0.35, rgba(c, 0.6));
  g.addColorStop(0.7, rgba(c, 0.18));
  g.addColorStop(1, rgba(c, 0));
  sc.fillStyle = g;
  sc.fillRect(0, 0, S, S);
  return cv;
}

export function CaptureOrb({ state = "idle", level = 0, active = false, className = "" }: { state?: "idle" | "listening" | "thinking"; level?: number; active?: boolean; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props for the animation loop to read without restarting it.
  const stateRef = useRef<"idle" | "listening" | "thinking">(state === "thinking" || active ? "thinking" : state);
  const levelRef = useRef(0);
  const smoothedRef = useRef(0);
  const reduceRef = useRef(false);
  const drawRef = useRef<((t: number) => void) | null>(null);
  const reduce = useReducedMotion() ?? false;

  // Mirror props into refs (one-frame lag is fine for the loop; avoids re-mounting it).
  useEffect(() => {
    stateRef.current = state === "thinking" || active ? "thinking" : state;
    levelRef.current = Math.max(0, Math.min(1, level || 0));
  }, [state, level, active]);
  useEffect(() => { reduceRef.current = reduce; }, [reduce]);

  // Setup: size the canvas (DPR-aware), read tokens, build sprites, define the frame
  // painter. Re-reads tokens on (re)mount and on resize so themes/dark-light are correct.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d"); // null in non-DOM/SSR test envs — bail safely
    if (!ctx) return;

    const embers = makeEmbers();
    let sprites: HTMLCanvasElement[] = [];
    let warm: RGB = { r: 255, g: 255, b: 255 };
    let warmLight: RGB = warm;
    let cool: RGB = warm;
    let W = 0;
    let H = 0;
    let DPR = 1;

    function readTokens() {
      const cs = getComputedStyle(document.documentElement);
      const money = parseColor(cs.getPropertyValue("--dom-money"));
      const skills = parseColor(cs.getPropertyValue("--dom-skills"));
      const health = parseColor(cs.getPropertyValue("--dom-health"));
      warm = money;
      warmLight = lighten(money, 0.45);
      cool = skills;
      // Sprite palette: warm, warm-highlight, cool-skills, cool-health.
      sprites = [makeSprite(money), makeSprite(lighten(money, 0.55)), makeSprite(skills), makeSprite(health)];
    }

    function measure() {
      const rect = container!.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = W * DPR;
      canvas!.height = H * DPR;
      readTokens();
    }

    function drawFrame(t: number) {
      if (W === 0 || H === 0 || sprites.length < 4) return;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0); // draw in CSS px; canvas is device-scaled
      ctx!.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) / 2;
      const st = stateRef.current;
      const thinking = st === "thinking";
      const listening = st === "listening";
      const lvl = smoothedRef.current;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);

      // Central breath glow (additive) — warm core with a cool inner tint. Flares with
      // the voice while listening, and pulses steadily while thinking.
      ctx!.globalCompositeOperation = "lighter";
      const glowI = thinking ? 0.34 + 0.16 * pulse : listening ? 0.26 + lvl * 0.5 : 0.2;
      const glowR = R * (thinking ? 0.55 + 0.06 * pulse : listening ? 0.6 + lvl * 0.28 : 0.6);
      const g = ctx!.createRadialGradient(cx, cy - R * 0.04, 0, cx, cy - R * 0.04, glowR);
      g.addColorStop(0, rgba(warmLight, 0.9 * glowI));
      g.addColorStop(0.45, rgba(warm, 0.5 * glowI));
      g.addColorStop(0.75, rgba(cool, 0.22 * glowI));
      g.addColorStop(1, rgba(warm, 0));
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);

      // Ember particles (additive glow). Intensity/orbit speed are state-driven.
      const speed = thinking ? 0.7 : listening ? 0.55 + lvl * 1.1 : 0.4;
      const bright = thinking ? 0.6 + 0.2 * pulse : listening ? 0.5 + lvl * 0.6 : 0.42;
      for (const p of embers) {
        const twinkle = 0.55 + 0.45 * Math.sin(t * p.tw + p.ph);
        let rf: number;
        if (thinking) {
          // Gather INWARD toward the core with a shared pulse — a "processing" feel.
          rf = p.r * (0.24 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.ph))) * 1.6;
        } else {
          const amp = p.br * (listening ? 1 + lvl * 2.4 : 1);
          const flare = listening ? lvl * 0.08 : 0; // embers breathe outward with volume
          rf = p.r + flare + amp * Math.sin(t * p.bs + p.ph);
        }
        rf = Math.max(0.05, Math.min(1.02, rf));
        const ang = p.a + t * p.spd * speed;
        const x = cx + Math.cos(ang) * rf * R;
        const y = cy + Math.sin(ang) * rf * R;
        const size = R * p.size * (0.75 + 0.5 * twinkle) * (listening ? 1 + lvl * 0.35 : 1);
        const sprite = sprites[p.sprite];
        if (!sprite) continue;
        ctx!.globalAlpha = Math.max(0, Math.min(1, p.alpha * bright * twinkle));
        ctx!.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
    }

    drawRef.current = drawFrame;
    measure();
    drawFrame(0); // paint one frame immediately so there is no blank flash

    // The box is a fixed Tailwind size per mount; only DPR/viewport changes matter.
    const onResize = () => {
      measure();
      if (reduceRef.current) drawFrame(0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      drawRef.current = null;
    };
  }, []);

  // Motion: a single rAF loop that eases `level` and repaints. Skipped entirely under
  // reduced-motion. Reads state/level from refs, so prop changes never restart it.
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      smoothedRef.current += (levelRef.current - smoothedRef.current) * 0.12; // ease, no jitter
      drawRef.current?.((now - start) / 1000);
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf); // cancelled on unmount
  }, [reduce]);

  // Reduced-motion parity: draw ONE static ember frame (no rAF, no orbiting),
  // redrawn once per state change so `thinking` still reads as a gathered cluster.
  useEffect(() => {
    if (!reduce) return;
    smoothedRef.current = 0;
    drawRef.current?.(0);
  }, [reduce, state, active]);

  return (
    <div ref={containerRef} className={`relative mx-auto h-24 w-24 ${className}`} aria-hidden>
      {/* Tokenized base identity behind the canvas — a warm ember core with a cool tint.
          Uses var() directly so it is theme-correct and visible even pre-paint. */}
      <div
        className="absolute inset-0 rounded-chip"
        style={{ background: "radial-gradient(circle at 50% 47%, var(--dom-money), transparent 64%)", opacity: 0.5 }}
      />
      <div
        className="absolute inset-[16%] rounded-chip"
        style={{ background: "radial-gradient(circle at 50% 44%, var(--dom-skills), var(--dom-health) 55%, transparent 74%)", opacity: 0.38, mixBlendMode: "screen" }}
      />
      {/* Cinematic ember field. */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
