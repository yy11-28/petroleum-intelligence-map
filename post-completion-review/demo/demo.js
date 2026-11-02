/* =========================================================
   单井完井后生产动态反演与方案复盘迭代 · 示范脚本（整页模式）
   ---------------------------------------------------------
   1) 正演：四个中间变量 → 初期产量 / 月递减率 / 含水上升
   2) 反演：与曲线比对，用留一法把产量缺口分摊到四个因素
   3) 检索：把这四个变量的组合拿去图谱里找最像的历史井
   4) 输出：主控因素 + 相似井 + 下一口井的改动建议
   ========================================================= */
(function () {
  "use strict";

  var Q0 = 32;            /* 设计初期产量 m³/d */
  var FACTORS = [
    { key: "skin",  name: "完井表皮（伤害 / 不完善）", unit: "" },
    { key: "open",  name: "孔眼打开程度不足",          unit: "" },
    { key: "poll",  name: "近井污染（钻井液 / 颗粒）", unit: "" },
    { key: "water", name: "水窜 / 底水锥进",           unit: "" }
  ];

  /* 理想状态：这四个数的取值——反演时把实际值逐项换成它就得到「如果这项没问题」 */
  var IDEAL = { skin: 1.0, open: 1, poll: 0, water: 0 };   /* 理想但不是零：留一块合理表皮 */

  /* 历史井库：四个变量的组合 + 当时的复盘结论 + 下一口井的改动 */
  var HIST = [
    { id: "W-041", v: [11, 0.62, 0.55, 0.30], poi: "筛管完井 + 打开程度不足",
      concl: "投产 8 个月后即低于设计 40%，压裂后恢复一半", next: "改用套管射孔 + 加大孔密，前置酸洗解除污染" },
    { id: "W-058", v: [4, 0.85, 0.20, 0.72], poi: "底水锥进为主",
      concl: "初期达产，第 10 个月含水由 12% 跳到 46%", next: "射孔避开下部 2 m，投产压差下调三成" },
    { id: "W-073", v: [14, 0.45, 0.70, 0.15], poi: "钻井液长时间浸泡造成近井污染",
      concl: "表皮反演 14，酸化后产量回到设计的 88%", next: "缩短完井液浸泡时间，改用低伤害体系" },
    { id: "W-086", v: [6, 0.72, 0.30, 0.34], poi: "四项都略差，没有单一主因",
      concl: "每一项单独看都不致命，叠加后差 34%", next: "逐项收紧，重点是孔密与投产压差" },
    { id: "W-092", v: [2, 0.95, 0.10, 0.10], poi: "基本达产，作为对照",
      concl: "18 个月累计达到设计的 96%", next: "维持现有完井方式与投产制度" }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function el(id) { return document.getElementById(id); }

  /* ---------- 1. 正演模型 ---------- */
  function forward(p, months) {
    var qi = Q0 * p.open / (1 + 0.055 * p.skin) * (1 - 0.22 * p.poll);
    var D = 0.020 + 0.055 * p.water + 0.0065 * p.skin;    /* 月递减率 */
    var q = [], wc = [], m, oil = 0;
    for (m = 1; m <= months; m++) {
      var rate = qi * Math.exp(-D * (m - 1));
      var w = clamp(p.water * (1 - Math.exp(-m / (2.5 + 8 * (1 - p.water)))), 0, 0.92);
      wc.push(w);
      var r = rate * (1 - w);
      q.push(r);
      oil += r * 30.4;
    }
    return { qi: qi, D: D, q: q, wc: wc, oil: oil };
  }

  /* 把四个因素都放到理想值，就是「设计该有的样子」 */
  function design(months) { return forward(IDEAL, months); }

  /* ---------- 2. 留一法归因 ---------- */
  function attribute(p, months) {
    var base = forward(p, months).oil;
    var idealall = design(months).oil;
    var gap = idealall - base;
    var out = FACTORS.map(function (f) {
      var q = {};
      FACTORS.forEach(function (g) { q[g.key] = (g.key === f.key) ? IDEAL[f.key] : p[g.key]; });
      var withoutIt = forward(q, months).oil;
      return { key: f.key, name: f.name, contrib: withoutIt - base };
    });
    var sumPos = out.reduce(function (a, b) { return a + Math.max(0, b.contrib); }, 0);
    out.forEach(function (x) {
      x.share = sumPos > 1e-9 ? Math.max(0, x.contrib) / sumPos : 0;
    });
    out.sort(function (a, b) { return b.contrib - a.contrib; });
    return { gap: gap, gapPct: gap / Math.max(idealall, 1e-9), items: out, ideal: idealall, actual: base };
  }

  /* ---------- 3. 图谱检索：找最像的历史井 ---------- */
  function matchWell(p) {
    var v = [p.skin, p.open, p.poll, p.water];
    var scale = [20, 0.65, 1, 1];
    return HIST.map(function (h) {
      var d2 = 0;
      for (var i = 0; i < 4; i++) d2 += Math.pow((v[i] - h.v[i]) / scale[i], 2);
      return { h: h, sim: Math.exp(-d2 / 2) };
    }).sort(function (a, b) { return b.sim - a.sim; });
  }

  /* ---------- 4. 绘图 ---------- */
  function lineX(ix, n, X0, X1) { return X0 + (X1 - X0) * ix / Math.max(1, n - 1); }
  function path(vals, X0, X1, Y0, Y1, hi) {
    return vals.map(function (v, i) {
      return lineX(i, vals.length, X0, X1).toFixed(1) + "," + (Y1 - (Y1 - Y0) * clamp(v / hi, 0, 1)).toFixed(1);
    }).join(" ");
  }

  function drawProd(p, months) {
    var X0 = 52, X1 = 700, Y0 = 32, Y1 = 160;
    var act = forward(p, months), des = design(months);
    var hi = Math.max.apply(null, des.q.concat(act.q)) * 1.1;
    var s = "<rect x='0' y='0' width='720' height='210' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>产量曲线：设计（虚线）与实际（实线）之间的面积，就是要解释的缺口</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='46' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(hi * g / 4, 0) + "</text>";
    }
    /* 缺口面积 */
    var pts = des.q.map(function (v, i) {
      return lineX(i, months, X0, X1).toFixed(1) + "," + (Y1 - (Y1 - Y0) * v / hi).toFixed(1);
    });
    var pts2 = act.q.slice().reverse().map(function (v, i) {
      var ix = months - 1 - i;
      return lineX(ix, months, X0, X1).toFixed(1) + "," + (Y1 - (Y1 - Y0) * v / hi).toFixed(1);
    });
    s += "<polygon points='" + pts.concat(pts2).join(" ") + "' fill='#c9613f' opacity='0.12'/>";
    s += "<polyline points='" + path(des.q, X0, X1, Y0, Y1, hi) + "' fill='none' stroke='#b9c6cf' stroke-width='1.6' stroke-dasharray='5 3'/>";
    s += "<polyline points='" + path(act.q, X0, X1, Y0, Y1, hi) + "' fill='none' stroke='#41699b' stroke-width='2'/>";
    /* 含水曲线（右半标尺示意，单独缩放到下半部） */
    var wy = act.wc.map(function (w, i) {
      return lineX(i, months, X0, X1).toFixed(1) + "," + (Y1 + 14 - 34 * w).toFixed(1);
    }).join(" ");
    s += "<polyline points='" + wy + "' fill='none' stroke='#2f7d6b' stroke-width='1.6'/>";
    s += "<text x='" + X0 + "' y='182' font-size='8.5' fill='#2f7d6b'>含水率：" + (act.wc[months - 1] * 100).toFixed(0) + "%（第 " + months + " 月）</text>";
    s += "<text x='200' y='182' font-size='8.5' fill='#41699b'>初期产量 " + fmt(act.qi, 1) + " m³/d　月递减 " + fmt(act.D * 100, 1) + "%　累计折减 " + fmt((1 - act.oil / design(months).oil) * 100, 0) + "%</text>";
    s += "<text x='" + X0 + "' y='198' font-size='8.5' fill='#79828a'>0 月</text><text x='" + X1 + "' y='198' font-size='8.5' fill='#79828a' text-anchor='end'>" + months + " 月</text>";
    s += "<text x='520' y='198' font-size='8.5' fill='#c9613f'>阴影＝这段时间少产的油</text>";
    el("prod").innerHTML = s;
  }

  function drawAttr(at) {
    var s = "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>留一法归因：把某一项放回理想值，看缺口能补回来多少</text>";
    if (at.gapPct <= 0.005) {
      s += "<text x='14' y='60' font-size='11' fill='#2f7d6b'>当前组合与设计基本一致，没有可归因的缺口——这本身也是一个有效结论。</text>";
      el("attr").innerHTML = s;
      return;
    }
    at.items.forEach(function (it, i) {
      var yy = 38 + i * 34;
      var w = 380 * it.share;
      s += "<text x='52' y='" + (yy + 12) + "' font-size='9.5' fill='#242b2e'>" + it.name + "</text>";
      s += "<rect x='250' y='" + (yy + 2) + "' width='380' height='12' rx='2' fill='#efece1'/>";
      s += "<rect x='250' y='" + (yy + 2) + "' width='" + w.toFixed(1) + "' height='12' rx='2' fill='" + (i === 0 ? "#c9613f" : "#b9c6cf") + "'/>";
      s += "<text x='" + (250 + w + 8).toFixed(1) + "' y='" + (yy + 12) + "' font-size='9' fill='#4d565b'>" + (it.share * 100).toFixed(0) + "%　（+" + fmt(it.contrib, 0) + " m³）</text>";
    });
    s += "<text x='14' y='180' font-size='9' fill='#79828a'>分母是所有正贡献之和；四项都略差时没有单一主因，这恰恰是最常见的真实情况。</text>";
    s += "<text x='14' y='192' font-size='9' fill='#4d565b'>合计可解释 " + fmt(at.items.reduce(function (a, b) { return a + Math.max(0, b.contrib); }, 0) / at.gap * 100, 0) + "% 的缺口（其余是模型未能覆盖的部分）。</text>";
    el("attr").innerHTML = s;
  }

  function drawSim(list) {
    var s = "<rect x='0' y='0' width='720' height='200' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>图谱检索：把这四个变量的组合与历史井对齐，直接调出别人当时的结论</text>";
    list.slice(0, 3).forEach(function (x, i) {
      var yy = 36 + i * 54;
      var w = 300 * x.sim;
      s += "<text x='52' y='" + (yy + 10) + "' font-size='10' fill='#242b2e'>" + x.h.id + "　" + x.h.poi + "</text>";
      s += "<rect x='190' y='" + (yy - 4) + "' width='300' height='10' rx='2' fill='#efece1'/>";
      s += "<rect x='190' y='" + (yy - 4) + "' width='" + w.toFixed(1) + "' height='10' rx='2' fill='" + (i === 0 ? "#2f7d6b" : "#b9c6cf") + "'/>";
      s += "<text x='" + (190 + w + 8).toFixed(1) + "' y='" + (yy + 4) + "' font-size='9' fill='#4d565b'>" + (x.sim * 100).toFixed(0) + "%</text>";
      s += "<text x='52' y='" + (yy + 26) + "' font-size='8.5' fill='#4d565b'>当时结论：" + x.h.concl + "</text>";
      s += "<text x='52' y='" + (yy + 40) + "' font-size='8.5' fill='#b26a39'>下一口井：" + x.h.next + "</text>";
    });
    s += "<text x='14' y='192' font-size='8.5' fill='#79828a'>注意：检索比的是「四个变量的组合形态」，不是产量大小——产量接近但成因不同的井不会被误配。</text>";
    el("sim").innerHTML = s;
  }

  /* ---------- 5. 主更新 ---------- */
  function update() {
    var p = {
      skin: parseFloat(el("skin").value),
      open: parseFloat(el("open").value),
      poll: parseFloat(el("poll").value),
      water: parseFloat(el("water").value)
    };
    var months = parseInt(el("months").value, 10);
    el("out-s").textContent = fmt(p.skin, 1);
    el("out-o").textContent = fmt(p.open, 2);
    el("out-p").textContent = fmt(p.poll, 2);
    el("out-w").textContent = fmt(p.water, 2);
    el("out-m").textContent = months + " 个月";

    var at = attribute(p, months);
    var list = matchWell(p);
    drawProd(p, months);
    drawAttr(at);
    drawSim(list);

    el("ro-gap").textContent = "-" + fmt(at.gapPct * 100, 0) + "%";
    el("ro-gap").className = at.gapPct > 0.25 ? "bad" : "";
    el("ro-main").textContent = at.gapPct <= 0.005 ? "无需归因" : at.items[0].name;
    el("ro-well").textContent = list[0].h.id;
    el("ro-next").textContent = list[0].h.next;

    var tb = "<caption>相似历史井（Top-3）</caption><tr><th>井号</th><th>反演特征</th><th>相似度</th><th>下一口井的改动</th></tr>";
    list.slice(0, 3).forEach(function (x, i) {
      tb += "<tr><td>" + x.h.id + "</td><td class='nm'>表皮 " + x.h.v[0] + " · 打开 " + x.h.v[1] +
            " · 污染 " + x.h.v[2] + " · 水窜 " + x.h.v[3] + "</td><td" + (i === 0 ? " style='color:#2f7d6b'" : "") + ">" +
            (x.sim * 100).toFixed(0) + "%</td><td class='nm'>" + x.h.next + "</td></tr>";
    });
    el("tbl").innerHTML = tb;

    var note = "与设计相比，这套中间变量复现的曲线在 " + months + " 个月内少产 <b>" + fmt(at.gapPct * 100, 0) + "%</b>（约 " +
      fmt(at.gap, 0) + " m³）。";
    if (at.gapPct <= 0.005) {
      note += "四个变量都在理想值附近，说明没有明显失分项——复盘结论应当写为「维持现有方案」。";
    } else {
      note += "归因上 <b>" + at.items[0].name + "</b> 占 " + (at.items[0].share * 100).toFixed(0) + "%，其次是 <b>" +
        at.items[1].name + "</b>（" + (at.items[1].share * 100).toFixed(0) + "%）。图谱里最像的是 <b>" + list[0].h.id +
        "</b>（" + (list[0].sim * 100).toFixed(0) + "%），它当时的结论是「" + list[0].h.concl + "」，因此下一口井建议：<b>" +
        list[0].h.next + "</b>。";
      if (at.items[0].share < 0.35) {
        note += " 主控因素占比不到三分之一，属于「四项都略差」的类型，单改一项效果有限。";
      }
    }
    el("note").innerHTML = note;
  }

  ["skin", "open", "poll", "water", "months"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  update();
})();
