/* =========================================================
   完井全生命周期成本测算 · 示范脚本（整页模式）
   ---------------------------------------------------------
   三套方案逐月拼现金流（同一口井、同一储层）：
     收入   = 产量(t/d) × 油价 × 桶吨换算 × 汇率
     支出   = 操作成本（收入的 45%）+ 期望修井费
     期望修井/月 = 出砂倾向 ×（1 − 方案防砂能力）× 0.03
     停产折减 = 每次修井停产 3 个月的期望损失
   全部现金流按月折现 → NPV / 回收期 / 全生命周期成本。
   ========================================================= */
(function () {
  "use strict";

  var Q0 = 32, T2B = 7.3, FX = 7.2, OP = 0.45, DT = 3; // 产量 · 吨桶 · 汇率 · 操作成本占比 · 修井停产月
  var SC = [
    { nm: "A 射孔完井", capex: 580,  sandR: 0.25, prodF: 1.00, fix: 320, col: "#c9613f" },
    { nm: "B 筛管完井", capex: 920,  sandR: 0.50, prodF: 1.05, fix: 360, col: "#41699b" },
    { nm: "C 砾石充填", capex: 1240, sandR: 0.95, prodF: 1.03, fix: 420, col: "#2f7d6b" }
  ];

  function el(id) { return document.getElementById(id); }
  function fmt(v, d) { var p = Math.pow(10, d); return (Math.round(v * p) / p).toFixed(d); }
  function cfg() {
    return { oil: +el("oil").value, yr: +el("yr").value, dec: +el("dec").value / 100,
             sand: +el("sand").value, disc: +el("disc").value / 100 };
  }

  function revOf(sc, c, m) {
    var md = Math.pow(1 - c.dec, 1 / 12);
    return Q0 * sc.prodF * Math.pow(md, m) * c.oil * 30 * T2B * FX / 1e4;
  }

  function sim(sc, c) {
    var months = c.yr * 12, r = c.disc / 12;
    var p = c.sand * (1 - sc.sandR) * 0.03;      // 月失效概率（期望）
    var stop = Math.max(0, 1 - DT * p);           // 期望停产折减
    var cash = [-sc.capex], npv = -sc.capex, df = 1, opex = 0, m;
    for (m = 1; m <= months; m++) {
      var net = revOf(sc, c, m) * (1 - OP) * stop - sc.fix * p;
      df *= 1 / (1 + r);
      npv += net * df;
      cash.push(cash[m - 1] + net);
      opex += revOf(sc, c, m) * OP * df;
    }
    var workE = p * months, pay = -1;
    for (m = 1; m < cash.length; m++) if (cash[m] >= 0) { pay = m; break; }
    return { npv: npv, cash: cash, workE: workE, fix: workE * sc.fix, opex: opex, pay: pay };
  }

  /* ---------- 绘图工具 ---------- */
  function axis(Y0, Y1, hi, lo, unit, X0, X1) {
    var s = "";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='" + (X0 - 6) + "' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(lo + (hi - lo) * g / 4, 0) + (unit || "") + "</text>";
    }
    return s;
  }
  function pts(arr, x0, dx, y0, y1, hi, lo) {
    return arr.map(function (v, i) {
      return (x0 + dx * i).toFixed(1) + "," + (y1 - (y1 - y0) * (v - lo) / (hi - lo)).toFixed(1);
    }).join(" ");
  }

  /* ---------- 1. 累计净现金流 ---------- */
  function drawCum(R, c) {
    var X0 = 56, X1 = 700, Y0 = 30, Y1 = 160, months = c.yr * 12;
    var lo = Math.min(0, -1240), hi = 0;
    R.forEach(function (r) { hi = Math.max(hi, r.cash[r.cash.length - 1]); });
    hi *= 1.08;
    var s = "<rect x='0' y='0' width='720' height='215' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>累计净现金流（含初始投资）：曲线过零点 = 回收期，斜率差异 = 方案的真实差距</text>";
    s += axis(Y0, Y1, hi, lo, " 万", X0, X1);
    s += "<line x1='" + X0 + "' y1='" + (Y1 - (Y1 - Y0) * (0 - lo) / (hi - lo)).toFixed(1) + "' x2='" + X1 + "' y2='" + (Y1 - (Y1 - Y0) * (0 - lo) / (hi - lo)).toFixed(1) + "' stroke='#b0a89a' stroke-dasharray='4 3'/>";
    var dx = (X1 - X0) / months;
    R.forEach(function (r, i) {
      s += "<polyline points='" + pts(r.cash, X0, dx, Y0, Y1, hi, lo) + "' fill='none' stroke='" + SC[i].col + "' stroke-width='" + (i === 0 ? 1.4 : 2) + "'/>";
      if (r.pay > 0) {
        var py = Y1 - (Y1 - Y0) * (0 - lo) / (hi - lo);
        s += "<circle cx='" + (X0 + dx * r.pay).toFixed(1) + "' cy='" + py.toFixed(1) + "' r='3.5' fill='" + SC[i].col + "'/>";
        s += "<text x='" + (X0 + dx * r.pay + 6).toFixed(1) + "' y='" + (py - 6).toFixed(1) + "' font-size='8' fill='" + SC[i].col + "'>" + (r.pay / 12).toFixed(1) + " 年</text>";
      }
    });
    var leg = 40;
    SC.forEach(function (sc) { s += "<rect x='" + leg + "' y='178' width='10' height='10' rx='2' fill='" + sc.col + "'/><text x='" + (leg + 15) + "' y='187' font-size='9' fill='#4d565b'>" + sc.nm + "</text>"; leg += 130; });
    s += "<text x='700' y='206' font-size='8.5' fill='#79828a' text-anchor='end'>评价期 " + c.yr + " 年 · 递减 " + (c.dec * 100).toFixed(0) + "%/年</text>";
    el("cum").innerHTML = s;
  }

  /* ---------- 2. 全生命周期成本构成 ---------- */
  function drawCost(R) {
    var s = "<rect x='0' y='0' width='720' height='200' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>全生命周期成本构成（折现后）：水面上只有初始投资，水下的部分才分出胜负</text>";
    var maxL = 0;
    R.forEach(function (r) { maxL = Math.max(maxL, r.capex + r.opex + r.fix); });
    var bw = 110, gap = 130, x0 = 90;
    R.forEach(function (r, i) {
      var x = x0 + i * gap, base = 168, h;
      var segs = [["初始投资", r.capex, "#41699b"], ["操作成本", r.opex, "#7a5aa0"], ["期望修井", r.fix, "#c9613f"]];
      segs.forEach(function (sg) {
        h = 130 * sg[1] / maxL;
        base -= h;
        s += "<rect x='" + x + "' y='" + base.toFixed(1) + "' width='" + bw + "' height='" + h.toFixed(1) + "' fill='" + sg[2] + "' opacity='0.85'/>";
        if (h > 14) s += "<text x='" + (x + bw / 2) + "' y='" + (base + h / 2 + 3).toFixed(1) + "' font-size='8.5' fill='#fff' text-anchor='middle'>" + fmt(sg[1], 0) + "</text>";
      });
      s += "<text x='" + (x + bw / 2) + "' y='182' font-size='9.5' fill='#4d565b' text-anchor='middle'>" + SC[i].nm.replace(" ", "") + "</text>";
      s += "<text x='" + (x + bw / 2) + "' y='195' font-size='9' font-weight='600' fill='#242b2e' text-anchor='middle'>合计 " + fmt(r.capex + r.opex + r.fix, 0) + " 万</text>";
    });
    el("cost").innerHTML = s;
  }

  /* ---------- 3. NPV 对油价的敏感性 ---------- */
  function npvAtOil(sc, oil, c) {
    var c2 = {}; for (var k in c) c2[k] = c[k]; c2.oil = oil;
    return sim(sc, c2).npv;
  }
  function drawSens(c) {
    var X0 = 56, X1 = 690, Y0 = 30, Y1 = 158;
    var oils = [], i;
    for (i = 40; i <= 100; i += 2) oils.push(i);
    var N = SC.map(function (sc) { return oils.map(function (o) { return npvAtOil(sc, o, c); }); });
    var lo = Math.min.apply(null, N.map(function (a) { return Math.min.apply(null, a); }));
    var hi = Math.max.apply(null, N.map(function (a) { return Math.max.apply(null, a); }));
    var pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    var s = "<rect x='0' y='0' width='720' height='205' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>NPV 对油价的敏感性：曲线交叉处就是「该换方案」的油价门槛</text>";
    s += axis(Y0, Y1, hi, lo, " 万", X0, X1);
    var dx = (X1 - X0) / (oils.length - 1);
    N.forEach(function (a, i) {
      s += "<polyline points='" + pts(a, X0, dx, Y0, Y1, hi, lo) + "' fill='none' stroke='" + SC[i].col + "' stroke-width='" + (i === 0 ? 1.4 : 2) + "'/>";
    });
    var xo = X0 + (X1 - X0) * (c.oil - 40) / 60;
    s += "<line x1='" + xo.toFixed(1) + "' y1='" + Y0 + "' x2='" + xo.toFixed(1) + "' y2='" + Y1 + "' stroke='#242b2e' stroke-dasharray='3 2'/>";
    s += "<text x='" + (xo + 4).toFixed(1) + "' y='" + (Y0 + 10) + "' font-size='8.5' fill='#242b2e'>当前 " + c.oil + " 美元</text>";
    [2, 1].forEach(function (j) {
      for (var k = 1; k < oils.length; k++) {
        if (N[j][k] > N[0][k] && N[j][k - 1] <= N[0][k - 1]) {
          var cx = X0 + dx * k;
          s += "<circle cx='" + cx.toFixed(1) + "' cy='" + (Y1 - (Y1 - Y0) * (N[j][k] - lo) / (hi - lo)).toFixed(1) + "' r='4' fill='none' stroke='" + SC[j].col + "' stroke-width='2'/>";
          s += "<text x='" + (cx - 2).toFixed(1) + "' y='" + (Y0 + 24) + "' font-size='8.5' fill='" + SC[j].col + "' text-anchor='middle'>" + SC[j].nm.slice(0, 1) + " 反超 " + oils[k] + "$</text>";
          break;
        }
      }
    });
    var leg = 40;
    SC.forEach(function (sc) { s += "<rect x='" + leg + "' y='180' width='10' height='10' rx='2' fill='" + sc.col + "'/><text x='" + (leg + 15) + "' y='189' font-size='9' fill='#4d565b'>" + sc.nm + "</text>"; leg += 130; });
    el("sens").innerHTML = s;
  }

  /* ---------- 主更新 ---------- */
  function update() {
    var c = cfg();
    el("out-oil").textContent = c.oil + " 美元/桶";
    el("out-yr").textContent = c.yr + " 年";
    el("out-dec").textContent = (c.dec * 100).toFixed(0) + "%";
    el("out-sand").textContent = fmt(c.sand, 2);
    el("out-disc").textContent = (c.disc * 100).toFixed(1) + "%";

    var R = SC.map(function (sc) { return sim(sc, c); });
    drawCum(R, c);
    drawCost(R);
    drawSens(c);

    var bi = 0;
    R.forEach(function (r, i) { if (r.npv > R[bi].npv) bi = i; });
    el("ro-best").textContent = SC[bi].nm.slice(0, 1) + " 方案";
    el("ro-npv").textContent = fmt(R[bi].npv, 0) + " 万元";
    var gain = R[bi].npv - R[0].npv;
    el("ro-gain").textContent = (gain >= 0 ? "+" : "") + fmt(gain, 0) + " 万";
    el("ro-gain").className = gain > 1 ? "ok" : "bad";
    el("ro-work").textContent = fmt(R[bi].workE, 2) + " 次";

    var tb = "<caption>三方案对账单（当前情景，折现后）</caption><tr><th>方案</th><th>初始投资</th><th>NPV</th><th>回收期</th><th>期望修井</th><th>全生命周期成本</th></tr>";
    SC.forEach(function (sc, i) {
      var r = R[i];
      tb += "<tr><td class='nm'>" + sc.nm + "</td><td>" + sc.capex + " 万</td><td class='nm'><b>" + fmt(r.npv, 0) + " 万</b></td><td>" +
            (r.pay > 0 ? fmt(r.pay / 12, 1) + " 年" : "期内未回收") + "</td><td>" + fmt(r.workE, 2) + " 次</td><td class='nm'>" +
            fmt(r.capex + r.opex + r.fix, 0) + " 万</td></tr>";
    });
    el("tbl").innerHTML = tb;

    /* 结论：找排名翻转的油价与出砂门槛 */
    var oilC = -1, oilB = -1, o, k;
    for (o = 41; o <= 100; o += 1) {
      var a0 = npvAtOil(SC[0], o - 1, c), a1 = npvAtOil(SC[0], o, c);
      if (oilB < 0 && npvAtOil(SC[1], o) > a1 && npvAtOil(SC[1], o - 1) <= a0) oilB = o;
      if (oilC < 0 && npvAtOil(SC[2], o) > a1 && npvAtOil(SC[2], o - 1) <= a0) oilC = o;
    }
    var sandC = -1;
    for (k = 0.02; k <= 1; k += 0.02) {
      var c2 = {}; for (var kk in c) c2[kk] = c[kk]; c2.sand = k;
      if (sim(SC[2], c2).npv > sim(SC[0], c2).npv) { sandC = k; break; }
    }
    var best = R[bi].npv === R[0].npv && bi === 0;
    el("note").innerHTML =
      "当前情景推荐 <b>" + SC[bi].nm + "</b>：NPV <b>" + fmt(R[bi].npv, 0) + " 万元</b>" +
      (bi === 0 ? "，初始投资最小的方案暂时领先。" : "，比基线 A 多 <b>" + fmt(gain, 0) + " 万元</b>——初始报价贵出的部分，被修井期望与产能差距在账上吃了回来。") +
      (oilC > 0 ? " 把油价拉到 <b>" + oilC + " 美元</b>以上，C 的 NPV 反超 A；" : "在当前假设下 A 对 C 全程领先；") +
      (sandC > 0 ? "出砂倾向超过 <b>" + fmt(sandC, 2) + "</b> 时 C 也反超。" : "整个出砂区间内 C 都不占优。") +
      " 结论随情景变，所以敏感性是必答题，不是加分题。";
  }

  ["oil", "yr", "dec", "sand", "disc"].forEach(function (id) { el(id).addEventListener("input", update); });
  update();
})();
