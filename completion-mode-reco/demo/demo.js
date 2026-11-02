/* =========================================================
   完井方式智能优选 · 示范脚本（整页模式，运行在沙箱 iframe 里）
   ---------------------------------------------------------
   合成 32 口邻井的「储层特征—完井方式—产能表现」，
   按加权高斯核相似度检索最像的 K 口井，用加权票数给四种
   完井方式排序，并把参与投票的证据井列出来。
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 候选方式与权重 ---------- */
  var MODES = [
    { name: "裸眼完井", color: "#41699b" },
    { name: "射孔完井", color: "#2f7d6b" },
    { name: "筛管完井", color: "#b26a39" },
    { name: "砾石充填", color: "#7a5aa0" }
  ];
  var WSAND = 0.34, WDW = 0.28, WPERM = 0.24, WH = 0.14;
  var SIGMA = 0.22;                 /* 相似度带宽 */
  var DW_R = 40, PERM_R = 1.7, H_R = 30;   /* 归一化尺度 */

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261023);

  /* 现场经验的简化版规则：给出砂倾向与距底水距离，定一个「合理做法」 */
  function idealMode(sand, dw) {
    if (sand < 0.30 && dw > 24) return 0;   /* 不出砂且远离水 → 裸眼 */
    if (sand < 0.36) return 1;              /* 不出砂但要控水/分段 → 射孔 */
    if (sand < 0.62) return 2;              /* 中等出砂 → 筛管 */
    return 3;                               /* 严重出砂 → 砾石充填 */
  }

  /* 投产 12 个月比采油指数：地质越好越高，方式选错打七折 */
  function productivity(c) {
    var base = 0.45 * Math.min(1, Math.log10(c.perm) / 3.1) +
               0.25 * Math.min(1, c.h / 24) +
               0.30 * (c.mode === idealMode(c.sand, c.dw) ? 1 : 0.55);
    return base * (0.88 + 0.24 * rnd());
  }

  /* ---------- 1. 合成邻井案例库 ---------- */
  var cases = [];
  (function build() {
    for (var i = 0; i < 32; i++) {
      var rec = {
        id: "N" + ("0" + (i + 1)).slice(-2),
        sand: Math.round((0.05 + rnd() * 0.9) * 100) / 100,
        dw: Math.round((2 + rnd() * 36) * 10) / 10,
        perm: Math.round(Math.pow(10, 1.4 + rnd() * 1.7)),
        h: Math.round((4 + rnd() * 26) * 10) / 10
      };
      rec.mode = idealMode(rec.sand, rec.dw);
      rec.pi = productivity(rec);
      cases.push(rec);
    }
  })();

  /* ---------- 2. 加权相似度 ---------- */
  function sim(q, c) {
    var ds = q.sand - c.sand;
    var dd = (q.dw - c.dw) / DW_R;
    var dp = (Math.log10(q.perm) - Math.log10(c.perm)) / PERM_R;
    var dh = (q.h - c.h) / H_R;
    var d2 = WSAND * ds * ds + WDW * dd * dd + WPERM * dp * dp + WH * dh * dh;
    return Math.exp(-d2 / (2 * SIGMA * SIGMA));
  }

  /* ---------- 3. DOM ---------- */
  var el = function (id) { return document.getElementById(id); };
  var sandIn = el("sand"), dwIn = el("dw"), permIn = el("perm"), hIn = el("thick"), kIn = el("kval");
  var outPerm = el("out-perm"), note = el("note"), barsSvg = el("bars"), tbl = el("topk");
  var distSvg = el("dist"), featSvg = el("feat");

  /* 滑杆 0–100 → 20 … 1590 mD（对数刻度） */
  function sliderPerm() {
    return Math.round(Math.pow(10, 1.3 + Number(permIn.value) / 100 * 1.9));
  }

  var W = 720, H = 200, L = 86, R = 74, T = 14, B = 10;
  var barMax = W - L - R;

  var t = function (str) { return "<tspan font-weight='600'>" + str + "</tspan>"; };

  /* ---------- 相似度排序分布：K 到底切在哪里 ---------- */
  function drawDist(scored, K) {
    var x0 = 42, x1 = 682, base = 148, hh = 116;
    var n = scored.length, bw = (x1 - x0) / n;
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">32 口邻井按相似度排序：实色＝进入票池的前 K 口，灰色＝被排除；红色虚线是「还算像」的下限（35%）</text>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = base - v * hh;
      s += '<line x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + x1 + '" y2="' + y.toFixed(1) + '" stroke="#efece1"/>';
      s += '<text x="' + (x0 - 6) + '" y="' + (y + 3.5).toFixed(1) + '" font-size="9" fill="#9ba3a9" text-anchor="end" font-family="monospace">' + (v * 100).toFixed(0) + '%</text>';
    });
    scored.forEach(function (x, i) {
      var h = Math.max(1, x.s * hh), inK = i < K;
      s += '<rect x="' + (x0 + i * bw).toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + (bw - 2).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + MODES[x.c.mode].color + '" opacity="' + (inK ? 0.9 : 0.22) + '"/>';
    });
    var xk = x0 + K * bw;
    s += '<line x1="' + xk.toFixed(1) + '" y1="28" x2="' + xk.toFixed(1) + '" y2="' + base + '" stroke="#242b2e" stroke-dasharray="4 3"/>';
    s += '<text x="' + (xk + 5).toFixed(1) + '" y="40" font-size="9.5" fill="#242b2e">K = ' + K + '</text>';
    var yq = base - 0.35 * hh;
    s += '<line x1="' + x0 + '" y1="' + yq.toFixed(1) + '" x2="' + x1 + '" y2="' + yq.toFixed(1) + '" stroke="#c9613f" stroke-dasharray="5 3"/>';
    s += '<text x="' + (x1 - 4) + '" y="' + (yq - 5).toFixed(1) + '" font-size="9" fill="#c9613f" text-anchor="end">35% 像的下限</text>';
    s += '<line x1="' + x0 + '" y1="' + base + '" x2="' + x1 + '" y2="' + base + '" stroke="#242b2e"/>';
    s += '<text x="14" y="168" font-size="10" fill="#4d565b">在 K 处高度' + t("断崖式下跌") + '，说明前 K 口本来就是自然的一组；</text>';
    s += '<text x="14" y="183" font-size="10" fill="#4d565b">如果是' + t("平缓滑落") + '，第 K 口与第 K+1 口其实差不多，K 取多少都会带上一点偶然性。</text>';
    distSvg.innerHTML = s;
  }

  /* ---------- 特征画像：到底像在哪里 ---------- */
  function drawFeat(topK, q, K) {
    var x0 = 132, x1 = 556, rowH = 38, top = 42;
    var F = [
      { nm: "出砂指数", w: WSAND, v: q.sand / 1, fmt: function (c) { return c.sand.toFixed(2); }, qv: q.sand.toFixed(2) },
      { nm: "距底水距离", w: WDW, v: q.dw / DW_R, fmt: function (c) { return c.dw.toFixed(1); }, qv: q.dw.toFixed(1) },
      { nm: "渗透率（对数）", w: WPERM, v: (Math.log10(q.perm) - 1.3) / 1.9, fmt: function (c) { return c.perm + " mD"; }, qv: q.perm + " mD" },
      { nm: "储层厚度", w: WH, v: q.h / H_R, fmt: function (c) { return c.h.toFixed(1); }, qv: q.h.toFixed(1) }
    ];
    var nv = [
      function (c) { return c.sand; },
      function (c) { return c.dw / DW_R; },
      function (c) { return (Math.log10(c.perm) - 1.3) / 1.9; },
      function (c) { return c.h / H_R; }
    ];
    var s = "";
    s += '<text x="14" y="18" font-size="10.5" fill="#79828a">最近 ' + K + ' 口井与待钻井在四个特征上的位置：灰色带是邻井的分布范围，圆点是加权均值，竖线是待钻井</text>';
    s += '<text x="14" y="34" font-size="9.5" fill="#9ba3a9">横向为归一化刻度（0 → 1），右侧是该特征在相似度里的权重</text>';
    var sumW = topK.reduce(function (a, x) { return a + x.s; }, 0) || 1;
    F.forEach(function (f, i) {
      var y = top + i * rowH;
      var lo = 1, hi = 0, acc = 0;
      topK.forEach(function (x) {
        var v = nv[i](x.c);
        if (v < lo) lo = v; if (v > hi) hi = v;
        acc += v * x.s;
      });
      var avg = acc / sumW;
      var X = function (v) { return x0 + Math.max(0, Math.min(1, v)) * (x1 - x0); };
      s += '<text x="' + (x0 - 10) + '" y="' + (y + 12) + '" font-size="10.5" fill="#4d565b" text-anchor="end">' + f.nm + '</text>';
      s += '<rect x="' + x0 + '" y="' + (y + 2) + '" width="' + (x1 - x0) + '" height="14" rx="3" fill="#efece1"/>';
      s += '<rect x="' + X(lo).toFixed(1) + '" y="' + (y + 2) + '" width="' + Math.max(2, (X(hi) - X(lo))).toFixed(1) +
        '" height="14" rx="3" fill="#b9c6cf" opacity="0.75"/>';
      s += '<circle cx="' + X(avg).toFixed(1) + '" cy="' + (y + 9) + '" r="4" fill="#41699b" opacity="0.85"/>';
      s += '<line x1="' + X(f.v).toFixed(1) + '" y1="' + (y - 2) + '" x2="' + X(f.v).toFixed(1) + '" y2="' + (y + 20) +
        '" stroke="#242b2e" stroke-width="1.6"/>';
      var dx = X(f.v) > x1 - 90 ? -8 : 8, an = X(f.v) > x1 - 90 ? "end" : "start";
      s += '<text x="' + (X(f.v) + dx).toFixed(1) + '" y="' + (y + 30) + '" font-size="9" fill="#242b2e" text-anchor="' + an + '">本井 ' + f.qv + '</text>';
      /* 权重条 */
      s += '<text x="' + (x1 + 14) + '" y="' + (y + 12) + '" font-size="9" fill="#79828a">权重</text>';
      s += '<rect x="' + (x1 + 46) + '" y="' + (y + 3) + '" width="94" height="12" rx="2" fill="#efece1"/>';
      s += '<rect x="' + (x1 + 46) + '" y="' + (y + 3) + '" width="' + (f.w / 0.4 * 94).toFixed(1) +
        '" height="12" rx="2" fill="#41699b" opacity="0.8"/>';
      s += '<text x="' + (x1 + 144) + '" y="' + (y + 12) + '" font-size="9" fill="#4d565b" font-family="monospace">' +
        (f.w * 100).toFixed(0) + '%</text>';
    });
    s += '<text x="14" y="194" font-size="10" fill="#4d565b">竖线落在灰带' + t("中段") + '才算真的像；落在' + t("边缘或带外") +
      '，即便总相似度不低，也是被其它特征「拉」进来的。</text>';
    featSvg.innerHTML = s;
  }

  function draw() {
    var q = {
      sand: Number(sandIn.value),
      dw: Number(dwIn.value),
      perm: sliderPerm(),
      h: Number(hIn.value)
    };
    var K = Number(kIn.value);

    el("out-sand").textContent = q.sand.toFixed(2);
    el("out-dw").textContent = q.dw.toFixed(1) + " m";
    outPerm.textContent = q.perm + " mD";
    el("out-h").textContent = q.h.toFixed(1) + " m";
    el("out-k").textContent = K;

    /* 检索 */
    var scored = cases.map(function (c) { return { c: c, s: sim(q, c) }; })
      .sort(function (a, b) { return b.s - a.s; });
    var topK = scored.slice(0, K);

    /* 加权投票 */
    var votes = [0, 0, 0, 0], sumW = 0, cnt = [0, 0, 0, 0];
    topK.forEach(function (x) {
      votes[x.c.mode] += x.s;
      cnt[x.c.mode] += 1;
      sumW += x.s;
    });
    var prob = votes.map(function (v) { return sumW > 0 ? v / sumW : 0; });
    var order = [0, 1, 2, 3].sort(function (a, b) { return prob[b] - prob[a]; });
    var win = order[0], second = order[1];

    /* ---------- 排序条形图 ---------- */
    var BH = 26, GAP = 14, top = T;
    var s = '<text x="' + (L - 8) + '" y="' + (top - 2) + '" font-size="9.5" fill="#9ba3a9" ' +
      'text-anchor="end" font-family="monospace">候选方式</text>';
    order.forEach(function (m, i) {
      var y = top + i * (BH + GAP);
      var w = Math.max(1.5, prob[m] * barMax);
      s += '<text x="' + (L - 8) + '" y="' + (y + BH / 2 + 4) + '" font-size="12" fill="#242b2e" text-anchor="end">' +
        MODES[m].name + '</text>';
      s += '<rect x="' + L + '" y="' + y + '" width="' + barMax + '" height="' + BH + '" fill="#f7f5ef"/>';
      s += '<rect x="' + L + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + BH +
        '" fill="' + MODES[m].color + '" opacity="' + (i === 0 ? 0.95 : 0.55) + '" rx="2"/>';
      s += '<text x="' + (L + w + 8) + '" y="' + (y + BH / 2 + 4) + '" font-size="12" fill="#4d565b" ' +
        'font-family="monospace">' + (prob[m] * 100).toFixed(0) + '%</text>';
      if (i === 0) {
        s += '<rect x="' + (W - R + 12) + '" y="' + (y + BH / 2 - 8) + '" width="46" height="16" rx="8" fill="#e6f1ec"/>';
        s += '<text x="' + (W - R + 35) + '" y="' + (y + BH / 2 + 4) + '" font-size="10" fill="#2f7d6b" ' +
          'text-anchor="middle">推荐</text>';
      }
    });
    /* 最远邻的相似度作为「样本是否充足」的直观提示 */
    var far = topK.length ? topK[topK.length - 1].s : 0;
    s += '<text x="' + (L - 8) + '" y="' + (H - 2) + '" font-size="9.5" fill="#9ba3a9" text-anchor="end" ' +
      'font-family="monospace">第 ' + K + ' 近邻相似度 ' + (far * 100).toFixed(0) + '%</text>';
    barsSvg.innerHTML = s;

    /* ---------- 读数 ---------- */
    el("ro-mode").textContent = MODES[win].name;
    var confEl = el("ro-conf");
    confEl.textContent = (prob[win] * 100).toFixed(0) + "%";
    confEl.className = prob[win] >= 0.5 ? "ok" : "bad";
    el("ro-vote").textContent = cnt[win] + " / " + K + " 口";
    el("ro-next").textContent = MODES[second].name + " " + (prob[second] * 100).toFixed(0) + "%";

    drawDist(scored, K);
    drawFeat(topK, q, K);

    /* ---------- 证据表 ---------- */
    var rows = topK.slice(0, 6).map(function (x) {
      var c = x.c;
      return "<tr><td class='nm'>" + c.id + "</td><td>" + c.sand.toFixed(2) + "</td><td>" +
        c.dw.toFixed(1) + "</td><td>" + c.perm + "</td><td>" + c.h.toFixed(1) + "</td>" +
        "<td class='nm'><span class='dot' style='background:" + MODES[c.mode].color + "'></span>" +
        MODES[c.mode].name + "</td><td>" + c.pi.toFixed(2) + "</td><td>" +
        (x.s * 100).toFixed(0) + "%</td></tr>";
    }).join("");
    tbl.innerHTML =
      "<caption>参与投票的最近 " + Math.min(6, topK.length) + " 口证据井（共检索 " + K + " 口）</caption>" +
      "<tr><th>井号</th><th>出砂指数</th><th>距底水 m</th><th>渗透率 mD</th><th>厚度 m</th>" +
      "<th>采用方式</th><th>比采油指数</th><th>相似度</th></tr>" + rows;

    /* ---------- 解说 ---------- */
    if (far < 0.35) {
      note.innerHTML = "最近的 " + K + " 口井里，最远那口的相似度只有 <b>" + (far * 100).toFixed(0) +
        "%</b>——当前的储层条件落在<b>样本稀疏区</b>，检索硬凑出来的邻井其实并不像。" +
        "这时不该把 Top-1 当成推荐，正确做法是回到<b>知识图谱</b>放宽到相邻层系 / 相似岩性去找类比，" +
        "或直接转人工裁定并把结论回填空缺区。";
    } else if (prob[win] >= 0.5) {
      var good = topK.filter(function (x) {
        return x.c.mode === win && x.c.mode === idealMode(x.c.sand, x.c.dw);
      }).length;
      note.innerHTML = "<b>" + MODES[win].name + "</b>拿到 " + cnt[win] + " / " + K + " 票，" +
        "其中 <b>" + good + " 口</b>采用方式与自身地质条件匹配、投产后表现正常，属于可用的证据。" +
        "置信度 " + (prob[win] * 100).toFixed(0) + "%，可以直接作为候选方案的第一顺位提交评审。";
    } else {
      note.innerHTML = "票被摊薄了：<b>" + MODES[win].name + "</b>只有 " + (prob[win] * 100).toFixed(0) +
        "%，<b>" + MODES[second].name + "</b>紧随其后。这通常有两种原因——要么 K 取得太大，" +
        "把不相似的井拉进了票池（试着把 K 调到 5），要么这个条件本身<b>处在两类做法的分界带上</b>，" +
        "此时更应该看证据井的具体产能数据，而不是票数。";
    }
  }

  [sandIn, dwIn, permIn, hIn, kIn].forEach(function (n) {
    n.addEventListener("input", draw);
  });
  draw();
})();
