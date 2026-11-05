/**
 * app.js — Pengendali utama Digital Logic & K-Map Studio.
 */
(function () {
  'use strict';
  const D = window.DigitalLab;
  const $ = (id) => document.getElementById(id);

  const state = {
    // Tab 1: K-Map Studio
    numVars: 4,
    values: [],
    solution: null,
    testInput: 0,
    nandOnly: false,
    kmapHitTest: null,

    // Tab 2: BCD-to-7-Segment
    bcdValue: 5,
    invalidMode: 'dontcare',
    selectedSeg: 'a',
    segSolutions: {},

    // Tab 3: Synchronous Counter
    counter: new D.SyncCounterSim({ mod: 10, maxHistory: 28 }),
    clkRunning: true,
    clkHz: 2,
  };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ================================================================ PRESETS
  function loadPreset(name) {
    const n = state.numVars;
    const total = 1 << n;
    const isPrime = (x) => [2, 3, 5, 7, 11, 13].includes(x);

    if (name === 'majority') {
      state.values = Array.from({ length: total }, (_, m) => {
        let bits = 0;
        for (let i = 0; i < n; i++) bits += (m >> i) & 1;
        return bits >= Math.ceil((n + 1) / 2) ? 1 : 0;
      });
    } else if (name === 'parity') {
      state.values = Array.from({ length: total }, (_, m) => {
        let p = 0;
        for (let i = 0; i < n; i++) p ^= (m >> i) & 1;
        return p;
      });
    } else if (name === 'prime') {
      state.values = Array.from({ length: total }, (_, m) => (isPrime(m) ? 1 : 0));
    } else if (name === 'seg_a') {
      state.numVars = 4;
      $('varCountSelect').value = '4';
      state.values = D.getSegmentTruthTable('a', 'dontcare');
    } else if (name === 'corners') {
      state.numVars = 4;
      $('varCountSelect').value = '4';
      state.values = Array.from({ length: 16 }, (_, m) => ([0, 2, 8, 10].includes(m) ? 1 : 0));
    }
    state.testInput = Math.min(state.testInput, (1 << state.numVars) - 1);
    recomputeKMap();
  }

  function cycleVal(v) {
    if (v === 0 || v === '0') return 1;
    if (v === 1 || v === '1') return 'X';
    return 0;
  }

  // ================================================================ TAB 1: K-MAP
  function recomputeKMap() {
    const vars = D.DEFAULT_VARS.slice(0, state.numVars);
    state.solution = D.solveBoolean(state.numVars, state.values, vars);
    renderTruthTable();
    renderKMapStage();
  }

  function renderTruthTable() {
    const vars = D.DEFAULT_VARS.slice(0, state.numVars);
    const total = 1 << state.numVars;
    const tbl = $('truthTable');
    let html = `<thead><tr><th>m</th>${vars.map((v) => `<th>${v}</th>`).join('')}<th>Y</th></tr></thead><tbody>`;
    for (let m = 0; m < total; m++) {
      const v = state.values[m];
      const cls = v === 1 ? 'v1' : v === 'X' ? 'vx' : 'v0';
      const bitCells = vars
        .map((_, i) => `<td>${(m >> (state.numVars - 1 - i)) & 1}</td>`)
        .join('');
      html += `<tr data-m="${m}"><td>m${m}</td>${bitCells}<td><span class="tt-out ${cls}">${v}</span></td></tr>`;
    }
    html += '</tbody>';
    tbl.innerHTML = html;

    tbl.querySelectorAll('tbody tr').forEach((tr) => {
      const m = parseInt(tr.dataset.m, 10);
      tr.onclick = () => {
        state.values[m] = cycleVal(state.values[m]);
        state.testInput = m;
        recomputeKMap();
      };
    });
  }

  function renderKMapStage() {
    const sol = state.solution;
    const vars = sol.varNames;

    state.kmapHitTest = D.drawKMapCanvas(
      $('kmapCanvas'),
      state.numVars,
      state.values,
      sol,
      vars,
      state.testInput
    );

    $('kmapStats').innerHTML = [
      `<span class="badge">${sol.stats.groups} Implicant</span>`,
      `<span class="badge">${sol.stats.literals} Literal</span>`,
      `<span class="badge">${sol.stats.gates} Gate</span>`,
    ].join('');

    // Chip grup implicant
    const chips = $('groupChips');
    if (!sol.groups.length) {
      chips.innerHTML = `<span class="muted">Tidak ada grup bernilai 1.</span>`;
    } else {
      chips.innerHTML = sol.groups
        .map((g, idx) => {
          const c = D.GROUP_COLORS[idx % D.GROUP_COLORS.length];
          return `<span class="g-chip" style="border-color:${c};color:${c}">${g.term} <small style="color:#94a3b8">(m${g.minterms.join(',')})</small></span>`;
        })
        .join('');
    }

    $('sopText').textContent = `Y = ${sol.sopExpression}`;
    $('posText').textContent = `Y = ${sol.posExpression}`;
    $('verilogCode').textContent = D.generateVerilogModule(sol, 'kmap_circuit', 'Y');

    renderTestSwitches();
    D.drawSchematicCanvas($('schemCanvas'), sol, state.testInput, state.nandOnly);
  }

  function renderTestSwitches() {
    const vars = state.solution.varNames;
    const box = $('testSwitches');
    box.innerHTML = '<span class="muted" style="margin-right:4px">Uji Input:</span>';
    vars.forEach((v, i) => {
      const bitPos = state.numVars - 1 - i;
      const bit = (state.testInput >> bitPos) & 1;
      const btn = document.createElement('button');
      btn.className = `sw-btn ${bit ? 'high' : ''}`;
      btn.textContent = `${v} = ${bit}`;
      btn.onclick = () => {
        state.testInput ^= 1 << bitPos;
        renderKMapStage();
      };
      box.appendChild(btn);
    });
    const outVal = D.evaluateSOP(state.solution, state.testInput);
    const outBadge = document.createElement('span');
    outBadge.className = 'badge';
    outBadge.style.marginLeft = 'auto';
    outBadge.textContent = `m${state.testInput} → Y = ${outVal}`;
    box.appendChild(outBadge);
  }

  // ================================================================ TAB 2: 7-SEGMENT
  function recomputeSevenSeg() {
    state.segSolutions = D.solveAllSegments(state.invalidMode);
    renderSevenSegTab();
  }

  function renderSevenSegTab() {
    const bcd = state.bcdValue;
    const segBits = D.SEG_NAMES.map((s) => D.evaluateSOP(state.segSolutions[s], bcd));

    // Switch D3..D0
    const swBox = $('bcdSwitches');
    swBox.innerHTML = '';
    D.BCD_VARS.forEach((name, i) => {
      const bitPos = 3 - i;
      const bit = (bcd >> bitPos) & 1;
      const btn = document.createElement('button');
      btn.className = `sw-btn ${bit ? 'high' : ''}`;
      btn.textContent = `${name} = ${bit}`;
      btn.onclick = () => {
        state.bcdValue ^= 1 << bitPos;
        renderSevenSegTab();
      };
      swBox.appendChild(btn);
    });

    // Keypad 0..F
    const kp = $('bcdKeypad');
    kp.innerHTML = '';
    for (let v = 0; v < 16; v++) {
      const b = document.createElement('button');
      b.className = `key-btn ${v === bcd ? 'active' : ''}`;
      b.textContent = v.toString(16).toUpperCase();
      b.onclick = () => {
        state.bcdValue = v;
        renderSevenSegTab();
      };
      kp.appendChild(b);
    }

    D.drawSevenSegCanvas($('sevenSegCanvas'), segBits, state.selectedSeg);

    // Daftar 7 persamaan a..g
    const list = $('segEquationsList');
    list.innerHTML = '';
    D.SEG_NAMES.forEach((s, idx) => {
      const sol = state.segSolutions[s];
      const on = segBits[idx];
      const item = document.createElement('div');
      item.className = `seg-eq-item ${s === state.selectedSeg ? 'active' : ''}`;
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span class="seg-pill ${on ? 'on' : ''}">${s}</span>
          <code class="eq-code" style="font-size:13px">${s} = ${sol.sopExpression}</code>
        </div>
        <span class="badge">${sol.stats.literals} lit</span>
      `;
      item.onclick = () => {
        state.selectedSeg = s;
        renderSevenSegTab();
      };
      list.appendChild(item);
    });

    // K-Map segmen terpilih
    const sSol = state.segSolutions[state.selectedSeg];
    const sTable = D.getSegmentTruthTable(state.selectedSeg, state.invalidMode);
    $('segKmapTitle').textContent = `K-Map Segmen '${state.selectedSeg}' (Input = ${bcd})`;
    D.drawKMapCanvas($('segKmapCanvas'), 4, sTable, sSol, D.BCD_VARS, bcd);
    $('segVerilogCode').textContent = D.generateVerilogModule(
      sSol,
      `seg_${state.selectedSeg}_decoder`,
      `seg_${state.selectedSeg}`
    );
  }

  // ================================================================ TAB 3: COUNTER
  function renderCounterTab() {
    const st = state.counter.state();
    const ffBox = $('ffCards');
    const bits = [
      { label: 'Q3 (MSB)', val: st.q3 },
      { label: 'Q2', val: st.q2 },
      { label: 'Q1', val: st.q1 },
      { label: 'Q0 (LSB)', val: st.q0 },
    ];
    ffBox.innerHTML = bits
      .map(
        (b) => `<div class="ff-card ${b.val ? 'high' : ''}">
          <div class="ff-name">${b.label}</div>
          <div class="ff-val">${b.val}</div>
        </div>`
      )
      .join('');

    const segBits = D.DIGIT_SEGMENTS[st.count] || [0, 0, 0, 0, 0, 0, 0];
    D.drawSevenSegCanvas($('cntSegCanvas'), segBits, null);
    D.drawTimingCanvas($('timingCanvas'), state.counter.history);
  }

  // ================================================================ EVENTS & INIT
  function switchTab(tabId) {
    document.querySelectorAll('#mainTabs .tab').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === tabId)
    );
    document.querySelectorAll('.tab-view').forEach((v) =>
      v.classList.toggle('active', v.id === `tab-${tabId}`)
    );
    if (tabId === 'kmap') renderKMapStage();
    else if (tabId === 'sevenseg') renderSevenSegTab();
    else if (tabId === 'counter') renderCounterTab();
  }

  function bindEvents() {
    document.querySelectorAll('#mainTabs .tab').forEach((btn) => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    $('varCountSelect').onchange = (e) => {
      state.numVars = parseInt(e.target.value, 10);
      loadPreset($('presetSelect').value);
    };
    $('presetSelect').onchange = (e) => loadPreset(e.target.value);

    $('fillZeroBtn').onclick = () => {
      state.values = Array(1 << state.numVars).fill(0);
      recomputeKMap();
    };
    $('fillOneBtn').onclick = () => {
      state.values = Array(1 << state.numVars).fill(1);
      recomputeKMap();
    };
    $('invertBtn').onclick = () => {
      state.values = state.values.map((v) => (v === 1 ? 0 : v === 0 ? 1 : 'X'));
      recomputeKMap();
    };
    $('randomBtn').onclick = () => {
      const pool = [0, 0, 1, 1, 'X'];
      state.values = Array.from(
        { length: 1 << state.numVars },
        () => pool[Math.floor(Math.random() * pool.length)]
      );
      recomputeKMap();
    };

    $('kmapCanvas').addEventListener('click', (e) => {
      if (!state.kmapHitTest) return;
      const rect = e.target.getBoundingClientRect();
      const m = state.kmapHitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (m !== null) {
        state.values[m] = cycleVal(state.values[m]);
        state.testInput = m;
        recomputeKMap();
      }
    });

    $('nandOnlyChk').onchange = (e) => {
      state.nandOnly = e.target.checked;
      renderKMapStage();
    };

    $('copyVerilogBtn').onclick = () => {
      const code = $('verilogCode').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(code);
      toast('Kode Verilog HDL disalin ke clipboard ✓');
    };

    // Tab 2 events
    $('invalidModeSelect').onchange = (e) => {
      state.invalidMode = e.target.value;
      recomputeSevenSeg();
    };
    $('openSegInStudioBtn').onclick = () => {
      state.numVars = 4;
      $('varCountSelect').value = '4';
      state.values = D.getSegmentTruthTable(state.selectedSeg, state.invalidMode);
      state.testInput = state.bcdValue;
      recomputeKMap();
      switchTab('kmap');
    };

    // Tab 3 events
    $('clkRunBtn').onclick = () => {
      state.clkRunning = !state.clkRunning;
      $('clkRunBtn').textContent = state.clkRunning ? '⏸ Pause Clock' : '▶ Run Clock';
    };
    $('clkStepBtn').onclick = () => {
      state.counter.stepHalfClock(false);
      renderCounterTab();
    };
    $('clkResetBtn').onclick = () => {
      state.counter.reset();
      renderCounterTab();
    };
    $('counterModSelect').onchange = (e) => {
      state.counter.mod = parseInt(e.target.value, 10);
      state.counter.reset();
      renderCounterTab();
    };
    $('clkHzSelect').onchange = (e) => {
      state.clkHz = parseFloat(e.target.value);
    };
    $('cntEnableChk').onchange = (e) => {
      state.counter.enable = e.target.checked;
    };
    $('cntDirChk').onchange = (e) => {
      state.counter.dirUp = e.target.checked;
    };

    window.addEventListener('resize', () => {
      const active = document.querySelector('#mainTabs .tab.active')?.dataset.tab;
      if (active) switchTab(active);
    });
  }

  // Loop detak clock untuk Tab 3
  let lastTickMs = performance.now();
  function tickLoop(now) {
    const halfPeriodMs = 1000 / (state.clkHz * 2);
    if (state.clkRunning && now - lastTickMs >= halfPeriodMs) {
      lastTickMs = now;
      state.counter.stepHalfClock(false);
      if ($('tab-counter').classList.contains('active')) {
        renderCounterTab();
      }
    }
    requestAnimationFrame(tickLoop);
  }

  bindEvents();
  loadPreset('prime');
  recomputeSevenSeg();
  // Isi awal riwayat gelombang counter agar grafik timing langsung penuh
  for (let i = 0; i < 20; i++) state.counter.stepHalfClock(false);
  renderCounterTab();
  const initialHash = location.hash.replace('#', '');
  if (['kmap', 'sevenseg', 'counter'].includes(initialHash)) switchTab(initialHash);
  requestAnimationFrame(tickLoop);
})();
