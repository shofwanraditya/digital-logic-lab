/**
 * qm.js — Boolean Minimizer (Quine–McCluskey + Petrick's Method) untuk 2..4 variabel.
 *
 * Mendukung:
 *   - Minimisasi SOP (Sum of Products) & POS (Product of Sums)
 *   - Nilai tabel kebenaran: 0, 1, dan 'X' (Don't Care)
 *   - Koordinat sel Karnaugh Map (urutan Gray code) untuk visualisasi loop kelompok
 *   - Generator kode Verilog HDL (dataflow `assign`) otomatis dari hasil minimisasi
 *
 * Dapat dijalankan di browser (`window.DigitalLab`) maupun Node.js (`require`).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.DigitalLab = Object.assign(root.DigitalLab || {}, mod);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_VARS = ['A', 'B', 'C', 'D'];
  const GRAY_1 = [0, 1];
  const GRAY_2 = [0, 1, 3, 2]; // 00, 01, 11, 10

  /** Konfigurasi dimensi & label K-Map berdasarkan jumlah variabel (2, 3, atau 4). */
  function kmapLayout(numVars, varNames = DEFAULT_VARS.slice(0, numVars)) {
    if (numVars === 2) {
      return {
        numVars,
        rowVars: [varNames[0]],
        colVars: [varNames[1]],
        rowGray: GRAY_1,
        colGray: GRAY_1,
        rowLabels: ['0', '1'],
        colLabels: ['0', '1'],
      };
    }
    if (numVars === 3) {
      return {
        numVars,
        rowVars: [varNames[0]],
        colVars: [varNames[1], varNames[2]],
        rowGray: GRAY_1,
        colGray: GRAY_2,
        rowLabels: ['0', '1'],
        colLabels: ['00', '01', '11', '10'],
      };
    }
    return {
      numVars: 4,
      rowVars: [varNames[0], varNames[1]],
      colVars: [varNames[2], varNames[3]],
      rowGray: GRAY_2,
      colGray: GRAY_2,
      rowLabels: ['00', '01', '11', '10'],
      colLabels: ['00', '01', '11', '10'],
    };
  }

  /** Konversi indeks baris & kolom K-Map (urutan Gray) menjadi indeks minterm (0..2^n-1). */
  function cellToMinterm(numVars, r, c) {
    const lay = kmapLayout(numVars);
    const rv = lay.rowGray[r];
    const cv = lay.colGray[c];
    const colBits = lay.colVars.length;
    return (rv << colBits) | cv;
  }

  /** Konversi indeks minterm menjadi posisi { r, c } pada K-Map. */
  function mintermToCell(numVars, m) {
    const lay = kmapLayout(numVars);
    const colBits = lay.colVars.length;
    const colMask = (1 << colBits) - 1;
    const rv = m >> colBits;
    const cv = m & colMask;
    return { r: lay.rowGray.indexOf(rv), c: lay.colGray.indexOf(cv) };
  }

  function popcount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }

  /**
   * Representasi implicant:
   *   bits: nilai bit (untuk posisi yang tidak di-mask)
   *   mask: bit = 1 artinya posisi variabel tersebut tereliminasi ('-')
   *   minterms: array terurut minterm yang dicakup implicant ini
   */
  function implicantKey(bits, mask, numVars) {
    let s = '';
    for (let i = numVars - 1; i >= 0; i--) {
      if ((mask >> i) & 1) s += '-';
      else s += (bits >> i) & 1 ? '1' : '0';
    }
    return s;
  }

  function expandImplicantMinterms(bits, mask, numVars) {
    const out = [];
    const total = 1 << numVars;
    for (let m = 0; m < total; m++) {
      if (((m ^ bits) & ~mask) === 0) out.push(m);
    }
    return out;
  }

  /** Cari seluruh Prime Implicants dengan algoritma Quine–McCluskey. */
  function findPrimeImplicants(numVars, activeTerms) {
    let current = new Map();
    for (const m of activeTerms) {
      const key = implicantKey(m, 0, numVars);
      current.set(key, { bits: m, mask: 0, used: false });
    }

    const primes = new Map();
    while (current.size > 0) {
      const list = Array.from(current.values());
      const next = new Map();

      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          if (a.mask !== b.mask) continue;
          const diff = (a.bits ^ b.bits) & ~a.mask;
          if (popcount(diff) === 1) {
            a.used = true;
            b.used = true;
            const newMask = a.mask | diff;
            const newBits = a.bits & ~newMask;
            const key = implicantKey(newBits, newMask, numVars);
            if (!next.has(key)) next.set(key, { bits: newBits, mask: newMask, used: false });
          }
        }
      }

      for (const [k, imp] of current.entries()) {
        if (!imp.used && !primes.has(k)) {
          primes.set(k, {
            key: k,
            bits: imp.bits,
            mask: imp.mask,
            minterms: expandImplicantMinterms(imp.bits, imp.mask, numVars),
            literals: numVars - popcount(imp.mask),
          });
        }
      }
      current = next;
    }

    return Array.from(primes.values());
  }

  /** Pilih himpunan Prime Implicants dengan biaya minimum yang mencakup semua `requiredTerms`. */
  function selectMinimalCover(primes, requiredTerms) {
    if (requiredTerms.length === 0) return [];

    // Filter hanya prime implicant yang mencakup setidaknya 1 required term
    const candidates = primes.filter((p) => p.minterms.some((m) => requiredTerms.includes(m)));
    const uncovered = new Set(requiredTerms);
    const chosen = new Set();

    // 1. Essential Prime Implicants (minterm yang hanya dicakup oleh 1 prime implicant)
    for (const m of requiredTerms) {
      const covering = candidates.filter((p) => p.minterms.includes(m));
      if (covering.length === 1) {
        const epi = covering[0];
        chosen.add(epi);
        for (const cov of epi.minterms) uncovered.delete(cov);
      }
    }

    if (uncovered.size === 0) return Array.from(chosen);

    // 2. Eksplorasi eksak untuk sisa minterm (untuk <= 4 variabel jumlah kandidat sangat kecil)
    const remaining = candidates.filter((p) => !chosen.has(p) && p.minterms.some((m) => uncovered.has(m)));
    const neededList = Array.from(uncovered);

    let bestSet = null;
    let bestCost = Infinity;

    function search(idx, picked, coveredMask) {
      const fullMask = (1 << neededList.length) - 1;
      const cost = picked.reduce((s, p) => s + p.literals + 10, 0);
      if (cost >= bestCost) return;
      if (coveredMask === fullMask) {
        bestCost = cost;
        bestSet = picked.slice();
        return;
      }
      if (idx >= remaining.length) return;

      const p = remaining[idx];
      let pMask = 0;
      for (let i = 0; i < neededList.length; i++) {
        if (p.minterms.includes(neededList[i])) pMask |= 1 << i;
      }
      if ((coveredMask | pMask) !== coveredMask) {
        picked.push(p);
        search(idx + 1, picked, coveredMask | pMask);
        picked.pop();
      }
      search(idx + 1, picked, coveredMask);
    }

    search(0, [], 0);
    return [...chosen, ...(bestSet || [])];
  }

  /** Format 1 suku SOP (mis. "A'B" atau "A·B'·C") dan ekspresi Verilog-nya. */
  function formatTermSOP(imp, numVars, varNames) {
    const parts = [];
    const vParts = [];
    for (let i = 0; i < numVars; i++) {
      const bitIdx = numVars - 1 - i;
      if ((imp.mask >> bitIdx) & 1) continue;
      const val = (imp.bits >> bitIdx) & 1;
      parts.push(val ? varNames[i] : `${varNames[i]}'`);
      vParts.push(val ? varNames[i] : `~${varNames[i]}`);
    }
    return {
      text: parts.length ? parts.join('') : '1',
      verilog: vParts.length ? (vParts.length > 1 ? `(${vParts.join(' & ')})` : vParts[0]) : "1'b1",
      inputs: parts,
    };
  }

  /** Format 1 suku POS (Maxterm, mis. "(A + B')"). */
  function formatTermPOS(imp, numVars, varNames) {
    const parts = [];
    for (let i = 0; i < numVars; i++) {
      const bitIdx = numVars - 1 - i;
      if ((imp.mask >> bitIdx) & 1) continue;
      const val = (imp.bits >> bitIdx) & 1;
      // Pada POS (dari grup angka 0), bit 0 adalah variabel normal, bit 1 adalah komplemen
      parts.push(val ? `${varNames[i]}'` : varNames[i]);
    }
    if (!parts.length) return '0';
    return parts.length === 1 ? parts[0] : `(${parts.join(' + ')})`;
  }

  /**
   * Hitung koordinat persegi panjang (atau terbelah karena wrap-around) di K-Map
   * untuk menggambar loop kelompok implicant.
   */
  function implicantToKMapRects(imp, numVars) {
    const cells = imp.minterms.map((m) => mintermToCell(numVars, m));
    const rows = Array.from(new Set(cells.map((c) => c.r))).sort((a, b) => a - b);
    const cols = Array.from(new Set(cells.map((c) => c.c))).sort((a, b) => a - b);

    function splitContiguous(arr, maxLen) {
      if (arr.length === 2 && arr[0] === 0 && arr[1] === maxLen - 1 && maxLen === 4) {
        // Wrap-around tepi atas-bawah atau kiri-kanan: kembalikan 2 segmen dengan penanda wrap
        return [
          { start: 0, span: 1, wrapStart: true },
          { start: maxLen - 1, span: 1, wrapEnd: true },
        ];
      }
      return [{ start: arr[0], span: arr.length }];
    }

    const lay = kmapLayout(numVars);
    const rSegs = splitContiguous(rows, lay.rowGray.length);
    const cSegs = splitContiguous(cols, lay.colGray.length);

    const rects = [];
    for (const rs of rSegs) {
      for (const cs of cSegs) {
        rects.push({
          r: rs.start,
          c: cs.start,
          rSpan: rs.span,
          cSpan: cs.span,
          wrapTop: !!rs.wrapStart,
          wrapBottom: !!rs.wrapEnd,
          wrapLeft: !!cs.wrapStart,
          wrapRight: !!cs.wrapEnd,
        });
      }
    }
    return rects;
  }

  /**
   * Fungsi utama penyederhanaan tabel kebenaran.
   * @param {number} numVars 2, 3, atau 4
   * @param {Array<0|1|'X'>} values panjang 2^numVars
   * @param {string[]} [varNames]
   */
  function solveBoolean(numVars, values, varNames = DEFAULT_VARS.slice(0, numVars)) {
    const total = 1 << numVars;
    const ones = [];
    const zeros = [];
    const dontCares = [];

    for (let m = 0; m < total; m++) {
      const v = values[m];
      if (v === 1 || v === '1') ones.push(m);
      else if (v === 'X' || v === 'x') dontCares.push(m);
      else zeros.push(m);
    }

    // --- Minimisasi SOP ---
    let sopImplicants = [];
    let sopExpression = '0';
    let verilogAssign = "1'b0";

    if (ones.length === 0) {
      sopExpression = '0';
      verilogAssign = "1'b0";
    } else if (ones.length + dontCares.length === total) {
      sopImplicants = [
        {
          key: '-'.repeat(numVars),
          bits: 0,
          mask: (1 << numVars) - 1,
          minterms: Array.from({ length: total }, (_, i) => i),
          literals: 0,
        },
      ];
      sopExpression = '1';
      verilogAssign = "1'b1";
    } else {
      const primes1 = findPrimeImplicants(numVars, [...ones, ...dontCares]);
      sopImplicants = selectMinimalCover(primes1, ones);
      const formatted = sopImplicants.map((imp) => formatTermSOP(imp, numVars, varNames));
      sopExpression = formatted.map((f) => f.text).join(' + ');
      verilogAssign = formatted.map((f) => f.verilog).join(' | ');
    }

    // --- Minimisasi POS ---
    let posExpression = '1';
    if (zeros.length === 0) {
      posExpression = '1';
    } else if (zeros.length + dontCares.length === total) {
      posExpression = '0';
    } else {
      const primes0 = findPrimeImplicants(numVars, [...zeros, ...dontCares]);
      const posImps = selectMinimalCover(primes0, zeros);
      posExpression = posImps.map((imp) => formatTermPOS(imp, numVars, varNames)).join(' · ');
    }

    const groups = sopImplicants.map((imp, idx) => {
      const f = formatTermSOP(imp, numVars, varNames);
      return {
        index: idx,
        key: imp.key,
        term: f.text,
        verilog: f.verilog,
        inputs: f.inputs,
        minterms: imp.minterms,
        rects: implicantToKMapRects(imp, numVars),
        bits: imp.bits,
        mask: imp.mask,
      };
    });

    // Statistik gerbang logika (SOP standar)
    const productGates = groups.filter((g) => g.inputs.length > 1).length;
    const orGate = groups.length > 1 ? 1 : 0;
    const totalLiterals = groups.reduce((s, g) => s + g.inputs.length, 0);

    return {
      numVars,
      varNames,
      ones,
      zeros,
      dontCares,
      sopExpression,
      posExpression,
      verilogAssign,
      groups,
      stats: {
        groups: groups.length,
        literals: totalLiterals,
        gates: productGates + orGate,
      },
    };
  }

  /** Evaluasi output fungsi hasil minimisasi SOP untuk input biner m (0..2^n-1). */
  function evaluateSOP(solution, m) {
    if (solution.sopExpression === '0') return 0;
    if (solution.sopExpression === '1') return 1;
    for (const g of solution.groups) {
      if (((m ^ g.bits) & ~g.mask) === 0) return 1;
    }
    return 0;
  }

  /** Generate modul Verilog HDL lengkap beserta komentar minterm. */
  function generateVerilogModule(solution, moduleName = 'kmap_circuit', outName = 'Y') {
    const ports = [...solution.varNames, outName].join(', ');
    const inputs = solution.varNames.join(', ');
    const mintermStr = solution.ones.length ? `Σm(${solution.ones.join(', ')})` : 'Σm()';
    const dcStr = solution.dontCares.length ? ` + d(${solution.dontCares.join(', ')})` : '';
    return [
      `// Auto-generated by Digital Logic & K-Map Lab`,
      `// Function : ${outName}(${inputs}) = ${mintermStr}${dcStr}`,
      `// Minimized: ${outName} = ${solution.sopExpression}`,
      `module ${moduleName} (`,
      `    input  wire ${inputs},`,
      `    output wire ${outName}`,
      `);`,
      `    assign ${outName} = ${solution.verilogAssign};`,
      `endmodule`,
    ].join('\n');
  }

  return {
    DEFAULT_VARS,
    kmapLayout,
    cellToMinterm,
    mintermToCell,
    solveBoolean,
    evaluateSOP,
    generateVerilogModule,
  };
});
