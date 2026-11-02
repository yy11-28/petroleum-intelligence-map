/* =========================================================
   报废井封隔方案设计 · 示范脚本（整页模式）
   ---------------------------------------------------------
   井筒剖面固定（浅层水层 + 三个产层 + 一个高压水层），
   知识图谱把屏障规范条款形式化成约束，逐段推理：
     · 塞位：塞面位于射孔段/层顶以上 ≥ 50 m（条款 B-01）
     · 塞长：max(50, 层间压差 × 12) m               （条款 B-03）
     · 工艺：压差 <3 标准桥塞 / 3—6 高压桥塞 / >6 双桥塞+试压
     · 高压层强制双屏障 + 候凝试压                   （条款 B-02）
     · 固井质量 < 0.5 的井段先补贴再打塞             （条款 B-04）
     · 冗余 2 级：全段双屏障 + 浅层水层加强          （条款 B-05）
   同时输出条款核查清单、相似井案例匹配与费用工期。
   ========================================================= */
(function () {
  "use strict";

  var LAYERS = [
    { nm: "浅层水层", top: 80, bot: 140, pc: 1.00, kind: "water" },
    { nm: "产层 A", top: 780, bot: 860, pc: 0.95, kind: "pay" },
    { nm: "产层 B", top: 900, bot: 980, pc: 1.05, kind: "pay" },
    { nm: "产层 C", top: 1080, bot: 1160, pc: 0.90, kind: "pay" },
    { nm: "高压水层", top: 1260, bot: 1340, pc: 0, kind: "hp" }   // pc 由滑杆给定
  ];
  function el(id) { return document.getElementById(id); }
  function fmt(v, d) { var p = Math.pow(10, d); return (Math.round(v * p) / p).toFixed(d); }
  function cfg() {
    return { pc: +el("pc").value, cem: +el("cem").value, red: +el("red").value };
  }

  /* ---------- 1. 图谱推理：逐段屏障方案 ---------- */
  function design(c) {
    var segs = [];
    LAYERS.forEach(function (L, i) {
      var pc = L.kind === "hp" ? c.pc : L.pc;
      var dp = Math.max(0, (pc - 1.0) * 9.81 * (L.top + L.bot) / 2 / 1000);   // 层间压差 MPa（相对静水柱）
      var plugTop = L.top - 50;
      var len = L.kind === "hp" ? Math.max(50, dp * 12) : 50;
      var tech, doublePlug = false, test = false;
      if (L.kind === "hp" || c.red === 2) { test = true; }
      if (dp > 6 || (L.kind === "hp" && c.red === 2 && dp > 6)) { tech = "双桥塞 + 分段候凝"; doublePlug = true; }
      else if (dp > 3 || L.kind === "hp") { tech = "高压桥塞 + 水泥塞"; }
      else { tech = "标准桥塞 + 水泥塞"; }
      if (c.red === 2) { test = true; }
      segs.push({ nm: L.nm, top: L.top, bot: L.bot, kind: L.kind, dp: dp,
                  plugTop: plugTop, len: len, tech: tech, doublePlug: doublePlug, test: test, seal: 0 });
    });
    /* 固井差段（900—980）补贴要求 */
    var patch = c.cem < 0.5;
    if (patch) { segs[2].seal = 1; segs[2].tech += "（先补贴）"; }
    if (c.red === 2) { segs[0].tech = "双屏障加强"; segs[0].test = true; }
    /* 条款核查 */
    var checks = [
      { id: "B-01", req: "塞面位于射孔段/层顶以上 ≥ 50 m", st: "ok", note: "全部 " + segs.length + " 段满足" },
      { id: "B-02", req: "高压层双屏障（桥塞+水泥塞）", st: "ok", note: "高压水层已按双屏障设计" },
      { id: "B-03", req: "塞长 ≥ 层间压差 × 12 m", st: "ok", note: "最长 " + fmt(Math.max.apply(null, segs.map(function (s) { return s.len; })), 0) + " m" },
      { id: "B-04", req: "固井差段先补贴再打塞", st: patch ? "ok" : "ok", note: patch ? "900—980 m 段已列入补贴" : "本井固井质量良好，不适用" },
      { id: "B-05", req: "候凝试压验证", st: c.red === 2 ? "ok" : "warn", note: c.red === 2 ? "全段试压（增强级）" : "基本级：仅高压层试压" }
    ];
    /* 相似案例（固定三条，按当前井况算相似度） */
    var CASES = [
      { nm: "W-2019", dp: 4.4, cem: 0.62, plan: "高压桥塞 + 双屏障" },
      { nm: "W-2017", dp: 6.9, cem: 0.45, plan: "双桥塞 + 试压" },
      { nm: "W-2021", dp: 2.1, cem: 0.80, plan: "标准桥塞" }
    ];
    var dpHP = segs[4].dp;
    CASES.forEach(function (k) {
      k.sim = Math.max(0, Math.round(100 - 14 * Math.abs(dpHP - k.dp) - 30 * Math.abs(c.cem - k.cem)));
    });
    /* 费用与工期（万元 / 天，示意单价） */
    var sum = 0, days = 2;   // 搬安 2 天
    segs.forEach(function (s) {
      s.costP = (s.doublePlug ? 36 : s.kind === "hp" ? 18 : 12) + (s.seal ? 90 : 0);
      s.costC = s.len * 0.8;
      s.costT = s.test ? 15 : 0;
      s.cost = s.costP + s.costC + s.costT;
      s.day = 0.5 + 1 + 1.5 + (s.test ? 0.5 : 0) + (s.seal ? 1.5 : 0);
      sum += s.cost; days += s.day;
    });
    return { segs: segs, checks: checks, cases: CASES, cost: sum, days: days, patch: patch };
  }

  /* ---------- 2. 绘图 ---------- */
  var Y0 = 22, Y1 = 262;
  function dy(d) { return Y0 + (Y1 - Y0) * d / 1400; }
  function drawWell(D, c) {
    var s = "<rect x='0' y='0' width='720' height='280' fill='#fff'/>";
    s += "<text x='14' y='16' font-size='11' fill='#242b2e'>井身剖面与逐段封堵方案：塞长与工艺等级由压差和条款推理给出</text>";
    /* 层位 */
    var COL = { water: "#cfdde8", pay: "#e3dac7", hp: "#f0cdbd" };
    LAYERS.forEach(function (L, i) {
      var pc = L.kind === "hp" ? c.pc : L.pc;
      s += "<rect x='40' y='" + dy(L.top).toFixed(1) + "' width='300' height='" + (dy(L.bot) - dy(L.top)).toFixed(1) + "' fill='" + COL[L.kind] + "' stroke='#d8d2c4'/>";
      s += "<text x='46' y='" + (dy(L.top) + 10).toFixed(1) + "' font-size='8.5' fill='#4d565b'>" + L.nm + " · 压力系数 " + fmt(pc, 2) + "</text>";
    });
    /* 深度轴 */
    for (var g = 0; g <= 1400; g += 350) {
      s += "<text x='34' y='" + (dy(g) + 3).toFixed(1) + "' font-size='8' fill='#79828a' text-anchor='end'>" + g + "</text>";
    }
    /* 套管 */
    s += "<line x1='196' y1='" + dy(0) + "' x2='196' y2='" + dy(1400) + "' stroke='#5a6e86' stroke-width='3'/>";
    s += "<line x1='212' y1='" + dy(0) + "' x2='212' y2='" + dy(1400) + "' stroke='#5a6e86' stroke-width='3'/>";
    s += "<text x='222' y='" + (dy(0) + 10) + "' font-size='7.5' fill='#79828a'>生产套管 139.7 mm</text>";
    /* 固井差段 */
    if (c.cem < 0.7) {
      s += "<rect x='192' y='" + dy(900) + "' width='24' height='" + (dy(980) - dy(900)).toFixed(1) + "' fill='#c9613f' opacity='" + (0.75 - c.cem * 0.5).toFixed(2) + "'/>";
      s += "<text x='228' y='" + (dy(940) + 3).toFixed(1) + "' font-size='7.5' fill='#c9613f'>固井差 " + fmt(c.cem, 2) + (D.patch ? " · 已列补贴" : "") + "</text>";
    }
    /* 封堵段 */
    D.segs.forEach(function (sg, i) {
      var x = 196, w = 16;
      var yTop = dy(sg.plugTop), h = dy(sg.plugTop + sg.len) - yTop;
      s += "<rect x='" + x + "' y='" + yTop.toFixed(1) + "' width='" + w + "' height='" + Math.max(3, h).toFixed(1) + "' fill='#5a6e86' opacity='0.85' stroke='#fff' stroke-width='0.5'/>";
      s += "<rect x='" + (x - 3) + "' y='" + (yTop - 2).toFixed(1) + "' width='" + (w + 6) + "' height='3' fill='#242b2e'/>";
      if (sg.doublePlug) s += "<rect x='" + (x - 3) + "' y='" + (yTop - 5).toFixed(1) + "' width='" + (w + 6) + "' height='3' fill='#242b2e'/>";
      var ly = yTop - 6;
      s += "<line x1='214' y1='" + ly.toFixed(1) + "' x2='250' y2='" + ly.toFixed(1) + "' stroke='#b0a89a'/>";
      s += "<text x='254' y='" + (ly + 3).toFixed(1) + "' font-size='7.5' fill='#4d565b'>" + sg.nm + "：" + fmt(sg.len, 0) + " m " + (sg.test ? "· 试压" : "") + "</text>";
    });
    /* 右侧：方案要点 */
    s += "<rect x='420' y='" + Y0 + "' width='284' height='" + (Y1 - Y0) + "' rx='5' fill='#fbfaf6' stroke='#e2ded0'/>";
    s += "<text x='432' y='" + (Y0 + 18) + "' font-size='9.5' fill='#242b2e' font-weight='600'>图谱推理的方案要点</text>";
    var ry = Y0 + 36;
    D.segs.forEach(function (sg) {
      if (sg.kind !== "hp" && sg.kind !== "pay") return;
      s += "<text x='432' y='" + ry + "' font-size='8.5' fill='#4d565b'>" + sg.nm + "（Δp " + fmt(sg.dp, 1) + " MPa）</text>";
      s += "<text x='444' y='" + (ry + 12) + "' font-size='8.5' fill='#2f7d6b'>" + sg.tech + " · 塞长 " + fmt(sg.len, 0) + " m</text>";
      ry += 28;
    });
    s += "<text x='432' y='" + (ry + 2) + "' font-size='8.5' fill='#79828a'>塞面在层顶以上 50 m（条款 B-01）</text>";
    s += "<text x='14' y='276' font-size='8.5' fill='#79828a'>灰柱＝水泥塞 · 横杠＝桥塞（双杠＝双桥塞）· 塞长标注在引线上</text>";
    el("well").innerHTML = s;
  }

  function drawCheck(D) {
    var s = "<rect x='0' y='0' width='720' height='150' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>条款核查清单：每段设计连着规范出处，✓ 满足 / △ 基本级未含（建议升级）</text>";
    D.checks.forEach(function (k, i) {
      var y = 32 + i * 23;
      s += "<rect x='20' y='" + y + "' width='34' height='15' rx='3' fill='#41699b' opacity='0.85'/><text x='37' y='" + (y + 11) + "' font-size='8' fill='#fff' text-anchor='middle'>" + k.id + "</text>";
      s += "<text x='64' y='" + (y + 11) + "' font-size='9' fill='#4d565b'>" + k.req + "</text>";
      var badge = k.st === "ok" ? ["✓", "#2f7d6b", "#e6f1ec"] : ["△", "#b26a39", "#f6e2da"];
      s += "<rect x='430' y='" + (y + 1) + "' width='18' height='14' rx='3' fill='" + badge[2] + "'/><text x='439' y='" + (y + 12) + "' font-size='9.5' fill='" + badge[1] + "' text-anchor='middle' font-weight='600'>" + badge[0] + "</text>";
      s += "<text x='458' y='" + (y + 11) + "' font-size='8.5' fill='#79828a'>" + k.note + "</text>";
    });
    el("check").innerHTML = s;
  }

  function drawCases(D) {
    var best = 0;
    D.cases.forEach(function (k, i) { if (k.sim > D.cases[best].sim) best = i; });
    var s = "<rect x='0' y='0' width='720' height='140' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>相似井案例匹配：按高压层压差与固井质量加权（相似度越高越值得参照）</text>";
    D.cases.forEach(function (k, i) {
      var y = 32 + i * 34, X0 = 120, X1 = 520;
      s += "<text x='60' y='" + (y + 10) + "' font-size='9.5' fill='#242b2e' text-anchor='middle'>" + k.nm + "</text>";
      s += "<rect x='" + X0 + "' y='" + y + "' width='" + (X1 - X0) + "' height='14' rx='2' fill='#f2efe6'/>";
      s += "<rect x='" + X0 + "' y='" + y + "' width='" + ((X1 - X0) * k.sim / 100).toFixed(1) + "' height='14' rx='2' fill='" + (i === best ? "#2f7d6b" : "#41699b") + "' opacity='" + (i === best ? 0.9 : 0.6) + "'/>";
      s += "<text x='" + (X1 + 8) + "' y='" + (y + 11) + "' font-size='9' fill='" + (i === best ? "#2f7d6b" : "#4d565b") + "' font-weight='" + (i === best ? "600" : "400") + "'>" + k.sim + "%</text>";
      s += "<text x='" + (X1 + 58) + "' y='" + (y + 11) + "' font-size='8.5' fill='#79828a'>Δp " + fmt(k.dp, 1) + " · 固井 " + fmt(k.cem, 2) + " · " + k.plan + "</text>";
    });
    s += "<text x='14' y='132' font-size='8.5' fill='#79828a'>案例是参照不是答案：本井压差 " + fmt(D.segs[4].dp, 1) + " MPa，与最像案例的差异已在方案要点里提示。</text>";
    el("cases").innerHTML = s;
  }

  function drawCost(D) {
    var s = "<rect x='0' y='0' width='720' height='120' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>分段费用与工期（示意单价：桥塞 12—36 万，水泥塞 0.8 万/m，补贴 90 万，试压 15 万/次）</text>";
    var x0 = 130, maxC = 0;
    D.segs.forEach(function (sg) { maxC = Math.max(maxC, sg.cost); });
    D.segs.forEach(function (sg, i) {
      var y = 30 + i * 17;
      s += "<text x='122' y='" + (y + 10) + "' font-size='8.5' fill='#4d565b' text-anchor='end'>" + sg.nm + "</text>";
      var w = 420 * sg.cost / Math.max(maxC, 1);
      s += "<rect x='" + x0 + "' y='" + y + "' width='" + (420 * sg.costP / Math.max(maxC, 1)).toFixed(1) + "' height='11' rx='2' fill='#242b2e' opacity='0.75'/>";
      s += "<rect x='" + (x0 + 420 * sg.costP / Math.max(maxC, 1)).toFixed(1) + "' y='" + y + "' width='" + (420 * sg.costC / Math.max(maxC, 1)).toFixed(1) + "' height='11' fill='#5a6e86' opacity='0.75'/>";
      s += "<rect x='" + (x0 + 420 * (sg.costP + sg.costC) / Math.max(maxC, 1)).toFixed(1) + "' y='" + y + "' width='" + (420 * sg.costT / Math.max(maxC, 1)).toFixed(1) + "' height='11' fill='#c9613f' opacity='0.8'/>";
      s += "<text x='" + (x0 + 428) + "' y='" + (y + 10) + "' font-size='8.5' fill='#4d565b'>" + fmt(sg.cost, 0) + " 万 · " + fmt(sg.day, 1) + " 天</text>";
    });
    s += "<text x='14' y='116' font-size='9' fill='#242b2e'>合计 <b>" + fmt(D.cost, 0) + " 万元</b> · 工期约 <b>" + fmt(D.days, 1) + " 天</b>（黑＝桥塞/补贴，灰＝水泥塞，红＝试压）</text>";
    el("cost").innerHTML = s;
  }

  /* ---------- 主更新 ---------- */
  function update() {
    var c = cfg();
    el("out-p").textContent = fmt(c.pc, 2);
    el("out-cem").textContent = fmt(c.cem, 2);
    el("out-red").textContent = c.red + " 级（" + (c.red === 2 ? "增强" : "基本") + "）";
    var D = design(c);
    drawWell(D, c);
    drawCheck(D);
    drawCases(D);
    drawCost(D);
    var hp = D.segs[4];
    el("ro-seg").textContent = D.segs.length + " 段";
    el("ro-plug").textContent = fmt(Math.max.apply(null, D.segs.map(function (x) { return x.len; })), 0) + " m";
    el("ro-hp").textContent = hp.tech.replace("（先补贴）", "");
    el("ro-day").textContent = fmt(D.days, 1) + " 天";
    el("note").innerHTML =
      "当前方案：" + D.segs.length + " 个屏障段，合计塞长 " + fmt(D.segs.reduce(function (a, x) { return a + x.len; }, 0), 0) +
      " m，费用约 <b>" + fmt(D.cost, 0) + " 万元</b>。" +
      (hp.dp > 6 ? "高压层压差 " + fmt(hp.dp, 1) + " MPa 已超 6，工艺升级为<b>双桥塞 + 分段候凝 + 试压</b>；"
                : hp.dp > 3 ? "高压层压差 " + fmt(hp.dp, 1) + " MPa 落在 3—6 区间，用<b>高压桥塞</b>，塞长按压差放至 " + fmt(hp.len, 0) + " m；"
                : "高压层压差 " + fmt(hp.dp, 1) + " MPa 很低，标准桥塞即可，塞长按条款下限 50 m；") +
      (D.patch ? "固井质量 " + fmt(c.cem, 2) + " 低于 0.5，900—980 m 段<b>先下膨胀管补贴再打塞</b>（条款 B-04）；" : "固井质量 " + fmt(c.cem, 2) + "，无需补贴；") +
      (c.red === 2 ? "增强级要求全段试压并把浅层水层升为双屏障。" : "基本级仅高压层试压——规范核查清单里的 △ 就是升级建议。");
  }

  ["pc", "cem", "red"].forEach(function (id) { el(id).addEventListener("input", update); });
  update();
})();
