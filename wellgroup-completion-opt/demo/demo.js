/* =========================================================
   多井组完井协同开发优化 · 示范脚本（整页模式）
   ---------------------------------------------------------
   每口井决定「射开哪一层、第几批投产」：
     逐井最优：每口井都挑自己产量最高的层 → 全部扎在同一层
     协同最优：穷举所有层位分配，用逐月物质平衡找总量最高的一组
   模型要点：
     · 某层累计采出越多，该层地层压力越低（压力因子下降）
     · 同层同时生产的井越多，单井效率越低（层内干扰）
     · 层间连通会把相邻层的压降传导过来
   ========================================================= */
(function () {
  "use strict";

  var LNAME = ["A 层", "B 层", "C 层"];
  var MAXW = 8;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function el(id) { return document.getElementById(id); }

  /* ---------- 1. 层属性 ---------- */
  function layers(c) {
    var q = [1, 1 - 0.38 * c.het, 1 - 0.72 * c.het];
    var pv = [420, 350, 300].map(function (v) { return v * (0.6 + 0.8 * c.eng); });
    return q.map(function (x, i) { return { q: x, pv: pv[i] }; });
  }
  function wellFactor(i) { return 0.86 + 0.28 * ((i * 37 % 11) / 10); }

  /* ---------- 2. 模拟一次层位分配 ---------- */
  function batches(assign) {
    var counts = [0, 0, 0], out = [];
    for (var i = 0; i < assign.length; i++) {
      out.push(counts[assign[i]] % 3);
      counts[assign[i]]++;
    }
    return out;
  }

  function simulate(assign, c) {
    var L = layers(c), n = assign.length;
    var batch = batches(assign);
    var months = c.yr * 12;
    var cumL = [0, 0, 0], total = 0, series = [], m, i, l;
    for (m = 1; m <= months; m++) {
      var active = [0, 0, 0];
      for (i = 0; i < n; i++) if (m >= batch[i] * 8 + 1) active[assign[i]]++;
      var prod = [0, 0, 0];
      for (i = 0; i < n; i++) {
        if (m < batch[i] * 8 + 1) continue;
        var li = assign[i];
        var own = cumL[li] / L[li].pv;
        var nb = 0, nbw = 0;
        for (l = 0; l < 3; l++) {
          if (l === li) continue;
          var wgt = 1 - Math.abs(l - li) * 0.35;
          nb += (cumL[l] / L[l].pv) * wgt;
          nbw += wgt;
        }
        nb = nbw > 0 ? nb / nbw : 0;
        var pf = 1 - 0.72 * own - 0.28 * c.con * nb;
        if (pf <= 0.05) continue;
        var eff = 1 / (1 + 0.09 * Math.max(0, active[li] - 1));
        prod[li] += 26 * L[li].q * wellFactor(i) * pf * eff;
      }
      for (l = 0; l < 3; l++) cumL[l] += prod[l];
      var mp = prod[0] + prod[1] + prod[2];
      series.push(mp);
      total += mp;
    }
  /* 层系动用均衡度：各层采出程度的标准差越小越均衡 */
  var used = cumL.map(function (v, k) { return v / L[k].pv; });
  var mean = (used[0] + used[1] + used[2]) / 3;
  var varr = used.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / 3;
  var bal = clamp(1 - Math.sqrt(varr) / Math.max(mean, 1e-6), 0, 1);
  /* 压力消耗取「被抽得最狠的那一层」的采出程度：逐井最优只抽一层，
     若按三层平均反而显得低；峰值口径才能看出能量有没有被分摊开 */
  var depletion = clamp(Math.max(used[0], used[1], used[2]), 0, 1.5);
    return { total: total, series: series, cumL: cumL, batch: batch, bal: bal, depletion: depletion };
  }

  /* ---------- 3. 两种方案 ---------- */
  function greedyAssign(c, n) {
    var L = layers(c), best = 0;
    for (var k = 1; k < 3; k++) if (L[k].q > L[best].q) best = k;
    var a = [];
    for (var i = 0; i < n; i++) a.push(best);
    return a;
  }

  function bestAssign(c, n) {
    var total = Math.pow(3, n), bestScore = -1, bestA = null;
    for (var code = 0; code < total; code++) {
      var a = [], x = code;
      for (var i = 0; i < n; i++) { a.push(x % 3); x = Math.floor(x / 3); }
      var r = simulate(a, c);
      if (r.total > bestScore) { bestScore = r.total; bestA = a; }
    }
    return bestA;
  }

  /* ---------- 4. 绘图 ---------- */
  function drawMap(aG, aC, n, c) {
    var s = "<rect x='0' y='0' width='720' height='205' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>层位分配：逐井最优（左）vs 井组协同（右）　框内数字＝第几批投产</text>";
    var titles = ["逐井最优：每口井都挑产量最高的层", "井组协同：把井分摊到不同层并错开批次"];
    var asg = [aG, aC];
    [0, 1].forEach(function (side) {
      var x0 = side === 0 ? 40 : 380;
      s += "<text x='" + x0 + "' y='40' font-size='9.5' fill='#242b2e'>" + titles[side] + "</text>";
      for (var l = 0; l < 3; l++) {
        var yy = 56 + l * 44;
        s += "<text x='" + x0 + "' y='" + (yy + 14) + "' font-size='9' fill='#4d565b'>" + LNAME[l] + "</text>";
        var cnt = 0;
        for (var i = 0; i < n; i++) {
          if (asg[side][i] !== l) continue;
          var bx = x0 + 46 + cnt * 40;
          var col = side === 0 ? "#c9613f" : "#2f7d6b";
          s += "<rect x='" + bx + "' y='" + yy + "' width='32' height='22' rx='3' fill='" + col + "' opacity='0.85'/>";
          s += "<text x='" + (bx + 16) + "' y='" + (yy + 15) + "' font-size='9' fill='#fff' text-anchor='middle'>W" + (i + 1) + "</text>";
          s += "<text x='" + (bx + 30) + "' y='" + (yy + 33) + "' font-size='7.5' fill='#79828a'>" + (asg[side][i] >= 0 ? batches(asg[side])[i] + 1 : "") + "</text>";
          cnt++;
        }
        if (cnt === 0) s += "<text x='" + (x0 + 50) + "' y='" + (yy + 15) + "' font-size='8.5' fill='#b0a89a'>未动用</text>";
      }
    });
    s += "<text x='14' y='192' font-size='8.5' fill='#79828a'>非均质越强，逐井最优越容易全部涌向 A 层；协同方案的收益差距也就越大。</text>";
    s += "<text x='14' y='204' font-size='8.5' fill='#79828a'>批次是把投产时间错开 8 个月，让同层的井不在同一时间抢同一段压力。</text>";
    el("map").innerHTML = s;
  }

  function drawProd(rG, rC) {
    var X0 = 52, X1 = 700, Y0 = 30, Y1 = 152;
    var hi = Math.max.apply(null, rG.series.concat(rC.series)) * 1.1 + 1e-9;
    var s = "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>井组月产：前期跑得快的方案，五年后往往不是总量最多的</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='46' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(hi * g / 4, 0) + "</text>";
    }
    [[rG, "#c9613f"], [rC, "#2f7d6b"]].forEach(function (it) {
      var pts = it[0].series.map(function (v, i) {
        return (X0 + (X1 - X0) * i / Math.max(1, it[0].series.length - 1)).toFixed(1) + "," + (Y1 - (Y1 - Y0) * v / hi).toFixed(1);
      }).join(" ");
      s += "<polyline points='" + pts + "' fill='none' stroke='" + it[1] + "' stroke-width='" + (it[1] === "#2f7d6b" ? 2 : 1.5) + "'/>";
    });
    s += "<text x='120' y='" + (Y0 + 10) + "' font-size='9' fill='#c9613f'>逐井最优</text>";
    s += "<text x='220' y='" + (Y0 + 10) + "' font-size='9' fill='#2f7d6b'>井组协同</text>";
    s += "<text x='" + X0 + "' y='168' font-size='8.5' fill='#79828a'>0 月</text>";
    s += "<text x='" + X1 + "' y='168' font-size='8.5' fill='#79828a' text-anchor='end'>" + rC.series.length + " 月</text>";
    s += "<text x='14' y='186' font-size='8.5' fill='#4d565b'>注意曲线交叉的位置：协同方案常常前两年略低，靠后段的稳产把总量追回来。</text>";
    el("prod").innerHTML = s;
  }

  function drawCmp(rG, rC, c) {
    var s = "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>三项对比：总量只是其中一项，均衡度决定了能不能把这口气续下去</text>";
    var items = [
      { k: "五年累计产量（万吨）", g: rG.total / 10000, v: rC.total / 10000, good: "high" },
      { k: "层系动用均衡度", g: rG.bal, v: rC.bal, good: "high" },
      { k: "最脆弱层压力消耗", g: rG.depletion, v: rC.depletion, good: "low" }
    ];
    items.forEach(function (it, ix) {
      var yy = 40 + ix * 48;
      var mx = Math.max(it.g, it.v) * 1.15 + 1e-9;
      s += "<text x='52' y='" + (yy + 10) + "' font-size='9.5' fill='#4d565b'>" + it.k + "</text>";
      s += "<rect x='230' y='" + (yy - 4) + "' width='220' height='12' rx='2' fill='#efece1'/>";
      s += "<rect x='230' y='" + (yy - 4) + "' width='" + (220 * it.g / mx).toFixed(1) + "' height='12' rx='2' fill='#c9613f' opacity='0.8'/>";
      s += "<text x='" + (230 + 220 * it.g / mx + 6).toFixed(1) + "' y='" + (yy + 6) + "' font-size='8.5' fill='#4d565b'>" + fmt(it.g, 2) + "</text>";
      s += "<rect x='480' y='" + (yy + 14) + "' width='220' height='12' rx='2' fill='#efece1'/>";
      s += "<rect x='480' y='" + (yy + 14) + "' width='" + (220 * it.v / mx).toFixed(1) + "' height='12' rx='2' fill='#2f7d6b' opacity='0.85'/>";
      s += "<text x='" + (480 + 220 * it.v / mx + 6).toFixed(1) + "' y='" + (yy + 24) + "' font-size='8.5' fill='#4d565b'>" + fmt(it.v, 2) + "</text>";
    });
    s += "<text x='230' y='34' font-size='8.5' fill='#c9613f'>逐井最优</text>";
    s += "<text x='480' y='34' font-size='8.5' fill='#2f7d6b'>井组协同</text>";
    s += "<text x='14' y='188' font-size='8.5' fill='#79828a'>第三项是关键：被抽得最狠的那一层消耗越低，说明能量分摊到了更多层上，后期还有接替能力。</text>";
    el("cmp").innerHTML = s;
  }

  /* ---------- 5. 主更新 ---------- */
  function update() {
    var c = {
      het: parseFloat(el("het").value),
      con: parseFloat(el("con").value),
      eng: parseFloat(el("eng").value),
      yr: parseInt(el("yr").value, 10)
    };
    var n = Math.min(MAXW, parseInt(el("nw").value, 10));
    el("out-n").textContent = n + " 口";
    el("out-het").textContent = fmt(c.het, 2);
    el("out-con").textContent = fmt(c.con, 2);
    el("out-eng").textContent = fmt(c.eng, 2);
    el("out-yr").textContent = c.yr + " 年";

    var aG = greedyAssign(c, n);
    var aC = bestAssign(c, n);
    var rG = simulate(aG, c), rC = simulate(aC, c);

    drawMap(aG, aC, n, c);
    drawProd(rG, rC);
    drawCmp(rG, rC, c);

    el("ro-cum").textContent = fmt(rC.total / 10000, 1) + " 万吨";
    var gain = (rC.total / Math.max(rG.total, 1e-9) - 1) * 100;
    el("ro-gain").textContent = (gain >= 0 ? "+" : "") + fmt(gain, 1) + "%";
    el("ro-gain").className = gain > 1 ? "ok" : "";
    el("ro-bal").textContent = fmt(rC.bal, 2) + "（独立 " + fmt(rG.bal, 2) + "）";
    el("ro-pr").textContent = (rC.depletion * 100).toFixed(0) + "%（独立 " + (rG.depletion * 100).toFixed(0) + "%）";

    var bC = batches(aC);
    var tb = "<caption>协同方案的逐井安排</caption><tr><th>井号</th><th>层位</th><th>投产批次</th><th>单井系数</th></tr>";
    for (var i = 0; i < n; i++) {
      tb += "<tr><td>W" + (i + 1) + "</td><td class='nm'>" + LNAME[aC[i]] + "</td><td>第 " + (bC[i] + 1) + " 批</td><td class='nm'>" +
            fmt(wellFactor(i), 2) + "×</td></tr>";
    }
    el("tbl").innerHTML = tb;

    var crowd = [0, 0, 0];
    aC.forEach(function (a) { crowd[a]++; });
    el("note").innerHTML =
      "逐井最优时全部 " + n + " 口井涌向 <b>" + LNAME[aG[0]] + "</b>，压力消耗 " + (rG.depletion * 100).toFixed(0) + "%，" +
      "五年累计 <b>" + fmt(rG.total / 10000, 1) + " 万吨</b>；协同方案把井分成 <b>A " + crowd[0] + " 口 / B " + crowd[1] +
      " 口 / C " + crowd[2] + " 口</b> 并错开批次，累计 <b>" + fmt(rC.total / 10000, 1) + " 万吨</b>，<b>提升 " + fmt(gain, 1) + "%</b>。" +
      (gain < 1 ? "此时各层差别不大，协同的余量很小 —— 这也是一个应当如实给出的结论。"
                 : "关键的差别不在某一口井多产，而在<b>把地层能量分摊开来</b>：" +
                   ((rG.depletion - rC.depletion) * 100 > 0.5
                     ? "最脆弱层的压力消耗低 " + ((rG.depletion - rC.depletion) * 100).toFixed(0) + " 个百分点，后期还有接替能力。"
                     : "各层压力消耗与逐井最优相当，协同主要赢在均衡与接替能力。"));
  }

  ["nw", "het", "con", "eng", "yr"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  update();
})();
