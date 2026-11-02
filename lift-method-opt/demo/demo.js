/* =========================================================
   人工举升方式智能优选与参数优化 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 知识图层：六种工况条件对电潜泵 / 气举 / 螺杆泵逐条判据（硬判据否决、
      软判据降权），每条附证据来源（规格库或历史井次）；
   ② 寻优层：在各自可用的方式上搜索制度参数
        ESP —— 泵型（额定排量）× 运行频率
        GL  —— 注气量（伴生气可自给一部分）
        PCP —— 转速
      目标都是日净收益 = 产油收入 − 水处理 − 能耗/注气 − 检泵摊销；
   ③ 与「现场习惯做法」（沿用区块在用方式 + 库存泵型 + 50 Hz）对比。
   注：为演示而写的降阶模型，不可用于选型与制度设计。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 经济与物理常量 ---------- */
  var OIL = 3800;      /* 元/t */
  var RHO = 0.86;      /* t/m³ */
  var WATER = 8;       /* 元/m³ 水处理 */
  var ELEC = 0.6;      /* 元/kWh */
  var GAS = 0.45;      /* 元/Nm³ 外购气 */
  var G = 9.81;
  var COST_ESP = 300000;   /* 元 / 次检泵（含泵） */
  var COST_GL = 120000;    /* 元 / 次作业 */
  var COST_PCP = 220000;   /* 元 / 次检泵 */
  var PUMPS = [60, 100, 150, 220, 320];   /* 电潜泵额定排量档 m³/d */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function kW(q, H, eff) { return q / 86400 * H * 1000 * G / Math.max(eff, 0.05) / 1000; }

  function income(q, wc) {
    return q * (1 - wc / 100) * RHO * OIL - q * wc / 100 * WATER;
  }

  /* ---------- 1. 三种方式的工况模型 ---------- */
  function esp(ql, wc, glr, H, sand, T, qbep, f) {
    var q = qbep * f / 50;                       /* 泵排量 m³/d */
    var produced = Math.min(ql, q);
    var under = q > 1.15 * ql ? 0.72 : 1;        /* 供液跟不上 → 欠载，泵效打折 */
    var eff = 0.62 * Math.exp(-Math.pow((f / 50 - 1) / 0.42, 2)) / (1 + glr / 900) * under;
    var power = kW(q, H * 1.05, eff);
    var life = 900 * Math.exp(-0.018 * Math.max(0, T - 90)) / (1 + 0.30 * sand) /
      (1 + 0.9 * Math.max(0, glr - 150) / 150) * (0.55 + 0.45 * eff / 0.62);
    life = clamp(life, 60, 1500);
    var net = income(produced, wc) - power * 24 * ELEC - COST_ESP / life;
    return { q: q, produced: produced, eff: eff, power: power, life: life, net: net,
      cost: power * 24 * ELEC + COST_ESP / life };
  }

  function glift(ql, wc, glr, H, sand, T, Gi) {
    var Gopt = clamp(220 * ql, 4000, 90000);     /* 最优注气量随产液量上升 */
    var f = Math.exp(-Math.pow((Gi - Gopt) / (0.9 * Gopt), 2));
    var produced = ql * (0.25 + 0.72 * f);       /* 注气不足举不动，注气过多压井 */
    var selfGas = ql * glr * 0.6;                /* 伴生气自给 */
    var buy = Math.max(0, Gi - selfGas);
    var life = 1100 * Math.exp(-0.012 * Math.max(0, T - 80)) / (1 + 0.10 * sand);
    life = clamp(life, 90, 2000);
    var net = income(produced, wc) - buy * GAS - COST_GL / life;
    return { q: Gi, produced: produced, eff: f, power: 0, life: life, net: net,
      cost: buy * GAS + COST_GL / life, buy: buy };
  }

  function pcp(ql, wc, glr, H, sand, T, rpm) {
    var q = 0.4 * rpm;                           /* 每转排量 × 转速 */
    var produced = Math.min(ql, q);
    var under = q > 1.15 * ql ? 0.78 : 1;
    var eff = 0.55 / (1 + glr / 2500) * under;
    var power = kW(q, H * 1.02, eff);
    var life = 900 * Math.pow(250 / (rpm + 60), 1.15) *
      Math.exp(-0.02 * Math.max(0, T - 70)) / (1 + 0.12 * sand);
    life = clamp(life, 60, 1400);
    var net = income(produced, wc) - power * 24 * ELEC - COST_PCP / life;
    return { q: q, produced: produced, eff: eff, power: power, life: life, net: net,
      cost: power * 24 * ELEC + COST_PCP / life };
  }

  /* ---------- 2. 知识图层：判据与证据 ---------- */
  /* level: ok / soft / hard */
  function rules(ql, wc, glr, H, sand, T) {
    return {
      esp: [
        { nm: "排量区间", lv: (ql >= 20 && ql <= 500) ? "ok" : "hard",
          src: "泵型样本 5 档" },
        { nm: "举升高度", lv: H <= 3000 ? "ok" : "hard", src: "级数上限 400 级" },
        { nm: "气液比", lv: glr <= 180 ? "ok" : (glr <= 350 ? "soft" : "hard"),
          src: "18 井次气锁检泵" },
        { nm: "含砂", lv: sand <= 1 ? "ok" : (sand <= 4 ? "soft" : "hard"),
          src: "化验 + 11 井次" },
        { nm: "井底温度", lv: T <= 110 ? "ok" : (T <= 130 ? "soft" : "hard"),
          src: "电机耐温分级" }
      ],
      gl: [
        { nm: "气源条件", lv: glr >= 150 ? "ok" : "soft", src: "伴生气自给核算" },
        { nm: "举升高度", lv: H <= 2000 ? "ok" : (H <= 2500 ? "soft" : "hard"),
          src: "气源压力上限 12 MPa" },
        { nm: "排量区间", lv: ql >= 30 ? "ok" : "soft", src: "压缩机经济排量" },
        { nm: "含砂", lv: sand <= 4 ? "ok" : "soft", src: "阀件冲蚀记录" },
        { nm: "井底温度", lv: "ok", src: "井下无运动部件" }
      ],
      pcp: [
        { nm: "排量区间", lv: ql <= 160 ? "ok" : (ql <= 220 ? "soft" : "hard"),
          src: "转速上限 400 rpm" },
        { nm: "举升高度", lv: H <= 1500 ? "ok" : (H <= 1800 ? "soft" : "hard"),
          src: "定子级数上限" },
        { nm: "井底温度", lv: T <= 90 ? "ok" : (T <= 120 ? "soft" : "hard"),
          src: "定子橡胶耐温" },
        { nm: "气液比", lv: "ok", src: "不怕游离气" },
        { nm: "含砂", lv: sand <= 4 ? "ok" : "soft", src: "23 井次耐磨记录" }
      ]
    };
  }

  function score(rs) {
    var hard = rs.filter(function (r) { return r.lv === "hard"; }).length;
    var soft = rs.filter(function (r) { return r.lv === "soft"; }).length;
    return { hard: hard, soft: soft, usable: hard === 0, s: hard ? 0 : Math.max(10, 100 - 18 * soft) };
  }

  /* ---------- 3. 制度参数寻优 ---------- */
  function bestEsp(ql, wc, glr, H, sand, T) {
    var b = null;
    for (var p = 0; p < PUMPS.length; p++) {
      for (var f = 35; f <= 65; f += 0.5) {
        var r = esp(ql, wc, glr, H, sand, T, PUMPS[p], f);
        if (!b || r.net > b.net) b = { net: r.net, res: r, param: f, pump: PUMPS[p],
          label: "泵型 " + PUMPS[p] + " m³/d · " + f.toFixed(1) + " Hz" };
      }
    }
    return b;
  }
  function bestGl(ql, wc, glr, H, sand, T) {
    var b = null;
    for (var gi = 2000; gi <= 90000; gi += 500) {
      var r = glift(ql, wc, glr, H, sand, T, gi);
      if (!b || r.net > b.net) b = { net: r.net, res: r, param: gi,
        label: "注气 " + (gi / 10000).toFixed(1) + " 万 Nm³/d" };
    }
    return b;
  }
  function bestPcp(ql, wc, glr, H, sand, T) {
    var b = null;
    for (var n = 60; n <= 400; n += 5) {
      var r = pcp(ql, wc, glr, H, sand, T, n);
      if (!b || r.net > b.net) b = { net: r.net, res: r, param: n, label: n + " rpm" };
    }
    return b;
  }

  /* ---------- 4. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var kgSvg = el("kg"), cmpSvg = el("cmp"), tuneSvg = el("tune"), note = el("note");
  var IN = ["ql", "wc", "glr", "h", "sand", "t"].map(el);

  /* ---------- 5. 判据矩阵 ---------- */
  function drawKg(R, pick) {
    var W = 720, H = 240, x0 = 92, colW = 176, rowH = 30, top = 44;
    var s = "";
    s += '<text x="14" y="20" font-size="10.5" fill="#79828a">知识图层：六种工况条件 × 三种举升方式（每格右侧小字为证据来源）</text>';
    var names = ["电潜泵", "气举", "螺杆泵"];
    names.forEach(function (nm, c) {
      s += '<text x="' + (x0 + c * colW + 62) + '" y="' + (top - 8) + '" font-size="11" fill="#242b2e" text-anchor="middle">' +
        nm + (pick === c ? '  ★' : '') + '</text>';
    });
    R.esp.forEach(function (r, i) {
      var y = top + i * rowH;
      s += '<text x="14" y="' + (y + 18) + '" font-size="10.5" fill="#4d565b">' + r.nm + '</text>';
      [R.esp[i], R.gl[i], R.pcp[i]].forEach(function (rule, c) {
        var col = rule.lv === "ok" ? "#2f7d6b" : (rule.lv === "soft" ? "#b9c6cf" : "#c9613f");
        var op = rule.lv === "ok" ? 0.78 : (rule.lv === "soft" ? 0.9 : 0.8);
        s += '<rect x="' + (x0 + c * colW) + '" y="' + y + '" width="124" height="24" rx="4" fill="' + col + '" opacity="' + op + '"/>';
        s += '<text x="' + (x0 + c * colW + 62) + '" y="' + (y + 16) + '" font-size="10" text-anchor="middle" fill="' +
          (rule.lv === "soft" ? "#242b2e" : "#fff") + '">' +
          (rule.lv === "ok" ? "通过" : (rule.lv === "soft" ? (r.nm === "气源条件" ? "需外供气" : "受限") : "不可用")) + '</text>';
        s += '<text x="' + (x0 + c * colW + 130) + '" y="' + (y + 16) + '" font-size="8.5" fill="#79828a">' + rule.src + '</text>';
      });
    });
    var sc = [score(R.esp), score(R.gl), score(R.pcp)];
    var by = top + R.esp.length * rowH + 16;
    s += '<text x="14" y="' + (by + 12) + '" font-size="10.5" fill="#4d565b">适用度（硬判据直接归零）</text>';
    sc.forEach(function (v, c) {
      var w = v.s / 100 * 118;
      s += '<rect x="' + (x0 + c * colW) + '" y="' + by + '" width="118" height="14" rx="3" fill="#efece1"/>';
      s += '<rect x="' + (x0 + c * colW) + '" y="' + by + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' +
        (v.usable ? "#41699b" : "#c9613f") + '" opacity="' + (v.usable ? 0.85 : 0.8) + '"/>';
      s += '<text x="' + (x0 + c * colW + 128) + '" y="' + (by + 12) + '" font-size="10" fill="' +
        (v.usable ? "#4d565b" : "#c9613f") + '">' + (v.usable ? v.s + " 分" : "否决") + '</text>';
    });
    s += '<text x="14" y="' + (by + 40) + '" font-size="10" fill="#79828a">' +
      '★ 为寻优后的推荐方式 · 软判据只降权不否决，这是「规则要分级」的意思</text>';
    kgSvg.innerHTML = s;
  }

  /* ---------- 6. 三种方式对比 ---------- */
  function drawCmp(opts, habit, pickIdx) {
    var W = 720, H = 230, ML = 66, MR = 18, MT = 26, MB = 34;
    var xs = [], ys = [];
    opts.forEach(function (o) { if (o) { xs.push(o.res.life); ys.push(o.net); } });
    if (habit) { xs.push(habit.res.life); ys.push(habit.net); }
    var x0 = 0, x1 = Math.max.apply(null, xs) * 1.12, y0 = 0, y1 = Math.max.apply(null, ys) * 1.1;
    var X = function (v) { return ML + (v - x0) / (x1 - x0) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - y0) / (y1 - y0)) * (H - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">寻优层：各自最优制度下的「免修期 — 日净收益」（越靠右上越好）</text>';
    for (var i = 0; i <= 2; i++) {
      var v = y0 + (y1 - y0) * i / 2;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' +
        (v / 10000).toFixed(1) + '万</text>';
    }
    var nm = ["电潜泵", "气举", "螺杆泵"];
    opts.forEach(function (o, i) {
      if (!o) return;
      var cx = X(o.res.life), cy = Y(o.net);
      s += '<line x1="' + ML + '" y1="' + cy.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y2="' + cy.toFixed(1) +
        '" stroke="#41699b" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.5"/>';
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + (i === pickIdx ? 6 : 4.5) + '" fill="' +
        (i === pickIdx ? "#41699b" : "#b9c6cf") + '" stroke="#fff" stroke-width="1.2"/>';
      s += '<text x="' + (cx + 10).toFixed(1) + '" y="' + (cy + 4).toFixed(1) + '" font-size="10.5" fill="' +
        (i === pickIdx ? "#41699b" : "#79828a") + '">' + nm[i] + ' ' + (o.net / 10000).toFixed(2) + ' 万/日</text>';
    });
    if (habit) {
      var hx = X(habit.res.life), hy = Y(habit.net);
      s += '<rect x="' + (hx - 4.5).toFixed(1) + '" y="' + (hy - 4.5).toFixed(1) + '" width="9" height="9" fill="#242b2e"/>';
      s += '<text x="' + (hx + 10).toFixed(1) + '" y="' + (hy + 4).toFixed(1) + '" font-size="10.5" fill="#242b2e">现场习惯 ' +
        (habit.net / 10000).toFixed(2) + ' 万/日</text>';
    }
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">免修期（天）→</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 日净收益</text>';
    cmpSvg.innerHTML = s;
  }

  /* ---------- 7. 制度参数扫描 ---------- */
  function drawTune(kind, opt, ctx) {
    var W = 720, H = 230, ML = 58, MR = 60, MT = 26, MB = 34;
    var pts = [], xlab = "", x0, x1, step;
    if (kind === "esp") {
      x0 = 35; x1 = 65; step = 0.5; xlab = "运行频率 Hz";
      for (var f = x0; f <= x1; f += step) pts.push({ x: f, r: esp(ctx.ql, ctx.wc, ctx.glr, ctx.H, ctx.sand, ctx.T, opt.pump, f) });
    } else if (kind === "gl") {
      x0 = 2000; x1 = 90000; step = 1000; xlab = "注气量 Nm³/d";
      for (var g = x0; g <= x1; g += step) pts.push({ x: g, r: glift(ctx.ql, ctx.wc, ctx.glr, ctx.H, ctx.sand, ctx.T, g) });
    } else {
      x0 = 60; x1 = 400; step = 5; xlab = "转速 rpm";
      for (var n = x0; n <= x1; n += step) pts.push({ x: n, r: pcp(ctx.ql, ctx.wc, ctx.glr, ctx.H, ctx.sand, ctx.T, n) });
    }
    var nets = pts.map(function (p) { return p.r.net; });
    var lives = pts.map(function (p) { return p.r.life; });
    var y0 = Math.min.apply(null, nets), y1 = Math.max.apply(null, nets);
    var l0 = Math.min.apply(null, lives), l1 = Math.max.apply(null, lives);
    var pad = (y1 - y0) * 0.12 || 1;
    y0 -= pad; y1 += pad;
    var X = function (v) { return ML + (v - x0) / (x1 - x0) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - y0) / (y1 - y0)) * (H - MT - MB); };
    var YL = function (v) { return MT + (1 - (v - l0) / ((l1 - l0) || 1)) * (H - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">制度参数扫描：' +
      (kind === "esp" ? "电潜泵（泵型 " + opt.pump + " m³/d）" : kind === "gl" ? "气举" : "螺杆泵") +
      ' · 蓝线日净收益、橙线免修期，两者最优点不重合</text>';
    [0, 0.5, 1].forEach(function (u) {
      var v = y0 + (y1 - y0) * u;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' +
        (v / 10000).toFixed(1) + '万</text>';
    });
    var dN = "", dL = "";
    pts.forEach(function (p, i) {
      dN += (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.r.net).toFixed(1);
      dL += (i ? "L" : "M") + X(p.x).toFixed(1) + " " + YL(p.r.life).toFixed(1);
    });
    s += '<path d="' + dL + '" fill="none" stroke="#c9613f" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<path d="' + dN + '" fill="none" stroke="#41699b" stroke-width="1.9"/>';
    var cx = X(opt.param), cy = Y(opt.net);
    s += '<line x1="' + cx.toFixed(1) + '" y1="' + MT + '" x2="' + cx.toFixed(1) + '" y2="' + (H - MB) + '" stroke="#2f7d6b" stroke-dasharray="3 2"/>';
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5" fill="#2f7d6b"/>';
    s += '<text x="' + (cx + 8).toFixed(1) + '" y="' + (cy - 6).toFixed(1) + '" font-size="10.5" fill="#2f7d6b">最优 ' + opt.label + '</text>';
    s += '<text x="' + (W - MR + 6) + '" y="' + (MT + 10) + '" font-size="9" fill="#c9613f">免修期</text>';
    s += '<text x="' + (W - MR + 6) + '" y="' + (MT + 24) + '" font-size="9" fill="#c9613f">' + l0.toFixed(0) + '–' + l1.toFixed(0) + ' d</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">' + xlab + ' →</text>';
    s += '<text x="' + (ML - 6) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 日净收益</text>';
    tuneSvg.innerHTML = s;
  }

  /* ---------- 8. 主流程 ---------- */
  function draw() {
    var ql = Number(IN[0].value), wc = Number(IN[1].value), glr = Number(IN[2].value),
      H = Number(IN[3].value), sand = Number(IN[4].value), T = Number(IN[5].value);
    el("out-ql").textContent = ql + " m³/d";
    el("out-wc").textContent = wc + " %";
    el("out-glr").textContent = glr + " m³/m³";
    el("out-h").textContent = H + " m";
    el("out-sand").textContent = sand.toFixed(1) + " ‰";
    el("out-t").textContent = T + " ℃";

    /* 知识图层 */
    var R = rules(ql, wc, glr, H, sand, T);
    var sc = [score(R.esp), score(R.gl), score(R.pcp)];

    /* 寻优层（只对可用的方式搜索；不可用的也算了，图上标灰） */
    var ctx = { ql: ql, wc: wc, glr: glr, H: H, sand: sand, T: T };
    var opts = [bestEsp(ql, wc, glr, H, sand, T), bestGl(ql, wc, glr, H, sand, T), bestPcp(ql, wc, glr, H, sand, T)];
    var pick = -1, bestNet = -Infinity;
    opts.forEach(function (o, i) {
      if (sc[i].usable && o.net > bestNet) { bestNet = o.net; pick = i; }
    });

    /* 现场习惯：沿用区块在用方式（电潜泵）+ 库存泵型 220 m³/d + 50 Hz */
    var habit = esp(ql, wc, glr, H, sand, T, 220, 50);
    habit = { net: habit.net, res: habit, param: 50, pump: 220, label: "泵型 220 m³/d · 50.0 Hz" };

    drawKg(R, pick);
    drawCmp(opts, habit, pick);

    var names = ["电潜泵", "气举", "螺杆泵"];
    var kinds = ["esp", "gl", "pcp"];
    if (pick >= 0) {
      drawTune(kinds[pick], opts[pick], ctx);
    } else {
      tuneSvg.innerHTML = '<text x="20" y="40" font-size="11.5" fill="#c9613f">' +
        '三种方式都被硬判据否决：这组工况下没有可用的举升方式，需要先改工况（降排量、降温、减深）或换设备体系。</text>';
    }

    /* 读数 */
    var pEl = el("ro-pick");
    pEl.textContent = pick >= 0 ? names[pick] + " · " + opts[pick].label : "无可用方式";
    pEl.className = pick >= 0 ? "ok" : "bad";
    var nEl = el("ro-net");
    var dNet = pick >= 0 ? opts[pick].net - habit.net : 0;
    nEl.textContent = pick >= 0
      ? (opts[pick].net / 10000).toFixed(2) + " 万元/日（" + (dNet >= 0 ? "+" : "") + (dNet / 10000).toFixed(2) + " vs 习惯）"
      : "—";
    nEl.className = dNet > 0 ? "ok" : "bad";
    var lEl = el("ro-life");
    if (pick >= 0) {
      var L = opts[pick].res.life;
      lEl.textContent = L.toFixed(0) + " 天（" + (L * 0.45).toFixed(0) + "–" + (L * 1.6).toFixed(0) + "）";
      lEl.className = L > 500 ? "ok" : "bad";
    } else { lEl.textContent = "—"; lEl.className = ""; }
    var cEl = el("ro-chk");
    var okN = 0, softN = 0, hardN = 0;
    sc.forEach(function (v, i) {
      if (v.usable) okN++; else hardN++;
      softN += v.soft;
    });
    cEl.textContent = "可用 " + okN + " 种 / 受限 " + softN + " 条 / 否决 " + hardN + " 种";
    cEl.className = okN >= 1 ? "ok" : "bad";

    /* 解说 */
    var msg = "";
    if (pick < 0) {
      msg = "这一组工况下，三种举升方式都撞上了硬判据：" +
        [0, 1, 2].map(function (i) {
          var bad = [R.esp, R.gl, R.pcp][i].filter(function (r) { return r.lv === "hard"; });
          return names[i] + "（" + bad.map(function (b) { return b.nm; }).join("、") + "）";
        }).join("；") +
        "。<b>这时候正确的动作不是挑一个勉强能用的，而是改工况或换设备体系</b>——" +
        "排量、温度、泵挂深度里至少有一项要动。知识图谱的作用就在这一步：它把「为什么都不行」逐条列出来。";
    } else {
      var o = opts[pick];
      var why = [R.esp, R.gl, R.pcp][pick].filter(function (r) { return r.lv === "soft"; });
      msg = "推荐 <b>" + names[pick] + "</b>（" + o.label + "）：日净收益 <b>" +
        (o.net / 10000).toFixed(2) + " 万元</b>，其中产油收入 " +
        (income(o.res.produced, wc) / 10000).toFixed(2) + " 万、能耗与注气 " +
        ((o.res.cost - (kinds[pick] === "esp" ? COST_ESP / o.res.life : kinds[pick] === "gl" ? COST_GL / o.res.life : COST_PCP / o.res.life)) / 10000).toFixed(2) +
        " 万、检泵摊销 " +
        ((kinds[pick] === "esp" ? COST_ESP : kinds[pick] === "gl" ? COST_GL : COST_PCP) / o.res.life / 10000).toFixed(2) +
        " 万；实际产液 <b>" + o.res.produced.toFixed(0) + " m³/d</b>（供液能力 " + ql + "），免修期 " +
        o.res.life.toFixed(0) + " 天。";
      if (why.length) {
        msg += " 它也有 " + why.length + " 条软判据被点亮（" + why.map(function (w) { return w.nm; }).join("、") +
          "），所以这个推荐是有条件的，不是无条件成立。";
      }
      if (kinds[pick] === "gl") {
        msg += " 注气 " + (opts[pick].param / 10000).toFixed(1) + " 万 Nm³/d 里，伴生气自给 " +
          (Math.min(opts[pick].param, ql * glr * 0.6) / 10000).toFixed(1) + " 万、外购 " +
          (Math.max(0, opts[pick].param - ql * glr * 0.6) / 10000).toFixed(1) +
          " 万——<b>气液比高在这里是优点</b>，这也是知识图谱里那条「气源条件」判据的含义。";
      }
      var killed = [0, 1, 2].filter(function (i) { return i !== pick && !sc[i].usable; });
      if (killed.length) {
        msg += " 被硬判据否决的是：" + killed.map(function (i) {
          var bad = [R.esp, R.gl, R.pcp][i].filter(function (r) { return r.lv === "hard"; });
          return "<b>" + names[i] + "</b>（" + bad.map(function (b) { return b.nm; }).join("、") + "）";
        }).join("、") + "——" + "<b>知道为什么不行，比知道推荐什么更重要</b>。";
      }
      var runner = -1, rv = -Infinity;
      opts.forEach(function (cand, i) {
        if (i !== pick && sc[i].usable && cand.net > rv) { rv = cand.net; runner = i; }
      });
      if (runner >= 0) {
        var gap = (o.net - opts[runner].net) / o.net * 100;
        msg += " 次优是 " + names[runner] + "（" + (opts[runner].net / 10000).toFixed(2) + " 万/日），差 " +
          (gap < 1 ? gap.toFixed(2) : gap.toFixed(1)) + "%" + (gap < 3 ? "，几乎持平——这种情况下真正该看的是<b>免修期</b>：" +
            names[pick] + " " + o.res.life.toFixed(0) + " 天 vs " + names[runner] + " " +
            opts[runner].res.life.toFixed(0) + " 天。" : "。");
      }
      if (dNet > 0) {
        msg += " 与<b>现场习惯做法</b>（沿用区块在用方式 + 库存泵型 220 m³/d + 50 Hz）相比，日净收益多 <b>" +
          (dNet / 10000).toFixed(2) + " 万元</b>，一年约 " + (dNet * 365 / 10000).toFixed(0) + " 万元——";
        if (habit.res.produced < ql * 0.97) {
          msg += "差别就在<b>产量</b>：库存泵型只有 220 m³/d，供液能力 " + ql +
            " m³/d 采不出来，每天少产 " + (ql - habit.res.produced).toFixed(0) + " m³ 液。";
        } else {
          msg += "差别不在产量，而在<b>泵型与供液能力不匹配造成的欠载与电费</b>：" +
            "大泵在小供液井上欠载运行，泵效被打折，多出来的电每天都在发生。";
        }
      } else {
        msg += " 这一档上现场习惯做法反而不比寻优结果差（差 " + Math.abs(dNet / 10000).toFixed(2) +
          " 万/日）：说明<b>不是每个工况都值得优化</b>，先跑一遍判据、看到确实有差距再动手，这本身也是结论。";
      }
    }
    msg += " 注：降阶模型，价格与成本为演示取值，不可用于选型与制度设计。";
    note.innerHTML = msg;
  }

  IN.forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
