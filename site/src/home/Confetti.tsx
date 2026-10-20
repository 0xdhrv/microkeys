import { type CSSProperties, useEffect, useRef } from "react";
import { PartyPopper } from "lucide-react";

/* ══ Confetti ═════════════════════════════════════════════
   One button. Press it and a burst of paper leaves the top of it,
   climbs, spreads, and drifts down across the block, flipping as it
   goes.

   ── PAPER, NOT PARTICLES ────────────────────────────────
   Each piece is thrown up at an angle inside the spread, then air
   takes the speed off it and gravity takes over; once it is falling
   it slows to a drift and sways side to side. It also FLIPS: a
   strip of paper turning over shows its edge, so each piece's
   height is the cosine of its own spin. That flip is most of what
   makes it read as confetti rather than as dots.

   ── IT COSTS NOTHING AT REST ────────────────────────────
   The canvas is drawn only while a piece is still in the air; the
   loop stops on the frame the last one leaves, so a wall holding
   several of these runs nothing until one is pressed. Presses
   stack: a second burst joins the first.

   ── COLOUR, OR MONO ─────────────────────────────────────
   Mono is ink and paper, like the rest of the bench: the theme's
   own ink, read off the block, at a handful of strengths — black
   and greys in light, white and greys in dark. It reads as a
   celebration without pulling the eye off every other block.
   It ships in colour — confetti is the one block where colour is
   the point — and Mono is the switch.

   ── DRIVEN FROM OUTSIDE (added for microkeys) ───────────
   `trigger` bursts whenever it changes, so a keybinding can set it
   off; `button={false}` drops the pill and throws from the middle of
   the block instead. `width` and `height` size the block, so a burst
   can cover a wide demo without being clipped at 300px. */

/* tight to what a burst needs: the wall draws a block by its longest
   side, so air here was the button drawn small on the wall */
const W = 300;
const H = 280;

/* mono is the ink at these strengths */
const MONO = [1, 0.78, 0.55, 0.36, 0.2];
/* cheerful, and every colour at about the same lightness, so a burst
   reads as one palette rather than a box of crayons: coral, amber,
   teal, blue, violet, pink. Full-strength brights read as a
   children's party; muted earths read as a wake */
const COLOUR = ["#ff6f45", "#ffb21a", "#22c49a", "#3d9ef5", "#8d6cf6", "#f2588f"];

/* the shapes a burst is cut from, and how often each turns up:
   paper, mostly — strips and squares — with dots and the odd curled
   ribbon. Stars, moons, zigzags and the rest were tried and made it
   a children's party */
const KINDS = [
  ["strip", 44], ["square", 26], ["dot", 18], ["curl", 12],
] as const;
type Kind = (typeof KINDS)[number][0];
const TOTAL = KINDS.reduce((a, [, w]) => a + w, 0);
const pickKind = (): Kind => {
  let r = Math.random() * TOTAL;
  for (const [k, w] of KINDS) { if ((r -= w) < 0) return k; }
  return "strip";
};

/* every piece carries a number of its own, v (0..1), that bends its
   shape — a strip's length and width, a square's size, a curl's
   swing — so no two in a burst come out the same */
type Piece = {
  x: number; y: number; vx: number; vy: number;
  spin: number; vspin: number; turn: number; vturn: number;
  s: number; v: number; kind: Kind; color: string; alpha: number; sway: number;
};

/* one piece, centred on the origin, about s across */
const draw = (g: CanvasRenderingContext2D, p: Piece) => {
  const s = p.s, h = s / 2, v = p.v;
  g.beginPath();
  switch (p.kind) {
    case "strip": {
      const w = s * (0.35 + v * 0.3), l = s * (1.1 + v * 1.1);
      g.fillRect(-w / 2, -l / 2, w, l); return;
    }
    case "square": { const a = s * (0.75 + v * 0.35); g.fillRect(-a / 2, -a / 2, a, a); return; }
    case "dot": g.arc(0, 0, h * (0.6 + v * 0.35), 0, Math.PI * 2); g.fill(); return;
    case "curl": {
      /* a short ribbon with a turn in it, swung one way or the other */
      const k = (v < 0.5 ? -1 : 1) * (0.6 + Math.abs(v - 0.5) * 1.4);
      g.lineWidth = s * 0.22; g.lineCap = "round";
      g.moveTo(-s, 0); g.bezierCurveTo(-s * 0.4, -s * k, s * 0.4, s * k, s, 0); g.stroke(); return;
    }
  }
};

