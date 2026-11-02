/* =========================================================
   智能完井滑套控制策略 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   极简的多层合采模拟器：4 段 × 36 个月，
     状态 = 各段含水级别；动作 = 各段滑套开/节流；
     奖励 = 产油 − λ × 产水。
   在模拟器上跑表格 Q 学习，再与两种习惯做法同井对跑比较：
     A 长期全开     B 每次关掉含水最高段     C 学到的策略
   注：这是演示用的降阶模型，不是油藏数值模拟结果。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 模拟器参数 ---------- */
  var NZ = 4;
  var KMUL = [1.15, 1.00, 0.85, 1.30];       /* 各段产能贡献（渗透率差异） */
  var SUP = [0.50, 0.80, 1.10, 1.80];        /* 水体能量：越靠底越强 */
  var INIT_SW = [0.42, 0.47, 0.53, 0.66];    /* 初始含水饱和度 */
  var SWC = 0.30, SWMAX = 0.75;
  var QMAX = 1.0;                            /* 归一化总液量上限 */
  var HORIZON = 36;                          /* 决策周期（月） */
  var GAIN = 0.0075;                         /* 含水上升速率系数 */
  var OPEN_MAX = 1.0, OPEN_MIN = 0.15;       /* 全开 / 最大节流 */
  var NA = 16;                               /* 动作 = 4 个滑套的开/节流组合 */
  var NS = 81;                               /* 状态 = 各段含水级别 3^4 */
  var ALPHA = 0.3, GAMMA = 0.96;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function krof(sw) { var x = (SWMAX - sw) / (SWMAX - SWC); return Math.max(0, Math.min(1, x * x)); }
  function krwf(sw) { var x = (sw - SWC) / (SWMAX - SWC); return Math.max(0, Math.min(1, x * x)); }

  function openOf(a) {
    var o = [];
    for (var i = 0; i < NZ; i++) o.push(((a >> i) & 1) ? OPEN_MAX : OPEN_MIN);
    return o;
  }

  /* 推进一个月：返回产油/产水与新含水 */
  function stepMonth(sw, o) {
    var pot = [], i, P = 0;
    for (i = 0; i < NZ; i++) {
      var m = KMUL[i] * o[i] * (krof(sw[i]) + krwf(sw[i]));
      pot.push(m); P += m;
    }
    /* 井筒—储层耦合：各段总产能 P 越高，总液量越接近 QMAX 但永远到不了，
       关掉一段时其它段只能部分补偿（真实管流就是这样） */
    var qt = QMAX * (1 - Math.exp(-P / 1.2));
    var qo = 0, qw = 0, nsw = sw.slice();
    for (i = 0; i < NZ; i++) {
      var qi = P > 0 ? pot[i] / P * qt : 0;
      var den = krof(sw[i]) + krwf(sw[i]);
      var fw = den > 0 ? krwf(sw[i]) / den : 1;
      qw += qi * fw;
      qo += qi * (1 - fw);
      nsw[i] = Math.min(SWMAX, sw[i] + GAIN * SUP[i] * (0.15 + qi));
    }
    return { qo: qo, qw: qw, sw: nsw };
  }

  function stateOf(sw) {
    var s = 0;
    for (var i = 0; i < NZ; i++) {
      var b = Math.floor((sw[i] - SWC) / ((SWMAX - SWC) / 3));
      if (b < 0) b = 0; if (b > 2) b = 2;
      s = s * 3 + b;
    }
    return s;
  }

  function bestAction(Q, s) {
    var bi = 0, bv = -Infinity;
    for (var a = 0; a < NA; a++) {
      var v = Q[s * NA + a];
      if (v > bv) { bv = v; bi = a; }
    }
    return { a: bi, v: bv };
  }

  /* ---------- 1. 三种策略 ---------- */
  function policyOpen() { return [1, 1, 1, 1]; }

  function policyGreedy(sw) {
    /* 习惯做法：把当前含水最高的那一段节流，其它全开 */
    var worst = 0, wv = -1, i;
    for (i = 0; i < NZ; i++) {
      var den = krof(sw[i]) + krwf(sw[i]);
      var fw = den > 0 ? krwf(sw[i]) / den : 1;
      if (fw > wv) { wv = fw; worst = i; }
    }
    var o = policyOpen();
    o[worst] = OPEN_MIN;
    return o;
  }

  /* ---------- 2. 跑完一个回合 ---------- */
  function rollout(lam, pick) {
    var sw = INIT_SW.slice(), totO = 0, totW = 0, ret = 0, changes = 0, prev = null;
    for (var t = 0; t < HORIZON; t++) {
      var o = pick(sw, t);
      if (prev) {
        var diff = false;
        for (var i = 0; i < NZ; i++) if (Math.abs(o[i] - prev[i]) > 1e-9) diff = true;
        if (diff) changes++;
      }
      prev = o;
      var r = stepMonth(sw, o);
      var rew = r.qo - lam * r.qw;
      ret += Math.pow(GAMMA, t) * rew;
      totO += r.qo; totW += r.qw;
      sw = r.sw;
    }
    return { oil: totO, water: totW, ret: ret, changes: changes };
  }

  /* ---------- 3. 表格 Q 学习 ---------- */
  function train(episodes, lam, seed) {
    var Q = new Float64Array(NS * NA);
    var rnd = mulberry32(seed);
    var curve = [];
    for (var e = 0; e < episodes; e++) {
      var eps = Math.max(0.02, 0.9 * Math.pow(0.02 / 0.9, e / episodes));
      var sw = INIT_SW.slice(), ret = 0;
      for (var t = 0; t < HORIZON; t++) {
        var s = stateOf(sw);
        var a = (rnd() < eps) ? Math.floor(rnd() * NA) : bestAction(Q, s).a;
        var r = stepMonth(sw, openOf(a));
        var rew = r.qo - lam * r.qw;
        var ns = stateOf(r.sw);
        var targ = rew + GAMMA * bestAction(Q, ns).v;
        Q[s * NA + a] += ALPHA * (targ - Q[s * NA + a]);
        ret += Math.pow(GAMMA, t) * rew;
        sw = r.sw;
      }
      curve.push(ret);
    }
    return { Q: Q, curve: curve };
  }

  /* ---------- 4. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var lamIn = el("lam"), epIn = el("ep"), lc = el("lc"), pc = el("pc"), note = el("note");
  var planSvg = el("plan");
  var tB = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };

  /* ---------- 策略到底是什么：4 段 × 36 月的开度序列 ---------- */
  function openings(pick) {
    var sw = INIT_SW.slice(), out = [], swT = [];
    for (var t = 0; t < HORIZON; t++) {
      var o = pick(sw, t);
      out.push(o.slice()); swT.push(sw.slice());
      var r = stepMonth(sw, o);
      sw = r.sw;
    }
    return { op: out, sw: swT };
  }

  function drawPlan(Q, lam) {
    var L = openings(function (sw) { return openOf(bestAction(Q, stateOf(sw)).a); });
    var G = openings(function (sw) { return policyGreedy(sw); });
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">策略不是一个数，而是一条' + tB("开度随时间的轨迹") + '：每格是某段某月的滑套状态（深绿＝全开，橙＝节流）</text>';
    [[L, "学到的策略", 30], [G, "经验规则（关含水最高段）", 372]].forEach(function (cfg) {
      var data = cfg[0], nm = cfg[1], x0 = cfg[2];
      var cw = 8.6, ch = 22, gx = x0 + 62, gy = 40;
      s += '<text x="' + x0 + '" y="' + (gy - 6) + '" font-size="10.5" fill="#4d565b">' + nm + '</text>';
      for (var z = 0; z < NZ; z++) {
        s += '<text x="' + (x0 + 54) + '" y="' + (gy + z * (ch + 4) + 15) + '" font-size="9" fill="#79828a" text-anchor="end">第 ' +
          (z + 1) + ' 段</text>';
        for (var t = 0; t < HORIZON; t++) {
          var op = data.op[t][z];
          var full = op > (OPEN_MAX + OPEN_MIN) / 2;
          var wet = (data.sw[t][z] - SWC) / (SWMAX - SWC);
          s += '<rect x="' + (gx + t * cw).toFixed(1) + '" y="' + (gy + z * (ch + 4)) + '" width="' + (cw - 1).toFixed(1) +
            '" height="' + ch + '" fill="' + (full ? "#2f7d6b" : "#b26a39") + '" opacity="' +
            (full ? (0.45 + 0.5 * (1 - wet)).toFixed(2) : 0.85) + '"/>';
        }
      }
      s += '<text x="' + gx + '" y="' + (gy + NZ * (ch + 4) + 16) + '" font-size="9" fill="#79828a">第 1 月</text>';
      s += '<text x="' + (gx + HORIZON * cw - 2).toFixed(1) + '" y="' + (gy + NZ * (ch + 4) + 16) +
        '" font-size="9" fill="#79828a" text-anchor="end">第 36 月 →</text>';
    });
    s += '<text x="14" y="192" font-size="10" fill="#4d565b">经验规则几乎总是盯住同一段（底部水体最强的那段）不放，而学到的策略会' +
      tB("换节流对象") + '——差别不在「谁关得更狠」，而在「谁在跟着状态动」。</text>';
    s += '<text x="14" y="206" font-size="10" fill="#4d565b">颜色深浅是该段当月含水（越深越湿）：把两图对照着看，能直接看出策略是在<tspan font-weight="600">追水</tspan>还是在追产量。</text>';
    planSvg.innerHTML = s;
  }

  var lastTune = null;

  function retrain() {
    var episodes = Number(epIn.value);
    var lam = Number(lamIn.value);
    el("out-lam").textContent = lam.toFixed(2);
    el("out-ep").textContent = episodes;

    var res = train(episodes, lam, 20261023);

    /* 三种策略同井对跑 */
    var learned = rollout(lam, function (sw) {
      return openOf(bestAction(res.Q, stateOf(sw)).a);
    });
    var allOpen = rollout(lam, function () { return [1, 1, 1, 1]; });
    var greedy = rollout(lam, function (sw) { return policyGreedy(sw); });

    drawCurve(res.curve, learned.ret, episodes);
    drawCompare(allOpen, greedy, learned);
    drawPlan(res.Q, lam);

    var doil = (learned.oil / allOpen.oil - 1) * 100;
    var dwat = (learned.water / allOpen.water - 1) * 100;
    var vs = (learned.ret / greedy.ret - 1) * 100;
    var oEl = el("ro-oil");
    oEl.textContent = (doil >= 0 ? "+" : "") + doil.toFixed(1) + "%";
    oEl.className = doil > 0.5 ? "ok" : "bad";
    var wEl = el("ro-wat");
    wEl.textContent = (dwat >= 0 ? "+" : "") + dwat.toFixed(1) + "%";
    wEl.className = dwat < -0.5 ? "ok" : "bad";
    el("ro-act").textContent = learned.changes + " 次 / " + greedy.changes + " 次（经验）";
    var vEl = el("ro-vs");
    vEl.textContent = learned.ret.toFixed(2) + " / " + greedy.ret.toFixed(2);
    vEl.className = learned.ret > greedy.ret ? "ok" : "bad";

    var actMsg = learned.changes <= 2
      ? "这一轮学到的策略几乎是<b>一组固定开度就跑到底</b>（" + learned.changes + " 次调整）——" +
        "这本身是个有用的结论：它说明在这口井上，值得做的节流决策集中在开头几个月，" +
        "后面随状态调整的空间很小，现场可以省掉后续作业。"
      : "这一轮策略在 36 个月里调整了 <b>" + learned.changes + " 次</b>开度，是随含水状态在动——" +
        "上线前要确认这个频次落在机械寿命与作业安排允许的范围内。";
    note.innerHTML ="目标函数 J = 折扣的（产油 − " + lam.toFixed(2) + " × 产水）。在这一口井上，" +
      "<b>长期全开</b>：产油 " + allOpen.oil.toFixed(2) + " / 产水 " + allOpen.water.toFixed(2) +
      "，J = " + allOpen.ret.toFixed(2) +
      "；<b>经验规则</b>（每次关掉含水最高段）：产油 " + greedy.oil.toFixed(2) + " / 产水 " +
      greedy.water.toFixed(2) + "，J = " + greedy.ret.toFixed(2) +
      "；<b>学到的策略</b>：产油 <b>" + learned.oil.toFixed(2) +
      "</b> / 产水 <b>" + learned.water.toFixed(2) + "</b>，J = <b>" + learned.ret.toFixed(2) + "</b>。" +
      (vs > 0.2
        ? "策略在综合收益上跑赢了经验规则：它可以同时节流多段、也能在不同阶段换节流对象；经验规则每步只能动一段，而且往往长期盯在同一段上。"
        : "这一轮策略在 J 上没有跑赢经验规则：先看学习曲线是否已经出现平台（回合不够就继续加），再看 λ——λ 越小，最优策略越接近全开，经验规则本来就差不多最优。") +
      " " + actMsg + " 真实的策略还要再过一层物理约束（动作频次、单阀压差上限），" +
      "产量再高、动阀太频繁的方案也不会被允许上线。" +
      " 另外提醒：这是降阶模型上的结果，量级偏乐观；真实井上的收益通常在个位数百分比。";
  }

  /* ---------- 5. 绘图 ---------- */
  function drawCurve(curve, evalRet, episodes) {
    var W = 720, H = 240, ML = 46, MR = 14, MT = 14, MB = 30;
    var lo = Infinity, hi = -Infinity, i;
    for (i = 0; i < curve.length; i++) { if (curve[i] < lo) lo = curve[i]; if (curve[i] > hi) hi = curve[i]; }
    lo = Math.min(lo, evalRet); hi = Math.max(hi, evalRet);
    var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    var X = function (k) { return ML + k / Math.max(1, curve.length - 1) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB); };

    var s = "";
    for (i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) +
        '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="end" font-family="monospace">' + v.toFixed(1) + '</text>';
    }
    /* 原始回报 */
    var d1 = "";
    for (i = 0; i < curve.length; i++) d1 += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(curve[i]).toFixed(1);
    s += '<path d="' + d1 + '" fill="none" stroke="#cfd8dd" stroke-width="1"/>';
    /* 滑动平均 */
    var win = Math.max(1, Math.floor(curve.length / 25));
    var d2 = "", n = 0;
    for (i = 0; i < curve.length; i++) {
      var sum = 0, cnt = 0;
      for (var j = Math.max(0, i - win); j <= Math.min(curve.length - 1, i + win); j++) { sum += curve[j]; cnt++; }
      d2 += (n ? "L" : "M") + X(i).toFixed(1) + " " + Y(sum / cnt).toFixed(1);
      n++;
    }
    s += '<path d="' + d2 + '" fill="none" stroke="#41699b" stroke-width="1.6" stroke-linejoin="round"/>';
    /* 确定性评估值 */
    s += '<line x1="' + ML + '" y1="' + Y(evalRet).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(evalRet).toFixed(1) +
      '" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="6 3"/>';
    s += '<text x="' + (W - MR) + '" y="' + (Y(evalRet) - 4).toFixed(1) + '" font-size="9.5" fill="#2f7d6b" ' +
      'text-anchor="end" font-family="monospace">确定性评估 ' + evalRet.toFixed(2) + '</text>';
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">回合 →</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 折扣回报</text>';
    lc.innerHTML = s;
  }

  function drawCompare(a, b, c) {
    var W = 720, H = 210, ML = 58, MR = 14, MT = 18, MB = 34;
    var sets = [
      { nm: "长期全开", oil: a.oil, wat: a.water, c1: "#9fc2b4" },
      { nm: "经验规则", oil: b.oil, wat: b.water, c1: "#6fa595" },
      { nm: "学到的策略", oil: c.oil, wat: c.water, c1: "#2f7d6b" }
    ];
    var maxV = 0;
    sets.forEach(function (p) { maxV = Math.max(maxV, p.oil, p.wat); });
    maxV = maxV * 1.12;
    var YB = H - MB;
    var Y = function (v) { return MT + (1 - v / maxV) * (YB - MT); };
    var gw = (W - ML - MR) / sets.length;
    var bw = Math.min(52, gw * 0.28);

    var s = "";
    [0, 0.5, 1].forEach(function (f) {
      var v = maxV * f;
      s += '<line x1="' + ML + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(v).toFixed(1) +
        '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="end" font-family="monospace">' + v.toFixed(1) + '</text>';
    });

    sets.forEach(function (p, k) {
      var cx = ML + gw * (k + 0.5);
      var xo = cx - bw - 4, xw = cx + 4;
      s += '<rect x="' + xo.toFixed(1) + '" y="' + Y(p.oil).toFixed(1) + '" width="' + bw + '" height="' +
        (YB - Y(p.oil)).toFixed(1) + '" fill="' + p.c1 + '" rx="2"/>';
      s += '<rect x="' + xw.toFixed(1) + '" y="' + Y(p.wat).toFixed(1) + '" width="' + bw + '" height="' +
        (YB - Y(p.wat)).toFixed(1) + '" fill="#41699b" opacity=".8" rx="2"/>';
      s += '<text x="' + xo.toFixed(1) + '" y="' + (Y(p.oil) - 4).toFixed(1) + '" font-size="9.5" fill="#2f7d6b" ' +
        'font-family="monospace">' + p.oil.toFixed(2) + '</text>';
      s += '<text x="' + xw.toFixed(1) + '" y="' + (Y(p.wat) - 4).toFixed(1) + '" font-size="9.5" fill="#41699b" ' +
        'font-family="monospace">' + p.wat.toFixed(2) + '</text>';
      s += '<text x="' + cx.toFixed(1) + '" y="' + (YB + 16) + '" font-size="11.5" fill="#242b2e" ' +
        'text-anchor="middle">' + p.nm + '</text>';
    });
    s += '<text x="' + ML + '" y="' + (MT - 5) + '" font-size="9.5" fill="#79828a">■ 累计产油（绿） / 累计产水（蓝）</text>';
    pc.innerHTML = s;
  }

  lamIn.addEventListener("input", function () { el("out-lam").textContent = Number(lamIn.value).toFixed(2); });
  epIn.addEventListener("input", function () { el("out-ep").textContent = epIn.value; });
  lamIn.addEventListener("change", retrain);
  epIn.addEventListener("change", retrain);
  retrain();
})();
