/**
 * sevenSeg.js — Model BCD-to-7-Segment Decoder (a..g) & Synchronous 4-Bit Counter.
 *
 * Standar penomoran segmen:
 *        ── a ──
 *       |       |
 *       f       b
 *       |       |
 *        ── g ──
 *       |       |
 *       e       c
 *       |       |
 *        ── d ──
 *
 * Untuk input BCD 0..9 (nilai 10..15 dianggap Don't Care 'X' seperti pada desain
 * praktikum Sistem Digital standar, atau bisa dimatikan/hex).
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const QM = isNode ? require('./qm.js') : root.DigitalLab;
  const mod = factory(QM);
  if (isNode) module.exports = mod;
  else root.DigitalLab = Object.assign(root.DigitalLab || {}, mod);
})(typeof self !== 'undefined' ? self : this, function (QM) {
  'use strict';

  const SEG_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const BCD_VARS = ['D3', 'D2', 'D1', 'D0'];

  // Pola segmen [a,b,c,d,e,f,g] untuk angka 0..9 dan A..F (1 = menyala pada Common Cathode)
  const DIGIT_SEGMENTS = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1],
    10: [1, 1, 1, 0, 1, 1, 1], // A
    11: [0, 0, 1, 1, 1, 1, 1], // b
    12: [1, 0, 0, 1, 1, 1, 0], // C
    13: [0, 1, 1, 1, 1, 0, 1], // d
    14: [1, 0, 0, 1, 1, 1, 1], // E
    15: [1, 0, 0, 0, 1, 1, 1], // F
  };

  /**
   * Bangun tabel kebenaran 16-baris untuk segmen tertentu (`a`..`g`).
   * @param {string} seg 'a'..'g'
   * @param {'dontcare'|'blank'|'hex'} invalidMode perlakuan untuk input 10..15
   */
  function getSegmentTruthTable(seg, invalidMode = 'dontcare') {
    const idx = SEG_NAMES.indexOf(seg);
    if (idx < 0) throw new Error(`Segmen tidak dikenal: ${seg}`);
    const table = [];
    for (let v = 0; v < 16; v++) {
      if (v <= 9) {
        table.push(DIGIT_SEGMENTS[v][idx]);
      } else if (invalidMode === 'dontcare') {
        table.push('X');
      } else if (invalidMode === 'hex') {
        table.push(DIGIT_SEGMENTS[v][idx]);
      } else {
        table.push(0);
      }
    }
    return table;
  }

  /** Hitung solusi K-Map untuk ketujuh segmen a..g sekaligus. */
  function solveAllSegments(invalidMode = 'dontcare') {
    const out = {};
    for (const s of SEG_NAMES) {
      const tt = getSegmentTruthTable(s, invalidMode);
      out[s] = QM.solveBoolean(4, tt, BCD_VARS);
    }
    return out;
  }

  /**
   * Simulator 4-Bit Synchronous Up/Down Counter (dengan opsi modulo-10 BCD atau modulo-16).
   */
  class SyncCounterSim {
    constructor({ mod = 10, maxHistory = 32 } = {}) {
      this.mod = mod; // 10 (BCD decade counter) atau 16 (4-bit binary)
      this.maxHistory = maxHistory;
      this.enable = true;
      this.dirUp = true; // true = UP, false = DOWN
      this.reset();
    }

    reset() {
      this.count = 0;
      this.clk = 0;
      this.ticks = 0;
      this.history = [];
      this._record(0);
    }

    /** Eksekusi setengah periode clock (toggle 0->1 atau 1->0). Transisi state pada rising edge (0->1). */
    stepHalfClock(syncReset = false) {
      const nextClk = this.clk ? 0 : 1;
      if (nextClk === 1) {
        // Rising edge (posedge clk)
        if (syncReset) {
          this.count = 0;
        } else if (this.enable) {
          if (this.dirUp) {
            this.count = (this.count + 1) % this.mod;
          } else {
            this.count = (this.count - 1 + this.mod) % this.mod;
          }
        }
      }
      this.clk = nextClk;
      this.ticks++;
      this._record(syncReset ? 1 : 0);
      return this.state();
    }

    _record(rst) {
      this.history.push({
        tick: this.ticks,
        clk: this.clk,
        rst,
        en: this.enable ? 1 : 0,
        dir: this.dirUp ? 1 : 0,
        count: this.count,
        q0: this.count & 1,
        q1: (this.count >> 1) & 1,
        q2: (this.count >> 2) & 1,
        q3: (this.count >> 3) & 1,
      });
      if (this.history.length > this.maxHistory) this.history.shift();
    }

    state() {
      return {
        count: this.count,
        clk: this.clk,
        q3: (this.count >> 3) & 1,
        q2: (this.count >> 2) & 1,
        q1: (this.count >> 1) & 1,
        q0: this.count & 1,
      };
    }
  }

  return {
    SEG_NAMES,
    BCD_VARS,
    DIGIT_SEGMENTS,
    getSegmentTruthTable,
    solveAllSegments,
    SyncCounterSim,
  };
});
