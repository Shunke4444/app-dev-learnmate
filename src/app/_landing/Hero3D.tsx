"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { w: "u" | "b"; t: string };

const CONVO: Msg[] = [
  { w: "u", t: "Explain Newton's third law" },
  {
    w: "b",
    t: "Every action has an equal and opposite reaction — push a wall, it pushes back just as hard.",
  },
  { w: "u", t: "Quiz me on it" },
  {
    w: "b",
    t: "When you jump off a small boat, which way does the boat move?",
  },
  { w: "u", t: "Backwards — reaction force" },
  {
    w: "b",
    t: "Correct! Your push sends the boat back; its push launches you forward.",
  },
  { w: "u", t: "Save this as a note" },
  {
    w: "b",
    t: "Saved to “Physics — Newton’s Laws.” Want a quiz next?",
  },
];

const SCREEN_W = 304;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function Hero3D() {
  const zoomRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const tagRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const islandRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLCanvasElement | null>(null);

  const pointerRef = useRef({ x: 0, y: 0 });
  const [revealCount, setRevealCount] = useState(0);
  const [webglOk, setWebglOk] = useState(false);
  // Gate the hero invisible until the first scroll-positioning frame has run,
  // so the un-zoomed initial state never flashes on load.
  const [ready, setReady] = useState(false);

  /* 3D buddy — head + eyes track pointer */
  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const THREE = await import("three");
        if (cancelled || !host) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
        });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        const W = () => window.innerWidth;
        const H = () => window.innerHeight;
        renderer.setSize(W(), H());
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 100);
        camera.position.z = 6;

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const dir = new THREE.DirectionalLight(0xffffff, 0.9);
        dir.position.set(3, 4, 6);
        scene.add(dir);
        const teal = new THREE.PointLight(0x34e0c4, 1.7, 40);
        teal.position.set(0, 0, 3.2);
        scene.add(teal);
        const lime = new THREE.PointLight(0xc8f65d, 0.7, 40);
        lime.position.set(-4, -2, 4);
        scene.add(lime);

        const buddy = new THREE.Group();
        scene.add(buddy);

        const headGeo = new THREE.SphereGeometry(1.7, 64, 64);
        const headMat = new THREE.MeshStandardMaterial({
          color: 0x0c100f,
          roughness: 0.32,
          metalness: 0.25,
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.scale.set(1.3, 0.95, 0.92);
        buddy.add(head);

        const eyeMat = new THREE.MeshStandardMaterial({
          color: 0x34e0c4,
          emissive: 0x34e0c4,
          emissiveIntensity: 1.6,
          roughness: 0.25,
        });
        const eyeGeo = new THREE.SphereGeometry(0.34, 32, 32);
        const mkEye = (x: number) => {
          const e = new THREE.Mesh(eyeGeo, eyeMat);
          e.scale.set(0.66, 1.55, 0.42);
          e.position.set(x, 0.06, 1.5);
          return e;
        };
        const eyeL = mkEye(-0.58);
        const eyeR = mkEye(0.58);
        buddy.add(eyeL);
        buddy.add(eyeR);

        const onResize = () => {
          camera.aspect = W() / H();
          camera.updateProjectionMatrix();
          renderer.setSize(W(), H());
        };
        window.addEventListener("resize", onResize);

        let raf = 0;
        const loop = (t: number) => {
          const s = t * 0.001;
          const { x: px, y: py } = pointerRef.current;
          buddy.rotation.y = px * 0.45 + Math.sin(s * 0.6) * 0.06;
          buddy.rotation.x = py * 0.28;
          buddy.position.y = Math.sin(s * 0.9) * 0.1;
          const ox = px * 0.55;
          const oy = -py * 0.36;
          eyeL.position.x = -0.58 + ox;
          eyeL.position.y = 0.06 + oy;
          eyeR.position.x = 0.58 + ox;
          eyeR.position.y = 0.06 + oy;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        setWebglOk(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          headGeo.dispose();
          headMat.dispose();
          eyeGeo.dispose();
          eyeMat.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch {
        /* WebGL unavailable — AI.png fallback stays */
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  /* pointer track (always on — feeds 3D and could feed CSS fallback) */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX / window.innerWidth - 0.5;
      pointerRef.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  /* glowing cursor trail — hero ambiance */
  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const N = 20;
    const pts = Array.from({ length: N }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    }));
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };

    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pts[0].x += (target.x - pts[0].x) * 0.34;
      pts[0].y += (target.y - pts[0].y) * 0.34;
      for (let i = 1; i < N; i++) {
        pts[i].x += (pts[i - 1].x - pts[i].x) * 0.34;
        pts[i].y += (pts[i - 1].y - pts[i].y) * 0.34;
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < N; i++) {
        const tt = 1 - i / N;
        const r = 8 * tt + 1;
        const col = i < 3 ? "200,246,93" : "52,224,196";
        ctx.beginPath();
        ctx.fillStyle = `rgba(${col},${0.3 * tt})`;
        ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  /* scroll-driven zoom + rotate + chat reveal */
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;
    let last = -1;

    const frame = () => {
      raf = 0;
      const zoom = zoomRef.current;
      const phone = phoneRef.current;
      const stage = stageRef.current;
      const tag = tagRef.current;
      const chat = chatRef.current;
      const island = islandRef.current;
      if (!zoom || !phone || !stage || !tag || !chat || !island) return;

      const r = zoom.getBoundingClientRect();
      const total = Math.max(1, zoom.offsetHeight - window.innerHeight);
      const p = clamp01(-r.top / total);

      const s0 = Math.min(7, Math.max(2.6, window.innerWidth / SCREEN_W));
      const zp = clamp01(p / 0.45);
      const ps = s0 + (1 - s0) * easeOut(zp);
      const tp = clamp01((p - 0.46) / 0.54);
      const ry = -24 * easeOut(tp);
      const rx = 7 * tp;

      if (!reduce) {
        phone.style.transform = `scale(${ps}) rotateY(${ry}deg) rotateX(${rx}deg)`;
        stage.style.transform = `scale(${ps / s0})`;
      } else {
        phone.style.transform = "scale(1)";
        stage.style.transform = "scale(1)";
      }

      stage.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.42) / 0.12));
      tag.style.opacity = reduce ? "0" : String(Math.max(0, 1 - p / 0.2));
      chat.style.opacity = reduce
        ? "1"
        : String(clamp01((p - 0.44) / 0.12));
      island.style.opacity = String(clamp01((p - 0.48) / 0.1));

      const mp = clamp01((p - 0.56) / 0.44);
      const n = reduce ? CONVO.length : Math.round(mp * CONVO.length);
      if (n !== last) {
        last = n;
        setRevealCount(n);
      }
      if (threadRef.current) {
        threadRef.current.scrollTop = threadRef.current.scrollHeight;
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(frame);
    };

    frame();
    setReady(true);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      ref={zoomRef}
      aria-label="Meet your learning buddy"
      className="relative z-[1] h-[500vh]"
    >
      <div
        className={`sticky top-0 h-screen overflow-hidden [perspective:1600px] transition-opacity duration-200 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* ambient background: faint grid + soft aurora (edges masked) */}
        <div
          aria-hidden
          className="lm-grid absolute inset-0 z-0 opacity-40"
          style={{
            WebkitMaskImage:
              "radial-gradient(circle at 50% 42%, #000 28%, transparent 74%)",
            maskImage:
              "radial-gradient(circle at 50% 42%, #000 28%, transparent 74%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 z-0"
          style={{
            background:
              "radial-gradient(900px circle at 50% 10%, rgba(52,224,196,0.10), transparent 55%), radial-gradient(760px circle at 84% 92%, rgba(201,167,245,0.09), transparent 55%)",
          }}
        />
        {/* glowing cursor trail (behind buddy + phone) */}
        <canvas
          ref={trailRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-[1]"
        />

        {/* 3D mascot stage — CSS bg of /AI.png is the WebGL-disabled fallback */}
        <div
          ref={stageRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] origin-center will-change-transform"
          style={{
            background: webglOk
              ? "none"
              : "center / contain no-repeat url(/AI.png)",
          }}
        >
          {/* Green backdrop glow behind the 3D logo. Rendered before the WebGL
              canvas (appended at runtime) so the buddy sits on top, with the
              halo showing through the transparent canvas. Scales + fades with
              the stage as you scroll into the phone. */}
          <div
            className="absolute left-1/2 top-1/2 h-[58vmin] w-[72vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(52,224,196,0.36), rgba(52,224,196,0.15) 46%, rgba(200,246,93,0.07) 66%, transparent 78%)",
              filter: "blur(10px)",
            }}
          />
        </div>

        {/* Tagline */}
        <div
          ref={tagRef}
          className="pointer-events-none absolute inset-x-0 bottom-[18vh] z-[6] text-center will-change-[opacity]"
        >
          <h1 className="text-balance px-6 text-[clamp(30px,4.4vw,54px)] font-bold tracking-[-0.02em]">
            Your <span className="text-teal">learning buddy</span>.
          </h1>
          <div
            className="mt-3.5 text-[11px] uppercase tracking-[0.22em] text-muted"
            style={{
              animation: "lm-drift 1.8s ease-in-out infinite",
            }}
          >
            move your mouse · scroll &darr;
          </div>
        </div>

        {/* Phone — starts huge (S0) and zooms to 1 as you scroll */}
        <div className="absolute inset-0 z-[3] grid place-items-center">
          <div
            ref={phoneRef}
            className="relative h-[700px] w-[332px] rounded-[58px] p-3.5 will-change-transform"
            style={{
              transformStyle: "preserve-3d",
              background:
                "linear-gradient(135deg,#525c61 0%,#20262a 20%,#0c1010 50%,#20262a 80%,#454f54 100%)",
              boxShadow:
                "0 60px 150px rgba(0,0,0,0.7), inset 0 0 0 2px rgba(255,255,255,0.07), inset 0 3px 8px rgba(255,255,255,0.14), inset 0 -3px 8px rgba(0,0,0,0.55)",
            }}
          >
            <PhoneSide className="-left-[3px] top-[150px] h-[30px]" />
            <PhoneSide className="-left-[3px] top-[192px] h-[52px]" />
            <PhoneSide className="-right-[3px] top-[176px] h-[64px]" />

            <div
              className="relative flex h-full w-full flex-col overflow-hidden rounded-[44px] bg-transparent"
              style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.85)" }}
            >
              <div
                ref={islandRef}
                aria-hidden
                className="absolute left-1/2 top-[13px] z-[15] h-[27px] w-[98px] -translate-x-1/2 rounded-2xl bg-black opacity-0"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[20] rounded-[44px]"
                style={{
                  background:
                    "linear-gradient(118deg, rgba(255,255,255,0.12) 0%, transparent 26%, transparent 72%, rgba(255,255,255,0.05) 100%)",
                  mixBlendMode: "screen",
                }}
              />

              <div
                ref={chatRef}
                className="absolute inset-0 z-[11] flex flex-col bg-bg opacity-0"
              >
                <div className="flex items-center justify-between px-[22px] pt-[15px] pb-0.5 text-[11px] font-semibold">
                  <span>9:41</span>
                  <span className="inline-flex">
                    <span className="inline-block h-[9px] w-4 rounded-[2px] border border-white/85 opacity-85" />
                  </span>
                </div>
                <div className="flex items-center gap-2.5 border-b border-white/5 px-[18px] pb-3 pt-1.5">
                  <Avatar />
                  <b className="text-sm">LearnMate</b>
                  <span className="ml-auto text-[10px] text-teal">
                    &#9679; online
                  </span>
                </div>
                <div
                  ref={threadRef}
                  className="flex flex-1 flex-col gap-2.5 overflow-hidden p-3 pb-0"
                >
                  {CONVO.map((m, i) => (
                    <Row key={i} m={m} shown={i < revealCount} />
                  ))}
                </div>
                <div className="flex items-center gap-2 px-[11px] pb-3.5 pt-2.5">
                  <div className="h-[34px] flex-1 rounded-full border border-white/5 bg-surface" />
                  <Mic />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneSide({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute w-1 rounded-[3px] ${className}`}
      style={{
        background: "linear-gradient(90deg,#1c2122,#4a5358)",
        boxShadow: "inset 0 0 3px rgba(0,0,0,0.6)",
      }}
    />
  );
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="relative h-[18px] w-7 shrink-0 rounded-[11px] bg-[#0a0d0c]"
    >
      <span
        className="absolute top-1 left-[7px] h-[9px] w-1 rounded-[3px] bg-teal"
        style={{ boxShadow: "0 0 7px var(--teal)" }}
      />
      <span
        className="absolute top-1 right-[7px] h-[9px] w-1 rounded-[3px] bg-teal"
        style={{ boxShadow: "0 0 7px var(--teal)" }}
      />
    </span>
  );
}

function Mic() {
  return (
    <span className="relative h-[34px] w-[34px] shrink-0 rounded-full bg-lime">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border-2 border-lime"
        style={{
          animation: "lm-pulse-ring 1.6s ease-out infinite",
        }}
      />
    </span>
  );
}

function Row({ m, shown }: { m: Msg; shown: boolean }) {
  return (
    <div
      className={`flex transition-[opacity,transform] duration-[400ms] ease-out ${
        m.w === "u" ? "justify-end" : ""
      } ${
        shown
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-3 scale-95 opacity-0"
      }`}
    >
      <div
        className={`max-w-[82%] rounded-[15px] px-3 py-2.5 text-xs leading-[1.35] ${
          m.w === "u"
            ? "rounded-br-[5px] bg-teal font-medium text-[#06120f]"
            : "rounded-bl-[5px] bg-surface2 text-foreground"
        }`}
      >
        {m.t}
      </div>
    </div>
  );
}

