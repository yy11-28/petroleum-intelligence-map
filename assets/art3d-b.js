/* =========================================================
   场景档案头 3D 插画 · 第二批：co1–co20（完井全部旧案例）
   等轴测 3D + 主题化动画，风格与 art3d.js 一致。
   在 art3d.js 之后加载，包装链：B 表优先 → ART3D → 原 SCENE_ART。
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
    '@keyframes a3-slide{0%,100%{transform:translateX(0)}50%{transform:translateX(9px)}}' +
    '@keyframes a3-grow{0%,100%{transform:scaleX(.55)}50%{transform:scaleX(1.25)}}' +
    '@keyframes a3-glow{0%,100%{opacity:.3}50%{opacity:.85}}' +
    '@keyframes a3-shot{0%,100%{opacity:.15}12%{opacity:1}}' +
    '@keyframes a3-recip{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}' +
    '@keyframes a3-draw{from{stroke-dashoffset:420}to{stroke-dashoffset:0}}' +
    '.a3-f{animation:a3-dash 2.2s linear infinite}' +
    '.a3-fs{animation:a3-dash 3.4s linear infinite}' +
    '.a3-fr{animation:a3-dash-r 2.8s linear infinite}' +
    '.a3-p{animation:a3-pulse 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.a3-fl{animation:a3-float 4.2s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-up{animation:a3-rise 3.4s ease-in infinite;transform-box:fill-box}' +
    '.a3-dn{animation:a3-sink 4s ease-in infinite;transform-box:fill-box}' +
    '.a3-sl{animation:a3-slide 3.6s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-gw{animation:a3-grow 3.2s ease-in-out infinite;transform-box:fill-box;transform-origin:left center}' +
    '.a3-g{animation:a3-glow 2.8s ease-in-out infinite}' +
    '.a3-sh{animation:a3-shot 2.8s linear infinite}' +
    '.a3-rc{animation:a3-recip 2.2s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-dw{stroke-dasharray:420;animation:a3-draw 3s ease-out both}' +
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
  function wellpair(cx, y0, y1, gap) { /* 双壁井筒 */
    return ln(cx - gap, y0, cx - gap, y1, S, 2, null, .8) + ln(cx + gap, y0, cx + gap, y1, S, 2, null, .8) + ell(cx, y0, gap, gap * .32, 'var(--blue-ll,#F3F7FB)', S, 1.6, .9);
  }

  /* co1 完井方式优选：三种完井结构对比，选中者脉冲 */
  function co1() {
    var s = band(20, 150, 660, 60, .4);
    var xs = [140, 340, 540], names = 0;
    xs.forEach(function (cx, i) {
      var sel = i === 1;
      s += wellpair(cx, 40, 168, 26);
      s += ell(cx, 168, 26, 8, sel ? JD : 'none', S, 1.6, sel ? .8 : .3);
      if (i === 0) { /* 裸眼 */
        s += ell(cx, 150, 34, 10, 'none', S2, 1.2, .5, 'a3-g');
      } else if (i === 1) { /* 射孔：孔眼发光序列 */
        for (var k = 0; k < 4; k++) s += ln(cx - 22 + k * 15, 122 + k * 3, cx - 40 + k * 15, 138 + k * 3, AC, 2.2, null, .9, 'a3-sh').replace('class', 'class');
        for (k = 0; k < 4; k++) s += ln(cx + 22 - k * 15, 122 + k * 3, cx + 40 - k * 15, 138 + k * 3, AC, 2.2, null, .9, 'a3-sh');
        s += ell(cx, 122, 48, 15, 'none', AC, 1.6, .5, 'a3-p');
      } else { /* 筛管：缝眼 */
        for (var m = 0; m < 6; m++) s += ln(cx - 20 + m * 8, 116, cx - 20 + m * 8, 136, S, 1.4, null, .7);
        for (m = 0; m < 3; m++) s += '<circle cx="' + (cx - 16 + m * 16) + '" cy="150" r="2.8" fill="' + JD + '" opacity=".85" class="a3-up" style="animation-delay:' + m * .7 + 's"/>';
      }
      /* 产液粒子（选中井更强） */
      if (sel) for (var j = 0; j < 3; j++) s += '<circle cx="' + (cx - 10 + j * 10) + '" cy="' + (80 + j * 6) + '" r="3" fill="' + JD + '" class="a3-up" style="animation-delay:' + j * .8 + 's"/>';
      s += ln(cx - 40, 40, cx + 40, 40, S, 2, null, .7);
    });
    /* 井间对比连线 */
    s += ln(180, 60, 300, 60, S2, 1.2, '5 5', .45, 'a3-fs');
    s += ln(380, 60, 500, 60, S2, 1.2, '5 5', .45, 'a3-fs');
    return wrap(s);
  }

  /* co2 射孔参数设计：射孔弹链 + 孔道穿透三介质 */
  function co2() {
    var s = band(20, 60, 660, 34, .35) + band(20, 160, 660, 50, .3);
    /* 套管双壁 + 水泥环 */
    s += ln(160, 40, 160, 196, S, 2.4, null, .85);
    s += ln(200, 40, 200, 196, S, 2.4, null, .85);
    s += ell(180, 40, 20, 7, 'var(--blue-ll,#F3F7FB)', S, 1.6, .9);
    s += ln(146, 40, 146, 196, S2, 1.4, null, .5) + ln(214, 40, 214, 196, S2, 1.4, null, .5);
    /* 射孔孔道：斜穿水泥环入地层，闪光序列 */
    for (var i = 0; i < 4; i++) {
      var y = 66 + i * 34;
      s += ln(200, y, 250, y + 16, AC, 2.6, null, .85, 'a3-sh');
      s += ln(214, y, 250, y + 16, 'var(--white,#fff)', 1.4, null, .7, 'a3-sh');
      s += ell(254, y + 17, 12, 4.5, 'none', AC, 1.6, .55, 'a3-p');
    }
    /* 左侧弹架：射孔弹（相位） */
    for (i = 0; i < 3; i++) {
      s += '<g class="a3-fl" style="animation-delay:' + i * .5 + 's">';
      s += '<path d="M120 ' + (76 + i * 34) + ' l16 6 l-16 6 z" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4"/>';
      s += '</g>';
    }
    s += ln(120, 60, 120, 180, S2, 1.2, '3 5', .5);
    /* 右侧：孔密/相位刻度弧 */
    s += ell(430, 120, 150, 60, 'none', S2, 1.2, .3);
    s += ell(430, 120, 100, 40, 'none', S2, 1.1, .25, 'a3-g');
    for (i = 0; i < 8; i++) {
      var a = Math.PI * i / 7, x1 = 430 + 100 * Math.cos(a), y1 = 120 - 40 * Math.sin(a), x2 = 430 + 150 * Math.cos(a), y2 = 120 - 60 * Math.sin(a);
      s += ln(x1, y1, x2, y2, i % 2 ? S2 : AC, 1.3, null, i % 2 ? .3 : .55, i % 2 ? '' : 'a3-sh');
    }
    return wrap(s);
  }

  /* co3 管柱受力：正弦屈曲 3D 管柱 + 中性点脉冲 */
  function co3() {
    var s = band(20, 150, 660, 60, .4);
    s += wellpair(140, 36, 196, 30);
    /* 屈曲管柱：正弦波（自上而下增幅） */
    var p = 'M140 44';
    for (var i = 0; i < 26; i++) {
      var y = 44 + i * 5.6, amp = Math.pow(i / 26, 2) * 22;
      p += ' L' + (140 + amp * Math.sin(i * 1.15)) + ' ' + y;
    }
    s += '<path d="' + p + '" fill="none" stroke="' + S + '" stroke-width="3.2" opacity=".9"/>';
    s += '<path d="' + p + '" fill="none" stroke="var(--white,#fff)" stroke-width="1.2" opacity=".6"/>';
    /* 中性点：上部受拉（直）/下部受压（屈曲）分界脉冲 */
    s += ell(140, 120, 46, 15, 'none', AC, 1.8, .6, 'a3-p');
    s += ln(90, 120, 190, 120, AC, 1.2, '5 4', .5);
    /* 力箭头：上拉下压 */
    s += ln(206, 60, 206, 30, AC, 2, null, .8) + '<path d="M206 26 l-6 10 l12 0 z" fill="' + AC + '" opacity=".85"/>';
    s += ln(206, 160, 206, 196, JD, 2, null, .8) + '<path d="M206 200 l-6 -10 l12 0 z" fill="#2f7d6b" opacity=".85"/>';
    /* 右侧：载荷沿井深曲线（梯度着色） */
    s += ln(320, 40, 320, 200, S2, 1.2, null, .5) + ln(320, 200, 620, 200, S2, 1.2, null, .5);
    s += '<path d="M330 48 C380 70 420 100 440 124 C460 150 500 172 600 184" fill="none" stroke="' + S + '" stroke-width="2.2" opacity=".8"/>';
    s += '<path d="M330 48 C380 70 420 100 440 124 C460 150 500 172 600 184 L600 200 L330 200 Z" fill="url(#g3-cem)" opacity=".28"/>';
    s += ln(440, 124, 440, 200, AC, 1.3, '5 4', .55);
    s += ell(440, 124, 10, 26, 'none', AC, 1.6, .4, 'a3-p');
    s += ln(330, 48, 620, 48, S2, 1, '4 6', .35, 'a3-fs');
    return wrap(s);
  }

  /* co4 滑套控制：内套滑动开窗 + 流体经窗进入 */
  function co4() {
    var s = band(20, 156, 660, 54, .4);
    /* 井筒外壁 */
    s += wellpair(160, 36, 196, 34);
    /* 滑套外筒 + 内套（滑动窗口） */
    s += '<rect x="126" y="70" width="68" height="90" rx="8" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.8"/>';
    s += '<rect x="136" y="84" width="48" height="62" rx="6" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.5" class="a3-sl"/>';
    s += '<rect x="150" y="96" width="20" height="38" rx="3" fill="url(#g3-cem)" opacity=".75" class="a3-sl"/>';
    /* 窗口流出的液流 */
    s += ln(196, 96, 260, 96, JD, 3, '9 9', .7, 'a3-f');
    s += ln(196, 122, 260, 122, JD, 3, '9 9', .7, 'a3-f');
    s += ln(196, 148, 260, 148, JD, 3, '9 9', .7, 'a3-f');
    /* 控制缆 + 地面指令 */
    s += ln(160, 36, 160, 16, S, 1.6, null, .6);
    s += '<rect x="200" y="8" width="56" height="20" rx="4" fill="' + F3 + '" stroke="' + S + '" stroke-width="1.4"/>';
    s += ln(188, 18, 200, 18, S2, 1.2, '3 4', .55, 'a3-f');
    /* 右侧：多滑套井序列（3 个窗口，开关态） */
    s += wellpair(430, 40, 196, 22);
    [64, 112, 160].forEach(function (y, i) {
      s += '<rect x="418" y="' + y + '" width="24" height="22" rx="4" fill="' + (i === 1 ? 'url(#g3-cem)' : F1) + '" stroke="' + S + '" stroke-width="1.5"' + (i === 1 ? ' class="a3-g"' : '') + '/>';
      if (i !== 1) s += ln(440, y + 11, 480, y + 11, S2, 1.4, '5 5', .4);
      else { s += ln(440, y + 11, 486, y + 11, JD, 2.4, '8 8', .7, 'a3-f'); }
    });
    /* 更右侧：压力/产量读数脉动 */
    s += ell(600, 80, 40, 14, 'none', JD, 1.6, .5, 'a3-p');
    s += ell(600, 150, 34, 12, 'none', AC, 1.6, .5, 'a3-p');
    return wrap(s);
  }

  /* co5 完井液体系：罐群 + 环空滤饼形成，固相被挡 */
  function co5() {
    var s = band(20, 158, 660, 52, .4);
    /* 两罐（基液/加重） */
    s += cyl(96, 60, 40, 13, 80, F1, .9);
    s += '<rect x="60" y="92" width="72" height="30" rx="4" fill="url(#g3-fluid)" opacity=".5" class="a3-lv"/>';
    s += cyl(210, 76, 32, 11, 64, F2, .9);
    s += '<rect x="182" y="100" width="56" height="24" rx="4" fill="' + AC + '" opacity=".35" class="a3-lv"/>';
    /* 管线汇入井口 */
    s += ln(136, 100, 300, 100, S, 1.8, null, .6);
    s += ln(150, 100, 290, 100, JD, 3, '9 9', .6, 'a3-f');
    s += ln(242, 100, 242, 84, S, 1.6, null, .5);
    /* 井筒环空纵剖 + 井壁滤饼（渐厚） */
    s += ln(330, 44, 330, 196, S, 2.2, null, .85);
    s += ln(372, 44, 372, 196, S, 2.2, null, .85);
    s += ell(351, 44, 21, 7, 'var(--blue-ll,#F3F7FB)', S, 1.6, .9);
    s += '<rect x="330" y="60" width="10" height="136" fill="url(#g3-cem)" opacity=".45" class="a3-gw"/>';
    s += '<rect x="362" y="60" width="10" height="136" fill="url(#g3-cem)" opacity=".45" class="a3-gw" style="transform-origin:right center"/>';
    /* 固相粒子沉降被滤饼挡住 */
    for (var i = 0; i < 4; i++) s += '<circle cx="' + (348 + (i % 2) * 12) + '" cy="' + (66 + i * 8) + '" r="2.6" fill="' + AC + '" opacity=".8" class="a3-dn" style="animation-delay:' + i * .8 + 's"/>';
    /* 右侧：保护带示意（地层淡绿渐深） */
    s += band(430, 90, 240, 80, .35);
    s += '<rect x="430" y="90" width="240" height="80" fill="url(#g3-cem)" opacity=".18"/>';
    s += ln(430, 90, 430, 170, JD, 2, null, .7);
    for (i = 0; i < 3; i++) s += ln(452 + i * 56, 96, 452 + i * 56, 164, JD, 1.6, '6 6', .45 - i * .1, 'a3-fs');
    s += ell(560, 130, 40, 26, 'none', JD, 1.5, .4, 'a3-p');
    return wrap(s);
  }

  /* co6 封隔器设计：胶筒坐封膨胀脉冲 + 分层隔离 */
  function co6() {
    var s = band(20, 70, 660, 36, .4) + band(20, 150, 660, 60, .3);
    s += wellpair(170, 40, 196, 30);
    /* 封隔器本体 + 胶筒（膨胀） */
    s += '<rect x="150" y="104" width="40" height="10" rx="3" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.6"/>';
    s += '<ellipse cx="148" cy="109" rx="10" ry="14" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6" class="a3-gw" style="transform-origin:right center"/>';
    s += '<ellipse cx="192" cy="109" rx="10" ry="14" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6" class="a3-gw"/>';
    s += ell(170, 109, 44, 15, 'none', AC, 1.6, .5, 'a3-p');
    /* 卡瓦爪 */
    s += ln(150, 96, 138, 88, S, 1.6, null, .7) + ln(190, 96, 202, 88, S, 1.6, null, .7);
    /* 上层（油）下层（水）不同色粒子 */
    for (var i = 0; i < 3; i++) {
      s += '<circle cx="' + (216 + i * 14) + '" cy="' + (58 + (i % 2) * 6) + '" r="2.8" fill="' + AC + '" class="a3-up" style="animation-delay:' + i * .7 + 's"/>';
      s += '<circle cx="' + (216 + i * 14) + '" cy="' + (170 + (i % 2) * 6) + '" r="2.8" fill="#5b8ec4" class="a3-up" style="animation-delay:' + (i * .7 + 1.2) + 's"/>';
    }
    /* 右侧：层间隔离示意（压力屏障） */
    s += ln(430, 70, 430, 150, S2, 1.2, '5 6', .4);
    s += ln(300, 110, 660, 110, S, 1.6, '2 5', .5);
    s += '<rect x="440" y="96" width="180" height="28" rx="8" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6" class="a3-g"/>';
    s += ln(452, 110, 620, 110, JD, 2.4, '8 8', .55, 'a3-f');
    s += ell(530, 110, 60, 20, 'none', AC, 1.4, .35, 'a3-p');
    /* 窜流被挡：双向箭头折返 */
    s += '<path d="M560 78 L600 78 L592 70 M600 78 L592 86" fill="none" stroke="' + AC + '" stroke-width="1.6" opacity=".7"/>';
    s += '<path d="M560 142 L600 142 L592 134 M600 142 L592 150" fill="none" stroke="' + AC + '" stroke-width="1.6" opacity=".7"/>';
    return wrap(s);
  }

  /* co7 压裂增产：井筒 + 对称裂缝翼延伸 + 支撑剂 */
  function co7() {
    var s = band(20, 96, 660, 90, .45);
    s += wellpair(120, 30, 196, 26);
    /* 裂缝翼：向两侧延伸（dash 生长） */
    s += '<path d="M148 138 Q220 92 300 84 Q360 80 420 92" fill="none" stroke="' + AC + '" stroke-width="2.6" stroke-dasharray="16 8" opacity=".85" class="a3-f"/>';
    s += '<path d="M148 148 Q230 186 320 192 Q390 196 460 182" fill="none" stroke="' + AC + '" stroke-width="2.6" stroke-dasharray="16 8" opacity=".85" class="a3-f"/>';
    /* 裂缝内部支撑剂粒子 */
    for (var i = 0; i < 6; i++) {
      s += '<circle cx="' + (200 + i * 44) + '" cy="' + (118 + (i % 2) * 44) + '" r="2.6" fill="' + AC + '" opacity=".8" class="a3-up" style="animation-delay:' + i * .5 + 's"/>';
    }
    /* 裂缝面网格（立体感） */
    s += '<path d="M170 132 L250 96 M210 128 L290 92 M250 124 L330 90" stroke="' + AC + '" stroke-width="1" opacity=".35"/>';
    /* 泵注车 + 高压管汇 */
    s += '<rect x="30" y="26" width="52" height="24" rx="5" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.5"/>';
    s += ln(82, 38, 96, 38, S, 1.8, null, .6);
    s += ell(56, 26, 26, 6, F3, S, 1.2, .6);
    s += ln(40, 38, 40, 26, AC, 2, '5 5', .6, 'a3-g');
    /* 右侧：分簇射孔段（3 簇） */
    s += ln(540, 90, 540, 196, S, 2, null, .7) + ln(560, 90, 560, 196, S, 2, null, .7);
    [104, 136, 168].forEach(function (y, i) {
      for (var k = 0; k < 3; k++) s += ln(560, y + k * 4, 586, y + 6 + k * 4, AC, 2, null, .8, 'a3-sh');
      s += ell(592, y + 8, 10, 4, 'none', AC, 1.4, .5, 'a3-p');
    });
    s += ln(560, 90, 560, 30, S2, 1.2, '3 5', .5);
    s += ln(430, 92, 540, 92, S2, 1.2, '6 5', .4, 'a3-fs');
    return wrap(s);
  }

  /* co8 人工举升：泵往复 + 液流上行 */
  function co8() {
    var s = band(20, 156, 660, 54, .4);
    s += wellpair(170, 34, 196, 28);
    /* 抽油杆（往复） */
    s += ln(170, 34, 170, 66, S, 2.2, null, .8);
    s += '<g class="a3-rc">';
    s += '<rect x="158" y="86" width="24" height="52" rx="6" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.6"/>';
    s += ell(170, 86, 12, 4.5, F3, S, 1.4, .9);
    s += '</g>';
    /* 泵筒固定 */
    s += '<rect x="152" y="140" width="36" height="12" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6"/>';
    /* 阀球开关交替 */
    s += ell(160, 138, 5, 3.2, JD, S, 1.2, .9, 'a3-g');
    s += ell(180, 138, 5, 3.2, JD, S, 1.2, .9, 'a3-g');
    /* 液流上行 */
    for (var i = 0; i < 3; i++) s += '<circle cx="' + (178 + (i % 2) * 8) + '" cy="' + (160 - i * 10) + '" r="2.8" fill="' + JD + '" class="a3-up" style="animation-delay:' + i * .7 + 's"/>';
    /* 地面驴头简形 */
    s += '<path d="M150 34 L150 16 L196 16" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".7"/>';
    s += '<path d="M196 16 q10 0 10 10" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".7"/>';
    /* 右侧：IPR 曲线 + 工作点脉动 */
    s += ln(330, 50, 330, 190, S2, 1.2, null, .5) + ln(330, 190, 560, 190, S2, 1.2, null, .5);
    s += '<path d="M340 60 C390 92 430 130 470 184" fill="none" stroke="' + S + '" stroke-width="2.2" opacity=".85"/>';
    s += '<path d="M360 184 C420 176 470 150 540 96" fill="none" stroke="' + JD + '" stroke-width="2.2" opacity=".85"/>';
    s += ell(432, 148, 12, 26, 'none', AC, 1.8, .6, 'a3-p');
    s += ln(432, 148, 432, 190, AC, 1.2, '4 4', .5);
    s += ln(432, 148, 330, 148, AC, 1.2, '4 4', .5);
    /* 举升方式切换小卡 */
    [200, 250, 300].forEach(function (y, i) {
      s += '<rect x="610" y="' + y + '" width="56" height="18" rx="5" fill="' + (i === 1 ? 'url(#g3-cem)' : F3) + '" stroke="' + S + '" stroke-width="1.3" opacity=".85"' + (i === 1 ? ' class="a3-g"' : '') + '/>';
    });
    return wrap(s);
  }

  /* co9 防砂：筛管缝眼 + 砾石环空充填 + 砂拱稳定 */
  function co9() {
    var s = band(20, 150, 660, 60, .45);
    /* 井筒 + 筛管（缝眼） */
    s += wellpair(170, 36, 196, 30);
    s += '<rect x="146" y="90" width="48" height="106" rx="8" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.7"/>';
    for (var i = 0; i < 7; i++) {
      s += ln(152, 100 + i * 13, 152, 108 + i * 13, S, 1.8, null, .8);
      s += ln(188, 100 + i * 13, 188, 108 + i * 13, S, 1.8, null, .8);
    }
    /* 环空砾石（颗粒点阵） */
    for (i = 0; i < 12; i++) {
      s += '<circle cx="' + (128 + (i % 2) * 12) + '" cy="' + (100 + Math.floor(i / 2) * 18) + '" r="2.4" fill="' + AC + '" opacity=".65" class="a3-g" style="animation-delay:' + (i % 4) * .6 + 's"/>';
    }
    /* 地层砂沉降（被挡） */
    for (i = 0; i < 3; i++) s += '<circle cx="' + (216 + i * 12) + '" cy="' + (104 + i * 10) + '" r="2.6" fill="' + S2 + '" class="a3-dn" style="animation-delay:' + i * .9 + 's"/>';
    /* 砂拱（半圆） */
    s += '<path d="M210 138 a26 20 0 0 1 52 0" fill="none" stroke="' + AC + '" stroke-width="1.8" stroke-dasharray="6 4" opacity=".7" class="a3-g"/>';
    /* 右侧：出砂风险-产量权衡曲线 */
    s += ln(340, 50, 340, 190, S2, 1.2, null, .5) + ln(340, 190, 600, 190, S2, 1.2, null, .5);
    s += '<path d="M350 70 C400 84 440 110 470 140 C495 164 540 180 590 186" fill="none" stroke="' + AC + '" stroke-width="2.2" opacity=".85"/>';
    s += '<path d="M350 120 C400 128 450 144 520 160 C550 166 575 170 595 172" fill="none" stroke="' + JD + '" stroke-width="2" stroke-dasharray="8 6" opacity=".8" class="a3-fs"/>';
    s += ell(470, 140, 11, 24, 'none', AC, 1.6, .5, 'a3-p');
    /* 方案小卡三枚 */
    [0, 1, 2].forEach(function (i) {
      s += '<rect x="628" y="' + (84 + i * 32) + '" width="48" height="16" rx="5" fill="' + (i === 1 ? 'url(#g3-cem)' : F3) + '" stroke="' + S + '" stroke-width="1.2" opacity=".85"' + (i === 1 ? ' class="a3-g"' : '') + '/>';
    });
    return wrap(s);
  }

  /* co10 腐蚀结垢：管壁锈斑生长 + 垢层增厚 */
  function co10() {
    var s = band(20, 70, 660, 36, .35) + band(20, 160, 660, 50, .3);
    /* 半剖管壁（上下双线）+ 内壁垢层 */
    s += ln(120, 60, 520, 60, S, 2.4, null, .85);
    s += ln(120, 180, 520, 180, S, 2.4, null, .85);
    s += '<rect x="120" y="60" width="400" height="10" fill="url(#g3-rock)" opacity=".55"/>';
    s += '<rect x="120" y="170" width="400" height="10" fill="url(#g3-rock)" opacity=".55" class="a3-gw" style="transform-origin:left center"/>';
    /* 锈斑群（生长脉冲） */
    [[170, 66], [250, 62], [330, 68], [410, 63], [470, 67]].forEach(function (pt, i) {
      s += '<ellipse cx="' + pt[0] + '" cy="' + (pt[1] + 5) + '" rx="' + (9 + i) + '" ry="' + (3.5 + i * .4) + '" fill="' + AC + '" opacity=".55" class="a3-p" style="animation-delay:' + i * .4 + 's"/>';
    });
    /* 垢晶体 */
    [[200, 176], [300, 178], [390, 175]].forEach(function (pt, i) {
      s += '<path d="M' + pt[0] + ' ' + pt[1] + ' l7 -6 l7 6 l-7 6 z" fill="var(--blue-l,#E8F0F8)" stroke="' + S2 + '" stroke-width="1.2" class="a3-g" style="animation-delay:' + i * .5 + 's"/>';
    });
    /* 腐蚀性流体流动 */
    s += ln(130, 120, 510, 120, '#5b8ec4', 2.6, '10 10', .55, 'a3-f');
    s += ln(130, 132, 510, 132, '#5b8ec4', 2, '8 12', .4, 'a3-fs');
    /* CO2 气泡上浮 */
    for (var i = 0; i < 3; i++) s += '<circle cx="' + (240 + i * 80) + '" cy="150" r="3" fill="none" stroke="#5b8ec4" stroke-width="1.2" class="a3-up" style="animation-delay:' + i * .8 + 's"/>';
    /* 右侧：腐蚀速率随温度曲线 + 阈值线 */
    s += ln(570, 70, 570, 190, S2, 1.1, null, .5) + ln(570, 190, 680, 190, S2, 1.1, null, .5);
    s += '<path d="M580 176 C610 168 630 140 650 110 C660 96 668 88 676 82" fill="none" stroke="' + AC + '" stroke-width="2" opacity=".85"/>';
    s += ln(570, 116, 680, 116, JD, 1.3, '6 5', .55, 'a3-g');
    s += ell(650, 110, 8, 18, 'none', AC, 1.5, .45, 'a3-p');
    return wrap(s);
  }

  var T = {
    co1: co1, co2: co2, co3: co3, co4: co4, co5: co5,
    co6: co6, co7: co7, co8: co8, co9: co9, co10: co10
  };
  var prev = g.SCENE_ART;
  g.ART3D_B = T;
  g.SCENE_ART = function (id) {
    var f = T[id];
    if (f) return f();
    return prev ? prev(id) : '';
  };
})(window);
