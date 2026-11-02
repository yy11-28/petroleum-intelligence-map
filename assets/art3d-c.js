/* =========================================================
   场景档案头 3D 插画 · 第三批：co11–co20
   在 art3d-b.js 之后加载，继续扩展包装链。
   ========================================================= */
(function (g) {
  'use strict';
  var S = 'var(--navy, #22456B)', S2 = 'var(--navy-3, #8CA3BC)';
  var F1 = 'url(#g3-metal)', F2 = 'url(#g3-metal2)', F3 = 'var(--blue-l,#E8F0F8)';
  var JD = 'url(#g3-fluid)', AC = 'var(--clay,#C4703F)';

  var CSS = '<style>' +
    '@keyframes a3-dash{to{stroke-dashoffset:-34}}' +
    '@keyframes a3-dash-r{to{stroke-dashoffset:34}}' +
    '@keyframes a3-pulse{0%,100%{opacity:.15;transform:scale(.72)}50%{opacity:.65;transform:scale(1.12)}}' +
    '@keyframes a3-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}' +
    '@keyframes a3-rise{0%{transform:translateY(0);opacity:0}18%{opacity:.9}82%{opacity:.9}100%{transform:translateY(-30px);opacity:0}}' +
    '@keyframes a3-sink{0%{transform:translateY(-12px);opacity:0}20%{opacity:.9}100%{transform:translateY(46px);opacity:0}}' +
    '@keyframes a3-scan{0%,100%{transform:translateX(0)}50%{transform:translateX(120px)}}' +
    '@keyframes a3-oval{0%,100%{transform:scaleX(1)}50%{transform:scaleX(1.28)}}' +
    '@keyframes a3-glow{0%,100%{opacity:.3}50%{opacity:.85}}' +
    '@keyframes a3-bounce{0%,100%{transform:translateX(0);opacity:.85}50%{transform:translateX(-10px);opacity:.4}}' +
    '@keyframes a3-step{0%,100%{opacity:.35}50%{opacity:.95}}' +
    '@keyframes a3-drill{to{stroke-dashoffset:-60}}' +
    '.a3-f{animation:a3-dash 2.2s linear infinite}' +
    '.a3-fs{animation:a3-dash 3.4s linear infinite}' +
    '.a3-fr{animation:a3-dash-r 2.8s linear infinite}' +
    '.a3-dr{animation:a3-drill 1.8s linear infinite}' +
    '.a3-p{animation:a3-pulse 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.a3-fl{animation:a3-float 4.2s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-up{animation:a3-rise 3.4s ease-in infinite;transform-box:fill-box}' +
    '.a3-dn{animation:a3-sink 4s ease-in infinite;transform-box:fill-box}' +
    '.a3-sc{animation:a3-scan 4.5s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-ov{animation:a3-oval 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.a3-g{animation:a3-glow 2.8s ease-in-out infinite}' +
    '.a3-bn{animation:a3-bounce 1.6s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-st{animation:a3-step 2.8s ease-in-out infinite}' +
    '</style>';

  function wrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 230" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + CSS + inner + '</svg>';
  }
  function ln(x1, y1, x2, y2, c, w, dash, op, cls) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (c || S) + '" stroke-width="' + (w || 1.6) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + (cls ? ' class="' + cls + '"' : '') + ' stroke-linecap="round" opacity="' + (op == null ? .6 : op) + '"/>';
  }
  function ell(cx, cy, rx, ry, fill, stroke, w, op, cls) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || S2) + '" stroke-width="' + (w || 1.4) + '" opacity="' + (op == null ? .55 : op) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }
  function cyl(cx, yTop, rx, ry, h, fill, op, cls) {
    var s = '<path d="M' + (cx - rx) + ' ' + yTop + ' L' + (cx - rx) + ' ' + (yTop + h) + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + (yTop + h) + ' L' + (cx + rx) + ' ' + yTop + '" fill="' + (fill || F1) + '" stroke="' + S + '" stroke-width="1.6" opacity="' + (op == null ? .85 : op) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
    s += '<ellipse cx="' + cx + '" cy="' + yTop + '" rx="' + rx + '" ry="' + ry + '" fill="var(--blue-ll,#F3F7FB)" stroke="' + S + '" stroke-width="1.6" opacity=".9"' + (cls ? ' class="' + cls + '"' : '') + '/>';
    s += ln(cx - rx * .5, yTop + ry * .7, cx - rx * .5, yTop + h - 2, '#fff', 2.4, null, .6);
    return s;
  }
  function band(x, y, w, h, op) {
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="url(#g3-rock)" stroke="none" opacity="' + (op || .4) + '"/>';
    s += ln(x, y, x + w, y, S2, 1.2, '5 6', .35);
    for (var i = 0; i < w; i += 34) s += ln(x + i, y + h, x + i + h * .8, y, S2, 1, null, .16);
    return s;
  }
  function wellpair(cx, y0, y1, gap) {
    return ln(cx - gap, y0, cx - gap, y1, S, 2, null, .8) + ln(cx + gap, y0, cx + gap, y1, S, 2, null, .8) + ell(cx, y0, gap, gap * .32, 'var(--blue-ll,#F3F7FB)', S, 1.6, .9);
  }

  /* co11 固井质量评价：三环纵剖 + 声波扫描线 + 胶结好/差段 */
  function co11() {
    var s = band(20, 60, 660, 34, .35) + band(20, 160, 660, 50, .3);
    /* 三层：地层 | 水泥环 | 套管 | 井内 */
    s += ln(120, 40, 120, 196, S, 2, null, .6);
    s += ln(168, 40, 168, 196, S, 1.8, null, .7);
    s += ln(210, 40, 210, 196, S, 1.8, null, .7);
    s += ln(252, 40, 252, 196, S, 2, null, .6);
    s += ell(186, 40, 66, 14, 'var(--blue-ll,#F3F7FB)', S, 1.5, .7);
    s += ell(186, 40, 21, 6.5, F3, S, 1.4, .8);
    /* 胶结好段（绿）/ 差段（红，微环隙） */
    s += '<rect x="122" y="70" width="44" height="60" fill="url(#g3-cem)" opacity=".65"/>';
    s += '<rect x="122" y="130" width="44" height="30" fill="url(#g3-cem)" opacity=".2"/>';
    s += '<rect x="122" y="160" width="44" height="36" fill="url(#g3-cem)" opacity=".6"/>';
    s += ell(144, 145, 30, 12, 'none', AC, 1.8, .6, 'a3-p');
    s += ln(122, 145, 166, 145, AC, 1.2, '3 3', .6);
    /* 声波扫描线（左右横扫） */
    s += '<g class="a3-sc">' + ln(110, 44, 110, 196, JD, 1.8, null, .75) + ln(118, 44, 118, 196, JD, 1, null, .4) + '</g>';
    /* 右侧：CBL/VDL 波形（好段平直、差段摆动） */
    s += ln(330, 50, 330, 190, S2, 1.2, null, .5) + ln(330, 190, 620, 190, S2, 1.2, null, .5);
    s += '<path d="M340 70 L410 72" stroke="' + JD + '" stroke-width="2" fill="none" opacity=".85"/>';
    s += '<path d="M410 72 q8 -16 16 0 q8 16 16 0 q8 -16 16 0 q8 16 16 0" stroke="' + AC + '" stroke-width="2" fill="none" opacity=".9"/>';
    s += '<path d="M474 74 L560 74 L560 78 L340 78" stroke="' + JD + '" stroke-width="1.6" fill="none" opacity=".6"/>';
    s += ln(410, 50, 410, 190, AC, 1.2, '5 4', .55);
    s += ell(410, 72, 12, 24, 'none', AC, 1.5, .45, 'a3-p');
    /* 测井仪器（下行） */
    s += cyl(186, 18, 9, 3.5, 16, F2, .9);
    s += ln(186, 8, 186, 18, S2, 1.1, '3 4', .5, 'a3-fs');
    return wrap(s);
  }

  /* co12 完井作业风险预警：井筒多风险点 + 警示脉冲 + 数据流 */
  function co12() {
    var s = band(20, 150, 660, 60, .4);
    /* 井架 + 井筒 + 管柱 */
    s += '<path d="M96 74 L112 18 L146 18 L162 74" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".7"/>';
    s += ln(88, 74, 170, 74, S, 2, null, .7);
    s += wellpair(129, 78, 196, 18);
    s += ln(129, 78, 129, 196, S2, 2.4, null, .55);
    /* 三个风险点：井漏/卡管/高压层 */
    s += ell(129, 100, 40, 13, 'none', AC, 1.8, .6, 'a3-p');
    s += ell(129, 100, 54, 17, 'none', AC, 1, .3, 'a3-p');
    s += ell(129, 148, 36, 12, 'none', AC, 1.8, .6, 'a3-p');
    s += ell(129, 172, 30, 10, 'none', AC, 1.8, .6, 'a3-p');
    /* 风险点漏失箭头（向地层） */
    s += ln(170, 100, 230, 100, AC, 2, '6 6', .7, 'a3-f');
    s += ln(170, 148, 230, 148, AC, 2, '6 6', .7, 'a3-f');
    /* 右侧：监测仪表板（多条曲线 + 报警阈值） */
    s += ln(300, 40, 300, 190, S2, 1.2, null, .5) + ln(300, 190, 640, 190, S2, 1.2, null, .5);
    s += '<path d="M310 90 C340 84 360 100 380 92 C400 84 420 108 440 96 C460 86 480 112 500 100 C520 90 560 106 620 96" fill="none" stroke="' + JD + '" stroke-width="1.8" opacity=".85"/>';
    s += '<path d="M310 130 C350 126 380 140 410 132 C440 124 470 146 500 136 C530 128 580 148 620 138" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".7"/>';
    s += '<path d="M310 168 L380 160 L430 172 L490 156 L540 168 L620 158" stroke="' + AC + '" stroke-width="1.8" fill="none" opacity=".85"/>';
    s += ln(300, 118, 640, 118, AC, 1.2, '7 5', .55, 'a3-g');
    s += ell(490, 158, 10, 22, 'none', AC, 1.5, .5, 'a3-p');
    /* 警示菱形 */
    s += '<path d="M660 108 l12 12 l-12 12 l-12 -12 z" fill="' + AC + '" opacity=".8" class="a3-g"/>';
    return wrap(s);
  }

  /* co13 井下监测配置：传感器节点 + 信号上行 */
  function co13() {
    var s = band(20, 158, 660, 52, .4);
    s += wellpair(150, 30, 196, 24);
    /* 4 个传感器节点（不同深度，型号不同色） */
    [64, 104, 144, 176].forEach(function (y, i) {
      s += '<g class="a3-fl" style="animation-delay:' + i * .5 + 's">';
      s += '<rect x="' + (150 - 14) + '" y="' + y + '" width="28" height="14" rx="4" fill="' + (i % 2 ? F2 : F1) + '" stroke="' + S + '" stroke-width="1.5"/>';
      s += ell(150, y + 7, 5, 2.2, i < 2 ? JD : AC, S, 1.1, .9);
      s += '</g>';
      /* 信号波上行（错相） */
      s += ln(176, y + 7, 250, y + 7 - (176 - y) * .3, i % 2 ? JD : AC, 1.6, '5 5', .6, 'a3-fs');
    });
    /* 缆线 */
    s += ln(150, 30, 150, 16, S, 1.6, null, .6);
    s += '<rect x="230" y="12" width="66" height="24" rx="5" fill="' + F3 + '" stroke="' + S + '" stroke-width="1.4"/>';
    s += '<path d="M240 24 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" fill="none" stroke="' + JD + '" stroke-width="1.4" opacity=".8" class="a3-g"/>';
    /* 右侧：覆盖度-成本权衡 */
    s += ln(400, 50, 400, 190, S2, 1.2, null, .5) + ln(400, 190, 620, 190, S2, 1.2, null, .5);
    s += '<path d="M410 178 C450 160 480 120 500 92 C515 70 540 58 600 52" fill="none" stroke="' + JD + '" stroke-width="2" opacity=".85"/>';
    s += '<path d="M410 184 C460 178 520 166 600 152" fill="none" stroke="' + AC + '" stroke-width="1.8" stroke-dasharray="7 5" opacity=".8"/>';
    [0, 1, 2].forEach(function (i) {
      var px = 470 + i * 50, py = 100 + i * 26;
      s += ell(px, py, 9, 20, 'none', i === 1 ? AC : S2, 1.4, i === 1 ? .55 : .3, i === 1 ? 'a3-p' : '');
    });
    return wrap(s);
  }

  /* co14 投产制度优化：油嘴开度 + 地面流程 + 产量响应 */
  function co14() {
    var s = band(20, 156, 660, 54, .4);
    /* 井口采油树 */
    s += wellpair(150, 60, 196, 20);
    s += ln(130, 60, 170, 60, S, 2.2, null, .8);
    s += ln(150, 60, 150, 34, S, 2.2, null, .8);
    s += ln(150, 44, 210, 44, S, 2, null, .8);
    /* 油嘴（开度变化） */
    s += '<path d="M210 36 L226 44 L210 52 Z" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.5" class="a3-g"/>';
    s += ln(226, 44, 300, 44, JD, 3, '9 9', .75, 'a3-f');
    /* 分离器 */
    s += cyl(340, 26, 30, 9, 36, F1, .9);
    s += ln(310, 44, 310, 40, S, 1.6, null, .5);
    s += ln(370, 44, 420, 44, JD, 2.6, '8 9', .7, 'a3-fs');
    /* 储罐 */
    s += cyl(460, 18, 26, 8, 34, F2, .9);
    s += ln(486, 34, 520, 34, S2, 1.6, null, .5);
    /* 右下：产量-流压曲线 + 工作点 */
    s += ln(300, 100, 300, 196, S2, 1.2, null, .5) + ln(300, 196, 580, 196, S2, 1.2, null, .5);
    s += '<path d="M310 110 C360 120 420 140 470 164 C500 178 540 188 570 192" fill="none" stroke="' + S + '" stroke-width="2.2" opacity=".85"/>';
    s += '<path d="M310 130 C360 148 420 168 480 182 C520 190 550 193 570 194" fill="none" stroke="' + JD + '" stroke-width="2" stroke-dasharray="8 6" opacity=".8" class="a3-fs"/>';
    s += ell(470, 164, 11, 24, 'none', AC, 1.8, .6, 'a3-p');
    s += ln(470, 164, 470, 196, AC, 1.2, '4 4', .55);
    s += ln(470, 164, 300, 164, AC, 1.2, '4 4', .55);
    /* 调参箭头 */
    s += '<path d="M600 120 l30 0 m-8 -7 l8 7 l-8 7" fill="none" stroke="' + AC + '" stroke-width="1.8" opacity=".8" class="a3-fl"/>';
    return wrap(s);
  }

  /* co15 完井后反演复盘：数据回流 + 实测/预测双曲线对比 */
  function co15() {
    var s = band(20, 150, 660, 60, .4);
    /* 井筒 + 实测产液剖面（粒子） */
    s += wellpair(140, 36, 196, 22);
    [70, 106, 142, 172].forEach(function (y, i) {
      s += ell(140, y, 30 - i * 3, 8, 'none', S2, 1.2, .4);
      for (var k = 0; k < 2; k++) s += '<circle cx="' + (150 + k * 12) + '" cy="' + y + '" r="2.6" fill="' + JD + '" class="a3-up" style="animation-delay:' + (i * .6 + k * .4) + 's"/>';
    });
    /* 地面数据箱 + 回流箭头（时间回溯） */
    s += '<rect x="220" y="20" width="70" height="30" rx="6" fill="' + F3 + '" stroke="' + S + '" stroke-width="1.5"/>';
    s += '<path d="M232 36 q7 -10 14 0 q7 10 14 0 q7 -10 14 0" fill="none" stroke="' + JD + '" stroke-width="1.5" opacity=".85" class="a3-g"/>';
    s += ln(206, 35, 220, 35, JD, 1.8, '5 5', .7, 'a3-fr');
    /* 反演回路：地面→模型→井筒参数 */
    s += '<path d="M255 50 L255 84 L420 84" fill="none" stroke="' + S2 + '" stroke-width="1.4" stroke-dasharray="5 5" opacity=".55" class="a3-fr"/>';
    s += '<rect x="420" y="66" width="120" height="36" rx="7" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.5"/>';
    s += '<path d="M432 84 L448 84 L456 74 L464 94 L472 84 L500 84" fill="none" stroke="' + JD + '" stroke-width="1.6" opacity=".85"/>';
    /* 右侧：预测 vs 实测双曲线（偏差区着色） */
    s += ln(580, 40, 580, 190, S2, 1.1, null, .5) + ln(580, 190, 690, 190, S2, 1.1, null, .5);
    s += '<path d="M590 60 C615 80 635 110 650 140 C660 160 672 176 684 184" fill="none" stroke="' + S + '" stroke-width="2" opacity=".85"/>';
    s += '<path d="M590 72 C615 88 635 114 650 142 C660 160 672 175 684 182" fill="none" stroke="' + JD + '" stroke-width="2" stroke-dasharray="7 5" opacity=".85" class="a3-fs"/>';
    s += '<path d="M590 60 C615 80 635 110 650 140 C660 160 672 176 684 184 L684 182 C672 175 660 160 650 142 C635 114 615 88 590 72 Z" fill="url(#g3-cem)" opacity=".3"/>';
    return wrap(s);
  }

  /* co16 老井复产与侧钻：老井筒 + 侧钻窗口钻进 */
  function co16() {
    var s = band(20, 150, 660, 60, .4);
    /* 老井筒（灰色调 = 老井） */
    s += wellpair(150, 30, 196, 24);
    s += ln(150, 30, 150, 16, S2, 1.6, null, .5);
    /* 老射孔段（失效，暗色） */
    [96, 128].forEach(function (y, i) {
      for (var k = 0; k < 3; k++) s += ln(174, y + k * 4, 190, y + 5 + k * 4, S2, 1.8, null, .5);
    });
    /* 侧钻窗口（斜向器）+ 新井眼钻进（dash 生长） */
    s += ln(174, 152, 148, 172, S, 2.2, null, .85);
    s += '<path d="M160 160 C220 150 280 140 360 138 C420 136 480 140 540 146" fill="none" stroke="' + JD + '" stroke-width="3" stroke-dasharray="14 8" opacity=".9" class="a3-dr"/>';
    s += '<path d="M160 168 C230 162 300 154 380 152 C440 151 500 154 560 158" fill="none" stroke="' + JD + '" stroke-width="2" stroke-dasharray="10 8" opacity=".6" class="a3-dr" style="animation-duration:2.6s"/>';
    /* 钻头（前进） */
    s += '<g class="a3-fl"><path d="M540 140 l16 5 l-16 5 z" fill="' + AC + '" stroke="' + S + '" stroke-width="1.2"/></g>';
    /* 新井眼射孔（新产能，绿色脉冲） */
    s += ell(480, 148, 40, 13, 'none', JD, 1.8, .55, 'a3-p');
    s += ell(480, 148, 56, 18, 'none', JD, 1, .3, 'a3-p');
    /* 右下：老井产量衰减 vs 侧钻后恢复 */
    s += ln(300, 60, 300, 110, S2, 1.1, null, .4) + ln(300, 110, 660, 110, S2, 1.1, null, .4);
    s += '<path d="M310 66 C360 76 420 88 470 96 C520 102 580 106 650 108" fill="none" stroke="' + AC + '" stroke-width="1.8" stroke-dasharray="6 5" opacity=".7"/>';
    s += '<path d="M470 96 C520 84 580 72 650 64" fill="none" stroke="' + JD + '" stroke-width="2.2" opacity=".9" class="a3-fs"/>';
    s += ell(470, 96, 9, 18, 'none', AC, 1.5, .5, 'a3-p');
    return wrap(s);
  }

  /* co17 井组协同优化：多口井 3D + 井间干扰波 */
  function co17() {
    var s = band(20, 140, 660, 70, .4);
    /* 三口井（不同深度地面点） */
    var wells = [[170, 26], [340, 40], [510, 26]];
    wells.forEach(function (w, i) {
      var cx = w[0], y0 = w[1];
      s += ln(cx - 18, y0, cx - 18, 150, S, 2, null, .8) + ln(cx + 18, y0, cx + 18, 150, S, 2, null, .8);
      s += ell(cx, y0, 18, 6, 'var(--blue-ll,#F3F7FB)', S, 1.5, .9);
      s += ln(cx - 30, y0, cx + 30, y0, S, 1.8, null, .6);
      /* 各井射孔段 + 产液粒子 */
      [96 + i * 8, 124 + i * 6].forEach(function (y) {
        for (var k = 0; k < 3; k++) s += ln(cx - 18, y + k * 4, cx - 36, y + 6 + k * 4, i === 1 ? AC : S2, 1.6, null, i === 1 ? .8 : .5);
      });
      if (i === 1) s += ell(cx, 118, 44, 14, 'none', AC, 1.6, .5, 'a3-p');
      s += '<circle cx="' + (cx + 8) + '" cy="' + (60 + i * 10) + '" r="2.8" fill="' + JD + '" class="a3-up" style="animation-delay:' + i * .8 + 's"/>';
    });
    /* 井间干扰波（双向流动虚线） */
    s += ln(196, 70, 314, 78, S2, 1.4, '6 6', .55, 'a3-f');
    s += ln(366, 78, 484, 70, S2, 1.4, '6 6', .55, 'a3-fr');
    /* 地面管网汇流 */
    s += ln(170, 26, 170, 14, S, 1.5, null, .5);
    s += ln(170, 14, 510, 14, S2, 1.4, '4 5', .45);
    s += ln(340, 40, 340, 14, S2, 1.2, '3 5', .4);
    s += ln(510, 26, 510, 14, S2, 1.2, '3 5', .4);
    s += ln(510, 14, 560, 14, JD, 2.4, '8 8', .7, 'a3-f');
    /* 右下：井组产量叠加柱（阶梯点亮） */
    s += ln(580, 60, 580, 196, S2, 1.1, null, .4) + ln(580, 196, 690, 196, S2, 1.1, null, .4);
    [0, 1, 2, 3].forEach(function (i) {
      var h = 26 + i * 14;
      s += '<rect x="' + (596 + i * 22) + '" y="' + (196 - h) + '" width="14" height="' + h + '" rx="3" fill="' + (i === 3 ? 'url(#g3-cem)' : F3) + '" stroke="' + S + '" stroke-width="1.2" opacity=".85" class="' + (i === 3 ? 'a3-g' : 'a3-st') + '" style="animation-delay:' + i * .5 + 's"/>';
    });
    return wrap(s);
  }

  /* co18 全生命周期成本：井筒 + 阶段成本阶梯 + 时间轴 */
  function co18() {
    var s = band(20, 150, 660, 60, .4);
    s += wellpair(130, 34, 196, 22);
    /* 各阶段小图标（钻/完/采/修）挂时间轴 */
    s += ln(60, 196, 660, 196, S2, 1.2, null, .5);
    var phases = [[110, F1], [210, F2], [310, F1], [410, F2], [510, F1], [610, F2]];
    phases.forEach(function (ph, i) {
      s += '<rect x="' + (ph[0] - 16) + '" y="' + (150 - 20 - i * 8) + '" width="32" height="' + (20 + i * 8) + '" rx="4" fill="' + ph[1] + '" stroke="' + S + '" stroke-width="1.4" opacity=".9" class="a3-st" style="animation-delay:' + i * .45 + 's"/>';
      s += ln(ph[0], 196, ph[0], 192, S, 1.4, null, .5);
    });
    /* 成本累计曲线（阶梯上升） */
    s += '<path d="M94 170 L126 158 L158 158 L190 146 L222 146 L254 128 L286 128 L318 116 L350 116 L382 100 L414 100 L446 88 L478 88 L510 76 L542 76 L574 66 L606 66 L638 58" fill="none" stroke="' + JD + '" stroke-width="2" opacity=".85" class="a3-fs"/>';
    /* NPV 转正点（脉冲） */
    s += ell(410, 100, 16, 30, 'none', AC, 1.8, .6, 'a3-p');
    s += ln(410, 100, 410, 196, AC, 1.2, '4 4', .55);
    /* 井侧：修井作业小箭头 */
    s += ln(152, 90, 108, 90, AC, 1.6, '5 5', .6, 'a3-bn');
    s += ln(152, 130, 108, 130, AC, 1.6, '5 5', .6, 'a3-bn');
    /* 方案对比双阶梯 */
    s += ln(210, 40, 210, 120, S2, 1.1, null, .4) + ln(210, 120, 660, 120, S2, 1.1, null, .4);
    s += '<path d="M220 112 L300 104 L380 92 L460 84 L540 78 L640 72" fill="none" stroke="' + JD + '" stroke-width="2" opacity=".85"/>';
    s += '<path d="M220 114 L300 110 L380 104 L460 102 L540 100 L640 100" fill="none" stroke="' + AC + '" stroke-width="1.8" stroke-dasharray="7 5" opacity=".75"/>';
    return wrap(s);
  }

  /* co19 套管完整性：截面椭圆化变形 + 错断 + 裂纹 */
  function co19() {
    var s = band(20, 150, 660, 60, .4);
    /* 井筒纵剖 + 变形段（缩径） */
    s += wellpair(150, 36, 196, 26);
    /* 变形段：壁内收（椭圆化脉冲） */
    s += '<path d="M124 100 Q150 112 176 100 L176 136 Q150 124 124 136 Z" fill="url(#g3-rock)" opacity=".5" class="a3-ov"/>';
    s += ell(150, 118, 30, 11, 'none', AC, 1.8, .6, 'a3-p');
    /* 裂纹（斜线簇） */
    s += ln(124, 108, 118, 96, AC, 1.4, null, .8) + ln(176, 108, 182, 96, AC, 1.4, null, .8);
    s += ln(128, 130, 122, 140, AC, 1.2, null, .7) + ln(172, 130, 178, 140, AC, 1.2, null, .7);
    /* 错断（断层上下盘错位） */
    s += ln(210, 40, 210, 196, S2, 1.4, '6 4', .5);
    s += ln(176, 168, 210, 176, AC, 2, null, .7);
    /* 右侧：截面视图（正圆→椭圆变形动画） */
    s += ell(380, 110, 52, 52, F1, S, 2, .85);
    s += ell(380, 110, 34, 34, F3, S, 1.5, .7);
    s += ell(380, 110, 52, 52, 'none', AC, 2, .6, 'a3-ov');
    /* 变形前虚线圆 */
    s += ell(380, 110, 60, 60, 'none', S2, 1.2, '5 5', .4);
    /* 右二：磨损壁厚减薄（双弧） */
    s += '<path d="M470 70 a40 40 0 0 0 0 80" fill="none" stroke="' + S + '" stroke-width="5" opacity=".8"/>';
    s += '<path d="M470 76 a34 34 0 0 0 0 68" fill="none" stroke="' + AC + '" stroke-width="3" stroke-dasharray="5 4" opacity=".75" class="a3-g"/>';
    /* 最右：剩余强度柱（警戒线） */
    s += ln(560, 60, 560, 196, S2, 1.1, null, .45) + ln(560, 196, 680, 196, S2, 1.1, null, .45);
    s += '<rect x="580" y="90" width="20" height="106" rx="3" fill="url(#g3-cem)" opacity=".7" class="a3-st"/>';
    s += '<rect x="610" y="120" width="20" height="76" rx="3" fill="' + F3 + '" stroke="' + S + '" stroke-width="1.2" class="a3-st" style="animation-delay:.5s"/>';
    s += '<rect x="640" y="150" width="20" height="46" rx="3" fill="' + AC + '" opacity=".55" class="a3-st" style="animation-delay:1s"/>';
    s += ln(560, 100, 680, 100, AC, 1.2, '6 4', .6, 'a3-g');
    return wrap(s);
  }

  /* co20 报废井封堵：桥塞 + 水泥塞 3D + 底水被挡 */
  function co20() {
    var s = band(20, 60, 660, 36, .35) + band(20, 160, 660, 50, .3);
    s += wellpair(160, 34, 196, 24);
    s += ln(160, 34, 160, 20, S2, 1.6, null, .5);
    s += ln(140, 20, 180, 20, S, 1.8, null, .6);
    /* 上水泥塞（斜纹） */
    s += '<rect x="146" y="60" width="28" height="34" rx="3" fill="url(#g3-cem)" opacity=".55" stroke="' + S + '" stroke-width="1.5"/>';
    for (var i = 0; i < 6; i++) s += ln(146, 66 + i * 5, 174, 61 + i * 5, S, 1, null, .5);
    /* 桥塞 ×2（胶囊 + 卡瓦） */
    [116, 138].forEach(function (y, i) {
      s += '<g class="a3-fl" style="animation-delay:' + i * .6 + 's">';
      s += '<rect x="146" y="' + y + '" width="28" height="12" rx="5" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6"/>';
      s += ln(142, y - 2, 146, y + 14, S, 1.4, null, .7) + ln(178, y - 2, 174, y + 14, S, 1.4, null, .7);
      s += '</g>';
    });
    /* 两塞之间水泥塞 */
    s += '<rect x="146" y="100" width="28" height="16" rx="3" fill="url(#g3-cem)" opacity=".4" stroke="' + S2 + '" stroke-width="1.3"/>';
    /* 底部射孔段 + 底水箭头被挡（反弹） */
    for (i = 0; i < 3; i++) s += ln(184, 172 + i * 6, 202, 168 + i * 6, S2, 1.5, null, .55);
    s += ln(260, 184, 218, 184, '#5b8ec4', 2.2, '7 6', .7, 'a3-bn');
    s += '<path d="M214 184 l10 -5 l0 10 z" fill="#5b8ec4" opacity=".7" class="a3-bn"/>';
    /* 隔离层界线 */
    s += ln(60, 96, 660, 96, S2, 1.2, '5 6', .4);
    /* 右侧：屏障完整性验证（压力测试曲线稳定） */
    s += ln(320, 60, 320, 190, S2, 1.1, null, .45) + ln(320, 190, 640, 190, S2, 1.1, null, .45);
    s += '<path d="M330 80 C350 100 370 130 385 150 C398 166 410 172 424 172 L620 172" fill="none" stroke="' + JD + '" stroke-width="2" opacity=".9"/>';
    s += ell(430, 172, 12, 22, 'none', JD, 1.5, .5, 'a3-p');
    s += '<path d="M330 92 C360 120 400 150 440 160 L620 160" fill="none" stroke="' + AC + '" stroke-width="1.6" stroke-dasharray="7 5" opacity=".6"/>';
    s += ell(560, 120, 30, 12, 'none', S2, 1.2, .35, 'a3-g');
    return wrap(s);
  }

  var T = {
    co11: co11, co12: co12, co13: co13, co14: co14, co15: co15,
    co16: co16, co17: co17, co18: co18, co19: co19, co20: co20
  };
  var prev = g.SCENE_ART;
  g.ART3D_C = T;
  g.SCENE_ART = function (id) {
    var f = T[id];
    if (f) return f();
    return prev ? prev(id) : '';
  };
})(window);
