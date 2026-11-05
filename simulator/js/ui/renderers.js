/**
 * renderers.js — Technical CAD / Blueprint Schematic Renderers untuk DLS-04 Workbench.
 * Menggunakan estetika lembar skematik teknik (kertas grid milimeter, tinta tegas,
 * simbol gerbang IEEE Std 91, tanpa efek neon/glow AI).
 */
(function (root) {
  'use strict';
  const D = root.DigitalLab;

  // Palet warna tinta teknik (kontras di atas kertas terang)
  const GROUP_COLORS = [
    '#b8332a', // crimson
    '#18588c', // blueprint blue
    '#1d6b42', // forest green
    '#8f4b00', // burnt amber
    '#6b2d7a', // plum
    '#006d77', // teal
    '#9b2226', // dark red
    '#3d405b', // slate
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

  /** Gambar grid kertas skematik tipis di latar belakang canvas. */
  function drawPaperGrid(ctx, w, h, step = 16) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f0eee8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  }

  /**
   * Gambar Karnaugh Map di atas lembar skematik.
   */
  function drawKMapCanvas(canvas, numVars, values, solution, varNames, highlightMinterm = null) {
    const { ctx, w, h } = setupHiDPI(canvas);
    drawPaperGrid(ctx, w, h, 16);

    const lay = D.kmapLayout(numVars, varNames);
    const nRows = lay.rowGray.length;
    const nCols = lay.colGray.length;

    const padL = 78, padT = 56, padR = 20, padB = 20;
    const gridW = Math.min(w - padL - padR, 370);
    const gridH = Math.min(h - padT - padB, nRows === 2 ? 190 : 240);
    const cw = gridW / nCols;
    const ch = gridH / nRows;
    const ox = Math.floor(padL + (w - padL - padR - gridW) / 2);
    const oy = Math.floor(padT + (h - padT - padB - gridH) / 2);

    // Garis pembagi variabel di pojok kiri atas
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ox - 52, oy - 38);
    ctx.lineTo(ox, oy);
    ctx.stroke();

    ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#18588c';
    ctx.textAlign = 'right';
    ctx.fillText(lay.rowVars.join(''), ox - 24, oy - 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b8332a';
    ctx.fillText(lay.colVars.join(''), ox - 18, oy - 24);

    // Label Gray code
    ctx.font = 'bold 13px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1b1d1e';
    for (let c = 0; c < nCols; c++) {
      ctx.fillText(lay.colLabels[c], ox + (c + 0.5) * cw, oy - 16);
    }
    for (let r = 0; r < nRows; r++) {
      ctx.fillText(lay.rowLabels[r], ox - 22, oy + (r + 0.5) * ch);
    }

    // Sel K-Map
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const m = D.cellToMinterm(numVars, r, c);
        const x = ox + c * cw;
        const y = oy + r * ch;
        const v = values[m];

        ctx.fillStyle = m === highlightMinterm ? '#eef5fb' : '#ffffff';
        ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = '#7c786c';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cw, ch);

        // Indeks minterm kecil
        ctx.font = '10px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = '#8c887c';
        ctx.textAlign = 'right';
        ctx.fillText(String(m), x + cw - 5, y + ch - 8);

        // Nilai sel
        ctx.font = 'bold 20px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = 'center';
        if (v === 1 || v === '1') ctx.fillStyle = '#111111';
        else if (v === 'X' || v === 'x') ctx.fillStyle = '#b56510';
        else ctx.fillStyle = '#b8b4a8';
        ctx.fillText(String(v), x + cw / 2, y + ch / 2);
      }
    }

    // Outer frame tebal
    ctx.strokeStyle = '#1b1d1e';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(ox, oy, gridW, gridH);

    // Loop kelompok implicant
    if (solution && solution.groups) {
      solution.groups.forEach((g, idx) => {
        const color = GROUP_COLORS[idx % GROUP_COLORS.length];
        const inset = 5 + (idx % 4) * 3.5;
        ctx.strokeStyle = color;
        ctx.fillStyle = color + '14';
        ctx.lineWidth = 2;

        for (const rc of g.rects) {
          const x = ox + rc.c * cw + (rc.wrapLeft ? 0 : inset);
          const y = oy + rc.r * ch + (rc.wrapTop ? 0 : inset);
          const rw = rc.cSpan * cw - (rc.wrapLeft ? 0 : inset) - (rc.wrapRight ? 0 : inset);
          const rh = rc.rSpan * ch - (rc.wrapTop ? 0 : inset) - (rc.wrapBottom ? 0 : inset);

          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, rw, rh, 6);
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
   * Gambar skema rangkaian gerbang logika gaya CAD / KiCad (hijau/merah/hitam di atas kertas grid).
   */
  function drawSchematicCanvas(canvas, solution, testInput = 0, nandOnly = false) {
    const { ctx, w, h } = setupHiDPI(canvas);
    drawPaperGrid(ctx, w, h, 14);

    const { numVars, varNames, groups, sopExpression } = solution;
    const wireColor = (bit) => (bit ? '#1d6b42' : '#7c786c');

    const busX0 = 32;
    const busGap = 26;
    const topY = 40;
    const botY = h - 16;

    ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';

    const varBits = {};
    const busCoords = {};
    for (let i = 0; i < numVars; i++) {
      const bit = (testInput >> (numVars - 1 - i)) & 1;
      const v = varNames[i];
      varBits[v] = bit;
      varBits[`${v}'`] = bit ^ 1;

      const xTrue = busX0 + i * 2 * busGap;
      const xComp = xTrue + busGap * 0.82;
      busCoords[v] = xTrue;
      busCoords[`${v}'`] = xComp;

      ctx.fillStyle = bit ? '#1d6b42' : '#444';
      ctx.fillText(`${v}=${bit}`, xTrue + 8, 16);

      ctx.strokeStyle = wireColor(bit);
      ctx.lineWidth = bit ? 2 : 1.1;
      ctx.beginPath();
      ctx.moveTo(xTrue, topY);
      ctx.lineTo(xTrue, botY);
      ctx.stroke();

      ctx.strokeStyle = wireColor(bit ^ 1);
      ctx.lineWidth = bit ^ 1 ? 2 : 1.1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xComp, topY);
      ctx.lineTo(xComp, botY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#5c5a52';
      ctx.fillText(v, xTrue, topY - 6);
      ctx.fillText(`${v}'`, xComp, topY - 6);
    }

    const outVal = D.evaluateSOP(solution, testInput);
    if (sopExpression === '0' || sopExpression === '1') {
      ctx.font = 'bold 14px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#1b1d1e';
      ctx.textAlign = 'center';
      ctx.fillText(`CONSTANT RAIL: Y = ${sopExpression}`, w * 0.62, h / 2);
      return;
    }

    const gateX = Math.max(busX0 + numVars * 2 * busGap + 30, w * 0.46);
    const orX = Math.min(w - 96, gateX + 135);
    const nG = groups.length;
    const availH = botY - topY - 16;

    const gateOutputs = [];

    groups.forEach((g, idx) => {
      const cy = topY + 8 + ((idx + 0.5) / nG) * availH;
      const gColor = GROUP_COLORS[idx % GROUP_COLORS.length];
      const termActive = ((testInput ^ g.bits) & ~g.mask) === 0 ? 1 : 0;
      const ins = g.inputs;

      ins.forEach((lit, k) => {
        const iy = cy + (k - (ins.length - 1) / 2) * 9;
        const bx = busCoords[lit];
        const bit = varBits[lit];

        // Junction dot
        ctx.fillStyle = wireColor(bit);
        ctx.beginPath();
        ctx.arc(bx, iy, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = wireColor(bit);
        ctx.lineWidth = bit ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.moveTo(bx, iy);
        ctx.lineTo(gateX, iy);
        ctx.stroke();
      });

      const gw = 44, gh = Math.max(26, ins.length * 10 + 8);
      ctx.fillStyle = '#faf9f5';
      ctx.strokeStyle = '#1b1d1e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(gateX, cy - gh / 2);
      ctx.lineTo(gateX + gw * 0.5, cy - gh / 2);
      ctx.arc(gateX + gw * 0.5, cy, gh / 2, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(gateX, cy + gh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (nandOnly) {
        ctx.fillStyle = '#faf9f5';
        ctx.beginPath();
        ctx.arc(gateX + gw + 4.5, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.font = 'bold 10.5px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = gColor;
      ctx.textAlign = 'center';
      ctx.fillText(g.term, gateX + gw * 0.45, cy + 3.5);

      gateOutputs.push({ x: gateX + gw + (nandOnly ? 9 : 0), y: cy, active: termActive });
    });

    const outY = (topY + botY) / 2;
    if (gateOutputs.length === 1) {
      const g0 = gateOutputs[0];
      ctx.strokeStyle = wireColor(g0.active);
      ctx.lineWidth = g0.active ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(w - 30, g0.y);
      ctx.stroke();
      drawOutputPin(ctx, w - 28, g0.y, outVal);
    } else {
      const orH = Math.min(84, Math.max(40, gateOutputs.length * 15));
      const orW = 48;
      gateOutputs.forEach((go, idx) => {
        const ty = outY + (idx - (gateOutputs.length - 1) / 2) * (orH / (gateOutputs.length + 0.5));
        const lineHigh = nandOnly ? !go.active : go.active;
        ctx.strokeStyle = wireColor(lineHigh ? 1 : 0);
        ctx.lineWidth = lineHigh ? 2 : 1.1;
        // Orthogonal routing (gaya skematik EDA, bukan kurva bezier)
        const midX = go.x + 14 + idx * 6;
        ctx.beginPath();
        ctx.moveTo(go.x, go.y);
        ctx.lineTo(midX, go.y);
        ctx.lineTo(midX, ty);
        ctx.lineTo(orX + 6, ty);
        ctx.stroke();
      });

      ctx.fillStyle = '#faf9f5';
      ctx.strokeStyle = '#1b1d1e';
      ctx.lineWidth = 1.6;
      if (nandOnly) {
        ctx.beginPath();
        ctx.moveTo(orX, outY - orH / 2);
        ctx.lineTo(orX + orW * 0.5, outY - orH / 2);
        ctx.arc(orX + orW * 0.5, outY, orH / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(orX, outY + orH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(orX + orW + 4.5, outY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(orX, outY - orH / 2);
        ctx.quadraticCurveTo(orX + orW * 0.65, outY - orH / 2, orX + orW, outY);
        ctx.quadraticCurveTo(orX + orW * 0.65, outY + orH / 2, orX, outY + orH / 2);
        ctx.quadraticCurveTo(orX + 12, outY, orX, outY - orH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      const endX = orX + orW + (nandOnly ? 9 : 0);
      ctx.strokeStyle = wireColor(outVal);
      ctx.lineWidth = outVal ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(endX, outY);
      ctx.lineTo(w - 30, outY);
      ctx.stroke();
      drawOutputPin(ctx, w - 28, outY, outVal);
    }
  }

  function drawOutputPin(ctx, x, y, val) {
    ctx.fillStyle = val ? '#1d6b42' : '#e2dfd7';
    ctx.strokeStyle = '#1b1d1e';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x - 11, y - 11, 22, 22);
    ctx.strokeRect(x - 11, y - 11, 22, 22);

    ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = val ? '#ffffff' : '#444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(val), x, y);
  }

  /**
   * Gambar 7-Segment Display bergaya komponen DIP fisik (tanpa neon blur berlebihan).
   */
  function drawSevenSegCanvas(canvas, segBits, selectedSeg = null) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.fillStyle = '#181a1c';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const dw = Math.min(w * 0.44, 120);
    const dh = Math.min(h * 0.74, 200);
    const t = Math.max(11, dw * 0.14);
    const x0 = cx - dw / 2, y0 = cy - dh / 2;
    const ym = cy;

    const polys = {
      a: [[x0 + t * 0.6, y0], [x0 + dw - t * 0.6, y0], [x0 + dw - t * 1.2, y0 + t], [x0 + t * 1.2, y0 + t]],
      b: [[x0 + dw, y0 + t * 0.6], [x0 + dw, ym - t * 0.4], [x0 + dw - t, ym - t * 0.9], [x0 + dw - t, y0 + t * 1.2]],
      c: [[x0 + dw, ym + t * 0.4], [x0 + dw, y0 + dh - t * 0.6], [x0 + dw - t, y0 + dh - t * 1.2], [x0 + dw - t, ym + t * 0.9]],
      d: [[x0 + t * 1.2, y0 + dh - t], [x0 + dw - t * 1.2, y0 + dh - t], [x0 + dw - t * 0.6, y0 + dh], [x0 + t * 0.6, y0 + dh]],
      e: [[x0, ym + t * 0.4], [x0 + t, ym + t * 0.9], [x0 + t, y0 + dh - t * 1.2], [x0, y0 + dh - t * 0.6]],
      f: [[x0, y0 + t * 0.6], [x0 + t, y0 + t * 1.2], [x0 + t, ym - t * 0.9], [x0, ym - t * 0.4]],
      g: [[x0 + t * 0.7, ym], [x0 + t * 1.2, ym - t * 0.55], [x0 + dw - t * 1.2, ym - t * 0.55], [x0 + dw - t * 0.7, ym], [x0 + dw - t * 1.2, ym + t * 0.55], [x0 + t * 1.2, ym + t * 0.55]],
    };

    // Casing fisik IC 7-segment abu-abu gelap dengan outline putih tipis
    ctx.fillStyle = '#222528';
    ctx.strokeStyle = '#484c52';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - dw * 0.7, cy - dh * 0.58, dw * 1.4, dh * 1.16);
    ctx.strokeRect(cx - dw * 0.7, cy - dh * 0.58, dw * 1.4, dh * 1.16);

    D.SEG_NAMES.forEach((name, idx) => {
      const on = !!segBits[idx];
      const pts = polys[name];
      ctx.fillStyle = on ? '#e03c28' : '#2d3136';
      ctx.strokeStyle = name === selectedSeg ? '#f5b700' : '#181a1c';
      ctx.lineWidth = name === selectedSeg ? 2 : 1;

      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const lx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const ly = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = on ? '#fff' : '#6c727a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, lx, ly);
    });
  }

  /**
   * Gambar Timing Diagram bergaya Logic Analyzer / Datasheet.
   */
  function drawTimingCanvas(canvas, history) {
    const { ctx, w, h } = setupHiDPI(canvas);
    drawPaperGrid(ctx, w, h, 16);

    const channels = [
      { key: 'clk', label: 'CLK', color: '#b8332a' },
      { key: 'en', label: 'EN', color: '#5c5a52' },
      { key: 'dir', label: 'DIR', color: '#5c5a52' },
      { key: 'q0', label: 'Q0 (LSB)', color: '#18588c' },
      { key: 'q1', label: 'Q1', color: '#18588c' },
      { key: 'q2', label: 'Q2', color: '#18588c' },
      { key: 'q3', label: 'Q3 (MSB)', color: '#18588c' },
    ];

    const padL = 78, padR = 14, padT = 24, padB = 14;
    const rowH = (h - padT - padB) / channels.length;
    const plotW = w - padL - padR;
    const n = Math.max(2, history.length);
    const stepW = plotW / Math.max(16, n - 1);

    // Garis putus-putus pada rising edge CLK
    ctx.strokeStyle = '#d2cfc6';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    for (let i = 0; i < history.length; i++) {
      const x = padL + i * stepW;
      if (history[i].clk === 1 && (i === 0 || history[i - 1].clk === 0)) {
        ctx.beginPath();
        ctx.moveTo(x, padT - 6);
        ctx.lineTo(x, h - padB);
        ctx.stroke();

        ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = '#1b1d1e';
        ctx.textAlign = 'center';
        ctx.fillText(String(history[i].count), x + stepW * 0.5, 13);
      }
    }
    ctx.setLineDash([]);

    channels.forEach((ch, r) => {
      const yTop = padT + r * rowH + 6;
      const yBot = padT + (r + 1) * rowH - 6;

      ctx.font = 'bold 11px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#1b1d1e';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.label, 8, (yTop + yBot) / 2);

      ctx.strokeStyle = '#dfdcd3';
      ctx.beginPath();
      ctx.moveTo(padL, yBot);
      ctx.lineTo(w - padR, yBot);
      ctx.stroke();

      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.8;
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
