/* =========================================================
   完井管柱受力智能分析 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 机理模型：活塞效应 + 温度效应 + 浮重 → 封隔器处轴向力，
      再与 Lubinski 屈曲临界载荷比较 → 安全系数；
   ② 用机理模型批量生成工况样本，最小二乘拟合多项式代理模型；
   ③ 在整个「生产压差 × 温升」工况空间内扫描，把危险区画成图，
      并统计代理模型在危险区的查全率。
   注：这是用于演示流程的简化模型，不可用于工程校核。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 管柱与材料常数 ---------- */
  var OD = 73, ID0 = 62;                                  /* mm */
  var AS = Math.PI / 4 * (OD * OD - ID0 * ID0);           /* 管体截面积 mm² */
  var AI = Math.PI / 4 * ID0 * ID0;                       /* 内孔面积 mm² */
  var I4 = Math.PI / 64 * (Math.pow(OD, 4) - Math.pow(ID0, 4));  /* 惯性矩 mm⁴ */
  var E = 206000;            /* 弹性模量 MPa = N/mm² */
  var ALPHA = 1.2e-5;        /* 线膨胀系数 1/℃ */
  var RHO_S = 7850;          /* 钢材密度 kg/m³ */
  var JOINT = 500000;        /* 接头抗拉强度 N */
  var CASING_ID = 121.4;     /* 套管内径 mm（决定屈曲间隙） */
  var G = 9.81;
  var KN = 1000;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- 1. 机理模型 ---------- */
  /* 拉为正、压为负；返回力单位 N */
  function model(dp, dT, L, rho, anchored) {
    var area = AS * 1e-6;                       /* m² */
    var w = area * (RHO_S - rho) * G;           /* 浮重线重 N/m */
    var fw = w * L;                             /* 浮重 → 拉力 */
    var fp = dp * AI;                           /* 活塞效应：降压 → 受拉 */
    var ft = anchored ? -E * AS * ALPHA * dT : 0;   /* 温度上升被约束 → 受压 */
    var fnet = fw + fp + ft;                    /* 封隔器处轴向力 */

    /* 屈曲临界载荷（Lubinski 形式） */
    var rCl = (CASING_ID - OD) / 2 / 1000;      /* 径向间隙 m */
    var fsin = Math.sqrt(4 * E * 1e6 * I4 * 1e-12 * w / rCl);
    var fhel = Math.sqrt(8 * E * 1e6 * I4 * 1e-12 * w / rCl);

    var comp = Math.max(0, -fnet);              /* 压缩段大小 */
    var sfT = JOINT / Math.max(fw + fp, 1);     /* 拉伸安全系数（井口） */
    var sfB = comp > 1 ? fsin / comp : 99;      /* 屈曲安全系数 */
    var buckle = comp > fhel ? 2 : (comp > fsin ? 1 : 0);

    var dlk = null;
    if (!anchored) {
      /* 自由管柱：温度伸长 − 活塞拉力引起的弹性伸长 */
      dlk = ALPHA * dT * L - fp * L / (E * AS);
    }
    return {
      fw: fw, fp: fp, ft: ft, fnet: fnet, comp: comp, topPull: fw + fp, fsin: fsin,
      sfT: sfT, sfB: sfB, buckle: buckle, dl: dlk,
      sf: Math.min(sfT, sfB)
    };
  }

  /* ---------- 2. 最小二乘代理模型 ---------- */
  function basis(a, b) {
    return [1, a, b, a * a, b * b, a * b, a * a * a, b * b * b, a * a * b, a * b * b];
  }
  function fit(X, y) {
    var m = X.length, n = X[0].length, i, j, k;
    var A = [], bb = [];
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); bb.push(0); }
    for (k = 0; k < m; k++) {
      for (i = 0; i < n; i++) {
        bb[i] += X[k][i] * y[k];
        for (j = 0; j < n; j++) A[i][j] += X[k][i] * X[k][j];
      }
    }
    for (i = 0; i < n; i++) A[i][i] += 1e-6;       /* 一点点岭回归，避免奇异 */
    for (i = 0; i < n; i++) {
      var piv = i, best = Math.abs(A[i][i]);
      for (j = i + 1; j < n; j++) { if (Math.abs(A[j][i]) > best) { best = Math.abs(A[j][i]); piv = j; } }
      if (piv !== i) { var t1 = A[i]; A[i] = A[piv]; A[piv] = t1; var t2 = bb[i]; bb[i] = bb[piv]; bb[piv] = t2; }
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
        bb[j] -= f * bb[i];
      }
    }
    var w = new Array(n).fill(0);
    for (i = n - 1; i >= 0; i--) {
      var sum = bb[i];
      for (j = i + 1; j < n; j++) sum -= A[i][j] * w[j];
      w[i] = sum / A[i][i];
    }
    return w;
  }
  function predict(w, a, b) {
    var f = basis(a, b), v = 0;
    for (var i = 0; i < f.length; i++) v += w[i] * f[i];
    return v;
  }

  /* ---------- 3. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var dpIn = el("dp"), dtIn = el("dt"), lenIn = el("len"), rhoIn = el("rho");
  var btnAnch = el("btn-anch"), btnFree = el("btn-free");
  var hm = el("hm"), cb = el("cb"), note = el("note"), tradeSvg = el("trade");
  var anchored = true;
  var tB = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };

  btnAnch.addEventListener("click", function () { anchored = true; btnAnch.className = "on"; btnFree.className = ""; draw(); });
  btnFree.addEventListener("click", function () { anchored = false; btnFree.className = "on"; btnAnch.className = ""; draw(); });

  /* 工况扫描网格 */
  var GX = [], GY = [], gi;
  for (gi = 0; gi <= 45; gi += 2.5) GX.push(gi);     /* 生产压差 MPa */
  for (gi = 0; gi <= 120; gi += 5) GY.push(gi);      /* 温升 ℃ */

  function colorOf(sf) {
    if (sf < 1) return "#c9613f";
    if (sf < 1.3) return "#e2b785";
    if (sf < 1.8) return "#ece8d8";
    return "#d7e7df";
  }

  var HW = 720, HH = 300, ML = 54, MR = 14, MT = 14, MB = 30;

  /* ---------- 拉—压对抗：两个安全系数随单参数的变化 ---------- */
  function drawTrade(dp, dT, L, rho, anchored) {
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">同一个参数往两个方向拉：' + tB("拉伸安全系数") + '与' + tB("屈曲安全系数") + '并不一起变好或变坏</text>';
    var panels = [
      { nm: "扫温升 ΔT（Δp 固定 " + dp.toFixed(1) + " MPa）", xmax: 120, unit: "℃", cur: dT,
        f: function (v) { return model(dp, v, L, rho, anchored); } },
      { nm: "扫生产压差 Δp（ΔT 固定 " + dT + " ℃）", xmax: 45, unit: "MPa", cur: dp,
        f: function (v) { return model(v, dT, L, rho, anchored); } }
    ];
    panels.forEach(function (p, i) {
      var x0 = 30 + i * 348, x1 = x0 + 300, yTop = 40, yBot = 162;
      var SY = function (v) { return yBot - Math.min(4, v) / 4 * (yBot - yTop); };
      var SX = function (v) { return x0 + v / p.xmax * (x1 - x0); };
      s += '<rect x="' + x0 + '" y="' + yTop + '" width="' + (x1 - x0) + '" height="' + (yBot - yTop) +
        '" fill="#fbfaf6" stroke="#e2ded0"/>';
      s += '<text x="' + x0 + '" y="' + (yTop - 6) + '" font-size="10" fill="#4d565b">' + p.nm + '</text>';
      [0, 1, 2, 3, 4].forEach(function (v) {
        s += '<line x1="' + x0 + '" y1="' + SY(v).toFixed(1) + '" x2="' + x1 + '" y2="' + SY(v).toFixed(1) +
          '" stroke="#efece1"/>';
        s += '<text x="' + (x0 - 5) + '" y="' + (SY(v) + 3).toFixed(1) + '" font-size="8.5" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
      });
      var dT1 = "", dB1 = "";
      for (var k = 0; k <= 60; k++) {
        var xv = p.xmax * k / 60, m = p.f(xv);
        dT1 += (k ? "L" : "M") + SX(xv).toFixed(1) + " " + SY(m.sfT).toFixed(1);
        dB1 += (k ? "L" : "M") + SX(xv).toFixed(1) + " " + SY(m.sfB).toFixed(1);
      }
      s += '<path d="' + dT1 + '" fill="none" stroke="#41699b" stroke-width="1.8"/>';
      s += '<path d="' + dB1 + '" fill="none" stroke="#b26a39" stroke-width="1.8"/>';
      /* 危险线 */
      s += '<line x1="' + x0 + '" y1="' + SY(1).toFixed(1) + '" x2="' + x1 + '" y2="' + SY(1).toFixed(1) +
        '" stroke="#c9613f" stroke-width="1.2"/>';
      s += '<text x="' + (x0 + 4) + '" y="' + (SY(1) - 4).toFixed(1) + '" font-size="8.5" fill="#c9613f">SF = 1</text>';
      /* 当前点 */
      var mc = p.f(p.cur);
      s += '<line x1="' + SX(p.cur).toFixed(1) + '" y1="' + yTop + '" x2="' + SX(p.cur).toFixed(1) + '" y2="' + yBot +
        '" stroke="#242b2e" stroke-dasharray="3 2"/>';
      s += '<circle cx="' + SX(p.cur).toFixed(1) + '" cy="' + SY(mc.sfT).toFixed(1) + '" r="3.4" fill="#41699b"/>';
      s += '<circle cx="' + SX(p.cur).toFixed(1) + '" cy="' + SY(mc.sfB).toFixed(1) + '" r="3.4" fill="#b26a39"/>';
      s += '<text x="' + SX(p.cur).toFixed(1) + '" y="' + (yBot + 14) + '" font-size="9" fill="#242b2e" text-anchor="middle">' +
        p.cur.toFixed(1) + ' ' + p.unit + '</text>';
      s += '<text x="' + x0 + '" y="' + (yBot + 30) + '" font-size="9" fill="#41699b">— 拉伸 SF = 接头强度 / 井口拉力</text>';
      s += '<text x="' + x0 + '" y="' + (yBot + 44) + '" font-size="9" fill="#b26a39">— 屈曲 SF = 正弦屈曲临界 / 压缩段</text>';
    });
    s += '<text x="14" y="196" font-size="10" fill="#4d565b">两条线的' + tB("交点") + '就是设计的真正控制点：交点左侧受拉伸控制、右侧受屈曲控制，只校核一头必然漏掉另一头。</text>';
    s += '<text x="14" y="212" font-size="10" fill="#4d565b">注意左图：温升对拉伸几乎没影响，却会持续把屈曲安全系数压下去——' + tB("只看井口拉力是看不出这一段的") + '。</text>';
    tradeSvg.innerHTML = s;
  }

  function draw() {
    var dp = Number(dpIn.value), dT = Number(dtIn.value),
      L = Number(lenIn.value), rho = Number(rhoIn.value);

    el("out-dp").textContent = dp.toFixed(1) + " MPa";
    el("out-dt").textContent = dT + " ℃";
    el("out-len").textContent = L + " m";
    el("out-rho").textContent = rho + " kg/m³";

    var cur = model(dp, dT, L, rho, anchored);

    /* ---------- 训练代理模型（当前下深/密度截面上拟合 (Δp, ΔT) -> SF） ---------- */
    /* 代理模型学的是两个力学响应（井口拉力、封隔器处压缩段），安全系数由公式导出——
       比直接拟合「安全系数」稳得多，因为后者在屈曲临界附近是 1/x 形状的。 */
    var rnd = mulberry32(20261023 + L + rho + (anchored ? 1 : 0));
    var XT = [], YT = [], XC = [], YC = [];
    for (var s = 0; s < 400; s++) {
      var a = rnd(), b = rnd();
      var mm = model(a * 45, b * 120, L, rho, anchored);
      var fb = basis(a, b);
      XT.push(fb); YT.push(mm.topPull);
      XC.push(fb); YC.push(mm.comp);
    }
    var wT = fit(XT, YT);
    var wC = fit(XC, YC);
    var fsinRef = model(0, 0, L, rho, anchored).fsin;
    function sfOfSurrogate(pv, tv) {
      var tt = Math.max(predict(wT, pv / 45, tv / 120), 1);
      var cc = predict(wC, pv / 45, tv / 120);
      return Math.min(JOINT / tt, cc > 1 ? fsinRef / cc : 99);
    }

    /* ---------- 全工况扫描 ---------- */
    var cells = [], risky = 0, rec = { tp: 0, fn: 0, fp: 0 }, mae = 0, k = 0;
    GY.forEach(function (tv) {
      GX.forEach(function (pv) {
        var m0 = model(pv, tv, L, rho, anchored);
        var pred = sfOfSurrogate(pv, tv);
        var truth = Math.min(m0.sf, 4);
        mae += Math.abs(pred - truth); k++;
        if (truth < 1) {
          risky++;
          if (pred < 1) rec.tp++; else rec.fn++;
        } else if (pred < 1) rec.fp++;
        cells.push({ pv: pv, tv: tv, sf: m0.sf, pred: pred });
      });
    });
    mae /= k;
    var recall = risky ? rec.tp / risky : 1;
    var riskyPct = risky / k * 100;

    /* ---------- 工况热力图 ---------- */
    var cw = (HW - ML - MR) / GX.length;
    var ch = (HH - MT - MB) / GY.length;
    var XF = function (pv) { return ML + (pv / 45) * (HW - ML - MR); };
    var YF = function (tv) { return MT + (1 - tv / 120) * (HH - MT - MB); };

    var s2 = "";
    cells.forEach(function (c) {
      var x0 = ML + (c.pv / 45) * (HW - ML - MR);
      var y0 = MT + (1 - c.tv / 120) * (HH - MT - MB);
      s2 += '<rect x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + (cw + 0.5).toFixed(1) +
        '" height="' + (ch + 0.5).toFixed(1) + '" fill="' + colorOf(c.sf) + '"/>';
    });
    /* 坐标轴 */
    [0, 15, 30, 45].forEach(function (v) {
      s2 += '<text x="' + XF(v).toFixed(1) + '" y="' + (HH - MB + 14) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="middle" font-family="monospace">' + v + '</text>';
    });
    [0, 40, 80, 120].forEach(function (v) {
      s2 += '<text x="' + (ML - 7) + '" y="' + (YF(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="end" font-family="monospace">' + v + '</text>';
      s2 += '<line x1="' + ML + '" y1="' + YF(v).toFixed(1) + '" x2="' + (HW - MR) + '" y2="' + YF(v).toFixed(1) +
        '" stroke="#fff" stroke-width=".5" opacity=".5"/>';
    });
    s2 += '<text x="' + (HW - MR) + '" y="' + (HH - 6) + '" font-size="9.5" fill="#4d565b" text-anchor="end">生产压差 MPa →</text>';
    s2 += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 温升 ℃</text>';

    /* 当前工况点 */
    s2 += '<circle cx="' + XF(dp).toFixed(1) + '" cy="' + YF(dT).toFixed(1) + '" r="5.5" fill="none" stroke="#242b2e" stroke-width="1.6"/>';
    s2 += '<text x="' + (XF(dp) + 9).toFixed(1) + '" y="' + (YF(dT) + 4).toFixed(1) + '" font-size="10" fill="#242b2e" ' +
      'font-family="monospace">当前工况</text>';

    /* 统计角标 */
    s2 += '<rect x="' + ML + '" y="' + MT + '" width="212" height="34" rx="4" fill="#fff" opacity=".88"/>';
    s2 += '<text x="' + (ML + 8) + '" y="' + (MT + 14) + '" font-size="10" fill="#4d565b" font-family="monospace">' +
      '高风险工况 ' + riskyPct.toFixed(1) + '%（' + risky + '/' + k + ' 格）</text>';
    s2 += '<text x="' + (ML + 8) + '" y="' + (MT + 27) + '" font-size="10" fill="#4d565b" font-family="monospace">' +
      '代理模型 MAE ' + mae.toFixed(3) + ' · 误报 ' + rec.fp + ' 格</text>';
    hm.innerHTML = s2;

    /* ---------- 轴向力组成条形图 ---------- */
    var items = [
      { nm: "浮重（管柱自重 − 浮力）", v: cur.fw / KN, c: "#2f7d6b" },
      { nm: "活塞效应（Δp）", v: cur.fp / KN, c: "#41699b" },
      { nm: "温度效应（ΔT）", v: cur.ft / KN, c: "#b26a39" }
    ];
    var maxV = 40;
    items.forEach(function (it) { maxV = Math.max(maxV, Math.abs(it.v)); });
    maxV = Math.ceil(maxV / 40) * 40;
    var CW = 720, CH = 168, PL = 168, PR = 108, PT = 16, PB = 22;
    var zero = PL + (CW - PL - PR) / 2;
    var scale = (CW - PL - PR) / 2 / maxV;

    var s3 = '<line x1="' + zero + '" y1="' + PT + '" x2="' + zero + '" y2="' + (CH - PB) + '" stroke="#242b2e" stroke-width="1"/>';
    s3 += '<text x="' + zero + '" y="' + (CH - PB + 14) + '" font-size="9.5" fill="#79828a" text-anchor="middle" font-family="monospace">0 kN</text>';
    var rh = 30, y0 = PT + 2;
    items.forEach(function (it, idx) {
      var yy = y0 + idx * rh;
      var bw = Math.abs(it.v) * scale;
      var xx = it.v >= 0 ? zero : zero - bw;
      s3 += '<text x="' + (PL - 10) + '" y="' + (yy + 15) + '" font-size="11" fill="#242b2e" text-anchor="end">' + it.nm + '</text>';
      s3 += '<rect x="' + xx.toFixed(1) + '" y="' + yy + '" width="' + bw.toFixed(1) + '" height="20" fill="' + it.c + '" opacity=".85" rx="2"/>';
      s3 += '<text x="' + (it.v >= 0 ? zero + bw + 6 : zero - bw - 6).toFixed(1) + '" y="' + (yy + 14) +
        '" font-size="11" fill="#4d565b" font-family="monospace" text-anchor="' + (it.v >= 0 ? "start" : "end") + '">' +
        (it.v >= 0 ? "+" : "") + it.v.toFixed(0) + ' kN</text>';
    });
    /* 合计 */
    var netV = cur.fnet / KN, nw = Math.abs(netV) * scale;
    var ny = y0 + items.length * rh;
    s3 += '<line x1="' + PL + '" y1="' + (ny - 3) + '" x2="' + (CW - PR) + '" y2="' + (ny - 3) + '" stroke="#e9e4d8"/>';
    s3 += '<text x="' + (PL - 10) + '" y="' + (ny + 15) + '" font-size="11" fill="#242b2e" text-anchor="end"><tspan font-weight="600">封隔器处合力</tspan></text>';
    s3 += '<rect x="' + (netV >= 0 ? zero : zero - nw).toFixed(1) + '" y="' + ny + '" width="' + nw.toFixed(1) +
      '" height="20" fill="' + (netV >= 0 ? "#242b2e" : "#c9613f") + '" opacity=".9" rx="2"/>';
    s3 += '<text x="' + (netV >= 0 ? zero + nw + 6 : zero - nw - 6).toFixed(1) + '" y="' + (ny + 14) +
      '" font-size="11" fill="#242b2e" font-family="monospace" text-anchor="' + (netV >= 0 ? "start" : "end") + '">' +
      (netV >= 0 ? "+" : "") + netV.toFixed(0) + ' kN ' + (netV >= 0 ? "（受拉）" : "（受压）") + '</text>';
    cb.innerHTML = s3;

    drawTrade(dp, dT, L, rho, anchored);

    /* ---------- 读数 ---------- */
    var fEl = el("ro-f");
    fEl.textContent = (cur.fnet / KN).toFixed(0) + " kN";
    fEl.className = cur.fnet >= 0 ? "ok" : "bad";
    var sfEl = el("ro-sf");
    sfEl.textContent = cur.sfT.toFixed(2) + " / " + (cur.sfB >= 90 ? "—" : cur.sfB.toFixed(2));
    sfEl.className = Math.min(cur.sfT, cur.sfB) >= 1.3 ? "ok" : "bad";
    var bkEl = el("ro-bk");
    bkEl.textContent = cur.buckle === 2 ? "螺旋屈曲" : (cur.buckle === 1 ? "正弦屈曲" : "未屈曲");
    bkEl.className = cur.buckle === 0 ? "ok" : "bad";
    var rcEl = el("ro-rec");
    rcEl.textContent = (recall * 100).toFixed(1) + "%";
    rcEl.className = recall >= 0.98 ? "ok" : "bad";

    /* ---------- 解说 ---------- */
    var msg = "";
    if (cur.buckle === 2) {
      msg = "压缩段超过螺旋屈曲临界载荷：这时管柱已经不是「有余量」的问题，而是<b>会发生永久变形</b>，" +
        "常见的处理是改成自由锚定让管柱能伸长，或者降低 ΔT 影响（提高排量、缩短封隔器间距）。";
    } else if (cur.buckle === 1) {
      msg = "压缩段超过正弦屈曲临界载荷，管柱会蛇形弯曲，接箍开始偏磨。" +
        "把下深往下拖（浮重增加、压缩被抵消）或把温升降下来就能退出这一区——" +
        "注意：<b>浅井反而更容易被温度屈曲</b>，因为抵抗压缩的浮重更短。";
    } else if (cur.sfT < 1.2) {
      msg = "拉伸侧余量不足：井口拉力已经逼近接头强度。提高完井液密度（浮重变小）或降低生产压差都能缓解，" +
        "但要和在右上角的热力图里确认：改参数会把工况点推到哪一类颜色里。";
    } else {
      msg = "当前工况余量充足（拉伸安全系数 " + cur.sfT.toFixed(2) + "），" +
        (riskyPct > 0.5
          ? "但整个工况空间里有 <b>" + riskyPct.toFixed(1) + "%</b> 的组合不安全——这就是只看单点工况的危险：" +
            "你校核的那一格是好的，没校核的那一格才是出事的。"
          : "而且整个工况空间几乎都不危险，说明这份设计确实留够了余量，可以考虑下调钢级或壁厚。");
    }
    if (!anchored) {
      msg += " 自由管柱模式下温度效应不产生力，管柱长度变化 <b>" + (cur.dl < 0 ? "" : "+") +
        cur.dl.toFixed(2) + " m</b>，这部分位移要由伸缩管或封隔器行程吸收。";
    }
    note.innerHTML = msg +
      " 代理模型只用了 400 个工况样本去学两个力学响应（井口拉力、封隔器处压缩段），安全系数仍由公式导出；" +
      "在全网 " + k + " 格里平均绝对误差 <b>" + mae.toFixed(3) + "</b>，危险工况查全率 <b>" +
      (recall * 100).toFixed(1) + "%</b>" +
      "（漏判 " + rec.fn + " 格、误报 " + rec.fp + " 格）——" +
      "<b>全局误差合格不等于危险区可信</b>，这就是流程里要单独统计查全率的原因。";
  }

  [dpIn, dtIn, lenIn, rhoIn].forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