export function Confetti({
  amount = 90, spread = 90, palette = "Colour",
  trigger, button = true, width: W_ = W, height: H_ = H,
}: {
  amount?: number; spread?: number; palette?: string;
  trigger?: number; button?: boolean; width?: number; height?: number;
}) {
  const W = W_, H = H_;
  const canvas = useRef<HTMLCanvasElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pieces = useRef<Piece[]>([]);
  const raf = useRef(0);
  const side = useRef(1);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const loop = () => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(3, (now - prev) / 16.67);
      prev = now;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const live: Piece[] = [];
      for (const p of pieces.current) {
        /* air first, then gravity; a falling piece settles to a drift */
        p.vx *= Math.pow(0.965, dt);
        p.vy = p.vy * Math.pow(0.975, dt) + 0.26 * dt;
        if (p.vy > 2.4) p.vy = 2.4 + (p.vy - 2.4) * Math.pow(0.9, dt);
        p.sway += 0.06 * dt;
        p.x += (p.vx + Math.sin(p.sway) * (p.vy > 0 ? 0.6 : 0)) * dt;
        p.y += p.vy * dt;
        p.spin += p.vspin * dt;
        p.turn += p.vturn * dt;
        if (p.y - 20 > H || p.x < -40 || p.x > W + 40) continue;
        live.push(p);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.spin);
        /* the flip: a strip turning over shows its edge */
        g.scale(1, Math.cos(p.turn));
        g.fillStyle = g.strokeStyle = p.color;
        g.globalAlpha = p.alpha;
        draw(g, p);
        g.restore();
      }
      pieces.current = live;
      if (live.length) raf.current = requestAnimationFrame(tick);
      else { g.clearRect(0, 0, W, H); raf.current = 0; }
    };
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };

  const burst = () => {
    const b = btn.current, c = canvas.current;
    if (!c) return;
    /* from the top of the button, in the block's own pixels. The button
       is mid-block, so the throw is softer than a burst from the foot
       of it: the peak stays inside the frame */
    let ox = W / 2, oy = H / 2;
    if (b) {
      const cr = c.getBoundingClientRect(), br = b.getBoundingClientRect();
      const k = cr.width / W || 1;
      ox = (br.left + br.width / 2 - cr.left) / k;
      oy = (br.top - cr.top) / k + 4;
    }
    const mono = palette !== "Colour";
    const ink = getComputedStyle(c).color;
    const half = (spread / 2) * (Math.PI / 180);
    for (let i = 0; i < amount; i++) {
      const a = -Math.PI / 2 + (Math.random() * 2 - 1) * half;
      const v = 5.5 + Math.random() * 5.5;
      const kind = pickKind();
      pieces.current.push({
        x: ox + (Math.random() - 0.5) * 24, y: oy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        spin: Math.random() * Math.PI, vspin: (Math.random() - 0.5) * 0.3,
        turn: Math.random() * Math.PI, vturn: 0.08 + Math.random() * 0.14,
        s: 9 + Math.random() * 5, v: Math.random(), kind,
        color: mono ? ink : COLOUR[Math.floor(Math.random() * COLOUR.length)],
        alpha: mono ? MONO[Math.floor(Math.random() * MONO.length)] : 1,
        sway: Math.random() * Math.PI * 2,
      });
    }
    loop();
    if (!b) return;
    /* the button hops: up with a tilt, back past level, a squash on
       landing. It leans the other way each press, and the animation is
       restarted rather than queued, so a quick double press hops twice */
    side.current = -side.current;
    b.style.setProperty("--cft-side", String(side.current));
    b.removeAttribute("data-hop");
    void b.offsetWidth;
    b.setAttribute("data-hop", "");
  };

  /* a change after mount, not the value it mounts with */
  const seen = useRef(trigger);
  useEffect(() => {
    if (trigger === seen.current) return;
    seen.current = trigger;
    burst();
  });

  return (
    <div className="cft" data-bare={button ? undefined : ""} style={{ width: W, height: H } as CSSProperties}>
      <canvas ref={canvas} className="cft-canvas" style={{ width: W, height: H }} aria-hidden="true" />
      {button && (
        <button ref={btn} type="button" className="cft-btn" onClick={burst}
          onAnimationEnd={(e) => e.currentTarget.removeAttribute("data-hop")}>
          <PartyPopper size={18} strokeWidth={2} aria-hidden="true" />
          Celebrate
        </button>
      )}
    </div>
  );
}
