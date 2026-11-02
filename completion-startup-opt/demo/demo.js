/* =========================================================
   完井投产制度智能优化 · 示范脚本（整页模式）
   ---------------------------------------------------------
   把投产过程写成强化学习：
     状态  s = (决策步, 当前压差档位, 累计采出程度)
     动作  a = { -2, -1, 0, +1, +2 }（下一步压差抬/降几档）
     回报  r = 当期产油 − 出砂代价 − 产水处理代价
   状态转移由产能方程给出且确定，因此用价值迭代直接求最优策略，
   再与「一步提到位」「慢提」两种现场做法对比。
   ========================================================= */
(function () {
  "use strict";

  var T = 18;      /* 决策步数：每步 5 天 */
  var DT = 5;      /* 天 */
  var K = 13;      /* 压差档位数 */
  var DPLV = 0.7;  /* 每档 0.7 MPa */
  var B = 14;      /* 累计采出分箱数 */
  var VMAX = 6000; /* m³，整个投产期可能采出的液量上限 */
  var PI0 = 5.2;   /* 采液指数 m³/(d·MPa) */
  var ACTIONS = [-2, -1, 0, 1, 2];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function el(id) { return document.getElementById(id); }
  function b2v(b) { return b / (B - 1) * VMAX; }
  function v2b(v) {
    var i = Math.round(clamp(v / VMAX, 0, 1) * (B - 1));
    return i;
  }

  /* ---------- 1. 产能 / 含水 / 出砂 模型 ---------- */
  /* 累计采出 V 连续推进；状态空间只在价值迭代时分箱，取值用线性插值 */
  function step(i, V, par, act) {
    var dp = i * DPLV;
    /* 采液指数随压降消耗缓慢下降 */
    var PI = PI0 * (1 - 0.32 * (V / VMAX));
    var ql = PI * dp;                                  /* 液量 m³/d */
    /* 累计采出越过突破体积后开始见水，水体越强突破越早 */
    var bt = 0.22 - 0.14 * par.aq;
    var wct = clamp((V / VMAX - bt) / 0.34, 0, 0.85);
    var qo = ql * (1 - wct);
    var qw = ql * wct;
    /* 出砂：压差超出岩石强度的部分按平方放大，抬得越猛额外加成 */
    var ex = Math.max(0, dp - par.cd) / Math.max(par.cd, 1e-6);
    var abrupt = act > 0 ? 0.35 * act : 0;
    var sand = (ex * ex * 2.2 + abrupt * ex) * ql * 0.05;
    var dVol = ql * DT;
    return {
      ql: ql, qo: qo, qw: qw, wct: wct, sand: sand, dp: dp,
      reward: qo * DT - par.ls * sand * DT * 60 - par.lw * qw * DT * 0.9,
      nV: clamp(V + dVol, 0, VMAX)
    };
  }

  /* ---------- 2. 价值迭代 ---------- */
  function interp(Vf, t, i, V) {
    var f = clamp(V / VMAX, 0, 1) * (B - 1);
    var i0 = Math.floor(f), fr = f - i0;
    var i1 = Math.min(i0 + 1, B - 1);
    var base = (t * K + i) * B;
    return (1 - fr) * Vf[base + i0] + fr * Vf[base + i1];
  }

  function valueIterate(par) {
    var Vf = new Float64Array(T * K * B);
    var pol = new Int8Array(T * K * B);
    var t, i, b, ai;
    var idx = function (t, i, b) { return (t * K + i) * B + b; };
    for (t = T - 1; t >= 0; t--) {
      for (i = 0; i < K; i++) {
        for (b = 0; b < B; b++) {
          var Vcur = b2v(b);
          var best = -1e18, bestA = 0;
          for (ai = 0; ai < ACTIONS.length; ai++) {
            var act = ACTIONS[ai];
            var ni = clamp(i + act, 0, K - 1);
            var r = step(i, Vcur, par, act);
            var nx = (t === T - 1) ? 0 : interp(Vf, t + 1, ni, r.nV);
            var val = r.reward + nx;
            if (val > best) { best = val; bestA = ai; }
          }
          Vf[idx(t, i, b)] = best;
          pol[idx(t, i, b)] = bestA;
        }
      }
    }
    return { V: Vf, pol: pol, idx: idx };
  }

  /* ---------- 3. 模拟一条策略 ---------- */
  function simulate(pick, par, sol, policy) {
    var i = 0, V = 0, t, out = [], oil = 0, wat = 0, sand = 0, ret = 0;
    for (t = 0; t < T; t++) {
      var b = clamp(Math.round(V / VMAX * (B - 1)), 0, B - 1);
      var act;
      if (policy === "rl") act = ACTIONS[sol.pol[(t * K + i) * B + b]];
      else if (policy === "aggr") act = (i < K - 1) ? 2 : 0;
      else if (policy === "slow") act = (t % 2 === 0 && i < K - 1) ? 1 : 0;
      else act = (i * DPLV < par.cd - 0.6 && i < K - 1) ? 1 : 0;   /* 常规：提到临界略停 */
      var r = step(i, V, par, act);
      oil += r.qo * DT; wat += r.qw * DT; sand += r.sand * DT; ret += r.reward;
      out.push({ t: t, dp: r.dp, qo: r.qo, wct: r.wct, sand: r.sand, act: act });
      i = clamp(i + act, 0, K - 1);
      V = r.nV;
    }
    return { path: out, oil: oil, wat: wat, sand: sand, ret: ret };
  }

  /* ---------- 4. 绘图 ---------- */
  function drawPolicy(res, par) {
    var X0 = 56, X1 = 700, Y0 = 30, Y1 = 172, s = "";
    var maxDp = (K - 1) * DPLV + 0.5;
    var colors = { rl: "#2f7d6b", aggr: "#c9613f", slow: "#41699b" };
    s += "<rect x='0' y='0' width='720' height='210' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>压差轨道（实线）与出砂临界压差（虚线）</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='50' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(maxDp * g / 4, 1) + "</text>";
    }
    var cdY = Y1 - (Y1 - Y0) * par.cd / maxDp;
    s += "<line x1='" + X0 + "' y1='" + cdY.toFixed(1) + "' x2='" + X1 + "' y2='" + cdY.toFixed(1) + "' stroke='#c9613f' stroke-dasharray='5 3'/>";
    s += "<text x='" + (X1 - 4) + "' y='" + (cdY - 5).toFixed(1) + "' font-size='8.5' fill='#c9613f' text-anchor='end'>出砂临界 " + fmt(par.cd, 1) + " MPa</text>";
    Object.keys(colors).forEach(function (k) {
      if (!res[k]) return;
      var pts = res[k].path.map(function (p, ix) {
        return (X0 + (X1 - X0) * ix / (T - 1)).toFixed(1) + "," + (Y1 - (Y1 - Y0) * p.dp / maxDp).toFixed(1);
      }).join(" ");
      s += "<polyline points='" + pts + "' fill='none' stroke='" + colors[k] + "' stroke-width='" + (k === "rl" ? 2 : 1.4) + "'" + (k === "slow" ? " stroke-dasharray='4 3'" : "") + "/>";
    });
    s += "<text x='" + X0 + "' y='" + (Y1 + 14) + "' font-size='8.5' fill='#79828a'>0 d</text>";
    s += "<text x='" + X1 + "' y='" + (Y1 + 14) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + (T * DT) + " d</text>";
    var lg = [["rl", "优化制度"], ["aggr", "一步提到位"], ["slow", "慢慢提"]];
    lg.forEach(function (it, ix) {
      s += "<rect x='" + (120 + ix * 110) + "' y='186' width='10' height='10' rx='2' fill='" + colors[it[0]] + "'/>";
      s += "<text x='" + (134 + ix * 110) + "' y='195' font-size='9' fill='#4d565b'>" + it[1] + "</text>";
    });
    s += "<text x='14' y='205' font-size='8.5' fill='#79828a'>每 5 天决策一次；红色虚线以上开始付出出砂代价，优化制度的轨道会贴着临界值走而不过冲。</text>";
    el("policy").innerHTML = s;
  }

  function drawCum(res) {
    var names = { rl: "优化制度", aggr: "一步提到位", slow: "慢慢提" };
    var order = ["aggr", "slow", "rl"];
    var s = "<rect x='0' y='0' width='720' height='190' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>90 天的结果：产油要减去产水与出砂的代价才是净收益</text>";
    var maxO = Math.max.apply(null, order.map(function (k) { return res[k].oil; }));
    var X0 = 100, W = 150, GAP = 30, Y1 = 156;
    order.forEach(function (k, ix) {
      var x = X0 + ix * (W + GAP);
      var hO = (Y1 - 40) * res[k].oil / (maxO + 1e-9);
      s += "<rect x='" + x + "' y='" + (Y1 - hO).toFixed(1) + "' width='" + W + "' height='" + hO.toFixed(1) + "' rx='2' fill='#41699b' opacity='0.85'/>";
      s += "<text x='" + (x + W / 2) + "' y='" + (Y1 - hO - 6).toFixed(1) + "' font-size='9' fill='#242b2e' text-anchor='middle'>产油 " + fmt(res[k].oil, 0) + " m³</text>";
      var penW = (Y1 - 40) * (res[k].wat * 0.9 * 0.01 + res[k].sand * 60 * 0.02) / (maxO + 1e-9);
      s += "<rect x='" + x + "' y='" + Y1 + "' width='" + W + "' height='10' rx='2' fill='#c9613f' opacity='0.75'/>";
      s += "<text x='" + (x + W / 2) + "' y='" + (Y1 + 24) + "' font-size='9' fill='#c9613f' text-anchor='middle'>出砂量 " + fmt(res[k].sand, 1) + "　产水 " + fmt(res[k].wat, 0) + " m³</text>";
      s += "<text x='" + (x + W / 2) + "' y='" + (Y1 + 38) + "' font-size='9' fill='#4d565b' text-anchor='middle'>净收益 " + fmt(res[k].ret, 0) + "</text>";
      s += "<text x='" + (x + W / 2) + "' y='" + (Y1 + 52) + "' font-size='9' fill='#242b2e' text-anchor='middle'>" + names[k] + "</text>";
    });
    el("cum").innerHTML = s;
  }

  function drawDiag(res, par) {
    var X0 = 56, X1 = 700, Y0 = 28, Y1 = 150, s = "";
    var p = res.rl.path;
    var maxSand = Math.max.apply(null, res.aggr.path.map(function (x) { return x.sand; }).concat([1e-6]));
    s += "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>为什么是这个轨道：含水率上升与出砂风险的时序诊断</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='50' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + (100 * g / 4).toFixed(0) + "%</text>";
    }
    var wpts = p.map(function (x, ix) {
      return (X0 + (X1 - X0) * ix / (T - 1)).toFixed(1) + "," + (Y1 - (Y1 - Y0) * x.wct / 0.9).toFixed(1);
    }).join(" ");
    s += "<polyline points='" + wpts + "' fill='none' stroke='#41699b' stroke-width='1.6'/>";
    /* 出砂风险：优化 vs 一步提到位 */
    [["rl", "#2f7d6b"], ["aggr", "#c9613f"]].forEach(function (it) {
      var pts = res[it[0]].path.map(function (x, ix) {
        return (X0 + (X1 - X0) * ix / (T - 1)).toFixed(1) + "," +
               (Y1 - (Y1 - Y0) * x.sand / (maxSand + 1e-9)).toFixed(1);
      }).join(" ");
      s += "<polyline points='" + pts + "' fill='none' stroke='" + it[1] + "' stroke-width='1.4' stroke-dasharray='3 2'/>";
    });
    s += "<text x='150' y='" + (Y0 + 10) + "' font-size='9' fill='#41699b'>含水率（实线）</text>";
    s += "<text x='270' y='" + (Y0 + 10) + "' font-size='9' fill='#2f7d6b'>出砂风险 · 优化</text>";
    s += "<text x='400' y='" + (Y0 + 10) + "' font-size='9' fill='#c9613f'>出砂风险 · 一步提到位</text>";
    s += "<text x='14' y='172' font-size='9' fill='#4d565b'>规律：前段把压差抬到接近临界（把产能放出来），见水后主动回调——这是价值迭代自己学会的动作。</text>";
    s += "<text x='14' y='188' font-size='8.5' fill='#79828a'>出砂代价权重越高、岩石强度越低，最优轨道整体上移但会提前回调；把「出砂代价权重」拉满可看到策略几乎不再超过临界。</text>";
    el("diag").innerHTML = s;
  }

  /* ---------- 5. 主更新 ---------- */
  function update() {
    var par = {
      ls: parseFloat(el("ls").value),
      lw: parseFloat(el("lw").value),
      aq: parseFloat(el("aq").value),
      cd: parseFloat(el("cd").value)
    };
    el("out-ls").textContent = fmt(par.ls, 2);
    el("out-lw").textContent = fmt(par.lw, 2);
    el("out-aq").textContent = fmt(par.aq, 2);
    el("out-cd").textContent = fmt(par.cd, 1) + " MPa";

    var sol = valueIterate(par);
    var res = {
      rl: simulate(null, par, sol, "rl"),
      aggr: simulate(null, par, sol, "aggr"),
      slow: simulate(null, par, sol, "slow")
    };

    drawPolicy(res, par);
    drawCum(res);
    drawDiag(res, par);

    el("ro-step").textContent = fmt(res.rl.path[1].dp, 1) + " MPa";
    el("ro-oil").textContent = fmt(res.rl.oil, 0) + " m³";
    var gain = (res.rl.oil / Math.max(res.slow.oil, 1e-9) - 1) * 100;
    el("ro-gain").textContent = (gain >= 0 ? "+" : "") + fmt(gain, 1) + "%";
    el("ro-gain").className = gain > 0 ? "ok" : "bad";
    el("ro-pen").textContent = fmt(res.rl.sand, 1) + " / " + (res.rl.wat / Math.max(res.rl.oil + res.rl.wat, 1e-9) * 100).toFixed(0) + "%";

    var names = { rl: "优化制度", aggr: "一步提到位", slow: "慢慢提" };
    var tb = "<caption>三种投产制度的对比（90 天）</caption><tr><th>制度</th><th>累计产油 m³</th><th>产水 m³</th><th>出砂量</th><th>净收益</th></tr>";
    ["aggr", "slow", "rl"].forEach(function (k) {
      tb += "<tr><td class='nm'>" + names[k] + "</td><td>" + fmt(res[k].oil, 0) + "</td><td>" + fmt(res[k].wat, 0) +
            "</td><td>" + fmt(res[k].sand, 1) + "</td><td" + (k === "rl" ? " style='color:#2f7d6b'" : "") + ">" + fmt(res[k].ret, 0) + "</td></tr>";
    });
    el("tbl").innerHTML = tb;

    var first = res.rl.path[1];
    el("note").innerHTML =
      "最优制度把第 2 步压差抬到 <b>" + fmt(first.dp, 1) + " MPa</b>，90 天累计产油 <b>" + fmt(res.rl.oil, 0) + " m³</b>，" +
      "比慢提多 <b>" + fmt(gain, 1) + "%</b>，同时把出砂量压在一步提到位的 " +
      fmt(res.rl.sand / Math.max(res.aggr.sand, 1e-9) * 100, 0) + "%。" +
      netNote(res, par);
  }

  function netNote(res, par) {
    if (res.rl.oil >= res.aggr.oil) {
      return " 这一步的关键是：<b>先在见水之前把产能放出来，见水后再主动降一点</b>——净收益比单纯少提或多提都高。";
    }
    if (par.cd < 5) {
      return " 岩石强度很低时，最优策略会主动放弃一部分产量来规避出砂——这正是「人都知道该慢，但不知道慢多少」的那部分。";
    }
    return " 当前约束下，优化制度牺牲了一点短期产量换取更长的无水期；把「出砂代价权重」降低会看到它重新变得激进。";
  }

  ["ls", "lw", "aq", "cd"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  update();
})();
