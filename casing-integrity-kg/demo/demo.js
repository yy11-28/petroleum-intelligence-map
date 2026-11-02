/* =========================================================
   套管完整性监测 · 示范脚本（整页模式）
   ---------------------------------------------------------
   ① 由「服役年限 / 腐蚀介质 / 出砂强度 / 固井质量」生成
      一条多臂井径合成的剩余壁厚曲线（含三种典型异常）：
        · 均匀减薄 + 局部加重段  → CO₂/H₂S 腐蚀
        · 最大/最小井径分叉      → 泥岩挤压变形（固井差会放大）
        · 射孔段局部骤薄         → 出砂冲蚀，壁厚过低则漏失
   ② 征兆量化 → 知识图谱推理：征兆 → 失效模式 → 处置手段，
      每条边可追溯，置信度由证据强度决定。
   ========================================================= */
(function () {
  "use strict";

  var L = 1400, DST = 2, T0 = 10;           // 井深 · 采样步长 · 初始壁厚 mm
  function el(id) { return document.getElementById(id); }
  function fmt(v, d) { var p = Math.pow(10, d); return (Math.round(v * p) / p).toFixed(d); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function cfg() {
    return { yr: +el("yr").value, cor: +el("cor").value,
             sand: +el("sand").value, cem: +el("cem").value };
  }

  /* ---------- 1. 生成剩余壁厚曲线 ---------- */
  function wallSeries(c) {
    var pts = [], d;
    for (d = 0; d <= L; d += DST) {
      var t = T0 - c.cor * c.yr * 0.14;                       // 均匀减薄
      if (d >= 600 && d <= 700) t -= c.cor * c.yr * 0.12;     // 局部加重段
      var w = Math.abs(d - 850) < 40 ? 1 - Math.abs(d - 850) / 40 : 0;   // 泥岩段窗
      var ov = 0.006 * c.yr * (1.3 - 0.5 * c.cem) * w;        // 椭圆度
      var we = (d >= 1040 && d <= 1075) ? 1 - Math.abs(d - 1057.5) / 17.5 : 0;
      var tf = Math.max(2.5, t - c.sand * c.yr * 0.22 * we);  // 冲蚀骤薄
      pts.push({ d: d, t: tf, mx: Math.min(12, tf * (1 + ov)), mn: Math.max(2.5, tf * (1 - 1.3 * ov)) });
    }
    return pts;
  }

  /* ---------- 2. 征兆量化 ---------- */
  function symptoms(P, c) {
    function at(d, k) { return P[Math.round(d / DST)][k]; }
    var thin = (T0 - at(400, "t")) / T0;                       // 均匀减薄率
    var local = (T0 - at(650, "t")) / T0;                      // 局部加重
    var ov = (at(850, "mx") - at(850, "mn")) / T0;             // 椭圆度
    var step = at(1030, "t") - at(1052, "t");                  // 壁厚突变
    var minT = Infinity, i;
    for (i = 0; i < P.length; i++) minT = Math.min(minT, P[i].mn);
    var leak = minT < 6;                                       // 漏失风险
    return { thin: thin, local: local, ov: ov, step: Math.max(0, step), minT: minT, leak: leak };
  }

  /* ---------- 3. 图谱推理：征兆 → 模式 → 处置 ---------- */
  function reason(S) {
    var confCor = clamp((clamp(S.thin / 0.20, 0, 1) + clamp(S.local / 0.20, 0, 1)) / 2 / 0.75, 0, 1);
    var confOval = clamp(S.ov / 0.15, 0, 1);
    var confEro = clamp(clamp(S.step / 3, 0, 1) * 0.6 + (S.leak ? 0.5 : 0), 0, 1);
    var confBrk = S.ov > 0.12 ? 0.9 : 0;
    var modes = [
      { nm: "CO₂/H₂S 腐蚀减薄", conf: S.thin > 0.05 || S.local > 0.08 ? confCor : 0, col: "#b26a39",
        act: S.thin > 0.30 ? "套管补贴（膨胀管）" : "加注缓蚀剂 + 年度监测",
        basis: "均匀减薄 " + fmt(S.thin * 100, 1) + "% · 局部加重段 600—700 m" },
      { nm: "泥岩挤压变形", conf: S.ov > 0.03 ? confOval : 0, col: "#41699b",
        act: S.ov > 0.12 ? "下小套管加固" : S.ov > 0.05 ? "磨铣整形 + 套管补贴" : "加密监测",
        basis: "椭圆度 " + fmt(S.ov * 100, 1) + "% · 850 m 泥岩段，固井质量放大外载" },
      { nm: "出砂冲蚀", conf: S.step > 0.8 || S.leak ? confEro : 0, col: "#c9613f",
        act: S.leak ? "挤水泥封堵 + 防砂重置（紧急）" : "挤水泥封堵评估",
        basis: "射孔段 1040—1075 m 壁厚骤薄 · 漏失风险 " + (S.leak ? "有" : "无") },
      { nm: "套管错断", conf: confBrk, col: "#7a5aa0",
        act: confBrk ? "下小套管 + 侧钻评估" : "—",
        basis: "椭圆度超 12% 错断线" }
    ];
    var sigs = [
      { nm: "均匀减薄", on: S.thin > 0.05, v: fmt(S.thin * 100, 1) + "%" },
      { nm: "局部加重", on: S.local > 0.08, v: fmt(S.local * 100, 1) + "%" },
      { nm: "椭圆变形", on: S.ov > 0.03, v: fmt(S.ov * 100, 1) + "%" },
      { nm: "壁厚突变", on: S.step > 0.8, v: fmt(S.step, 2) + " mm" },
      { nm: "漏失征兆", on: S.leak, v: S.leak ? "壁厚 < 6 mm" : "—" }
    ];
    return { modes: modes, sigs: sigs };
  }

  /* ---------- 4. 绘图 ---------- */
  function drawCal(P, S, c) {
    var X0 = 52, X1 = 690, Y0 = 30, Y1 = 200;
    var vx = function (v) { return X0 + (X1 - X0) * v / 12; };
    var dy = function (d) { return Y0 + (Y1 - Y0) * d / 1400; };
    var s = "<rect x='0' y='0' width='720' height='235' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>多臂井径合成：剩余壁厚曲线（红＝最大井径臂，蓝＝最小井径臂，虚线＝初始壁厚）</text>";
    [[600, 700, "#f2e2c8", "腐蚀加重段"], [810, 890, "#dbe4ef", "泥岩变形段"], [1040, 1075, "#f6dcd2", "出砂冲蚀段"]].forEach(function (b) {
      s += "<rect x='" + X0 + "' y='" + dy(b[0]).toFixed(1) + "' width='" + (X1 - X0) + "' height='" + (dy(b[1]) - dy(b[0])).toFixed(1) + "' fill='" + b[2] + "' opacity='0.55'/>";
      s += "<text x='" + (X1 - 4) + "' y='" + (dy(b[0]) + 10).toFixed(1) + "' font-size='8' fill='#79828a' text-anchor='end'>" + b[3] + "</text>";
    });
    for (var g = 0; g <= 1400; g += 350) {
      s += "<line x1='" + X0 + "' y1='" + dy(g).toFixed(1) + "' x2='" + X1 + "' y2='" + dy(g).toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='" + (X0 - 6) + "' y='" + (dy(g) + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + g + "m</text>";
    }
    for (g = 0; g <= 12; g += 3) {
      s += "<text x='" + vx(g).toFixed(1) + "' y='216' font-size='8.5' fill='#79828a' text-anchor='middle'>" + g + "</text>";
    }
    s += "<text x='" + ((X0 + X1) / 2) + "' y='230' font-size='8.5' fill='#79828a' text-anchor='middle'>剩余壁厚 mm</text>";
    s += "<line x1='" + X0 + "' y1='" + dy(0) + "' x2='" + X1 + "' y2='" + dy(0) + "' stroke='#242b2e' stroke-width='1.5'/>";
    function path(k) {
      return P.map(function (p, i) { return (i ? "L" : "M") + vx(p[k]).toFixed(1) + " " + dy(p.d).toFixed(1); }).join(" ");
    }
    s += "<path d='" + path("mx") + "' fill='none' stroke='#c9613f' stroke-width='1.6'/>";
    s += "<path d='" + path("mn") + "' fill='none' stroke='#41699b' stroke-width='1.6'/>";
    s += "<line x1='" + vx(10).toFixed(1) + "' y1='" + Y0 + "' x2='" + vx(10).toFixed(1) + "' y2='" + Y1 + "' stroke='#b0a89a' stroke-dasharray='4 3'/>"; // 初始壁厚参考线
    s += "<text x='" + (vx(10) + 4).toFixed(1) + "' y='" + (Y0 + 12) + "' font-size='8' fill='#b0a89a'>初始 10 mm</text>";
    s += "<text x='14' y='230' font-size='8.5' fill='#79828a'>服役 " + c.yr + " 年 · 最薄 " + fmt(S.minT, 1) + " mm</text>";
    el("cal").innerHTML = s;
  }

  function drawDetect(S) {
    var rows = [
      { k: "均匀减薄率", v: S.thin, hi: 0.6, th: 0.20, u: "%", f: 100 },
      { k: "局部加重率", v: S.local, hi: 0.6, th: 0.20, u: "%", f: 100 },
      { k: "椭圆度", v: S.ov, hi: 0.30, th: 0.12, u: "%", f: 100 },
      { k: "壁厚突变", v: S.step, hi: 4, th: 1.2, u: " mm", f: 1 },
      { k: "漏失风险", v: S.leak ? 1 : clamp((6 - S.minT) / 3, 0, 0.9), hi: 1, th: 0.8, u: "", f: 100, txt: S.leak ? "触发（壁厚<6mm）" : "未触发" }
    ];
    var s = "<rect x='0' y='0' width='720' height='150' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>征兆量化：横条为当前值，竖虚线为预警阈值——图谱只吃量化的证据</text>";
    rows.forEach(function (r, i) {
      var y = 34 + i * 23, X0 = 150, X1 = 560;
      s += "<text x='142' y='" + (y + 9) + "' font-size='9' fill='#4d565b' text-anchor='end'>" + r.k + "</text>";
      s += "<rect x='" + X0 + "' y='" + y + "' width='" + (X1 - X0) + "' height='13' rx='2' fill='#f2efe6'/>";
      var w = (X1 - X0) * clamp(r.v / r.hi, 0, 1);
      var col = r.v >= r.th ? "#c9613f" : "#41699b";
      s += "<rect x='" + X0 + "' y='" + y + "' width='" + w.toFixed(1) + "' height='13' rx='2' fill='" + col + "' opacity='0.8'/>";
      var tx = X0 + (X1 - X0) * r.th / r.hi;
      s += "<line x1='" + tx.toFixed(1) + "' y1='" + (y - 3) + "' x2='" + tx.toFixed(1) + "' y2='" + (y + 16) + "' stroke='#242b2e' stroke-dasharray='3 2'/>";
      s += "<text x='" + (X1 + 8) + "' y='" + (y + 10) + "' font-size='9' fill='" + col + "' font-weight='600'>" + (r.txt || fmt(r.v * r.f, 1) + r.u) + "</text>";
    });
    el("detect").innerHTML = s;
  }

  function drawKG(R, S) {
    var s = "<rect x='0' y='0' width='720' height='250' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>知识图谱推理链：征兆（左）→ 失效模式（中）→ 处置手段（右），线宽＝置信度</text>";
    var sigX = 20, sigW = 120, modX = 290, modW = 150, actX = 530, actW = 170;
    var sigY = function (i) { return 34 + i * 40; };
    var modY = function (i) { return 44 + i * 48; };
    var actY = { "缓蚀剂+监测": 40, "套管补贴": 82, "磨铣整形": 124, "挤水泥封堵": 166, "下小套管": 208 };
    var defs = "<defs><marker id='kgA' markerWidth='7' markerHeight='7' refX='6' refY='3' orient='auto'><path d='M0 0 L7 3 L0 6 Z' fill='#79828a'/></marker></defs>";
    s += defs;
    /* 节点：征兆 */
    R.sigs.forEach(function (g, i) {
      var y = sigY(i);
      s += "<rect x='" + sigX + "' y='" + y + "' width='" + sigW + "' height='28' rx='4' fill='" + (g.on ? "#e6f1ec" : "#f2efe6") + "' stroke='" + (g.on ? "#2f7d6b" : "#e2ded0") + "'/>";
      s += "<text x='" + (sigX + 8) + "' y='" + (y + 18) + "' font-size='9.5' fill='" + (g.on ? "#2f7d6b" : "#b0a89a") + "' font-weight='" + (g.on ? "600" : "400") + "'>" + g.nm + "</text>";
      s += "<text x='" + (sigX + sigW - 6) + "' y='" + (y + 18) + "' font-size='8' fill='" + (g.on ? "#2f7d6b" : "#b0a89a") + "' text-anchor='end'>" + g.v + "</text>";
    });
    /* 节点：失效模式 */
    R.modes.forEach(function (m, i) {
      var y = modY(i);
      var on = m.conf > 0.15;
      s += "<rect x='" + modX + "' y='" + y + "' width='" + modW + "' height='34' rx='4' fill='" + (on ? m.col : "#f2efe6") + "' opacity='" + (on ? 0.88 : 1) + "'/>";
      s += "<text x='" + (modX + 8) + "' y='" + (y + 15) + "' font-size='9.5' fill='" + (on ? "#fff" : "#b0a89a") + "' font-weight='" + (on ? "600" : "400") + "'>" + m.nm + "</text>";
      s += "<text x='" + (modX + 8) + "' y='" + (y + 28) + "' font-size='8' fill='" + (on ? "#f6e2da" : "#b0a89a") + "'>置信度 " + fmt(m.conf, 2) + "</text>";
    });
    /* 边：征兆 → 模式 */
    var link = [[0, 0], [1, 0], [2, 1], [2, 3], [3, 2], [4, 2]];
    link.forEach(function (L2) {
      var g = R.sigs[L2[0]], m = R.modes[L2[1]];
      var on = g.on && m.conf > 0.15;
      var x1 = sigX + sigW, y1 = sigY(L2[0]) + 14, x2 = modX, y2 = modY(L2[1]) + 17;
      s += "<path d='M" + x1 + " " + y1 + " C " + (x1 + 60) + " " + y1 + ", " + (x2 - 60) + " " + y2 + ", " + x2 + " " + y2 + "' fill='none' stroke='" + (on ? m.col : "#e2ded0") + "' stroke-width='" + (on ? 1 + 2 * m.conf : 1) + "' " + (on ? "marker-end='url(#kgA)'" : "") + "/>";
    });
    /* 节点：处置 + 边 */
    var actMap = { "缓蚀剂+监测": 0, "套管补贴": 0, "磨铣整形": 1, "下小套管": 1, "挤水泥封堵": 2 };
    Object.keys(actY).forEach(function (nm) {
      var y = actY[nm], on = false, src = -1;
      R.modes.forEach(function (m, i) {
        if (m.conf > 0.15 && m.act.indexOf(nm.split("+")[0]) >= 0) { on = true; src = i; }
      });
      s += "<rect x='" + actX + "' y='" + y + "' width='" + actW + "' height='30' rx='4' fill='" + (on ? "#e6f1ec" : "#f2efe6") + "' stroke='" + (on ? "#2f7d6b" : "#e2ded0") + "'/>";
      s += "<text x='" + (actX + 8) + "' y='" + (y + 19) + "' font-size='9.5' fill='" + (on ? "#2f7d6b" : "#b0a89a") + "' font-weight='" + (on ? "600" : "400") + "'>" + nm + "</text>";
      if (on && src >= 0) {
        var m = R.modes[src];
        s += "<path d='M" + (modX + modW) + " " + (modY(src) + 17) + " C " + (actX - 50) + " " + (modY(src) + 17) + ", " + (actX - 40) + " " + (y + 15) + ", " + actX + " " + (y + 15) + "' fill='none' stroke='" + m.col + "' stroke-width='" + (1 + 2 * m.conf) + "' marker-end='url(#kgA)'/>";
      }
    });
    s += "<text x='14' y='244' font-size='8.5' fill='#79828a'>灰＝证据不足未点亮。图谱的价值：每个推荐都能指着这条链回答「为什么」。</text>";
    el("kg").innerHTML = s;
  }

  /* ---------- 主更新 ---------- */
  function update() {
    var c = cfg();
    el("out-yr").textContent = c.yr + " 年";
    el("out-cor").textContent = fmt(c.cor, 2);
    el("out-sand").textContent = fmt(c.sand, 2);
    el("out-cem").textContent = fmt(c.cem, 2);

    var P = wallSeries(c), S = symptoms(P, c), R = reason(S);
    drawCal(P, S, c);
    drawDetect(S);
    drawKG(R, S);

    var top = null;
    R.modes.forEach(function (m) { if (m.conf > 0.15 && (!top || m.conf > top.conf)) top = m; });
    var grade = S.leak || S.minT < 5 ? ["红 · 高危", "bad"] : top && top.conf > 0.5 ? ["黄 · 异常", ""] : ["绿 · 正常", "ok"];
    el("ro-grade").textContent = grade[0];
    el("ro-grade").className = grade[1];
    el("ro-min").textContent = fmt(S.minT, 1) + " mm";
    el("ro-mode").textContent = top ? top.nm : "无异常征兆";
    el("ro-act").textContent = top ? top.act : "按周期复测";
    el("ro-act").className = top && top.conf > 0.5 ? "bad" : "";

    var tb = "<caption>处置方案卡（置信度超过 0.15 的模式）</caption><tr><th>失效模式</th><th>置信度</th><th>推荐处置</th><th>依据（图谱）</th><th>费用区间</th></tr>";
    var COST = { "缓蚀剂": "25 万/年", "补贴": "80—120 万", "磨铣": "60—90 万", "挤水泥": "150—220 万", "小套管": "260—340 万", "加密": "—", "侧钻": "—", "防砂": "150—220 万", "评估": "—" };
    var listed = false;
    R.modes.forEach(function (m) {
      if (m.conf <= 0.15) return;
      listed = true;
      var cost = "—";
      Object.keys(COST).forEach(function (k) { if (m.act.indexOf(k) >= 0) cost = COST[k]; });
      tb += "<tr><td class='nm'>" + m.nm + "</td><td>" + fmt(m.conf, 2) + "</td><td class='nm'><b>" + m.act + "</b></td><td>" + m.basis + "</td><td>" + cost + "</td></tr>";
    });
    if (!listed) tb += "<tr><td colspan='5' class='nm'>当前征兆均在证据阈值以下：按周期复测，图谱未点亮任何推理链。</td></tr>";
    el("tbl").innerHTML = tb;

    el("note").innerHTML =
      "当前井况（服役 " + c.yr + " 年 · 腐蚀 " + fmt(c.cor, 2) + " · 出砂 " + fmt(c.sand, 2) + " · 固井 " + fmt(c.cem, 2) + "）评定为 <b>" + grade[0] + "</b>。" +
      "把年限拉到 15 年以上或固井质量拉低，泥岩段椭圆度会冲过 12% 错断线，推理链切换到「下小套管」；" +
      "把出砂强度拉满且年限拉长，射孔段壁厚跌破 6 mm，漏失征兆点亮，处置升级为「挤水泥封堵（紧急）」。" +
      "同一口井，证据变了结论就变——但每一步都摆在图上。";
  }

  ["yr", "cor", "sand", "cem"].forEach(function (id) { el(id).addEventListener("input", update); });
  update();
})();
