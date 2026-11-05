/**
 * Unit & integration test suite untuk Digital Logic & K-Map Lab.
 * Jalankan dengan:  node tests/run-tests.js
 */
'use strict';
const assert = require('assert');
const path = require('path');

const QM = require(path.join(__dirname, '..', 'simulator', 'js', 'core', 'qm.js'));
const SS = require(path.join(__dirname, '..', 'simulator', 'js', 'core', 'sevenSeg.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2714 ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u2718 ${name}\n      ${e.message}`);
  }
}

console.log('\nQuine-McCluskey & K-Map Minimizer');

test('Fungsi konstan 0 dan konstan 1', () => {
  const s0 = QM.solveBoolean(3, Array(8).fill(0));
  assert.strictEqual(s0.sopExpression, '0');
  assert.strictEqual(s0.posExpression, '0');
  const s1 = QM.solveBoolean(3, Array(8).fill(1));
  assert.strictEqual(s1.sopExpression, '1');
  assert.strictEqual(s1.posExpression, '1');
});

test('4-pojok K-Map 4 variabel (m0,m2,m8,m10) disederhanakan menjadi B\'D\'', () => {
  const vals = Array.from({ length: 16 }, (_, m) => ([0, 2, 8, 10].includes(m) ? 1 : 0));
  const sol = QM.solveBoolean(4, vals);
  assert.strictEqual(sol.sopExpression, "B'D'");
  assert.strictEqual(sol.groups.length, 1);
  // Harus menghasilkan 4 segmen sudut pada K-Map karena wrap-around baris & kolom
  assert.strictEqual(sol.groups[0].rects.length, 4);
});

test('Detektor bilangan prima 4-bit (m2,3,5,7,11,13) sesuai kebenaran untuk semua 16 input', () => {
  const primes = [2, 3, 5, 7, 11, 13];
  const vals = Array.from({ length: 16 }, (_, m) => (primes.includes(m) ? 1 : 0));
  const sol = QM.solveBoolean(4, vals);
  for (let m = 0; m < 16; m++) {
    assert.strictEqual(QM.evaluateSOP(sol, m), primes.includes(m) ? 1 : 0, `minterm ${m}`);
  }
  assert.strictEqual(sol.groups.length, 4);
});

test('Don\'t Care (X) dimanfaatkan untuk memperkecil jumlah literal', () => {
  // Tanpa X: m0, m1 -> A'B'C' + A'B'C = A'B'
  // Dengan X pada m2, m3 -> satu baris penuh A'
  const withoutX = QM.solveBoolean(3, [1, 1, 0, 0, 0, 0, 0, 0]);
  const withX = QM.solveBoolean(3, [1, 1, 'X', 'X', 0, 0, 0, 0]);
  assert.strictEqual(withoutX.sopExpression, "A'B'");
  assert.strictEqual(withX.sopExpression, "A'");
  assert.ok(withX.stats.literals < withoutX.stats.literals);
});

test('Verifikasi ekivalensi SOP untuk 200 tabel kebenaran acak (2, 3, 4 variabel)', () => {
  let seed = 42;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pool = [0, 1, 'X'];
  for (const n of [2, 3, 4]) {
    const total = 1 << n;
    for (let trial = 0; trial < 60; trial++) {
      const vals = Array.from({ length: total }, () => pool[Math.floor(rng() * 3)]);
      const sol = QM.solveBoolean(n, vals);
      for (let m = 0; m < total; m++) {
        if (vals[m] === 'X') continue;
        const y = QM.evaluateSOP(sol, m);
        assert.strictEqual(y, vals[m], `n=${n} trial=${trial} m=${m}`);
      }
    }
  }
});

test('Generator modul Verilog menyertakan deklarasi module, assign, dan endmodule', () => {
  const sol = QM.solveBoolean(2, [0, 1, 1, 0]);
  const code = QM.generateVerilogModule(sol, 'xor_gate', 'Y');
  assert.ok(code.includes('module xor_gate'));
  assert.ok(code.includes('assign Y ='));
  assert.ok(code.includes('endmodule'));
});

console.log('\nBCD-to-7-Segment Decoder');

for (const mode of ['dontcare', 'hex', 'blank']) {
  test(`Mode '${mode}': ketujuh persamaan segmen (a..g) cocok dengan tabel digit 0..9`, () => {
    const sols = SS.solveAllSegments(mode);
    for (let d = 0; d <= 9; d++) {
      const actual = SS.SEG_NAMES.map((s) => QM.evaluateSOP(sols[s], d));
      assert.deepStrictEqual(actual, SS.DIGIT_SEGMENTS[d], `digit ${d}`);
    }
  });
}

test('Mode Don\'t Care menghasilkan lebih sedikit literal dibanding mode Blank', () => {
  const dc = SS.solveAllSegments('dontcare');
  const bl = SS.solveAllSegments('blank');
  const litDC = SS.SEG_NAMES.reduce((s, k) => s + dc[k].stats.literals, 0);
  const litBL = SS.SEG_NAMES.reduce((s, k) => s + bl[k].stats.literals, 0);
  assert.ok(litDC < litBL, `Don't care literals (${litDC}) < Blank literals (${litBL})`);
});

console.log('\nSynchronous 4-Bit Counter');

test('Modulo-10 menghitung naik 0..9 lalu wrap ke 0 tepat pada rising edge', () => {
  const c = new SS.SyncCounterSim({ mod: 10 });
  for (let expected = 1; expected <= 10; expected++) {
    c.stepHalfClock(false); // 0 -> 1 (rising edge)
    assert.strictEqual(c.count, expected % 10);
    c.stepHalfClock(false); // 1 -> 0 (falling edge, nilai tetap)
    assert.strictEqual(c.count, expected % 10);
  }
});

test('Modulo-10 menghitung mundur (DIR=0): 0 -> 9 -> 8', () => {
  const c = new SS.SyncCounterSim({ mod: 10 });
  c.dirUp = false;
  c.stepHalfClock(false); // rising edge
  assert.strictEqual(c.count, 9);
  c.stepHalfClock(false);
  c.stepHalfClock(false); // rising edge
  assert.strictEqual(c.count, 8);
});

test('Enable = 0 menahan nilai counter meskipun clock berdetak', () => {
  const c = new SS.SyncCounterSim({ mod: 16 });
  c.stepHalfClock(false); // count = 1
  c.stepHalfClock(false);
  c.enable = false;
  for (let i = 0; i < 6; i++) c.stepHalfClock(false);
  assert.strictEqual(c.count, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
