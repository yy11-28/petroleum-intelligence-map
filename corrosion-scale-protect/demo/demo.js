/* =========================================================
   完井井筒腐蚀 / 结垢智能预测与防护方案推荐 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 沿井筒深度计算温度 / 压力剖面，用 de Waard 型关系式给出 CO₂ 腐蚀速率，
      用压力释放 + 温度 + 钙硬度给出碳酸钙结垢指数与结垢速率；
   ② 防护方案 = 管材（4 种）× 缓蚀剂浓度 × 阻垢剂浓度，共 4×21×11 = 924 组；
   ③ 硬约束：材质与 H₂S 兼容、剩余寿命 ≥ 设计年限 10 年；在此基础上寻年化成本最低。
   注：为演示而写的降阶模型，不可用于选材、加药与寿命评估。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 常量 ---------- */
  var H = 3000;            /* 井深 m（给定） */
  var TS = 20;             /* 地表温度 ℃ */
  var PS = 2;              /* 井口压力 MPa */
  var DESIGN = 10;         /* 设计年限 年 */
  var WALL = 3.0;          /* 允许腐蚀减薄 mm */
  var BORE = 6.0;          /* 允许结垢厚度 mm */
  var V_LIM = 0.125;       /* 允许腐蚀速率 mm/y */
  var CHECK = 2;           /* 万元/年 检测费 */
  var CI_PRICE = 30;       /* 元/kg 缓蚀剂 */
  var SI_PRICE = 40;       /* 元/kg 阻垢剂 */

  var MATS = [
    { nm: "碳钢 J55", f: 1.00, price: 180, sscSoft: 50, sscHard: 200, col: "#c9613f" },
    { nm: "3Cr", f: 0.45, price: 420, sscSoft: 80, sscHard: 300, col: "#b26a39" },
    { nm: "13Cr", f: 0.06, price: 980, sscSoft: 30, sscHard: 150, col: "#41699b" },
    { nm: "22Cr 双相", f: 0.03, price: 2200, sscSoft: 200, sscHard: 500, col: "#2f7d6b" }
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 1. 沿深度剖面 ---------- */
  function profile(ctx) {
    var pts = [], nz = 60;
    for (var i = 0; i <= nz; i++) {
      var u = i / nz, z = u * H;
      var T = TS + (ctx.tb - TS) * u;
      var p = PS + (ctx.pb - PS) * u;
      var TK = T + 273.15;
      /* de Waard 型：腐蚀速率 mm/y */
      var base = Math.pow(10, 5.8 - 1710 / TK + 0.67 * Math.log10(Math.max(ctx.pco2, 0.01)));
      var flow = clamp(1 + 0.008 * (ctx.q - 50), 0.8, 2.6);
      /* 关系式在高温高分压区会给出失真的高值（实际受产物膜与传质限制），这里限幅并注明 */
      var v0 = Math.min(base * flow * (1 + ctx.h2s / 1500), 20);
      /* 结垢指数：压力释放（浅处）与温度（深处）共同决定 */
      var ca = ctx.cl / 3.5;
      var si = 0.9 + 0.012 * (T - 60) + 1.5 * Math.exp(-p / 6) + 0.25 * Math.log10(Math.max(ca, 50) / 500);
      var s0 = 0.35 * Math.pow(Math.max(0, si - 1), 1.3);
      pts.push({ z: z, T: T, p: p, v0: v0, s0: s0, si: si });
    }
    return pts;
  }

  /* 加防护后的速率 */
  function protected1(pt, mat, ci, cs) {
    var eI = 1 - Math.exp(-ci / 70);
    var eS = 1 - Math.exp(-cs / 12);
    return { v: pt.v0 * mat.f * (1 - eI), s: pt.s0 * (1 - eS) };
  }

  function evaluate(ctx, mat, ci, cs) {
    var pts = profile(ctx);
    var vmax = 0, smax = 0, zv = 0, zs = 0, vRaw = 0, sRaw = 0;
    for (var i = 0; i < pts.length; i++) {
      var pr = protected1(pts[i], mat, ci, cs);
      if (pr.v > vmax) { vmax = pr.v; zv = pts[i].z; }
      if (pr.s > smax) { smax = pr.s; zs = pts[i].z; }
      if (pts[i].v0 > vRaw) vRaw = pts[i].v0;
      if (pts[i].s0 > sRaw) sRaw = pts[i].s0;
    }
    var lifeCorr = vmax > 1e-6 ? WALL / vmax : 99;
    var lifeScale = smax > 1e-6 ? BORE / smax : 99;
    var life = Math.min(lifeCorr, lifeScale);
    /* 硫化氢应力开裂：硬约束否决，软约束打折 */
    var ssc = "ok";
    if (ctx.h2s > mat.sscHard) ssc = "hard";
    else if (ctx.h2s > mat.sscSoft) ssc = "soft";
    if (ssc === "soft") life *= 0.7;
    life = Math.min(life, 40);
    var tube = mat.price * H / 10000;                       /* 万元 */
    var chem = (ci * ctx.q * 365 / 1000 * CI_PRICE + cs * ctx.q * 365 / 1000 * SI_PRICE) / 10000;  /* 万元/年 */
    var cost = tube / Math.max(life, 0.5) + chem + CHECK;
    var ok = ssc !== "hard" && life >= DESIGN;
    return {
      mat: mat, ci: ci, cs: cs, vmax: vmax, smax: smax, zv: zv, zs: zs,
      vRaw: vRaw, sRaw: sRaw, life: life, cost: cost, ssc: ssc, ok: ok
    };
  }

  /* ---------- 2. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var profSvg = el("prof"), pfSvg = el("pf"), doseSvg = el("dose"), note = el("note");
  var IN = ["co2", "h2s", "cl", "t", "p", "q"].map(el);

  /* ---------- 3. 深度剖面 ---------- */
  function drawProf(pts, res) {
    var W = 720, Hs = 250, top = 30, bot = 210;
    var Y = function (z) { return top + z / H * (bot - top); };
    var s = "";
    /* 左侧：腐蚀速率 */
    var X1 = function (v) { return 96 + clamp(v / 4, 0, 1) * 210; };
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">左：腐蚀速率沿深度（mm/y）　右：结垢速率沿深度（mm/y）　竖线为允许腐蚀速率</text>';
    s += '<line x1="96" y1="' + top + '" x2="306" y2="' + top + '" stroke="#efece1"/>';
    s += '<line x1="96" y1="' + bot + '" x2="306" y2="' + bot + '" stroke="#efece1"/>';
    var d0 = "", d1 = "";
    pts.forEach(function (p, i) {
      d0 += (i ? "L" : "M") + X1(p.v0).toFixed(1) + " " + Y(p.z).toFixed(1);
      d1 += (i ? "L" : "M") + X1(protected1(p, res.mat, res.ci, res.cs).v).toFixed(1) + " " + Y(p.z).toFixed(1);
    });
    s += '<path d="' + d0 + '" fill="none" stroke="#c9613f" stroke-width="1.6"/>';
    s += '<path d="' + d1 + '" fill="none" stroke="#41699b" stroke-width="2"/>';
    s += '<line x1="' + X1(V_LIM).toFixed(1) + '" y1="' + top + '" x2="' + X1(V_LIM).toFixed(1) + '" y2="' + bot +
      '" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (X1(V_LIM) + 3).toFixed(1) + '" y="' + (top + 10) + '" font-size="9" fill="#2f7d6b">允许 ' + V_LIM + '</text>';
    s += '<text x="96" y="' + (bot + 16) + '" font-size="9" fill="#9ba3a9" font-family="monospace">0</text>';
    s += '<text x="286" y="' + (bot + 16) + '" font-size="9" fill="#9ba3a9" font-family="monospace">4 mm/y</text>';
    /* 右侧：结垢速率 */
    var X2 = function (v) { return 400 + clamp(v / 0.8, 0, 1) * 210; };
    var e0 = "", e1 = "";
    pts.forEach(function (p, i) {
      e0 += (i ? "L" : "M") + X2(p.s0).toFixed(1) + " " + Y(p.z).toFixed(1);
      e1 += (i ? "L" : "M") + X2(protected1(p, res.mat, res.ci, res.cs).s).toFixed(1) + " " + Y(p.z).toFixed(1);
    });
    s += '<path d="' + e0 + '" fill="none" stroke="#c9613f" stroke-width="1.6"/>';
    s += '<path d="' + e1 + '" fill="none" stroke="#41699b" stroke-width="2"/>';
    s += '<text x="400" y="' + (bot + 16) + '" font-size="9" fill="#9ba3a9" font-family="monospace">0</text>';
    s += '<text x="590" y="' + (bot + 16) + '" font-size="9" fill="#9ba3a9" font-family="monospace">0.8 mm/y</text>';
    /* 深度轴 */
    s += '<line x1="80" y1="' + top + '" x2="80" y2="' + bot + '" stroke="#242b2e" stroke-width="1.1"/>';
    [0, 1500, 3000].forEach(function (z) {
      s += '<line x1="76" y1="' + Y(z).toFixed(1) + '" x2="80" y2="' + Y(z).toFixed(1) + '" stroke="#242b2e"/>';
      s += '<text x="74" y="' + (Y(z) + 3).toFixed(1) + '" font-size="9" fill="#79828a" text-anchor="end">' + z + ' m</text>';
    });
    /* 风险位置标注 */
    s += '<circle cx="' + X1(res.vmax).toFixed(1) + '" cy="' + Y(res.zv).toFixed(1) + '" r="3.4" fill="#41699b"/>';
    s += '<text x="' + (X1(res.vmax) + 6).toFixed(1) + '" y="' + (Y(res.zv) - 4).toFixed(1) + '" font-size="9.5" fill="#41699b">腐蚀峰值 ' +
      res.zv.toFixed(0) + ' m</text>';
    s += '<circle cx="' + X2(res.smax).toFixed(1) + '" cy="' + Y(res.zs).toFixed(1) + '" r="3.4" fill="#c9613f"/>';
    s += '<text x="' + (X2(res.smax) + 6).toFixed(1) + '" y="' + (Y(res.zs) - 4).toFixed(1) + '" font-size="9.5" fill="#c9613f">结垢峰值 ' +
      res.zs.toFixed(0) + ' m</text>';
    s += '<text x="14" y="' + (bot + 34) + '" font-size="10" fill="#4d565b">' +
      '腐蚀峰值与结垢峰值通常不在同一深度：一个跟着温度走，一个跟着压力释放走——这就是要按深度算而不是按井口算的原因。</text>';
    profSvg.innerHTML = s;
  }

  /* ---------- 4. 方案前沿 ---------- */
  function drawPf(cands, cur, best) {
    var W = 720, Hs = 230, ML = 66, MR = 18, MT = 26, MB = 34;
    var x1 = Math.max.apply(null, cands.map(function (c) { return c.cost; })) * 1.05;
    var y1 = 42;
    var X = function (v) { return ML + clamp(v / x1, 0, 1.05) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - clamp(v / y1, 0, 1)) * (Hs - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">候选组合（管材 × 缓蚀剂 × 阻垢剂，924 组）：横轴年化成本、纵轴剩余寿命；虚线为设计年限</text>';
    [0, 10, 20, 30, 40].forEach(function (v) {
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + v + '</text>';
    });
    s += '<line x1="' + ML + '" y1="' + Y(DESIGN).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(DESIGN).toFixed(1) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (W - MR - 4) + '" y="' + (Y(DESIGN) - 5).toFixed(1) + '" font-size="9.5" fill="#c9613f" text-anchor="end">设计年限 ' + DESIGN + ' 年</text>';
    cands.forEach(function (c) {
      s += '<circle cx="' + X(c.cost).toFixed(1) + '" cy="' + Y(c.life).toFixed(1) + '" r="2" fill="' +
        (c.ok ? c.mat.col : "#b9c6cf") + '" opacity="' + (c.ok ? 0.6 : 0.5) + '"/>';
    });
    if (best) {
      s += '<circle cx="' + X(best.cost).toFixed(1) + '" cy="' + Y(best.life).toFixed(1) + '" r="7" fill="none" stroke="#2f7d6b" stroke-width="1.8"/>';
      s += '<text x="' + (X(best.cost) + 10).toFixed(1) + '" y="' + (Y(best.life) - 6).toFixed(1) + '" font-size="10" fill="#2f7d6b">' +
        best.mat.nm + ' · ' + best.cost.toFixed(1) + ' 万/年</text>';
    }
    if (cur) {
      s += '<rect x="' + (X(cur.cost) - 4.5).toFixed(1) + '" y="' + (Y(cur.life) - 4.5).toFixed(1) + '" width="9" height="9" fill="#242b2e"/>';
      s += '<text x="' + (X(cur.cost) + 9).toFixed(1) + '" y="' + (Y(cur.life) + 14).toFixed(1) + '" font-size="10" fill="#242b2e">常用做法</text>';
    }
    s += '<text x="' + (W - MR) + '" y="' + (Hs - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">年化成本 万元 →</text>';
    s += '<text x="' + (ML - 6) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 剩余寿命 年</text>';
    pfSvg.innerHTML = s;
  }

  /* ---------- 5. 加药寻优曲线 ---------- */
  function drawDose(ctx, mat, ciOpt, csOpt) {
    var W = 720, Hs = 230, ML = 62, MR = 62, MT = 26, MB = 34;
    var arr = [];
    for (var ci = 0; ci <= 200; ci += 5) {
      var r = evaluate(ctx, mat, ci, csOpt);
      arr.push({ ci: ci, cost: r.cost, life: r.life, v: r.vmax });
    }
    var c0 = Math.min.apply(null, arr.map(function (a) { return a.cost; }));
    var c1 = Math.max.apply(null, arr.map(function (a) { return a.cost; }));
    var l1 = Math.max.apply(null, arr.map(function (a) { return a.life; })) || 1;
    var X = function (v) { return ML + v / 200 * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - c0 * 0.9) / ((c1 * 1.05 - c0 * 0.9) || 1)) * (Hs - MT - MB); };
    var YL = function (v) { return MT + (1 - v / (l1 * 1.1 || 1)) * (Hs - MT - MB); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">加药寻优（' + mat.nm +
      '，阻垢剂固定为 ' + csOpt + ' ppm）：药剂量不是越多越好，也不是越少越好</text>';
    var dC = "", dL = "";
    arr.forEach(function (a, i) {
      dC += (i ? "L" : "M") + X(a.ci).toFixed(1) + " " + Y(a.cost).toFixed(1);
      dL += (i ? "L" : "M") + X(a.ci).toFixed(1) + " " + YL(a.life).toFixed(1);
    });
    s += '<path d="' + dL + '" fill="none" stroke="#c9613f" stroke-width="1.4" stroke-dasharray="4 3"/>';
    s += '<path d="' + dC + '" fill="none" stroke="#41699b" stroke-width="2"/>';
    var bx = X(ciOpt);
    s += '<line x1="' + bx.toFixed(1) + '" y1="' + MT + '" x2="' + bx.toFixed(1) + '" y2="' + (Hs - MB) + '" stroke="#2f7d6b" stroke-dasharray="3 2"/>';
    var b = arr.filter(function (a) { return a.ci === ciOpt; })[0] || arr[0];
    s += '<circle cx="' + bx.toFixed(1) + '" cy="' + Y(b.cost).toFixed(1) + '" r="5" fill="#2f7d6b"/>';
    s += '<text x="' + (bx + 8).toFixed(1) + '" y="' + (Y(b.cost) - 6).toFixed(1) + '" font-size="10.5" fill="#2f7d6b">最优 ' + ciOpt + ' ppm</text>';
    s += '<text x="' + (W - MR + 6) + '" y="' + (MT + 10) + '" font-size="9" fill="#c9613f">寿命</text>';
    s += '<text x="' + (W - MR + 6) + '" y="' + (MT + 24) + '" font-size="9" fill="#c9613f">0–' + l1.toFixed(0) + ' 年</text>';
    s += '<text x="' + (W - MR) + '" y="' + (Hs - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">缓蚀剂浓度 ppm →</text>';
    s += '<text x="' + (ML - 6) + '" y="' + (MT - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 年化成本</text>';
    s += '<text x="' + ML + '" y="' + (Hs - 20) + '" font-size="10" fill="#4d565b">' +
      '成本曲线是 U 形：药量不足则管柱换得勤，药量过头则药剂费白付——最优点在中间，而且随产液量移动。</text>';
    doseSvg.innerHTML = s;
  }

  /* ---------- 6. 主流程 ---------- */
  function draw() {
    var pco2 = Number(IN[0].value), h2s = Number(IN[1].value), cl = Number(IN[2].value),
      tb = Number(IN[3].value), pb = Number(IN[4].value), q = Number(IN[5].value);
    el("out-co2").textContent = pco2.toFixed(2) + " MPa";
    el("out-h2s").textContent = h2s + " ppm";
    el("out-cl").textContent = cl + " mg/L";
    el("out-t").textContent = tb + " ℃";
    el("out-p").textContent = pb + " MPa";
    el("out-q").textContent = q + " m³/d";

    var ctx = { pco2: pco2, h2s: h2s, cl: cl, tb: tb, pb: pb, q: q };
    var pts = profile(ctx);

    /* 寻优：管材 × 缓蚀剂 × 阻垢剂 */
    var cands = [], best = null;
    for (var m = 0; m < MATS.length; m++) {
      for (var ci = 0; ci <= 200; ci += 10) {
        for (var cs = 0; cs <= 50; cs += 5) {
          var r = evaluate(ctx, MATS[m], ci, cs);
          cands.push(r);
          if (r.ok && (!best || r.cost < best.cost)) best = r;
        }
      }
    }
    /* 常用做法（对比基准）：碳钢 + 缓蚀剂 100 ppm + 阻垢剂 15 ppm */
    var cur = evaluate(ctx, MATS[0], 100, 15);
    var res = best || cur;

    drawProf(pts, res);
    drawPf(cands, cur, best);
    drawDose(ctx, res.mat, res.ci, res.cs);

    /* 读数 */
    var pEl = el("ro-pick");
    pEl.textContent = best
      ? res.mat.nm + " · 缓蚀剂 " + res.ci + " ppm · 阻垢剂 " + res.cs + " ppm"
      : "无满足设计年限的组合";
    pEl.className = best ? "ok" : "bad";
    var cEl = el("ro-cost");
    cEl.textContent = best ? res.cost.toFixed(1) + " 万元/年" : "—";
    cEl.className = best ? "ok" : "bad";
    var lEl = el("ro-life");
    lEl.textContent = res.life.toFixed(1) + " 年";
    lEl.className = res.life >= DESIGN ? "ok" : "bad";
    var zEl = el("ro-pos");
    zEl.textContent = "腐蚀 " + res.zv.toFixed(0) + " m / 结垢 " + res.zs.toFixed(0) + " m";
    zEl.className = "";

    /* 解说 */
    var msg = "不加防护时，全井筒最大腐蚀速率 <b>" + res.vRaw.toFixed(2) + " mm/y</b>、最大结垢速率 <b>" +
      res.sRaw.toFixed(3) + " mm/y</b>；腐蚀峰值在 <b>" + res.zv.toFixed(0) + " m</b>、结垢峰值在 <b>" +
      res.zs.toFixed(0) + " m</b>——<b>两者通常不在同一深度</b>（腐蚀跟着温度走，结垢跟着压力释放走），" +
      "这也是必须按深度算、而不是按井口一个点算的原因。";
    if (!best) {
      msg += " 当前工况下<b>没有任何组合能满足 " + DESIGN +
        " 年设计年限</b>：要么接受更短的检管周期，要么改工况（脱水、降矿化度、降流速）。" +
        "这种情况本身就是结论，不该硬凑一个方案出来。";
    } else {
      var cheap = cands.filter(function (c) { return c.ok; }).sort(function (a, b) { return a.mat.price - b.mat.price; })[0];
      msg += " 推荐 <b>" + res.mat.nm + " + 缓蚀剂 " + res.ci + " ppm + 阻垢剂 " + res.cs + " ppm</b>：" +
        "加防护后最大腐蚀速率降到 " + res.vmax.toFixed(3) + " mm/y（允许 " + V_LIM + "），剩余寿命 <b>" +
        res.life.toFixed(1) + " 年</b>，年化成本 <b>" + res.cost.toFixed(1) + " 万元</b>（管材摊销 " +
        (res.mat.price * H / 10000 / res.life).toFixed(1) + " 万 + 药剂 " +
        ((res.ci * q * 365 / 1000 * CI_PRICE + res.cs * q * 365 / 1000 * SI_PRICE) / 10000).toFixed(1) +
        " 万 + 检测 " + CHECK + " 万）。";
      if (res.mat.price > 500 && cheap && cheap.mat.price < res.mat.price) {
        msg += " 有意思的是：<b>贵的管材在这里更省</b>——" + cheap.mat.nm + " 单价只有 " + cheap.mat.price +
          " 元/m，但要用大量药剂把腐蚀压住（年化 " + cheap.cost.toFixed(1) +
          " 万），而管材摊销摊到 " + res.life.toFixed(0) + " 年之后反而更便宜。" +
          "这类结论只有把管材与药剂放在同一个目标里才会出现。";
      }
      if (res.ssc === "soft") {
        msg += " 注意硫化氢：" + h2s + " ppm 已超过 " + res.mat.nm +
          " 的抗硫软边界，寿命按 0.7 折算过——<b>这一条是硬的，不能靠加药补回来</b>。";
      }
      var killed = MATS.filter(function (mt) { return h2s > mt.sscHard; });
      if (killed.length) {
        msg += " 因硫化氢超过抗硫上限而被否决的管材：" +
          killed.map(function (mt) { return "<b>" + mt.nm + "</b>"; }).join("、") + "（" + h2s + " ppm）。";
      }
      if (!cur.ok) {
        msg += " 作为对比，<b>常用做法</b>（碳钢 + 缓蚀剂 100 ppm + 阻垢剂 15 ppm）在本次工况下剩余寿命只有 " +
          cur.life.toFixed(1) + " 年，达不到设计年限——这正是「按惯例加药」最容易漏掉的一类井。";
      }
    }
    msg += " 注：降阶模型，腐蚀与结垢关系式、价格与寿命阈值均为演示取值，不可用于选材、加药与寿命评估。";
    note.innerHTML = msg;
  }

  IN.forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
