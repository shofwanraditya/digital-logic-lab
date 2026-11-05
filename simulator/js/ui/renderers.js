/**
 * renderers.js — Komponen visual Canvas 2D & SVG untuk Digital Logic Lab:
 *   1. K-Map Grid + Group Loops (dengan indikator wrap-around)
 *   2. Gate-Level Logic Schematic (SOP AND-OR & NAND-only) dengan live signal probing
 *   3. 7-Segment LED Display (Common Cathode / Common Anode)
 *   4. Digital Timing Diagram / Logic Analyzer (CLK, RST, EN, DIR, Q0..Q3)
 */
(function (root) {
  'use strict';
  const D = root.DigitalLab;

  const GROUP_COLORS = [
    '#22d3ee', // cyan
    '#f59e0b', // amber
    '#a78bfa', // violet
    '#34d399', // emerald
    '#f472b6', // pink
    '#60a5fa', // blue
    '#fb7185', // rose
    '#facc15', // yellow
  ];

  function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /**
   * Gambar Karnaugh Map beserta loop grup hasil minimisasi di atas Canvas.
   * Mengembalikan fungsi `hitTest(x, y)` -> indeks minterm (atau null).
   */
  function drawKMapCanvas(canvas, numVars, values, solution, varNames, highlightMinterm = null) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.clearRect(0, 0, w, h);

    const lay = D.kmapLayout(numVars, varNames);
    const nRows = lay.rowGray.length;
    const nCols = lay.colGray.length;

    const padL = 82, padT = 64, padR = 24, padB = 24;
    const gridW = Math.min(w - padL - padR, 380);
    const gridH = Math.min(h - padT - padB, nRows === 2 ? 200 : 340);
    const cw = gridW / nCols;
    const ch = gridH / nRows;
    const ox = padL + (w - padL - padR - gridW) / 2;
    const oy = padT + (h - padT - padB - gridH) / 2;

    // Garis diagonal variabel di pojok kiri atas
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox - 58, oy - 44);
    ctx.lineTo(ox, oy);
    ctx.stroke();

    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText(lay.rowVars.join(''), ox - 28, oy - 10);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(lay.colVars.join(''), ox - 22, oy - 28);

    // Label kolom (Gray code)
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < nCols; c++) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(lay.colLabels[c], ox + (c + 0.5) * cw, oy - 20);
    }
    // Label baris
    for (let r = 0; r < nRows; r++) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(lay.rowLabels[r], ox - 24, oy + (r + 0.5) * ch);
    }

    // Sel K-Map
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const m = D.cellToMinterm(numVars, r, c);
        const x = ox + c * cw;
        const y = oy + r * ch;
        const v = values[m];

        ctx.fillStyle = m === highlightMinterm ? '#1e293b' : '#0b1220';
        ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = m === highlightMinterm ? '#38bdf8' : '#1e293b';
        ctx.lineWidth = m === highlightMinterm ? 2 : 1;
        ctx.strokeRect(x, y, cw, ch);

        // Indeks minterm kecil di pojok kanan bawah sel
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'right';
        ctx.fillText(`m${m}`, x + cw - 6, y + ch - 8);

        // Nilai sel (0, 1, X)
        ctx.font = 'bold 22px ui-monospace, monospace';
        ctx.textAlign = 'center';
        if (v === 1 || v === '1') ctx.fillStyle = '#22d3ee';
        else if (v === 'X' || v === 'x') ctx.fillStyle = '#f59e0b';
        else ctx.fillStyle = '#475569';
        ctx.fillText(String(v), x + cw / 2, y + ch / 2);
      }
    }

    // Loop kelompok implicant
    if (solution && solution.groups) {
      solution.groups.forEach((g, idx) => {
        const color = GROUP_COLORS[idx % GROUP_COLORS.length];
        const inset = 6 + (idx % 4) * 3.5;
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '18';
        ctx.lineWidth = 2.4;

        for (const rc of g.rects) {
          const x = ox + rc.c * cw + (rc.wrapLeft ? 0 : inset);
          const y = oy + rc.r * ch + (rc.wrapTop ? 0 : inset);
          const rw = rc.cSpan * cw - (rc.wrapLeft ? 0 : inset) - (rc.wrapRight ? 0 : inset);
          const rh = rc.rSpan * ch - (rc.wrapTop ? 0 : inset) - (rc.wrapBottom ? 0 : inset);
          const rad = 12;

          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, rw, rh, rad);
          else ctx.rect(x, y, rw, rh);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    return function hitTest(px, py) {
      if (px < ox || py < oy || px >= ox + gridW || py >= oy + gridH) return null;
      const c = Math.floor((px - ox) / cw);
      const r = Math.floor((py - oy) / ch);
      if (r < 0 || r >= nRows || c < 0 || c >= nCols) return null;
      return D.cellToMinterm(numVars, r, c);
    };
  }

  /**
   * Gambar skema rangkaian gerbang logika (SOP AND-OR) beserta status logika 0/1
   * untuk nilai input uji `testInput` (0..2^n-1).
   */
  function drawSchematicCanvas(canvas, solution, testInput = 0, nandOnly = false) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.clearRect(0, 0, w, h);

    const { numVars, varNames, groups, sopExpression } = solution;
    const wireColor = (bit) => (bit ? '#22d3ee' : '#334155');

    // Bus vertikal input (A, A', B, B', ...)
    const busX0 = 36;
    const busGap = 28;
    const topY = 44;
    const botY = h - 20;

    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';

    const varBits = {};
    for (let i = 0; i < numVars; i++) {
      const bit = (testInput >> (numVars - 1 - i)) & 1;
      const v = varNames[i];
      varBits[v] = bit;
      varBits[`${v}'`] = bit ^ 1;

      const xTrue = busX0 + i * 2 * busGap;
      const xComp = xTrue + busGap * 0.85;

      // Label input
      ctx.fillStyle = bit ? '#22d3ee' : '#94a3b8';
      ctx.fillText(`${v}=${bit}`, xTrue + 10, 20);

      // Garis bus asli
      ctx.strokeStyle = wireColor(bit);
      ctx.lineWidth = bit ? 2.2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(xTrue, topY);
      ctx.lineTo(xTrue, botY);
      ctx.stroke();

      // Garis bus komplemen (NOT)
      ctx.strokeStyle = wireColor(bit ^ 1);
      ctx.lineWidth = bit ^ 1 ? 2.2 : 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xComp, topY);
      ctx.lineTo(xComp, botY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(v, xTrue, topY - 6);
      ctx.fillText(`${v}'`, xComp, topY - 6);
    }

    const busCoords = {};
    for (let i = 0; i < numVars; i++) {
      const v = varNames[i];
      busCoords[v] = busX0 + i * 2 * busGap;
      busCoords[`${v}'`] = busCoords[v] + busGap * 0.85;
    }

    // Kasus konstan 0 atau 1
    const outVal = D.evaluateSOP(solution, testInput);
    if (sopExpression === '0' || sopExpression === '1') {
      ctx.font = 'bold 16px ui-monospace, monospace';
      ctx.fillStyle = outVal ? '#22d3ee' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`Output Konstan: Y = ${sopExpression}`, w * 0.62, h / 2);
      return;
    }

    const gateX = Math.max(busX0 + numVars * 2 * busGap + 36, w * 0.48);
    const orX = Math.min(w - 110, gateX + 145);
    const nG = groups.length;
    const availH = botY - topY - 20;

    const gateOutputs = [];

    groups.forEach((g, idx) => {
      const cy = topY + 12 + ((idx + 0.5) / nG) * availH;
      const gColor = GROUP_COLORS[idx % GROUP_COLORS.length];
      const termActive = ((testInput ^ g.bits) & ~g.mask) === 0 ? 1 : 0;
      const ins = g.inputs;

      // Kabel dari bus ke gerbang tingkat-1 (AND / NAND)
      ins.forEach((lit, k) => {
        const iy = cy + (k - (ins.length - 1) / 2) * 10;
        const bx = busCoords[lit];
        const bit = varBits[lit];

        // Titik solder pada bus
        ctx.fillStyle = wireColor(bit);
        ctx.beginPath();
        ctx.arc(bx, iy, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = wireColor(bit);
        ctx.lineWidth = bit ? 2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(bx, iy);
        ctx.lineTo(gateX, iy);
        ctx.stroke();
      });

      // Gambar body gerbang AND (atau buffer jika hanya 1 literal)
      const gw = 46, gh = Math.max(28, ins.length * 11 + 8);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = gColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gateX, cy - gh / 2);
      ctx.lineTo(gateX + gw * 0.5, cy - gh / 2);
      ctx.arc(gateX + gw * 0.5, cy, gh / 2, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(gateX, cy + gh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (nandOnly) {
        ctx.beginPath();
        ctx.arc(gateX + gw + 5, cy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = gColor;
      ctx.textAlign = 'center';
      ctx.fillText(g.term, gateX + gw * 0.45, cy + 4);

      gateOutputs.push({ x: gateX + gw + (nandOnly ? 10 : 0), y: cy, active: termActive });
    });

    // Gerbang tingkat-2 (OR / NAND) jika ada >1 grup
    const outY = (topY + botY) / 2;
    if (gateOutputs.length === 1) {
      const g0 = gateOutputs[0];
      ctx.strokeStyle = wireColor(g0.active);
      ctx.lineWidth = g0.active ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(w - 28, g0.y);
      ctx.stroke();
      drawOutputLED(ctx, w - 26, g0.y, outVal);
    } else {
      const orH = Math.min(90, Math.max(44, gateOutputs.length * 16));
      const orW = 52;
      gateOutputs.forEach((go, idx) => {
        const ty = outY + (idx - (gateOutputs.length - 1) / 2) * (orH / (gateOutputs.length + 0.5));
        const lineHigh = nandOnly ? !go.active : go.active;
        ctx.strokeStyle = wireColor(lineHigh ? 1 : 0);
        ctx.lineWidth = lineHigh ? 2.2 : 1.3;
        ctx.beginPath();
        ctx.moveTo(go.x, go.y);
        ctx.bezierCurveTo((go.x + orX) / 2, go.y, (go.x + orX) / 2, ty, orX + 8, ty);
        ctx.stroke();
      });

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      if (nandOnly) {
        // NAND gate kedua
        ctx.beginPath();
        ctx.moveTo(orX, outY - orH / 2);
        ctx.lineTo(orX + orW * 0.5, outY - orH / 2);
        ctx.arc(orX + orW * 0.5, outY, orH / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(orX, outY + orH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(orX + orW + 5, outY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // OR gate
        ctx.beginPath();
        ctx.moveTo(orX, outY - orH / 2);
        ctx.quadraticCurveTo(orX + orW * 0.65, outY - orH / 2, orX + orW, outY);
        ctx.quadraticCurveTo(orX + orW * 0.65, outY + orH / 2, orX, outY + orH / 2);
        ctx.quadraticCurveTo(orX + 14, outY, orX, outY - orH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      const endX = orX + orW + (nandOnly ? 10 : 0);
      ctx.strokeStyle = wireColor(outVal);
      ctx.lineWidth = outVal ? 2.6 : 1.5;
      ctx.beginPath();
      ctx.moveTo(endX, outY);
      ctx.lineTo(w - 28, outY);
      ctx.stroke();
      drawOutputLED(ctx, w - 26, outY, outVal);
    }
  }

  function drawOutputLED(ctx, x, y, val) {
    ctx.save();
    if (val) {
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = val ? '#22d3ee' : '#1e293b';
    ctx.strokeStyle = val ? '#a5f3fc' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillStyle = val ? '#082f49' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), x, y);
  }

  /**
   * Gambar 7-Segment Display interaktif pada Canvas.
   * @param {number[]} segBits array 7 elemen [a,b,c,d,e,f,g] (1 = segmen aktif)
   * @param {string|null} selectedSeg segmen yang sedang disorot ('a'..'g')
   */
  function drawSevenSegCanvas(canvas, segBits, selectedSeg = null) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const dw = Math.min(w * 0.46, 130);
    const dh = Math.min(h * 0.76, 220);
    const t = Math.max(12, dw * 0.15); // ketebalan segmen
    const x0 = cx - dw / 2, y0 = cy - dh / 2;
    const ym = cy;

    // Koordinat poligon tiap segmen a..g
    const polys = {
      a: [
        [x0 + t * 0.6, y0],
        [x0 + dw - t * 0.6, y0],
        [x0 + dw - t * 1.2, y0 + t],
        [x0 + t * 1.2, y0 + t],
      ],
      b: [
        [x0 + dw, y0 + t * 0.6],
        [x0 + dw, ym - t * 0.4],
        [x0 + dw - t, ym - t * 0.9],
        [x0 + dw - t, y0 + t * 1.2],
      ],
      c: [
        [x0 + dw, ym + t * 0.4],
        [x0 + dw, y0 + dh - t * 0.6],
        [x0 + dw - t, y0 + dh - t * 1.2],
        [x0 + dw - t, ym + t * 0.9],
      ],
      d: [
        [x0 + t * 1.2, y0 + dh - t],
        [x0 + dw - t * 1.2, y0 + dh - t],
        [x0 + dw - t * 0.6, y0 + dh],
        [x0 + t * 0.6, y0 + dh],
      ],
      e: [
        [x0, ym + t * 0.4],
        [x0 + t, ym + t * 0.9],
        [x0 + t, y0 + dh - t * 1.2],
        [x0, y0 + dh - t * 0.6],
      ],
      f: [
        [x0, y0 + t * 0.6],
        [x0 + t, y0 + t * 1.2],
        [x0 + t, ym - t * 0.9],
        [x0, ym - t * 0.4],
      ],
      g: [
        [x0 + t * 0.7, ym],
        [x0 + t * 1.2, ym - t * 0.55],
        [x0 + dw - t * 1.2, ym - t * 0.55],
        [x0 + dw - t * 0.7, ym],
        [x0 + dw - t * 1.2, ym + t * 0.55],
        [x0 + t * 1.2, ym + t * 0.55],
      ],
    };

    // Casing IC 7-segment
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx - dw * 0.72, cy - dh * 0.6, dw * 1.44, dh * 1.2, 14);
    else ctx.rect(cx - dw * 0.72, cy - dh * 0.6, dw * 1.44, dh * 1.2);
    ctx.fill();
    ctx.stroke();

    D.SEG_NAMES.forEach((name, idx) => {
      const on = !!segBits[idx];
      const pts = polys[name];
      ctx.save();
      if (on) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
      }
      ctx.fillStyle = on ? '#ef4444' : '#1e2433';
      ctx.strokeStyle = name === selectedSeg ? '#22d3ee' : on ? '#fca5a5' : '#262f42';
      ctx.lineWidth = name === selectedSeg ? 2.5 : 1;

      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Label huruf segmen
      const lx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const ly = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = on ? '#ffffff' : '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, lx, ly);
    });
  }

  /**
   * Gambar Timing Diagram (Logic Analyzer) untuk Synchronous 4-Bit Counter.
   */
  function drawTimingCanvas(canvas, history) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.clearRect(0, 0, w, h);

    const channels = [
      { key: 'clk', label: 'CLK', color: '#f59e0b' },
      { key: 'en', label: 'EN', color: '#94a3b8' },
      { key: 'dir', label: 'DIR (1=UP)', color: '#a78bfa' },
      { key: 'q0', label: 'Q0 (LSB)', color: '#22d3ee' },
      { key: 'q1', label: 'Q1', color: '#38bdf8' },
      { key: 'q2', label: 'Q2', color: '#60a5fa' },
      { key: 'q3', label: 'Q3 (MSB)', color: '#818cf8' },
    ];

    const padL = 88, padR = 16, padT = 26, padB = 18;
    const rowH = (h - padT - padB) / channels.length;
    const plotW = w - padL - padR;
    const n = Math.max(2, history.length);
    const stepW = plotW / Math.max(16, n - 1);

    // Garis vertikal tiap rising edge CLK
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < history.length; i++) {
      const x = padL + i * stepW;
      if (history[i].clk === 1 && (i === 0 || history[i - 1].clk === 0)) {
        ctx.beginPath();
        ctx.moveTo(x, padT - 10);
        ctx.lineTo(x, h - padB);
        ctx.stroke();

        // Nilai desimal counter di bagian atas saat rising edge
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.fillText(String(history[i].count), x + stepW * 0.5, 14);
      }
    }

    channels.forEach((ch, r) => {
      const yTop = padT + r * rowH + 6;
      const yBot = padT + (r + 1) * rowH - 6;

      // Label sinyal
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = ch.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.label, 10, (yTop + yBot) / 2);

      // Baseline tipis
      ctx.strokeStyle = '#151f32';
      ctx.beginPath();
      ctx.moveTo(padL, yBot);
      ctx.lineTo(w - padR, yBot);
      ctx.stroke();

      // Gelombang digital persegi (step)
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < history.length; i++) {
        const val = history[i][ch.key];
        const x0 = padL + i * stepW;
        const x1 = x0 + stepW;
        const y = val ? yTop : yBot;
        if (i === 0) {
          ctx.moveTo(x0, y);
        } else {
          const prevVal = history[i - 1][ch.key];
          const prevY = prevVal ? yTop : yBot;
          if (prevY !== y) ctx.lineTo(x0, y);
        }
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    });
  }

  root.DigitalLab = Object.assign(root.DigitalLab || {}, {
    GROUP_COLORS,
    drawKMapCanvas,
    drawSchematicCanvas,
    drawSevenSegCanvas,
    drawTimingCanvas,
  });
})(typeof self !== 'undefined' ? self : this);
