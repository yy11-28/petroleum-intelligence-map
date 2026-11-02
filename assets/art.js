/* =========================================================
   场景档案头装饰插画（纯图形、无文字）
   SCENE_ART(stageId) → 按环节返回一张 700×230 线稿 SVG
   颜色全部走 CSS 变量并带 fallback，深浅模式通用；
   VizKit / 场景数据零依赖，只是"空白处有图案"。
   ========================================================= */
(function (g) {
  'use strict';

  var S = 'var(--navy, #22456B)';    /* 主线条 */
  var S2 = 'var(--navy-3, #8CA3BC)'; /* 次线条 */
  var F1 = 'var(--blue-l, #E8F0F8)'; /* 淡填充 */
  var F2 = 'var(--blue-ll, #F3F7FB)';/* 更淡填充 */
  var AC = 'var(--clay, #C4703F)';   /* 少量强调（油滴 / 火焰） */

  function wrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 230" ' +
      'preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + inner + '</svg>';
  }
  function ln(x1, y1, x2, y2, c, w, dash, op) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + (c || S) + '" stroke-width="' + (w || 1.4) + '"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '') +
      ' stroke-linecap="round" opacity="' + (op == null ? .55 : op) + '"/>';
  }
  function circ(x, y, r, c, w, fill, op) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" stroke="' + (c || S) +
      '" stroke-width="' + (w || 1.4) + '" fill="' + (fill || 'none') +
      '" opacity="' + (op == null ? .55 : op) + '"/>';
  }

  /* ---- 井身结构：井架 + 多层套管 + 封隔器 + 射孔 + 筛管 ---- */
  function wellbore() {
    var s = '';
    /* 地层分界虚线 */
    s += ln(24, 108, 296, 108, S2, 1.1, '5 6', .3) + ln(372, 108, 676, 108, S2, 1.1, '5 6', .3);
    s += ln(24, 158, 676, 158, S2, 1.1, '5 6', .25);
    s += ln(24, 204, 676, 204, S2, 1.1, '5 6', .25);
    /* 右侧油藏椭圆 + 油滴 */
    s += '<ellipse cx="565" cy="180" rx="88" ry="22" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1.2" opacity=".5"/>';
    s += '<ellipse cx="565" cy="180" rx="56" ry="12" fill="none" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    s += '<path d="M542 172 q-5 8 0 11 q6 3 8 -3 q2 -5 -3 -10 l-2 -3 z" fill="' + AC + '" opacity=".45"/>';
    s += '<path d="M576 176 q-5 8 0 11 q6 3 8 -3 q2 -5 -3 -10 l-2 -3 z" fill="' + AC + '" opacity=".3"/>';
    /* 井架 */
    s += '<path d="M298 70 L314 16 L346 16 L362 70" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".65"/>';
    s += ln(306, 46, 354, 46, S, 1.2, null, .5) + ln(302, 60, 358, 60, S, 1.2, null, .5) + ln(310, 32, 350, 32, S, 1.2, null, .5);
    s += ln(292, 70, 368, 70, S, 1.8, null, .7);
    s += circ(330, 12, 4, S, 1.4, F1, .6);
    /* 井口装置 */
    s += '<rect x="314" y="50" width="32" height="14" rx="2" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += circ(346, 57, 5, S, 1.2, F2, .55);
    /* 套管与油管 */
    s += ln(320, 70, 320, 212, S, 1.5, null, .6) + ln(340, 70, 340, 212, S, 1.5, null, .6);
    s += ln(326, 70, 326, 196, S2, 1.2, null, .45) + ln(334, 70, 334, 196, S2, 1.2, null, .45);
    /* 封隔器 */
    s += '<rect x="312" y="118" width="36" height="9" rx="4.5" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    /* 射孔孔眼 */
    var i, y;
    for (i = 0; i < 4; i++) {
      y = 146 + i * 8;
      s += ln(320, y, 304, y - 5, S, 1.3, null, .5) + ln(340, y + 4, 356, y - 1, S, 1.3, null, .5);
    }
    /* 筛管斜纹 */
    for (i = 0; i < 7; i++) s += ln(321, 178 + i * 5, 339, 174 + i * 5, S2, 1.1, null, .45);
    /* 人工井底 */
    s += ln(316, 212, 344, 212, S, 1.8, null, .7);
    /* 左侧游车细线（装饰） */
    s += ln(60, 40, 60, 190, S2, 1, '2 5', .3) + circ(60, 40, 3, S2, 1.1, F2, .35);
    s += ln(96, 58, 96, 172, S2, 1, '2 5', .3) + circ(96, 58, 3, S2, 1.1, F2, .35);
    return wrap(s);
  }

  /* ---- 地层与地震：波浪层 + 背斜 + 震源射线 ---- */
  function geo() {
    var s = '';
    /* 层填充（浅色带） */
    s += '<path d="M20 96 Q200 74 380 98 T680 86 L680 140 Q500 130 320 146 T20 136 Z" fill="' + F2 + '" opacity=".55"/>';
    s += '<path d="M20 140 Q220 126 420 148 T680 136 L680 186 Q480 174 300 190 T20 178 Z" fill="' + F1 + '" opacity=".4"/>';
    /* 波浪层线 */
    s += '<path d="M20 96 Q200 74 380 98 T680 86" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".5"/>';
    s += '<path d="M20 140 Q220 126 420 148 T680 136" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".5"/>';
    s += '<path d="M20 178 Q220 164 420 186 T680 172" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".45"/>';
    s += '<path d="M20 214 Q240 200 460 216 T680 208" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".35"/>';
    /* 背斜构造（两条弧） */
    s += '<path d="M330 148 Q400 96 470 150" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".65"/>';
    s += '<path d="M352 152 Q400 118 448 154" fill="none" stroke="' + S + '" stroke-width="1.2" opacity=".45"/>';
    /* 井位：小井架 + 井杆 */
    s += '<path d="M392 120 L400 92 L408 120" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".65"/>';
    s += ln(400, 92, 400, 118, S, 1.2, null, .55);
    /* 震源 + 放射 */
    s += circ(96, 42, 6, S, 1.5, F1, .65);
    var angs = [30, 70, 110, 150, 210, 330], j;
    for (j = 0; j < angs.length; j++) {
      var a = angs[j] * Math.PI / 180;
      s += ln(96 + Math.cos(a) * 9, 42 + Math.sin(a) * 9,
        96 + Math.cos(a) * 17, 42 + Math.sin(a) * 17, S, 1.3, null, .55);
    }
    /* 下行射线路径 */
    s += '<path d="M108 50 Q190 96 268 128" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".45"/>';
    s += '<path d="M112 58 Q180 108 240 142" fill="none" stroke="' + S2 + '" stroke-width="1.1" stroke-dasharray="4 4" opacity=".35"/>';
    /* 断层 */
    s += ln(580, 66, 648, 216, S, 1.4, null, .4);
    return wrap(s);
  }

  /* ---- 测井曲线：三道曲线 + 深度线 ---- */
  function curve() {
    var s = '';
    var xs = [70, 290, 510], w = 150, i, k;
    for (i = 0; i < 3; i++) {
      s += '<rect x="' + xs[i] + '" y="26" width="' + w + '" height="180" rx="4" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1.1" opacity=".5"/>';
      s += '<rect x="' + (xs[i] + w / 2 - 14) + '" y="18" width="28" height="8" rx="3" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".55"/>';
    }
    /* 深度横虚线 */
    for (k = 0; k < 4; k++) s += ln(56, 60 + k * 38, 660, 60 + k * 38, S2, 1, '3 5', .3);
    /* 曲线 1：台阶状 */
    s += '<path d="M78 60 L108 60 L108 96 L134 96 L134 74 L158 74 L158 132 L184 132 L184 88 L212 88" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    /* 曲线 2：大摆动 */
    s += '<path d="M298 96 Q318 52 336 96 Q354 140 372 96 Q390 60 408 110 Q424 150 432 88" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    /* 曲线 3：密集微动 */
    s += '<path d="M518 120 L530 112 L538 126 L548 104 L556 128 L566 96 L574 130 L584 100 L594 124 L604 90 L616 122 L630 84 L646 118 L656 96" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".55"/>';
    /* 交点圆点 */
    var dots = [[134, 96], [158, 74], [336, 96], [408, 110], [574, 130]];
    for (i = 0; i < dots.length; i++) s += circ(dots[i][0], dots[i][1], 3.2, AC, 1.2, F1, .7);
    /* 深度轴 */
    s += ln(48, 26, 48, 206, S, 1.4, null, .55);
    for (k = 0; k < 6; k++) s += ln(44, 26 + k * 36, 48, 26 + k * 36, S, 1.2, null, .5);
    return wrap(s);
  }

  /* ---- 采油：抽油机 + 管线 + 储罐 ---- */
  function pump() {
    var s = '';
    s += ln(20, 152, 680, 152, S, 1.6, null, .6);
    /* 支架与游梁 */
    s += '<path d="M186 152 L212 66 L238 152" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    s += ln(146, 96, 306, 82, S, 1.8, null, .7);
    s += circ(212, 88, 4.5, S, 1.4, F1, .65);
    /* 驴头弧 + 悬绳 */
    s += '<path d="M296 74 Q322 74 324 102" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".6"/>';
    s += ln(324, 102, 324, 66, S2, 1.1, null, .45) + ln(318, 66, 330, 66, S, 1.3, null, .55);
    /* 尾块配重 + 连杆 */
    s += '<rect x="132" y="88" width="24" height="17" rx="3" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += ln(156, 97, 208, 88, S2, 1.2, null, .5);
    /* 底座 */
    s += '<rect x="140" y="152" width="146" height="8" rx="3" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1.1" opacity=".5"/>';
    /* 井口 + 井下泵 */
    s += '<rect x="330" y="138" width="30" height="14" rx="2" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += ln(344, 152, 344, 214, S2, 1.2, '4 4', .4);
    s += '<rect x="336" y="196" width="16" height="10" rx="2" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".55"/>';
    /* 出油管线 */
    s += '<path d="M360 148 Q420 148 444 124 T508 112 L544 112" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    /* 阀门（蝶形） */
    s += '<path d="M474 112 L486 104 L486 120 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    s += '<path d="M486 112 L474 104 L474 120 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    /* 流向箭头 */
    s += '<path d="M414 144 l8 0 m-3.5 -3.2 l3.6 3.2 -3.6 3.2" stroke="' + S2 + '" stroke-width="1.2" fill="none" opacity=".5"/>';
    s += '<path d="M524 112 l8 0 m-3.5 -3.2 l3.6 3.2 -3.6 3.2" stroke="' + S2 + '" stroke-width="1.2" fill="none" opacity=".5"/>';
    /* 储罐 */
    s += '<rect x="556" y="84" width="66" height="68" rx="8" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".6"/>';
    s += '<ellipse cx="589" cy="84" rx="33" ry="8" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    s += ln(556, 118, 622, 118, S2, 1.1, null, .4);
    return wrap(s);
  }

  /* ---- 地面厂区：塔 + 罐 + 管网 + 火炬 ---- */
  function plant() {
    var s = '';
    s += ln(20, 196, 680, 196, S, 1.6, null, .6);
    /* 分馏塔 */
    s += '<path d="M318 60 Q318 40 338 40 Q358 40 358 60 L358 196 L318 196 Z" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.5" opacity=".6"/>';
    var k;
    for (k = 0; k < 5; k++) s += ln(324, 66 + k * 26, 352, 66 + k * 26, S2, 1.1, null, .4);
    /* 预热器 */
    s += circ(216, 128, 20, S, 1.4, F2, .55) + circ(216, 128, 12, S2, 1, null, .4);
    s += '<path d="M236 128 L318 128" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".55"/>';
    s += '<path d="M216 108 L216 78 Q216 66 260 66 L318 66" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".45"/>';
    /* 储罐 ×2 */
    s += '<rect x="446" y="150" width="58" height="46" rx="6" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".55"/>';
    s += '<ellipse cx="475" cy="150" rx="29" ry="7" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".55"/>';
    s += '<rect x="524" y="150" width="58" height="46" rx="6" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".55"/>';
    s += '<ellipse cx="553" cy="150" rx="29" ry="7" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".55"/>';
    /* 塔到罐的管线 */
    s += '<path d="M358 170 Q400 170 446 170" fill="none" stroke="' + S + '" stroke-width="1.4" opacity=".5"/>';
    s += '<path d="M504 173 Q514 173 524 173" fill="none" stroke="' + S + '" stroke-width="1.4" opacity=".5"/>';
    /* 阀门 ×2 */
    s += '<path d="M396 170 L408 162 L408 178 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    s += '<path d="M408 170 L396 162 L396 178 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    /* 火炬 */
    s += ln(648, 196, 648, 88, S, 1.4, null, .55);
    s += '<path d="M648 88 Q640 74 648 60 Q656 74 648 88" fill="' + AC + '" opacity=".45"/>';
    s += '<path d="M604 150 Q620 150 620 130 Q620 112 648 106" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".45"/>';
    /* 地面下地基短桩 */
    s += ln(320, 196, 320, 208, S2, 1.2, null, .4) + ln(356, 196, 356, 208, S2, 1.2, null, .4);
    s += ln(452, 196, 452, 208, S2, 1.2, null, .4) + ln(530, 196, 530, 208, S2, 1.2, null, .4);
    return wrap(s);
  }

  /* =========================================================
     完井 20 个案例的专属插画（按案例内容设计，无文字）
     ========================================================= */

  /* 井筒双线（竖直） */
  function boreHole(x, y0, y1, op) {
    return ln(x, y0, x, y1, S, 1.5, null, op == null ? .6 : op) +
      ln(x + 18, y0, x + 18, y1, S, 1.5, null, op == null ? .6 : op);
  }

  /* co1 完井方式智能优选：四种完井剖面并排对比 */
  function co1() {
    var s = '', cx = [90, 255, 420, 585], i, x;
    for (i = 0; i < 4; i++) {
      x = cx[i];
      s += ln(x - 58, 58, x + 76, 58, S, 1.5, null, .5);
      s += boreHole(x, 58, 132, .6);
      s += ln(x, 132, x + 18, 132, S, 1.5, null, .6);
      if (i === 0) { /* 裸眼：开放井底 */
        s += ln(x - 10, 140, x + 28, 140, S2, 1.2, '4 4', .45);
      } else if (i === 1) { /* 射孔 */
        s += ln(x + 18, 132, x + 18, 168, S, 1.5, null, .6);
        for (var j = 0; j < 3; j++) {
          s += ln(x, 140 + j * 9, x - 14, 136 + j * 9, S, 1.2, null, .55) +
            ln(x + 18, 140 + j * 9, x + 32, 136 + j * 9, S, 1.2, null, .55);
        }
      } else if (i === 2) { /* 筛管 */
        s += ln(x + 2, 132, x + 2, 172, S, 1.5, null, .6) + ln(x + 16, 132, x + 16, 172, S, 1.5, null, .6);
        for (var k = 0; k < 6; k++) s += ln(x + 2, 138 + k * 6, x + 16, 134 + k * 6, S2, 1, null, .5);
      } else { /* 砾石充填 */
        s += ln(x - 6, 132, x - 6, 176, S, 1.5, null, .6) + ln(x + 24, 132, x + 24, 176, S, 1.5, null, .6);
        s += ln(x + 2, 132, x + 2, 176, S2, 1.2, null, .55) + ln(x + 16, 132, x + 16, 176, S2, 1.2, null, .55);
        for (var m = 0; m < 10; m++) {
          var py = 138 + (m % 5) * 9, px = x + (m < 5 ? 7 : 11);
          s += '<circle cx="' + px + '" cy="' + py + '" r="1.6" fill="' + S2 + '" opacity=".5"/>';
        }
      }
      if (i < 3) s += ln(x + 110, 62, x + 110, 205, S2, 1, '2 5', .3);
    }
    s += ln(20, 206, 680, 206, S2, 1.1, '5 6', .3);
    return wrap(s);
  }

  /* co2 射孔参数智能设计：射孔枪 + 三相位孔眼 + 穿透孔道 */
  function co2() {
    var s = '';
    s += boreHole(320, 30, 200, .6);
    /* 射孔枪身 */
    s += '<rect x="316" y="92" width="26" height="76" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".65"/>';
    s += ln(316, 118, 342, 118, S2, 1, null, .4) + ln(316, 144, 342, 144, S2, 1, null, .4);
    /* 三相位孔眼：左斜 / 水平 / 右斜 */
    s += ln(316, 106, 286, 96, S, 1.6, null, .6) + ln(316, 130, 286, 130, S, 1.6, null, .6) + ln(316, 154, 286, 164, S, 1.6, null, .6);
    s += ln(342, 106, 372, 96, S, 1.6, null, .6) + ln(342, 130, 372, 130, S, 1.6, null, .6) + ln(342, 154, 372, 164, S, 1.6, null, .6);
    /* 右侧储层 + 孔道穿透虚线 */
    s += '<ellipse cx="520" cy="130" rx="120" ry="52" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1.2" opacity=".45"/>';
    s += ln(372, 96, 448, 88, S2, 1.2, '4 4', .5) + ln(372, 130, 462, 130, S2, 1.2, '4 4', .5) + ln(372, 164, 448, 172, S2, 1.2, '4 4', .5);
    /* 左侧相位角弧 */
    s += '<path d="M270 88 A52 52 0 0 1 270 176" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".5"/>';
    s += ln(286, 96, 252, 132, S2, 1, null, .4) + ln(286, 130, 252, 132, S2, 1, null, .4) + ln(286, 164, 252, 132, S2, 1, null, .4);
    s += circ(252, 132, 3, S, 1.2, F1, .6);
    /* 地层界线 */
    s += ln(40, 74, 660, 74, S2, 1.1, '5 6', .3) + ln(40, 190, 660, 190, S2, 1.1, '5 6', .3);
    return wrap(s);
  }

  /* co3 管柱力学：油管屈曲波形 + 载荷箭头 + 封隔器 */
  function co3() {
    var s = '';
    s += boreHole(250, 26, 206, .55);
    /* 油管中心线：上直下屈曲（螺旋感的 S 波） */
    s += '<path d="M259 26 L259 96 Q259 104 265 104 Q271 104 271 112 Q271 120 265 120 Q259 120 259 128 Q259 136 265 136 Q271 136 271 144 Q271 152 265 152 Q259 152 259 160 L259 196" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".65"/>';
    /* 封隔器锚定 */
    s += '<rect x="246" y="196" width="26" height="10" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    /* 载荷箭头：顶部拉力向上、底部压力向下 */
    s += '<path d="M259 26 L259 8 m-4 5 l4 -5 l4 5" fill="none" stroke="' + AC + '" stroke-width="1.5" opacity=".6"/>';
    s += '<path d="M259 206 L259 224 m-4 -5 l4 5 l4 -5" fill="none" stroke="' + AC + '" stroke-width="1.5" opacity=".6"/>';
    /* 右侧屈曲波形放大 */
    s += ln(420, 60, 420, 190, S2, 1, null, .4) + ln(660, 60, 660, 190, S2, 1, null, .4);
    s += '<path d="M420 80 Q465 55 510 80 Q555 105 600 80 Q622 68 645 84" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    s += '<path d="M420 110 Q465 85 510 110 Q555 135 600 110 Q622 98 645 114" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".45"/>';
    /* 中性点 */
    s += ln(236, 96, 284, 96, S2, 1.2, '3 3', .5);
    return wrap(s);
  }

  /* co4 滑套控制：三层滑套开度与流入 */
  function co4() {
    var s = '';
    s += boreHole(330, 26, 210, .6);
    /* 层界 */
    s += ln(60, 84, 640, 84, S2, 1.1, '5 6', .3) + ln(60, 136, 640, 136, S2, 1.1, '5 6', .3);
    var ys = [58, 110, 162], opens = [12, 6, 1], i;
    for (i = 0; i < 3; i++) {
      var y = ys[i], o = opens[i];
      /* 滑套本体 */
      s += '<rect x="324" y="' + (y + 12) + '" width="30" height="16" rx="3" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
      /* 内芯开度：矩形开口 */
      s += '<rect x="' + (348 - o) + '" y="' + (y + 16) + '" width="' + o + '" height="8" rx="1.5" fill="' + S2 + '" opacity=".55"/>';
      /* 流入箭头（开度大小决定箭头长度） */
      if (o > 2) {
        var L = 30 + o * 6;
        s += '<path d="M' + (324 - L) + ' ' + (y + 20) + ' L' + (316 - o) + ' ' + (y + 20) + ' m4 -3.4 l-4.5 3.4 l4.5 3.4" fill="none" stroke="' + AC + '" stroke-width="1.4" opacity=".6"/>';
      }
      /* 左侧层位椭圆 */
      s += '<ellipse cx="150" cy="' + (y + 20) + '" rx="76" ry="20" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1" opacity=".4"/>';
    }
    return wrap(s);
  }

  /* co5 完井液设计：烧杯 + 岩心 + 颗粒侵入 */
  function co5() {
    var s = '';
    /* 烧杯 */
    s += '<path d="M250 40 L250 170 Q250 196 276 196 L392 196 Q418 196 418 170 L418 40" fill="none" stroke="' + S + '" stroke-width="1.7" opacity=".65"/>';
    s += ln(238, 40, 430, 40, S, 1.7, null, .6);
    /* 液面 + 液体 */
    s += ln(250, 78, 418, 78, S2, 1.2, '4 4', .5);
    s += '<path d="M252 80 L416 80 L416 170 Q416 194 392 194 L276 194 Q252 194 252 170 Z" fill="' + F1 + '" opacity=".5"/>';
    /* 岩心圆柱（中部） */
    s += '<rect x="306" y="108" width="56" height="72" rx="4" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".65"/>';
    s += '<ellipse cx="334" cy="108" rx="28" ry="7" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".65"/>';
    /* 侵入颗粒（上半部点 + 下半部变稀） */
    var dots = [[318, 122], [336, 118], [352, 126], [326, 134], [344, 138], [318, 146], [354, 148], [336, 158]];
    for (var i = 0; i < dots.length; i++) {
      s += '<circle cx="' + dots[i][0] + '" cy="' + dots[i][1] + '" r="2" fill="' + AC + '" opacity="' + (0.6 - i * 0.05) + '"/>';
    }
    /* 左侧试剂瓶 + 流线 */
    s += '<rect x="130" y="96" width="34" height="52" rx="4" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".6"/>';
    s += '<rect x="141" y="84" width="12" height="12" fill="none" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += '<path d="M164 122 Q210 122 250 100" fill="none" stroke="' + S2 + '" stroke-width="1.3" stroke-dasharray="4 4" opacity=".5"/>';
    s += '<path d="M242 96 l9 3 l-7 6" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".55"/>';
    /* 右侧返排流线 */
    s += '<path d="M418 108 Q470 100 520 84" fill="none" stroke="' + S2 + '" stroke-width="1.3" stroke-dasharray="4 4" opacity=".45"/>';
    s += '<path d="M512 80 l9 1 l-5 8" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".5"/>';
    return wrap(s);
  }

  /* co6 封隔器隔离：坐封胶筒 + 上下压差 */
  function co6() {
    var s = '';
    s += boreHole(316, 26, 210, .6);
    /* 上下层位填充差异 */
    s += '<rect x="40" y="30" width="240" height="72" fill="' + F1 + '" opacity=".4"/>';
    s += '<rect x="436" y="30" width="224" height="72" fill="' + F1 + '" opacity=".4"/>';
    s += ln(40, 102, 660, 102, S2, 1.1, '5 6', .3);
    /* 封隔器：双胶囊胶筒（膨胀鼓形） */
    s += '<rect x="310" y="118" width="34" height="12" rx="3" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    s += '<path d="M310 130 Q296 136 296 144 Q296 152 310 156" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.5" opacity=".7"/>';
    s += '<path d="M344 130 Q358 136 358 144 Q358 152 344 156" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.5" opacity=".7"/>';
    s += boreHole(316, 156, 210, .6);
    s += ln(316, 130, 316, 158, S2, 1.2, null, .5) + ln(344, 130, 344, 158, S2, 1.2, null, .5);
    /* 上层高压向下箭头，下层低压向上 */
    s += '<path d="M180 66 L180 92 m-4 -6 l4 6 l4 -6" fill="none" stroke="' + AC + '" stroke-width="1.5" opacity=".6"/>';
    s += '<path d="M520 92 L520 66 m-4 6 l4 -6 l4 6" fill="none" stroke="' + S2 + '" stroke-width="1.5" opacity=".5"/>';
    /* 上下层椭圆 */
    s += '<ellipse cx="180" cy="60" rx="70" ry="16" fill="none" stroke="' + S2 + '" stroke-width="1" opacity=".4"/>';
    s += '<ellipse cx="520" cy="72" rx="70" ry="16" fill="none" stroke="' + S2 + '" stroke-width="1" opacity=".4"/>';
    /* 窜流阻断：胶筒处两侧叉 */
    s += ln(288, 137, 302, 151, S2, 1.3, null, .5) + ln(288, 151, 302, 137, S2, 1.3, null, .5);
    return wrap(s);
  }

  /* co7 压裂设计：水力裂缝 + 支撑剂 + 地应力 */
  function co7() {
    var s = '';
    s += boreHole(330, 20, 212, .6);
    /* 对称裂缝（翼状） */
    s += '<path d="M348 96 Q420 60 520 48 Q570 42 636 60 Q560 72 500 92 Q420 116 348 116" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    s += '<path d="M348 96 Q420 130 520 144 Q570 150 636 132 Q560 120 500 100 Q420 96 348 96" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    /* 缝内支撑剂点阵 */
    var g = [[400, 88], [440, 78], [480, 70], [520, 66], [560, 62], [600, 62], [420, 100], [460, 94], [500, 92], [540, 90], [580, 88], [430, 132], [470, 126], [510, 122], [550, 118], [590, 112], [450, 108], [490, 106]];
    for (var i = 0; i < g.length; i++) s += '<circle cx="' + g[i][0] + '" cy="' + g[i][1] + '" r="2.2" fill="' + AC + '" opacity=".5"/>';
    /* 地应力箭头 */
    s += '<path d="M96 96 L152 96 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S2 + '" stroke-width="1.5" opacity=".55"/>';
    s += '<path d="M96 130 L152 130 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S2 + '" stroke-width="1.5" opacity=".55"/>';
    /* 射孔段 */
    for (var j = 0; j < 3; j++) s += ln(330, 100 + j * 8, 320, 96 + j * 8, S, 1.3, null, .6);
    /* 地层界线 */
    s += ln(40, 34, 660, 34, S2, 1.1, '5 6', .3) + ln(40, 208, 660, 208, S2, 1.1, '5 6', .3);
    return wrap(s);
  }

  /* co8 举升方式：气举阀 + 电潜泵 + 螺杆泵同井筒三段 */
  function co8() {
    var s = '';
    s += boreHole(200, 24, 212, .55);
    s += ln(218, 24, 218, 212, S2, 1.2, '3 5', .35);
    /* 气举阀（上部：环形腔 + 侧袋） */
    s += '<rect x="194" y="52" width="30" height="18" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".65"/>';
    s += '<path d="M218 58 Q252 52 262 40" fill="none" stroke="' + AC + '" stroke-width="1.4" opacity=".55"/>';
    s += '<path d="M254 42 l9 -3 l-2 9" fill="none" stroke="' + AC + '" stroke-width="1.4" opacity=".6"/>';
    s += ln(60, 46, 186, 46, S2, 1.1, '4 4', .4);
    /* 电潜泵（中部：叠环组） */
    var i;
    for (i = 0; i < 5; i++) s += '<ellipse cx="209" cy="' + (118 + i * 10) + '" rx="14" ry="4.5" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    s += '<rect x="195" y="110" width="28" height="8" rx="2" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    /* 螺杆泵（下部：螺旋线） */
    s += '<path d="M209 176 L209 208 M209 178 q8 3 0 7 q-8 4 0 7 q8 3 0 7" fill="none" stroke="' + S + '" stroke-width="1.4" opacity=".6"/>';
    /* 右侧三种输出流线（示意） */
    s += '<path d="M300 60 Q380 52 460 44" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".4"/>';
    s += '<path d="M300 136 Q400 130 500 116" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".4"/>';
    s += '<path d="M300 196 Q420 196 540 186" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".4"/>';
    s += '<path d="M452 42 l9 -1 l-4 8" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".5"/>';
    s += '<path d="M492 114 l9 -1 l-4 8" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".5"/>';
    s += '<path d="M532 184 l9 -1 l-4 8" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".5"/>';
    return wrap(s);
  }

  /* co9 防砂：绕丝筛管 + 砂桥 + 洁净油流 */
  function co9() {
    var s = '';
    /* 横置筛管（中央） */
    s += '<rect x="250" y="96" width="200" height="44" rx="6" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.5" opacity=".65"/>';
    for (var i = 0; i < 13; i++) s += ln(262 + i * 14, 96, 268 + i * 14, 140, S, 1.1, null, .5);
    s += ln(250, 118, 450, 118, S2, 1, '4 4', .4);
    /* 左侧地层砂（点渐密 + 被挡） */
    var pts = [[140, 104], [156, 122], [146, 132], [168, 106], [180, 130], [158, 108], [190, 114], [176, 118], [196, 128], [204, 108], [214, 124], [222, 112], [228, 130], [236, 104], [232, 122]];
    for (i = 0; i < pts.length; i++) s += '<circle cx="' + pts[i][0] + '" cy="' + pts[i][1] + '" r="2.4" fill="' + AC + '" opacity="' + (0.55 - i * 0.02) + '"/>';
    /* 砂桥（筛管左端外缘点带） */
    s += '<circle cx="246" cy="102" r="2.2" fill="' + AC + '" opacity=".6"/>' +
      '<circle cx="246" cy="112" r="2.2" fill="' + AC + '" opacity=".6"/>' +
      '<circle cx="246" cy="122" r="2.2" fill="' + AC + '" opacity=".6"/>' +
      '<circle cx="246" cy="132" r="2.2" fill="' + AC + '" opacity=".6"/>';
    /* 右侧洁净流箭头 */
    s += '<path d="M452 110 L520 110 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".55"/>';
    s += '<path d="M452 126 L520 126 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".55"/>';
    /* 地层填充椭圆 */
    s += '<ellipse cx="150" cy="118" rx="110" ry="52" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    /* 压差箭头 */
    s += '<path d="M120 40 L340 40 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S2 + '" stroke-width="1.3" stroke-dasharray="5 4" opacity=".45"/>';
    return wrap(s);
  }

  /* co10 防腐防垢：管壁蚀点 + 垢层 + 加药 */
  function co10() {
    var s = '';
    /* 管壁双竖线（宽间距表示管壁） */
    s += boreHole(300, 26, 210, .6);
    /* 内壁锈蚀凹点（左管） */
    var p = [[300, 70], [300, 96], [300, 124], [300, 152], [300, 178]];
    for (var i = 0; i < p.length; i++) s += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="2.6" fill="' + AC + '" opacity=".45"/>';
    /* 右管内壁垢层锯齿 */
    s += '<path d="M318 40 L318 52 L322 56 L318 60 L318 72 L323 77 L318 82 L318 96 L321 101 L318 106 L318 120 L324 126 L318 132 L318 146 L321 151 L318 156 L318 170 L323 175 L318 180 L318 196" fill="none" stroke="' + S2 + '" stroke-width="1.3" opacity=".55"/>';
    /* 左侧加药罐 + 沿管药剂线 */
    s += '<rect x="120" y="60" width="42" height="58" rx="5" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.4" opacity=".6"/>';
    s += '<rect x="134" y="46" width="14" height="14" fill="none" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += '<path d="M162 96 Q230 110 292 128" fill="none" stroke="' + AC + '" stroke-width="1.4" stroke-dasharray="4 4" opacity=".55"/>';
    s += '<path d="M284 122 l9 4 l-8 5" fill="none" stroke="' + AC + '" stroke-width="1.3" opacity=".6"/>';
    /* 右侧挂片（检片符号） */
    s += '<rect x="420" y="88" width="16" height="26" rx="2" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".6"/>';
    s += ln(436, 101, 470, 101, S2, 1.2, null, .45);
    /* 温度波纹（装饰） */
    s += '<path d="M540 70 Q552 82 540 94 Q528 106 540 118 Q552 130 540 142" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".4"/>';
    return wrap(s);
  }

  /* co11 固井质量：水泥环胶结好/差对比 + 声波波纹 */
  function co11() {
    var s = '';
    /* 套管（中央竖向） */
    s += boreHole(330, 24, 212, .7);
    /* 左段：水泥环胶结好（密斜纹环空） */
    s += '<rect x="310" y="34" width="12" height="80" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1" opacity=".55"/>';
    s += '<rect x="346" y="34" width="12" height="80" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1" opacity=".55"/>';
    for (var i = 0; i < 10; i++) {
      s += ln(310, 40 + i * 8, 322, 34 + i * 8, S, 1, null, .45);
      s += ln(346, 40 + i * 8, 358, 34 + i * 8, S, 1, null, .45);
    }
    /* 右段：胶结差（稀虚纹 + 微间隙空隙） */
    s += '<rect x="310" y="118" width="12" height="88" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1" opacity=".5"/>';
    s += '<rect x="346" y="118" width="12" height="88" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1" opacity=".5"/>';
    for (var k = 0; k < 5; k++) {
      s += ln(311, 130 + k * 16, 321, 124 + k * 16, S2, 1, '3 3', .4);
      s += ln(347, 130 + k * 16, 357, 124 + k * 16, S2, 1, '3 3', .4);
    }
    s += ln(308, 116, 324, 116, S2, 1.4, null, .5) + ln(344, 116, 360, 116, S2, 1.4, null, .5);
    /* 左侧声波波纹（同心弧） */
    s += '<path d="M268 76 Q258 92 268 108" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".5"/>';
    s += '<path d="M252 68 Q236 92 252 116" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".4"/>';
    s += '<path d="M236 60 Q214 92 236 124" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".3"/>';
    /* 右侧窜槽通道（虚线沿界面） */
    s += '<path d="M362 130 Q400 150 430 190" fill="none" stroke="' + AC + '" stroke-width="1.4" stroke-dasharray="4 4" opacity=".5"/>';
    return wrap(s);
  }

  /* co12 风险预警：压力曲线异常段 + 警示三角 */
  function co12() {
    var s = '';
    /* 阈值虚线 */
    s += ln(60, 70, 640, 70, AC, 1.2, '5 5', .5);
    /* 正常波动段 + 突升段 */
    s += '<path d="M60 150 L100 144 L140 152 L180 146 L220 150 L260 142 L300 148 L340 144 L360 138 L372 118 L384 92 L396 64 L410 52 L436 58 L470 66 L510 74 L560 84 L620 96" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".65"/>';
    /* 异常点圆 */
    s += circ(396, 64, 4.5, AC, 1.6, F1, .75);
    /* 警示三角 */
    s += '<path d="M396 26 L410 52 L382 52 Z" fill="' + F1 + '" stroke="' + AC + '" stroke-width="1.6" opacity=".8"/>';
    s += ln(396, 34, 396, 44, AC, 1.6, null, .75) + circ(396, 48, 1.3, AC, 1, AC, .8);
    /* 时间轴 */
    s += ln(48, 206, 660, 206, S, 1.4, null, .55);
    s += '<path d="M648 206 l10 0 m-4 -3.5 l4.5 3.5 l-4.5 3.5" fill="none" stroke="' + S + '" stroke-width="1.3" opacity=".55"/>';
    for (var i = 0; i < 7; i++) s += ln(80 + i * 85, 206, 80 + i * 85, 211, S, 1.1, null, .45);
    /* 竖直参考虚线 */
    s += ln(396, 58, 396, 206, S2, 1, '3 4', .35);
    return wrap(s);
  }

  /* co13 井下监测：仪器串 + 上行信号 + 地面接收 */
  function co13() {
    var s = '';
    s += boreHole(330, 30, 212, .6);
    /* 地面接收碟 */
    s += '<path d="M300 30 Q340 14 380 30" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".65"/>';
    s += ln(340, 22, 340, 30, S, 1.4, null, .6);
    /* 三个仪器 + 上行无线波纹 */
    var ys = [70, 118, 166], i;
    for (i = 0; i < 3; i++) {
      var y = ys[i];
      s += '<rect x="324" y="' + y + '" width="30" height="18" rx="3" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".65"/>';
      s += circ(339, y + 9, 3, S, 1.1, F2, .6);
      /* 右侧波纹弧（信号） */
      s += '<path d="M368 ' + (y + 2) + ' Q378 ' + (y + 9) + ' 368 ' + (y + 16) + '" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".5"/>';
      s += '<path d="M378 ' + (y - 3) + ' Q392 ' + (y + 9) + ' 378 ' + (y + 21) + '" fill="none" stroke="' + S2 + '" stroke-width="1.1" opacity=".35"/>';
      /* 上行信号虚线 */
      s += '<path d="M340 ' + (y - 6) + ' L340 ' + (y - 24) + '" stroke="' + S2 + '" stroke-width="1.1" stroke-dasharray="3 4" opacity=".4"/>';
    }
    /* 深度分界 */
    s += ln(60, 98, 640, 98, S2, 1, '5 6', .3) + ln(60, 146, 640, 146, S2, 1, '5 6', .3);
    /* 左侧各层椭圆 */
    s += '<ellipse cx="160" cy="70" rx="80" ry="18" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    s += '<ellipse cx="160" cy="120" rx="80" ry="18" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    s += '<ellipse cx="160" cy="170" rx="80" ry="18" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    return wrap(s);
  }

  /* co14 投产优化：阶梯提压差 + 产量响应 */
  function co14() {
    var s = '';
    /* 阶梯压差（虚线台阶上升） */
    s += '<path d="M60 190 L150 190 L150 164 L250 164 L250 136 L350 136 L350 108 L450 108 L450 84 L560 84" fill="none" stroke="' + S2 + '" stroke-width="1.4" stroke-dasharray="5 4" opacity=".55"/>';
    /* 产量响应（平滑曲线先升后缓） */
    s += '<path d="M60 196 Q130 178 200 156 Q280 130 360 112 Q440 98 520 92 Q580 88 640 88" fill="none" stroke="' + S + '" stroke-width="1.9" opacity=".7"/>';
    /* 每台阶节点 */
    var n = [[150, 190], [150, 164], [250, 164], [250, 136], [350, 136], [350, 108], [450, 108], [450, 84]];
    for (var i = 0; i < n.length; i++) s += circ(n[i][0], n[i][1], 2.6, S, 1.1, F1, .6);
    /* 轴 */
    s += ln(48, 206, 660, 206, S, 1.4, null, .55) + ln(48, 206, 48, 34, S, 1.4, null, .55);
    s += '<path d="M48 40 l0 -10 m-3.5 4.5 l3.5 -4.5 l3.5 4.5" fill="none" stroke="' + S + '" stroke-width="1.3" opacity=".55"/>';
    /* 临界线（出砂门槛） */
    s += ln(60, 66, 640, 66, AC, 1.2, '5 5', .5);
    return wrap(s);
  }

  /* co15 完井后反演：递减曲线 + 措施事件回推 */
  function co15() {
    var s = '';
    /* 实际产量递减曲线 */
    s += '<path d="M80 60 Q160 76 240 96 Q320 116 400 134 Q480 148 560 158 L640 164" fill="none" stroke="' + S + '" stroke-width="1.9" opacity=".7"/>';
    /* 三个措施事件（三角标记 + 竖虚线） */
    var ev = [180, 330, 480], i;
    for (i = 0; i < ev.length; i++) {
      s += '<path d="M' + ev[i] + ' 214 L' + (ev[i] + 6) + ' 224 L' + (ev[i] - 6) + ' 224 Z" fill="' + AC + '" opacity=".6"/>';
      s += ln(ev[i], 210, ev[i], 60, S2, 1, '3 4', .35);
    }
    /* 反推虚线（从现状回推理想基线） */
    s += '<path d="M640 164 Q480 150 330 130 Q200 110 100 84" fill="none" stroke="' + S2 + '" stroke-width="1.4" stroke-dasharray="5 4" opacity=".5"/>';
    /* 差值区段标注（两箭头竖线） */
    s += ln(560, 152, 560, 164, AC, 1.5, null, .6);
    s += ln(556, 152, 564, 152, AC, 1.3, null, .6) + ln(556, 164, 564, 164, AC, 1.3, null, .6);
    /* 轴 */
    s += ln(60, 206, 660, 206, S, 1.4, null, .55) + ln(60, 206, 60, 40, S, 1.4, null, .55);
    return wrap(s);
  }

  /* co16 老井重完井：老井 + 侧钻分支 + 剩余油透镜体 */
  function co16() {
    var s = '';
    /* 老井筒 */
    s += boreHole(210, 26, 210, .6);
    s += ln(214, 26, 214, 210, S2, 1, '3 5', .35);
    /* 侧钻分支（曲线） */
    s += '<path d="M219 120 Q300 124 380 148 Q450 168 540 170" fill="none" stroke="' + S + '" stroke-width="1.9" opacity=".7"/>';
    /* 分支点 */
    s += '<rect x="206" y="114" width="16" height="12" rx="2" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".7"/>';
    /* 剩余油透镜体 */
    s += '<ellipse cx="540" cy="170" rx="96" ry="30" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1.2" opacity=".5"/>';
    s += '<ellipse cx="540" cy="170" rx="60" ry="17" fill="none" stroke="' + S2 + '" stroke-width="1" opacity=".35"/>';
    /* 井底封堵（老井底塞） */
    s += '<rect x="204" y="188" width="22" height="9" rx="3" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".65"/>';
    /* 措施符号：分支沿线小菱形 ×2 */
    s += '<path d="M330 130 L337 137 L330 144 L323 137 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    s += '<path d="M440 154 L447 161 L440 168 L433 161 Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".6"/>';
    /* 地层界线 */
    s += ln(40, 100, 660, 100, S2, 1.1, '5 6', .3) + ln(40, 206, 660, 206, S2, 1.1, '5 6', .3);
    return wrap(s);
  }

  /* co17 井组协同：三井 + 层间干扰弧线 */
  function co17() {
    var s = '';
    /* 三口井（双线井筒，不同深度） */
    var xs = [150, 350, 550], bottoms = [150, 196, 130], i;
    for (i = 0; i < 3; i++) {
      s += boreHole(xs[i] - 8, 40, bottoms[i], .6);
      s += ln(xs[i] - 44, 40, xs[i] + 28, 40, S, 1.5, null, .55);
    }
    /* 储层大椭圆 */
    s += '<ellipse cx="350" cy="176" rx="290" ry="34" fill="' + F1 + '" stroke="' + S2 + '" stroke-width="1.2" opacity=".45"/>';
    /* 干扰弧线（井间双向虚线） */
    s += '<path d="M180 120 Q250 96 320 120" fill="none" stroke="' + S2 + '" stroke-width="1.3" stroke-dasharray="4 4" opacity=".5"/>';
    s += '<path d="M380 150 Q460 128 532 148" fill="none" stroke="' + S2 + '" stroke-width="1.3" stroke-dasharray="4 4" opacity=".5"/>';
    /* 双向箭头端点 */
    s += '<path d="M186 116 l-8 4 l7 5" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".55"/>';
    s += '<path d="M314 116 l8 4 l-7 5" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".55"/>';
    s += '<path d="M386 146 l-8 4 l7 5" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".55"/>';
    s += '<path d="M526 144 l8 4 l-7 5" fill="none" stroke="' + S2 + '" stroke-width="1.2" opacity=".55"/>';
    /* 各井生产箭头（向上） */
    for (i = 0; i < 3; i++) {
      s += '<path d="M' + (xs[i] - 8 + 9) + ' ' + (bottoms[i] - 18) + ' L' + (xs[i] + 1) + ' ' + (bottoms[i] - 46) + ' m-4 4 l4 -4 l4 4" fill="none" stroke="' + AC + '" stroke-width="1.3" opacity=".55"/>';
    }
    return wrap(s);
  }

  /* co18 全生命周期成本：现金流由负转正 + 修井尖刺 */
  function co18() {
    var s = '';
    /* 零线 */
    s += ln(60, 120, 660, 120, S2, 1.2, null, .5);
    /* 现金流曲线：初期投入（向下谷）→ 回升 → 累计转正 */
    s += '<path d="M60 120 Q80 190 120 196 Q170 200 220 168 Q280 130 340 108 Q420 84 520 72 Q590 66 660 62" fill="none" stroke="' + S + '" stroke-width="1.9" opacity=".7"/>';
    /* 负区域淡填充 */
    s += '<path d="M60 120 Q80 190 120 196 Q170 200 220 168 Q280 130 340 108 L330 120 Q270 138 214 168 Q168 194 122 190 Q84 184 60 120 Z" fill="' + F1 + '" opacity=".5"/>';
    /* 修井尖刺 ×2 */
    s += '<path d="M400 96 L410 128 L420 92" fill="none" stroke="' + AC + '" stroke-width="1.6" opacity=".65"/>';
    s += '<path d="M540 70 L548 98 L556 68" fill="none" stroke="' + AC + '" stroke-width="1.6" opacity=".65"/>';
    /* 回收期竖虚线 */
    s += ln(300, 44, 300, 204, S2, 1, '3 4', .4);
    /* 轴 */
    s += ln(48, 210, 660, 210, S, 1.4, null, .55) + ln(48, 210, 48, 40, S, 1.4, null, .55);
    return wrap(s);
  }

  /* co19 套管完整性：变形段 + 多臂检测 + 蚀孔 */
  function co19() {
    var s = '';
    /* 正常段套管 */
    s += boreHole(320, 26, 96, .6);
    /* 变形段：左管内凹、右管外凸（椭圆化） */
    s += '<path d="M320 96 Q330 104 326 118 Q322 134 330 144 L330 212" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".6"/>';
    s += '<path d="M338 96 Q332 106 336 118 Q340 132 334 144 L334 212" fill="none" stroke="' + S + '" stroke-width="1.5" opacity=".6"/>';
    s += ln(334, 96, 334, 212, S2, 1, '3 5', .3);
    /* 蚀孔 */
    s += circ(320, 170, 3, AC, 1.4, F1, .7) + circ(334, 186, 2.4, AC, 1.3, F1, .6);
    /* 多臂井径仪（圆盘 + 撑臂） */
    s += circ(328, 122, 7, F1, S, 1.4, .7);
    s += ln(321, 116, 313, 108, S, 1.2, null, .55) + ln(335, 116, 343, 108, S, 1.2, null, .55) +
      ln(321, 128, 313, 136, S, 1.2, null, .55) + ln(335, 128, 343, 136, S, 1.2, null, .55);
    /* 上行数据线 */
    s += ln(328, 108, 328, 34, S2, 1.1, '3 4', .4);
    /* 左侧壁厚剖面小图（双弧） */
    s += '<path d="M120 60 Q150 60 150 120 Q150 180 120 180" fill="none" stroke="' + S + '" stroke-width="1.6" opacity=".6"/>';
    s += '<path d="M132 72 Q156 72 156 120 Q156 168 132 168" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="4 4" opacity=".5"/>';
    /* 减薄段标记 */
    s += ln(150, 110, 160, 110, AC, 1.3, null, .55) + ln(150, 130, 160, 130, AC, 1.3, null, .55);
    return wrap(s);
  }

  /* co20 弃井封堵：桥塞 + 水泥塞 + 射孔段封堵 */
  function co20() {
    var s = '';
    s += boreHole(320, 26, 212, .6);
    /* 顶部切割回收（井口断开符号） */
    s += ln(310, 26, 348, 26, S, 1.6, null, .6);
    s += ln(322, 40, 322, 52, S2, 1.2, '3 4', .45);
    /* 水泥塞段（斜纹填充，上段） */
    s += '<rect x="322" y="64" width="14" height="44" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".65"/>';
    for (var i = 0; i < 7; i++) s += ln(322, 68 + i * 6, 336, 62 + i * 6, S, 1, null, .5);
    /* 桥塞 ×2（横向胶囊） */
    s += '<rect x="314" y="122" width="28" height="9" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    s += '<rect x="314" y="172" width="28" height="9" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    /* 两塞之间水泥塞（斜纹） */
    s += '<rect x="322" y="136" width="14" height="32" fill="' + F2 + '" stroke="' + S2 + '" stroke-width="1.2" opacity=".6"/>';
    for (i = 0; i < 5; i++) s += ln(322, 140 + i * 6, 336, 134 + i * 6, S2, 1, null, .45);
    /* 底部射孔段 + 封堵叉 */
    for (i = 0; i < 3; i++) s += ln(320, 194 + i * 6, 306, 190 + i * 6, S, 1.2, null, .5);
    s += ln(300, 206, 306, 212, S2, 1.2, null, .45) + ln(306, 206, 300, 212, S2, 1.2, null, .45);
    /* 左侧地层水箭头（被堵） */
    s += '<path d="M200 180 L290 180 m-8 -5 l8 5 l-8 5" fill="none" stroke="' + S2 + '" stroke-width="1.4" stroke-dasharray="5 4" opacity=".45"/>';
    /* 隔离层界线 */
    s += ln(60, 116, 640, 116, S2, 1.1, '5 6', .3) + ln(60, 162, 640, 162, S2, 1.1, '5 6', .3);
    return wrap(s);
  }

  var SCENES = {
    co1: co1, co2: co2, co3: co3, co4: co4, co5: co5,
    co6: co6, co7: co7, co8: co8, co9: co9, co10: co10,
    co11: co11, co12: co12, co13: co13, co14: co14, co15: co15,
    co16: co16, co17: co17, co18: co18, co19: co19, co20: co20
  };

  var MAP = {
    geology: geo, seismic: geo,
    drilling: wellbore, completion: wellbore, cementing: wellbore,
    perforation: wellbore, workover: wellbore,
    mudlogging: curve, welllog: curve,
    production: pump, eor: pump,
    transport: plant, refining: plant
  };

  /* 先查案例专属（完井 co1–co20），再按环节兜底 */
  g.SCENE_ART = function (id) {
    var f = SCENES[id] || MAP[id];
    return f ? f() : '';
  };
})(window);
