/* =========================================================
   场景档案头 · 3D 等轴测动态插画（纯 SVG + CSS 动画，零依赖）
   ART3D(id) → 有场景专属 3D 图则返回，否则回退原 SCENE_ART。
   立体感：等轴测圆柱（顶椭圆＋渐变侧面＋高光）、地层斜切层带、
   深度阴影；动态：流动虚线、脉冲光环、粒子浮沉、液面升降、
   容器级 3D 摆动（见 ui.css .dh-art）。
   颜色走 CSS 变量并带 fallback，深浅模式通用；纯图案、无文字。
   ========================================================= */
(function (g) {
  'use strict';

  var S = 'var(--navy, #22456B)';
  var S2 = 'var(--navy-3, #8CA3BC)';
  var F1 = 'var(--blue-l, #E8F0F8)';
  var F2 = 'var(--blue-ll, #F3F7FB)';
  var AC = 'var(--clay, #C4703F)';
  var JD = 'var(--jade, #2F7D6B)';

  /* 动画样式（前缀 a3- 防冲突） */
  var CSS =
    '<style>' +
    '@keyframes a3-dash{to{stroke-dashoffset:-34}}' +
    '@keyframes a3-dash-r{to{stroke-dashoffset:34}}' +
    '@keyframes a3-pulse{0%,100%{opacity:.15;transform:scale(.72)}50%{opacity:.6;transform:scale(1.12)}}' +
    '@keyframes a3-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}' +
    '@keyframes a3-rise{0%{transform:translateY(0);opacity:0}18%{opacity:.85}82%{opacity:.85}100%{transform:translateY(-30px);opacity:0}}' +
    '@keyframes a3-sink{0%{transform:translateY(-14px);opacity:0}20%{opacity:.9}100%{transform:translateY(52px);opacity:0}}' +
    '@keyframes a3-level{0%,100%{transform:translateY(0)}50%{transform:translateY(14px)}}' +
    '@keyframes a3-spin{to{transform:rotate(360deg)}}' +
    '@keyframes a3-glow{0%,100%{opacity:.25}50%{opacity:.75}}' +
    '@keyframes a3-draw{from{stroke-dashoffset:520}to{stroke-dashoffset:0}}' +
    '.a3-f{animation:a3-dash 2.2s linear infinite}' +
    '.a3-fs{animation:a3-dash 3.4s linear infinite}' +
    '.a3-fr{animation:a3-dash-r 2.6s linear infinite}' +
    '.a3-p{animation:a3-pulse 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}' +
    '.a3-fl{animation:a3-float 4.2s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-up{animation:a3-rise 3.6s ease-in infinite;transform-box:fill-box}' +
    '.a3-dn{animation:a3-sink 4.2s ease-in infinite;transform-box:fill-box}' +
    '.a3-lv{animation:a3-level 5.5s ease-in-out infinite;transform-box:fill-box}' +
    '.a3-g{animation:a3-glow 2.8s ease-in-out infinite}' +
    '.a3-dw{stroke-dasharray:520;animation:a3-draw 3.2s ease-out both}' +
    '</style>';

  function wrap(inner) {
    var defs =
      '<defs>' +
      '<linearGradient id="g3-metal" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#c9d8e6"/><stop offset=".35" stop-color="#f2f7fb"/>' +
      '<stop offset=".7" stop-color="#b6c8d9"/><stop offset="1" stop-color="#8fa9c0"/></linearGradient>' +
      '<linearGradient id="g3-metal2" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#a9bfd3"/><stop offset=".4" stop-color="#e4edf5"/>' +
      '<stop offset="1" stop-color="#7d97ae"/></linearGradient>' +
      '<linearGradient id="g3-cem" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#7fb89a"/><stop offset=".5" stop-color="#b9dcc9"/>' +
      '<stop offset="1" stop-color="#5e9a80"/></linearGradient>' +
      '<linearGradient id="g3-rock" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#e5dcc6"/><stop offset="1" stop-color="#cfc2a4"/></linearGradient>' +
      '<linearGradient id="g3-oil" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#d98a55"/><stop offset="1" stop-color="#a8552a"/></linearGradient>' +
      '<radialGradient id="g3-glow">' +
      '<stop offset="0" stop-color="#c4703f" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="#c4703f" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="g3-fluid" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#4d9a80"/><stop offset="1" stop-color="#2f7d6b"/></linearGradient>' +
      '</defs>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 230" ' +
      'preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + defs + CSS + inner + '</svg>';
  }
  function ln(x1, y1, x2, y2, c, w, dash, op, cls) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + (c || S) + '" stroke-width="' + (w || 1.4) + '"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '') +
      (cls ? ' class="' + cls + '"' : '') +
      ' stroke-linecap="round" opacity="' + (op == null ? .55 : op) + '"/>';
  }
  /* 等轴测圆柱：cx 中心、yTop 顶面中心 y、rx 横半径、ry 纵半径、h 体高 */
  function cyl(cx, yTop, rx, ry, h, fill, stroke, op, cls) {
    var s = '';
    s += '<path d="M' + (cx - rx) + ' ' + yTop + ' L' + (cx - rx) + ' ' + (yTop + h) +
      ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + (yTop + h) +
      ' L' + (cx + rx) + ' ' + yTop + '" fill="' + (fill || F1) + '" stroke="' + (stroke || S) +
      '" stroke-width="1.4" opacity="' + (op == null ? .8 : op) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
    s += '<ellipse cx="' + cx + '" cy="' + yTop + '" rx="' + rx + '" ry="' + ry +
      '" fill="' + F2 + '" stroke="' + (stroke || S) + '" stroke-width="1.4" opacity="' + (op == null ? .85 : op) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
    /* 高光 + 阴影竖线（立体感） */
    s += ln(cx - rx * .55, yTop + ry * .6, cx - rx * .55, yTop + h - 2, 'var(--white,#FFFFFF)', 2.2, null, .5);
    s += ln(cx + rx * .68, yTop + ry * .5, cx + rx * .68, yTop + h - 3, S2, 2, null, .35);
    return s;
  }
  /* 地层层带（横向带 + 斜纹理） */
  function band(x, y, w, h, op) {
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" fill="' + F1 + '" stroke="none" opacity="' + (op || .28) + '"/>';
    s += ln(x, y, x + w, y, S2, 1.1, '5 6', .3);
    for (var i = 0; i < w; i += 34) {
      s += ln(x + i, y + h, x + i + h * .8, y, S2, 1, null, .12);
    }
    return s;
  }
  function ell(cx, cy, rx, ry, fill, stroke, w, op, cls) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
      '" fill="' + (fill || 'none') + '" stroke="' + (stroke || S2) + '" stroke-width="' + (w || 1.3) +
      '" opacity="' + (op == null ? .5 : op) + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }

  /* ---------- co25 套管层次与下深优化：多层套管立体井身 + 必封点脉冲 ---------- */
  function co25() {
    var s = '';
    s += band(20, 118, 660, 34) + band(20, 152, 660, 40, .2) + band(20, 192, 660, 34, .16);
    /* 井口 */
    s += ln(96, 60, 132, 60, S, 2, null, .7) + ln(114, 60, 114, 78, S, 2, null, .7);
    s += ln(60, 78, 640, 78, S2, 1.2, '6 6', .35);
    /* 四层套管：宽度递减（等轴测圆柱叠套） */
    s += cyl(114, 78, 30, 9, 128, F1, S, .5, 'a3-dw');
    s += cyl(114, 206, 22, 7, 0, 'none', S, .55);           /* 表层鞋 */
    s += cyl(114, 128, 22, 7, 88, F2, S, .75);
    s += ell(114, 216, 16, 5.5, F1, S, 1.3, .6);
    s += cyl(114, 150, 16, 5.5, 66, F1, S, .9);
    s += ell(114, 216, 11, 4, F2, S, 1.2, .65);
    s += cyl(114, 168, 11, 4, 48, F2, S, 1);
    /* 环空水泥（斜纹） */
    for (var i = 0; i < 8; i++) s += ln(126, 92 + i * 14, 134, 86 + i * 14, S2, 1, null, .35);
    /* 必封点 ×2：脉冲光环 */
    s += ell(114, 132, 34, 11, 'none', AC, 2, .6, 'a3-p');
    s += ell(114, 132, 46, 15, 'none', AC, 1.2, .35, 'a3-p');
    s += ell(114, 172, 28, 9, 'none', AC, 2, .6, 'a3-p');
    s += ell(114, 172, 40, 13, 'none', AC, 1.2, .35, 'a3-p');
    /* 右侧：三压力阶梯虚线（缓移） */
    s += ln(430, 96, 560, 150, S, 1.3, '7 5', .5, 'a3-fs');
    s += ln(400, 116, 540, 176, AC, 1.3, '7 5', .55, 'a3-fs');
    s += ln(370, 140, 520, 200, JD, 1.3, '7 5', .5, 'a3-fs');
    s += ell(480, 172, 90, 26, 'none', S2, 1.1, .3);
    s += ell(480, 172, 58, 16, 'none', S2, 1, .22);
    /* 油藏油滴 */
    s += '<path d="M470 168 q-5 8 0 11 q6 3 8 -3 q2 -5 -3 -10 l-2 -3 z" fill="' + AC + '" opacity=".45" class="a3-fl"/>';
    s += '<path d="M500 164 q-5 8 0 11 q6 3 8 -3 q2 -5 -3 -10 l-2 -3 z" fill="' + AC + '" opacity=".3"/>';
    return wrap(s);
  }

  /* ---------- co27 工具组合：管串 3D 爆炸图（部件错相浮动） ---------- */
  function co27() {
    var s = '';
    /* 中央井轴虚线 */
    s += ln(160, 16, 160, 216, S2, 1.1, '4 7', .4);
    /* 5 个部件：通井规/洗井阀/坐封工具/封隔器/验封器，颜色区分，错相浮动 */
    var items = [
      { y: 30, rx: 13, ry: 4.5, h: 18, f: F1, d: 0 },
      { y: 66, rx: 15, ry: 5, h: 22, f: F2, d: .5 },
      { y: 108, rx: 14, ry: 5, h: 20, f: F1, d: 1 },
      { y: 146, rx: 18, ry: 6, h: 24, f: F2, d: 1.5 },
      { y: 186, rx: 12, ry: 4, h: 18, f: F1, d: 2 }
    ];
    items.forEach(function (it) {
      s += '<g class="a3-fl" style="animation-delay:' + it.d + 's">';
      s += cyl(160, it.y, it.rx, it.ry, it.h, it.f, S, .85);
      /* 接箍环 */
      s += ell(160, it.y + it.h + 3, it.rx - 3, it.ry - 1.2, 'none', S2, 1.1, .55);
      s += '</g>';
    });
    /* 连接虚线（流动） */
    s += ln(160, 50, 160, 66, S2, 1.2, '3 5', .5, 'a3-f');
    s += ln(160, 92, 160, 108, S2, 1.2, '3 5', .5, 'a3-f');
    s += ln(160, 132, 160, 146, S2, 1.2, '3 5', .5, 'a3-f');
    s += ln(160, 174, 160, 186, S2, 1.2, '3 5', .5, 'a3-f');
    /* 右侧：井筒轮廓（目标环境）+ 压力级差刻度线 */
    s += ln(300, 20, 300, 212, S2, 1.3, '2 6', .4);
    s += ln(320, 20, 320, 212, S2, 1.3, '2 6', .4);
    for (var i = 0; i < 7; i++) {
      s += ln(296, 34 + i * 28, 324, 34 + i * 28, S2, 1, null, .3);
    }
    /* 温压包络（淡色大椭圆） */
    s += ell(430, 120, 150, 66, F1, S2, 1.2, .35);
    s += ell(430, 120, 104, 44, 'none', S2, 1, .25, 'a3-g');
    s += ell(430, 120, 58, 24, F2, S2, 1, .3);
    /* 高温高压警示点 */
    s += ell(560, 74, 22, 8, 'none', AC, 1.8, .6, 'a3-p');
    s += ell(545, 158, 26, 9, 'none', AC, 1.8, .6, 'a3-p');
    return wrap(s);
  }

  /* ---------- co28 水泥浆推荐：配浆罐（桨叶旋转）+ 环空充填上升 ---------- */
  function co28() {
    var s = '';
    /* 左：配浆罐 */
    s += '<g class="a3-fl">';
    s += cyl(120, 52, 46, 15, 92, F1, S, .8);
    s += '<path d="M74 144 L120 168 L166 144" fill="none" stroke="' + S + '" stroke-width="1.4" opacity=".7"/>';
    s += ell(120, 168, 46, 15, F2, S, 1.4, .7);
    /* 搅拌桨（旋转） */
    s += '<g transform="translate(120 96)"><g class="a3-spin" style="animation-duration:5s;transform-box:fill-box;transform-origin:center">' +
      '<ellipse cx="0" cy="0" rx="30" ry="7" fill="none" stroke="' + S2 + '" stroke-width="1.6" opacity=".7"/>' +
      '<ellipse cx="0" cy="0" rx="7" ry="18" fill="none" stroke="' + S2 + '" stroke-width="1.6" opacity=".7"/></g></g>';
    s += ln(120, 52, 120, 96, S, 1.6, null, .6);
    /* 罐内液面（缓升降） */
    s += '<rect x="78" y="86" width="84" height="26" rx="4" fill="' + JD + '" opacity=".18" class="a3-lv"/>';
    s += '</g>';
    /* 中：管线到井口（流动） */
    s += ln(166, 92, 250, 92, S, 1.8, null, .6);
    s += ln(180, 92, 240, 92, JD, 3, '8 8', .5, 'a3-f');
    s += ln(250, 92, 250, 78, S, 1.8, null, .6);
    /* 右：井筒环空纵剖，水泥浆下沉充填 */
    s += ln(286, 40, 286, 216, S, 1.6, null, .7);
    s += ln(258, 40, 258, 216, S, 1.6, null, .7);
    s += ell(272, 40, 14, 5, F2, S, 1.4, .8);
    s += ln(250, 40, 250, 78, S, 1.8, null, .5);
    /* 环空水泥（液面缓升） */
    s += '<rect x="261" y="120" width="22" height="96" fill="' + JD + '" opacity=".2"/>';
    s += '<rect x="261" y="104" width="22" height="18" fill="' + JD + '" opacity=".3" class="a3-lv"/>';
    s += ln(261, 120, 283, 120, JD, 1.4, '5 4', .5, 'a3-f');
    /* 浆体粒子下沉 */
    for (var i = 0; i < 4; i++) {
      s += '<circle cx="' + (266 + (i % 2) * 10) + '" cy="' + (100 + i * 8) + '" r="2.6" fill="' + JD + '" opacity=".7" class="a3-dn" style="animation-delay:' + (i * .9) + 's"/>';
    }
    /* 套管内壁 + 尺寸感 */
    s += ln(268, 40, 268, 216, S2, 1.2, '4 4', .45);
    s += ln(276, 40, 276, 216, S2, 1.2, '4 4', .45);
    /* 右侧：稠化 S 曲线（流动） */
    s += ln(360, 200, 640, 200, S2, 1.1, null, .4);
    s += ln(360, 200, 360, 60, S2, 1.1, null, .4);
    s += '<path d="M380 196 C460 194 470 190 500 150 C530 110 540 100 620 92" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".65"/>';
    s += '<path d="M380 200 C470 198 480 194 510 158 C540 122 550 112 620 104" fill="none" stroke="' + S2 + '" stroke-width="1.2" stroke-dasharray="6 5" opacity=".45" class="a3-fs"/>';
    s += ln(470, 200, 470, 66, JD, 1.3, '5 5', .5, 'a3-g');
    /* 可泵区淡色 */
    s += '<rect x="360" y="150" width="280" height="50" fill="' + JD + '" opacity=".07"/>';
    return wrap(s);
  }

  /* ---------- co29 固井施工参数：环空纵剖 + 顶替流动 + 高压层预警 ---------- */
  function co29() {
    var s = '';
    /* 地层两侧 */
    s += band(20, 60, 150, 160, .22) + band(530, 60, 150, 160, .22);
    /* 井壁（左右壁）与内管 */
    s += ln(196, 36, 196, 216, S, 1.8, null, .7);
    s += ln(504, 36, 504, 216, S, 1.8, null, .7);
    s += ln(320, 48, 320, 216, S, 2.2, null, .8);
    s += ln(380, 48, 380, 216, S, 2.2, null, .8);
    s += ell(350, 48, 30, 9, F2, S, 1.5, .8);
    s += ln(300, 48, 320, 48, S, 2, null, .6);
    /* 环空水泥顶替界面（斜面）+ 上行流动箭头 */
    s += '<path d="M204 110 L316 150 L316 216 L204 216 Z" fill="' + JD + '" opacity=".16"/>';
    s += '<path d="M384 150 L496 110 L496 216 L384 216 Z" fill="' + JD + '" opacity=".16"/>';
    for (var i = 0; i < 3; i++) {
      s += ln(230 + i * 20, 196 - i * 6, 230 + i * 20, 150 - i * 6, JD, 2.4, '9 9', .55, 'a3-fs');
      s += ln(470 - i * 20, 196 - i * 6, 470 - i * 20, 150 - i * 6, JD, 2.4, '9 9', .55, 'a3-fs');
    }
    /* 内管钻井液下行 */
    s += ln(340, 70, 340, 210, S2, 3, '12 10', .4, 'a3-fr');
    s += ln(360, 70, 360, 210, S2, 3, '12 10', .4, 'a3-fr');
    /* 井口泵 */
    s += '<rect x="560" y="34" width="64" height="30" rx="5" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".8"/>';
    s += ln(560, 64, 624, 64, S, 1.4, null, .5);
    s += ell(592, 34, 32, 7, F2, S, 1.2, .6);
    s += ln(560, 49, 624, 49, S2, 1.1, '6 5', .4, 'a3-f');
    s += ln(504, 49, 560, 49, S, 1.6, null, .5);
    /* 高压层：红色脉动 */
    s += band(20, 168, 150, 26, .3);
    s += ell(170, 181, 44, 12, 'none', AC, 2, .55, 'a3-p');
    s += ell(170, 181, 58, 16, 'none', AC, 1.2, .3, 'a3-p');
    s += band(530, 168, 150, 26, .3);
    s += ell(530, 181, 40, 12, 'none', AC, 2, .55, 'a3-p');
    /* 压耗刻度虚线（缓移） */
    s += ln(240, 84, 460, 84, S, 1.1, '7 6', .35, 'a3-fs');
    s += ln(240, 100, 460, 100, AC, 1.1, '7 6', .4, 'a3-fs');
    return wrap(s);
  }

  /* ---------- co32 智能完井层段划分：水平井 4 段 + ICV 阀 + 粒子流入 ---------- */
  function co32() {
    var s = '';
    /* 储层大带 */
    s += band(20, 150, 660, 60, .2);
    /* 直井段 + 跟端弯头 */
    s += ln(120, 24, 120, 120, S, 2, null, .75);
    s += ln(104, 24, 104, 112, S, 1.6, null, .5);
    s += '<path d="M104 112 Q104 128 122 130 L150 130" fill="none" stroke="' + S + '" stroke-width="1.8" opacity=".75"/>';
    s += ln(120, 24, 150, 122, S, 1.8, null, .3);
    /* 水平段 4 节（不同色，等轴测圆柱横放） */
    var cols = [F1, F2, F1, F2];
    var x0 = 170, segW = 108;
    for (var i = 0; i < 4; i++) {
      var x = x0 + i * segW;
      s += '<rect x="' + x + '" y="118" width="' + (segW - 12) + '" height="24" rx="10" fill="' + cols[i] +
        '" stroke="' + S + '" stroke-width="1.5" opacity=".85"/>';
      s += ln(x + 10, 122, x + 10, 138, 'var(--white,#FFF)', 2, null, .5);
      /* 射孔簇（斜短线） */
      for (var k = 0; k < 4; k++) {
        s += ln(x + 18 + k * 20, 144, x + 12 + k * 20, 158, S2, 1.2, null, .5);
      }
      /* 储层粒子上升入井筒 */
      for (k = 0; k < 3; k++) {
        var ccc = (i === 1) ? AC : JD;
        s += '<circle cx="' + (x + 24 + k * 24) + '" cy="' + (172 - k * 6) + '" r="2.8" fill="' + ccc +
          '" opacity=".8" class="a3-up" style="animation-delay:' + (i * .5 + k * .8) + 's"/>';
      }
    }
    /* ICV 阀 ×3（段间，开关闪烁） */
    for (i = 0; i < 3; i++) {
      var vx = x0 + (i + 1) * segW - 18;
      s += '<rect x="' + (vx - 5) + '" y="112" width="10" height="36" rx="4" fill="' + S + '" opacity=".85" class="a3-g" style="animation-delay:' + (i * .7) + 's"/>';
      s += ell(vx, 112, 9, 3.5, F1, S, 1.2, .8);
      s += ell(vx, 148, 9, 3.5, F1, S, 1.2, .8);
    }
    /* 水窜段红框脉冲 */
    s += '<rect x="' + (x0 + segW) + '" y="108" width="' + (segW - 12) + '" height="44" rx="12" fill="none" stroke="' + AC + '" stroke-width="1.8" opacity=".6" class="a3-p"/>';
    /* 右侧趾端 + 地面_flow */
    s += ln(x0 + 4 * segW - 12, 118, x0 + 4 * segW + 8, 118, S, 1.8, null, .5);
    /* 地面小井架 */
    s += ln(96, 24, 132, 24, S, 2, null, .6);
    /* 产液管输出（流动） */
    s += ln(120, 24, 96, 12, S, 1.5, null, .4);
    s += ln(84, 12, 60, 12, JD, 2.4, '7 7', .5, 'a3-f');
    /* 控制缆线（从地面沿井到各阀，流动） */
    s += '<path d="M132 24 L660 20 L660 108 L' + (x0 + 3 * segW - 18) + ' 112" fill="none" stroke="' + S2 + '" stroke-width="1" stroke-dasharray="4 5" opacity=".4" class="a3-fs"/>';
    return wrap(s);
  }

  /* ---------- co33 压力恢复试井：储层斜方体 + 压力波扩散 + 断层 ---------- */
  function co33() {
    var s = '';
    /* 储层斜方体：顶面网格 + 前侧厚度 + 右侧面 */
    var x0 = 150, y0 = 60, w = 380, h = 110, dx = 60, dy = -26;
    /* 顶面（平行四边形） */
    s += '<path d="M' + x0 + ' ' + (y0 + h) + ' L' + (x0 + dx) + ' ' + (y0 + h + dy) + ' L' + (x0 + dx + w) + ' ' + (y0 + dy) + ' L' + (x0 + w) + ' ' + y0 + ' Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".5"/>';
    /* 前侧面 */
    s += '<path d="M' + x0 + ' ' + (y0 + h) + ' L' + (x0 + w) + ' ' + y0 + ' L' + (x0 + w) + ' ' + (y0 + 26) + ' L' + x0 + ' ' + (y0 + h + 26) + ' Z" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.3" opacity=".65"/>';
    /* 右侧面 */
    s += '<path d="M' + (x0 + w) + ' ' + y0 + ' L' + (x0 + w + dx) + ' ' + (y0 + dy) + ' L' + (x0 + w + dx) + ' ' + (y0 + dy + 26) + ' L' + (x0 + w) + ' ' + (y0 + 26) + ' Z" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.2" opacity=".4"/>';
    /* 顶面网格 */
    for (var i = 1; i < 7; i++) {
      s += ln(x0 + i * (w / 7), y0 + h, x0 + dx + i * (w / 7), y0 + h + dy, S2, .9, null, .3);
    }
    for (i = 1; i < 4; i++) {
      s += ln(x0 + (dx * i / 4), y0 + h + (dy * i / 4), x0 + w + (dx * i / 4), y0 + (dy * i / 4), S2, .9, null, .3);
    }
    /* 井筒（穿入顶面） */
    s += cyl(340, 118, 13, 4.5, 96, F2, S, .9);
    s += ln(340, 22, 340, 118, S, 2, null, .7);
    s += ln(328, 22, 352, 22, S, 2, null, .6);
    /* 井底压力波扩散（三环错相） */
    s += ell(340, 196, 26, 9, 'none', AC, 2, .55, 'a3-p');
    s += ell(340, 196, 52, 17, 'none', AC, 1.4, .4, 'a3-p');
    s += ell(340, 196, 86, 27, 'none', AC, 1, .28, 'a3-p');
    s += ell(340, 196, 124, 38, 'none', AC, .8, .18, 'a3-p');
    /* 断层线（右侧粗斜线） */
    s += ln(520, 40, 600, 200, S, 2.2, null, .55);
    for (i = 0; i < 5; i++) s += ln(524 + i * 3, 60 + i * 30, 542 + i * 3, 52 + i * 30, S2, 1, null, .4);
    /* 地面压力计 + 数据上行 */
    s += '<rect x="310" y="8" width="60" height="20" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".8"/>';
    s += ln(340, 28, 340, 34, S, 1.4, null, .5);
    s += ln(352, 118, 470, 40, S2, 1.1, '4 6', .45, 'a3-fs');
    /* 关井后恢复小曲线（右侧流动） */
    s += ln(560, 210, 560, 150, S2, 1, null, .35);
    s += '<path d="M560 205 C590 200 600 190 612 172 C626 150 632 142 668 136" fill="none" stroke="' + S + '" stroke-width="1.6" stroke-dasharray="8 6" opacity=".55" class="a3-f"/>';
    return wrap(s);
  }

  /* ---------- co34 完井施工数据分析：数据流沿电缆上行 + 异常段脉冲 ---------- */
  function co34() {
    var s = '';
    /* 地层带 */
    s += band(30, 130, 640, 32) + band(30, 162, 640, 40, .18);
    /* 井架 */
    s += '<path d="M120 74 L138 14 L178 14 L196 74" fill="none" stroke="' + S + '" stroke-width="1.7" opacity=".65"/>';
    s += ln(112, 74, 204, 74, S, 2, null, .7);
    s += ln(130, 46, 186, 46, S, 1.2, null, .5);
    s += ln(126, 60, 190, 60, S, 1.2, null, .5);
    /* 地面数据箱 + 波形 */
    s += '<rect x="230" y="18" width="70" height="34" rx="6" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.4" opacity=".85"/>';
    s += '<path d="M240 36 q6 -12 12 0 q6 12 12 0 q6 -12 12 0 q6 12 12 0" fill="none" stroke="' + JD + '" stroke-width="1.6" opacity=".8" class="a3-g"/>';
    /* 井筒 */
    s += ln(158, 78, 158, 216, S, 2.2, null, .75);
    s += ln(178, 78, 178, 216, S, 2.2, null, .75);
    s += ell(168, 78, 10, 3.6, F2, S, 1.3, .8);
    /* 井下工具段（封隔器/筛管） */
    s += '<rect x="152" y="150" width="32" height="12" rx="4" fill="' + F1 + '" stroke="' + S + '" stroke-width="1.3" opacity=".9"/>';
    s += '<rect x="152" y="184" width="32" height="16" rx="4" fill="' + F2 + '" stroke="' + S + '" stroke-width="1.3" opacity=".9"/>';
    for (var i = 0; i < 5; i++) s += ln(154 + i * 7, 186, 154 + i * 7, 198, S2, 1, null, .5);
    /* 异常段脉冲 */
    s += ell(168, 172, 40, 13, 'none', AC, 1.8, .55, 'a3-p');
    s += ell(168, 172, 56, 18, 'none', AC, 1, .3, 'a3-p');
    /* 三路数据流沿电缆上行（不同速度） */
    s += ln(186, 210, 186, 78, JD, 2, '8 9', .5, 'a3-f');
    s += ln(194, 210, 194, 78, AC, 2, '8 9', .5, 'a3-fs');
    s += ln(202, 210, 202, 78, S, 1.6, '6 9', .4, 'a3-fr');
    /* 电缆 */
    s += ln(178, 78, 178, 30, S2, 1.2, '3 5', .5, 'a3-fs');
    /* 右侧：五工况色带（时序）+ 扫描线 */
    var segCols = [S2, AC, JD, S2, S2];
    for (i = 0; i < 5; i++) {
      s += '<rect x="' + (330 + i * 66) + '" y="' + (120 + (i % 2) * 10) + '" width="58" height="16" rx="4" fill="' + F1 + '" stroke="' + segCols[i] + '" stroke-width="1.2" opacity=".6"/>';
    }
    s += ln(320, 152, 680, 152, S2, 1, null, .35);
    s += ln(340, 100, 340, 170, JD, 1.6, '6 7', .5, 'a3-f');
    /* 报警红点 */
    s += ell(428, 132, 14, 6, 'none', AC, 1.8, .6, 'a3-p');
    s += ell(560, 142, 14, 6, 'none', AC, 1.8, .6, 'a3-p');
    return wrap(s);
  }

  var TABLE = {
    co25: co25, co27: co27, co28: co28,
    co29: co29, co32: co32, co33: co33, co34: co34
  };

  /* 包装原 SCENE_ART：有 3D 专属图优先，否则回退 */
  var prev = g.SCENE_ART;
  g.ART3D = TABLE;
  g.SCENE_ART = function (id) {
    var f = TABLE[id];
    if (f) return f();
    return prev ? prev(id) : '';
  };
})(window);
