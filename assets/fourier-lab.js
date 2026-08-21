/* ====================================================================
   Shared helpers for the two Fourier labs (periodic-fourier.html and
   aperiodic-fourier.html): canvas primitives, DFT/DTFT maths, the
   fold-aware spectrum scaffolding, the winding plane, ruler rows,
   hover tooltips, freehand painting and ?preset= deep links.
   ==================================================================== */
window.FL = (function () {
  "use strict";
  const TAU = Math.PI * 2, PI = Math.PI;
  const C = {
    ink: "#1c2333", muted: "#6b7280", grid: "#e6e8ef", axis: "#aeb4c1",
    blue: "#2563eb", blueSoft: "#bcc5ec", cyan: "#0891b2", orange: "#ea580c", violet: "#4f46e5",
    curve: "#b4bac8", zero: "#cfd3dd", comb: "#9aa3b2",
    tintPos: "rgba(37,99,235,.06)", tintNeg: "rgba(8,145,178,.07)", keep: "rgba(79,70,229,.07)",
  };
  const $ = (id) => document.getElementById(id);

  /* ---------- canvas primitives ---------- */
  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function line(ctx, x1, y1, x2, y2, color = C.grid, width = 1, dash = []) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }
  function text(ctx, s, x, y, align = "center", color = C.muted, font = "11px system-ui") {
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
  }
  function dot(ctx, x, y, r, color, ring) {
    if (ring) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function hollow(ctx, x, y, r, color, width = 1.4) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
  function diamond(ctx, x, y, r, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke();
  }
  function gridFrame(ctx, p, w, y0, top) {
    for (let i = 0; i <= 4; i++) { const yy = top + i * (y0 - top) / 4; line(ctx, p.l, yy, w - p.r, yy, C.grid, 1); }
    line(ctx, p.l, y0, w - p.r, y0, C.axis, 1.2);
  }

  /* ---------- formatting ---------- */
  const piFrac = (w) => {
    const r = w / PI; if (Math.abs(r) < 1e-9) return "0";
    const s = r.toFixed(3).replace(/\.?0+$/, "");
    return (s === "1" ? "" : s === "-1" ? "−" : s.replace("-", "−")) + "π";
  };
  const fmtHz = (f) => {
    const a = Math.abs(f), sgn = f < 0 ? "−" : "";
    if (a >= 1e6) return sgn + (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + " MHz";
    if (a >= 1000) return sgn + (a / 1000).toFixed(2).replace(/\.?0+$/, "") + " kHz";
    if (a >= 10) return sgn + a.toFixed(0) + " Hz";
    return sgn + a.toFixed(2).replace(/\.?0+$/, "") + " Hz";
  };
  const fmtSec = (t) => t >= 1 ? t.toFixed(2).replace(/\.?0+$/, "") + " s" : t >= 1e-3 ? (t * 1e3).toFixed(2).replace(/\.?0+$/, "") + " ms" : (t * 1e6).toFixed(1).replace(/\.?0+$/, "") + " µs";
  const fmtC = (re, im, d = 3) => { const s = Math.abs(im) < 5e-4 ? "" : (im < 0 ? " − " : " + ") + Math.abs(im).toFixed(d) + "j"; return re.toFixed(d) + s; };

  /* ---------- maths ---------- */
  // M-point DFT of a real sequence (zero-padded if x is shorter than M).
  function dft(x, M) {
    const re = new Array(M), im = new Array(M), mag = new Array(M);
    for (let k = 0; k < M; k++) {
      let a = 0, b = 0;
      for (let n = 0; n < x.length; n++) { const th = -TAU * k * n / M; a += x[n] * Math.cos(th); b += x[n] * Math.sin(th); }
      re[k] = a; im[k] = b; mag[k] = Math.hypot(a, b);
    }
    return { re, im, mag };
  }
  function dtft(x, w) {
    let a = 0, b = 0;
    for (let n = 0; n < x.length; n++) { a += x[n] * Math.cos(w * n); b -= x[n] * Math.sin(w * n); }
    return { re: a, im: b, mag: Math.hypot(a, b) };
  }
  // Centroid of the wound points x[n]e^{-jωn}: (1/N)Σ — the DFS coefficient at ω = 2πk/N, X(e^{jω})/N in general.
  function centroidDisc(x, w) { const X = dtft(x, w); return { re: X.re / x.length, im: X.im / x.length }; }
  const binClass = (k, M) => k === 0 ? "dc" : (2 * k === M ? "nyq" : (k < M / 2 ? "pos" : "neg"));
  const binColor = (cls) => cls === "pos" ? C.blue : cls === "neg" ? C.cyan : C.ink;
  const describeBin = (cls, k, M) => cls === "dc" ? "dc" : cls === "nyq" ? "ω = π, the highest frequency" : cls === "pos" ? "positive frequency" : `negative frequency (k − M = ${k - M})`;

  /* ---------- the fold tints: positive half blue, negative half cyan ---------- */
  // segs: list of [a, b, negative?] in data units; px maps data→pixel
  function tints(ctx, px, top, y0, segs) {
    for (const [a, b, neg] of segs) { if (b <= a) continue; ctx.fillStyle = neg ? C.tintNeg : C.tintPos; ctx.fillRect(px(a), top, px(b) - px(a), y0 - top); }
  }

  /* ---------- ruler rows under a spectrum ---------- */
  // rows: [{name, items:[{x, label, color}]}] ; starts at y0 + 14, 22px apart
  function rulers(ctx, p, w, y0, rows) {
    rows.forEach((row, i) => {
      const yy = y0 + 14 + i * 22;
      text(ctx, row.name, p.l - 8, yy, "right", C.muted, "italic 11px Georgia");
      if (i > 0) line(ctx, p.l, yy - 11, w - p.r, yy - 11, C.grid, 1);
      for (const it of row.items) text(ctx, it.label, it.x, yy, "center", it.color || C.muted, (i === 0 ? "700 " : "") + "10px system-ui");
    });
  }

  /* ---------- the winding plane ---------- */
  // o = {R, path:[{re,im}] (continuous wound curve) | null, pts:[{re,im,n}], centroid:{re,im},
  //      arc: angle in radians (turn per sample, clockwise) | null, arcLabel, centroidLabel, n0, n1 labels}
  function windingPlane(ctx, w, h, o) {
    const cx = w / 2, cy = h / 2, s = Math.min(w, h) / 2 * 0.86 / o.R;
    const px = (re) => cx + re * s, py = (im) => cy - im * s;
    for (let k = 1; k <= 2; k++) { ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, k * o.R / 2.3 * s, 0, TAU); ctx.stroke(); }
    line(ctx, px(-o.R), cy, px(o.R), cy, C.axis, 1.1); line(ctx, cx, py(o.R), cx, py(-o.R), C.axis, 1.1);
    text(ctx, "Re", px(o.R) - 4, cy + 10, "right", C.muted, "italic 11px Georgia");
    text(ctx, "Im", cx + 8, py(o.R) + 8, "left", C.muted, "italic 11px Georgia");
    if (o.path && o.path.length) {
      ctx.beginPath(); o.path.forEach((q, i) => i ? ctx.lineTo(px(q.re), py(q.im)) : ctx.moveTo(px(q.re), py(q.im)));
      ctx.strokeStyle = o.pts ? C.curve : C.blue; ctx.lineWidth = o.pts ? 1.4 : 1.7; ctx.stroke();
    }
    const geom = [];
    if (o.pts && o.pts.length) {
      const r0 = o.pts[0], r1 = o.pts[1];
      if (o.arc !== null && r1) {
        line(ctx, cx, cy, px(r0.re), py(r0.im), "#c7cad7", 1, [3, 3]); line(ctx, cx, cy, px(r1.re), py(r1.im), "#c7cad7", 1, [3, 3]);
        const ra = Math.min(w, h) * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, ra, 0, o.arc, false); ctx.strokeStyle = C.violet; ctx.lineWidth = 2; ctx.stroke();
        const mid = o.arc / 2, rl = ra + 30; text(ctx, o.arcLabel || "", cx + rl * Math.cos(mid), cy + rl * Math.sin(mid), Math.cos(mid) >= 0 ? "left" : "right", C.violet, "700 11px system-ui");
      }
      const rad = Math.max(2.4, Math.min(4, 80 / o.pts.length));
      o.pts.forEach((q) => { const X = px(q.re), Y = py(q.im); dot(ctx, X, Y, rad, C.blue, true); geom.push({ n: q.n, x: X, y: Y, re: q.re, im: q.im }); });
      text(ctx, "n=0", px(r0.re) + 8, py(r0.im) - 9, "left", C.ink, "600 10px system-ui");
      if (r1) text(ctx, "n=1", px(r1.re) + (r1.re >= 0 ? 8 : -8), py(r1.im) + 10, r1.re >= 0 ? "left" : "right", C.ink, "600 10px system-ui");
    } else if (o.path && o.path.length) {
      dot(ctx, px(o.path[0].re), py(o.path[0].im), 3.2, C.blue, true);
      text(ctx, "t = 0", px(o.path[0].re) + 6, py(o.path[0].im) - 10, "left", C.ink, "600 10px system-ui");
    }
    if (o.centroid) {
      const c = o.centroid; line(ctx, cx, cy, px(c.re), py(c.im), C.orange, 2.2); dot(ctx, px(c.re), py(c.im), 6, C.orange, true);
      text(ctx, o.centroidLabel || "centroid", px(c.re), py(c.im) - 14, "center", C.orange, "700 11px system-ui");
    }
    return { geom, px, py };
  }

  /* ---------- interaction ---------- */
  // handler(mx, my, rect) -> {html, x, y} | null
  function bindHover(canvas, tip, handler, onLeave) {
    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect(); const r = handler(e.clientX - rect.left, e.clientY - rect.top, rect);
      if (!r) { tip.style.opacity = 0; return; }
      tip.innerHTML = r.html; tip.style.left = Math.max(r.pad || 90, Math.min(rect.width - (r.pad || 90), r.x)) + "px"; tip.style.top = Math.max(r.minY || 44, r.y) + "px"; tip.style.opacity = 1;
    });
    canvas.addEventListener("pointerleave", () => { tip.style.opacity = 0; if (onLeave) onLeave(); });
  }
  // Freehand painting: toIndex(mx,rect)->grid index|null, toValue(my,rect)->value, paint(i0,i1,v0,v1), done()
  function bindPaint(canvas, o) {
    let last = null;
    const at = (e) => { const rect = canvas.getBoundingClientRect(); const i = o.toIndex(e.clientX - rect.left, rect); return i === null ? null : { i, v: o.toValue(e.clientY - rect.top, rect) }; };
    canvas.addEventListener("pointerdown", (e) => {
      if (!o.enabled()) return; const q = at(e); if (!q) return;
      canvas.setPointerCapture(e.pointerId); last = q; o.paint(q.i, q.i, q.v, q.v);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!last || !o.enabled()) return; const q = at(e); if (!q) return;
      o.paint(last.i, q.i, last.v, q.v); last = q;
    });
    const end = (e) => { if (!last) return; last = null; try { canvas.releasePointerCapture(e.pointerId); } catch (_) { } if (o.done) o.done(); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  }
  // ?preset=tok-tok-…  → array of tokens
  function presetTokens() { const q = new URLSearchParams(location.search).get("preset"); return q ? q.split("-").filter(Boolean) : []; }
  // toggle chips: <button class="chip" data-toggle="name"> ; state[name] boolean
  function bindChips(container, state, onChange) {
    container.querySelectorAll("[data-toggle]").forEach((b) => {
      const sync = () => b.classList.toggle("on", !!state[b.dataset.toggle]);
      b.addEventListener("click", () => { state[b.dataset.toggle] = !state[b.dataset.toggle]; sync(); onChange(b.dataset.toggle); });
      sync();
    });
    return () => container.querySelectorAll("[data-toggle]").forEach((b) => b.classList.toggle("on", !!state[b.dataset.toggle]));
  }
  function bindSegmented(group, get, set) {
    const sync = () => group.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.value === String(get())));
    group.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { set(b.dataset.value); sync(); }));
    sync(); return sync;
  }

  return { TAU, PI, C, $, setupCanvas, line, text, dot, hollow, diamond, gridFrame, piFrac, fmtHz, fmtSec, fmtC, dft, dtft, centroidDisc, binClass, binColor, describeBin, tints, rulers, windingPlane, bindHover, bindPaint, presetTokens, bindChips, bindSegmented };
})();
