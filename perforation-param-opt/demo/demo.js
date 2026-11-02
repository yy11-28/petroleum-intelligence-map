/* =========================================================
   射孔参数智能设计 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   用两条拟合式扮演「机理模型批量样本训练出来的代理模型」：
     prodRatio(n, θ, Lp) → 产能比 PR（射孔表皮分解的简化拟合）
     sandRisk(n, θ, Lp, UCS) → 出砂风险（0–1 代理指标）
   在这两个毫秒级模型上穷举参数组合，求帕累托前沿，
   再按给定的出砂容忍度选出约束下的最优组合。
   ========================================================= */
(function () {
  "use strict";

  var PHASE = [0, 60, 90, 120, 180];      /* 可选相位 */
  var SMAX = 5.6, SMIN = -1.7;            /* 射孔表皮的上下界（机理模型标定后的取值） */
  var RW = 0.108, RE = 300, DMG = 0.30;   /* 井眼半径 / 泄流半径 / 损害深度，m */
  var KD = 0.5;                           /* 损害带渗透率比 */
  var SD = (1 / KD - 1) * Math.log((RW + DMG) / RW);   /* 钻井损害表皮 */
  var LNRE = Math.log(RE / RW);
  var STD = { n: 13, ph: 1, pen: 300 };   /* 现场「标准方案」，作为对比基准 */

  /* ---------- 代理模型（目标 1：产能比） ---------- */
  function prodRatio(n, phIdx, pen) {
    var x = PHASE[phIdx] / 180;
    var y = Math.min(1, n / 24);
    var z = Math.min(1, (pen / 1000) / DMG / 2);
    var w = (0.50 + 0.50 * x) * (0.70 + 0.30 * y) * (0.55 + 0.45 * z);
    var s = SMAX - (SMAX - SMIN) * w;
    return { pr: LNRE / (LNRE + s + SD), skin: s };
  }

  /* ---------- 代理模型（目标 2：出砂风险 0–1） ---------- */
  function sandRisk(n, phIdx, pen, ucs) {
    var x = PHASE[phIdx] / 180;
    var drive = Math.pow(n / 40, 1.2) *
      (1.25 - 0.55 * x) *
      (0.75 + 0.5 * pen / 800) *
      Math.pow(60 / ucs, 1.2);
    return 1 - Math.exp(-1.15 * drive);
  }

  /* ---------- 搜索网格 ---------- */
  var GRID_N = [], GRID_P = [], i;
  for (i = 6; i <= 40; i += 2) GRID_N.push(i);
  for (i = 100; i <= 800; i += 50) GRID_P.push(i);

  function enumerate(ucs) {
    var pts = [];
    for (var a = 0; a < PHASE.length; a++) {
      for (var b = 0; b < GRID_N.length; b++) {
        for (var c = 0; c < GRID_P.length; c++) {
          pts.push({
            n: GRID_N[b], ph: a, pen: GRID_P[c],
            pr: prodRatio(GRID_N[b], a, GRID_P[c]).pr,
            r: sandRisk(GRID_N[b], a, GRID_P[c], ucs)
          });
        }
      }
    }
    return pts;
  }

  /* 非支配解：最大化 PR、最小化 R */
  function pareto(pts) {
    var sorted = pts.slice().sort(function (p, q) { return q.pr - p.pr; });
    var out = [], best = Infinity;
    sorted.forEach(function (p) {
      if (p.r < best - 1e-9) { out.push(p); best = p.r; }
    });
    return out;
  }

  /* ---------- DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var nIn = el("nd"), phIn = el("ph"), penIn = el("pen"), ucsIn = el("ucs"), rIn = el("rlim");
  var svg = el("pareto"), note = el("note");
  var sensSvg = el("sens"), skinSvg = el("skin");

  var W = 720, H = 300, ML = 52, MR = 16, MT = 16, MB = 34;
  var tB = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };

  /* ---------- 单参数灵敏度：单独调一个能拿多少 ---------- */
  function drawSens(n, phIdx, pen, ucs, rLim) {
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">单参数灵敏度（其它参数固定为当前值）：实线＝产能比 PR，虚线＝出砂风险；竖线是当前取值</text>';
    var panels = [
      { nm: "孔密（孔/m）", xs: GRID_N.slice(0), f: function (v) { return prodRatio(v, phIdx, pen).pr; },
        g: function (v) { return sandRisk(v, phIdx, pen, ucs); }, cur: n },
      { nm: "相位（°）", xs: [0, 1, 2, 3, 4], f: function (v) { return prodRatio(n, v, pen).pr; },
        g: function (v) { return sandRisk(n, v, pen, ucs); }, cur: phIdx, lab: function (v) { return PHASE[v]; } },
      { nm: "穿深（mm）", xs: GRID_P.slice(0), f: function (v) { return prodRatio(n, phIdx, v).pr; },
        g: function (v) { return sandRisk(n, phIdx, v, ucs); }, cur: pen }
    ];
    panels.forEach(function (p, i) {
      var x0 = 24 + i * 232, x1 = x0 + 200, yTop = 40, yBot = 160;
      var prs = p.xs.map(p.f);
      var lo = Math.min.apply(null, prs), hi = Math.max.apply(null, prs);
      if (hi - lo < 1e-6) { hi = lo + 1e-6; }
      var PY = function (v) { return yBot - (v - lo) / (hi - lo) * (yBot - yTop); };
      var PX = function (k) { return x0 + k / Math.max(1, p.xs.length - 1) * (x1 - x0); };
      s += '<rect x="' + x0 + '" y="' + yTop + '" width="' + (x1 - x0) + '" height="' + (yBot - yTop) + '" fill="#fbfaf6" stroke="#e2ded0"/>';
      s += '<text x="' + x0 + '" y="' + (yTop - 6) + '" font-size="10" fill="#4d565b">' + p.nm + '</text>';
      s += '<text x="' + x1 + '" y="' + (yTop - 6) + '" font-size="9" fill="#79828a" text-anchor="end">PR ' +
        lo.toFixed(3) + ' → ' + hi.toFixed(3) + '</text>';
      var d = "", dr = "";
      p.xs.forEach(function (v, k) {
        d += (k ? "L" : "M") + PX(k).toFixed(1) + " " + PY(p.f(v)).toFixed(1);
        dr += (k ? "L" : "M") + PX(k).toFixed(1) + " " + (yBot - p.g(v) * (yBot - yTop)).toFixed(1);
      });
      s += '<path d="' + dr + '" fill="none" stroke="#b26a39" stroke-dasharray="4 3" stroke-width="1.2"/>';
      s += '<path d="' + d + '" fill="none" stroke="#2f7d6b" stroke-width="1.8"/>';
      /* 当前取值 */
      var ki = 0, bd = 1e9;
      p.xs.forEach(function (v, k) { var dd = Math.abs(v - p.cur); if (dd < bd) { bd = dd; ki = k; } });
      s += '<line x1="' + PX(ki).toFixed(1) + '" y1="' + yTop + '" x2="' + PX(ki).toFixed(1) + '" y2="' + yBot +
        '" stroke="#242b2e" stroke-dasharray="3 2"/>';
      s += '<circle cx="' + PX(ki).toFixed(1) + '" cy="' + PY(p.f(p.xs[ki])).toFixed(1) + '" r="3.4" fill="#242b2e"/>';
      s += '<circle cx="' + PX(ki).toFixed(1) + '" cy="' + (yBot - p.g(p.xs[ki]) * (yBot - yTop)).toFixed(1) +
        '" r="3" fill="none" stroke="#b26a39" stroke-width="1.4"/>';
      s += '<text x="' + PX(ki).toFixed(1) + '" y="' + (yBot + 14) + '" font-size="9" fill="#242b2e" text-anchor="middle">' +
        (p.lab ? p.lab(p.cur) : p.cur) + '</text>';
      s += '<text x="' + x0 + '" y="' + (yBot + 28) + '" font-size="9" fill="#2f7d6b">— 产能比</text>';
      s += '<text x="' + (x0 + 62) + '" y="' + (yBot + 28) + '" font-size="9" fill="#b26a39">-- 出砂风险（0–1）</text>';
      s += '<line x1="' + x0 + '" y1="' + (yBot - rLim * (yBot - yTop)).toFixed(1) + '" x2="' + x1 +
        '" y2="' + (yBot - rLim * (yBot - yTop)).toFixed(1) + '" stroke="#c9613f" stroke-width="1"/>';
    });
    s += '<text x="14" y="196" font-size="10" fill="#4d565b">曲线的' + tB("斜率") + '就是「这个参数还值不值得调」：平缓段再怎么调也拿不到产能，陡峭段一两个步长就有差别；</text>';
    s += '<text x="14" y="211" font-size="10" fill="#4d565b">红横线是出砂容忍上限，虚线越过它就说明这条路上' + tB("产能还没到手、风险先到顶") + '。</text>';
    sensSvg.innerHTML = s;
  }

  /* ---------- 表皮分解与三方案对比 ---------- */
  function drawSkin(n, phIdx, pen, ucs, best, curPr, stdPr) {
    var cur = prodRatio(n, phIdx, pen), std = prodRatio(STD.n, STD.ph, STD.pen);
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">为什么产能会变：表皮分解（射孔表皮常常是' + tB("负的") + '，它抵消钻井损害）</text>';
    var rows = [
      { nm: "标准方案 13 孔/m · 60° · 300 mm", sk: std.skin, pr: stdPr, col: "#b9c6cf" },
      { nm: "当前组合", sk: cur.skin, pr: curPr, col: "#2f7d6b" },
      { nm: "约束下最优", sk: best ? prodRatio(best.n, best.ph, best.pen).skin : 0, pr: best ? best.pr : 0, col: "#41699b" }
    ];
    var x0 = 210, x1 = 640, top = 34, rowH = 34;
    var sMin = Math.min(SD, 0), sMax = Math.max.apply(null, rows.map(function (r) { return r.sk; }));
    var lo = Math.min(-1.8, sMin), hi = Math.max(0.2, sMax + 0.4);
    var SX = function (v) { return x0 + (v - lo) / (hi - lo) * (x1 - x0); };
    var zx = SX(0);
    s += '<line x1="' + x0 + '" y1="' + (top - 8) + '" x2="' + x1 + '" y2="' + (top - 8) + '" stroke="#e2ded0"/>';
    [lo, 0, hi].forEach(function (v) {
      s += '<text x="' + SX(v).toFixed(1) + '" y="' + (top - 12) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' +
        v.toFixed(1) + '</text>';
    });
    rows.forEach(function (r, i) {
      var y = top + i * rowH;
      s += '<text x="14" y="' + (y + 14) + '" font-size="10" fill="#4d565b">' + r.nm + '</text>';
      /* 钻井损害（正） */
      s += '<rect x="' + zx.toFixed(1) + '" y="' + (y + 4) + '" width="' + (SX(SD) - zx).toFixed(1) +
        '" height="10" fill="#b26a39" opacity="0.7"/>';
      /* 射孔表皮（负） */
      var w2 = Math.abs(SX(r.sk) - zx);
      var bx = r.sk < 0 ? zx - w2 : zx;
      s += '<rect x="' + bx.toFixed(1) + '" y="' + (y + 14) + '" width="' + w2.toFixed(1) +
        '" height="10" fill="' + r.col + '" opacity="0.85"/>';
      s += '<text x="' + (x1 + 8) + '" y="' + (y + 12) + '" font-size="9" fill="#4d565b" font-family="monospace">S=' +
        (SD + r.sk).toFixed(2) + '</text>';
      s += '<text x="' + (x1 + 8) + '" y="' + (y + 24) + '" font-size="9" fill="' + r.col + '" font-family="monospace">PR=' +
        r.pr.toFixed(3) + '</text>';
    });
    s += '<line x1="' + zx.toFixed(1) + '" y1="' + (top - 6) + '" x2="' + zx.toFixed(1) + '" y2="' + (top + rows.length * rowH - 4) +
      '" stroke="#242b2e"/>';
    s += '<text x="' + (zx + 4).toFixed(1) + '" y="' + (top + rows.length * rowH + 12) + '" font-size="9" fill="#242b2e">0（无损）</text>';
    s += '<text x="' + (SX(SD) + 4).toFixed(1) + '" y="' + (top + 12) + '" font-size="9" fill="#b26a39">钻井损害 +' + SD.toFixed(2) + '</text>';
    s += '<text x="' + (SX(rows[1].sk) - 4).toFixed(1) + '" y="' + (top + 48) + '" font-size="9" fill="#2f7d6b" text-anchor="end">射孔表皮 ' +
      rows[1].sk.toFixed(2) + '</text>';
    s += '<text x="14" y="' + (top + rows.length * rowH + 30) + '" font-size="10" fill="#4d565b">PR = ln(re/rw) ÷ [ ln(re/rw) + S ]：' +
      tB("把总表皮压下去，产能就上来") + '；射孔做得好，表皮可以是负的，等于把钻井时的损害补偿回来。</text>';
    s += '<text x="14" y="' + (top + rows.length * rowH + 46) + '" font-size="9.5" fill="#79828a">橙色＝钻井损害表皮（固定），彩色＝射孔表皮（可调，通常为负）。右列为总表皮与对应产能比。</text>';
    skinSvg.innerHTML = s;
  }

  function draw() {
    var n = Number(nIn.value), phIdx = Number(phIn.value),
      pen = Number(penIn.value), ucs = Number(ucsIn.value), rLim = Number(rIn.value);

    el("out-n").textContent = n + " 孔/m";
    el("out-ph").textContent = PHASE[phIdx] + "°";
    el("out-pen").textContent = pen + " mm";
    el("out-ucs").textContent = ucs + " MPa";
    el("out-r").textContent = rLim.toFixed(2);

    var cur = prodRatio(n, phIdx, pen);
    var curR = sandRisk(n, phIdx, pen, ucs);
    var stdPr = prodRatio(STD.n, STD.ph, STD.pen).pr;

    var pts = enumerate(ucs);
    var front = pareto(pts);

    /* 坐标范围 */
    var lo = 1e9, hi = -1e9;
    pts.forEach(function (p) { if (p.pr < lo) lo = p.pr; if (p.pr > hi) hi = p.pr; });
    lo = Math.floor((lo - 0.02) * 20) / 20;
    hi = Math.ceil((hi + 0.02) * 20) / 20;

    var X = function (v) { return ML + (v - lo) / (hi - lo) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - v) * (H - MT - MB); };

    var s = "";
    /* 可行域底色：出砂风险低于容忍上限 */
    s += '<rect x="' + ML + '" y="' + Y(rLim) + '" width="' + (W - ML - MR) +
      '" height="' + (Y(0) - Y(rLim)) + '" fill="#e6f1ec" opacity=".7"/>';

    /* 网格与坐标轴 */
    var ticks = 5, t;
    for (t = 0; t <= ticks; t++) {
      var xv = lo + (hi - lo) * t / ticks;
      s += '<line x1="' + X(xv).toFixed(1) + '" y1="' + MT + '" x2="' + X(xv).toFixed(1) +
        '" y2="' + (H - MB) + '" stroke="#efece1"/>';
      s += '<text x="' + X(xv).toFixed(1) + '" y="' + (H - MB + 14) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="middle" font-family="monospace">' + xv.toFixed(2) + '</text>';
    }
    for (t = 0; t <= 4; t++) {
      var yv = t / 4;
      s += '<line x1="' + ML + '" y1="' + Y(yv).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(yv).toFixed(1) +
        '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(yv) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="end" font-family="monospace">' + yv.toFixed(2) + '</text>';
    }
    s += '<line x1="' + ML + '" y1="' + Y(rLim) + '" x2="' + (W - MR) + '" y2="' + Y(rLim) +
      '" stroke="#b26a39" stroke-width="1" stroke-dasharray="5 3" opacity=".8"/>';
    s += '<text x="' + (W - MR) + '" y="' + (Y(rLim) - 4) + '" font-size="9.5" fill="#b26a39" ' +
      'text-anchor="end" font-family="monospace">出砂容忍上限 ' + rLim.toFixed(2) + '</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 6) + '" font-size="9.5" fill="#4d565b" ' +
      'text-anchor="end">产能比 PR →</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" ' +
      'text-anchor="end">↑ 出砂风险</text>';

    /* 其它相位的候选点 */
    var d = "";
    pts.forEach(function (p) {
      if (p.ph === phIdx) return;
      d += '<circle cx="' + X(p.pr).toFixed(1) + '" cy="' + Y(p.r).toFixed(1) +
        '" r="1.6" fill="#cfd8dd" opacity=".8"/>';
    });
    s += d;

    /* 当前相位的候选点 */
    var d2 = "";
    pts.forEach(function (p) {
      if (p.ph !== phIdx) return;
      d2 += '<circle cx="' + X(p.pr).toFixed(1) + '" cy="' + Y(p.r).toFixed(1) +
        '" r="2.4" fill="' + (p.r <= rLim ? "#2f7d6b" : "#b26a39") + '" opacity=".65"/>';
    });
    s += d2;

    /* 帕累托前沿 */
    var frontPts = front.slice().sort(function (a, b) { return a.pr - b.pr; });
    if (frontPts.length > 1) {
      var fp = "";
      frontPts.forEach(function (p, k) {
        fp += (k ? "L" : "M") + X(p.pr).toFixed(1) + " " + Y(p.r).toFixed(1);
      });
      s += '<path d="' + fp + '" fill="none" stroke="#41699b" stroke-width="1.6" stroke-linejoin="round"/>';
    }

    /* 约束下最优：可行域内产能最高，同产能取成本更低（孔密小、穿深浅） */
    var best = null;
    pts.forEach(function (p) {
      if (p.r > rLim) return;
      if (!best || p.pr > best.pr + 1e-9 ||
        (Math.abs(p.pr - best.pr) <= 1e-9 && (p.n / 40 + p.pen / 800) < (best.n / 40 + best.pen / 800))) {
        best = p;
      }
    });

    /* 当前参数点 */
    var feasible = curR <= rLim;
    s += '<circle cx="' + X(cur.pr).toFixed(1) + '" cy="' + Y(curR).toFixed(1) +
      '" r="5" fill="none" stroke="#242b2e" stroke-width="1.6"/>';
    if (best) {
      s += '<circle cx="' + X(best.pr).toFixed(1) + '" cy="' + Y(best.r).toFixed(1) +
        '" r="4" fill="#41699b"/>';
      s += '<text x="' + (X(best.pr) + 8).toFixed(1) + '" y="' + (Y(best.r) - 6).toFixed(1) +
        '" font-size="9.5" fill="#41699b" font-family="monospace">约束下最优</text>';
    }
    svg.innerHTML = s;

    drawSens(n, phIdx, pen, ucs, rLim);
    drawSkin(n, phIdx, pen, ucs, best, cur.pr, stdPr);

    /* ---------- 读数 ---------- */
    el("ro-pr").textContent = cur.pr.toFixed(3);
    el("ro-best").textContent = best ? best.n + " 孔/m · " + PHASE[best.ph] + "° · " + best.pen + " mm" : "无可行组合";
    var gain = (cur.pr / stdPr - 1) * 100;
    var gEl = el("ro-gain");
    gEl.textContent = (gain >= 0 ? "+" : "") + gain.toFixed(1) + "%";
    gEl.className = gain >= 0 ? "ok" : "bad";
    var rEl = el("ro-risk");
    rEl.textContent = curR.toFixed(2);
    rEl.className = feasible ? "ok" : "bad";
    var okEl = el("ro-ok");
    okEl.textContent = feasible ? "可行" : "出砂超限";
    okEl.className = feasible ? "ok" : "bad";

    /* ---------- 解说 ---------- */
    if (!best) {
      note.innerHTML = "当前容忍上限 <b>" + rLim.toFixed(2) + "</b> 太严，整个参数空间里没有任何组合能满足，" +
        "约束过度收紧会让帕累托前沿退化成空集——这也是现场「干脆沿用标准方案」的一个技术原因。试着把上限放宽。";
    } else if (!feasible) {
      note.innerHTML = "当前组合产能比 <b>" + cur.pr.toFixed(3) + "</b>，但出砂风险 <b>" + curR.toFixed(2) +
        "</b> 超过上限，方案不可施工。约束下的最优是 <b>" + best.n + " 孔/m · " + PHASE[best.ph] + "° · " +
        best.pen + " mm</b>，产能比 " + best.pr.toFixed(3) + "（风险 " + best.r.toFixed(2) +
        "）。注意它通常落在<b>前沿与约束线的交点</b>附近——优化总是贴着限制走。";
    } else {
      var gap = (best.pr - cur.pr) * 100;
      note.innerHTML = "当前组合可行，产能比 <b>" + cur.pr.toFixed(3) + "</b>，相对标准方案（13 孔/m · 60° · 300 mm，" +
        "PR " + stdPr.toFixed(3) + "）" + (gain >= 0 ? "提升" : "下降") + " <b>" + Math.abs(gain).toFixed(1) +
        "%</b>。约束下的最优是 <b>" + best.n + " 孔/m · " + PHASE[best.ph] + "° · " + best.pen +
        " mm</b>，还能再拿 " + gap.toFixed(1) + "% 的产能增量。" +
        (curR < 0.25 ? "现在风险很低距离上限还有余量，说明还能往更激进的参数走。" :
          curR > rLim - 0.08 ? "你正贴着约束边界走，实际作业里的施工偏差很可能把它推出可行域，留 0.05–0.1 的余量。" : "");
    }
  }

  [nIn, phIn, penIn, ucsIn, rIn].forEach(function (nd) {
    nd.addEventListener("input", draw);
  });
  draw();
})();
