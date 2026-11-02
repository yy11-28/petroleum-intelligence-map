/* =========================================================
   老井复产 / 侧钻完井改造方案智能设计 · 示范脚本（整页模式）
   ---------------------------------------------------------
   1) 图谱层：井筒条件 → 技术可行性（硬约束）+ 历史同类井成功率先验
   2) 优化层：组合枚举 → 三年增量产量 → 净现值 / 回收期
   3) 输出：推荐方案 + 累计增油 + 回收期 + 技术成功率
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 措施库 ---------- */
  var MEASURES = [
    { key: "pump", name: "检泵换管",     cost: 42,  days: 8,  gain: 0.22, life: 2.2, where: "bore" },
    { key: "acid", name: "酸化解堵",     cost: 68,  days: 5,  gain: 0.48, life: 1.6, where: "near" },
    { key: "perf", name: "补孔 / 射开新层", cost: 95, days: 6, gain: 0.85, life: 2.6, where: "zone" },
    { key: "frac", name: "压裂改造",     cost: 210, days: 14, gain: 1.55, life: 3.2, where: "zone" },
    { key: "side", name: "开窗侧钻重完井", cost: 430, days: 32, gain: 2.30, life: 3.6, where: "new" }
  ];

  /* 硬约束（知识图谱里的边） */
  var RULES = [
    { txt: "套管完好度 < 0.45 → 不能压裂",       test: function (m, c) { return !(m.key === "frac" && c.cas < 0.45); } },
    { txt: "套管完好度 < 0.30 → 只能侧钻",       test: function (m, c) { return !(c.cas < 0.30 && m.where !== "new"); } },
    { txt: "剩余储量 < 0.20 → 不做万级以上改造", test: function (m, c) { return !(c.res < 0.20 && m.cost > 120); } },
    { txt: "侧钻与其它井筒内措施互斥",           test: function (m, c, combo) { return !(m.key === "side" && combo.some(function (x) { return x.where !== "new"; })); } },
    { txt: "压裂与补孔同一层段不叠加计费",       test: function (m, c, combo) { return !(m.key === "frac" && combo.some(function (x) { return x.key === "perf"; })); } }
  ];

  /* 历史同类老井：同类条件下的实际成功率与效果（用于校正先验） */
  var HIST = [
    { id: "OW-19", v: [0.82, 0.55, 0.45], combo: ["acid", "perf"], gain: 0.95, ok: 1, note: "酸化补孔后日产 6.2 t，稳产 14 个月" },
    { id: "OW-24", v: [0.38, 0.30, 0.35], combo: ["side"],         gain: 1.60, ok: 1, note: "套管变形放弃压裂，侧钻后回落较快" },
    { id: "OW-31", v: [0.55, 0.18, 0.50], combo: ["acid"],         gain: 0.30, ok: 0, note: "剩余储量不足，酸化后并未增产" },
    { id: "OW-42", v: [0.90, 0.72, 0.25], combo: ["frac"],         gain: 2.10, ok: 1, note: "套管完好，压裂后有效期 26 个月" },
    { id: "OW-55", v: [0.65, 0.40, 0.60], combo: ["pump", "acid"], gain: 0.45, ok: 1, note: "先通井再酸化，成本回收 11 个月" }
  ];

  var HORIZON = 36;   /* 评价期 36 个月 */
  var Q0 = 4.2;       /* 当前日产 t/d */
  var DECL0 = 0.028;  /* 当前月递减 */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }
  function el(id) { return document.getElementById(id); }

  /* ---------- 1. 技术成功率：条件 + 历史先验融合 ---------- */
  function priorOf(key, c) {
    /* 历史库中含该措施、且条件相近的井 → 成功率先验 */
    var v = [c.cas, c.res, c.dam];
    var sc = [1, 1, 1];
    var num = 0, den = 0;
    HIST.forEach(function (h) {
      var d2 = 0;
      for (var i = 0; i < 3; i++) d2 += Math.pow((v[i] - h.v[i]) / sc[i], 2);
      var w = Math.exp(-d2 / 0.08);
      if (h.combo.indexOf(key) >= 0) { num += w * h.ok; den += w; }
    });
    return den > 1e-6 ? num / den : null;
  }
  function techProb(m, c) {
    var base;
    if (m.key === "side") base = 0.62 + 0.22 * c.res - 0.10 * (1 - c.cas);
    else if (m.key === "frac") base = 0.45 + 0.35 * c.cas + 0.20 * c.res - 0.15 * c.dam;
    else if (m.key === "perf") base = 0.55 + 0.30 * c.res;
    else if (m.key === "acid") base = 0.40 + 0.45 * c.dam;
    else base = 0.80;
    var pr = priorOf(m.key, c);
    /* 有历史先验时按 0.5 / 0.5 融合，没有就只用机理估计 */
    return pr === null ? clamp(base, 0.05, 0.95) : clamp(0.5 * base + 0.5 * pr, 0.05, 0.95);
  }

  /* ---------- 2. 组合枚举与经济评价 ---------- */
  function combos(pool) {
    var out = [];
    for (var mask = 1; mask < (1 << pool.length); mask++) {
      var cm = [];
      for (var i = 0; i < pool.length; i++) if (mask & (1 << i)) cm.push(pool[i]);
      out.push(cm);
    }
    return out;
  }

  function evaluate(combo, c) {
    var cost = 0, days = 0, cred = 1, m;
    for (var i = 0; i < combo.length; i++) {
      m = combo[i];
      cost += m.cost; days += m.days;
      cred *= techProb(m, c);
    }
    /* 各项措施带来的产量增益按「剩余储量」缩放，并随 Verbindung efect 递减叠加 */
    var g = 0;
    combo.forEach(function (x) { g += x.gain * (0.45 + 0.55 * c.res); });
    g = g * (1 - 0.12 * Math.max(0, combo.length - 1));
    var life = Math.max.apply(null, combo.map(function (x) { return x.life; }));
    /* 逐月产量：增益在有效期之后回落四成 */
    var inc = 0, oilRev = 0, payMonth = -1, cumNPV = -cost;
    for (var mo = 1; mo <= HORIZON; mo++) {
      var qEff = Q0 * Math.exp(-DECL0 * (mo - 1)) * g * cred;
      if (mo > life * 12) qEff *= 0.45;                  /* 有效期之后回落 */
      var monthOil = qEff * 30.4;                        /* 吨/月 */
      inc += monthOil;
      var rev = monthOil * c.price * 7.3 * 0.55;         /* 1 t ≈ 7.3 bbl，0.55 扣除操作成本与税费 */
      oilRev += rev;
      cumNPV += rev / 10000 - 0;                         /* 净现值用万元计 */
      if (payMonth < 0 && oilRev / 10000 >= cost) payMonth = mo;
    }
    return {
      cost: cost, days: days, cred: cred, gain: g,
      inc: inc, npv: oilRev / 10000 - cost, pay: payMonth
    };
  }

  /* ---------- 3. 绘图 ---------- */
  function drawWell(c, pick) {
    var s = "<rect x='0' y='0' width='720' height='215' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>井筒条件与措施作用位置（套管完好度越高，可选项越多）</text>";
    /* 井筒 */
    var X = 90, Y0 = 34, Y1 = 186;
    s += "<rect x='" + X + "' y='" + Y0 + "' width='26' height='" + (Y1 - Y0) + "' rx='3' fill='#fff' stroke='#242b2e'/>";
    s += "<text x='" + (X + 13) + "' y='" + (Y0 - 6) + "' font-size='8.5' fill='#79828a' text-anchor='middle'>井口</text>";
    /* 套管损伤带 */
    var dmg = 1 - c.cas;
    var dh = (Y1 - Y0) * clamp(dmg, 0.05, 0.9);
    s += "<rect x='" + (X - 8) + "' y='" + (Y0 + 20) + "' width='8' height='" + dh.toFixed(1) + "' fill='#c9613f' opacity='" + (0.25 + dmg * 0.5).toFixed(2) + "'/>";
    s += "<text x='" + (X + 40) + "' y='" + (Y0 + 30) + "' font-size='8.5' fill='#c9613f'>套管损伤段（完好度 " + fmt(c.cas, 2) + "）</text>";
    /* 层位与剩余储量 */
    s += "<rect x='" + (X + 34) + "' y='120' width='120' height='46' rx='3' fill='#efece1' stroke='#e2ded0'/>";
    s += "<text x='" + (X + 46) + "' y='138' font-size='8.5' fill='#4d565b'>老层（已射开）</text>";
    s += "<rect x='" + (X + 46) + "' y='146' width='" + (100 * c.res).toFixed(1) + "' height='10' rx='2' fill='#2f7d6b'/>";
    s += "<text x='" + (X + 46) + "' y='162' font-size='8.5' fill='#2f7d6b'>剩余储量丰度 " + fmt(c.res, 2) + "</text>";
    /* 措施位置 */
    var pos = { pump: 60, acid: 100, perf: 128, frac: 128, side: 168 };
    MEASURES.forEach(function (m) {
      var feasible = RULES.every(function (r) { return r.test(m, c, [m]); });
      var inPick = pick && pick.combo.indexOf(m) >= 0;
      var yy = pos[m.key];
      s += "<circle cx='" + (X + 13) + "' cy='" + yy + "' r='5' fill='" + (inPick ? "#2f7d6b" : (feasible ? "#41699b" : "#d8d2c4")) + "'/>";
      s += "<text x='" + (X + 24) + "' y='" + (yy + 3) + "' font-size='8.5' fill='" + (feasible ? "#242b2e" : "#b0a89a") + "'>" + m.name +
           (feasible ? "" : "（不可行）") + "</text>";
      s += "<text x='" + (X + 190) + "' y='" + (yy + 3) + "' font-size='8.5' fill='#79828a'>" + m.cost + " 万 · " + m.days + " 天</text>";
    });
    /* 侧钻示意 */
    if (c.cas < 0.55) {
      s += "<path d='M" + (X + 13) + " " + (Y1 - 30) + " Q " + (X + 40) + " " + (Y1 - 6) + " " + (X + 120) + " " + (Y1 - 12) + "' fill='none' stroke='#b26a39' stroke-width='2' stroke-dasharray='4 3'/>";
      s += "<text x='" + (X + 130) + "' y='" + (Y1 - 8) + "' font-size='8.5' fill='#b26a39'>侧钻新井眼（套管状况差时的兜底）</text>";
    }
    s += "<text x='14' y='206' font-size='8.5' fill='#79828a'>灰色代表被硬约束剔掉的措施；绿色是本次选中项。</text>";
    el("well").innerHTML = s;
  }

  function drawEcon(list, pick, c) {
    var s = "<rect x='0' y='0' width='720' height='200' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>候选组合：投资上限 " + c.cap + " 万元以内，按三年净现值排序</text>";
    var vis = list.slice(0, 6);
    var maxNpv = Math.max.apply(null, vis.map(function (x) { return Math.abs(x.m.npv); })) + 1e-9;
    var maxCost = Math.max.apply(null, vis.map(function (x) { return x.m.cost; })) + 1e-9;
    var baseY = 168;
    vis.forEach(function (x, i) {
      var bx = 30 + i * 112;
      var hN = 100 * clamp(x.m.npv / maxNpv, -1, 1);
      var isPick = pick && x.combo === pick.combo;
      s += "<rect x='" + bx + "' y='" + (baseY - Math.max(0, hN)).toFixed(1) + "' width='92' height='" + Math.abs(hN).toFixed(1) +
           "' rx='2' fill='" + (isPick ? "#2f7d6b" : (x.m.npv >= 0 ? "#41699b" : "#c9613f")) + "' opacity='" + (isPick ? 0.95 : 0.7) + "'/>";
      s += "<text x='" + (bx + 46) + "' y='184' font-size='8' fill='#4d565b' text-anchor='middle'>" + x.combo.map(function (m) { return m.name.slice(0, 4); }).join("+") + "</text>";
      s += "<text x='" + (bx + 46) + "' y='196' font-size='8' fill='#79828a' text-anchor='middle'>" + fmt(x.m.cost, 0) + " 万 · NPV " + fmt(x.m.npv, 0) + "</text>";
    });
    s += "<line x1='24' y1='" + baseY + "' x2='700' y2='" + baseY + "' stroke='#242b2e'/>";
    s += "<text x='14' y='40' font-size='8.5' fill='#4d565b'>上方＝净现值为正（蓝/绿），下方＝负（红）；条形高度是相对最大值。</text>";
    s += "<text x='14' y='56' font-size='8.5' fill='#c9613f'>评价只到 " + HORIZON + " 个月：有效期短的措施（酸化）长期不占优，但它的回收期常常最短。</text>";
    if (pick) {
      s += "<rect x='430' y='64' width='270' height='90' rx='4' fill='#efece1' stroke='#e2ded0'/>";
      s += "<text x='442' y='82' font-size='9' fill='#242b2e'>推荐组合：" + pick.combo.map(function (m) { return m.name; }).join(" + ") + "</text>";
      s += "<text x='442' y='100' font-size='8.5' fill='#4d565b'>投资 " + fmt(pick.m.cost, 0) + " 万　工期 " + pick.m.days + " 天</text>";
      s += "<text x='442' y='116' font-size='8.5' fill='#4d565b'>三年累计增油 " + fmt(pick.m.inc, 0) + " t　净现值 " + fmt(pick.m.npv, 0) + " 万</text>";
      s += "<text x='442' y='132' font-size='8.5' fill='#2f7d6b'>投资回收期 " + (pick.m.pay > 0 ? pick.m.pay + " 个月" : "期内无法回收") + "</text>";
      s += "<text x='442' y='148' font-size='8.5' fill='#79828a'>技术成功率 " + (pick.m.cred * 100).toFixed(0) + "%（已用历史先验校正）</text>";
    }
    el("econ").innerHTML = s;
  }

  function drawHist(c) {
    var v = [c.cas, c.res, c.dam];
    var scored = HIST.map(function (h) {
      var d2 = 0;
      for (var i = 0; i < 3; i++) d2 += Math.pow((v[i] - h.v[i]), 2);
      return { h: h, sim: Math.exp(-d2 / 0.12) };
    }).sort(function (a, b) { return b.sim - a.sim; });
    var s = "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='18' font-size='11' fill='#242b2e'>图谱检索：同类老井的真实结果，用来修正每条措施的成功率先验</text>";
    scored.slice(0, 4).forEach(function (x, i) {
      var yy = 38 + i * 38;
      s += "<text x='52' y='" + (yy + 4) + "' font-size='9.5' fill='#242b2e'>" + x.h.id + "　" + x.h.combo.map(function (k) {
        var mm = MEASURES.filter(function (z) { return z.key === k; })[0];
        return mm ? mm.name : k;
      }).join(" + ") + "</text>";
      s += "<rect x='250' y='" + (yy - 6) + "' width='300' height='10' rx='2' fill='#efece1'/>";
      s += "<rect x='250' y='" + (yy - 6) + "' width='" + (300 * x.sim).toFixed(1) + "' height='10' rx='2' fill='" + (i === 0 ? "#2f7d6b" : "#b9c6cf") + "'/>";
      s += "<text x='" + (250 + 300 * x.sim + 8).toFixed(1) + "' y='" + (yy + 3) + "' font-size='8.5' fill='#4d565b'>" + (x.sim * 100).toFixed(0) + "%</text>";
      s += "<text x='52' y='" + (yy + 20) + "' font-size='8.5' fill='#4d565b'>实际：" + x.h.note + "</text>";
    });
    s += "<text x='14' y='188' font-size='8.5' fill='#79828a'>失败案例同样入图谱：只记成功会让推荐系统性偏乐观。</text>";
    el("hist").innerHTML = s;
  }

  /* ---------- 4. 主更新 ---------- */
  function update() {
    var c = {
      cas: parseFloat(el("cas").value),
      res: parseFloat(el("res").value),
      dam: parseFloat(el("dam").value),
      price: parseFloat(el("price").value),
      cap: parseFloat(el("cap").value)
    };
    el("out-cas").textContent = fmt(c.cas, 2);
    el("out-res").textContent = fmt(c.res, 2);
    el("out-dam").textContent = fmt(c.dam, 2);
    el("out-oil").textContent = c.price + " 元/桶";
    el("out-cap").textContent = c.cap + " 万元";

    var pool = MEASURES.filter(function (m) {
      return RULES.every(function (r) { return r.test(m, c, [m]); });
    });

    var list = combos(pool).filter(function (cm) {
      return RULES.every(function (r) { return cm.every(function (m) { return r.test(m, c, cm); }); });
    }).map(function (cm) {
      return { combo: cm, m: evaluate(cm, c) };
    }).filter(function (x) { return x.m.cost <= c.cap; })
      .sort(function (a, b) { return b.m.npv - a.m.npv; });

    /* 什么都不做（维持现状）作为对照 */
    var pick = list[0] || null;

    drawWell(c, pick);
    drawEcon(list, pick, c);
    drawHist(c);

    el("ro-plan").textContent = pick ? pick.combo.map(function (m) { return m.name; }).join(" + ") : "无满足投资上限的组合";
    el("ro-inc").textContent = pick ? fmt(pick.m.inc, 0) + " t" : "—";
    el("ro-pay").textContent = pick ? (pick.m.pay > 0 ? pick.m.pay + " 个月" : "期内未回收") : "—";
    el("ro-ps").textContent = pick ? (pick.m.cred * 100).toFixed(0) + "%" : "—";
    el("ro-ps").className = pick && pick.m.cred < 0.5 ? "bad" : "ok";

    var tb = "<caption>候选组合（满足投资上限，按净现值排序，前 5）</caption><tr><th>组合</th><th>投资</th><th>工期</th><th>三年增油</th><th>成功率</th><th>净现值</th></tr>";
    list.slice(0, 5).forEach(function (x, i) {
      tb += "<tr><td class='nm'>" + x.combo.map(function (m) { return m.name; }).join(" + ") + "</td>" +
            "<td>" + fmt(x.m.cost, 0) + " 万</td><td>" + x.m.days + " 天</td><td>" + fmt(x.m.inc, 0) + " t</td>" +
            "<td>" + (x.m.cred * 100).toFixed(0) + "%</td><td" + (i === 0 ? " style='color:#2f7d6b'" : "") + ">" + fmt(x.m.npv, 0) + " 万</td></tr>";
    });
    el("tbl").innerHTML = list.length ? tb : "<caption>当前投资上限下没有可行组合</caption>";

    var blocked = MEASURES.filter(function (m) { return pool.indexOf(m) < 0; });
    var note;
    if (!pick) {
      note = "在 " + c.cap + " 万元上限内没有组合能做到净现值为正。此时正确的输出不是硬凑一个便宜方案，而是<b>把这口井列入观察或报废候选</b>——这也是有价值的结论。";
    } else {
      note = "推荐 <b>" + pick.combo.map(function (m) { return m.name; }).join(" + ") + "</b>：投资 " + fmt(pick.m.cost, 0) +
             " 万、工期 " + pick.m.days + " 天，三年累计增油 <b>" + fmt(pick.m.inc, 0) + " t</b>，" +
             "回收期 <b>" + (pick.m.pay > 0 ? pick.m.pay + " 个月" : "期内未回收") + "</b>，技术成功率 " + (pick.m.cred * 100).toFixed(0) + "%。";
      if (blocked.length) {
        note += " 被剔掉的：" + blocked.map(function (m) { return m.name; }).join("、") + "（不满足井筒条件）。";
      }
      if (pick.m.pay > 18) {
        note += " 回收期超过一年半，若油价下行 20% 则该方案会转负——这类敏感度应随报告一起给出。";
      }
    }
    el("note").innerHTML = note;
  }

  ["cas", "res", "dam", "price", "cap"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  update();
})();
