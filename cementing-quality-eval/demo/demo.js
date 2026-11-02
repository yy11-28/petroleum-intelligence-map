/* =========================================================
   固井质量智能评价与候凝风险预警 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   ① 逐井段（12 段）由施工参数 + 井眼条件推算顶替效率、声幅与地层波响应；
   ② 知识图层：把「声幅 / 地层波 / 顶替排量 / 候凝时间 / 居中度 / 失水量」
      逐条对上四类缺陷的判据，每条附规则编号与历史井次证据，输出分级与置信度；
   ③ 决策层：按「缺陷类型 × 位置重要性」给补救措施排序，并列出排除理由。
   注：为演示而写的降阶模型，不可用于固井质量评定与补救作业决策。
   ========================================================= */
(function () {
  "use strict";

  var NS = 12;   /* 井段数 */

  /* 井段属性（给定）：层位与重要性权重 */
  var ZONES = [
    { nm: "浅层", key: "浅", w: 0.4 }, { nm: "浅层", key: "浅", w: 0.4 },
    { nm: "隔层", key: "隔", w: 0.6 }, { nm: "水层", key: "水", w: 1.0 },
    { nm: "隔层", key: "隔", w: 0.8 }, { nm: "产层", key: "产", w: 1.0 },
    { nm: "产层", key: "产", w: 1.0 }, { nm: "隔层", key: "隔", w: 0.8 },
    { nm: "产层", key: "产", w: 1.0 }, { nm: "隔层", key: "隔", w: 0.7 },
    { nm: "水层", key: "水", w: 0.9 }, { nm: "井底", key: "底", w: 0.5 }
  ];

  var MEAS = [
    { nm: "继续观察", cost: 0, eff: 0, need: ["良好", "微环隙"] },
    { nm: "环空加压（压胶塞）", cost: 8, eff: 0.45, need: ["微环隙"] },
    { nm: "挤水泥（段内）", cost: 35, eff: 0.7, need: ["胶结不良", "窜槽"] },
    { nm: "二次注水泥（段）", cost: 60, eff: 0.85, need: ["胶结不良", "窜槽"] },
    { nm: "下封隔器隔离", cost: 25, eff: 0.6, need: ["胶结不良", "微环隙"] }
  ];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 1. 逐井段响应 ---------- */
  function sections(q, hr, st, wo, fl) {
    var out = [];
    for (var i = 0; i < NS; i++) {
      /* 井段的井径扩大率与居中度在给定值附近有确定性起伏（大肚子段更差） */
      var wob = wo * (0.7 + 0.5 * (i % 3) / 2) + (i === 3 ? 6 : 0);
      var stb = clamp(st * (0.85 + 0.2 * ((i + 1) % 3) / 2) - (i === 8 ? 12 : 0), 20, 100);
      var disp = clamp(0.33 + 0.50 * (q - 0.8) / 2.2 - 0.018 * wob - 0.35 * (1 - stb / 100) -
        0.0008 * (fl - 60), 0.05, 0.95);                 /* 顶替效率 */
      var cure = clamp((hr - 8) / 40, 0, 1);              /* 候凝程度 */
      var cbl = clamp(7 + 82 * (1 - disp) * (1 - 0.35 * cure), 5, 98);   /* 声幅 %（越高越差） */
      var vdl = clamp(0.08 + 0.85 * disp + 0.07 * cure, 0.03, 0.98);     /* 地层波强度 */
      var z = ZONES[i];
      var type = "良好", conf = 0.9;
      if (cbl > 45 && vdl < 0.55) { type = "窜槽"; conf = 0.72; }
      else if (cbl > 45) { type = "胶结不良"; conf = 0.68; }
      else if (cbl > 30 && hr < 36) { type = "微环隙"; conf = 0.6; }
      else if (cbl > 30) { type = "胶结不良"; conf = 0.55; }
      /* 严重度：只在有缺陷时计，并按层位重要性加权（水层/产层最要紧） */
      var sev = type === "良好" ? 0 : clamp((cbl - 28) / 60, 0.06, 1) * z.w;
      out.push({ i: i, zone: z, wob: wob, st: stb, disp: disp, cure: cure, cbl: cbl, vdl: vdl,
        type: type, conf: conf, sev: sev });
    }
    return out;
  }

  /* ---------- 2. 知识图层：判据与证据 ---------- */
  function rulesOf(secs, q, hr, st, wo, fl) {
    var chan = secs.filter(function (s) { return s.type === "窜槽"; });
    var poor = secs.filter(function (s) { return s.type === "胶结不良"; });
    var micro = secs.filter(function (s) { return s.type === "微环隙"; });
    return [
      { nm: "窜槽（泥浆窜槽）", n: chan.length, col: "#c9613f", judge: [
        { k: "声幅偏高", hit: chan.some(function (s) { return s.cbl > 45; }), src: "规则 R3 · 14 井次" },
        { k: "地层波弱", hit: chan.some(function (s) { return s.vdl < 0.55; }), src: "规则 R3 · 变密度解释" },
        { k: "顶替排量偏低", hit: q < 1.6, src: "规则 R5 · 施工记录" },
        { k: "居中度不足", hit: st < 70, src: "规则 R7 · 井径与扶正器" },
        { k: "井径扩大", hit: wo > 15, src: "规则 R8 · 井径曲线" }
      ] },
      { nm: "胶结不良", n: poor.length, col: "#b26a39", judge: [
        { k: "声幅偏高", hit: poor.some(function (s) { return s.cbl > 30; }), src: "规则 R2 · 21 井次" },
        { k: "顶替效率偏低", hit: poor.some(function (s) { return s.disp < 0.45; }), src: "规则 R4 · 顶替模拟" },
        { k: "失水量偏大", hit: fl > 120, src: "规则 R9 · 浆体性能" },
        { k: "候凝时间不足", hit: hr < 24, src: "规则 R6 · 候凝记录" },
        { k: "井径扩大", hit: wo > 15, src: "规则 R8 · 井径曲线" }
      ] },
      { nm: "微环隙", n: micro.length, col: "#b9c6cf", judge: [
        { k: "声幅中等", hit: micro.some(function (s) { return s.cbl > 30 && s.cbl <= 45; }), src: "规则 R10 · 9 井次" },
        { k: "候凝时间短", hit: hr < 36, src: "规则 R10 · 候凝记录" },
        { k: "后期压力变化", hit: hr < 48, src: "规则 R11 · 试压记录" },
        { k: "顶替效率正常", hit: micro.some(function (s) { return s.disp >= 0.45; }) || micro.length === 0, src: "规则 R10 · 反证" },
        { k: "井径正常", hit: wo <= 20, src: "规则 R8 · 井径曲线" }
      ] },
      { nm: "胶结良好", n: secs.filter(function (s) { return s.type === "良好"; }).length, col: "#2f7d6b", judge: [
        { k: "声幅低", hit: secs.some(function (s) { return s.cbl <= 30; }), src: "规则 R1 · 31 井次" },
        { k: "地层波清晰", hit: secs.some(function (s) { return s.vdl >= 0.6; }), src: "规则 R1 · 变密度解释" },
        { k: "顶替排量足够", hit: q >= 1.6, src: "规则 R5 · 施工记录" },
        { k: "居中度足够", hit: st >= 70, src: "规则 R7 · 扶正器记录" },
        { k: "候凝充分", hit: hr >= 36, src: "规则 R6 · 候凝记录" }
      ] }
    ];
  }

  /* ---------- 3. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var secSvg = el("sec"), kgSvg = el("kg"), actSvg = el("act"), note = el("note");
  var IN = ["q", "hr", "st", "wo", "fl"].map(el);

  /* ---------- 4. 井段剖面 ---------- */
  function drawSec(secs) {
    var W = 720, H = 250, top = 26, bot = 218, x0 = 118, x1 = 470;
    var Y = function (i) { return top + i / NS * (bot - top); };
    var X = function (c) { return x0 + c / 100 * (x1 - x0); };
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">逐井段评价：左列为声幅（越高越差），色带为知识图谱给出的分级（含层位重要性）</text>';
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += '<line x1="' + X(v).toFixed(1) + '" y1="' + top + '" x2="' + X(v).toFixed(1) + '" y2="' + bot + '" stroke="#efece1"/>';
      s += '<text x="' + X(v).toFixed(1) + '" y="' + (bot + 14) + '" font-size="9" fill="#9ba3a9" text-anchor="middle" font-family="monospace">' + v + '</text>';
    });
    var col = { "良好": "#2f7d6b", "微环隙": "#b9c6cf", "胶结不良": "#b26a39", "窜槽": "#c9613f" };
    secs.forEach(function (sc, i) {
      var y = Y(i), hh = (bot - top) / NS - 3;
      s += '<rect x="' + (x1 + 12) + '" y="' + y.toFixed(1) + '" width="150" height="' + hh.toFixed(1) +
        '" rx="2" fill="' + col[sc.type] + '" opacity="0.85"/>';
      s += '<text x="' + (x1 + 20) + '" y="' + (y + hh / 2 + 3.5).toFixed(1) + '" font-size="9.5" fill="' +
        (sc.type === "微环隙" ? "#242b2e" : "#fff") + '">' + sc.zone.nm + ' · ' + sc.type + '</text>';
      s += '<line x1="' + x0 + '" y1="' + (y + hh / 2).toFixed(1) + '" x2="' + X(sc.cbl).toFixed(1) + '" y2="' + (y + hh / 2).toFixed(1) +
        '" stroke="' + col[sc.type] + '" stroke-width="1.4" opacity="0.6"/>';
      s += '<circle cx="' + X(sc.cbl).toFixed(1) + '" cy="' + (y + hh / 2).toFixed(1) + '" r="2.6" fill="' + col[sc.type] + '"/>';
      s += '<text x="' + (x0 - 8) + '" y="' + (y + hh / 2 + 3.5).toFixed(1) + '" font-size="8.5" fill="#79828a" text-anchor="end">' +
        (i + 1) + '</text>';
    });
    /* 地层波强度（右侧小条） */
    s += '<text x="640" y="' + (top - 8) + '" font-size="9" fill="#79828a">地层波</text>';
    secs.forEach(function (sc, i) {
      var y = Y(i), hh = (bot - top) / NS - 3;
      s += '<rect x="640" y="' + y.toFixed(1) + '" width="60" height="' + hh.toFixed(1) + '" rx="2" fill="#efece1"/>';
      s += '<rect x="640" y="' + y.toFixed(1) + '" width="' + (sc.vdl * 60).toFixed(1) + '" height="' + hh.toFixed(1) +
        '" rx="2" fill="#41699b" opacity="0.7"/>';
    });
    s += '<text x="14" y="' + (bot + 34) + '" font-size="10" fill="#4d565b">' +
      '同一口井不同井段的结论可以完全不同：分级是逐段给的，整体评价只是这些分段的汇总。</text>';
    s += '<text x="640" y="' + (bot + 14) + '" font-size="9" fill="#9ba3a9">弱 ← → 强</text>';
    secSvg.innerHTML = s;
  }

  /* ---------- 5. 判据—证据图 ---------- */
  function drawKg(rules) {
    var H = 240, top = 44, rowH = 44, x0 = 128, cellW = 106;
    var s = "";
    s += '<text x="14" y="20" font-size="10.5" fill="#79828a">知识图层：缺陷类型 × 判据（实心＝命中，空心＝未命中；下方为证据来源与命中井段数）</text>';
    rules.forEach(function (r, i) {
      var y = top + i * rowH;
      s += '<text x="14" y="' + (y + 22) + '" font-size="10.5" fill="#4d565b">' + r.nm + '</text>';
      s += '<rect x="14" y="' + (y + 26) + '" width="100" height="8" rx="2" fill="#efece1"/>';
      s += '<rect x="14" y="' + (y + 26) + '" width="' + (Math.min(r.n / NS, 1) * 100).toFixed(1) +
        '" height="8" rx="2" fill="' + r.col + '" opacity="0.85"/>';
      s += '<text x="14" y="' + (y + 42) + '" font-size="9" fill="#79828a">' + r.n + ' / ' + NS + ' 段</text>';
      r.judge.forEach(function (j, k) {
        var cx = x0 + k * cellW + 14, cy = y + 16;
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + (j.hit ? r.col : "#fff") +
          '" stroke="' + (j.hit ? r.col : "#d8d2c4") + '" stroke-width="1.2" opacity="' + (j.hit ? 0.9 : 1) + '"/>';
        if (j.hit) s += '<text x="' + cx + '" y="' + (cy + 3.5) + '" font-size="9" fill="#fff" text-anchor="middle">✓</text>';
        s += '<text x="' + (x0 + k * cellW) + '" y="' + (y + 36) + '" font-size="8.5" fill="#4d565b">' + j.k + '</text>';
        s += '<text x="' + (x0 + k * cellW) + '" y="' + (y + 46) + '" font-size="8" fill="#9ba3a9">' + j.src + '</text>';
      });
    });
    kgSvg.innerHTML = s;
  }

  /* ---------- 6. 措施对比（收益—成本） ---------- */
  var UNIT = 30;   /* 单位严重度折算的风险损失（万元），演示取值 */
  function drawAct(secs) {
    var top = 34, x0 = 132, barW = 452, rowH = 34;
    var s = "";
    s += '<text x="14" y="20" font-size="10.5" fill="#79828a">决策层：候选补救措施 · 条长＝预期挽回（万元），深色段＝措施成本，超出段＝投入大于收益 · 灰显＝判据不匹配</text>';
    var rows = MEAS.map(function (m) {
      var cover = 0;
      secs.forEach(function (sc) { if (m.need.indexOf(sc.type) >= 0) cover += sc.sev; });
      var gain = cover * m.eff * UNIT;
      return { m: m, cover: cover, gain: gain, net: gain - m.cost,
        fit: m.nm === "继续观察" || cover > 0 };   /* 「继续观察」是不作为的基准线 */
    });
    var maxv = 1;
    rows.forEach(function (r) {
      if (r.fit) maxv = Math.max(maxv, r.gain, r.m.cost);
    });
    var S = function (v) { return v / maxv * barW; };
    var best = null;
    rows.forEach(function (r) { if (r.fit && (!best || r.net > best.net)) best = r; });
    rows.forEach(function (r, i) {
      var y = top + i * rowH;
      var isPick = best === r;
      s += '<text x="14" y="' + (y + 16) + '" font-size="10.5" fill="' + (r.fit ? "#242b2e" : "#b9c6cf") + '">' + r.m.nm + '</text>';
      s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + barW + '" height="16" rx="3" fill="#efece1"/>';
      if (r.fit) {
        var w = S(r.gain), wc = S(Math.min(r.m.cost, r.gain));
        if (w > 0) {
          s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="16" rx="3" fill="' +
            (isPick ? "#41699b" : "#b9c6cf") + '" opacity="' + (isPick ? 0.9 : 0.85) + '"/>';
        }
        if (wc > 0) {
          s += '<rect x="' + x0 + '" y="' + (y + 4) + '" width="' + wc.toFixed(1) +
            '" height="16" rx="3" fill="#242b2e" opacity="0.32"/>';
        }
        if (r.m.cost > r.gain) {
          s += '<rect x="' + (x0 + w).toFixed(1) + '" y="' + (y + 4) + '" width="' + S(r.m.cost - r.gain).toFixed(1) +
            '" height="16" rx="3" fill="#c9613f" opacity="0.45"/>';
        }
        s += '<text x="' + (x0 + Math.max(w, S(r.m.cost)) + 8).toFixed(1) + '" y="' + (y + 16) +
          '" font-size="9.5" fill="#4d565b">挽回 ' + r.gain.toFixed(0) + ' 万 · 投入 ' + r.m.cost +
          ' 万 · 净 <tspan font-weight="600" fill="' + (r.net >= 0 ? "#2f7d6b" : "#c9613f") + '">' +
          (r.net >= 0 ? "+" : "") + r.net.toFixed(0) + '</tspan></text>';
      } else {
        s += '<text x="' + (x0 + 8) + '" y="' + (y + 16) + '" font-size="9.5" fill="#b9c6cf">不匹配：本井无「' +
          m_need(r.m) + '」类缺陷</text>';
      }
      if (isPick) s += '<text x="' + (x0 - 6) + '" y="' + (y + 16) + '" font-size="10" fill="#41699b" text-anchor="end">★</text>';
    });
    s += '<text x="14" y="' + (top + rows.length * rowH + 16) + '" font-size="10" fill="#4d565b">' +
      '按「覆盖到的严重度 × 措施有效率 × ' + UNIT + ' 万 − 措施投入」排净收益：最严重的井段未必在最深处，' +
      '<b>位置权重会改变结论</b>；净收益为负时，正确结论是<b>不动它</b>。</text>';
    actSvg.innerHTML = s;
    return best;
  }
  function m_need(m) { return m.need.join(" / "); }

  /* ---------- 7. 主流程 ---------- */
  function draw() {
    var q = Number(IN[0].value), hr = Number(IN[1].value), st = Number(IN[2].value),
      wo = Number(IN[3].value), fl = Number(IN[4].value);
    el("out-q").textContent = q.toFixed(1) + " m³/min";
    el("out-hr").textContent = hr + " h";
    el("out-st").textContent = st + " %";
    el("out-wo").textContent = wo + " %";
    el("out-fl").textContent = fl + " mL";

    var secs = sections(q, hr, st, wo, fl);
    var rules = rulesOf(secs, q, hr, st, wo, fl);
    drawSec(secs);
    drawKg(rules);
    var pick = drawAct(secs);

    var bad = secs.filter(function (s) { return s.type !== "良好"; });
    var chan = secs.filter(function (s) { return s.type === "窜槽"; });
    var poor = secs.filter(function (s) { return s.type === "胶结不良"; });
    var micro = secs.filter(function (s) { return s.type === "微环隙"; });
    var sevMax = secs.reduce(function (a, s) { return Math.max(a, s.sev); }, 0);
    var grade = bad.length === 0 ? "整体良好" : (chan.length ? "存在窜槽风险" : (bad.length >= 4 ? "局部缺陷较多" : "局部缺陷"));

    /* 读数 */
    var gEl = el("ro-grade");
    gEl.textContent = bad.length === 0 ? "整体良好" :
      grade + "（严重度 " + (sevMax * 100).toFixed(0) + "）";
    gEl.className = bad.length === 0 ? "ok" : (chan.length ? "bad" : "");
    var bEl = el("ro-bad");
    bEl.textContent = bad.length + " / " + NS + " 段（窜槽 " + chan.length + "）";
    bEl.className = bad.length === 0 ? "ok" : "bad";
    var aEl = el("ro-act");
    aEl.textContent = pick ? (pick.m.cost === 0 ? pick.m.nm + "（不动它）" :
      pick.m.nm + " · 净 +" + pick.net.toFixed(0) + " 万") : "—";
    aEl.className = pick && pick.m.cost === 0 ? "ok" : "";
    var hits = 0, total = 0;
    rules.forEach(function (r) { r.judge.forEach(function (j) { total++; if (j.hit) hits++; }); });
    el("ro-ev").textContent = hits + " / " + total + " 条判据命中";

    /* 解说 */
    var worst = null;
    secs.forEach(function (x) { if (x.type !== "良好" && (!worst || x.sev > worst.sev)) worst = x; });
    var msg = "顶替排量 " + q.toFixed(1) + " m³/min、候凝 " + hr + " h、居中度 " + st + "%、井径扩大 " +
      wo + "%、失水量 " + fl + " mL。逐段评价结果：<b>" + grade + "</b>，问题井段 " + bad.length + " / " + NS +
      " 段（窜槽 " + chan.length + " · 胶结不良 " + poor.length + " · 微环隙 " + micro.length + "）" +
      (worst ? "；最需要处理的第 <b>" + (worst.i + 1) + " 段（" + worst.zone.nm +
        "，声幅 " + worst.cbl.toFixed(0) + "%）</b>，严重度 " + (worst.sev * 100).toFixed(0) + "。" : "。");
    if (chan.length) {
      msg += " 判为<b>窜槽</b>的判据是：声幅偏高且地层波弱（规则 R3，14 井次），" +
        (q < 1.6 ? "同时顶替排量偏低（规则 R5）——<b>两条证据相互印证</b>，置信度才会上来。" :
          "但顶替排量并不低，说明更可能是井眼条件（居中度/井径）造成的局部替空，<b>处置位置要按段定</b>。");
    } else if (bad.length) {
      msg += " 没有形成窜槽，问题集中在胶结不良与微环隙：微环隙这一类<b>常与候凝时间不足或后期压力变化有关</b>" +
        "（规则 R10、R11），不是顶替的问题，处置方式也完全不同。";
    } else {
      msg += " 全部井段判为良好：这时候最有价值的输出是<b>确认没有缺陷</b>，并把这次的施工参数作为同类井的正样本回写。";
    }
    if (pick && pick.m.cost === 0) {
      msg += " 措施排序的结果：<b>继续观察</b>——所有措施的投入都超过了它覆盖到的风险，" +
        "这时候最专业的结论是<b>不动它</b>，而不是挑一个看起来最像的措施做掉。";
    } else if (pick) {
      msg += " 推荐措施：<b>" + pick.m.nm + "</b>（覆盖严重度 " + pick.cover.toFixed(2) + " × 有效率 " +
        (pick.m.eff * 100).toFixed(0) + "% ＝ 挽回 " + pick.gain.toFixed(0) + " 万，投入 " + pick.m.cost +
        " 万，净 +" + pick.net.toFixed(0) + " 万）；被排除的措施与其排除理由同样列在图里——" +
        "<b>知道为什么不做某件事，和知道做什么一样重要</b>。";
    }
    if (hr < 36) {
      msg += " 注意候凝时间只有 " + hr + " h：<b>此时测井本身可能还没到终凝状态</b>，" +
        "把这一版结论当成最终评价会误判——候凝不足是预警项，不是结论。";
    }
    msg += " 注：降阶模型，判据与阈值为演示设定，不可用于固井质量评定与补救作业决策。";
    note.innerHTML = msg;
  }

  IN.forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
