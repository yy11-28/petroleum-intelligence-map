/* =========================================================
   封隔器 / 分层隔离方案智能设计 · 示范脚本（整页模式，沙箱 iframe）
   ---------------------------------------------------------
   一口三层合采井 + 底部水层，中间三个候选坐封隔层：
     ① 按额定压差、额定耐温与可坐封性做可行性剪枝（知识图谱的判据层）；
     ② 把窜层风险拆成「层间驱动 × 残余通道 + 环空窜槽」，逐隔层量化；
     ③ 枚举 层位组合 × 型号组合（125 种），出「成本—风险」帕累托前沿。
   注：这是演示用的降阶模型，不是流固耦合计算结果。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 井身与层位 ---------- */
  var DTOP = 3060, DBOT = 3370;

  var ZONES = [
    { nm: "油层 I", top: 3080, bot: 3140, pay: true, poro: 22, perm: 420, wc: 0.12, pcoef: 1.35 },
    { nm: "隔层 A", top: 3140, bot: 3162, pay: false, thick: 22, qual: 0.85, rock: "致密泥岩" },
    { nm: "油层 II", top: 3162, bot: 3240, pay: true, poro: 19, perm: 260, wc: 0.25, pcoef: 1.28 },
    { nm: "隔层 B", top: 3240, bot: 3256, pay: false, thick: 16, qual: 0.68, rock: "泥质粉砂岩" },
    { nm: "油层 III", top: 3256, bot: 3300, pay: true, poro: 17, perm: 150, wc: 0.45, pcoef: 1.19 },
    { nm: "隔层 C", top: 3300, bot: 3312, pay: false, thick: 12, qual: 0.45, rock: "砂泥互层" },
    { nm: "水层", top: 3312, bot: 3360, pay: true, water: true, poro: 20, perm: 600, wc: 0.88, pcoef: 1.10 }
  ];

  /* 三个候选坐封位置：序号 + 相邻层 + 层间驱动权重 */
  var INTER = [
    { k: 0, nm: "隔层 A", thick: 22, qual: 0.85, rock: "致密泥岩", w: 0.45, pair: "油层 I ↔ II" },
    { k: 1, nm: "隔层 B", thick: 16, qual: 0.68, rock: "泥质粉砂岩", w: 0.70, pair: "油层 II ↔ III" },
    { k: 2, nm: "隔层 C", thick: 12, qual: 0.45, rock: "砂泥互层", w: 1.00, pair: "油层 III ↔ 水层" }
  ];

  /* 封隔器型号库（知识图谱里的规格节点） */
  var TYPES = [
    { nm: "机械压缩式", hp: 35, ht: 150, cost: 1.00, seal: 0.85 },
    { nm: "液压坐封", hp: 52, ht: 175, cost: 1.80, seal: 0.90 },
    { nm: "遇液膨胀式", hp: 28, ht: 120, cost: 1.30, seal: 0.78 },
    { nm: "可取式", hp: 30, ht: 165, cost: 1.45, seal: 0.80 }
  ];

  var SF = 1.25;    /* 额定压差安全系数 */
  var TMARG = 10;   /* 耐温余量 ℃ */

  /* ---------- 1. 模型 ---------- */
  /* 隔层自身封隔能力：质量 × 厚度贡献 */
  function capa(ig) {
    return ig.qual * (0.55 + 0.45 * Math.min(1, ig.thick / 18));
  }

  /* slots: 长度为 3 的数组，元素为型号下标或 null */
  function evaluate(slots, dp, temp, cem) {
    var arr = [], n = 0, cost = 0, viol = [];
    INTER.forEach(function (ig) {
      var cap = capa(ig);
      var drive = ig.w * dp / 18;                 /* 层间驱动 0–1 */
      var r0 = drive * (1 - cap);                 /* 不坐封时的窜流通道 */
      var t = slots[ig.k];
      var eff = 0, ok = true;
      if (t !== null) {
        var ty = TYPES[t];
        var seat = 0.45 + 0.55 * cap;             /* 坐封有效性也受隔层质量影响 */
        eff = ty.seal * seat;
        cost += ty.cost + 0.35;
        n++;
        if (ty.hp < dp * SF) { ok = false; viol.push(ig.nm + " 压差 " + ty.hp + " < " + (dp * SF).toFixed(1)); }
        if (ty.ht < temp + TMARG) { ok = false; viol.push(ig.nm + " 耐温 " + ty.ht + " < " + (temp + TMARG)); }
      }
      arr.push({ ig: ig, t: t, r0: r0, r: r0 * (1 - 0.9 * eff), cap: cap, ok: ok, drive: drive });
    });
    /* 归一化基准：最大层间压差下全部不坐封 */
    var den = 0;
    INTER.forEach(function (ig) { den += ig.w * (1 - capa(ig)); });
    var chan = arr.reduce(function (a, o) { return a + o.r; }, 0) / den;
    var annulus = (1 - cem / 100) / 0.45;         /* 0–1 */
    var risk = Math.max(0, Math.min(1, 0.72 * chan + 0.28 * annulus));
    var feas = arr.every(function (o) { return o.ok; });
    return { arr: arr, risk: risk, cost: cost, n: n, feas: feas, viol: viol, chan: chan, annulus: annulus };
  }

  /* ---------- 2. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var dpIn = el("dp"), tempIn = el("temp"), cemIn = el("cem"), bgIn = el("bg");
  var well = el("well"), pf = el("pf"), note = el("note"), brkSvg = el("brk");
  var tB = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };
  var typeRow = el("typerow"), slotRow = el("slotrow");

  var tyAll;            /* 当前统一的型号下标 */
  var slots = [null, 1, null];   /* 默认：只在隔层 B 放一个液压坐封 */

  /* 型号按钮 */
  var tyBtns = TYPES.map(function (t, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = t.nm + "（" + t.hp + " / " + t.ht + "℃）";
    b.addEventListener("click", function () { tyAll = i; slots = slots.map(function (v) { return v === null ? null : i; }); draw(); });
    typeRow.appendChild(b);
    return b;
  });
  tyAll = 1;

  /* 坐封位置按钮 */
  var slotBtns = INTER.map(function (ig, k) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = ig.nm + " " + ig.thick + "m";
    b.addEventListener("click", function () { slots[k] = slots[k] === null ? tyAll : null; draw(); });
    slotRow.appendChild(b);
    return b;
  });

  /* ---------- 3. 井身绘图 ---------- */
  function drawWell(res) {
    var W = 720, H = 320, ML = 66, MR = 320, XW = 118, WW = 78;
    var TOPY = 14, BOTY = H - 16;
    var Y = function (d) { return TOPY + (d - DTOP) / (DBOT - DTOP) * (BOTY - TOPY); };
    var s = "";

    /* 深度刻度 */
    for (var d = 3100; d <= 3350; d += 50) {
      s += '<line x1="' + (XW - 6) + '" y1="' + Y(d).toFixed(1) + '" x2="' + (XW + WW + 6) + '" y2="' + Y(d).toFixed(1) +
        '" stroke="#efece1"/>';
      s += '<text x="' + (XW - 10) + '" y="' + (Y(d) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" ' +
        'text-anchor="end" font-family="monospace">' + d + '</text>';
    }
    s += '<text x="' + (XW - 10) + '" y="' + (TOPY - 3) + '" font-size="9.5" fill="#4d565b" text-anchor="end">深度 m</text>';

    /* 层位 */
    ZONES.forEach(function (z) {
      var y0 = Y(z.top), y1 = Y(z.bot);
      var fill = z.water ? "#41699b" : (z.pay ? "#2f7d6b" : "#e9e4d8");
      var op = z.water ? 0.55 : (z.pay ? 0.75 : 1);
      s += '<rect x="' + XW + '" y="' + y0.toFixed(1) + '" width="' + WW + '" height="' + (y1 - y0).toFixed(1) +
        '" fill="' + fill + '" opacity="' + op + '"/>';
      s += '<text x="' + (XW + WW + 10) + '" y="' + (y0 + (y1 - y0) / 2 + 4).toFixed(1) + '" font-size="11.5" fill="#242b2e">' + z.nm + '</text>';
      var sub;
      if (z.pay) {
        sub = "φ " + z.poro + "% · k " + z.perm + " mD · 含水 " + (z.wc * 100).toFixed(0) + "% · 压力系数 " + z.pcoef.toFixed(2);
      } else {
        var igz = INTER.filter(function (o) { return o.nm === z.nm; })[0];
        sub = z.thick + " m · " + z.rock + " · 自身封隔能力 " + (capa(igz) * 100).toFixed(0) + "%";
      }
      s += '<text x="' + (XW + WW + 122) + '" y="' + (y0 + (y1 - y0) / 2 + 4).toFixed(1) + '" font-size="10" fill="#79828a">' + sub + '</text>';
    });

    /* 封隔器与窜流通道 */
    res.arr.forEach(function (o) {
      var zTop = 0, zBot = 0;
      if (o.ig.k === 0) { zTop = 3140; zBot = 3162; }
      if (o.ig.k === 1) { zTop = 3240; zBot = 3256; }
      if (o.ig.k === 2) { zTop = 3300; zBot = 3312; }
      var ym = (Y(zTop) + Y(zBot)) / 2;
      if (o.t !== null) {
        var col = o.ok ? "#242b2e" : "#c9613f";
        /* 封隔器双三角 */
        s += '<path d="M' + (XW + 6) + ' ' + (ym - 7) + ' L' + (XW + WW - 6) + ' ' + (ym - 7) +
          ' L' + (XW + WW - 6) + ' ' + ym.toFixed(1) + ' L' + (XW + 6) + ' ' + ym.toFixed(1) + ' Z" fill="' + col + '" opacity=".85"/>';
        s += '<path d="M' + (XW + 6) + ' ' + ym.toFixed(1) + ' L' + (XW + WW - 6) + ' ' + ym.toFixed(1) +
          ' L' + (XW + WW - 6) + ' ' + (ym + 7) + ' L' + (XW + 6) + ' ' + (ym + 7) + ' Z" fill="' + col + '" opacity=".85"/>';
        s += '<text x="' + (XW + WW + 10) + '" y="' + (ym + 4).toFixed(1) + '" font-size="10.5" fill="' + col + '">' +
          TYPES[o.t].nm + (o.ok ? "" : "（校核不过）") + '</text>';
      } else {
        /* 未坐封：画窜流箭头，粗细/透明度随残余风险 */
        var wv = Math.min(1, o.r / Math.max(0.02, res.chan + 1e-9) * 0.6 + o.r * 2.2);
        var opa = 0.25 + 0.65 * Math.min(1, o.r * 3.2);
        s += '<path d="M' + (XW - 34) + ' ' + (ym - 2) + ' Q' + (XW + WW / 2) + ' ' + (ym - 20) + ' ' + (XW + WW + 34) + ' ' + (ym - 2) +
          '" fill="none" stroke="#c9613f" stroke-width="' + (1 + wv * 2.2).toFixed(1) + '" opacity="' + opa.toFixed(2) + '" marker-end="url(#ar)"/>';
        s += '<text x="' + (XW + WW + 10) + '" y="' + (ym + 4).toFixed(1) + '" font-size="10.5" fill="#c9613f">' +
          '未隔离 · 窜 ' + (o.r * 100).toFixed(1) + '</text>';
      }
    });
    /* 箭头 marker */
    s = '<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">' +
      '<path d="M0 0 L6 3 L0 6 Z" fill="#c9613f"/></marker></defs>' + s;
    well.innerHTML = s;
  }

  /* ---------- 4. 前沿绘图 ---------- */
  function drawPareto(cands, best, curPt, budget) {
    var W = 720, H = 250, ML = 52, MR = 16, MT = 16, MB = 34;
    var x0 = 1e9, x1 = -1e9, y0 = 0, y1 = 1;
    cands.forEach(function (p) { x0 = Math.min(x0, p.cost); x1 = Math.max(x1, p.cost); });
    if (curPt) { x0 = Math.min(x0, curPt.cost); x1 = Math.max(x1, curPt.cost); }
    var px = (x1 - x0) * 0.06 || 0.2;
    x0 -= px; x1 += px;
    var X = function (v) { return ML + (v - x0) / (x1 - x0) * (W - ML - MR); };
    var Y = function (v) { return MT + (1 - v) * (H - MT - MB); };

    var s = "";
    [0, 0.5, 1].forEach(function (f) {
      s += '<line x1="' + ML + '" y1="' + Y(f).toFixed(1) + '" x2="' + (W - MR) + '" y2="' + Y(f).toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (ML - 7) + '" y="' + (Y(f) + 3).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" ' +
        'font-family="monospace">' + (f * 100).toFixed(0) + '</text>';
    });
    s += '<line x1="' + X(budget).toFixed(1) + '" y1="' + MT + '" x2="' + X(budget).toFixed(1) + '" y2="' + (H - MB) +
      '" stroke="#c9613f" stroke-width="1" stroke-dasharray="4 3"/>';
    s += '<text x="' + (X(budget) - 5).toFixed(1) + '" y="' + (MT + 10) + '" font-size="9.5" fill="#c9613f" text-anchor="end">预算上限</text>';

    cands.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.risk).toFixed(1) + '" r="2.2" fill="#b9c6cf" opacity=".75"/>';
    });
    /* 非支配前沿（成本与风险都取最小） */
    var front = cands.filter(function (p) {
      return !cands.some(function (q) {
        return q !== p && q.cost <= p.cost + 1e-9 && q.risk <= p.risk - 1e-9 &&
          (q.cost < p.cost - 1e-9 || q.risk < p.risk - 1e-9);
      });
    }).sort(function (a, b) { return a.cost - b.cost; });
    var d = "";
    front.forEach(function (p, i) { d += (i ? "L" : "M") + X(p.cost).toFixed(1) + " " + Y(p.risk).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="#41699b" stroke-width="1.5" stroke-linejoin="round"/>';
    front.forEach(function (p) {
      s += '<circle cx="' + X(p.cost).toFixed(1) + '" cy="' + Y(p.risk).toFixed(1) + '" r="2.8" fill="#41699b"/>';
    });
    if (curPt) {
      s += '<rect x="' + (X(curPt.cost) - 4).toFixed(1) + '" y="' + (Y(curPt.risk) - 4).toFixed(1) +
        '" width="8" height="8" fill="#242b2e"/>';
      s += '<text x="' + (X(curPt.cost) + 9).toFixed(1) + '" y="' + (Y(curPt.risk) + 14).toFixed(1) +
        '" font-size="10" fill="#242b2e">当前</text>';
    }
    if (best) {
      s += '<circle cx="' + X(best.cost).toFixed(1) + '" cy="' + Y(best.risk).toFixed(1) + '" r="5" fill="none" ' +
        'stroke="#2f7d6b" stroke-width="1.6"/>';
      s += '<text x="' + (X(best.cost) + 8).toFixed(1) + '" y="' + (Y(best.risk) - 6).toFixed(1) +
        '" font-size="10" fill="#2f7d6b">最优 风险 ' + (best.risk * 100).toFixed(0) + '</text>';
    }
    s += '<text x="' + (W - MR) + '" y="' + (H - 8) + '" font-size="9.5" fill="#4d565b" text-anchor="end">相对成本 →</text>';
    s += '<text x="' + (ML - 7) + '" y="' + (MT - 4) + '" font-size="9.5" fill="#4d565b" text-anchor="end">↑ 窜层风险</text>';
    pf.innerHTML = s;
  }

  /* ---------- 风险构成分解 + 型号额定校核 ---------- */
  function drawBreak(res, dp, temp) {
    var base = evaluate([null, null, null], dp, temp, Number(cemIn.value));
    var den = 0;
    INTER.forEach(function (ig) { den += ig.w * (1 - capa(ig)); });
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">风险是怎么加出来的：三条层间通道 + 一条环空底噪；对比「不坐封」与「当前方案」</text>';
    var cols = ["#41699b", "#2f7d6b", "#b26a39", "#c9613f"];
    var rows = [
      { nm: "不坐封（全井合采）", o: base },
      { nm: "当前方案", o: res }
    ];
    var x0 = 168, x1 = 452, top = 34, rh = 40;
    rows.forEach(function (row, i) {
      var y = top + i * rh;
      var parts = row.o.arr.map(function (o, k) { return 0.72 * o.r / den; });
      parts.push(0.28 * row.o.annulus);
      var tot = parts.reduce(function (a, v) { return a + v; }, 0);
      s += '<text x="14" y="' + (y + 16) + '" font-size="10" fill="#4d565b">' + row.nm + '</text>';
      s += '<rect x="' + x0 + '" y="' + y + '" width="' + (x1 - x0) + '" height="24" rx="3" fill="#efece1"/>';
      var cx = x0;
      parts.forEach(function (v, k) {
        var w = v / Math.max(tot, 1e-6) * (x1 - x0) * Math.min(1, tot);
        s += '<rect x="' + cx.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, w).toFixed(1) +
          '" height="24" fill="' + cols[k] + '" opacity="' + (k === 3 ? 0.85 : 0.8) + '"/>';
        if (w > 34) {
          s += '<text x="' + (cx + w / 2).toFixed(1) + '" y="' + (y + 16) + '" font-size="9" fill="#fff" text-anchor="middle">' +
            (v * 100).toFixed(0) + '</text>';
        }
        cx += w;
      });
      s += '<text x="' + (x1 + 8) + '" y="' + (y + 16) + '" font-size="10" fill="#242b2e" font-family="monospace">合计 ' +
        (tot * 100).toFixed(0) + ' / 100</text>';
    });
    s += '<text x="14" y="' + (top + 2 * rh + 20) + '" font-size="9" fill="#79828a">■ 隔层 A　■ 隔层 B　■ 隔层 C　■ 环空窜槽（固井质量决定，选型压不下去）</text>';
    /* 型号校核 */
    var bx = 470, by = 34;
    s += '<line x1="' + (bx - 8) + '" y1="26" x2="' + (bx - 8) + '" y2="' + (top + 2 * rh) + '" stroke="#e2ded0"/>';
    s += '<text x="' + bx + '" y="' + (by - 8) + '" font-size="10" fill="#4d565b">型号额定校核（需求：压差 ' +
      (dp * SF).toFixed(1) + " / 耐温 " + (temp + TMARG) + ' ℃）</text>';
    TYPES.forEach(function (t, i) {
      var y = by + i * 24;
      var okP = t.hp >= dp * SF, okT = t.ht >= temp + TMARG;
      var ok = okP && okT;
      s += '<text x="' + bx + '" y="' + (y + 12) + '" font-size="9" fill="' + (ok ? "#242b2e" : "#b9c6cf") + '">' + t.nm + '</text>';
      s += '<rect x="' + (bx + 82) + '" y="' + (y + 3) + '" width="60" height="12" rx="2" fill="#efece1"/>';
      s += '<rect x="' + (bx + 82) + '" y="' + (y + 3) + '" width="' + Math.min(60, t.hp / (18 * SF) * 60).toFixed(1) +
        '" height="12" rx="2" fill="' + (okP ? "#41699b" : "#c9613f") + '" opacity="0.8"/>';
      s += '<text x="' + (bx + 148) + '" y="' + (y + 13) + '" font-size="8.5" fill="' + (okP ? "#4d565b" : "#c9613f") + '">' +
        (okP ? "压差 ✓" : "压差 ✗") + '</text>';
      s += '<rect x="' + (bx + 186) + '" y="' + (y + 3) + '" width="34" height="12" rx="2" fill="' +
        (okT ? "#2f7d6b" : "#c9613f") + '" opacity="0.8"/>';
      s += '<text x="' + (bx + 224) + '" y="' + (y + 13) + '" font-size="8.5" fill="' + (okT ? "#4d565b" : "#c9613f") + '">' +
        (okT ? "耐温 ✓" : "耐温 ✗") + '</text>';
    });
    s += '<text x="' + bx + '" y="' + (by + TYPES.length * 24 + 14) + '" font-size="9" fill="#79828a">' + tB("校核不过的型号不进候选集") +
      '——先剪枝再寻优</text>';
    s += '<text x="14" y="196" font-size="10" fill="#4d565b">环空那一段是<tspan font-weight="600">底噪</tspan>：固井质量 82% 就已经把风险抬到不可压缩的水平，' +
      tB("再多封隔器也压不下去") + '。</text>';
    brkSvg.innerHTML = s;
  }

  /* ---------- 5. 主流程 ---------- */
  function draw() {
    var dp = Number(dpIn.value), temp = Number(tempIn.value), cem = Number(cemIn.value), budget = Number(bgIn.value);
    el("out-dp").textContent = dp + " MPa";
    el("out-temp").textContent = temp + " ℃";
    el("out-cem").textContent = cem + " %";
    el("out-bg").textContent = budget.toFixed(1);

    tyBtns.forEach(function (b, i) { b.className = i === tyAll ? "on" : ""; });
    slotBtns.forEach(function (b, k) { b.className = slots[k] !== null ? "on" : ""; });

    var res = evaluate(slots, dp, temp, cem);
    drawWell(res);

    /* 枚举全部层位组合 × 型号组合 */
    var cands = [], best = null;
    for (var mask = 0; mask < 8; mask++) {
      var which = [];
      INTER.forEach(function (ig) { if (mask & (1 << ig.k)) which.push(ig.k); });
      var n = which.length;
      var combos = n === 0 ? [[]] : [];
      /* 型号组合（笛卡尔积） */
      (function () {
        var acc = [[]];
        for (var i = 0; i < n; i++) {
          var nx = [];
          acc.forEach(function (pre) {
            TYPES.forEach(function (t, ti) { nx.push(pre.concat([ti])); });
          });
          acc = nx;
        }
        combos = acc;
      })();
      combos.forEach(function (tpick) {
        var s2 = [null, null, null];
        which.forEach(function (k, i) { s2[k] = tpick[i]; });
        var r = evaluate(s2, dp, temp, cem);
        if (!r.feas) return;
        var p = { slots: s2, cost: r.cost, risk: r.risk, n: r.n, desc: descOf(s2) };
        cands.push(p);
        if (r.cost <= budget + 1e-9) {
          if (!best || r.risk < best.risk - 1e-9 || (Math.abs(r.risk - best.risk) <= 1e-9 && r.cost < best.cost)) {
            best = p;
          }
        }
      });
    }
    drawPareto(cands, best, { cost: res.cost, risk: res.risk }, budget);
    drawBreak(res, dp, temp);

    /* 读数 */
    var rEl = el("ro-risk");
    rEl.textContent = (res.risk * 100).toFixed(0) + " / 100";
    rEl.className = res.risk < 0.35 ? "ok" : (res.risk < 0.6 ? "" : "bad");
    el("ro-cur").textContent = res.n + " 处坐封 · " + (res.n ? TYPES[tyAll].nm : "无");
    var cEl = el("ro-chk");
    cEl.textContent = res.feas
      ? "压差 " + (dp * SF).toFixed(1) + " / 耐温 " + (temp + TMARG) + " ℃ 通过"
      : res.viol[0] + " 不满足";
    cEl.className = res.feas ? "ok" : "bad";
    var drop = best ? (res.risk - best.risk) * 100 : 0;
    var bEl = el("ro-best");
    bEl.textContent = best
      ? (best.risk * 100).toFixed(0) + (drop > 0.4 ? "（−" + drop.toFixed(0) + "）" : "（无更优）")
      : "预算内无可行方案";
    bEl.className = drop > 5 ? "ok" : "";

    /* 解说 */
    var worst = null;
    res.arr.forEach(function (o) { if (!worst || o.r > worst.r) worst = o; });
    var msg = "当前方案：" + (res.n === 0 ? "不坐封（全井合采）" : res.n + " 处坐封，位于 " +
      res.arr.filter(function (o) { return o.t !== null; }).map(function (o) { return o.ig.nm; }).join("、") +
      "，统一用 " + TYPES[tyAll].nm) + "，窜层风险 <b>" + (res.risk * 100).toFixed(0) + " / 100</b>。";
    msg += " 风险由两部分构成：<b>层间通道</b>贡献 " + (0.72 * res.chan * 100).toFixed(0) +
      "，<b>环空窜槽</b>贡献 " + (0.28 * res.annulus * 100).toFixed(0) +
      "——固井质量 " + cem + "% 就把风险底噪抬到了这部分，再多封隔器也压不下去。";
    if (worst && worst.t === null) {
      msg += " 最大的一条通道是 <b>" + worst.ig.pair + "</b>（" + worst.ig.nm + "，自身封隔能力仅 " +
        (worst.cap * 100).toFixed(0) + "%）：在这里坐封是收益最大的一步。";
    }
    if (!res.feas) {
      msg += " <b>当前型号校核不过</b>：" + res.viol.join("；") + "。这一步正是图谱要提前拦住的——" +
        "不是算完风险再说能不能用，而是先把不合法的型号剪掉。";
    }
    if (best) {
      msg += " 预算内的最优是 <b>" + best.desc + "</b>（成本 " + best.cost.toFixed(2) + "，风险 <b>" +
        (best.risk * 100).toFixed(0) + "</b>）";
      if (drop > 0.4) {
        msg += "，比当前低 " + drop.toFixed(0) + " 个点。";
        if (drop < 3) msg += " 再往下走已经收不住了：剩下的风险大部分来自环空——那是固井的事，不是选型的错。";
      } else {
        msg += "，但已经压不过当前方案——<b>在这一组工况下没有任何合法的选择比现状更好</b>，" +
          "要么调整约束（提高固井质量、降低层间压差），要么接受这个风险水平。这种情况本身就是要报告的结果。";
      }
    } else {
      msg += " 当前预算 <b>" + budget.toFixed(1) + "</b> 下没有任何合法方案：至少要放宽到能容纳一个够用的型号。";
    }
    msg += " 注：这是演示用的降阶模型，风险指数只反映各项判据的合成方式，不可作为窜层的定量判据。";
    note.innerHTML = msg;
  }

  function descOf(s2) {
    var parts = s2.map(function (t, k) { return t === null ? null : INTER[k].nm + " 放 " + TYPES[t].nm; })
      .filter(function (v) { return v; });
    return parts.length ? parts.join(" + ") : "不坐封";
  }

  [dpIn, tempIn, cemIn, bgIn].forEach(function (n) { n.addEventListener("input", draw); });
  draw();
})();
