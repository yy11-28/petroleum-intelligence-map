/* =========================================================
   储层压裂增产智能方案设计 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   一口 20 段水平井的单段/全井压裂方案：
     ① 泵注模拟：前置液 + 线性加砂斜坡 → 施工压力、实入地支撑剂；
        「净压力自适应」时按实时压力与携砂窗口动态削减砂比（闭环调参）；
     ② 几何代理：按簇间竞争分配各簇排量/液量 → 缝长、缝高、导流能力与 EUR 指数；
     ③ 硬约束（施工压力 / 缝高 / 携砂窗口）剪枝后，在 7280 组候选上出
        「成本—EUR」帕累托前沿与预算内最优。
   注：这是演示用的降阶模型，不是裂缝扩展数值模拟的结果。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 常量 ---------- */
  var STAGES = 20;        /* 压裂段数 */
  var SL = 60;            /* 单段段长 m */
  var T_PUMP = 45;        /* 单段泵注时长 min */
  var K_RES = 0.35;       /* 基质渗透率 mD */
  var PAY = 12;           /* 产层厚度 m */
  var BARRIER = 20;       /* 上隔层允许的最大缝高 m */
  var WATER = 8;          /* 产层底到下部水层的距离 m */
  var P_LIMIT = 70;       /* 设备限压 MPa */
  var C_LIM = 750;        /* 携砂窗口上限 kg/m³ */
  var CLOSURE = 45;       /* 闭合应力 MPa */
  var XF_K = 165;         /* 缝长比例系数（演示标定） */

  var COST_FLUID = 0.006; /* 万元 / m³ 压裂液 */
  var COST_PROP = 0.35;   /* 万元 / t 支撑剂 */
  var COST_STAGE = 8;     /* 万元 / 段（设备与作业） */
  var COST_CLUSTER = 0.20; /* 万元 / 簇（射孔簇与配套） */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 1. 泵注过程 ---------- */
  /* 地面施工压力：管柱摩阻随排量上升；砂比升高会推高净压力；
     越过携砂窗口后（端部脱砂前兆）压力会快速上窜 */
  function surfaceP(Q, c) {
    var base = 30 + 0.88 * Math.pow(Q, 1.55) / 3;
    var r = c / C_LIM;
    var so = 26 * Math.pow(clamp((r - 0.72) / 0.45, 0, 1), 1.5);
    return base + 14 * r + so;
  }

  /* withSeries=true 时输出逐时刻曲线（绘图用），寻优时不输出以省开销 */
  function pump(Q, M, padPct, adaptive, withSeries) {
    var pad = padPct / 100;
    var Vs = Q * T_PUMP;              /* 单段总液量 m³ */
    var Vlad = Vs * (1 - pad);        /* 携砂液量 m³ */
    var cAvg = M * 1000 / Vlad;       /* 携砂液平均砂比 kg/m³ */
    var cPeakPlan = 2 * cAvg;         /* 线性斜坡的峰值砂比 */
    var steps = 36, dt = T_PUMP / steps;
    var series = withSeries ? [] : null;
    var pmax = 0, placed = 0, maxC = 0, capped = false, capAt = -1, capC = cPeakPlan;

    for (var s = 1; s <= steps; s++) {
      var frac = s / steps;
      var cPlan = frac <= pad ? 0 : cPeakPlan * (frac - pad) / (1 - pad);
      var cNow = cPlan;
      /* 闭环：携砂窗口限幅 + 压力接近红线时冻结砂比 */
      if (adaptive) {
        if (cNow > C_LIM) { cNow = C_LIM; if (!capped) { capped = true; capAt = frac; } }
        if (surfaceP(Q, cNow) > P_LIMIT - 3) {
          if (!capped) { capped = true; capAt = frac; }
          capC = Math.min(capC, Math.max(0, cNow - 40));
          cNow = Math.min(cNow, capC);
        }
      }
      if (capped) cNow = Math.min(cNow, capC);
      var p = surfaceP(Q, cNow);
      if (p > pmax) pmax = p;
      if (cNow > maxC) maxC = cNow;
      placed += cNow * Q * dt / 1000;   /* t */
      if (series) series.push({ t: frac * T_PUMP, cPlan: cPlan, c: cNow, p: p });
    }
    return {
      Vs: Vs, Vlad: Vlad, cPeakPlan: cPeakPlan, cPeakActual: maxC,
      pmax: pmax, placed: placed, capped: capped, capAt: capAt, series: series
    };
  }

  /* ---------- 2. 几何与产能代理 ---------- */
  function evaluate(spacing, Q, M, padPct, adaptive, withSeries) {
    var pu = pump(Q, M, padPct, adaptive, withSeries);
    var n = Math.max(1, Math.min(12, Math.round(SL / spacing)));

    /* 两种簇间效应：
       supp —— 应力阴影：中间簇被两侧压制；
       init —— 限流竞争：间距太密时相当一部分簇几乎不进液。两者叠加后就是现场
               「布了十几簇、实际只压开一半」这种情形，也是簇间距不能一直加密的原因。 */
    var supp = 0.55 * Math.exp(-(spacing - 4) / 11);
    var init = Math.max(0.08, 1 / (1 + Math.exp(-(spacing - 11) / 3)));
    var raw = [], sum = 0;
    for (var i = 0; i < n; i++) {
      var u = n > 1 ? Math.abs(2 * i / (n - 1) - 1) : 0;   /* 中间 0，两端 1 */
      var v = (1 - supp * (1 - u) * (n > 2 ? 1 : 0.5)) * (n > 1 && i % 2 === 1 ? Math.max(init, 0.12) : 1);
      raw.push(v); sum += v;
    }

    var h = 16 * Math.pow(Q / 12, 0.35) * Math.pow(pu.Vs / 540, 0.25);
    var hProp = Math.min(h, PAY * 1.4);                    /* 有效铺砂高度 m */
    var stressF = clamp(1.25 - CLOSURE / 70, 0.35, 1);
    var mpc = pu.placed / n;                               /* 单簇支撑剂 t */

    var cls = [], total = 0;
    for (var j = 0; j < n; j++) {
      var sh = raw[j] / sum;
      var qi = Q * sh;                                     /* 单簇进液排量 */
      var vi = pu.Vs * sh;                                 /* 单簇入地液量 */
      var xf = Math.min(350, XF_K * Math.pow(qi, 0.30) * Math.pow(vi / 300, 0.30));
      var area = 2 * xf * hProp;
      var areal = mpc * 1000 / Math.max(area, 1);          /* kg/m² */
      var cond = 240 * areal * stressF;                    /* mD·ft */
      var fcd = cond / Math.max(K_RES * xf * 3.28, 1e-3);
      var g = fcd / (fcd + 2);                             /* 有限导流折减 */
      cls.push({ share: sh, qi: qi, vi: vi, xf: xf, areal: areal, cond: cond, fcd: fcd, g: g });
      total += Math.pow(g * xf, 0.8);
    }

    var intf = 1 / (1 + 0.75 * Math.exp(-spacing / 8));    /* 缝间干扰 */
    var neff = 1 / cls.reduce(function (a, o) { return a + o.share * o.share; }, 0);  /* 有效簇数 */
    var eur = STAGES * total * intf * 0.02;                /* 单井 EUR 指数（相对单位） */
    var cost = STAGES * (COST_FLUID * pu.Vs + COST_PROP * pu.placed + COST_STAGE + COST_CLUSTER * n);

    var okP = pu.pmax <= P_LIMIT;
    var okH = h <= BARRIER;
    var okC = pu.cPeakActual <= C_LIM + 1e-6;
    return {
      pump: pu, n: n, neff: neff, cls: cls, h: h, hProp: hProp, eur: eur, cost: cost,
      intf: intf, okP: okP, okH: okH, okC: okC, feasible: okP && okH && okC,
      maxXf: cls.reduce(function (a, o) { return Math.max(a, o.xf); }, 0),
      minXf: cls.reduce(function (a, o) { return Math.min(a, o.xf); }, 1e9)
    };
  }

  /* 模板方案作为参照基准（100） */
  var BASE = evaluate(12, 12, 70, 40, false, false).eur;

  /* ---------- 3. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var spIn = el("sp"), qIn = el("q"), mIn = el("m"), padIn = el("pad"), bgIn = el("bg");
  var geo = el("geo"), sch = el("sch"), pf = el("pf"), note = el("note");
  var modeRow = el("moderow");
  var adaptive = false;

  var MODES = ["按设计执行", "净压力自适应"];
  var modeBtns = MODES.map(function (nm, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = nm;
    b.addEventListener("click", function () { adaptive = i === 1; draw(); });
    modeRow.appendChild(b);
    return b;
  });

  /* ---------- 4. 裂缝与层位 ---------- */
  function drawGeo(r) {
    var H = 250, cy = 118, x0 = 46, x1 = 466, pxm = (x1 - x0) / SL;
    var cxAll = (x0 + x1) / 2;
    var s = "";

    /* 左：井筒与各簇裂缝（俯视，缝长按压缩比例显示） */
    s += '<text x="' + x0 + '" y="16" font-size="9.5" fill="#79828a">单段俯视：井筒 + ' + r.n +
      ' 簇（缝长按压缩比例显示，蓝色代表导流利用率高）</text>';
    s += '<line x1="' + x0 + '" y1="' + cy + '" x2="' + x1 + '" y2="' + cy + '" stroke="#242b2e" stroke-width="2.4"/>';
    var spanMax = 300;
    for (var i = 0; i < r.n; i++) {
      var c = r.cls[i];
      /* 簇位置按实际间距排布 */
      var pxAll = cxAll + (i - (r.n - 1) / 2) * pxm * Number(spIn.value);
      var half = c.xf / spanMax * 88;
      var col = c.g < 0.45 ? "#c9613f" : (c.g < 0.6 ? "#b26a39" : "#41699b");
      s += '<path d="M' + (pxAll - 4).toFixed(1) + ' ' + (cy - half).toFixed(1) +
        ' L' + (pxAll + 4).toFixed(1) + ' ' + (cy - half).toFixed(1) +
        ' L' + (pxAll + 1.2).toFixed(1) + ' ' + cy.toFixed(1) +
        ' L' + (pxAll + 4).toFixed(1) + ' ' + (cy + half).toFixed(1) +
        ' L' + (pxAll - 4).toFixed(1) + ' ' + (cy + half).toFixed(1) +
        ' L' + (pxAll - 1.2).toFixed(1) + ' ' + cy.toFixed(1) + ' Z" fill="' + col + '" opacity=".8"/>';
      s += '<circle cx="' + pxAll.toFixed(1) + '" cy="' + cy + '" r="2.2" fill="#242b2e"/>';
    }
    /* 标注最长与最短簇 */
    if (r.n > 1) {
      s += '<text x="' + x0 + '" y="' + (H - 24) + '" font-size="10" fill="#4d565b">缝长 ' +
        r.minXf.toFixed(0) + " – " + r.maxXf.toFixed(0) + ' m · 有效簇数 <tspan fill="#242b2e">' +
        r.neff.toFixed(1) + '</tspan> / 布簇 ' + r.n + ' 簇</text>';
    } else {
      s += '<text x="' + x0 + '" y="' + (H - 24) + '" font-size="10" fill="#4d565b">单簇，不存在簇间竞争</text>';
    }
    s += '<text x="' + x0 + '" y="' + (H - 8) + '" font-size="10" fill="#4d565b">缝间干扰折减 ×' +
      r.intf.toFixed(2) + '（间距 ' + spIn.value + ' m）</text>';

    /* 右：层位与缝高 */
    var gx = 560, top = 34, pp = 3.33;           /* 3.33 px/m */
    var payTop = 110, payBot = payTop + PAY * pp;
    var barTop = payTop - BARRIER * pp;
    var watTop = payBot + WATER * pp;
    var over = r.h > BARRIER;
    s += '<text x="520" y="16" font-size="9.5" fill="#79828a">侧视：缝高 vs 隔层</text>';
    s += '<rect x="' + gx + '" y="' + top + '" width="110" height="' + (barTop - top) + '" fill="#e9e4d8"/>';
    s += '<rect x="' + gx + '" y="' + barTop + '" width="110" height="' + (payTop - barTop) + '" fill="#d8d2c4"/>';
    s += '<rect x="' + gx + '" y="' + payTop + '" width="110" height="' + (payBot - payTop) + '" fill="#2f7d6b" opacity=".72"/>';
    s += '<rect x="' + gx + '" y="' + payBot + '" width="110" height="' + (watTop - payBot) + '" fill="#e9e4d8"/>';
    s += '<rect x="' + gx + '" y="' + watTop + '" width="110" height="' + (H - 22 - watTop) + '" fill="#41699b" opacity=".55"/>';
    s += '<text x="' + (gx + 114) + '" y="' + ((barTop + payTop) / 2 + 4).toFixed(0) + '" font-size="10" fill="#4d565b">隔层 ' + BARRIER + ' m</text>';
    s += '<text x="' + (gx + 114) + '" y="' + ((payTop + payBot) / 2 + 4).toFixed(0) + '" font-size="10" fill="#4d565b">产层 ' + PAY + ' m</text>';
    s += '<text x="' + (gx + 114) + '" y="' + (watTop + 16) + '" font-size="10" fill="#4d565b">下部水层</text>';
    var hh = r.h * pp, mid = (payTop + payBot) / 2;
    s += '<rect x="' + (gx + 30) + '" y="' + (mid - hh / 2).toFixed(1) + '" width="50" height="' + hh.toFixed(1) +
      '" fill="' + (over ? "#c9613f" : "#41699b") + '" opacity="' + (over ? ".75" : ".55") + '" rx="8"/>';
    s += '<text x="' + (gx + 8) + '" y="' + (H - 8) + '" font-size="10.5" fill="' + (over ? "#c9613f" : "#4d565b") +
      '">缝高 ' + r.h.toFixed(1) + ' m / 上限 ' + BARRIER + ' m</text>';
    geo.innerHTML = s;
  }

  /* ---------- 5. 泵注程序 ---------- */
  function drawSch(pu) {
    var W = 720, H = 200, ML = 46, MR = 46, MT = 16, MB = 30;
    var cMax = 1100, pMax = 92;
    var X = function (t) { return ML + t / T_PUMP * (W - ML - MR); };
    var YP = function (p) { return MT + (1 - p / pMax) * (H - MT - MB); };
    var YC = function (c) { return MT + (1 - c / cMax) * (H - MT - MB); };
    var ser = pu.series;
    var s = "";

    [0, 25, 50, 75].forEach(function (p) {
      s += '<line x1="' + ML + '" y1="' + YP(p).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + YP(p).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 6) + '" y="' + (YP(p) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + p + '</text>';
    });
    s += '<line x1="' + ML + '" y1="' + YP(P_LIMIT).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + YP(P_LIMIT).toFixed(1) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (W - MR + 4) + '" y="' + (YP(P_LIMIT) + 3).toFixed(1) + '" font-size="9.5" fill="#c9613f">限压 ' + P_LIMIT + '</text>';
    s += '<line x1="' + ML + '" y1="' + YC(C_LIM).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + YC(C_LIM).toFixed(1) +
      '" stroke="#b26a39" stroke-width="1" stroke-dasharray="2 3" opacity=".8"/>';
    s += '<text x="' + (W - MR + 4) + '" y="' + (YC(C_LIM) + 3).toFixed(1) + '" font-size="9.5" fill="#b26a39">携砂窗口</text>';

    /* 砂比（面积）与压力（折线） */
    var dPlan = "M" + X(0).toFixed(1) + " " + YC(0).toFixed(1), dAct = "M" + X(0).toFixed(1) + " " + YC(0).toFixed(1);
    ser.forEach(function (o) {
      dPlan += "L" + X(o.t).toFixed(1) + " " + YC(o.cPlan).toFixed(1);
      dAct += "L" + X(o.t).toFixed(1) + " " + YC(o.c).toFixed(1);
    });
    s += '<path d="' + dAct + 'L' + X(T_PUMP).toFixed(1) + ' ' + YC(0).toFixed(1) + 'Z" fill="#e2b785" opacity=".55"/>';
    s += '<path d="' + dPlan + '" fill="none" stroke="#c9bfae" stroke-width="1.2" stroke-dasharray="4 3"/>';
    var dp = "";
    ser.forEach(function (o, i) { dp += (i ? "L" : "M") + X(o.t).toFixed(1) + " " + YP(o.p).toFixed(1); });
    s += '<path d="' + dp + '" fill="none" stroke="#41699b" stroke-width="1.8"/>';

    if (pu.capped) {
      s += '<line x1="' + X(pu.capAt * T_PUMP).toFixed(1) + '" y1="' + MT + '" x2="' + X(pu.capAt * T_PUMP).toFixed(1) +
        '" y2="' + (H - MB) + '" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="3 2"/>';
      s += '<text x="' + (X(pu.capAt * T_PUMP) + 5).toFixed(1) + '" y="' + (MT + 10) + '" font-size="9.5" fill="#2f7d6b">' +
        '闭环介入 ' + (pu.capAt * 100).toFixed(0) + '%</text>';
    }
    s += '<text x="' + ML + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b">↑ 压力 MPa / 砂比 kg·m⁻³（虚线：原设计）</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">泵注时间 →</text>';
    sch.innerHTML = s;
  }

  /* ---------- 6. 前沿 ---------- */
  function drawPareto(cands, best, curPt, budget) {
    var W = 720, H = 230, ML = 54, MR = 16, MT = 16, MB = 34;
    var x0 = 1e9, x1 = -1e9, y1 = -1e9;
    cands.forEach(function (p) {
      x0 = Math.min(x0, p.cost); x1 = Math.max(x1, p.cost); y1 = Math.max(y1, p.eur);
    });
    if (curPt) { x0 = Math.min(x0, curPt.cost); x1 = Math.max(x1, curPt.cost); y1 = Math.max(y1, curPt.eur); }
    var px = (x1 - x0) * 0.06 || 20;
    x0 -= px; x1 += px; y1 *= 1.05;
    var y0 = 0;
    var X = function (v) { return ML + (v - x0) / (x1 - x0) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - y0) / (y1 - y0)) * (H - MT - MB); };

    var s = "";
    [0, 0.5, 1].forEach(function (f) {
      var v = y0 + (y1 - y0) * f;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v.toFixed(0) + '</text>';
    });
    s += '<line x1="' + X(budget).toFixed(1) + '" y1="' + MT + '" x2="' + X(budget).toFixed(1) + '" y2="' + (H - MB) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (X(budget) - 5).toFixed(1) + '" y="' + (MT + 10) + '" font-size="9.5" fill="#c9613f" text-anchor="end">成本上限</text>';

    cands.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.eur).toFixed(1) + '" r="2.1" fill="#b9c6cf" opacity=".75"/>';
    });
    var front = cands.filter(function (p) {
      return !cands.some(function (q) {
        return q !== p && q.cost <= p.cost + 1e-9 && q.eur >= p.eur + 1e-6 &&
          (q.cost < p.cost - 1e-9 || q.eur > p.eur + 1e-6);
      });
    }).sort(function (a, b) { return a.cost - b.cost; });
    var d = "";
    front.forEach(function (p, i) { d += (i ? "L" : "M") + X(p.cost).toFixed(1) + " " + Y(p.eur).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.5" stroke-linejoin="round"/>';
    front.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.eur).toFixed(1) + '" r="2.8" fill="#41699b"/>';
    });
    if (curPt) {
      s += '<rect x="' + (X(curPt.cost) - 4).toFixed(1) + '" y="' + (Y(curPt.eur) - 4).toFixed(1) + '" width="8" height="8" fill="#242b2e"/>';
      s += '<text x="' + (X(curPt.cost) + 9).toFixed(1) + '" y="' + (Y(curPt.eur) + 14).toFixed(1) + '" font-size="10" fill="#242b2e">当前</text>';
    }
    if (best) {
      s += '<circle cx="' + X(best.cost).toFixed(1) + '" cy="' + Y(best.eur).toFixed(1) + '" r="5" fill="none" stroke="#2f7d6b" stroke-width="1.6"/>';
      s += '<text x="' + (X(best.cost) + 8).toFixed(1) + '" y="' + (Y(best.eur) - 6).toFixed(1) + '" font-size="10" fill="#2f7d6b">最优 ' + best.eur.toFixed(0) + '</text>';
    }
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">单井成本 万元 →</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ EUR 相对指数</text>';
    pf.innerHTML = s;
  }

  /* ---------- 7. 主流程 ---------- */
  function draw() {
    var spacing = Number(spIn.value), Q = Number(qIn.value), M = Number(mIn.value),
      padPct = Number(padIn.value), budget = Number(bgIn.value);
    el("out-sp").textContent = spacing + " m";
    el("out-q").textContent = Q.toFixed(1) + " m³/min";
    el("out-m").textContent = M + " t";
    el("out-pad").textContent = padPct + " %";
    el("out-bg").textContent = budget + " 万元";
    modeBtns.forEach(function (b, i) { b.className = (i === 1) === adaptive ? "on" : ""; });

    var r = evaluate(spacing, Q, M, padPct, adaptive, true);
    drawGeo(r);
    drawSch(r.pump);

    /* 枚举候选（当前调参模式固定） */
    var cands = [], best = null;
    for (var sp = 4; sp <= 30; sp += 2) {
      for (var qq = 6; qq <= 20; qq += 2) {
        for (var mm = 20; mm <= 140; mm += 10) {
          for (var pp = 20; pp <= 60; pp += 10) {
            var c = evaluate(sp, qq, mm, pp, adaptive, false);
            if (!c.feasible) continue;
            var pt = { sp: sp, q: qq, m: mm, pad: pp, cost: c.cost, eur: c.eur };
            cands.push(pt);
            if (c.cost <= budget + 1e-9) {
              if (!best || c.eur > best.eur + 1e-6) best = pt;
            }
          }
        }
      }
    }
    drawPareto(cands, best, { cost: r.cost, eur: r.eur }, budget);

    /* 读数 */
    var relBase = r.eur / BASE * 100;
    var eEl = el("ro-eur");
    eEl.textContent = relBase.toFixed(0) + "（模板=100）";
    eEl.className = relBase >= 100 ? "ok" : "bad";
    var cEl = el("ro-cost");
    cEl.textContent = r.cost.toFixed(0) + " 万元";
    cEl.className = r.cost <= budget ? "ok" : "bad";
    var kEl = el("ro-chk");
    kEl.textContent = r.feasible
      ? "压力 " + r.pump.pmax.toFixed(0) + " / 缝高 " + r.h.toFixed(1) + " / 砂比 " + r.pump.cPeakActual.toFixed(0) + " 全通过"
      : (r.okP ? "" : "超压 ") + (r.okH ? "" : "缝高越界 ") + (r.okC ? "" : "超携砂窗口");
    kEl.className = r.feasible ? "ok" : "bad";
    var bEl = el("ro-best");
    if (best) {
      var relBest = best.eur / BASE * 100;
      var gain = relBest - relBase;
      bEl.textContent = relBest.toFixed(0) + " / " + best.cost.toFixed(0) + " 万";
      bEl.className = gain > 0.5 ? "ok" : "";
    } else {
      bEl.textContent = "预算内无可行方案";
      bEl.className = "bad";
    }

    /* 解说 */
    var msg = "当前方案：簇间距 " + spacing + " m（单段 " + r.n + " 簇）、排量 " + Q.toFixed(1) +
      " m³/min、单段加砂 " + M + " t、前置液 " + padPct + "%，" + (adaptive ? "净压力自适应" : "按设计执行") +
      "。EUR 相对指数 <b>" + relBase.toFixed(0) + "</b>（模板方案为 100），单井成本 " + r.cost.toFixed(0) +
      " 万元，实入地支撑剂 " + r.pump.placed.toFixed(1) + " t。";
    if (!r.okP) {
      msg += " <b>施工压力已越过设备限压</b>：" + r.pump.pmax.toFixed(1) + " MPa > " + P_LIMIT + " MPa——" +
        (Q >= 14 ? "排量往上拉时管内摩阻按 1.55 次方在涨，这一侧的压力是<b>排量顶上来的</b>。"
          : "砂比一高净压力会快速上窜，这一侧的压力是<b>加砂程序顶上来的</b>。");
    }
    if (!r.okH) {
      msg += " <b>缝高越界</b>：" + r.h.toFixed(1) + " m 已超过隔层允许的 " + BARRIER +
        " m，继续压就可能窜出隔层沟通其它层位——这一条一旦成立，方案再便宜也不能用。";
    }
    if (!r.okC) {
      msg += " <b>超出携砂窗口</b>：峰值砂比 " + r.pump.cPeakActual.toFixed(0) + " kg/m³ > " + C_LIM +
        " kg/m³，也就是<b>方案本身设计了一个会砂堵的程序</b>；切到「净压力自适应」可以看闭环怎么把它压回窗口内。";
    }
    if (adaptive && r.pump.capped) {
      msg += " 闭环在泵注进行到 <b>" + (r.pump.capAt * 100).toFixed(0) + "%</b> 时介入，把砂比压住不再上抬：" +
        "代价是<b>少入了 " + Math.max(0, M - r.pump.placed).toFixed(1) + " t 支撑剂</b>（设计的 " +
        (Math.max(0, M - r.pump.placed) / M * 100).toFixed(0) + "%），换来的是不砂堵。" +
        "这就是「动态调参」的全部意义——它不负责多产，只负责让设计能安全地执行完。";
    }
    if (!r.feasible) {
      msg += " <b>当前这组参数本身不可施工</b>，上面的大小对比只作参考——真正能用的是前沿上那一点，" +
        "它是在三条约束都成立的前提下找到的。";
    }
    if (best) {
      msg += " 预算内最优是 <b>簇间距 " + best.sp + " m / 排量 " + best.q + " / 加砂 " + best.m +
        " t / 前置液 " + best.pad + "%</b>（EUR " + relBest.toFixed(0) + "、成本 " + best.cost.toFixed(0) + " 万元）";
      if (gain > 0.5) {
        msg += "：<b>同样的钱还能多拿 " + gain.toFixed(0) + " 个点的 EUR</b>。" +
          "它不一定排量最大、加砂最多——<b>三条硬约束已经把搜索空间切掉了一大块</b>，剩下的才是能施工的区域；" +
          "把滑杆拉到各自的上限，通常就是掉进那块被切掉的区域里。";
      } else {
        msg += "：当前已在最优附近。要再往上就得<b>越过预算线</b>（把上限拖高，看前沿怎么走），" +
          "或者等真实产量把模型系数重新标定——<b>优化的上限是模型，不是算法</b>。";
      }
    } else {
      msg += " 当前预算 " + budget + " 万元下没有任何同时满足三条约束的方案：此时应当<b>调整上下限</b>" +
        "（放宽预算、降低段数），而不是硬凑一个会在现场出问题的方案。";
    }
    msg += " 注：这是降阶模型，EUR 指数为相对量、不是产量预测，不可用于方案报批。";
    note.innerHTML = msg;
  }

  [spIn, qIn, mIn, padIn, bgIn].forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
