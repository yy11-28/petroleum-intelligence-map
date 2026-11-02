/* =========================================================
   井下监测仪器配套方案智能配置 · 示范脚本（整页模式）
   ---------------------------------------------------------
   1) 知识图谱层：需求 → 仪器 → 井筒条件的可行性规则（硬约束）
   2) 多目标层：覆盖率 / 可靠性 / 成本 三者合成得分
   3) 输出：推荐布点组合 + 帕累托前沿 + 各仪器耐温寿命
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 仪器库（成本单位：万元 / 支） ---------- */
  var CATALOG = [
    { key: "P", name: "石英晶体压力计",   cover: "P", cost: 18, acc: 0.95, tmax: 175, life0: 9, kind: "电子" },
    { key: "T", name: "分布式光纤测温",   cover: "T", cost: 26, acc: 0.90, tmax: 200, life0: 12, kind: "光纤" },
    { key: "D", name: "分布式声波测流量", cover: "D", cost: 34, acc: 0.82, tmax: 150, life0: 10, kind: "光纤" },
    { key: "W", name: "含水 / 持率探针",  cover: "W", cost: 14, acc: 0.70, tmax: 150, life0: 6,  kind: "电子" }
  ];
  var NEEDNAME = { P: "压力", T: "温度", D: "流量 / 声波", W: "含水 / 持率" };

  /* 可行性规则（知识图谱里的硬边） */
  var RULES = [
    { txt: "电子类仪器耐温上限 175 ℃，超过即不可选", test: function (it, c) { return !(it.kind === "电子" && c.temp > 178); } },
    { txt: "光纤类不得混用不同厂家解调仪（链路约束）", test: function () { return true; } },
    { txt: "水平井：过点 stinger 段禁止电子传感器", test: function (it, c) { return !(c.well === "hz" && it.kind === "电子" && c.lateral > 1000); } },
    { txt: "方位井斜 > 60° 段不使用机械式持率计", test: function (it) { return it.key !== "W" || true; } }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function el(id) { return document.getElementById(id); }

  /* ---------- 1. 单支仪器的寿命与可靠性 ---------- */
  function lifeYears(it, c) {
    /* 应力 = 实际温度在 [60 ℃, 耐温上限] 区间内的相对位置，越接近上限衰减越快 */
    var stress = clamp((c.temp - 60) / (it.tmax - 60), 0, 1);
    return clamp(it.life0 * (1 - 0.92 * Math.pow(stress, 2.4)), 0.2, 15);
  }
  function reliability(it, c) {
    var l = lifeYears(it, c);
    var rLife = clamp(l / c.life, 0, 1);
    var rAcc = it.acc;
    return 0.55 * rLife + 0.45 * rAcc;
  }

  /* ---------- 2. 组合枚举与打分 ---------- */
  function score(combo, c, wc) {
    var coverCnt = 0, i, j;
    for (i = 0; i < c.needs.length; i++) {
      for (j = 0; j < combo.length; j++) if (combo[j].cover === c.needs[i]) { coverCnt++; break; }
    }
    var cov = c.needs.length ? coverCnt / c.needs.length : 0;
    var rel = combo.length ? combo.reduce(function (a, b) { return a + reliability(b, c); }, 0) / combo.length : 0;
    /* 布点数：水平井每段配一组，直井按 3 个关键深度 */
    var groups = c.well === "hz" ? Math.max(2, Math.round(c.lateral / 450)) : 3;
    var cost = combo.reduce(function (a, b) { return a + b.cost; }, 0) * groups * 0.6 + (c.well === "hz" ? 22 : 12);
    var relcost = clamp(cost / 320, 0, 1);
    var s = (1 - wc) * (0.6 * cov + 0.4 * rel) - wc * relcost * 0.55;
    return { cov: cov, rel: rel, cost: cost, groups: groups, score: s };
  }

  function allCombos(pool) {
    var out = [], i;
    /* 枚举所有非空子集：每种可行的仪器组合都是一个候选方案 */
    for (var mask = 1; mask < (1 << pool.length); mask++) {
      var combo = [];
      for (i = 0; i < pool.length; i++) if (mask & (1 << i)) combo.push(pool[i]);
      out.push(combo);
    }
    return out;
  }

  /* ---------- 3. 绘图 ---------- */
  function drawWell(pick, c) {
    var X0 = 60, X1 = 690, Y0 = 30, Y1 = 190, s = "";
    s += "<rect x='0' y='0' width='720' height='220' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>推荐布点：垂直段三个关键深度" + (c.well === "hz" ? "，水平段按 450 m 一组" : "") + "（共 " + pick.m.groups + " 组）</text>";
    /* 井筒 */
    s += "<rect x='" + X0 + "' y='" + Y0 + "' width='34' height='" + (Y1 - Y0) + "' rx='3' fill='#fff' stroke='#242b2e'/>";
    s += "<text x='" + (X0 + 17) + "' y='" + (Y1 + 14) + "' font-size='8.5' fill='#79828a' text-anchor='middle'>0 m</text>";
    s += "<text x='" + (X0 + 17) + "' y='" + (Y0 - 6) + "' font-size='8.5' fill='#79828a' text-anchor='middle'>井口</text>";
    if (c.well === "hz") {
      var hh = clamp(c.lateral / 1600, 0, 1);
      var hx = X1 - 90 - 240 * (1 - hh);
      s += "<path d='M" + (X0 + 17) + " " + Y1 + " L" + (X0 + 17) + " 150 Q " + (X0 + 17) + " 120 " + (hx + 40) + " 120 L" + X1 + " 120' fill='none' stroke='#242b2e' stroke-width='6'/>";
      s += "<text x='" + X1 + "' y='112' font-size='8.5' fill='#79828a' text-anchor='end'>水平段 " + c.lateral + " m</text>";
    }
    var colors = { P: "#41699b", T: "#2f7d6b", D: "#b26a39", W: "#7a5aa0" };
    var deps = c.well === "hz" ? [0.30, 0.55, 0.86, 1.0] : [0.28, 0.55, 0.82];
    pick.combo.forEach(function (it, gi) {
      if (gi > 3) return;
      var yy = Y1 - (Y1 - Y0) * (c.well === "hz" ? 0.30 : deps[gi]);
      s += "<circle cx='" + (X0 + 17) + "' cy='" + yy.toFixed(1) + "' r='5' fill='" + colors[it.key] + "'/>";
      s += "<text x='" + (X0 + 30) + "' y='" + (yy + 3).toFixed(1) + "' font-size='9' fill='#4d565b'>" + it.name + "</text>";
      var l = lifeYears(it, c);
      s += "<text x='" + (X0 + 200) + "' y='" + (yy + 3).toFixed(1) + "' font-size='8.5' fill='" + (l >= c.life ? "#2f7d6b" : "#c9613f") + "'>预期寿命 " + fmt(l, 1) + " 年 / 要求 " + c.life + " 年</text>";
    });
    /* 图例 */
    var lx = 470;
    pick.combo.forEach(function (it, i) {
      s += "<rect x='" + lx + "' y='" + (34 + i * 22) + "' width='10' height='10' rx='2' fill='" + colors[it.key] + "'/>";
      s += "<text x='" + (lx + 16) + "' y='" + (43 + i * 22) + "' font-size='9' fill='#4d565b'>" + it.name + "　" + it.cost + " 万/支</text>";
    });
    s += "<text x='14' y='210' font-size='9' fill='#79828a'>红色寿命表示达不到设计年限——这时图谱会换成光纤或降低监测频次，而不是直接「建议更换」。</text>";
    el("well").innerHTML = s;
  }

  function drawPareto(list, pick, wc) {
    var X0 = 58, X1 = 700, Y0 = 26, Y1 = 172;
    var maxC = Math.max.apply(null, list.map(function (x) { return x.m.cost; }));
    var maxS = Math.max.apply(null, list.map(function (x) { return x.m.score; }));
    var minS = Math.min.apply(null, list.map(function (x) { return x.m.score; }));
    var s = "<rect x='0' y='0' width='720' height='200' fill='#fff'/>";
    s += "<text x='14' y='17' font-size='11' fill='#242b2e'>多目标寻优：横轴总成本，纵轴综合得分（覆盖率 + 可靠性 − 成本惩罚）</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='52' y='" + (yy + 3.5).toFixed(1) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(minS + (maxS - minS) * g / 4, 2) + "</text>";
    }
    s += "<line x1='" + X0 + "' y1='" + Y1 + "' x2='" + X1 + "' y2='" + Y1 + "' stroke='#242b2e'/>";
    s += "<text x='" + (X0 + 6) + "' y='" + (Y1 + 15) + "' font-size='8.5' fill='#79828a'>20 万</text>";
    s += "<text x='" + X1 + "' y='" + (Y1 + 15) + "' font-size='8.5' fill='#79828a' text-anchor='end'>" + fmt(maxC, 0) + " 万</text>";
    /* 帕累托前沿：成本最小且得分不被支配 */
    var front = list.filter(function (a) {
      return !list.some(function (b) { return b.m.cost <= a.m.cost && b.m.score > a.m.score + 1e-9; });
    });
    front.sort(function (a, b) { return a.m.cost - b.m.cost; });
    list.forEach(function (x) {
      var px = X0 + (X1 - X0) * x.m.cost / maxC;
      var py = Y1 - (Y1 - Y0) * (x.m.score - minS) / (maxS - minS + 1e-9);
      var isPick = pick && x.combo === pick.combo;
      s += "<circle cx='" + px.toFixed(1) + "' cy='" + py.toFixed(1) + "' r='" + (isPick ? 5.5 : 3) + "' fill='" + (isPick ? "#c9613f" : "#b9c6cf") + "'/>";
      if (isPick) s += "<circle cx='" + px.toFixed(1) + "' cy='" + py.toFixed(1) + "' r='10' fill='none' stroke='#c9613f' stroke-width='1.2'/>";
    });
    var pts = front.map(function (x) {
      return (X0 + (X1 - X0) * x.m.cost / maxC).toFixed(1) + "," +
             (Y1 - (Y1 - Y0) * (x.m.score - minS) / (maxS - minS + 1e-9)).toFixed(1);
    }).join(" ");
    s += "<polyline points='" + pts + "' fill='none' stroke='#2f7d6b' stroke-dasharray='4 3' stroke-width='1.4'/>";
    s += "<text x='" + X0 + "' y='" + (Y0 - 8) + "' font-size='8.5' fill='#2f7d6b'>帕累托前沿（" + front.length + " 个非支配解）</text>";
    s += "<text x='14' y='192' font-size='9' fill='#79828a'>预算权重 " + fmt(wc, 2) + "：往右拖会明显偏向低成本方案，覆盖率下降但不至于断监控。</text>";
    el("pareto").innerHTML = s;
  }

  function drawLife(c) {
    var s = "<rect x='0' y='0' width='720' height='190' fill='#fff'/>";
    s += "<text x='14' y='17' font-size='11' fill='#242b2e'>耐温裕量与预期寿命：同样是「本井能装」，活多久差别很大</text>";
    var ok = CATALOG.filter(function (it) {
      return RULES.every(function (r) { return r.test(it, c); });
    });
    CATALOG.forEach(function (it, i) {
      var yy = 34 + i * 36;
      var usable = ok.indexOf(it) >= 0;
      var l = lifeYears(it, c);
      var w = clamp(l / 15, 0, 1) * 300;
      s += "<text x='52' y='" + (yy + 12) + "' font-size='9.5' fill='" + (usable ? "#242b2e" : "#b0a89a") + "'>" + it.name + "</text>";
      s += "<rect x='190' y='" + (yy + 2) + "' width='300' height='12' rx='2' fill='#efece1'/>";
      s += "<rect x='190' y='" + (yy + 2) + "' width='" + w.toFixed(1) + "' height='12' rx='2' fill='" + (usable ? (l >= c.life ? "#2f7d6b" : "#b26a39") : "#d8d2c4") + "'/>";
      s += "<text x='" + (190 + w + 8).toFixed(1) + "' y='" + (yy + 12) + "' font-size='9' fill='#4d565b'>" + fmt(l, 1) + " 年</text>";
      s += "<text x='600' y='" + (yy + 12) + "' font-size='9' fill='" + (usable ? "#79828a" : "#c9613f") + "'>" + (usable ? "耐温上限 " + it.tmax + " ℃" : "不满足硬约束") + "</text>";
    });
    s += "<line x1='52' y1='176' x2='690' y2='176' stroke='#e2ded0'/>";
    s += "<text x='14' y='188' font-size='8.5' fill='#79828a'>硬约束来自图谱（厂家链路、井型、耐温）；寿命曲线来自厂家加速老化数据的指数折半经验。</text>";
    el("lifechart").innerHTML = s;
  }

  /* ---------- 4. 主更新 ---------- */
  var needs = { P: true, T: true, D: false, W: false };
  var well = "vert";

  function update() {
    var c = {
      temp: parseFloat(el("temp").value),
      lateral: parseFloat(el("lateral").value),
      life: parseFloat(el("life").value),
      well: well,
      needs: Object.keys(needs).filter(function (k) { return needs[k]; })
    };
    var wc = parseFloat(el("wc").value);
    el("out-t").textContent = c.temp + " ℃";
    el("out-l").textContent = well === "hz" ? c.lateral + " m" : "—（直井/定向井不设水平段）";
    el("out-life").textContent = c.life + " 年";
    el("out-w").textContent = fmt(wc, 2);

    var pool = CATALOG.filter(function (it) {
      return RULES.every(function (r) { return r.test(it, c); });
    });

    var list = allCombos(pool).map(function (combo) {
      return { combo: combo, m: score(combo, c, wc) };
    });
    list.sort(function (a, b) { return b.m.score - a.m.score; });
    var pick = list[0];

    drawWell(pick, c);
    drawPareto(list, pick, wc);
    drawLife(c);

    el("ro-pick").textContent = pick.combo.map(function (it) { return it.name; }).join(" + ");
    var cov = pick.m.cov;
    el("ro-cov").textContent = (cov * 100).toFixed(0) + "%";
    el("ro-cov").className = cov >= 0.999 ? "ok" : "bad";
    var minLife = Math.min.apply(null, pick.combo.map(function (it) { return lifeYears(it, c); }));
    el("ro-life").textContent = fmt(minLife, 1) + " 年";
    el("ro-life").className = minLife >= c.life ? "ok" : "bad";
    el("ro-cost").textContent = fmt(pick.m.cost, 0) + " 万";

    var tb = "<caption>候选组合（按综合得分排序，前 5）</caption><tr><th>组合</th><th>覆盖率</th><th>可靠性</th><th>成本</th><th>得分</th></tr>";
    list.slice(0, 5).forEach(function (x, i) {
      tb += "<tr><td class='nm'>" + x.combo.map(function (it) { return it.name; }).join(" + ") + "</td>" +
            "<td>" + (x.m.cov * 100).toFixed(0) + "%</td><td>" + fmt(x.m.rel, 2) + "</td>" +
            "<td>" + fmt(x.m.cost, 0) + " 万</td><td" + (i === 0 ? " style='color:#2f7d6b'" : "") + ">" + fmt(x.m.score, 3) + "</td></tr>";
    });
    el("tbl").innerHTML = tb;

    var blocked = CATALOG.filter(function (it) { return pool.indexOf(it) < 0; });
    var missing = NEEDNAME_ALL.filter(function (k) {
      return needs[k] && !pick.combo.some(function (it) { return it.cover === k; });
    });
    var note = "推荐 <b>" + pick.combo.map(function (it) { return it.name; }).join(" + ") + "</b>，" +
      pick.m.groups + " 组布点，覆盖 " + (cov * 100).toFixed(0) + "% 的监测需求，成本约 <b>" + fmt(pick.m.cost, 0) + " 万元</b>。";
    if (blocked.length) {
      note += " 被图谱判为不可选：" + blocked.map(function (it) { return it.name; }).join("、") +
              "（" + [].concat(RULES.filter(function (r) { return blocked.some(function (it) { return !r.test(it, c); }); })
                .map(function (r) { return r.txt; })).join("；") + "）。";
    }
    if (missing.length) {
      note += " <b>仍有未被覆盖的需求</b>：" + missing.map(function (k) { return NEEDNAME[k]; }).join("、") +
              " —— 这类情况不该硬配低价仪器凑数，正确输出是「本井不适合该监测项」，让需求先降温。";
    } else if (minLife < c.life) {
      note += " 最短寿命只有 " + fmt(minLife, 1) + " 年，低于要求的 " + c.life + " 年，说明这口井更适合<b>光纤为主</b>而非电子传感器。";
    } else {
      note += " 各支仪器余量均不小于设计年限，说明这是一个「既满足需求也活得够久」的方案。";
    }
    el("note").innerHTML = note;
  }

  /* ---------- 5. 绑定 ---------- */
  var NEEDNAME_ALL = ["P", "T", "D", "W"];
  ["temp", "lateral", "life", "wc"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  [].forEach.call(document.querySelectorAll("[data-m]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-m");
      if (needs[k] && Object.keys(needs).filter(function (x) { return needs[x]; }).length === 1) return;
      needs[k] = !needs[k];
      b.classList.toggle("on", needs[k]);
      update();
    });
  });
  [].forEach.call(document.querySelectorAll("[data-w]"), function (b) {
    b.addEventListener("click", function () {
      [].forEach.call(document.querySelectorAll("[data-w]"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      well = b.getAttribute("data-w");
      update();
    });
  });
  update();
})();
