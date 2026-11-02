/* =========================================================
   完井液体系智能优选与配方设计 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 知识图谱层：按粘土含量划敏感档，查「敏感档 × 体系」配伍矩阵，
     得到配伍性与可用体系（耐温/配伍做可行域剪枝）；
   ② 伤害模型：把损失拆成五类机理 → 渗透率恢复值 Krec；
   ③ 在体系 × 暂堵剂 × 防膨剂的网格上枚举，用滤失与预算做约束，
     给出帕累托前沿和预算内最优。
   注：这是演示用的降阶模型，不是岩心驱替实验结果。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 体系与知识图谱 ---------- */
  /* hyd 滤液使粘土水化的能力 · inv 侵入伤害 · emu 乳化倾向 · scale 结垢/化学不配伍
     Tmax 耐温上限 ℃ · cake 滤饼建造能力 · flBase 基础滤失 mL · cost 相对单方成本 */
  var FLUIDS = [
    { nm: "低固相水基", hyd: 1.00, inv: 0.90, emu: 0.25, scale: 0.55, Tmax: 130, cake: 0.55, flBase: 5.5, cost: 1.00 },
    { nm: "清洁盐水", hyd: 0.72, inv: 0.55, emu: 0.15, scale: 0.75, Tmax: 150, cake: 0.35, flBase: 7.0, cost: 1.60 },
    { nm: "油基", hyd: 0.15, inv: 0.30, emu: 0.85, scale: 0.30, Tmax: 165, cake: 0.80, flBase: 3.2, cost: 3.20 },
    { nm: "合成基", hyd: 0.22, inv: 0.35, emu: 0.55, scale: 0.35, Tmax: 170, cake: 0.72, flBase: 3.6, cost: 2.60 },
    { nm: "弱凝胶暂堵", hyd: 0.85, inv: 0.50, emu: 0.20, scale: 0.50, Tmax: 120, cake: 0.92, flBase: 2.4, cost: 1.90 }
  ];

  /* 知识图谱：敏感档（由粘土含量划分）→ 各体系配伍性 0–1 */
  var CLUSTERS = [
    { nm: "低敏", lo: 0, hi: 8 },
    { nm: "中敏", lo: 8, hi: 15 },
    { nm: "高敏", lo: 15, hi: 22 },
    { nm: "特高敏", lo: 22, hi: 99 }
  ];
  var COMPAT = [
    [0.92, 0.95, 0.85, 0.88, 0.90],
    [0.80, 0.92, 0.88, 0.90, 0.85],
    [0.62, 0.88, 0.90, 0.92, 0.78],
    [0.45, 0.80, 0.92, 0.95, 0.70]
  ];
  /* 案例库：每个「敏感档 × 体系」组合的历史应用井次（用于提示证据是否够） */
  var HIST = [
    [46, 22, 5, 8, 14],
    [38, 31, 9, 12, 17],
    [19, 24, 14, 15, 11],
    [7, 12, 11, 9, 6]
  ];

  var MECH = [
    { nm: "粘土水化 / 分散", c: "#41699b" },
    { nm: "滤液与固相侵入", c: "#2f7d6b" },
    { nm: "乳化 / 润湿反转", c: "#b26a39" },
    { nm: "结垢 / 化学不配伍", c: "#c9613f" },
    { nm: "高温降解损失", c: "#8d9298" }
  ];

  var FL_LIMIT = 8.0;   /* API 滤失上限 mL */

  function clusterOf(clay) {
    for (var i = 0; i < CLUSTERS.length; i++) if (clay >= CLUSTERS[i].lo && clay < CLUSTERS[i].hi) return i;
    return CLUSTERS.length - 1;
  }

  /* ---------- 1. 伤害模型 ---------- */
  function damage(fi, clay, T, dp, fps, stab) {
    var f = FLUIDS[fi];
    var cl = clusterOf(clay);
    var compat = COMPAT[cl][fi];
    var cs = 1.30 - compat * 0.75;              /* 配伍因子：越配伍，各类伤害越小 */
    var plug = 1 - Math.exp(-(0.35 + f.cake) * fps / 1.8);   /* 暂堵形成的滤饼封堵率 */
    var inhib = 0.85 * (1 - Math.exp(-stab / 1.6));          /* 防膨剂抑制效率 */

    var dClay = 2.04 * clay * f.hyd * (1 - inhib) * cs;
    var dInv = 20 * (dp / 25) * f.inv * (1 - plug) * cs;
    var dEmu = 9 * f.emu * (0.4 + dp / 25) * cs;
    var dScale = 9 * f.scale * (T / 150) * cs;
    var dTherm = 8 * Math.max(0, T - f.Tmax) / 15;

    var arr = [dClay, dInv, dEmu, dScale, dTherm];
    var sum = 0;
    arr.forEach(function (v) { sum += v; });
    return {
      d: arr, sum: sum, krec: Math.max(25, Math.min(100, 100 - sum)), compat: compat,
      fl: f.flBase * (0.5 + dp / 25) * (1 - 0.65 * plug) + 0.8,
      cost: f.cost + 0.42 * fps + 1.10 * stab
    };
  }

  function feasible(fi, T, cost, fl, budget) {
    return T <= FLUIDS[fi].Tmax + 10 && cost <= budget + 1e-9 && fl <= FL_LIMIT + 1e-9;
  }

  /* ---------- 2. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var clayIn = el("clay"), tempIn = el("temp"), dpIn = el("dp"),
    fpsIn = el("fps"), stabIn = el("stab"), bgIn = el("bg");
  var dm = el("dm"), pf = el("pf"), note = el("note"), rowEl = el("fluidrow");
  var kgSvg = el("kg");
  var tB = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };
  var cur = 0;

  var btns = FLUIDS.map(function (f, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = f.nm;
    b.className = i === cur ? "on" : "";
    b.addEventListener("click", function () { cur = i; draw(); });
    rowEl.appendChild(b);
    return b;
  });

  /* ---------- 3. 绘图 ---------- */
  function drawMech(res) {
    var W = 720, H = 200, ML = 168, MR = 108, PT = 14, rh = 32;
    var maxV = 1;
    res.d.forEach(function (v) { maxV = Math.max(maxV, v); });
    maxV = Math.ceil(maxV / 5) * 5;
    var bw = (W - ML - MR);
    var s = '<text x="' + ML + '" y="' + (PT - 2) + '" font-size="9.5" fill="#79828a">' +
      '各类机理造成的渗透率损失（百分点，合计 ' + res.sum.toFixed(1) + '）</text>';
    res.d.forEach(function (v, i) {
      var y = PT + 6 + i * rh;
      var w = v / maxV * bw;
      s += '<text x="' + (ML - 9) + '" y="' + (y + 15) + '" font-size="11" fill="#242b2e" text-anchor="end">' + MECH[i].nm + '</text>';
      s += '<rect x="' + ML + '" y="' + y + '" width="' + bw + '" height="20" fill="#f4f2e9" rx="2"/>';
      s += '<rect x="' + ML + '" y="' + y + '" width="' + Math.max(0.6, w).toFixed(1) + '" height="20" fill="' + MECH[i].c + '" opacity=".88" rx="2"/>';
      s += '<text x="' + (ML + bw + 7) + '" y="' + (y + 14) + '" font-size="10.5" fill="#4d565b" font-family="monospace">' +
        v.toFixed(1) + '</text>';
    });
    dm.innerHTML = s;
  }

  /* ---------- 知识图谱层：配伍矩阵 + 剪枝清单 ---------- */
  function drawKg(cl, T, budget, curFi) {
    var shortNm = ["低固相", "清洁盐水", "油基", "合成基", "弱凝胶"];
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">知识图谱层：敏感档 × 体系的配伍性（格内为配伍性 / 历史井次），深色格＝本井所在档</text>';
    var x0 = 118, colW = 100, y0 = 46, rowH = 32;
    shortNm.forEach(function (nm, j) {
      s += '<text x="' + (x0 + j * colW + colW / 2) + '" y="38" font-size="9" fill="#4d565b" text-anchor="middle">' + nm + '</text>';
    });
    CLUSTERS.forEach(function (c, i) {
      s += '<text x="' + (x0 - 8) + '" y="' + (y0 + i * rowH + 20) + '" font-size="9.5" fill="' +
        (i === cl ? "#242b2e" : "#79828a") + '" text-anchor="end">' + c.nm + ' ' + c.lo + '–' +
        (c.hi > 90 ? "28" : c.hi) + '%</text>';
      FLUIDS.forEach(function (f, j) {
        var cp = COMPAT[i][j], n = HIST[i][j];
        var op = (0.12 + (cp - 0.4) / 0.6 * 0.8).toFixed(2);
        var isCur = (i === cl && j === curFi);
        s += '<rect x="' + (x0 + j * colW) + '" y="' + (y0 + i * rowH) + '" width="' + (colW - 3) + '" height="' +
          (rowH - 3) + '" rx="3" fill="#2f7d6b" opacity="' + op + '"' +
          (isCur ? ' stroke="#242b2e" stroke-width="1.6"' : (i === cl ? ' stroke="#e2ded0"' : '')) + '/>';
        s += '<text x="' + (x0 + j * colW + 8) + '" y="' + (y0 + i * rowH + 14) + '" font-size="9.5" fill="' +
          (cp > 0.75 ? "#fff" : "#242b2e") + '">' + (cp * 100).toFixed(0) + '%</text>';
        s += '<text x="' + (x0 + j * colW + 8) + '" y="' + (y0 + i * rowH + 26) + '" font-size="8.5" fill="' +
          (cp > 0.75 ? "#e4efea" : "#5a636a") + '">n=' + n + (n < 10 ? "（证据少）" : "") + '</text>';
      });
    });
    /* 剪枝清单 */
    s += '<line x1="14" y1="' + (y0 + CLUSTERS.length * rowH + 6) + '" x2="706" y2="' + (y0 + CLUSTERS.length * rowH + 6) +
      '" stroke="#e2ded0"/>';
    s += '<text x="14" y="' + (y0 + CLUSTERS.length * rowH + 24) + '" font-size="10" fill="#4d565b">剪枝清单（发生在寻优之前）：</text>';
    var bx = 176;
    FLUIDS.forEach(function (f, j) {
      var okT = T <= f.Tmax + 10, okB = f.cost <= budget;
      var pass = okT && okB;
      var col = pass ? "#2f7d6b" : "#c9613f";
      s += '<rect x="' + (bx + j * 106) + '" y="' + (y0 + CLUSTERS.length * rowH + 12) + '" width="100" height="20" rx="3" fill="' +
        col + '" opacity="' + (pass ? 0.15 : 0.12) + '" stroke="' + col + '"/>';
      s += '<text x="' + (bx + j * 106 + 6) + '" y="' + (y0 + CLUSTERS.length * rowH + 26) + '" font-size="8.5" fill="' +
        (pass ? "#2f7d6b" : "#c9613f") + '">' + shortNm[j] + ' ' + (pass ? "可用" : (!okT ? "超耐温" : "超预算")) + '</text>';
    });
    s += '<text x="14" y="' + (y0 + CLUSTERS.length * rowH + 44) + '" font-size="10" fill="#4d565b">配伍性与耐温是' +
      tB("硬约束") + '：不满足的体系根本不进候选集——所以后面的寻优只需在剩下的组合里比成本与恢复率。</text>';
    kgSvg.innerHTML = s;
  }

  function drawPareto(cands, best, curPt, budget) {
    var W = 720, H = 260, ML = 52, MR = 16, MT = 16, MB = 34;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    cands.forEach(function (p) {
      x0 = Math.min(x0, p.cost); x1 = Math.max(x1, p.cost);
      y0 = Math.min(y0, p.krec); y1 = Math.max(y1, p.krec);
    });
    if (curPt) {
      x0 = Math.min(x0, curPt.cost); x1 = Math.max(x1, curPt.cost);
      y0 = Math.min(y0, curPt.krec); y1 = Math.max(y1, curPt.krec);
    }
    var px = (x1 - x0) * 0.06 || 0.2, py = (y1 - y0) * 0.08 || 1;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    var X = function (v) { return ML + (v - x0) / (x1 - x0) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - y0) / (y1 - y0)) * (H - MT - MB); };

    var s = "";
    [0, 0.5, 1].forEach(function (f) {
      var v = y0 + (y1 - y0) * f;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" ' +
        'font-family="monospace">' + v.toFixed(0) + '</text>';
    });
    /* 预算竖线 */
    s += '<line x1="' + X(budget).toFixed(1) + '" y1="' + MT + '" x2="' + X(budget).toFixed(1) + '" y2="' + (H - MB) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (X(budget) - 5).toFixed(1) + '" y="' + (MT + 10) + '" font-size="9.5" fill="#c9613f" text-anchor="end">预算上限</text>';

    /* 全部候选 */
    cands.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.krec).toFixed(1) + '" r="2.1" fill="#b9c6cf" opacity=".75"/>';
    });
    /* 帕累托前沿 */
    var d = "", front = [];
    cands.forEach(function (p) { front.push(p); });
    front.sort(function (a, b) { return a.cost - b.cost; });
    var mk = -1, line = [];
    front.forEach(function (p) {
      if (p.krec > mk + 1e-9) { mk = p.krec; line.push(p); }
    });
    line.forEach(function (p, i) {
      d += (i ? "L" : "M") + X(p.cost).toFixed(1) + " " + Y(p.krec).toFixed(1);
    });
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.5" stroke-linejoin="round"/>';
    line.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.krec).toFixed(1) + '" r="2.8" fill="#41699b"/>';
    });
    /* 当前配方 */
    if (curPt) {
      s += '<rect x="' + (X(curPt.cost) - 4).toFixed(1) + '" y="' + (Y(curPt.krec) - 4).toFixed(1) +
        '" width="8" height="8" fill="#242b2e"/>';
      s += '<text x="' + (X(curPt.cost) + 9).toFixed(1) + '" y="' + (Y(curPt.krec) + 14).toFixed(1) +
        '" font-size="10" fill="#242b2e">当前</text>';
    }
    /* 预算内最优 */
    s += '<circle cx="' + X(best.cost).toFixed(1) + '" cy="' + Y(best.krec).toFixed(1) + '" r="5" fill="none" ' +
      'stroke="#2f7d6b" stroke-width="1.6"/>';
    s += '<text x="' + (X(best.cost) + 8).toFixed(1) + '" y="' + (Y(best.krec) - 6).toFixed(1) +
      '" font-size="10" fill="#2f7d6b">最优 ' + best.krec.toFixed(1) + '%</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">单方成本（相对指数）→</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 渗透率恢复值 %</text>';
    pf.innerHTML = s;
  }

  /* ---------- 4. 主流程 ---------- */
  function draw() {
    var clay = Number(clayIn.value), T = Number(tempIn.value), dp = Number(dpIn.value),
      fps = Number(fpsIn.value), stab = Number(stabIn.value), budget = Number(bgIn.value);

    el("out-clay").textContent = clay + " %";
    el("out-temp").textContent = T + " ℃";
    el("out-dp").textContent = dp + " MPa";
    el("out-fps").textContent = fps.toFixed(2) + " %";
    el("out-stab").textContent = stab.toFixed(1) + " %";
    el("out-bg").textContent = budget.toFixed(1);
    btns.forEach(function (b, i) { b.className = i === cur ? "on" : ""; });

    var cl = clusterOf(clay);
    var res = damage(cur, clay, T, dp, fps, stab);
    var overTemp = T > FLUIDS[cur].Tmax + 10;

    /* 枚举：体系 × 暂堵剂 × 防膨剂 */
    var cands = [], best = null;
    for (var fi = 0; fi < FLUIDS.length; fi++) {
      for (var a = 0; a <= 5.0001; a += 0.5) {
        for (var b = 0; b <= 3.0001; b += 0.25) {
          var r = damage(fi, clay, T, dp, a, b);
          if (!feasible(fi, T, r.cost, r.fl, budget)) continue;
          var pt = { fi: fi, fps: a, stab: b, cost: r.cost, krec: r.krec, fl: r.fl, compat: r.compat };
          cands.push(pt);
          if (!best || r.krec > best.krec + 1e-9 ||
            (Math.abs(r.krec - best.krec) <= 1e-9 && r.cost < best.cost)) best = pt;
        }
      }
    }

    drawMech(res);
    drawKg(cl, T, budget, cur);
    drawPareto(cands, best, { cost: res.cost, krec: res.krec }, budget);

    /* 读数 */
    var kEl = el("ro-krec");
    kEl.textContent = res.krec.toFixed(1) + " %";
    kEl.className = res.krec >= 80 ? "ok" : (res.krec >= 70 ? "" : "bad");
    var mainIdx = 0, mv = -1;
    res.d.forEach(function (v, i) { if (v > mv) { mv = v; mainIdx = i; } });
    el("ro-main").textContent = MECH[mainIdx].nm + " " + (mv / res.sum * 100).toFixed(0) + "%";
    var cEl = el("ro-cons");
    cEl.textContent = res.fl.toFixed(1) + " mL / " + res.cost.toFixed(2);
    cEl.className = (res.fl <= FL_LIMIT && res.cost <= budget) ? "ok" : "bad";
    var gain = (best ? best.krec - res.krec : 0);
    var gEl = el("ro-gain");
    gEl.textContent = (gain >= 0 ? "+" : "") + gain.toFixed(1) + " 个百分点";
    gEl.className = gain > 2 ? "ok" : "";

    /* 解说 */
    var msg = "当前：" + FLUIDS[cur].nm + " + 暂堵 " + fps.toFixed(2) + "% + 防膨 " + stab.toFixed(1) + "%，" +
      "恢复值 <b>" + res.krec.toFixed(1) + "%</b>。知识图谱把本井判为 <b>" + CLUSTERS[cl].nm +
      "</b>（粘土 " + clay + "%），该体系配伍性 <b>" + (res.compat * 100).toFixed(0) + "%</b>，" +
      "案例库里有 <b>" + HIST[cl][cur] + " 井次</b>同类组合的记录";
    msg += HIST[cl][cur] < 10 ? "——<b>证据偏少</b>，这个推荐要打个折扣看。" : "，属于有支撑的组合。";
    if (overTemp) {
      msg += " 但地层温度 " + T + " ℃ 已超过该体系耐温上限 " + FLUIDS[cur].Tmax +
        " ℃：<b>这个候选在高温段会降解失效</b>，图谱应当先把它剪掉。";
    }
    if (best) {
      msg += " 约束内最优是 <b>" + FLUIDS[best.fi].nm + " + 暂堵 " + best.fps.toFixed(2) + "% + 防膨 " +
        best.stab.toFixed(1) + "%</b>（成本 " + best.cost.toFixed(2) + "、滤失 " + best.fl.toFixed(1) +
        " mL、恢复值 <b>" + best.krec.toFixed(1) + "%</b>）";
      if (gain <= 0.05) {
        msg += "。当前配方已经不比它差，但自己也踩在预算线上——这时候该做的不是继续加剂量，" +
          "而是<b>先把预算这条约束摆到台面上</b>，或者接受一个成本更低、恢复率略降的邻近点。";
      } else {
        msg += "，比当前配方高 " + gain.toFixed(1) + " 个百分点。";
      }
      if (gain > 6) {
        msg += " 差距主要来自 <b>" + MECH[mainIdx].nm + "</b>——这正是不先做配伍剪枝时最容易踩的坑：" +
          "体系选错之后，再怎么调添加剂加量也补不回来。";
      } else if (gain > 0.05 && gain < 1) {
        msg += " 已经在最优附近了，继续加剂量只会增加成本而不涨恢复值——可以往下看帕累托前沿上更便宜的点。";
      }
    } else {
      msg += " 当前预算下<b>没有任何可行配方</b>：预算必须放宽到能容纳至少一个体系，或者先接受较高的伤害。";
    }
    msg += " 注：这是演示用的降阶伤害模型，绝对值不可用于作业设计，看的是各机理的<b>相对构成</b>。";
    note.innerHTML = msg;
  }

  [clayIn, tempIn, dpIn, fpsIn, stabIn, bgIn].forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
