/* =========================================================
   出砂长期动态预测与防砂方案智能优选 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 知识图层：岩石强度 / 泥质含量 / 压差水平 / 射孔参数 对
      不防砂 · 独立筛管 · 砾石充填 · 化学固砂 逐条判据（硬否决、软降权）；
   ② 演化层：以临界压差为门槛、以通道扩展为正反馈，按季度推进算
      出砂速率与累计出砂量，化学固砂额外按老化曲线衰减；
   ③ 寻优层：在「方案 × 生产压差」上搜索，目标为
      净收益 = 累计产油收入 − 冲砂处置 − 防砂作业成本，
      并给出「累计出砂量 — 净收益」前沿。
   注：为演示而写的降阶模型，不可用于防砂设计与制度制定。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 常量 ---------- */
  var OIL = 3800;        /* 元/t */
  var RHO = 0.86;        /* t/m³ */
  var WC = 0.75;         /* 含水（给定） */
  var Q0 = 60;           /* 基准产液 m³/d */
  var SAND_LIM = 2.0;    /* m³：一次冲砂对应的累计出砂阈值 */
  var COST_WASH = 80000; /* 元 / 次冲砂 */
  var DECLINE = 0.10;    /* 自然递减 */

  var METHODS = [
    { key: "none", nm: "不防砂", cap: 1.0, work: 0, col: "#c9613f" },
    { key: "screen", nm: "独立筛管", cap: 0.92, work: 350000, col: "#41699b" },
    { key: "gravel", nm: "砾石充填", cap: 0.85, work: 600000, col: "#2f7d6b" },
    { key: "chem", nm: "化学固砂", cap: 0.98, work: 450000, col: "#b26a39" }
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 防砂效率（越低越能挡砂）；化学固砂随老化逐年失效 */
  function effOf(key, t) {
    if (key === "none") return 1;
    if (key === "screen") return 0.12;
    if (key === "gravel") return 0.05;
    var tau = 4;
    return 0.08 + 0.92 * Math.pow(1 - Math.exp(-t / tau), 2);
  }

  /* 产能折减：筛管随泥质堵塞、化学固砂老化后由出砂伤害体现 */
  function capOf(key, t, clay, years) {
    var c = METHODS.filter(function (m) { return m.key === key; })[0].cap;
    if (key === "screen") c *= 1 - 0.25 * (clay / 40) * (t / Math.max(years, 1));
    return c;
  }

  /* ---------- 1. 演化模型 ---------- */
  function simulate(key, ucs, clay, dp0, ramp, perf, years) {
    var dpC = ucs / 4 + 0.05 * clay;              /* 临界压差 */
    var perfF = Math.pow(16 / perf, 0.5);         /* 孔密越低，单孔流速越高 */
    var steps = years * 4, dt = 0.25;
    var cum = 0, oilCum = 0, firstWash = -1, washes = 0, washCost = 0;
    var pts = [];
    for (var i = 1; i <= steps; i++) {
      var t = i * dt;
      /* 压差随提液推进，但受地层能量与泵挂限制，不可能一直涨 */
      var dp = Math.min(dp0 * Math.pow(1 + ramp / 100, t), dp0 * 2.5);
      var over = Math.max(0, dp - dpC) / dpC;
      var rate = 1.4 * Math.pow(over, 2.0) * (1 + 0.5 * t / 6) * (0.8 + clay / 100) *
        perfF * effOf(key, t);                    /* m³/年 */
      cum += rate * dt;
      /* 产能：产液量随压差走（这就是提液能增产、也会多出砂的原因） */
      var dam = 1 / (1 + Math.pow(cum / 2.5, 1.4));   /* 出砂对产能的伤害（砂埋、卡泵） */
      var q = Q0 / 6 * dp * Math.exp(-DECLINE * t) *
        capOf(key, t, clay, years) * dam * (0.9 + 0.006 * perf);
      oilCum += q * (1 - WC) * RHO * dt * 365;    /* t */
      if (cum >= (washes + 1) * SAND_LIM) {       /* 每累积到阈值就要冲砂一次 */
        washes++;
        washCost += COST_WASH + 8 * q * (1 - WC) * RHO * OIL;   /* 作业费 + 停产 8 天 */
      }
      if (firstWash < 0 && cum >= SAND_LIM) firstWash = t;
      if (i % 4 === 0) pts.push({ t: t, cum: cum, q: q });
    }
    var net = oilCum * OIL - washCost - METHODS.filter(function (m) { return m.key === key; })[0].work;
    return {
      key: key, cum: cum, oil: oilCum, q: pts.length ? pts[pts.length - 1].q : 0,
      washes: washes, washCost: washCost, firstWash: firstWash, net: net, pts: pts, dpC: dpC,
      dpEnd: dp0 * Math.pow(1 + ramp / 100, years)
    };
  }

  /* ---------- 2. 知识图层：判据 ---------- */
  function rules(ucs, clay, dpMax, perf) {
    return {
      none: [
        { nm: "岩石强度", lv: ucs >= 18 ? "ok" : (ucs >= 12 ? "soft" : "hard"), src: "强度剖面" },
        { nm: "泥质含量", lv: clay <= 25 ? "ok" : "soft", src: "化验 31 样" },
        { nm: "压差水平", lv: dpMax <= 4 ? "ok" : (dpMax <= 6 ? "soft" : "hard"), src: "21 井次出砂" },
        { nm: "射孔参数", lv: perf >= 20 ? "ok" : "soft", src: "孔密—流速关系" }
      ],
      screen: [
        { nm: "岩石强度", lv: ucs >= 3 ? "ok" : "hard", src: "强度剖面" },
        { nm: "泥质含量", lv: clay <= 20 ? "ok" : (clay <= 30 ? "soft" : "hard"), src: "14 井次堵塞" },
        { nm: "压差水平", lv: dpMax <= 8 ? "ok" : (dpMax <= 10 ? "soft" : "hard"), src: "筛管压差上限" },
        { nm: "射孔参数", lv: perf >= 12 ? "ok" : "soft", src: "完井记录" }
      ],
      gravel: [
        { nm: "岩石强度", lv: "ok", src: "强度剖面" },
        { nm: "泥质含量", lv: clay <= 35 ? "ok" : "soft", src: "充填返出记录" },
        { nm: "压差水平", lv: dpMax <= 12 ? "ok" : "soft", src: "充填体稳定性" },
        { nm: "射孔参数", lv: perf >= 12 ? "ok" : "soft", src: "完井记录" }
      ],
      chem: [
        { nm: "岩石强度", lv: ucs >= 3 ? "ok" : "hard", src: "固结强度试验" },
        { nm: "泥质含量", lv: clay <= 15 ? "ok" : (clay <= 25 ? "soft" : "hard"), src: "19 井次胶结差" },
        { nm: "压差水平", lv: dpMax <= 8 ? "ok" : (dpMax <= 10 ? "soft" : "hard"), src: "固结体承压" },
        { nm: "射孔参数", lv: perf >= 12 ? "ok" : "soft", src: "完井记录" }
      ]
    };
  }

  function score(rs) {
    var hard = rs.filter(function (r) { return r.lv === "hard"; }).length;
    var soft = rs.filter(function (r) { return r.lv === "soft"; }).length;
    return { hard: hard, soft: soft, usable: hard === 0, s: hard ? 0 : Math.max(10, 100 - 18 * soft) };
  }

  /* ---------- 3. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var kgSvg = el("kg"), evoSvg = el("evo"), pfSvg = el("pf"), note = el("note");
  var IN = ["ucs", "clay", "dp", "ramp", "perf", "yr"].map(el);

  /* ---------- 4. 判据矩阵 ---------- */
  function drawKg(R, pickIdx) {
    var H = 240, x0 = 100, colW = 150, rowH = 32, top = 46;
    var s = "";
    s += '<text x="14" y="20" font-size="10.5" fill="#79828a">知识图层：四类条件 × 四种防砂方式（判据按<b>预测期末的最大压差</b>校核，提液幅度会改变结论）</text>';
    METHODS.forEach(function (m, c) {
      s += '<text x="' + (x0 + c * colW + 56) + '" y="' + (top - 8) + '" font-size="11" fill="#242b2e" text-anchor="middle">' +
        m.nm + (pickIdx === c ? '  ★' : '') + '</text>';
    });
    var condNames = R.none.map(function (r) { return r.nm; });
    condNames.forEach(function (nm, i) {
      var y = top + i * rowH;
      s += '<text x="14" y="' + (y + 18) + '" font-size="10.5" fill="#4d565b">' + nm + '</text>';
      METHODS.forEach(function (m, c) {
        var rule = R[m.key][i];
        var col = rule.lv === "ok" ? "#2f7d6b" : (rule.lv === "soft" ? "#b9c6cf" : "#c9613f");
        var op = rule.lv === "ok" ? 0.78 : (rule.lv === "soft" ? 0.9 : 0.8);
        var txt = rule.lv === "ok" ? "通过" : (rule.lv === "soft" ? "受限" : "不可用");
        s += '<rect x="' + (x0 + c * colW) + '" y="' + y + '" width="112" height="24" rx="4" fill="' + col + '" opacity="' + op + '"/>';
        s += '<text x="' + (x0 + c * colW + 56) + '" y="' + (y + 16) + '" font-size="10" text-anchor="middle" fill="' +
          (rule.lv === "soft" ? "#242b2e" : "#fff") + '">' + txt + '</text>';
        s += '<text x="' + (x0 + c * colW + 118) + '" y="' + (y + 16) + '" font-size="8.5" fill="#79828a">' + rule.src + '</text>';
      });
    });
    var by = top + condNames.length * rowH + 14;
    s += '<text x="14" y="' + (by + 12) + '" font-size="10.5" fill="#4d565b">适用度（硬判据直接归零）</text>';
    METHODS.forEach(function (m, c) {
      var v = score(R[m.key]);
      var w = v.s / 100 * 106;
      s += '<rect x="' + (x0 + c * colW) + '" y="' + by + '" width="106" height="14" rx="3" fill="#efece1"/>';
      s += '<rect x="' + (x0 + c * colW) + '" y="' + by + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="' +
        (v.usable ? "#41699b" : "#c9613f") + '" opacity="' + (v.usable ? 0.85 : 0.8) + '"/>';
      s += '<text x="' + (x0 + c * colW + 116) + '" y="' + (by + 12) + '" font-size="10" fill="' +
        (v.usable ? "#4d565b" : "#c9613f") + '">' + (v.usable ? v.s + " 分" : "否决") + '</text>';
    });
    s += '<text x="14" y="' + (by + 40) + '" font-size="10" fill="#79828a">★ 为寻优后的推荐方案 · 硬判据否决、软判据只降权</text>';
    kgSvg.innerHTML = s;
  }

  /* ---------- 5. 出砂演化曲线 ---------- */
  function drawEvo(sims, years, pickIdx) {
    var W = 720, H = 230, ML = 62, MR = 20, MT = 26, MB = 34;
    var y1 = Math.max(SAND_LIM * 1.6, Math.max.apply(null, sims.map(function (s) { return s.cum; })) * 1.1);
    var X = function (t) { return ML + t / years * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - v / y1) * (H - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">演化层：当前压差下各方案的累计出砂量（虚线为一次冲砂对应的阈值）</text>';
    for (var i = 0; i <= 3; i++) {
      var v = y1 * i / 3;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(1) + '</text>';
    }
    s += '<line x1="' + ML + '" y1="' + Y(SAND_LIM).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(SAND_LIM).toFixed(1) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="5 3"/>';
    s += '<text x="' + (W - MR - 6) + '" y="' + (Y(SAND_LIM) - 5).toFixed(1) + '" font-size="9.5" fill="#c9613f" text-anchor="end">冲砂阈值 ' + SAND_LIM + ' m³</text>';
    sims.forEach(function (sm, i) {
      var d = "", m = METHODS[i];
      sm.pts.forEach(function (p, k) { d += (k ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.cum).toFixed(1); });
      s += '<path d="' + d + '" fill="none" stroke="' + m.col + '" stroke-width="' + (i === pickIdx ? 2.2 : 1.4) +
        '" opacity="' + (i === pickIdx ? 1 : 0.75) + '"/>';
      if (sm.firstWash > 0 && sm.firstWash <= years) {
        s += '<circle cx="' + X(sm.firstWash).toFixed(1) + '" cy="' + Y(SAND_LIM).toFixed(1) + '" r="3.6" fill="' + m.col + '"/>';
      }
      var lastX = X(years), lastY = Y(sm.cum);
      s += '<text x="' + (lastX - 4).toFixed(1) + '" y="' + (lastY - 5).toFixed(1) + '" font-size="9.5" fill="' + m.col +
        '" text-anchor="end">' + m.nm + ' ' + sm.cum.toFixed(1) + ' m³</text>';
    });
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">生产时间（年）→</text>';
    s += '<text x="' + (ML - 6) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 累计出砂量 m³</text>';
    evoSvg.innerHTML = s;
  }

  /* ---------- 6. 前沿 ---------- */
  function drawPf(cands, cur, best, idxOf) {
    var W = 720, H = 230, ML = 66, MR = 18, MT = 26, MB = 34;
    var xs = cands.map(function (c) { return c.sand; }).concat([cur.sand]);
    var ys = cands.map(function (c) { return c.net; }).concat([cur.net]);
    var x0 = 0, x1 = Math.max.apply(null, xs) * 1.08, y0 = 0, y1 = Math.max.apply(null, ys) * 1.08;
    var X = function (v) { return ML + (v - x0) / ((x1 - x0) || 1) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">寻优层：方案 × 生产压差的全部组合（左上为佳：出砂少、净收益高）</text>';
    for (var i = 0; i <= 2; i++) {
      var v = y0 + (y1 - y0) * i / 2;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' +
        (v / 10000).toFixed(0) + '万</text>';
    }
    METHODS.forEach(function (m, k) {
      cands.filter(function (c) { return c.k === k; }).forEach(function (c) {
        s += '<circle cx="' + X(c.sand).toFixed(1) + '" cy="' + Y(c.net).toFixed(1) + '" r="2.1" fill="' + m.col + '" opacity="0.5"/>';
      });
    });
    /* 前沿：出砂更少且净收益更高的点不存在 */
    var front = cands.filter(function (p) {
      return !cands.some(function (q) {
        return q !== p && q.sand <= p.sand + 1e-9 && q.net >= p.net + 1e-3 &&
          (q.sand < p.sand - 1e-9 || q.net > p.net + 1e-3);
      });
    }).sort(function (a, b) { return a.sand - b.sand; });
    var d = "";
    front.forEach(function (p, i) { d += (i ? "L" : "M") + X(p.sand).toFixed(1) + " " + Y(p.net).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.6"/>';
    front.forEach(function (p) {
      s += '<circle cx="' + X(p.sand).toFixed(1) + '" cy="' + Y(p.net).toFixed(1) + '" r="2.8" fill="#41699b"/>';
    });
    if (best) {
      s += '<circle cx="' + X(best.sand).toFixed(1) + '" cy="' + Y(best.net).toFixed(1) + '" r="6" fill="none" stroke="#2f7d6b" stroke-width="1.8"/>';
      s += '<text x="' + (X(best.sand) + 9).toFixed(1) + '" y="' + (Y(best.net) - 6).toFixed(1) + '" font-size="10" fill="#2f7d6b">最优 ' +
        METHODS[idxOf(best.k)].nm + ' ' + best.dp.toFixed(1) + ' MPa</text>';
    }
    s += '<rect x="' + (X(cur.sand) - 4.5).toFixed(1) + '" y="' + (Y(cur.net) - 4.5).toFixed(1) + '" width="9" height="9" fill="#242b2e"/>';
    s += '<text x="' + (X(cur.sand) + 9).toFixed(1) + '" y="' + (Y(cur.net) + 14).toFixed(1) + '" font-size="10" fill="#242b2e">当前设定</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">累计出砂量（风险）→</text>';
    s += '<text x="' + (ML - 6) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 净收益</text>';
    pfSvg.innerHTML = s;
  }

  /* ---------- 7. 主流程 ---------- */
  function draw() {
    var ucs = Number(IN[0].value), clay = Number(IN[1].value), dp = Number(IN[2].value),
      ramp = Number(IN[3].value), perf = Number(IN[4].value), years = Number(IN[5].value);
    el("out-ucs").textContent = ucs + " MPa";
    el("out-clay").textContent = clay + " %";
    el("out-dp").textContent = dp.toFixed(1) + " MPa";
    el("out-ramp").textContent = ramp + " %/年";
    el("out-perf").textContent = perf + " 孔/m";
    el("out-yr").textContent = years + " 年";

    var dpMax = dp * Math.pow(1 + ramp / 100, years);
    var R = rules(ucs, clay, dpMax, perf);
    var sc = METHODS.map(function (m) { return score(R[m.key]); });

    /* 当前压差下的演化曲线 */
    var sims = METHODS.map(function (m) { return simulate(m.key, ucs, clay, dp, ramp, perf, years); });

    /* 寻优：方案 × 压差 */
    var cands = [], best = null;
    for (var k = 0; k < METHODS.length; k++) {
      for (var d2 = 1; d2 <= 14; d2 += 0.25) {
        var rr = rules(ucs, clay, d2 * Math.pow(1 + ramp / 100, years), perf);
        if (!score(rr[METHODS[k].key]).usable) continue;
        var sm = simulate(METHODS[k].key, ucs, clay, d2, ramp, perf, years);
        var c = { k: k, dp: d2, sand: sm.cum, net: sm.net, oil: sm.oil, sim: sm };
        cands.push(c);
        if (!best || c.net > best.net) best = c;
      }
    }
    var idxOf = function (k) { return k; };
    var pick = best;
    var pickIdx = best ? best.k : -1;
    var curSim = pick ? sims[pick.k] : sims[0];
    var cur = { k: pick ? pick.k : 0, dp: dp, sand: curSim.cum, net: curSim.net, oil: curSim.oil, sim: curSim };

    drawKg(R, pickIdx);
    drawEvo(sims, years, pickIdx);
    drawPf(cands, cur, best, idxOf);

    /* 读数 */
    var pEl = el("ro-pick");
    pEl.textContent = pick ? METHODS[pick.k].nm + " · " + pick.dp.toFixed(1) + " MPa" : "无可用方案";
    pEl.className = pick ? "ok" : "bad";
    var oEl = el("ro-oil");
    var refOil = simulate("none", ucs, clay, dp, ramp, perf, years).oil;
    oEl.textContent = pick
      ? (pick.oil / 1000).toFixed(1) + " kt（不防砂基准 " + (refOil / 1000).toFixed(1) + " kt）"
      : "—";
    oEl.className = pick && pick.oil > refOil * 0.95 ? "ok" : "bad";
    var fEl = el("ro-first");
    if (pick) {
      fEl.textContent = curSim.firstWash > 0 ? "第 " + curSim.firstWash.toFixed(1) + " 年" : "预测期内无需冲砂";
      fEl.className = curSim.firstWash > 0 ? "bad" : "ok";
    } else { fEl.textContent = "—"; fEl.className = ""; }
    var cEl = el("ro-chk");
    var okN = sc.filter(function (v) { return v.usable; }).length;
    var softN = sc.reduce(function (a, v) { return a + (v.usable ? v.soft : 0); }, 0);
    cEl.textContent = "可用 " + okN + " 种 / 受限 " + softN + " 条 / 否决 " + (4 - okN) + " 种";
    cEl.className = okN >= 1 ? "ok" : "bad";

    /* 解说 */
    var msg = "";
    var dpC = sims[0].dpC;
    if (!pick) {
      msg = "这一组条件下四种防砂方式都撞上了硬判据：" +
        METHODS.map(function (m) {
          var bad = R[m.key].filter(function (r) { return r.lv === "hard"; });
          return m.nm + "（" + bad.map(function (b) { return b.nm; }).join("、") + "）";
        }).join("；") +
        "。<b>这时该做的不是挑一个勉强能用的，而是先降压差或改射孔参数</b>——" +
        "临界压差只有 <b>" + dpC.toFixed(1) + " MPa</b>，而预测期末压差会到 <b>" + dpMax.toFixed(1) +
        " MPa</b>，幅度降下来往往比换方案更划算。";
    } else {
      msg = "临界压差 <b>" + dpC.toFixed(1) + " MPa</b>（强度 " + ucs + " MPa、泥质 " + clay +
        "%），当前压差 " + dp.toFixed(1) + " MPa、按每年提液 " + ramp + "% 推进，预测期末压差 <b>" +
        dpMax.toFixed(1) + " MPa</b>。推荐 <b>" + METHODS[pick.k].nm + " · 生产压差 " + pick.dp.toFixed(1) +
        " MPa</b>：预测期内累计产油 " + (pick.oil / 1000).toFixed(1) + " kt、累计出砂 " +
        pick.sand.toFixed(2) + " m³、冲砂 " + pick.sim.washes + " 次。";
      var dpEndOpt = pick.dp * Math.pow(1 + ramp / 100, years);
      if (dpEndOpt > dpC) {
        msg += " 推荐压差下，预测期末压差 <b>" + dpEndOpt.toFixed(1) + " MPa</b> 已越过临界值（超出 " +
          ((dpEndOpt / dpC - 1) * 100).toFixed(0) +
          "%），出砂一旦形成通道就会自我加速——这正是不能只看第一年产量的原因。";
      } else {
        msg += " 推荐压差下预测期末压差 " + dpEndOpt.toFixed(1) +
          " MPa，仍在临界值以内，这时<b>防砂就不是必须项</b>，模型应当如实把这一点算出来。";
      }
      var killed = METHODS.map(function (m, i) { return i; }).filter(function (i) { return !sc[i].usable && i !== pick.k; });
      if (killed.length) {
        msg += " 被硬判据否决的是：" + killed.map(function (i) {
          var bad = R[METHODS[i].key].filter(function (r) { return r.lv === "hard"; });
          return "<b>" + METHODS[i].nm + "</b>（" + bad.map(function (b) { return b.nm; }).join("、") + "）";
        }).join("、") + "。";
      }
      var gapDp = pick.dp - dp;
      if (Math.abs(gapDp) > 0.3) {
        msg += " 与你设定的压差差 " + (gapDp > 0 ? "+" : "") + gapDp.toFixed(1) + " MPa：" +
          (gapDp > 0
            ? "在选中的方案下<b>压差还能再提一点</b>，产量还有空间。"
            : "当前压差偏高，<b>把压差降下来比换方案便宜</b>——这一类结论最容易被忽略，因为它要求减产。") +
          " 净收益差 " + ((pick.net - cur.net) / 10000).toFixed(0) + " 万元。";
      } else {
        msg += " 你设定的压差已经在最优附近（差 " + Math.abs(gapDp).toFixed(1) + " MPa）。";
      }
      if (pick.k === 3) {
        msg += " 注意化学固砂的<b>老化</b>：它的挡砂能力随年份衰减，曲线在前两年很好看，后面会追上来——" +
          "短期试产看不出这个差别。";
      }
      /* 过度防砂提示：如果不防砂也可用，且最优值差距很小，就不要白付附加表皮 */
      var bestNone = null;
      cands.forEach(function (c) { if (c.k === 0 && (!bestNone || c.net > bestNone.net)) bestNone = c; });
      if (bestNone && pick.k !== 0) {
        var dNone = (pick.net - bestNone.net) / Math.abs(pick.net) * 100;
        if (dNone < 2) {
          msg += " 提醒：<b>不防砂的最优点只差 " + dNone.toFixed(1) + "%</b>（不防砂 " +
            bestNone.dp.toFixed(1) + " MPa 时净收益 " + (bestNone.net / 10000).toFixed(0) + " 万）——" +
            "这种情况下装防砂管柱的附加表皮是白付的产能，<b>「保守一点」本身有代价</b>。";
        } else if (pick.dp > bestNone.dp + 1) {
          msg += " 值得注意：不防砂能用的压差上限只有 <b>" + bestNone.dp.toFixed(1) + " MPa</b>，而选中的方案能把压差提到 <b>" +
            pick.dp.toFixed(1) + " MPa</b>——<b>防砂的价值不在于「防」，而在于把压差上限抬上去</b>，多出来的产量才是收益来源。";
        }
      }
      if (pick.k === 2 && cur.sand < 0.5) {
        msg += " 也要看到代价：砾石充填的附加表皮让产能打了折（" +
          (METHODS[2].cap * 100).toFixed(0) + "%），如果这口井本来就不出砂，这份产能损失是白付的。";
      }
    }
    msg += " 注：降阶模型，价格与阈值均为演示取值，不可用于防砂设计与制度制定。";
    note.innerHTML = msg;
  }

  IN.forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
