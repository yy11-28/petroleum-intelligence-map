/* =========================================================
   完井作业施工风险智能预警 · 示范脚本（整页模式）
   ---------------------------------------------------------
   1) 合成一条工序曲线（下入 / 坐封 / 射孔），按参数注入事故形态
   2) 用历史正常井建立基线带，滑窗算三个特征并合成异常分
   3) 越过阈值后，用异常形态去知识图谱里检索最像的历史事故
   4) 输出：风险等级 + 提前量 + 证据清单 + 推荐工况
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 0. 常量 ---------- */
  var N = 200;                 /* 采样点数，1 s 一个点 */
  var W = 14;                  /* 滑窗宽度 */
  var BASE_N = 34;             /* 用工序开头这段建立基线 */

  var PHASES = {
    run:  { name: "管柱下入",   unit: "kN（大钩载荷）", base: 42,  scale: 210, to: 3.4 },
    set:  { name: "封隔器坐封", unit: "MPa（坐封压力）", base: 18, scale: 26,  to: 1.1 },
    perf: { name: "射孔起爆",   unit: "kN（张力）",     base: 88,  scale: 150, to: 2.2 }
  };

  /* 历史事故库形态：[均值偏离（σ）、斜率（σ/s）、振荡倍数] */
  var ARCH = [
    { id: "ACC-021", phase: "run",  name: "下入遇阻（砂桥 / 台阶）",    sign: [ 2.3,  0.055, 1.35 ],
      fix: "停止下入 → 小排量循环 → 划眼通过" },
    { id: "ACC-047", phase: "run",  name: "卡管（键槽 / 井壁坍塌）",    sign: [ 3.7,  0.115, 2.60 ],
      fix: "先放后提，控制在上提余量 70% 内，严禁硬提" },
    { id: "ACC-063", phase: "set",  name: "封隔器坐封失封",            sign: [-1.9, -0.045, 0.95 ],
      fix: "泄压后重新坐封，校核坐封吨位与胶筒完好性" },
    { id: "ACC-078", phase: "set",  name: "压力持续不降（管柱堵塞）",   sign: [ 2.4,  0.022, 1.05 ],
      fix: "停止补压，循环确认通畅后再校核坐封吨位" },
    { id: "ACC-092", phase: "perf", name: "起爆异常（未响 / 弱响）",    sign: [-0.7, -0.025, 0.60 ],
      fix: "按盲区处理，等待规定时间后再起枪检查" },
    { id: "ACC-104", phase: "perf", name: "枪串卡阻",                  sign: [ 3.1,  0.095, 2.30 ],
      fix: "立即停止加压，起枪检查，不得二次加压" }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function fmt(v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  /* ---------- 1. 合成工序曲线 ---------- */
  function synth(phase, fric, dogleg, aggr) {
    var P = PHASES[phase];
    var rnd = mulberry32(Math.round(fric * 1e4 + dogleg * 97 + aggr * 977 + phase.length * 31));
    var base = P.base + P.scale * fric + P.scale * 0.16 * (dogleg / 12);
    var sd = P.to * (0.45 + 1.35 * aggr + 0.5 * (dogleg / 12));

    /* 严重度：决定要不要出事、以及出多严重的事 */
    var sev = clamp(0.55 * (fric - 0.02) / 0.14 + 0.35 * (dogleg / 12) + 0.55 * aggr, 0, 1.4);
    var pool = ARCH.filter(function (a) { return a.phase === phase; });
    var kind = null, onset = -1;
    if (sev > 0.40) {
      kind = pool[sev > 0.78 ? 1 : 0];
      onset = Math.round(126 + 44 * clamp(1 - sev, 0, 1));
      if (onset > N - 30) onset = N - 30;
    }

    var PRE = 40;   /* 前兆段：事故被记录之前，曲线已经开始偏离 */
    var y = [], i, v;
    for (i = 0; i < N; i++) {
      v = base + (rnd() * 2 - 1) * sd * 1.7 + Math.sin(i * 0.13) * sd * 0.35;
      if (kind && i >= onset - PRE && i < onset) {
        /* 前兆：幅度小、爬升慢，肉眼几乎看不出来，但滑窗特征已经开始上升 */
        var pk = kind.sign;
        var pt = (i - (onset - PRE)) / PRE;
        v += (pk[0] > 0 ? 1 : -1) * sd * 2.4 * Math.abs(pk[0]) * pt;
        v += Math.sin(i * 0.8) * sd * (pk[2] - 1) * 0.7 * pt;
      }
      if (kind && i >= onset) {
        var dt = i - onset, k = kind.sign;
        var mag = Math.abs(k[0]) * sd * 2.0;
        var shape = (Math.abs(k[1]) > 0.05)
          ? clamp(dt / 12, 0, 1)                       /* 渐变型 */
          : (1 - Math.exp(-dt / 6));                    /* 突变型 */
        v += (k[0] > 0 ? 1 : -1) * mag * shape;
        v += Math.sin(i * 0.95) * sd * (k[2] - 1) * 1.4 * shape;
        v += Math.sin(i * 2.7) * sd * (k[2] - 1) * 0.8 * shape;
      }
      y.push(v);
    }
    /* 开头 BASE_N 个点作为「历史正常」的参考段 */
    return { y: y, onset: onset, kind: kind, sev: sev, sd: sd };
  }

  /* ---------- 2. 滑窗特征与异常分 ---------- */
  function analyze(d) {
    var y = d.y, i, j;
    var seg = y.slice(0, BASE_N);
    var mean0 = seg.reduce(function (a, b) { return a + b; }, 0) / seg.length;
    var sd0 = Math.sqrt(seg.reduce(function (a, b) { return a + (b - mean0) * (b - mean0); }, 0) / seg.length);
    sd0 = Math.max(sd0, PHASES[window.__ph || "run"].to * 0.6);

    var F = [], S = [];
    for (i = 0; i < N; i++) F.push(null), S.push(0);
    for (i = W; i < N; i++) {
      var s = 0, ss = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, m;
      for (j = i - W + 1; j <= i; j++) { s += y[j]; ss += y[j] * y[j]; }
      m = s / W;
      var varr = Math.max(ss / W - m * m, 1e-6);
      for (j = i - W + 1; j <= i; j++) {
        var t = j - (i - W + 1); sx += t; sy += y[j]; sxy += t * y[j]; sxx += t * t;
      }
      var slope = (W * sxy - sx * sy) / (W * sxx - sx * sx);   /* kN/s */
      var osc = Math.sqrt(varr) / sd0;
      var zz = (m - mean0) / sd0;
      var slopeZ = slope / sd0;
      F[i] = { z: zz, slope: slopeZ, osc: osc };
      var raw = 0.60 * Math.max(0, Math.abs(zz) - 0.95) +
                0.45 * Math.max(0, osc - 1.05) +
                0.38 * Math.max(0, Math.abs(slopeZ) - 0.028) * 12;
      S[i] = 1 - Math.exp(-raw);
    }
    return { F: F, S: S, mean0: mean0, sd0: sd0 };
  }

  /* ---------- 3. 知识图谱检索：形态相似度 ---------- */
  function match(f) {
    var out = ARCH.map(function (a) {
      var dz = (f.z - a.sign[0]) / 1.5;
      var ds = (f.slope - a.sign[1]) / 0.075;
      var doc = (f.osc - a.sign[2]) / 0.9;
      var dist = Math.sqrt(dz * dz + ds * ds + doc * doc);
      return { a: a, sim: Math.exp(-dist * dist / 2) };
    });
    out.sort(function (p, q) { return q.sim - p.sim; });
    return out;
  }

  /* ---------- 4. 绘图 ---------- */
  function el(id) { return document.getElementById(id); }
  function polyline(vals, x0, x1, y0, y1, lo, hi) {
    var pts = [], i;
    for (i = 0; i < vals.length; i++) {
      var x = x0 + (x1 - x0) * i / (vals.length - 1);
      var yy = y1 - (y1 - y0) * (vals[i] - lo) / (hi - lo + 1e-9);
      pts.push(x.toFixed(1) + "," + Math.max(y0, Math.min(y1, yy)).toFixed(1));
    }
    return pts.join(" ");
  }

  function drawCurve(d, res, thr, alarmIdx) {
    var y = d.y, lo = Math.min.apply(null, y), hi = Math.max.apply(null, y);
    var pad = (hi - lo) * 0.12 + 1e-6; lo -= pad; hi += pad;
    var X0 = 52, X1 = 700, Y0 = 26, Y1 = 168;
    var band = 2 * res.sd0;
    var b0 = Y1 - (Y1 - Y0) * (res.mean0 + band - lo) / (hi - lo);
    var b1 = Y1 - (Y1 - Y0) * (res.mean0 - band - lo) / (hi - lo);
    var s = "<rect x='0' y='0' width='720' height='215' fill='#fff'/>";
    s += "<text x='14' y='17' font-size='11' fill='#242b2e'>工序曲线 vs 历史正常基线带（±2σ，来自 186 井次同工序记录）</text>";
    s += "<rect x='" + X0 + "' y='" + b0.toFixed(1) + "' width='" + (X1 - X0) + "' height='" + Math.max(2, (b1 - b0)).toFixed(1) + "' fill='#e6f1ec'/>";
    s += "<line x1='" + X0 + "' y1='" + ((b0 + b1) / 2).toFixed(1) + "' x2='" + X1 + "' y2='" + ((b0 + b1) / 2).toFixed(1) + "' stroke='#2f7d6b' stroke-dasharray='4 3'/>";
    for (var g = 0; g <= 4; g++) {
      var vv = lo + (hi - lo) * g / 4, yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='46' y='" + (yy + 3.5).toFixed(1) + "' font-size='9' fill='#79828a' text-anchor='end'>" + fmt(vv, 1) + "</text>";
    }
    s += "<polyline points='" + polyline(y, X0, X1, Y0, Y1, lo, hi) + "' fill='none' stroke='#41699b' stroke-width='1.3'/>";
    if (d.onset >= 0) {
      var ox = X0 + (X1 - X0) * d.onset / (N - 1);
      s += "<line x1='" + ox.toFixed(1) + "' y1='" + Y0 + "' x2='" + ox.toFixed(1) + "' y2='" + Y1 + "' stroke='#c9613f' stroke-dasharray='3 3'/>";
      s += "<text x='" + (ox + 5).toFixed(1) + "' y='" + (Y0 + 11) + "' font-size='9' fill='#c9613f'>事故首现 " + d.onset + " s</text>";
    }
    if (alarmIdx >= 0) {
      var ax = X0 + (X1 - X0) * alarmIdx / (N - 1);
      var ay = Y1 - (Y1 - Y0) * (y[alarmIdx] - lo) / (hi - lo);
      s += "<circle cx='" + ax.toFixed(1) + "' cy='" + ay.toFixed(1) + "' r='4' fill='#c9613f'/>";
      s += "<text x='" + (ax - 6).toFixed(1) + "' y='" + (Y1 + 16) + "' font-size='9' fill='#c9613f' text-anchor='end'>报警 " + alarmIdx + " s</text>";
    }
    s += "<text x='" + X0 + "' y='186' font-size='9' fill='#79828a'>0 s</text>";
    s += "<text x='" + X1 + "' y='186' font-size='9' fill='#79828a' text-anchor='end'>" + (N - 1) + " s</text>";
    s += "<text x='" + X0 + "' y='205' font-size='10' fill='#4d565b'>纵坐标：" + PHASES[cur].unit + "　绿带＝历史正常的 ±2σ；曲线跑出绿带并被 three 项特征同时印证，才计入异常分。</text>";
    el("curve").innerHTML = s;
  }

  function drawScore(res, thr, alarmIdx) {
    var X0 = 52, X1 = 700, Y0 = 22, Y1 = 148, S = res.S;
    var s = "<rect x='0' y='0' width='720' height='195' fill='#fff'/>";
    s += "<text x='14' y='16' font-size='11' fill='#242b2e'>异常分 = 三项特征的加权合成（0–1）</text>";
    for (var g = 0; g <= 4; g++) {
      var yy = Y1 - (Y1 - Y0) * g / 4;
      s += "<line x1='" + X0 + "' y1='" + yy.toFixed(1) + "' x2='" + X1 + "' y2='" + yy.toFixed(1) + "' stroke='#f2efe6'/>";
      s += "<text x='46' y='" + (yy + 3.5).toFixed(1) + "' font-size='9' fill='#79828a' text-anchor='end'>" + fmt(g / 4, 2) + "</text>";
    }
    var ty = Y1 - (Y1 - Y0) * thr;
    s += "<line x1='" + X0 + "' y1='" + ty.toFixed(1) + "' x2='" + X1 + "' y2='" + ty.toFixed(1) + "' stroke='#c9613f' stroke-dasharray='5 3'/>";
    s += "<text x='" + X1 + "' y='" + (ty - 5).toFixed(1) + "' font-size='9' fill='#c9613f' text-anchor='end'>阈值 " + thr.toFixed(2) + "</text>";
    s += "<polyline points='" + polyline(S, X0, X1, Y0, Y1, 0, 1) + "' fill='none' stroke='#2f7d6b' stroke-width='1.6'/>";
    if (alarmIdx >= 0) {
      var ax = X0 + (X1 - X0) * alarmIdx / (N - 1);
      s += "<circle cx='" + ax.toFixed(1) + "' cy='" + ty.toFixed(1) + "' r='3.5' fill='#c9613f'/>";
      s += "<line x1='" + ax.toFixed(1) + "' y1='" + ty.toFixed(1) + "' x2='" + ax.toFixed(1) + "' y2='" + Y1 + "' stroke='#c9613f' stroke-width='1'/>";
    }
    var fMax = res.F[N - 6] || { z: 0, slope: 0, osc: 1 };
    s += "<rect x='52' y='160' width='320' height='26' rx='4' fill='#efece1'/>";
    s += "<text x='62' y='176' font-size='9.5' fill='#4d565b'>末端窗口特征：均值 " + (fMax.z >= 0 ? "+" : "") + fmt(fMax.z, 2) + "σ　斜率 " + fmt(fMax.slope, 3) + "σ/s　振荡 " + fmt(fMax.osc, 2) + "×</text>";
    s += "<text x='386' y='176' font-size='9' fill='#79828a'>三项同时成立才算异常，单点尖刺不计分</text>";
    el("score").innerHTML = s;
  }

  function drawKG(list, phase) {
    var s = "<rect x='0' y='0' width='720' height='200' fill='#fff'/>";
    s += "<text x='14' y='17' font-size='11' fill='#242b2e'>知识图谱检索：把当前异常形态（偏离 / 斜率 / 振荡）与历史事故对齐</text>";
    var top = list.filter(function (x) { return x.a.phase === phase; }).slice(0, 4);
    var maxw = 300, x0 = 190;
    top.forEach(function (x, i) {
      var yy = 38 + i * 34;
      s += "<text x='52' y='" + (yy + 4) + "' font-size='9.5' fill='#242b2e'>" + x.a.id + "</text>";
      s += "<text x='108' y='" + (yy + 4) + "' font-size='9.5' fill='#4d565b'>" + x.a.name + "</text>";
      s += "<rect x='" + x0 + "' y='" + (yy - 6) + "' width='" + maxw + "' height='12' rx='2' fill='#efece1'/>";
      s += "<rect x='" + x0 + "' y='" + (yy - 6) + "' width='" + (maxw * x.sim).toFixed(1) + "' height='12' rx='2' fill='" + (i === 0 ? "#2f7d6b" : "#b9c6cf") + "'/>";
      s += "<text x='" + (x0 + maxw + 8) + "' y='" + (yy + 4) + "' font-size='9.5' fill='#242b2e'>" + (x.sim * 100).toFixed(0) + "%</text>";
      s += "<text x='52' y='" + (yy + 18) + "' font-size='8.5' fill='#79828a'>处置：" + x.a.fix + "</text>";
    });
    s += "<text x='14' y='188' font-size='9' fill='#79828a'>相似度 = exp(−‖形态差‖²/2)：不是比数值大小，而是比「偏离的方向与速度」是否同一种失事。</text>";
    el("kg").innerHTML = s;
  }

  /* ---------- 5. 主更新 ---------- */
  var cur = "run";
  function update() {
    var fric = parseFloat(el("fric").value);
    var dogleg = parseFloat(el("dogleg").value);
    var aggr = parseFloat(el("aggr").value);
    var thr = parseFloat(el("thr").value);
    window.__ph = cur;

    el("out-f").textContent = fric.toFixed(3);
    el("out-dogleg").textContent = fmt(dogleg, 1) + " °/30m";
    el("out-aggr").textContent = fmt(aggr, 2);
    el("out-thr").textContent = fmt(thr, 2);

    var d = synth(cur, fric, dogleg, aggr);
    var res = analyze(d);

    var alarmIdx = -1;
    for (var i = W; i < N; i++) { if (res.S[i] > thr) { alarmIdx = i; break; } }
    var lead = (d.onset >= 0 && alarmIdx >= 0) ? d.onset - alarmIdx : null;

    drawCurve(d, res, thr, alarmIdx);
    drawScore(res, thr, alarmIdx);

    var fAt = res.F[alarmIdx >= 0 ? Math.min(N - 1, alarmIdx + 3) : N - 6] || { z: 0, slope: 0, osc: 1 };
    var list = match(fAt);
    drawKG(list, cur);

    var maxS = Math.max.apply(null, res.S);
    var lv = maxS > 0.75 ? "高" : (maxS > 0.45 ? "中" : "低");
    el("ro-lv").textContent = alarmIdx >= 0 ? lv + "（" + fmt(maxS, 2) + "）" : lv + " · 未报警";
    el("ro-lv").className = maxS > 0.75 ? "bad" : (maxS > 0.45 ? "" : "ok");
    el("ro-lead").textContent = lead === null ? "—" : lead + " s";
    var top = list.filter(function (x) { return x.a.phase === cur; })[0];
    el("ro-hit").textContent = alarmIdx >= 0 && top ? top.a.id : "—";
    el("ro-fix").textContent = alarmIdx >= 0 && top ? top.a.fix : "维持当前工况，继续监视";

    /* 证据表 */
    var rows = list.filter(function (x) { return x.a.phase === cur; }).slice(0, 3);
    var tb = "<caption>图谱检索结果（同工序 Top-3）</caption><tr><th>事故编号</th><th>类别</th><th>相似度</th><th>推荐处置</th></tr>";
    rows.forEach(function (x, i) {
      tb += "<tr><td>" + x.a.id + "</td><td class='nm'>" + x.a.name + "</td><td" + (i === 0 ? " style='color:#2f7d6b'" : "") + ">" + (x.sim * 100).toFixed(0) + "%</td><td class='nm'>" + x.a.fix + "</td></tr>";
    });
    el("topk").innerHTML = alarmIdx >= 0 ? tb : "<caption>未越过阈值，不触发检索</caption>";

    var note;
    if (alarmIdx < 0) {
      note = "当前工况下异常分最高 <b>" + fmt(maxS, 2) + "</b>，未越过阈值 —— 曲线始终在历史正常带附近，系统判定为正常作业。";
    } else if (d.onset < 0) {
      note = "异常分在 <b>" + alarmIdx + " s</b> 越过阈值，但本条井此后并无事故标记：这是一次 <b>疑似误报</b>，现场确认后应回填为负样本，否则图谱会越用越保守。";
    } else {
      note = "事故在 <b>" + d.onset + " s</b> 开始成形，系统在 <b>" + alarmIdx + " s</b> 越过阈值，" +
             "<b>提前 " + lead + " s</b> 给出提示；当时窗口特征为均值 " + (fAt.z >= 0 ? "+" : "") + fmt(fAt.z, 2) + "σ、斜率 " + fmt(fAt.slope, 3) + "σ/s、振荡 " + fmt(fAt.osc, 2) + "×。" +
             "图谱把它判为「" + top.a.name + "」，因此推荐工况是：<b>" + top.a.fix + "</b>。";
    }
    el("note").innerHTML = note;
  }

  /* ---------- 6. 绑定 ---------- */
  ["fric", "dogleg", "aggr", "thr"].forEach(function (id) {
    el(id).addEventListener("input", update);
  });
  [].forEach.call(document.querySelectorAll(".btnrow button"), function (b) {
    b.addEventListener("click", function () {
      [].forEach.call(document.querySelectorAll(".btnrow button"), function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      cur = b.getAttribute("data-p");
      update();
    });
  });
  update();
})();
