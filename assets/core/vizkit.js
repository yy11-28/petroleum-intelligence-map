/* =========================================================
   可视化图元库 VizKit（window.V）
   ---------------------------------------------------------
   给「案例插件」用的公共绘图库：石油专业图元 + 智能化结果图。
   设计原则：
     1. 零依赖、纯前端，只返回 SVG / HTML 字符串；
     2. 浅色纸底配色，与全站 tokens 一致，不写死深色背景；
     3. 只做"示意图"，不追求工程精度 —— 目的是让人 30 秒看懂
        专业概念、流程分工与模型结果，而不是出图给现场用；
     4. 新 API，不改动 K.* 与 Cases.register 的任何既有行为，
        别的同学按老模板写的案例不受影响。

   用法（案例文件里直接调用，也可用 K.V.*）：
     V.figure(V.flow(steps), '图注文字')
     K.figure(V.wellbore({...}), 1, '图注')
   ========================================================= */

(function (global) {
  'use strict';

  /* ---------------- 配色 ---------------- */
  var C = {
    paper: '#fbfaf6', band: '#efece1', line: '#e2ded0', line2: '#ddd7c8',
    ink: '#242b2e', ink2: '#4d565b', ink3: '#79828a', ink4: '#9ba3a9',
    jade: '#2f7d6b', jadeL: '#e6f1ec',
    blue: '#41699b', blueL: '#e7eef9',
    clay: '#b26a39', clayL: '#f8ecdf',
    plum: '#7e5a8d', plumL: '#efe9f4',
    olive: '#767a2e', oliveL: '#f1f1dd',
    red: '#b05a51', redL: '#f9e9e5',
    sand: '#c9a227', gold: '#f2d98a'
  };

  var MONO = 'ui-monospace,SFMono-Regular,Consolas,monospace';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* 极简标记：**粗体** */
  function rich(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }
  function n1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function svg(w, h, inner, label) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" ' +
      'role="img" aria-label="' + esc(label || '示意图') + '">' + inner + '</svg>';
  }

  /* 统一箭头 marker（每个图用独立 id 前缀，避免同页重名） */
  function marker(id, color) {
    return '<defs><marker id="' + id + '" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">' +
      '<path d="M0 0 L7 3 L0 6 Z" fill="' + color + '"/></marker></defs>';
  }

  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + n1(x) + '" y="' + n1(y) + '" font-size="' + (o.size || 9.5) + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') +
      (o.fill ? ' fill="' + o.fill + '"' : ' fill="' + C.ink2 + '"') +
      (o.mono ? ' font-family="' + MONO + '"' : '') +
      (o.weight ? ' font-weight="' + o.weight + '"' : '') +
      (o.ls ? ' letter-spacing="' + o.ls + '"' : '') +
      (o.opacity ? ' opacity="' + o.opacity + '"' : '') +
      '>' + esc(s) + '</text>';
  }

  /* 自动折行：按每行最多 maxChar 个字切 */
  function wrap(s, maxChar) {
    var out = [], cur = '';
    String(s || '').split('').forEach(function (ch) {
      cur += ch;
      if (cur.length >= maxChar) { out.push(cur); cur = ''; }
    });
    if (cur) out.push(cur);
    return out;
  }

  function box(x, y, w, h, fill, stroke, r) {
    return '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) +
      '" rx="' + (r == null ? 5 : r) + '" fill="' + fill + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-opacity=".35"' : '') + '/>';
  }

  /* =========================================================
     一、石油专业图元
     ========================================================= */

  /* 1. 井筒剖面：地层 + 套管层次 + 油管 + 封隔器 + 射孔段 + 人工井底
      opt = {
        depth: 3200,                     // 井深（m）
        layers: [{name, from, to, color}],// 层位（from/to 为 0—1 相对位置或米）
        casings: [{name, from, to, color}],
        perf: [{from, to, label}],       // 射孔段
        packer: 0.62,                    // 封隔器相对位置
        tubing: true,
        labels: ['地面', ...]
      }                                   */
  function wellbore(opt) {
    opt = opt || {};
    var W = 700, H = opt.height || 300;
    var x0 = 150, wW = 120, yT = 26, yH = H - 56;
    var s = '';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';

    /* 地层（背景色带） */
    (opt.layers || []).forEach(function (L) {
      var a = yT + (L.from || 0) * yH, b = yT + (L.to == null ? (L.from || 0) + 0.12 : L.to) * yH;
      s += '<rect x="8" y="' + n1(a) + '" width="' + (W - 16) + '" height="' + n1(b - a) +
        '" fill="' + (L.color || C.band) + '" opacity=".85"/>';
      s += '<line x1="8" y1="' + n1(a) + '" x2="' + (W - 8) + '" y2="' + n1(a) + '" stroke="' + C.line2 + '"/>';
      s += txt(16, a + 13, L.name || '', { size: 9.5, fill: C.ink2, weight: '600' });
    });

    /* 井眼外框 */
    s += '<rect x="' + x0 + '" y="' + yT + '" width="' + wW + '" height="' + yH + '" fill="#ffffff" stroke="' + C.ink + '" stroke-width="1.2"/>';

    /* 套管层次（左右两侧细条） */
    (opt.casings || []).forEach(function (cs, i) {
      var a = yT + (cs.from || 0) * yH, b = yT + (cs.to == null ? 1 : cs.to) * yH;
      var w = 9 - i * 2.2;
      s += '<rect x="' + (x0 - w - 3) + '" y="' + n1(a) + '" width="' + w + '" height="' + n1(b - a) +
        '" fill="' + (cs.color || C.ink3) + '" opacity=".9"/>';
      s += '<rect x="' + (x0 + wW + 3) + '" y="' + n1(a) + '" width="' + w + '" height="' + n1(b - a) +
        '" fill="' + (cs.color || C.ink3) + '" opacity=".9"/>';
      if (cs.name) s += txt(x0 + wW + 18, a + 11, cs.name, { size: 9, fill: C.ink3, mono: true });
    });

    /* 油管 */
    if (opt.tubing !== false) {
      var tFrom = yT, tTo = yT + (opt.packer || 0.62) * yH;
      s += '<rect x="' + (x0 + wW / 2 - 9) + '" y="' + n1(tFrom) + '" width="18" height="' + n1(tTo - tFrom) +
        '" fill="' + C.blueL + '" stroke="' + C.blue + '" stroke-opacity=".5"/>';
      s += txt(x0 + wW / 2, tFrom + 16, '油管', { size: 8.5, fill: C.blue, anchor: 'middle' });
    }

    /* 封隔器 */
    if (opt.packer != null) {
      var py = yT + opt.packer * yH;
      s += '<rect x="' + (x0 - 6) + '" y="' + n1(py - 7) + '" width="' + (wW + 12) + '" height="14" rx="2" fill="' + C.jade + '" opacity=".85"/>';
      s += txt(x0 - 12, py + 3.5, '封隔器', { size: 9, fill: C.jade, anchor: 'end' });
    }

    /* 射孔段 */
    (opt.perf || []).forEach(function (p) {
      var a = yT + (p.from || 0) * yH, b = yT + (p.to || 0.05) * yH;
      for (var y = a + 4; y < b; y += 11) {
        s += '<path d="M' + (x0 + wW + 1) + ' ' + n1(y) + ' l10 -3" stroke="' + C.clay + '" stroke-width="1.6"/>';
        s += '<path d="M' + (x0 - 1) + ' ' + n1(y + 3) + ' l-10 3" stroke="' + C.clay + '" stroke-width="1.6"/>';
      }
      s += '<rect x="' + (x0 - 2) + '" y="' + n1(a) + '" width="' + (wW + 4) + '" height="' + n1(b - a) +
        '" fill="none" stroke="' + C.clay + '" stroke-dasharray="3 2"/>';
      if (p.label) s += txt(x0 + wW + 26, (a + b) / 2 + 3.5, p.label, { size: 9, fill: C.clay, weight: '600' });
    });

    /* 人工井底 */
    s += '<rect x="' + x0 + '" y="' + n1(yT + yH - 6) + '" width="' + wW + '" height="6" fill="' + C.ink + '" opacity=".8"/>';
    s += txt(x0 + wW + 18, yT + yH - 2, '人工井底', { size: 9, fill: C.ink3 });

    /* 深度刻度 */
    var dep = opt.depth || 3200;
    for (var i = 0; i <= 4; i++) {
      var yy = yT + i / 4 * yH;
      s += '<line x1="8" y1="' + n1(yy) + '" x2="' + (x0 - 14) + '" y2="' + n1(yy) + '" stroke="' + C.line2 + '" stroke-dasharray="2 3"/>';
      s += txt(x0 - 18, yy + 3.5, Math.round(dep * i / 4) + ' m', { size: 8.5, fill: C.ink4, anchor: 'end', mono: true });
    }
    return svg(W, H, s, opt.label || '井筒结构剖面示意');
  }

  /* 2. 地层柱状图（顶部新 → 底部老），可标注岩性与储层
      layers = [{name, sub, h(相对高度), color, tag}] */
  function strata(layers, opt) {
    opt = opt || {};
    var W = 700, H = opt.height || 260, yT = 24, yH = H - 44, x0 = 16, wW = opt.width || 210;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    var tot = 0;
    layers.forEach(function (L) { tot += (L.h || 0.1); });
    var acc = 0;
    s += txt(x0, 14, opt.title || '地层柱状（示意，非等比例）', { size: 9.5, fill: C.ink3, mono: true, ls: '.5' });
    layers.forEach(function (L) {
      var hgt = (L.h || 0.1) / tot * yH;
      var y = yT + acc;
      s += '<rect x="' + x0 + '" y="' + n1(y) + '" width="' + wW + '" height="' + n1(hgt) +
        '" fill="' + (L.color || C.band) + '" stroke="' + C.line2 + '"/>';
      /* 岩性花纹：点（砂）/ 横（泥）/ 砖（灰岩） */
      var pat = L.pat || 'none';
      if (pat === 'dot') for (var yy = y + 5; yy < y + hgt - 2; yy += 7)
        for (var xx = x0 + 8; xx < x0 + wW - 4; xx += 9) s += '<circle cx="' + xx + '" cy="' + n1(yy) + '" r=".8" fill="' + C.ink + '" opacity=".45"/>';
      if (pat === 'dash') for (var y2 = y + 5; y2 < y + hgt - 2; y2 += 6)
        s += '<line x1="' + (x0 + 6) + '" y1="' + n1(y2) + '" x2="' + (x0 + wW - 6) + '" y2="' + n1(y2) + '" stroke="' + C.ink + '" opacity=".28"/>';
      if (pat === 'brick') for (var y3 = y + 5; y3 < y + hgt - 2; y3 += 8)
        s += '<line x1="' + (x0 + 6) + '" y1="' + n1(y3) + '" x2="' + (x0 + wW - 6) + '" y2="' + n1(y3) + '" stroke="' + C.ink + '" opacity=".2"/>' +
          '<line x1="' + (x0 + wW / 2) + '" y1="' + n1(y3) + '" x2="' + (x0 + wW / 2) + '" y2="' + n1(y3 + 4) + '" stroke="' + C.ink + '" opacity=".2"/>';

      s += txt(x0 + wW + 12, y + Math.min(16, hgt / 2 + 4), L.name || '', { size: 10, fill: C.ink, weight: '600' });
      if (L.sub) s += txt(x0 + wW + 12, y + Math.min(30, hgt / 2 + 17), L.sub, { size: 9, fill: C.ink3 });
      if (L.tag) {
        var tw = 4 + String(L.tag).length * 6.5;
        s += box(x0 + wW + 12, y + Math.min(34, hgt / 2 + 24), tw, 14, L.tagColor || C.jadeL, L.tagStroke || C.jade, 3);
        s += txt(x0 + wW + 18, y + Math.min(44, hgt / 2 + 34), L.tag, { size: 8.5, fill: L.tagStroke || C.jade, mono: true });
      }
      acc += hgt;
    });
    return svg(W, H, s, opt.label || '地层柱状示意');
  }

  /* 3. 测井曲线道（纵向深度）：curves + 层界面 + 层色带
      opt = { depth:[d0,d1], curves:[{name,color,pts:[[v,rel]] 或 vals[]}],
              bounds:[{at,label,color}], bands:[{from,to,color,label}] } */
  function logTrack(opt) {
    opt = opt || {};
    var W = 700, H = opt.height || 300, yT = 24, yH = H - 46;
    var tracks = opt.curves || [];
    var tw = tracks.length ? (W - 90) / tracks.length : 0;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';

    /* 深度刻度 */
    var d0 = (opt.depth && opt.depth[0]) || 0, d1 = (opt.depth && opt.depth[1]) || 100;
    for (var i = 0; i <= 5; i++) {
      var yy = yT + i / 5 * yH;
      s += '<line x1="46" y1="' + n1(yy) + '" x2="' + (W - 8) + '" y2="' + n1(yy) + '" stroke="' + C.line + '" stroke-dasharray="2 3"/>';
      s += txt(44, yy + 3.5, Math.round(d0 + (d1 - d0) * i / 5), { size: 8.5, fill: C.ink4, anchor: 'end', mono: true });
    }
    s += txt(8, 14, '深度', { size: 9, fill: C.ink3, mono: true });

    /* 层色带 */
    (opt.bands || []).forEach(function (b) {
      var a = yT + (b.from || 0) * yH, c = yT + (b.to || 0) * yH;
      s += '<rect x="46" y="' + n1(a) + '" width="' + (W - 54) + '" height="' + n1(c - a) +
        '" fill="' + (b.color || C.gold) + '" opacity="' + (b.opacity || 0.35) + '"/>';
      if (b.label) s += txt(W - 54, a + 12, b.label, { size: 9, fill: C.ink2, anchor: 'end' });
    });

    /* 曲线 */
    tracks.forEach(function (cv, k) {
      var xL = 46 + k * tw + 8, xW = tw - 20;
      var vals = cv.vals || [];
      var pts = vals.map(function (v, idx) {
        var rel = idx / Math.max(1, vals.length - 1);
        var vx = clamp((v - (cv.min || 0)) / ((cv.max || 1) - (cv.min || 0)), 0, 1);
        return (xL + vx * xW) + ',' + n1(yT + rel * yH);
      }).join(' ');
      s += '<line x1="' + n1(xL) + '" y1="' + yT + '" x2="' + n1(xL) + '" y2="' + n1(yT + yH) + '" stroke="' + C.line2 + '"/>';
      s += '<polyline points="' + pts + '" fill="none" stroke="' + (cv.color || C.ink) + '" stroke-width="1.3" stroke-linejoin="round"/>';
      s += txt(xL + 2, yT - 6, cv.name || '', { size: 9, fill: cv.color || C.ink2, mono: true });
    });

    /* 层界面 */
    (opt.bounds || []).forEach(function (b) {
      var y = yT + (b.at || 0) * yH;
      s += '<line x1="46" y1="' + n1(y) + '" x2="' + (W - 8) + '" y2="' + n1(y) +
        '" stroke="' + (b.color || C.jade) + '" stroke-width="1.4" stroke-dasharray="5 3"/>';
      if (b.label) s += txt(W - 10, y - 4, b.label, { size: 9, fill: b.color || C.jade, anchor: 'end' });
    });
    return svg(W, H, s, opt.label || '测井曲线道示意');
  }

  /* =========================================================
     二、流程 / 概念图元
     ========================================================= */

  /* 4. 横向流程链：steps = [{name, role, note}]，自动折行
      opt = {cols: 3, w: 700} —— role 用于区分"工程 / 算法 / 人工"三种颜色 */
  function flow(steps, opt) {
    opt = opt || {};
    steps = steps || [];
    var W = opt.w || 700, cols = opt.cols || (steps.length <= 3 ? steps.length : steps.length <= 6 ? 3 : 4);
    var rows = Math.ceil(steps.length / cols);
    var bw = (W - 16) / cols - 14, bh = opt.bh || 62, gapY = 22;
    var H = 24 + rows * (bh + gapY);
    var maxLines = bh >= 72 ? 3 : 2;   /* 加高卡可容纳三行说明 */
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    var roleColor = { '算法': C.jade, '算法核心': C.jade, '模型': C.jade, '工程': C.blue, '工程环节': C.blue, '数据': C.blue, '人工': C.clay, '人工确认': C.clay, '闭环': C.olive, '效果关键': C.plum, '评测': C.plum };
    steps.forEach(function (st, i) {
      var r = Math.floor(i / cols), c = i % cols;
      var x = 8 + c * (bw + 14), y = 20 + r * (bh + gapY);
      var col = roleColor[st.role] || st.color || C.blue;
      var bg = st.color ? 'none' : (col === C.jade ? C.jadeL : col === C.blue ? C.blueL : col === C.clay ? C.clayL : col === C.plum ? C.plumL : col === C.olive ? C.oliveL : C.blueL);
      s += box(x, y, bw, bh, bg, col, 6);
      s += '<rect x="' + x + '" y="' + y + '" width="3.5" height="' + bh + '" rx="1.75" fill="' + col + '"/>';
      var roleW = st.role ? String(st.role).length * 7 + 10 + 8 : 0;
      var nameFit = Math.max(4, Math.floor((bw - 24 - roleW) / 11));
      var name = String(st.name || '');
      if (name.length > nameFit) name = name.slice(0, nameFit - 1) + '…';
      s += txt(x + 12, y + 20, name, { size: 11, fill: C.ink, weight: '600' });
      if (st.role) {
        var rw = String(st.role).length * 7 + 10;
        s += box(x + bw - rw - 8, y + 8, rw, 14, col, col, 7);
        s += txt(x + bw - rw / 2 - 8, y + 18, st.role, { size: 8, fill: '#fff', anchor: 'middle', weight: '600' });
      }
      /* 汉字按 9px 字号 ≈ 8.8px/字估宽；超过两行末行加省略号 */
      var nlines = wrap(st.note || '', Math.max(8, Math.floor((bw - 24) / 8.8)));
      nlines.slice(0, maxLines).forEach(function (line, k) {
        var t = (k === 1 && nlines.length > 2) ? line.slice(0, Math.max(1, line.length - 1)) + '…' : line;
        s += txt(x + 12, y + 37 + k * 13, t, { size: 9, fill: C.ink3 });
      });
      /* 横向箭头 */
      if (c < cols - 1 && i < steps.length - 1) {
        s += '<path d="M' + n1(x + bw + 2) + ' ' + n1(y + bh / 2) + ' h10 m-3.5-3.2 3.6 3.2 -3.6 3.2" stroke="' + C.line2 + '" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      }
      /* 换行时的下行箭头 */
      if (c === cols - 1 && r < rows - 1 && i < steps.length - 1) {
        s += '<path d="M' + n1(x + bw / 2) + ' ' + n1(y + bh + 2) + ' v' + (gapY - 4) + '" stroke="' + C.line2 + '" stroke-width="1.2" stroke-dasharray="3 2"/>';
      }
    });
    return svg(W, H, s, opt.label || '流程步骤总览');
  }

  /* 5. 输入—模型—输出 三段式：体现"AI 替换的是哪一步、人还负责什么"
      opt = {inputs:[{t,s}], model:{t,s}, outputs:[{t,s}], human:{t,s}, w} */
  function io(opt) {
    opt = opt || {};
    var W = opt.w || 700, H = opt.height || 200;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    s += marker('vAr', C.ink3);
    var cw = (W - 40 - 60) / 3, y = 34, ch = 84;
    function col(x, title, items, color, bg) {
      var out = box(x, y, cw, ch, bg, color, 6);
      out += txt(x + 12, y + 18, title, { size: 10, fill: color, mono: true, weight: '600', ls: '.5' });
      (items || []).slice(0, 3).forEach(function (it, i) {
        out += txt(x + 12, y + 38 + i * 22, it.t || it, { size: 10, fill: C.ink, weight: '600' });
        if (it.s) out += txt(x + 12, y + 51 + i * 22, it.s, { size: 9, fill: C.ink3 });
      });
      return out;
    }
    s += col(12, 'INPUT · 现场数据', opt.inputs, C.blue, C.blueL);
    s += '<path d="M' + n1(12 + cw + 2) + ' ' + n1(y + ch / 2) + ' h22 m-3.5-3.2 3.6 3.2 -3.6 3.2" stroke="' + C.ink3 + '" stroke-width="1.2" fill="none" marker-end="url(#vAr)"/>';
    s += col(12 + cw + 30, 'MODEL · 智能化方法', [opt.model || { t: '模型', s: '方法说明' }], C.jade, C.jadeL);
    s += '<path d="M' + n1(12 + cw * 2 + 32) + ' ' + n1(y + ch / 2) + ' h22 m-3.5-3.2 3.6 3.2 -3.6 3.2" stroke="' + C.ink3 + '" stroke-width="1.2" fill="none" marker-end="url(#vAr)"/>';
    s += col(12 + cw * 2 + 60, 'OUTPUT · 给人用的结果', opt.outputs, C.clay, C.clayL);

    /* 人负责的那一段：底部虚线回馈 */
    var hy = y + ch + 16;
    s += box(12, hy, W - 24, 40, C.oliveL, C.olive, 6);
    s += txt(24, hy + 17, (opt.human && opt.human.t) || '人工确认 / 工程约束校核', { size: 10.5, fill: C.olive, weight: '600' });
    s += txt(24, hy + 31, (opt.human && opt.human.s) || '模型给候选，人做判断；确认结果回流进训练集', { size: 9, fill: C.ink3 });
    s += '<path d="M' + n1(W - 60) + ' ' + n1(hy) + ' v-8 H' + n1(W / 2) + ' V' + n1(y + ch + 2) + '" fill="none" stroke="' + C.olive + '" stroke-width="1.1" stroke-dasharray="4 3" marker-end="url(#vAr)"/>';
    return svg(W, H, s, opt.label || '数据—模型—输出与人机分工');
  }

  /* =========================================================
     三、智能化结果图元
     ========================================================= */

  /* 6. 分组柱状对比（人工 vs AI / 前后对比）
      opt = {labels:[], series:[{name, values:[], color}], unit, target} */
  function bars(opt) {
    opt = opt || {};
    var W = 700, H = opt.height || 220, xL = 56, yB = H - 34, yT = 26, plotH = yB - yT;
    var labels = opt.labels || [], series = opt.series || [];
    var max = 0;
    series.forEach(function (se) { se.values.forEach(function (v) { if (v > max) max = v; }); });
    max = max || 1;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    var gw = (W - xL - 14) / Math.max(1, labels.length), bw = Math.min(30, (gw - 14) / series.length);
    /* 网格 */
    for (var g = 0; g <= 4; g++) {
      var yy = yB - g / 4 * plotH;
      s += '<line x1="' + xL + '" y1="' + n1(yy) + '" x2="' + (W - 10) + '" y2="' + n1(yy) + '" stroke="' + C.line + '"/>';
      s += txt(xL - 8, yy + 3.5, n1(max * g / 4), { size: 8.5, fill: C.ink4, anchor: 'end', mono: true });
    }
    labels.forEach(function (lb, i) {
      var gx = xL + i * gw + 8;
      series.forEach(function (se, k) {
        var v = se.values[i] || 0, hgt = v / max * plotH;
        s += '<rect x="' + n1(gx + k * (bw + 4)) + '" y="' + n1(yB - hgt) + '" width="' + n1(bw) + '" height="' + n1(hgt) +
          '" rx="2" fill="' + (se.color || C.blue) + '" opacity=".88"/>';
        s += txt(gx + k * (bw + 4) + bw / 2, yB - hgt - 4, v, { size: 8.5, fill: C.ink2, anchor: 'middle', mono: true });
      });
      s += txt(gx + gw / 2 - 8, yB + 15, lb, { size: 9.5, fill: C.ink2, anchor: 'middle' });
    });
    /* 目标线 */
    if (opt.target != null) {
      var ty = yB - clamp(opt.target / max, 0, 1) * plotH;
      s += '<line x1="' + xL + '" y1="' + n1(ty) + '" x2="' + (W - 10) + '" y2="' + n1(ty) + '" stroke="' + C.clay + '" stroke-dasharray="4 3"/>';
      s += txt(W - 12, ty - 4, '目标 ' + opt.target + (opt.unit || ''), { size: 8.5, fill: C.clay, anchor: 'end' });
    }
    /* 图例 */
    series.forEach(function (se, k) {
      var lx = xL + k * 110;
      s += '<rect x="' + lx + '" y="10" width="9" height="9" rx="2" fill="' + (se.color || C.blue) + '"/>';
      s += txt(lx + 13, 18, se.name, { size: 9, fill: C.ink2 });
    });
    return svg(W, H, s, opt.label || '分组柱状对比');
  }

  /* 7. 热力矩阵 / 混淆矩阵：rows 为二维数组，labels 为行列名 */
  function matrix(opt) {
    opt = opt || {};
    var rows = opt.rows || [], labels = opt.labels || [];
    var n = Math.max(labels.length, rows.length);
    var W = 700, cell = Math.min(52, (W - 120) / Math.max(1, n)), H = 40 + n * cell;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    var max = 0;
    rows.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    max = max || 1;
    var base = opt.color || C.blue;
    labels.forEach(function (lb, j) {
      s += txt(70 + j * cell + cell / 2, 26, lb, { size: 9, fill: C.ink3, anchor: 'middle' });
    });
    rows.forEach(function (r, i) {
      s += txt(66, 40 + i * cell + cell / 2 + 3, labels[i] || '', { size: 9, fill: C.ink3, anchor: 'end' });
      r.forEach(function (v, j) {
        var op = clamp(v / max, 0, 1) * 0.85 + (v ? 0.08 : 0);
        s += '<rect x="' + n1(70 + j * cell) + '" y="' + n1(32 + i * cell) + '" width="' + n1(cell - 2) + '" height="' + n1(cell - 2) +
          '" rx="2" fill="' + base + '" opacity="' + n1(op) + '"/>';
        s += txt(70 + j * cell + (cell - 2) / 2, 32 + i * cell + (cell - 2) / 2 + 3, v,
          { size: 8.5, fill: op > 0.5 ? '#fff' : C.ink2, anchor: 'middle', mono: true });
      });
    });
    return svg(W, H, s, opt.label || '矩阵热力图');
  }

  /* 8. ROC / PR 曲线：pts = [[x,y]...]，auc 可选 */
  function curve(pts, opt) {
    opt = opt || {};
    var W = 420, H = 260, xL = 46, yB = H - 34, yT = 22, pw = W - xL - 16, ph = yB - yT;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    s += '<line x1="' + xL + '" y1="' + yT + '" x2="' + xL + '" y2="' + yB + '" stroke="' + C.line2 + '"/>';
    s += '<line x1="' + xL + '" y1="' + yB + '" x2="' + (W - 16) + '" y2="' + yB + '" stroke="' + C.line2 + '"/>';
    if (opt.diagonal !== false) s += '<line x1="' + xL + '" y1="' + yB + '" x2="' + (W - 16) + '" y2="' + yT + '" stroke="' + C.ink4 + '" stroke-dasharray="4 3"/>';
    var line = pts.map(function (p) { return n1(xL + p[0] * pw) + ',' + n1(yB - p[1] * ph); }).join(' ');
    s += '<polyline points="' + line + '" fill="none" stroke="' + (opt.color || C.jade) + '" stroke-width="2"/>';
    for (var g = 0; g <= 4; g++) {
      s += txt(xL - 6, yB - g / 4 * ph + 3.5, n1(g / 4), { size: 8, fill: C.ink4, anchor: 'end', mono: true });
      s += txt(xL + g / 4 * pw, yB + 14, n1(g / 4), { size: 8, fill: C.ink4, anchor: 'middle', mono: true });
    }
    s += txt(xL + pw / 2, H - 6, opt.xLabel || 'FPR', { size: 9, fill: C.ink3, anchor: 'middle', mono: true });
    s += txt(10, yT + ph / 2, opt.yLabel || 'TPR', { size: 9, fill: C.ink3, mono: true });
    if (opt.auc != null) s += txt(W - 16, yT + 12, 'AUC = ' + opt.auc, { size: 10, fill: opt.color || C.jade, anchor: 'end', mono: true, weight: '600' });
    return svg(W, H, s, opt.label || 'ROC / PR 曲线');
  }

  /* 9. 散点 + 拟合线：pts=[[x,y]], fit=[[x,y]], 可画残差带 */
  function scatter(pts, opt) {
    opt = opt || {};
    var W = 460, H = 260, xL = 46, yB = H - 34, yT = 20, pw = W - xL - 16, ph = yB - yT;
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = opt.xMin != null ? opt.xMin : Math.min.apply(null, xs), x1 = opt.xMax != null ? opt.xMax : Math.max.apply(null, xs);
    var y0 = opt.yMin != null ? opt.yMin : Math.min.apply(null, ys), y1 = opt.yMax != null ? opt.yMax : Math.max.apply(null, ys);
    if (x1 === x0) x1 = x0 + 1;
    if (y1 === y0) y1 = y0 + 1;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    s += '<line x1="' + xL + '" y1="' + yT + '" x2="' + xL + '" y2="' + yB + '" stroke="' + C.line2 + '"/>';
    s += '<line x1="' + xL + '" y1="' + yB + '" x2="' + (W - 16) + '" y2="' + yB + '" stroke="' + C.line2 + '"/>';
    pts.forEach(function (p) {
      var cx = xL + (p[0] - x0) / (x1 - x0) * pw, cy = yB - (p[1] - y0) / (y1 - y0) * ph;
      s += '<circle cx="' + n1(cx) + '" cy="' + n1(cy) + '" r="2.6" fill="' + (opt.color || C.blue) + '" opacity=".7"/>';
    });
    if (opt.fit) {
      var fl = opt.fit.map(function (p) { return n1(xL + (p[0] - x0) / (x1 - x0) * pw) + ',' + n1(yB - (p[1] - y0) / (y1 - y0) * ph); }).join(' ');
      s += '<polyline points="' + fl + '" fill="none" stroke="' + (opt.fitColor || C.clay) + '" stroke-width="1.8"/>';
    }
    if (opt.band) {
      var up = opt.band[0].map(function (p, i) { return n1(xL + (p[0] - x0) / (x1 - x0) * pw) + ',' + n1(yB - (p[1] - y0) / (y1 - y0) * ph); });
      var dn = opt.band[1].map(function (p) { return n1(xL + (p[0] - x0) / (x1 - x0) * pw) + ',' + n1(yB - (p[1] - y0) / (y1 - y0) * ph); });
      s += '<polygon points="' + up.concat(dn.reverse()).join(' ') + '" fill="' + (opt.fitColor || C.clay) + '" opacity=".12"/>';
    }
    s += txt(xL - 6, yB + 3.5, n1(y0), { size: 8, fill: C.ink4, anchor: 'end', mono: true });
    s += txt(xL - 6, yT + 8, n1(y1), { size: 8, fill: C.ink4, anchor: 'end', mono: true });
    s += txt(xL, H - 10, opt.xLabel || '真实值', { size: 9, fill: C.ink3, mono: true });
    s += txt(xL + pw, yB + 14, opt.x2Label || '', { size: 9, fill: C.ink4, anchor: 'end', mono: true });
    return svg(W, H, s, opt.label || '散点与拟合');
  }

  /* 10. 时序曲线 + 预测带：lines=[{name,color,vals}], band={vals:[lo,hi]} */
  function series(opt) {
    opt = opt || {};
    var W = 700, H = opt.height || 240, xL = 46, yB = H - 34, yT = 22, pw = W - xL - 16, ph = yB - yT;
    var lines = opt.lines || [];
    var max = opt.max || 0, min = opt.min || 0;
    lines.forEach(function (L) { L.vals.forEach(function (v) { if (v > max) max = v; if (v < min) min = v; }); });
    if (max === min) max = min + 1;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    for (var g = 0; g <= 4; g++) {
      var yy = yB - g / 4 * ph;
      s += '<line x1="' + xL + '" y1="' + n1(yy) + '" x2="' + (W - 16) + '" y2="' + n1(yy) + '" stroke="' + C.line + '"/>';
      s += txt(xL - 6, yy + 3.5, n1(min + (max - min) * g / 4), { size: 8, fill: C.ink4, anchor: 'end', mono: true });
    }
    if (opt.band) {
      var n = opt.band[0].length;
      var up = [], dn = [];
      for (var i = 0; i < n; i++) {
        var xx = xL + i / Math.max(1, n - 1) * pw;
        up.push(n1(xx) + ',' + n1(yB - (opt.band[1][i] - min) / (max - min) * ph));
        dn.push(n1(xx) + ',' + n1(yB - (opt.band[0][i] - min) / (max - min) * ph));
      }
      s += '<polygon points="' + up.concat(dn.reverse()).join(' ') + '" fill="' + (opt.bandColor || C.jade) + '" opacity=".14"/>';
    }
    lines.forEach(function (L) {
      var pts = L.vals.map(function (v, i) {
        return n1(xL + i / Math.max(1, L.vals.length - 1) * pw) + ',' + n1(yB - (v - min) / (max - min) * ph);
      }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" stroke="' + (L.color || C.blue) + '" stroke-width="' + (L.width || 1.5) + '"' +
        (L.dash ? ' stroke-dasharray="' + L.dash + '"' : '') + '/>';
    });
    /* x 轴刻度 */
    (opt.xTicks || []).forEach(function (t) {
      var xx = xL + t.at * pw;
      s += '<line x1="' + n1(xx) + '" y1="' + yB + '" x2="' + n1(xx) + '" y2="' + (yB + 4) + '" stroke="' + C.line2 + '"/>';
      s += txt(xx, yB + 15, t.label, { size: 8.5, fill: C.ink4, anchor: 'middle', mono: true });
    });
    /* 图例 */
    lines.forEach(function (L, k) {
      var lx = xL + k * 130;
      s += '<rect x="' + lx + '" y="8" width="9" height="9" rx="2" fill="' + (L.color || C.blue) + '"/>';
      s += txt(lx + 13, 16, L.name, { size: 9, fill: C.ink2 });
    });
    return svg(W, H, s, opt.label || '时序曲线');
  }

  /* 11. 能力雷达：dims=[{name, a, b}], names=['人工','AI'] */
  function radar(opt) {
    opt = opt || {};
    var dims = opt.dims || [], W = 380, H = 280, cx = W / 2, cy = H / 2 + 6, R = 96;
    var n = dims.length || 1;
    var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
    for (var ring = 1; ring <= 4; ring++) {
      var rr = R * ring / 4, pts = [];
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / n;
        pts.push(n1(cx + Math.cos(a) * rr) + ',' + n1(cy + Math.sin(a) * rr));
      }
      s += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + C.line + '"/>';
    }
    function poly(key, color) {
      var p = dims.map(function (d, i) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / n;
        var v = clamp(d[key] / (opt.max || 100), 0, 1) * R;
        return n1(cx + Math.cos(a) * v) + ',' + n1(cy + Math.sin(a) * v);
      }).join(' ');
      return '<polygon points="' + p + '" fill="' + color + '" opacity=".16"/>' +
        '<polygon points="' + p + '" fill="none" stroke="' + color + '" stroke-width="1.6"/>';
    }
    s += poly('a', opt.colorA || C.ink3);
    s += poly('b', opt.colorB || C.jade);
    dims.forEach(function (d, i) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      var lx = cx + Math.cos(a) * (R + 22), ly = cy + Math.sin(a) * (R + 22);
      s += txt(lx, ly + 3, d.name, { size: 9, fill: C.ink2, anchor: Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end') });
    });
    s += '<rect x="14" y="10" width="9" height="9" rx="2" fill="' + (opt.colorA || C.ink3) + '"/>' + txt(27, 18, (opt.names && opt.names[0]) || '人工', { size: 9, fill: C.ink2 });
    s += '<rect x="74" y="10" width="9" height="9" rx="2" fill="' + (opt.colorB || C.jade) + '"/>' + txt(87, 18, (opt.names && opt.names[1]) || 'AI 辅助', { size: 9, fill: C.ink2 });
    return svg(W, H, s, opt.label || '能力雷达图');
  }

  /* =========================================================
     四、小组件（HTML）
     ========================================================= */

  /* 12. 图注（与 .pviz / .figure 里的 .viz-cap 样式一致） */
  function cap(t) { return '<span class="viz-cap">' + rich(t) + '</span>'; }

  /* 13. 色例 */
  function legend(items) {
    return '<div class="viz-legend">' + items.map(function (it) {
      return '<span><i style="background:' + (it.color || C.ink3) + '"></i>' + rich(it.label) + '</span>';
    }).join('') + '</div>';
  }

  /* 14. 概念卡：给外行看的"术语 → 一句话 + 微图"
      items = [{term, plain, viz(svg字符串, 可选), unit}] */
  function concept(items, opt) {
    opt = opt || {};
    return '<div class="viz-concepts' + (opt.compact ? ' compact' : '') + '">' + items.map(function (it) {
      return '<div class="viz-c">' +
        '<div class="viz-c-h"><b>' + esc(it.term) + '</b>' + (it.unit ? '<span>' + esc(it.unit) + '</span>' : '') + '</div>' +
        (it.viz ? '<div class="viz-c-v">' + it.viz + '</div>' : '') +
        '<p>' + rich(it.plain) + '</p></div>';
    }).join('') + '</div>';
  }

  /* 15. 一步一图的流程步骤图（给 workflow.steps[].viz 用） */
  function stepViz(svgStr, caption) {
    return '<div class="viz">' + svgStr + (caption ? cap(caption) : '') + '</div>';
  }

  global.V = {
    C: C, esc: esc, rich: rich, svg: svg, txt: txt, box: box, wrap: wrap,
    /* 石油图元 */
    wellbore: wellbore, strata: strata, logTrack: logTrack,
    /* 流程 / 概念 */
    flow: flow, io: io,
    /* 结果图 */
    bars: bars, matrix: matrix, curve: curve, scatter: scatter, series: series, radar: radar,
    /* 小组件 */
    cap: cap, legend: legend, concept: concept, stepViz: stepViz
  };

  /* 顺手挂到 K 上，案例里写 K.V.xxx() 或 V.xxx() 都可以 */
  if (global.K) global.K.V = global.V;

})(window);
