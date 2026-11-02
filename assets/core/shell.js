/* =========================================================
   应用外壳 Shell
   ---------------------------------------------------------
   职责：路由、页面骨架、导航、把案例挂到场景页上。
   不含任何具体案例的业务内容 —— 那些都在 assets/cases/*.js
   ========================================================= */

(function (global) {
  'use strict';

  var A = global.ATLAS;
  var M = A.methods;
  var K = global.K;
  var esc = K.esc, pad = K.pad, rich = K.rich;

  var view = document.getElementById('view');
  var mounted = null;          // 当前挂载中的示范，切页时调用其 unmount
  var mountedKey = '';

  /* =========================================================
     一、路由
     ========================================================= */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), qs = '';
    if (qi >= 0) { qs = h.slice(qi + 1); h = h.slice(0, qi); }
    var q = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { parts: h.split('/').filter(Boolean), q: q };
  }

  function go(hash) { location.hash = hash; }

  /* file:// 协议下部分浏览器会拒绝 replaceState，失败时静默降级 */
  function setHashQuiet(hash) {
    try { history.replaceState(null, '', hash); }
    catch (e) { /* 忽略：地址栏不同步不影响功能 */ }
  }

  /* =========================================================
     二、公共片段
     ========================================================= */
  /* 界面语言（只作用于外壳文案：导航 / 数据条 / 主按钮） */
  var LANG = (function () {
    try { return localStorage.getItem('atlas-lang') === 'en' ? 'en' : 'zh'; }
    catch (e) { return 'zh'; }
  })();

  var I18N = {
    zh: {
      home: '首页', map: '介入点图谱', chain: '作业链', cases: '案例库', guide: '接入规范',
      data: '数据资产', plan: '立项参考', mine: '我的工作区',
      manage: '管理', manageIn: '管理后台', addCase: '添加案例',
      tipAdd: '上传标准案例包（与同学案例格式兼容）',
      ph: '检索场景 / 案例 / 技术', ariaSearch: '全站检索',
      ver: '数据版本', upd: '更新于', stages: '作业环节', scenes: '候选场景', reg: '已接入案例',
      langTip: '切换中英文（导航与按钮）', themeTip: '切换明暗主题', top: '回到顶部'
    },
    en: {
      home: 'Home', map: 'Entry map', find: 'Find topic', chain: 'Chain', cases: 'Cases', guide: 'Guide',
      data: 'Data assets', plan: 'Assessment', mine: 'Workspace',
      manage: 'Admin', manageIn: 'Admin', addCase: 'Add case',
      tipAdd: 'Upload a standard case package',
      ph: 'Search scene / case / method', ariaSearch: 'Search site',
      ver: 'Version', upd: 'Updated', stages: 'Stages', scenes: 'Scenes', reg: 'Cases',
      langTip: 'Switch UI language', themeTip: 'Toggle light / dark', top: 'Back to top'
    }
  };

  function T(k) {
    var d = I18N[LANG] || I18N.zh;
    return d[k] || I18N.zh[k] || k;
  }

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  var ICON_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6 V5 M12 19 V21.4 M2.6 12 H5 M19 12 H21.4 M5.4 5.4 L7.1 7.1 M16.9 16.9 L18.6 18.6 M18.6 5.4 L16.9 7.1 M7.1 16.9 L5.4 18.6"/></svg>';
  var ICON_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 14.2 A8.2 8.2 0 0 1 9.8 4 A8.6 8.6 0 1 0 20 14.2 Z"/></svg>';

  function header() {
    var r = parseHash();
    /* 子页面归到父级导航：场景/环节 → 作业链，方法 → 图谱；
       但带 ?case= 的场景页实际是案例详情，归到「案例库」 */
    var NAV_OF = { scene: 'chain', stage: 'chain', method: 'map' };
    var cur = NAV_OF[r.parts[0]] || r.parts[0] || 'home';
    if (r.q && r.q.case) cur = 'cases';
    function on(k) { return cur === k ? ' on' : ''; }
    var cs = Cases.stats();
    var q0 = cur === 'search' ? (r.q.q || '') : '';

    /* 全站检索：位于数据条右侧 */
    var gs = '<span class="gs-wrap">' +
      '<div class="gsearch" id="gsearch">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#718096" stroke-width="2.2" stroke-linecap="round">' +
      '<circle cx="10.5" cy="10.5" r="6.4"/><path d="M15.6 15.6 L21 21"/></svg>' +
      '<input id="gs-in" type="text" placeholder="' + T('ph') + '" aria-label="' + T('ariaSearch') + '" value="' + esc(q0) + '">' +
      '<kbd>/</kbd></div>' +
      '<div class="gsug" id="gsug" hidden></div>' +
      '</span>';

    /* 右上角：中英切换 / 明暗切换 */
    var tools = '<div class="hdr-tools">' +
      '<button class="htool htool-lang" id="lang-toggle" type="button" title="' + T('langTip') + '" aria-label="' + T('langTip') + '">' +
      '<span class="' + (LANG === 'zh' ? 'hl-on' : 'hl-dim') + '">中</span>' +
      '<span class="hl-sep">/</span>' +
      '<span class="' + (LANG === 'en' ? 'hl-on' : 'hl-dim') + '">EN</span></button>' +
      '<button class="htool" id="theme-toggle" type="button" title="' + T('themeTip') + '" aria-label="' + T('themeTip') + '">' +
      (isDark() ? ICON_MOON : ICON_SUN) + '</button>' +
      '</div>';

    /* 上行：深炭蓝主导航（Logo + 菜单 + 右侧工具） */
    var bar = '<div class="hdr-bar"><div class="hdr-in">' +
      '<a class="brand" href="#/">' +
      '<span class="brand-mark">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0A2038" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M5 4 L12 21 L19 4"/><path d="M8.2 9.4 H15.8"/><path d="M9.8 15 H14.2"/><path d="M6.6 6.6 H17.4"/>' +
      '</svg></span>' +
      '<span class="brand-txt"><b>智能化可能性地图</b><span>Petro × AI Atlas</span></span></a>' +
      '<nav class="nav">' +
      '<a class="nav-keep' + on('home') + '" href="#/">' + T('home') + '</a>' +
      '<a class="nav-keep' + on('chain') + '" href="#/chain">' + T('chain') + '</a>' +
      '<a class="nav-keep' + on('map') + '" href="#/map">' + T('map') + '</a>' +
      '<a class="nav-keep' + on('cases') + '" href="#/cases">' + T('cases') + '</a>' +
      '<a class="nav-keep' + on('data') + '" href="#/data">' + T('data') + '</a>' +
      '<a class="nav-keep' + on('plan') + '" href="#/plan">' + T('plan') + '</a>' +
      '<a class="nav-keep' + on('guide') + '" href="#/guide">' + T('guide') + '</a>' +
      '</nav>' + tools +
      '</div></div>';

    /* 下行：弱化数据条（版本 / 更新 / 统计 + 右侧检索 / 管理 / 添加案例） */
    var strip = '<div class="hdr-strip"><div class="hdr-strip-in">' +
      '<span class="strip-stat">' +
      '<span>' + T('ver') + ' ' + esc(A.meta.version) + '</span><i></i>' +
      '<span>' + T('upd') + ' ' + esc(A.meta.updated) + '</span><i></i>' +
      '<span>' + T('stages') + ' <b>' + A.stages.length + '</b></span><i></i>' +
      '<span>' + T('scenes') + ' <b>' + A.allScenes.length + '</b></span><i></i>' +
      '<span>' + T('reg') + ' <b>' + cs.registered + '</b></span>' +
      '</span>' + gs +
      '<a class="hdr-link" href="#/mine">' + T('mine') + '</a>' +
      '<a class="hdr-link" href="#/admin">' + (Admin.loggedIn() ? T('manageIn') : T('manage')) + '</a>' +
      '<button class="nav-add" data-import title="' + T('tipAdd') + '">' + T('addCase') + '</button>' +
      '</div></div>';

    return '<header class="hdr">' + bar + strip +
      '<div class="hdr-prog" id="hdr-prog"></div>' +
      '<button class="totop" id="totop" title="' + T('top') + '" aria-label="' + T('top') + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M12 19 V6"/><path d="M6 12 L12 6 L18 12"/></svg></button>' +
      '</header>';
  }

  function footer() {
    var s = Cases.stats();
    return '<footer class="ftr"><div class="wrap"><div class="ftr-in">' +
      '<div class="ftr-col" style="max-width:32ch">' +
      '<h5>关于本站</h5>' +
      '<p>' + esc(A.meta.title) + '</p>' +
      '<p style="margin-top:6px">覆盖 ' + A.stages.length + ' 个作业环节、' + A.allScenes.length +
      ' 个可智能化候选场景，已接入案例 ' + s.registered + ' 项。</p></div>' +
      '<div class="ftr-col"><h5>检索入口</h5>' +
      '<a href="#/chain">按作业环节</a>' +
      '<a href="#/data">按数据口径</a>' +
      '<a href="#/data">按手头数据选题</a>' +
      '<a href="#/method/cv">按技术路线</a>' +
      '<a href="#/search">全站检索</a>' +
      '<a href="#/cases">案例库</a></div>' +
      '<div class="ftr-col"><h5>案例接入</h5>' +
      '<a href="#/guide">接入规范</a>' +
      '<a href="#" data-dl-template>案例包模板下载</a>' +
      '<a href="#/cases?view=list">接入状态与校验</a>' +
      '<a href="#/admin">管理后台</a></div>' +
      '<div class="ftr-col"><h5>联系与支持</h5>' +
      '<p>技术支持：' + esc(A.meta.email) + '</p>' +
      '<p style="margin-top:6px">运行环境：纯静态站点，无后端依赖，可离线部署。</p>' +
      '<p style="margin-top:6px"><a href="mailto:' + esc(A.meta.email) + '?subject=' + encodeURIComponent('智能化可能性地图 · 贡献/纠错') + '" style="color:var(--on-d-2)">贡献 / 纠错（邮件反馈）↗</a></p>' +
      '<p style="margin-top:6px"><a href="#" data-lrn-export-atlas style="color:var(--on-d-2)">导出场景数据（JSON）↘</a><br>' +
      '<span style="font-size:10px;color:var(--on-d-3)">77 个场景的元数据快照：环节 / 方法 / 难度 / 数据条件 / 接入状态</span></p>' +
      '<div style="margin-top:10px;display:flex;gap:7px;flex-wrap:wrap">' +
      '<button class="btn sm amber" data-import>添加案例</button></div>' +
      '</div>' +
      '</div>' +
      '<div class="ftr-bot">' +
      '<span>' + esc(A.meta.version) + ' · 更新于 ' + esc(A.meta.updated) + ' · 数据仅用于教学与方法演示</span>' +
      '<span>本站所载算例与参数不作为工程设计或生产决策依据</span></div>' +
      '</div></footer>';
  }

  function crumb(items) {
    return '<nav class="crumb">' + items.map(function (it, i) {
      var last = i === items.length - 1;
      return (i ? '<span class="sep">/</span>' : '') +
        (last ? '<span class="cur">' + esc(it[1]) + '</span>' : '<a href="' + it[0] + '">' + esc(it[1]) + '</a>');
    }).join('') + '</nav>';
  }

  /* 给每个面包屑补「← 返回上级」：父级 = 面包屑里最后一个可点链接。
     各页 crumb 写法不一（含其它模块手写的），统一在这里注入，避免逐页改。 */
  function injectCrumbBack(view) {
    var curPath = (location.hash || '').split('?')[0];
    [].forEach.call(view.querySelectorAll('.crumb'), function (nav) {
      if (nav.querySelector('.crumb-back')) return;
      /* 父级 = 面包屑里最后一个「不是当前页」的链接；
         .crumb-x 是平级跳转（如介入点图谱 → 作业链），不算父级；
         案例详情页（#/scene/x?case=y）返回案例库而不是场景所属环节 */
      var isCasePage = /(?:^|[&?])case=[^&]+/.test(location.hash.split('#')[1] || '');
      var links = nav.querySelectorAll('a'), up = null;
      for (var i = links.length - 1; i >= 0; i--) {
        if (links[i].classList.contains('crumb-x')) continue;
        var h = (links[i].getAttribute('href') || '').split('?')[0];
        if (isCasePage && h !== '#/cases') continue;
        if (h && h !== curPath) { up = links[i]; break; }
      }
      var a = document.createElement('a');
      a.className = 'crumb-back';
      a.setAttribute('href', up ? up.getAttribute('href') : '#/');
      var nm = up ? up.textContent.trim() : '总览';
      a.innerHTML = '<span class="ar">←</span>' +
        (LANG === 'en' ? 'Back' : '返回' + (nm === '总览' ? '总览' : nm));
      nav.appendChild(a);
    });
  }

  /* 五类技术的极简线性图标（图例 / 方法卡共用，currentColor） */
  var MICONS = {
    cv: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4.5 18.5 L10 13 L14 17 L17 14 L20 17.5"/></svg>',
    ts: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20 H21"/><path d="M4 15 L9 9 L13 12 L19 4"/><path d="M15.5 4 H19 V7.5"/></svg>',
    nlp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5 H16 M8 12 H16 M8 15.5 H13"/></svg>',
    opt: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 V6 M12 18 V21.2 M2.8 12 H6 M18 12 H21.2 M5.5 5.5 L7.8 7.8 M16.2 16.2 L18.5 18.5 M18.5 5.5 L16.2 7.8 M7.8 16.2 L5.5 18.5"/></svg>',
    kg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="8" r="2.4"/><circle cx="10" cy="18" r="2.4"/><path d="M8.2 7 L15.7 7.6 M7 8.2 L9 15.8 M16.8 9.8 L11.6 16.2"/></svg>'
  };
  function mIcon(k) { return MICONS[(M[k] && (M[k].colorKey || k)) || 'cv'] || MICONS.cv; }

  function methodChip(k) {
    var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
    return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
  }

  function caseChip(k) {  /* 案例 methods 标签（小号） */
    var m = M[k];
    if (!m) return '';
    var ck = m.colorKey || k;
    return '<span class="mtag sm" data-m="' + ck + '"><b>' + esc(m.abbr) + '</b>' + esc(m.name) + '</span>';
  }

  function stageBar(stageId) {
    var counts = A.countByStageMethod()[stageId];
    var keys = Object.keys(counts).filter(function (k) { return counts[k] > 0; });
    if (!keys.length) return '<div class="step-bar"><i class="empty"></i></div>';
    return '<div class="step-bar">' + keys.map(function (k) {
      var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
      return '<i style="flex:' + counts[k] + ';background:var(--c-' + ck + ')"></i>';
    }).join('') + '</div>';
  }

  /* =========================================================
     指标口径悬浮说明（data-tip）
     提示层挂在 body 上，避免被 .hero / .spec 的 overflow:hidden 裁掉。
     ⓘ 同时可聚焦（tabindex），键盘与触屏用户走「指标口径」折叠表。
     ========================================================= */
  var tipEl = null;
  function tipHide() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  function tipShow(anchor) {
    var txt = anchor.getAttribute('data-tip');
    if (!txt) return;
    if (tipEl && tipEl._for === anchor) return;
    tipHide();
    var el = document.createElement('div');
    el.className = 'cal-tip';
    el.setAttribute('role', 'tooltip');
    el.textContent = txt;
    el._for = anchor;
    document.body.appendChild(el);
    tipEl = el;
    var r = anchor.getBoundingClientRect();
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.max(10, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 10));
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 8);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.classList.add('on');
  }
  var tipsBound = false;
  function bindTips() {
    if (tipsBound) return;
    tipsBound = true;
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (t) tipShow(t); else tipHide();
    });
    document.addEventListener('focusin', function (e) {
      var t = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (t) tipShow(t); else tipHide();
    });
    document.addEventListener('focusout', tipHide);
    window.addEventListener('scroll', tipHide, true);
  }

  /* =========================================================
     三、首页
     ========================================================= */

  /* ---- 首页文案集中区：答辩 / 教学要改的话，改这里就够了 ---- */

  /* 难度口径：与 #/plan 立项评估用的是同一套定义，首页先对齐口径 */
  var DIFF_CAL = [
    ['低', '公开数据充足、成熟算法、容易复现，适合大创入门'],
    ['中', '数据需要标注、有工程门槛'],
    ['高', '工业涉密数据、机理耦合强、落地风险高']
  ];
  function diffTipText() {
    return '难度口径 · 与立项参考页同源\n' +
      DIFF_CAL.map(function (x) { return x[0] + '：' + x[1]; }).join('\n');
  }

  var ICO_STUDENT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5 L2.5 9.5 L12 14 L21.5 9.5 Z"/><path d="M6.5 11.4 V16.4 C6.5 17.5 9.1 18.4 12 18.4 S17.5 17.5 17.5 16.4 V11.4"/><path d="M21.5 9.5 V15"/></svg>';
  var ICO_TARGET = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/></svg>';
  var ICO_TEACH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 9.5 H16 M8 13 H13"/><path d="M12 17 V20.5 M8.5 20.5 H15.5"/></svg>';
  var ARROW_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 H19 M14 6.5 L19.5 12 L14 17.5"/></svg>';

  /* 01 平台适合谁 / 解决什么痛点 */
  var WHO = [
    {
      t: '油气专业学生', en: 'Students', ic: ICO_STUDENT, href: '#/chain', go: '从作业链看起',
      d: '顺着 13 个作业环节看 AI 在勘探开发里到底怎么落地：先建立场景直觉，再看算法替人做了哪一步，顺带避开「AI 万能」的误区。'
    },
    {
      t: 'AI 方向大创 / 竞赛选题', en: 'Projects', ic: ICO_TARGET, href: '#/plan', go: '去立项参考',
      d: '按作业环节 / 技术路线快速筛选可立项场景，评估数据缺口、标注成本与合规风险，一键生成《立项评估报告》。'
    },
    {
      t: '授课老师', en: 'Teaching', ic: ICO_TEACH, href: '#/cases', go: '看案例库',
      d: '直接用作课堂案例、课后作业与课题方向引导：每个案例都配专业背景图解、流程拆解与浏览器内可运行示范。'
    }
  ];

  /* 02 三步快速上手 */
  var STEPS3 = [
    {
      n: '01', k: '先看', t: '介入点图谱', href: '#/map', go: '打开图谱',
      d: '看懂全流程 13 个环节上 AI 能介入在哪一步、数据从哪里来、上下游谁依赖谁——先有全局，再谈选题。'
    },
    {
      n: '02', k: '再筛', t: '按环节 / 技术检索', href: '#/chain', go: '开始筛选',
      d: '用作业链或方法标签筛出候选场景，逐项看介入点、数据条件、难度与公开案例丰富度，把范围收窄到 3—5 个。'
    },
    {
      n: '03', k: '最后', t: '立项参考页做评估', href: '#/plan', go: '生成报告',
      d: '把候选场景加入评估池，算数据缺口、标注成本、上游依赖与合规风险，排序后导出《立项评估报告》。'
    }
  ];

  /* 精选案例：effect 取自各案例自身的流程指标（一句话效果） */
  var FEATURED = [
    { id: 'welllog-layer', effect: '42 口井自动卡层：单井 3.5 h → 15 min 复核，界面偏差 ≤ 0.5 m' },
    { id: 'firstbreak-stalta', effect: '4.8 万道自动拾取，只复核置信度最低的 10%，全测线 4 天交付' },
    { id: 'completion-risk-warn', effect: '186 井次历史作业入库，事故成形前平均提前 42 s 报警，误报 8.4%' },
    { id: 'sleeve-control-rl', effect: '4 段 × 36 个决策周期的组合空间，用离线策略搜索替代经验调参' }
  ];

  /* 引用 / 致谢：答辩前把下面三项改成实际信息即可（留空显示「待填写」） */
  var HOME_ACK = {
    advisor: '',   /* 指导教师，例：'张×× 教授' */
    project: '',   /* 依托课题 / 大创项目，例：'20×× 年大学生创新创业训练计划（编号 ×××）' */
    course: ''     /* 课程 / 用途，例：'《油气人工智能导论》课程案例' */
  };

  var FAQ4 = [
    {
      q: '这些场景能不能直接拿来做大创？',
      a: '可以当<b>候选池</b>，不能直接当题目。' + A.allScenes.length +
        ' 个场景给的是「哪个环节、哪种数据形态上 AI 能介入」，还要收窄成一个可验收的题目' +
        '（例如「单井 1 s 曲线上的异常提前预警」）。难度标「低」的公开数据充足、算法成熟，适合入门；' +
        '标「高」的多涉及涉密数据与机理耦合，不建议作为第一个项目。收窄后去<b>立项参考页</b>跑一遍数据缺口与风险排序。'
    },
    {
      q: '案例里的数据是真实油田数据吗？',
      a: '不是。全部为<b>脱敏 / 合成数据</b>：曲线、井次与参数由脚本按工程关系式生成，用来演示方法流程与指标口径，' +
        '<b>不作为工程设计或生产决策依据</b>。场景页「需要准备什么」一段列的是真实口径下要备齐的数据与标注，' +
        '可按它对照本单位的实际条件。'
    },
    {
      q: '新增案例需要写代码吗？',
      a: '不需要改站点代码。标准做法是交一个案例包：<b>case.json</b>（声明场景、背景四段、流程步骤、方法标签、数据条件）' +
        ' + <b>demo/</b>（可选的可运行示范）。用右上角「添加案例」上传即可，导航、检索与版式由外壳自动接管；' +
        '想永久接入再写成 <b>Cases.register()</b> 插件文件，详见<b>接入规范</b>页。'
    },
    {
      q: '立项参考页输出的报告可以直接用于申报吗？',
      a: '可以当<b>素材</b>，不能直接当申报书。报告给的是场景排序、数据缺口、技术路线与风险边界，' +
        '评分口径是本站点自定义的粗分层；申报前需替换成本单位真实数据条件，补充文献调研、进度与预算，' +
        '并按学校模板重写结论部分。'
    }
  ];

  /* 取 4 个精选案例：优先 FEATURED，缺失时自动用「带可运行示范」的案例补足 */
  function featuredCases() {
    var out = [];
    FEATURED.forEach(function (f) {
      var c = Cases.get(f.id);
      if (c) out.push({ c: c, effect: f.effect });
    });
    if (out.length < 4) {
      Cases.list().forEach(function (c) {
        if (out.length >= 4) return;
        if (out.some(function (x) { return x.c.id === c.id; })) return;
        if (!(c.tabs && c.tabs.demo)) return;
        var w = c.tabs.workflow || {};
        var lead = w.lead;
        var one = Array.isArray(lead) ? lead[0] : lead;
        var st = w.stats || [];
        var eff = st.length
          ? st.slice(0, 2).map(function (x) { return x[0] + ' ' + x[1]; }).join(' · ')
          : String(one || '').slice(0, 46);
        out.push({ c: c, effect: eff || '点击查看流程与可运行示范' });
      });
    }
    return out.slice(0, 4);
  }

  /* 01 平台适合谁 / 解决什么痛点 */
  function homeWhoHTML() {
    var cards = WHO.map(function (w) {
      return '<article class="who-card">' +
        '<div class="wc-h"><span class="wc-ic">' + w.ic + '</span>' +
        '<h3>' + esc(w.t) + '</h3><span class="wc-en">' + esc(w.en) + '</span></div>' +
        '<p>' + esc(w.d) + '</p>' +
        '<a class="wc-go" href="' + w.href + '">' + esc(w.go) + '<span class="ar">→</span></a>' +
        '</article>';
    }).join('');
    return '<section class="section"><div class="wrap">' +
      '<div class="sec-head"><div class="sec-line">' +
      '<span class="sec-num">01</span><h2>平台适合谁 · 能解决什么痛点</h2>' +
      '<span class="kicker">WHO &amp; WHY</span>' +
      '<span class="r"><a class="btn sm" href="#/plan">去立项参考 →</a></span></div>' +
      '<p>面向三类用户：油气专业学生看懂 AI 怎么落地；大创 / 竞赛选题快速筛场景、评风险、出报告；' +
      '授课老师直接拿案例上课、布置作业、引导课题方向。三类用户走的是同一条三步路径。</p></div>' +
      '<div class="who-pain"><span class="wp-k">一句话痛点</span>' +
      '<span class="wp-t">不知道油气场景<b>哪里适合上 AI</b> · 不知道<b>数据门槛</b> · 不知道<b>立项风险</b></span></div>' +
      '<div class="who-grid">' + cards + '</div>' +
      '</div></section>';
  }

  /* 02 三步快速上手 */
  function homeStepsHTML() {
    var cells = STEPS3.map(function (s, i) {
      var cell = '<div class="st3"><div class="st3-top">' +
        '<span class="st3-n">' + s.n + '</span><span class="st3-k">' + esc(s.k) + '</span></div>' +
        '<h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p>' +
        '<a class="st3-go" href="' + s.href + '">' + esc(s.go) + '<span class="ar">→</span></a></div>';
      return i ? '<div class="st3-arr">' + ARROW_R + '</div>' + cell : cell;
    }).join('');
    return '<section class="section"><div class="wrap">' +
      '<div class="sec-head"><div class="sec-line">' +
      '<span class="sec-num">02</span><h2>快速上手：新手三步走</h2>' +
      '<span class="kicker">GET STARTED · 3 STEPS</span></div>' +
      '<p>入口只有三步：先看全局图谱建立场景感，再按环节 / 技术把候选收到 3—5 个，最后去立项参考页做评估并出报告。' +
      '三步都不需要装环境，浏览器里就能跑完。</p></div>' +
      '<div class="steps3">' + cells + '</div>' +
      '<p class="steps-note">提示：中途随时可以用<b>全站检索</b>（右上搜索框或按 <span class="mono">/</span>）' +
      '直接搜场景名、案例名或技术关键词，不必一步步点回来。</p>' +
      '</div></section>';
  }

  /* 03 精选案例 */
  function homeFeaturedHTML() {
    var list = featuredCases();
    if (!list.length) return '';
    var cards = list.map(function (x) {
      var c = x.c;
      var sc = A.index.byScene[c.sceneId];
      var stg = sc ? A.index.byStage[sc.stageId] : null;
      var hasDemo = !!(c.tabs && c.tabs.demo);
      var href = '#/scene/' + c.sceneId + '?case=' + encodeURIComponent(c.id) + (hasDemo ? '&tab=demo' : '');
      var chips = (c.methods || (sc ? sc.methods : [])).map(caseChip).join('');
      return '<a class="fx-card" href="' + href + '">' +
        '<div class="fx-top"><span class="fx-stage">' +
        (stg ? pad(stg.idx) + ' · ' + esc(stg.name) : '未绑定场景') + '</span>' +
        (hasDemo ? '<span class="badge-ready">可运行</span>' : '') + '</div>' +
        '<div class="fx-title">' + esc(c.title || (sc && sc.name) || c.id) + '</div>' +
        '<div class="fx-eff"><b>EFFECT · 一句话效果</b>' + esc(x.effect) + '</div>' +
        '<div class="fx-foot"><span class="fx-chips">' + chips + '</span>' +
        '<span class="fx-go">看案例<span class="ar"> →</span></span></div>' +
        '</a>';
    }).join('');
    return '<section class="section"><div class="wrap">' +
      '<div class="sec-head"><div class="sec-line">' +
      '<span class="sec-num">03</span><h2>精选案例：四个标杆场景</h2>' +
      '<span class="kicker">FEATURED CASES</span>' +
      '<span class="r"><a class="btn sm ghost" href="#/cases">全部案例 →</a></span></div>' +
      '<p>每个卡片一句话说清「哪个环节 + 用什么方法 + 落地后是什么效果」，点进去就是完整的' +
      '专业背景 / 案例流程 / 可运行示范三段式。</p></div>' +
      '<div class="fx-grid">' + cards + '</div>' +
      '</div></section>';
  }

  /* 07 常见问题（精简版，放在架构模块下方） */
  function homeFaqHTML() {
    var items = FAQ4.map(function (f) {
      return '<details class="faq-item"><summary><span class="fq-m">Q</span>' + esc(f.q) + '</summary>' +
        '<div class="faq-a"><span class="fa-a">A</span>' + f.a + '</div></details>';
    }).join('');
    return '<section class="section"><div class="wrap">' +
      '<div class="sec-head"><div class="sec-line">' +
      '<span class="sec-num">07</span><h2>常见问题</h2>' +
      '<span class="kicker">FAQ</span>' +
      '<span class="r"><a class="btn sm ghost" href="#/guide">接入规范 →</a></span></div>' +
      '<p>教学与立项评审里问得最多的四个问题。还有疑问可到接入规范页，或按页脚邮箱反馈。</p></div>' +
      '<div class="faq">' + items + '</div>' +
      '</div></section>';
  }

  /* 08 引用 / 致谢 */
  function homeCiteHTML() {
    var rows = [
      ['指导教师', HOME_ACK.advisor],
      ['依托课题 / 项目', HOME_ACK.project],
      ['课程 / 用途', HOME_ACK.course]
    ];
    var rowHTML = rows.map(function (r) {
      return '<div class="cite-row"><span>' + esc(r[0]) + '</span>' +
        (r[1] ? '<b>' + esc(r[1]) + '</b>' : '<b class="todo">待填写</b>') + '</div>';
    }).join('');
    var citeTxt = '石油勘探开发的智能化可能性地图（Petro × AI Atlas）' +
      A.meta.version + '，数据截至 ' + A.meta.updated + '。\n' +
      '纯静态站点，无后端依赖，可离线部署。';
    return '<section class="section"><div class="wrap">' +
      '<div class="sec-head"><div class="sec-line">' +
      '<span class="sec-num">08</span><h2>引用 / 致谢</h2>' +
      '<span class="kicker">CITATION &amp; ACKNOWLEDGEMENT</span></div>' +
      '<p>课程作业、大创作品与答辩材料引用本站时，请一并标注版本与数据截止日期，并注明数据为教学用合成数据。</p></div>' +
      '<div class="cite-grid">' +
      '<div class="cite-box"><div class="cb-h">推荐引用格式</div>' +
      '<div class="cite-txt">' + esc(citeTxt) + '</div>' +
      '<div class="cb-note">引用具体案例时，建议再补上场景编号与案例标题，例如「场景 w1 · 测井曲线智能分层」。</div></div>' +
      '<div class="cite-box"><div class="cb-h">致谢</div>' + rowHTML +
      '<div class="cb-note">上面三项留空时显示「待填写」；改成实际信息请编辑 <code>assets/core/shell.js</code> 里的 HOME_ACK。</div></div>' +
      '<div class="cite-box"><div class="cb-h">数据来源与免责</div>' +
      '<p>场景元数据为教学整理，来自公开文献与行业通行做法；案例中的曲线、井次与参数均为脱敏 / 合成数据。' +
      '本站所载算例与参数<b>不作为工程设计或生产决策依据</b>。</p>' +
      '<div class="cb-note">「公开案例丰富度」是依公开可见信息做的粗分层，不等于该技术在油田现场的工程成熟水平。</div></div>' +
      '</div>' +
      '<div class="cite-acts">' +
      '<button class="btn sm" data-lrn-export-atlas>导出全部场景元数据（JSON）</button>' +
      '<a class="btn sm ghost" href="#/guide">接入规范 →</a>' +
      '<a class="btn sm ghost" href="#/cases">案例库 →</a>' +
      '</div>' +
      '</div></section>';
  }

  /* 速览面板内的指标口径折叠表（触屏 / 键盘用户看这里） */
  function caliberHTML() {
    return '<details class="cal-det"><summary>指标口径 · CALIBER</summary>' +
      '<div class="cal-body">' + DIFF_CAL.map(function (x) {
        return '<div class="cal-r" data-d="' + x[0] + '"><b>' + x[0] + '</b><span>' + esc(x[1]) + '</span></div>';
      }).join('') + '</div></details>';
  }

  function homeHTML() {
    var s = A.stats();
    var cs = Cases.stats();
    var total = A.allScenes.length;
    var keys = Object.keys(M);

    /* 方法构成条：一根堆叠条 + 图例 */
    var compBar = keys.map(function (k) {
      var n = (A.index.byMethod[k] || []).length;
      return '<i style="width:' + (n / total * 100).toFixed(2) + '%;background:var(--c-' + (M[k].colorKey || k) + ')"></i>';
    }).join('');
    var compLegend = keys.map(function (k) {
      var n = (A.index.byMethod[k] || []).length;
      var ck = M[k].colorKey || k;
      /* 方法标签口径：缩写 + 全称 + 一句话适用边界，悬浮可见 */
      var tipk = M[k].abbr + ' · ' + M[k].name + '\n' + M[k].desc + '\n' + n + ' 个场景';
      return '<a href="#/method/' + k + '" data-m="' + ck + '" data-tip="' + esc(tipk) + '">' +
        mIcon(k) + '<i style="background:var(--c-' + ck + ')"></i>' + M[k].abbr +
        '<b>' + n + '</b></a>';
    }).join('');

    var coverPct = total ? Math.round(cs.coveredScenes / total * 100) : 0;
    var coverBar =
      '<i style="width:' + coverPct + '%;background:linear-gradient(90deg,#4E9B7E,#238868)"></i>' +
      '<i style="width:' + (100 - coverPct) + '%;background:var(--line)"></i>';

    var diffBar =
      '<i style="width:' + (s.diff.低 / total * 100).toFixed(2) + '%;background:linear-gradient(90deg,#6FB296,#4E9B7E)"></i>' +
      '<i style="width:' + (s.diff.中 / total * 100).toFixed(2) + '%;background:linear-gradient(90deg,#C99058,#A06B37)"></i>' +
      '<i style="width:' + (s.diff.高 / total * 100).toFixed(2) + '%;background:linear-gradient(90deg,#B46556,#9C4A3E)"></i>';

    var chain = A.stages.map(function (st) {
      return '<a class="step" href="#/stage/' + st.id + '">' +
        '<div class="step-idx">' + pad(st.idx) + '</div>' +
        '<div class="step-name">' + esc(st.name) + '</div>' +
        '<div class="step-n">' + st.scenes.length + '<span>场景</span></div>' +
        stageBar(st.id) + '</a>';
    }).join('');

    var mcards = Object.keys(M).map(function (k) {
      return '<a class="mcard" data-m="' + (M[k].colorKey || k) + '" href="#/method/' + k + '">' +
        '<div class="abbr"><span class="mic">' + mIcon(k) + '</span><b>' + M[k].abbr + '</b><span>' + esc(M[k].signal) + '</span></div>' +
        '<div class="nm">' + esc(M[k].name) + '</div>' +
        '<div class="ds">' + esc(M[k].desc) + '</div>' +
        '<div class="cnt"><b>' + (A.index.byMethod[k] || []).length + '</b>个场景</div></a>';
    }).join('');

    /* 案例三栏结构示意 SVG */
    var vizBg =
      '<svg viewBox="0 0 280 72" role="img" aria-label="专业背景可视化示意">' +
      '<rect x="0" y="0" width="280" height="72" fill="#F7FAFC"/>' +
      '<rect x="8" y="10" width="52" height="52" rx="3" fill="#F6ECDF" stroke="#D4B896"/>' +
      '<rect x="18" y="22" width="8" height="32" fill="#1A4779"/>' +
      '<rect x="30" y="34" width="20" height="20" fill="#C4A882"/>' +
      '<text x="18" y="68" font-size="7" fill="#9A5A28">井筒剖面</text>' +
      '<rect x="72" y="14" width="96" height="44" rx="3" fill="#fff" stroke="#D4DDE6"/>' +
      '<text x="80" y="28" font-size="8" fill="#4A5568">理论概念 → 图解</text>' +
      '<line x1="80" y1="36" x2="152" y2="36" stroke="#E4EAF0"/>' +
      '<rect x="80" y="42" width="40" height="6" rx="1" fill="#1A4779" opacity=".35"/>' +
      '<rect x="126" y="42" width="28" height="6" rx="1" fill="#9A5A28" opacity=".4"/>' +
      '<path d="M178 36 L198 36" stroke="#718096" stroke-dasharray="3 2"/>' +
      '<circle cx="218" cy="36" r="16" fill="#EAF1F8" stroke="#1A4779"/>' +
      '<text x="218" y="39" font-size="8" text-anchor="middle" fill="#1A4779">读懂</text>' +
      '</svg>';
    var vizFlow =
      '<svg viewBox="0 0 280 72" role="img" aria-label="案例流程可视化示意">' +
      '<rect x="0" y="0" width="280" height="72" fill="#F7FAFC"/>' +
      '<rect x="10" y="18" width="48" height="36" rx="3" fill="#fff" stroke="#1A4779"/>' +
      '<text x="34" y="40" font-size="9" text-anchor="middle" fill="#1A4779" font-weight="600">01</text>' +
      '<path d="M62 36 H78" stroke="#BAC6D2" marker-end="url(#af)"/>' +
      '<rect x="78" y="18" width="48" height="36" rx="3" fill="#fff" stroke="#238868"/>' +
      '<text x="102" y="40" font-size="9" text-anchor="middle" fill="#238868" font-weight="600">02</text>' +
      '<path d="M130 36 H146" stroke="#BAC6D2"/>' +
      '<rect x="146" y="18" width="48" height="36" rx="3" fill="#fff" stroke="#A06B37"/>' +
      '<text x="170" y="40" font-size="9" text-anchor="middle" fill="#A06B37" font-weight="600">03</text>' +
      '<path d="M198 36 H214" stroke="#BAC6D2"/>' +
      '<rect x="214" y="18" width="52" height="36" rx="3" fill="#E9F5F0" stroke="#238868"/>' +
      '<text x="240" y="40" font-size="8" text-anchor="middle" fill="#1B6B51">要点图</text>' +
      '</svg>';
    var vizDemo =
      '<svg viewBox="0 0 280 72" role="img" aria-label="案例演示可视化示意">' +
      '<rect x="0" y="0" width="280" height="72" fill="#F7FAFC"/>' +
      '<rect x="10" y="12" width="160" height="48" rx="3" fill="#fff" stroke="#D4DDE6"/>' +
      '<polyline points="18,48 40,42 58,46 78,28 98,34 118,22 138,30 158,18" fill="none" stroke="#1A4779" stroke-width="1.5"/>' +
      '<circle cx="118" cy="22" r="3" fill="#238868"/>' +
      '<rect x="180" y="12" width="86" height="48" rx="3" fill="#0A2038"/>' +
      '<text x="223" y="30" font-size="8" text-anchor="middle" fill="#B7C6D6">F1 / MAE</text>' +
      '<text x="223" y="46" font-size="14" text-anchor="middle" fill="#fff" font-weight="600">0.92</text>' +
      '</svg>';

    return '<main>' +
      '<section class="hero"><div class="wrap">' +
      '<div class="hero-grid">' +

      '<div class="hero-main rise">' +
      '<div class="hero-top">' +
      '<span class="hero-badge">' + esc(A.meta.version) + ' · 更新于 ' + esc(A.meta.updated) + '</span>' +
      '<span class="hero-badge live">已接入案例 ' + cs.registered + ' 项</span>' +
      '<span class="hero-badge alt">纯前端 · 可离线</span>' +
      '</div>' +
      '<h1>石油勘探开发<em>智能化</em>可能性地图</h1>' +
      '<div class="hero-sub">Petro × AI Atlas</div>' +
      '<p class="hero-lead">面向石油勘探开发全流程的教学案例平台：覆盖 ' + A.stages.length +
      ' 个作业环节、' + total + ' 个可智能化候选场景。每个案例都必须同时讲清<strong>石油专业背景</strong>与<strong>智能化方法价值</strong>，并用可视化贯穿「专业背景 · 案例流程 · 案例演示」三块内容。</p>' +
      /* 案例标准结构：三栏可视化（缩小版，嵌在按钮行上方） */
      '<div class="hero-anatomy rise d2">' +
      '<div class="anatomy trio">' +
      '<article class="an-card"><div class="an-top"><span class="an-num">01</span><div><h3>专业背景</h3><div class="an-en">BACKGROUND</div></div></div>' +
      '<div class="an-body"><div class="an-viz">' + vizBg + '</div>' +
      '<p>用剖面图、对比图、时间轴把理论概念「画」出来。</p>' +
      '<span class="an-tag">概念图解 · 决策代价</span></div></article>' +
      '<article class="an-card"><div class="an-top"><span class="an-num">02</span><div><h3>案例流程</h3><div class="an-en">WORKFLOW</div></div></div>' +
      '<div class="an-body"><div class="an-viz">' + vizFlow + '</div>' +
      '<p>逐步拆解每步做什么、预期效果与常见坑。</p>' +
      '<span class="an-tag">步骤图 · 效果 / 陷阱</span></div></article>' +
      '<article class="an-card"><div class="an-top"><span class="an-num">03</span><div><h3>案例演示</h3><div class="an-en">DEMO</div></div></div>' +
      '<div class="an-body"><div class="an-viz">' + vizDemo + '</div>' +
      '<p>纯前端交互，曲线与指标体现计算要点。</p>' +
      '<span class="an-tag">可运行 · 结果可视</span></div></article>' +
      '</div></div>' +

      '<div class="hero-acts">' +
      '<a class="btn primary" href="#/chain">浏览作业链</a>' +
      '<a class="btn" href="#/cases">进入案例库</a>' +
      '<button class="btn amber" data-import>添加案例</button>' +
      '<button class="btn ghost" data-lrn-export-atlas>导出场景数据 JSON</button>' +
      '<a class="btn ghost" href="#/guide">接入规范 →</a>' +
      '</div>' +
      '</div>' +

      '<aside class="spec rise d2">' +
      '<div class="spec-h"><span class="sp-ic">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">' +
      '<circle cx="12" cy="13" r="7.5"/><path d="M12 13 L15.5 9.5 M12 3 V5.5"/></svg>' +
      '<span class="mono">AT A GLANCE · 速览</span></span>' +
      '<span class="mono">' + esc(A.meta.version) + '</span></div>' +
      '<div class="spec-body">' +
      '<div class="spec-row"><span class="k">作业环节</span><span class="v">' + A.stages.length + '<small>个</small></span></div>' +
      '<div class="spec-row"><span class="k">候选场景</span><span class="v">' + total + '<small>个</small></span></div>' +
      '<div class="spec-row"><span class="k">难度分布（低 / 中 / 高）' +
      '<i class="cal-i" tabindex="0" role="note" aria-label="难度口径说明" data-tip="' + esc(diffTipText()) + '">?</i>' +
      '</span><span class="v">' + s.diff.低 + '<small>/</small>' + s.diff.中 + '<small>/</small>' + s.diff.高 + '</span></div>' +
      '</div>' +
      '<div class="spec-bar">' + diffBar + '</div>' +
      '<div class="spec-body">' +
      '<div class="spec-row"><span class="k">已接入案例</span><span class="v">' + cs.registered + '<small>个</small></span></div>' +
      '<div class="spec-row"><span class="k">其中可运行示范</span><span class="v">' + cs.withDemo + '<small>个</small></span></div>' +
      '<div class="spec-row"><span class="k">案例覆盖场景</span><span class="v">' + cs.coveredScenes + '<small>/ ' + total + ' · ' + coverPct + '%</small></span></div>' +
      '</div>' +
      '<div class="spec-bar">' + coverBar + '</div>' +
      '<div class="spec-sub"><span class="mono">方法构成 · BY METHOD</span></div>' +
      '<div class="comp">' +
      '<div class="comp-bar">' + compBar + '</div>' +
      '<div class="comp-legend">' + compLegend + '</div>' +
      '</div>' +
      caliberHTML() +
      '<div class="spec-f"><span>数据截至 ' + esc(A.meta.updated) + '</span>' +
      '<a href="#" data-lrn-export-atlas>导出 JSON ↘</a></div>' +
      '</aside>' +

      '</div></div></section>' +

      /* 01 平台适合谁 / 痛点（价值前置）· 02 快速上手 · 03 精选案例 */
      homeWhoHTML() +
      homeStepsHTML() +
      homeFeaturedHTML() +

      /* 石油 × 智能 双主题 */
      '<section class="section"><div class="wrap">' +
      '<div class="sec-head">' +
      '<div class="sec-line"><span class="sec-num">04</span><h2>石油背景 × 智能化方法</h2>' +
      '<span class="kicker">DUAL VALUE</span></div>' +
      '<p>一个案例要同时讲清两件事：石油上到底在做什么、AI 到底替人做了哪一步。背景讲得越直观，方法的价值就越看得见。</p>' +
      '</div>' +
      '<div class="dual">' +
      '<div class="dual-pane petro">' +
      '<div class="dp-k">PETROLEUM</div>' +
      '<h3>石油专业背景</h3>' +
      '<p>用图解把井筒、储层、工艺与决策代价讲清楚——读者不必先懂石油，也能快速建立场景直觉。</p>' +
      '<ul><li>作业环节与现场决策窗口</li><li>数据从哪里来、标注成本如何</li><li>做错的工程代价与时间滞后</li></ul>' +
      '</div>' +
      '<div class="dual-x"><span>Petro × AI</span></div>' +
      '<div class="dual-pane ai">' +
      '<div class="dp-k">INTELLIGENCE</div>' +
      '<h3>智能化方法价值</h3>' +
      '<p>明确机器学习 / 深度学习 / 优化 / 知识图谱等究竟替人做了哪一步，以及失效边界在哪里。</p>' +
      '<ul><li>介入点：检索、预测、分割、控制…</li><li>算法输出是候选还是结论</li><li>参数敏感区与常见失败模式</li></ul>' +
      '</div></div></div></section>' +

      /* 05 检索总入口：下面三列为 01 / 02 / 03 三条检索路径 */
      '<section class="section"><div class="wrap">' +
      '<div class="sec-head">' +
      '<div class="sec-line"><span class="sec-num">05</span><h2>场景检索：三条入口路径</h2>' +
      '<span class="kicker">SEARCH · THREE ENTRY POINTS</span></div>' +
      '<p>同一批场景可以从三条路径进入：<b>顺着作业环节</b>按流程找、<b>按 AI 方法</b>横向找，或先看<b>环节 × 技术的分布矩阵</b>再决定去哪。三条路径最终落到同一个场景详情页。</p>' +
      '</div>' +
      '<div class="tri-sec">' +

      /* 01 按作业环节检索 */
      '<div class="ts-col">' +
      '<div class="ts-head"><div class="sec-line"><span class="sec-num">01</span><h2>按作业环节检索</h2>' +
      '<span class="kicker">BY STAGE</span>' +
      '<span class="r"><a class="btn sm ghost" href="#/chain">完整链条 →</a></span></div></div>' +
      '<div class="ts-body chain-wrap"><div class="chain-scroll"><div class="chain">' + chain + '</div></div></div>' +
      '</div>' +

      /* 02 按技术路线检索 */
      '<div class="ts-col">' +
      '<div class="ts-head"><div class="sec-line"><span class="sec-num">02</span><h2>按技术路线检索</h2>' +
      '<span class="kicker">BY METHOD</span></div></div>' +
      '<div class="ts-body"><div class="methods">' + mcards + '</div></div>' +
      '</div>' +

      /* 03 环节 × 技术矩阵 */
      '<div class="ts-col">' +
      '<div class="ts-head"><div class="sec-line"><span class="sec-num">03</span><h2>环节 × 技术分布矩阵</h2>' +
      '<span class="kicker">MATRIX</span></div></div>' +
      '<div class="ts-body">' + matrixHTML() + '</div>' +
      '</div>' +

      '</div>' +

      /* 三块区块的右下角操作 */
      '<div class="tri-foot">' +
      '<a class="btn sm ghost" href="#/map">介入点图谱 →</a>' +
      '<a class="btn sm ghost" href="#/data">选题问答 →</a>' +
      '<a class="btn sm ghost" href="#/cases">全部案例 →</a>' +
      '<button class="btn sm amber" data-import>添加案例</button>' +
      '</div>' +

      '</div></section>' +

      /* 系统构成 */
      '<section class="section"><div class="wrap">' +
      '<div class="sec-head">' +
      '<div class="sec-line"><span class="sec-num">06</span><h2>系统架构与扩展方式</h2>' +
      '<span class="kicker">ARCHITECTURE</span>' +
      '<span class="r"><a class="btn sm" href="#/guide">接入规范</a></span></div>' +
      '<p>平台由数据层、案例层与外壳层构成。新增案例只需提交符合规范的案例包或插件文件；导航、检索与版式由外壳自动接管，保证跨组案例互操作。</p>' +
      '</div>' +
      '<div class="fields">' +
      '<div class="field"><div class="fx">01 · DATA LAYER · <code>assets/data.js</code></div>' +
      '<h4>场景元数据</h4>' +
      '<p>13 个环节、' + total + ' 个场景的名称、方法标签、难度、数据条件。这一层<b>不含任何案例实现</b>，只是一张可检索的表。</p></div>' +
      '<div class="f-arr">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 H19 M14 6.5 L19.5 12 L14 17.5"/></svg></div>' +
      '<div class="field"><div class="fx">02 · CASE LAYER · <code>case.json + demo/</code></div>' +
      '<h4>案例包 / 插件</h4>' +
      '<p>标准清单声明背景、流程与示范；可用「添加案例」上传，也可写成 <b>Cases.register()</b> 插件永久接入。</p></div>' +
      '<div class="f-arr">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 H19 M14 6.5 L19.5 12 L14 17.5"/></svg></div>' +
      '<div class="field"><div class="fx">03 · SHELL · <code>assets/core/*</code></div>' +
      '<h4>外壳与组件</h4>' +
      '<p>路由、导航、上传校验、标签/表格/四段式等组件与设计令牌。所有案例共用同一套版式。</p></div>' +
      '</div>' +
      '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<a class="btn" href="#/cases">查看案例库与校验结果</a>' +
      '<a class="btn ghost" href="#/guide">了解案例接入流程 →</a></div>' +
      '</div></section>' +
      /* 07 常见问题 / 08 引用致谢 已停用：函数仍保留在下方，需要时在末尾加回 homeFaqHTML() + homeCiteHTML() */
      '</main>';
  }

  /* 首页：已接入案例卡片（可运行的排前面） */
  function caseCardsHTML(n) {
    var list = Cases.list().slice().sort(function (a, b) {
      var ad = a.tabs && a.tabs.demo ? 0 : 1, bd = b.tabs && b.tabs.demo ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return String(b.updated || '').localeCompare(String(a.updated || ''));
    }).slice(0, n);

    if (!list.length) {
      return '<div class="empty"><b>暂未接入案例</b>' +
        '可通过上传案例包，或按接入规范编写插件完成接入；接入后将在本区域自动显示。</div>';
    }

    return '<div class="case-grid">' + list.map(function (c) {
      var sc = A.index.byScene[c.sceneId];
      var stg = sc ? A.index.byStage[sc.stageId] : null;
      var hasDemo = !!(c.tabs && c.tabs.demo);
      var href = '#/scene/' + c.sceneId + '?case=' + encodeURIComponent(c.id) + (hasDemo ? '&tab=demo' : '');
      var chips = (c.methods || (sc ? sc.methods : [])).map(caseChip).join('');
      return '<a class="case-card" href="' + href + '">' +
        '<div class="cc-top">' +
        '<span class="cc-stage">' + (stg ? pad(stg.idx) + ' · ' + esc(stg.name) : '未绑定场景') + '</span>' +
        (hasDemo ? '<span class="badge-ready">可运行</span>' : '') +
        '</div>' +
        '<div class="cc-title">' + esc(c.title || (sc && sc.name) || c.id) + '</div>' +
        '<div class="cc-desc">' + esc(sc ? sc.point : '这个案例绑定的场景不在数据层里，检查 sceneId。') + '</div>' +
        '<div class="cc-foot"><span>' + chips + '</span></div>' +
        '<div class="cc-foot"><span>' + esc(c.version || '—') + ' · ' + esc(c.updated || '—') + '</span>' +
        '<span class="go">' + (hasDemo ? '查看示范 →' : '查看详情 →') + '</span></div>' +
        '</a>';
    }).join('') + '</div>';
  }

  function matrixHTML() {
    var counts = A.countByStageMethod();
    var keys = Object.keys(M);
    var head = '<tr><th>环节</th>' + keys.map(function (k) {
      return '<th>' + M[k].abbr + '</th>';
    }).join('') + '<th>合计</th></tr>';

    /* 轻热力：单元格底色 = 技术色按密度加深 */
    var maxBy = {};
    keys.forEach(function (k) {
      maxBy[k] = Math.max.apply(null, A.stages.map(function (st) { return counts[st.id][k] || 0; }).concat([1]));
    });

    var body = A.stages.map(function (st, ri) {
      var c = counts[st.id];
      var rowTotal = st.scenes.length;
      return '<tr' + (ri % 2 ? ' class="alt"' : '') + '><th><i>' + pad(st.idx) + '</i>' + esc(st.name) + '</th>' +
        keys.map(function (k) {
          var n = c[k] || 0;
          if (!n) return '<td class="zero"><a href="#/stage/' + st.id + '?m=' + k + '" aria-label="0"></a></td>';
          var a = (0.10 + 0.42 * (n / maxBy[k])).toFixed(2);
          return '<td style="background:rgba(var(--rgb-' + (M[k].colorKey || k) + '),' + a + ')">' +
            '<a href="#/stage/' + st.id + '?m=' + k + '" style="color:var(--c-' + (M[k].colorKey || k) + ')">' + n + '</a></td>';
        }).join('') +
        '<td><a href="#/stage/' + st.id + '" style="color:var(--ink-2)">' + rowTotal + '</a></td></tr>';
    }).join('');

    var foot = '<tr><th>合计</th>' + keys.map(function (k) {
      return '<td>' + (A.index.byMethod[k] || []).length + '</td>';
    }).join('') + '<td>' + A.allScenes.length + '</td></tr>';

    return '<div class="matrix-wrap"><table class="matrix"><thead>' + head + '</thead><tbody>' + body +
      '</tbody><tfoot>' + foot + '</tfoot></table></div>';
  }

  /* =========================================================
     四、链条总览页
     ========================================================= */
  /* 场景公开案例丰富度：四项信号综合判定（技术难度 / 公开数据集 / 技术方向完备度 / 案例接入） */
  /* 与全站档位名保持一致：都是「公开案例丰富度」，不是工程阶段 */
  var MAT = [
    { k: 1, name: '案例极少', en: 'VERY FEW' },
    { k: 2, name: '案例较少', en: 'FEW' },
    { k: 3, name: '案例若干', en: 'SOME' },
    { k: 4, name: '案例较多', en: 'MANY' }
  ];
  function maturityOf(sc) {
    var v = (sc.diff === '高' ? 0 : sc.diff === '中' ? 1 : 2);          /* 技术难度 */
    if (sc.datasets && sc.datasets.length) v += 1;                       /* 公开数据集可得 */
    if ((sc.refs || []).length >= 4) v += 1;                            /* 技术方向完备 */
    var cs = Cases.bySceneAll(sc.id);
    if (cs.length) v += 1;                                              /* 已接入案例 */
    if (cs.some(function (c) { return c.tabs && c.tabs.demo; })) v += 1; /* 含可运行示范 */
    return v <= 0 ? 1 : v === 1 ? 2 : v === 2 ? 3 : 4;
  }

  /* 链路一：技术栈（路线 / 适用边界 / 算力需求） */
  function sideTechHTML() {
    return Object.keys(M).map(function (k) {
      var m = M[k];
      var n = (A.index.byMethod[k] || []).length;
      var cp = m.compute || {};
      return '<div class="lnk" data-m="' + (m.colorKey || k) + '">' +
        '<a class="lnk-h" href="#/method/' + k + '">' +
        '<span class="mic">' + mIcon(k) + '</span><b>' + m.abbr + '</b>' + esc(m.name) +
        '<span class="lnk-n mono">' + n + '<i>场景</i></span></a>' +
        '<div class="lnk-l"><span>适用边界</span>' + esc(m.signal) + '　' + esc(m.desc) + '</div>' +
        '<div class="lnk-l"><span>算力需求</span><b data-c="' + esc(cp.level || '中') + '">' + esc(cp.level || '中') + '</b>' +
        esc(cp.note || '') + '</div></div>';
    }).join('');
  }

  /* 链路二：场景公开案例丰富度（68 个场景打标，连成梯度链） */
  function sideMatHTML() {
    var groups = { 1: [], 2: [], 3: [], 4: [] };
    A.allScenes.forEach(function (sc) { groups[maturityOf(sc)].push(sc); });
    var total = A.allScenes.length || 1;
    var bar = MAT.map(function (x) {
      return '<i style="width:' + (groups[x.k].length / total * 100).toFixed(2) + '%;background:var(--mat-' + x.k + ')"></i>';
    }).join('');
    var top = 1, maxn = -1;
    MAT.forEach(function (x) { if (groups[x.k].length > maxn) { maxn = groups[x.k].length; top = x.k; } });
    var nodes = MAT.map(function (x) {
      return '<button class="mn' + (x.k === top ? ' on' : '') + '" data-mat="' + x.k + '">' +
        '<span class="mn-d" style="background:var(--mat-' + x.k + ')"></span>' +
        '<span class="mn-t">' + x.name + '</span>' +
        '<span class="mn-c mono">' + groups[x.k].length + '</span></button>';
    }).join('');
    var lists = MAT.map(function (x) {
      var items = groups[x.k].map(function (sc) {
        return '<a href="#/scene/' + sc.id + '"><i class="mono">' + pad(sc.stageIdx) + '</i>' +
          esc(sc.name) + '<span class="mono">' + esc(sc.id.toUpperCase()) + '</span></a>';
      }).join('');
      return '<div class="ml" data-ml="' + x.k + '"' + (x.k === top ? '' : ' hidden') + '>' +
        (items || '<div class="pnl-empty">该阶段暂无场景</div>') + '</div>';
    }).join('');
    return '<div class="mat-bar">' + bar + '</div>' +
      '<div class="mat-n">' + nodes + '</div>' + lists +
      '<div class="pnl-note">公开案例丰富度是本站点按四项信号做出的派生分层：技术难度（高 / 中 / 低）、是否具备公开数据集、' +
      '技术方向完备度（不少于 4 项）、本站已接入案例（含可运行示范再加一级），随案例接入情况动态更新。' +
      '它只反映公开可见信息的多寡，「不等于该技术在油田现场的工程成熟水平」，也不是等级评定。点击上述阶段可查看该阶段的场景清单。</div>';
  }

  /* 链路三：数据流向（各环节的输入数据 / 输出成果） */
  function sideFlowHTML() {
    return A.stages.map(function (st) {
      var f = st.flow || { in: [], out: [] };
      return '<a class="fl" href="#/stage/' + st.id + '">' +
        '<div class="fl-h"><span class="mono">' + pad(st.idx) + '</span>' + esc(st.name) + '</div>' +
        '<div class="fl-r">' +
        '<span class="fl-io"><b>输入</b>' + esc(f.in[0] || '') + (f.in.length > 1 ? ' 等 ' + f.in.length + ' 项' : '') + '</span>' +
        '<span class="fl-ar">→</span>' +
        '<span class="fl-io"><b>输出</b>' + esc(f.out[0] || '') + (f.out.length > 1 ? ' 等 ' + f.out.length + ' 项' : '') + '</span>' +
        '</div></a>';
    }).join('');
  }

  /* 链路四：案例引用（串联各环节已录入案例，形成溯源链） */
  function sideCaseHTML() {
    var cs = Cases.list();
    if (!cs.length) {
      return '<div class="pnl-empty">暂未接入案例。上传案例包或按接入规范编写插件后，' +
        '本链路将按作业环节串联全部已录入案例。</div>';
    }
    var html = A.stages.map(function (st) {
      var mine = cs.filter(function (c) {
        var sc = A.index.scene[c.sceneId];
        return sc && sc.stageId === st.id;
      });
      if (!mine.length) return '';
      return '<div class="cl"><div class="cl-h"><span class="mono">' + pad(st.idx) + '</span>' +
        esc(st.name) + '<span class="cl-n mono">' + mine.length + '</span></div>' +
        mine.map(function (c) {
          return '<a class="cl-i" href="#/scene/' + esc(c.sceneId) + '?case=' + esc(c.id) + '">' +
            '<span class="cl-d"></span>' + esc(c.title) +
            (c.tabs && c.tabs.demo ? '<span class="badge-ready">可运行</span>' : '') + '</a>';
        }).join('') + '</div>';
    }).join('');
    return html || '<div class="pnl-empty">暂未接入案例。</div>';
  }

  function chainSideHTML() {
    return '<aside class="chain-side"><div class="pnl">' +
      '<div class="pnl-h"><span class="mono">CHAIN COMPANION · 配套链路</span></div>' +
      '<div class="pnl-tabs">' +
      '<button class="pnl-tab on" data-pnl="tech">技术栈</button>' +
      '<button class="pnl-tab" data-pnl="mat">案例丰富度</button>' +
      '<button class="pnl-tab" data-pnl="flow">数据流向</button>' +
      '<button class="pnl-tab" data-pnl="case">案例引用</button>' +
      '</div>' +
      '<div class="pnl-b" data-pb="tech">' + sideTechHTML() + '</div>' +
      '<div class="pnl-b" data-pb="mat" hidden>' + sideMatHTML() + '</div>' +
      '<div class="pnl-b" data-pb="flow" hidden>' + sideFlowHTML() + '</div>' +
      '<div class="pnl-b" data-pb="case" hidden>' + sideCaseHTML() + '</div>' +
      '</div></aside>';
  }

  function chainHTML() {
    /* 顶部节点图：13 个环节连成一条链，点击滚动到对应环节 */
    var mapNodes = A.stages.map(function (st) {
      return '<a class="cm-node" href="#st-' + st.id + '" data-jump="st-' + st.id + '" title="' + esc(st.name) + ' · ' + st.scenes.length + ' 个场景">' +
        '<span class="dot"></span><span class="n">' + pad(st.idx) + '</span>' +
        '<span class="t">' + esc(st.name) + '</span><span class="c">' + st.scenes.length + '</span></a>';
    }).join('');

    var rows = A.stages.map(function (st) {
      var top = st.scenes.slice(0, 5).map(function (s) { return s.name; }).join('、');
      return '<a class="scene-row" id="st-' + st.id + '" href="#/stage/' + st.id + '" style="grid-template-columns:52px 1fr auto">' +
        '<div class="sr-n" style="padding-top:2px">' + pad(st.idx) + '</div>' +
        '<div><div class="sr-name">' + esc(st.name) +
        '<span class="mono" style="font-size:9.5px;color:var(--ink-4);letter-spacing:.14em">' + esc(st.en).toUpperCase() + '</span>' +
        '<span class="arrow">→</span></div>' +
        '<div class="sr-point">' + esc(st.blurb) + '</div>' +
        '<div class="sr-meta">' + (function () {
          /* 全环节方法去重后取前 4 个：同一技术不在一行出现两次 */
          var seen = {}, chips = [];
          st.scenes.forEach(function (s) {
            (s.methods || []).forEach(function (k) {
              if (seen[k] || !M[k]) return;
              seen[k] = 1;
              chips.push(methodChip(k));
            });
          });
          return chips.slice(0, 4).join('');
        })() + '</div>' +
        '<div class="sr-scenes"><span class="tag">' + esc(top) + (st.scenes.length > 5 ? '…' : '') + '</span></div></div>' +
        '<div class="sr-right"><span class="mono" style="font-size:19px;color:var(--ink-2)">' + st.scenes.length + '</span>' +
        '<span class="small muted">场景</span></div></a>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/chain', '作业链']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">CHAIN · ' + A.stages.length + ' 个环节</div>' +
      '<h1>从地质勘察到加工的全链条</h1>' +
      '<p class="blurb">按作业顺序自上游至下游排列，标注各环节的智能化场景数量与技术构成，点击可进入该环节的场景清单。要看场景之间的数据依赖与公开案例丰富度分布，去<a href="#/map">介入点图谱 →</a>。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + A.stages.length + '</div><div class="l">环节</div></div>' +
      '<div><div class="n">' + A.allScenes.length + '</div><div class="l">场景</div></div>' +
      '</div></div></div>' +
      '<div class="chain-layout">' +
      '<div class="chain-main">' +
      '<div class="chain-map-wrap"><div class="chain-map">' + mapNodes + '</div></div>' +
      '<div class="scenes">' + rows + '</div></div>' +
      chainSideHTML() +
      '</div></main>';
  }

  /* =========================================================
     五、环节页
     ========================================================= */
  function stageHTML(st, q) {
    var counts = {};
    st.scenes.forEach(function (s) { counts[s.diff] = (counts[s.diff] || 0) + 1; });
    var mFilter = q.m || '';
    var dFilter = q.d || '';

    var methodKeys = Object.keys(M).filter(function (k) {
      return st.scenes.some(function (s) { return s.methods.indexOf(k) >= 0; });
    });
    var methBtns = ['<button class="chip' + (mFilter ? '' : ' on') + '" data-f="m" data-v="">全部方法</button>'].concat(
      methodKeys.map(function (k) {
        return '<button class="chip' + (mFilter === k ? ' on' : '') + '" data-f="m" data-v="' + k + '" data-m="' + k + '">' + M[k].abbr + ' ' + esc(M[k].name) + '</button>';
      })).join('');

    var diffBtns = ['<button class="chip' + (dFilter ? '' : ' on') + '" data-f="d" data-v="">全部难度</button>'].concat(
      ['低', '中', '高'].map(function (d) {
        return '<button class="chip' + (dFilter === d ? ' on' : '') + '" data-f="d" data-v="' + d + '">' + d + '</button>';
      })).join('');

    var list = st.scenes.map(function (sc) {
      var cn = Cases.bySceneAll(sc.id).length;
      return '<a class="scene-row' + (sc.status === 'ext' ? ' is-ext' : '') + '" href="#/scene/' + sc.id + '" data-m="' + sc.methods.join(' ') + '" data-d="' + sc.diff + '">' +
        '<div class="sr-n">' + esc(sc.id.toUpperCase()) + '</div>' +
        '<div><div class="sr-name">' + esc(sc.name) +
        (cn ? '<span class="badge-ready">已接入案例' + (cn > 1 ? ' ×' + cn : '') + '</span>' : '') +
        '<span class="arrow">→</span></div>' +
        '<div class="sr-point">' + esc(sc.point) + '</div>' +
        '<div class="sr-meta">' + sc.methods.map(function (k) {
          var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
          return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
        }).join('') + '</div></div>' +
        '<div class="sr-right"><span class="dtag" data-d="' + sc.diff + '">难度 ' + sc.diff + '</span>' +
        (sc.demo ? '<span class="badge-wip" style="border-style:solid;color:var(--jade-d);background:var(--jade-l);border-color:rgba(47,125,107,.2)">可运行</span>' : '') +
        '</div></a>';
    }).join('');

    var idx = A.stages.indexOf(st);
    var prev = A.stages[idx - 1], next = A.stages[idx + 1];

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/chain', '作业链'], ['#/stage/' + st.id, st.name]]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">' + pad(st.idx) + ' / ' + pad(A.stages.length) + '</div>' +
      '<h1>' + esc(st.name) + '环节的可智能化场景<span class="en">' + esc(st.en) + '</span></h1>' +
      '<p class="blurb">' + esc(st.blurb) + '</p></div>' +
      '<div class="ph-stat">' +
      '<div><div class="n">' + st.scenes.length + '</div><div class="l">场景</div></div>' +
      '<div><div class="n">' + (counts.低 || 0) + '</div><div class="l">低难度</div></div>' +
      '<div><div class="n">' + (counts.高 || 0) + '</div><div class="l">高难度</div></div>' +
      '</div></div></div>' +

      '<div class="filters"><span class="lbl">方法</span>' + methBtns +
      '<span class="divider"></span><span class="lbl">难度</span>' + diffBtns +
      '<span class="count" id="f-count">' + st.scenes.length + ' 个场景</span></div>' +
      '<div class="scenes" id="scene-list">' + list + '</div>' +
      '<div class="pager">' +
      (prev ? '<a href="#/stage/' + prev.id + '" class="prev"><span class="dir">← 上一环节</span><span class="nm">' + pad(prev.idx) + ' ' + esc(prev.name) + '</span></a>' : '') +
      (next ? '<a href="#/stage/' + next.id + '" class="next"><span class="dir">下一环节 →</span><span class="nm">' + pad(next.idx) + ' ' + esc(next.name) + '</span></a>' : '') +
      '</div>' +
      '<div class="pager-back">' +
      '<a class="btn sm ghost" href="#/chain">← 返回作业链</a>' +
      '<a class="btn sm ghost" href="#/map">看在图谱里的位置 →</a>' +
      '</div></main>';
  }

  function bindFilters(root) {
    var listEl = root.querySelector('#scene-list');
    if (!listEl) return;
    var st = { m: '', d: '' };
    var chips = root.querySelectorAll('.filters .chip');
    [].forEach.call(chips, function (c) {
      if (c.classList.contains('on')) st[c.dataset.f] = c.dataset.v;
    });

    function apply() {
      var n = 0;
      [].forEach.call(listEl.children, function (row) {
        var ms = (row.dataset.m || '').split(' ');
        var okM = !st.m || ms.indexOf(st.m) >= 0;
        var okD = !st.d || row.dataset.d === st.d;
        var show = okM && okD;
        row.style.display = show ? '' : 'none';
        if (show) n++;
      });
      var cnt = root.querySelector('#f-count');
      if (cnt) cnt.textContent = n + ' 个场景';
      if (!n) {
        if (!listEl.querySelector('.filter-empty')) {
          var d = document.createElement('div');
          d.className = 'empty filter-empty';
          d.innerHTML = '<b>没有符合条件的场景</b>换个筛选条件试试。';
          listEl.appendChild(d);
        }
      } else {
        var e = listEl.querySelector('.filter-empty');
        if (e) e.remove();
      }
    }

    [].forEach.call(chips, function (c) {
      c.addEventListener('click', function () {
        var f = c.dataset.f;
        st[f] = c.dataset.v;
        [].forEach.call(chips, function (x) {
          if (x.dataset.f === f) x.classList.toggle('on', x === c);
        });
        apply();
        var hash = '#/stage/' + parseHash().parts[1] + (st.m ? '?m=' + st.m + (st.d ? '&d=' + st.d : '') : (st.d ? '?d=' + st.d : ''));
        setHashQuiet(hash);
      });
    });
    apply();
  }

  /* =========================================================
     六、方法反查页
     ========================================================= */
  /* 参考方向 → 方法类归属：优先同名/缩写，其次在方法类的描述与
     关键词里找该方向名（如「代理模型」命中优化算法的 desc），
     找不到时回落到场景声明的第一个方法类 */
  function refTarget(name, sc) {
    var keys = Object.keys(M), i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (name === M[k].name || name === M[k].abbr) return k;
    }
    var cands = keys.filter(function (k) {
      return (M[k].desc + M[k].signal + M[k].name).indexOf(name) >= 0;
    });
    if (cands.length) {
      var inSc = cands.filter(function (k) { return sc.methods.indexOf(k) >= 0; });
      return inSc[0] || cands[0];
    }
    return sc.methods[0] || 'cv';
  }
  /* 参考方向胶囊的链接：带 ref（方向名）与 from（来源场景），
     方法页据此显示提示条，避免「点了代理模型却到优化算法页」的困惑 */
  function refsOf(sc) {
    return K.refs(sc.refs.map(function (r) {
      var name = typeof r === 'string' ? r : r.name;
      return {
        name: name,
        href: '#/method/' + refTarget(name, sc) +
          '?ref=' + encodeURIComponent(name) + '&from=' + encodeURIComponent(sc.id)
      };
    }));
  }
  /* 某方法类下的全部子方向：遍历场景的「参考方向」，逐个按归属规则
     （同名/缩写 → 方法描述命中 → 场景声明的方法）归到方法类，统计场景数 */
  function methodRefs(key) {
    var map = {};
    (A.allScenes || []).forEach(function (sc) {
      (sc.refs || []).forEach(function (r) {
        var name = typeof r === 'string' ? r : r.name;
        if (!name || refTarget(name, sc) !== key) return;
        map[name] = (map[name] || 0) + 1;
      });
    });
    return Object.keys(map).map(function (n) {
      return { name: n, n: map[n] };
    }).sort(function (a, b) { return b.n - a.n; });
  }
  function scHasRef(sc, name) {
    return (sc.refs || []).some(function (r) {
      return (typeof r === 'string' ? r : r.name) === name;
    });
  }
  function methodHTML(key, q) {
    q = q || {};
    if (!M[key]) return '<main class="wrap"><div class="empty"><b>没有这个方法类别</b></div></main>';
    var refName = (q.ref || '').trim();
    var fromId = (q.from || '').replace(/[^a-z0-9_-]/gi, '');
    var refs = methodRefs(key);
    /* 只有确实属于本方法的方向才作为过滤器，避免 URL 参数乱填导致空页 */
    var refOn = refs.some(function (x) { return x.name === refName; }) ? refName : '';
    var all = (A.index.byMethod[key] || []).filter(function (sc) {
      return !refOn || scHasRef(sc, refOn);
    });
    var hitStages = A.stages.filter(function (st) {
      return st.scenes.some(function (s) {
        return s.methods.indexOf(key) >= 0 && (!refOn || scHasRef(s, refOn));
      });
    });
    var groups = hitStages.map(function (st) {
      var rows = st.scenes.filter(function (s) {
        return s.methods.indexOf(key) >= 0 && (!refOn || scHasRef(s, refOn));
      }).map(function (sc) {
        var c = Cases.byScene(sc.id);
        return '<a class="mrow" href="#/scene/' + sc.id + '">' +
          '<div><div class="nm">' + esc(sc.name) + (c ? '<span class="badge-ready">案例</span>' : '') + '</div>' +
          '<div class="pt">' + esc(sc.point) + '</div></div>' +
          '<div class="rt"><span class="dtag" data-d="' + sc.diff + '">' + sc.diff + '</span><span class="mono" style="font-size:10px;color:var(--ink-4)">→</span></div></a>';
      }).join('');
      return '<div class="method-group"><div class="mg-head">' +
        '<span class="idx">' + pad(st.idx) + '</span><h3>' + esc(st.name) + '</h3>' +
        '<span class="cnt">' + st.scenes.filter(function (s) { return s.methods.indexOf(key) >= 0; }).length + ' 个</span></div>' +
        '<div class="mg-list">' + rows + '</div></div>';
    }).join('');

    /* 带参考方向进入时：描述里高亮该方向 */
    var blurb = esc(M[key].desc);
    if (refOn && blurb.indexOf(esc(refOn)) >= 0) {
      blurb = blurb.split(esc(refOn)).join('<mark class="ref-hl">' + esc(refOn) + '</mark>');
    }
    /* 子方向导航栏：本方法下更细的智能化切入点，点一个即只看用到它的场景 */
    var refBar = '';
    if (refs.length) {
      var chips = '<a class="mref' + (refOn ? '' : ' on') + '" href="#/method/' + key + '">全部方向<i>' +
        (A.index.byMethod[key] || []).length + '</i></a>' +
        refs.map(function (x) {
          return '<a class="mref' + (refOn === x.name ? ' on' : '') + '" href="#/method/' + key +
            '?ref=' + encodeURIComponent(x.name) + '">' + esc(x.name) + '<i>' + x.n + '</i></a>';
        }).join('');
      refBar = '<div class="mref-bar"><div class="mref-h">' +
        '<b>本方法的子方向</b><span>点一个方向，只看用到它的场景</span></div>' +
        '<div class="mref-chips">' + chips + '</div></div>';
    }
    var refNote = refOn
      ? '<div class="ref-note"><b>参考方向 · ' + esc(refOn) + '</b>' +
        '<span>是「' + esc(M[key].name) + '」技术大类下的一个方向，下方是全部用到它的场景</span>' +
        '<a href="#/method/' + key + '">显示全部 ' + (A.index.byMethod[key] || []).length + ' 个场景 ↗</a>' +
        (fromId && A.index.byScene[fromId]
          ? '<a href="#/scene/' + esc(fromId) + '">← 返回来源场景</a>' : '') +
        '</div>'
      : '';
    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/map', '介入点图谱'], ['#/method/' + key, M[key].name]]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">METHOD · ' + M[key].abbr + '</div>' +
      '<h1>' + esc(M[key].name) + '在石油勘探开发中的可应用场景<span class="en">' + esc(M[key].signal) + '</span></h1>' +
      '<p class="blurb">' + blurb + '</p></div>' +
      '<div class="ph-stat"><div><div class="n">' + all.length + '</div><div class="l">' +
      (refOn ? '命中场景' : '场景') + '</div></div>' +
      '<div><div class="n">' + hitStages.length + '</div><div class="l">跨环节</div></div></div>' +
      '</div></div>' + refBar + refNote +
      '<div style="padding:6px 0 10px">' + groups + '</div>' +
      '<div class="pager"><a href="#/map" class="prev"><span class="dir">← 返回</span><span class="nm">介入点图谱</span></a></div></main>';
  }

  /* =========================================================
     七、场景详情页（案例自动挂载）
     ========================================================= */

  /* 档案头速览区：一句话概述 + 关键指标 + 按环节的装饰插画。
     有案例时读案例的流程导语与规模指标；无案例时读场景的痛点描述。
     插画由 assets/art.js 提供（纯图案、无文字），缺失时仍有文字内容。 */
  function sceneDigest(sc, c) {
    function cut(s, n) {
      var t = String(s || '');
      return t.length > n ? t.slice(0, n) + '…' : t;
    }
    var f = global.SCENE_ART;
    var art = f ? (f(sc.id) || f(sc.stageId)) : '';
    var k, txt, stats = '';
    if (c) {
      var w = c.tabs && c.tabs.workflow || {};
      txt = w.lead || (c.tabs.background && c.tabs.background.lede) || sc.intro;
      var st = w.stats || [];
      if (st.length) {
        stats = '<div class="dd-stats">' + st.slice(0, 3).map(function (x) {
          return '<div><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>';
        }).join('') + '</div>';
      }
      k = '案例速览 · ' + c.id;
    } else {
      txt = cut(sc.problem || sc.intro || '', 96);
      stats = '<div class="dd-stats"><div><b>' + (sc.data || []).length + ' 类</b><span>所需数据</span></div>' +
        '<div><b>待接入</b><span>案例状态</span></div></div>';
      k = '场景速览 · ' + sc.id.toUpperCase();
    }
    return '<div class="dh-digest">' +
      '<div class="dd-k">' + esc(k) + '</div>' +
      '<p class="dd-txt">' + esc(txt) + '</p>' +
      stats +
      (art ? '<div class="dh-art" aria-hidden="true">' + art + '</div>' : '') +
      '</div>';
  }

  function sceneHTML(sc, q) {
    var st = A.index.byStage[sc.stageId];
    var allCases = Cases.bySceneAll(sc.id);
    /* 当前展示哪个案例：?case= 指定，默认第一个 */
    var c = allCases.filter(function (x) { return x.id === q.case; })[0] || allCases[0] || null;

    var caseSwitch = '';
    if (allCases.length > 1) {
      caseSwitch = '<div class="case-switch"><span class="cs-lbl">本场景共有 ' + allCases.length +
        ' 个案例，当前展示</span>' + allCases.map(function (x) {
          var on = c && x.id === c.id;
          return '<button class="chip' + (on ? ' on' : '') + '" data-case="' + esc(x.id) + '">' +
            esc(x.title || x.id) + '</button>';
        }).join('') + '</div>';
    }

    var tabs = [];
    if (c) {
      if (c.tabs.background) tabs.push({ key: 'bg', num: '01', name: c.tabs.background.label || '专业背景' });
      if (c.tabs.workflow) tabs.push({ key: 'flow', num: '02', name: c.tabs.workflow.label || '案例流程' });
      if (c.tabs.demo) tabs.push({ key: 'demo', num: '03', name: c.tabs.demo.label || '案例演示' });
    }

    var tabBtns = tabs.map(function (t, i) {
      return '<button class="tab' + (i === 0 ? ' on' : '') + '" data-tab="' + t.key + '">' +
        '<span class="num">' + t.num + '</span>' + esc(t.name) + '</button>';
    }).join('');

    var panels = '';
    if (c) {
      if (c.tabs.background) panels += '<div class="panel on" data-panel="bg">' + renderBackground(sc, c) + '</div>';
      if (c.tabs.workflow) panels += '<div class="panel" data-panel="flow">' + renderWorkflow(sc, c) + '</div>';
      if (c.tabs.demo) panels += '<div class="panel" data-panel="demo">' + renderDemoShell(sc, c) + '</div>';
    }

    var cBadge = allCases.length
      ? '<span class="badge-ready">案例 ' + esc(c.id) + ' · v' + esc(c.version || '—') + '</span>' +
        (allCases.length > 1 ? '<span class="tag">共 ' + allCases.length + ' 个案例</span>' : '')
      : '<span class="badge-wip">未接入案例</span>';

    /* 档案头：左侧说明 + 右侧参数表（工程档案卡的样子） */
    var dmRows = [
      ['作业环节', '<a href="#/stage/' + st.id + '" style="color:var(--clay-d)">' + pad(st.idx) + ' ' + esc(st.name) + '</a>'],
      ['技术类别', sc.methods.map(function (k) { return esc(M[k] ? M[k].name : k); }).join(' / ')],
      ['技术难度', esc(sc.diff) + '　<span class="muted" style="font-weight:400">' + esc(sc.diffWhy || '') + '</span>']
    ];
    if (sc.ds && sc.ds.length) {
      dmRows.push(['公开数据集', sc.ds.map(function (d) { return esc(d[0]); }).join('、')]);
    }
    if (sc.refs && sc.refs.length) {
      dmRows.push(['参考方向', refsOf(sc)]);
    }
    dmRows.push(
      ['案例状态', c ? (esc(c.id) + ' · v' + esc(c.version || '—')) : '未接入'],
      ['最近更新', esc((c && c.updated) || '—')],
      ['可运行示范', (c && c.tabs && c.tabs.demo)
        ? '<span style="color:var(--jade-d);font-weight:600">有</span>'
        : '<span class="muted" style="font-weight:400">无</span>']
    );
    dmRows = dmRows.map(function (r) {
      return '<div class="dm-row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>';
    }).join('');

    var head = '<div class="detail-head">' +
      '<div class="dh-kicker">' +
      '<a class="tag" href="#/stage/' + st.id + '">环节 ' + pad(st.idx) + ' · ' + esc(st.name) + '</a>' +
      sc.methods.map(function (k) {
        var ck = (M[k] && (M[k].colorKey || k)) || 'cv';
        return '<span class="mtag" data-m="' + ck + '"><b>' + M[k].abbr + '</b>' + esc(M[k].name) + '</span>';
      }).join('') +
      cBadge +
      '</div>' +
      '<div class="dossier">' +
      '<div class="dossier-main">' +
      '<h1 class="dh-title">' + esc(sc.name) + '</h1>' +
      '<p class="dh-sub">' + esc(sc.intro) + '</p>' +
      '<div class="dh-tags">' + K.dtag(sc.diff) +
      (sc.status === 'ext' ? '<span class="badge-wip">待扩展</span>' : '') +
      '<span class="tag"><span class="dot" style="color:var(--ink-4)"></span>' + esc(sc.id.toUpperCase()) + '</span>' +
      '</div>' + sceneDigest(sc, c) + '</div>' +
      '<div class="dossier-meta"><div class="dm-h">CASE DOSSIER</div>' + dmRows + '</div>' +
      '</div></div>';

    var body = c
      ? caseSwitch + '<div class="tabs" id="tabs">' + tabBtns + '</div>' + panels
      : pendingHTML(sc);

    /* 场景/案例详情页归属「案例库」目录：案例统一放在案例库中查看，
       作业链/图谱只是进入场景的路径，不再作为面包屑层级 */
    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/cases', '案例库'], ['#/stage/' + st.id, st.name], ['#/scene/' + sc.id, sc.name]]) +
      scSwitcher(sc, st) +
      head + (c ? aiSvcHTML(sc, c) : '') + body + scPager(sc, st) + relatedHTML(sc) + '</main>';
  }

  /* 同环节场景切换条：上一场景 / 场景 chip 列表 / 下一场景 */
  function scSwitcher(sc, st) {
    var sibs = st.scenes;
    var ids = sibs.map(function (s) { return s.id; });
    var i = ids.indexOf(sc.id);
    var prev = sibs[i - 1], next = sibs[i + 1];
    function nav(s, label) {
      return s
        ? '<a class="sc-nav" href="#/scene/' + s.id + '" title="' + esc(s.name) + '">' + label + '</a>'
        : '<span class="sc-nav is-off" aria-disabled="true">' + label + '</span>';
    }
    return '<div class="sc-switch">' +
      nav(prev, '← 上一场景') +
      '<div class="sc-chips">' + sibs.map(function (s, k) {
        return '<a class="sc-chip' + (s.id === sc.id ? ' on' : '') + '" href="#/scene/' + s.id + '">' +
          '<i>' + pad(k + 1) + '</i>' + esc(s.name) + '</a>';
      }).join('') + '</div>' +
      nav(next, '下一场景 →') +
      '</div>';
  }

  /* 场景页底部翻页：上一 / 下一场景 */
  function scPager(sc, st) {
    var sibs = st.scenes;
    var ids = sibs.map(function (s) { return s.id; });
    var i = ids.indexOf(sc.id);
    var prev = sibs[i - 1], next = sibs[i + 1];
    if (!prev && !next) return '';
    return '<div class="pager sc-pager">' +
      (prev ? '<a href="#/scene/' + prev.id + '" class="prev"><span class="dir">← 上一场景</span><span class="nm">' + esc(prev.name) + '</span></a>' : '<span></span>') +
      (next ? '<a href="#/scene/' + next.id + '" class="next"><span class="dir">下一场景 →</span><span class="nm">' + esc(next.name) + '</span></a>' : '') +
      '</div>';
  }

  /* ---- 有案例：三块内容由案例提供，这里只套版式 ---- */
  function renderBackground(sc, c) {
    var b = c.tabs.background;
    var out = '';
    if (b.judge) out += K.judge(b.judge);
    if (b.lede) out += '<div class="lede-block"><span class="kicker plain">专业场景介绍</span><p>' + rich(b.lede) + '</p></div>';
    /* 可选：给外行的「概念速览」卡。案例填了 b.concepts 才出现，
       不填完全不影响——老案例、别的同学上传的案例行为不变 */
    if (b.concepts && global.V && global.V.concept) {
      out += '<p style="margin:16px 0 0"><span class="kicker plain" style="color:var(--ink-4)">先认识几个石油概念</span></p>' +
        global.V.concept(b.concepts);
    }
    /* 可选：数据—模型—输出的人机分工图 */
    if (b.io && global.V && global.V.io) {
      out += '<div class="figure">' + global.V.io(b.io) + '</div>' +
        (b.ioCap ? '<div class="figcap"><b>图 0</b><span>' + rich(b.ioCap) + '</span></div>' : '');
    }
    (b.sections || []).forEach(function (s, i) {
      var html = s.html || s.body || '';
      /* 数据条件段（第 3 段）自动追加可勾选清单：条目来自场景元数据，
         渲染后由 bindChecklist 接管交互；案例内容自带清单时跳过 */
      if (i === 2 && sc.data && sc.data.length && html.indexOf('cl-item') < 0) {
        html += K.checklist(sc.data.map(function (d) {
          return [d[0], d[1], d[2] || ''];
        }));
      }
      out += K.sec4(i + 1, s.en || '', s.title, html);
    });
    return out;
  }

  /* =========================================================
     智能化服务点：这个案例到底用智能方法替人做了什么
     全部从案例自身的 steps（role）/ stats / metrics 自动派生，
     不新增文案负担；某类角色为空时对应栏自动省略
     ========================================================= */
  function aiSvcHTML(sc, c) {
    var w = (c && c.tabs && c.tabs.workflow) || {};
    var steps = w.steps || [];
    if (steps.length < 2) return '';
    var isAI = function (s) { return /算法|模型/.test(s.role || '算法'); };
    var isHuman = function (s) { return /人工|质控|设计/.test(s.role || ''); };
    var isData = function (s) { return /数据|标注/.test(s.role || ''); };
    var idx = function (s) { return steps.indexOf(s) + 1; };
    var nums = function (a) {
      return a.map(function (s) { return '第 ' + idx(s) + ' 步'; }).join('、');
    };
    var ai = steps.filter(isAI), hu = steps.filter(isHuman), da = steps.filter(isData);
    var mName = (sc.methods || []).map(function (k) { return M[k] ? M[k].name : k; }).join(' / ') || '智能方法';

    var lead = '本案例用 <b>' + esc(mName) + '</b> 承接 ' + steps.length + ' 个环节中的 <b>' +
      ai.length + ' 个</b>（' + nums(ai) + '）' +
      (hu.length ? '，人保留 <b>' + hu.length + ' 个</b>裁决环节（' + nums(hu) + '）' : '，全程由模型闭环') +
      '：把原本靠经验试算的部分交给模型批量求解，人只在约束与现场回填上把关。';

    function col(k, tone, list, extra) {
      if (!list.length && !extra) return '';
      return '<div class="as-col ' + tone + '"><span class="as-k">' + esc(k) + '</span>' +
        '<p>' + (list.length ? esc(list.map(function (s) { return s.name; }).join(' · ')) : esc(extra || '')) +
        '</p></div>';
    }
    var stats = (w.stats || []).slice(0, 3).map(function (x) {
      return '<span class="as-stat"><b>' + esc(x[1]) + '</b>' + esc(x[0]) + '</span>';
    }).join('');

    return '<div class="ai-svc">' +
      '<div class="as-head"><span class="as-t">智能化服务点</span>' +
      '<span class="as-sub">这个场景下智能方法具体替人做什么、人还管什么</span></div>' +
      '<p class="as-lead">' + lead + '</p>' +
      '<div class="as-cols">' +
      col('模型承接 ' + ai.length + ' 步', 'as-ai', ai) +
      col('人保留 ' + hu.length + ' 步', 'as-hu', hu, hu.length ? '' : '无需人工环节') +
      col('数据与标注 ' + da.length + ' 步', 'as-da', da) +
      '</div>' +
      (stats ? '<div class="as-stats">' + stats + '</div>' : '') +
      '</div>';
  }

  function renderWorkflow(sc, c) {
    var w = c.tabs.workflow;
    var out = '<div class="case-lead"><div>' +
      '<span class="kicker clay">CASE WALKTHROUGH</span>' +
      '<h3 style="margin-top:10px">' + esc(w.title || '案例流程') + '</h3>' +
      (w.lead || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join('') +
      '</div>' + (w.stats ? K.cells(w.stats) : '') + '</div>';

    /* 流程总览图：由 steps 自动生成，案例不用改一行代码就多一张图。
       V 库没加载（例如单独调试案例）时静默跳过 */
    var V = global.V;
    var steps = w.steps || [];
    if (V && V.flow && steps.length >= 2) {
      /* ≤6 步一行放下；5 步以上画布加宽、卡加高（容纳三行说明） */
      var fmCols = steps.length <= 6 ? steps.length : 4;
      var fmOpt = { cols: fmCols };
      if (steps.length >= 5) { fmOpt.w = 1000; fmOpt.bh = 80; }
      var fmAI = steps.filter(function (s) { return /算法|模型/.test(s.role || '算法'); }).length;
      out += '<div class="flow-map"><div class="fm-t">FLOW MAP · ' + steps.length +
        ' 步各自在做什么，谁负责</div>' +
        '<div class="fm-lg"><span class="lg ai">绿色 = 模型 / 算法承担（' + fmAI + ' 步）</span>' +
        '<span class="lg da">蓝色 = 数据与样本准备</span>' +
        '<span class="lg hu">橙红 = 人工裁决</span></div>' +
        V.flow(steps.map(function (s) {
          return { name: s.name, role: s.role, note: s.effect || s.do };
        }), fmOpt) +
        '</div>';
    }
    if (V && V.io && w.io) {
      out += '<div class="figure">' + V.io(w.io) + '</div>' +
        (w.ioCap ? '<div class="figcap"><b>图 A</b><span>' + rich(w.ioCap) + '</span></div>' : '');
    }

    out += K.pipeline(steps);

    if (w.metrics) {
      out += K.sec4(0, 'METRICS', w.metrics.title || '怎么算"做对了"', w.metrics.html || '');
    }
    if (w.fails) {
      out += '<div class="sec4"><div class="sn">FAIL<span>MODES</span></div><div class="sec4-body">' +
        '<h3>这类任务通常死在哪</h3>' +
        '<p>下面这些失败模式在同类项目里反复出现。它们多半不是模型能力问题，而是任务定义与数据规范问题。</p>' +
        K.fails(w.fails) + '</div></div>';
    }
    return out;
  }

  function renderDemoShell(sc, c) {
    return '<div id="case-demo-root"></div>';
  }

  /* ---- 无案例：展示速览 + 接入引导 ---- */
  function pendingHTML(sc) {
    var dataRows = sc.data.map(function (d) { return [d[0], d[1], d[2]]; });
    return '<div style="padding-top:8px">' +
      '<div class="sec4" style="border-top:0">' +
      '<div class="sn">01<span>PROBLEM</span></div><div class="sec4-body">' +
      '<h3>业务问题</h3><p>' + esc(sc.problem) + '</p></div></div>' +
      '<div class="sec4"><div class="sn">02<span>INTERVENTION</span></div><div class="sec4-body">' +
      '<h3>AI 介入点</h3><p>' + esc(sc.point) + '</p></div></div>' +
      '<div class="sec4"><div class="sn">03<span>DATA</span></div><div class="sec4-body">' +
      '<h3>数据条件</h3>' + K.dtable(['数据类型', '规模 / 规格', '标注要求'], dataRows) +
      (sc.ds && sc.ds.length
        ? '<div style="margin-top:10px"><span class="kicker plain">相关公开数据集</span>' +
          sc.ds.map(function (d) {
            return '<p style="margin:5px 0 0"><b>' + esc(d[0]) + '</b> —— ' + esc(d[1]) + '</p>';
          }).join('') + '</div>'
        : '') +
      '</div></div>' +
      '<div class="sec4"><div class="sn">04<span>DIFFICULTY</span></div><div class="sec4-body">' +
      '<h3>技术难度与参考方向</h3>' +
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:4px">' + K.dtag(sc.diff) +
      '<span class="small muted">' + esc(sc.diffWhy) + '</span></div>' + K.meter(sc.diff) +
      refsOf(sc) +
      (sc.rep ? '<p class="small muted" style="margin-top:9px"><b>已见公开报道：</b>' + esc(sc.rep) + '</p>' : '') +
      '</div></div>' +

      '<div class="pending"><div class="pending-top"><span class="badge-wip">案例待接入</span>' +
      '<h3>本场景暂无配套案例</h3></div>' +
      '<p>该场景的元数据（问题描述、介入点、数据条件、技术难度）已在地图中登记，但尚未编写案例内容。案例以插件方式接入：编写一个文件声明专业背景、案例流程与可运行示范三块内容并完成注册后，本页面将自动生成对应标签页与示范入口。</p>' +
      '<div class="pending-lines"><div class="pending-line"></div><div class="pending-line"></div><div class="pending-line"></div></div>' +
      '<div class="pending-actions">' +
      '<button class="btn amber" data-import data-scene="' + esc(sc.id) + '">添加该场景案例</button>' +
      '<a class="btn" href="#/cases">查看已接入案例</a>' +
      '<a class="btn ghost" href="#/guide">阅读接入规范 →</a>' +
      '</div></div></div>';
  }

  function relatedHTML(sc) {
    var sameStage = A.index.byStage[sc.stageId].scenes.filter(function (s) { return s.id !== sc.id; }).slice(0, 4);
    var sameMethod = (A.index.byMethod[sc.methods[0]] || []).filter(function (s) { return s.id !== sc.id; }).slice(0, 4);
    return '<div class="related"><div class="sec-head" style="margin-bottom:0;border-top:0;padding-top:0"><div>' +
      '<span class="kicker">RELATED</span><h2 style="font-size:18px;margin-top:8px">相关场景</h2></div></div>' +
      '<div class="rel-grid">' +
      '<div class="rel-col"><h5>同环节 · ' + esc(A.index.byStage[sc.stageId].name) + '</h5>' +
      sameStage.map(function (s) {
        return '<a class="rel-item" href="#/scene/' + s.id + '"><span class="nm">' + esc(s.name) + '</span><span class="go">→</span></a>';
      }).join('') + '</div>' +
      '<div class="rel-col"><h5>同方法 · ' + esc(M[sc.methods[0]].name) + '</h5>' +
      sameMethod.map(function (s) {
        return '<a class="rel-item" href="#/scene/' + s.id + '"><span class="nm">' + esc(s.name) + '</span><span class="go">' + esc(s.stageName) + ' →</span></a>';
      }).join('') + '</div></div>' +
      '<div style="margin-top:18px;display:flex;gap:9px;flex-wrap:wrap">' +
      '<a class="btn" href="#/stage/' + sc.stageId + '">← 返回' + esc(sc.stageName) + '环节</a>' +
      '<a class="btn ghost" href="#/">返回总览</a></div></div>';
  }

  /* ---- tab 交互与示范挂载 ---- */
  function bindTabs(sc, c) {
    var tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;

    function activate(key, scroll) {
      [].forEach.call(tabsEl.children, function (b) {
        b.classList.toggle('on', b.dataset.tab === key);
      });
      [].forEach.call(document.querySelectorAll('.panel'), function (p) {
        p.classList.toggle('on', p.dataset.panel === key);
      });
      if (key === 'demo') mountDemo(sc, c);
      if (scroll) {
        var y = tabsEl.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }

    tabsEl.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (!b) return;
      activate(b.dataset.tab, true);
      setHashQuiet('#/scene/' + sc.id + '?tab=' + b.dataset.tab);
    });

    var want = { 1: 'bg', 2: 'flow', 3: 'demo' }[parseHash().q.tab] || parseHash().q.tab;
    if (want && tabsEl.querySelector('[data-tab="' + want + '"]')) activate(want, false);

    bindChecklist();
  }

  function mountDemo(sc, c) {
    var d = c.tabs.demo;
    if (!d || typeof d.mount !== 'function') return;
    var key = c.id;
    if (mountedKey === key) return;
    var root = document.getElementById('case-demo-root');
    if (!root) return;
    if (mounted && mounted.unmount) { try { mounted.unmount(); } catch (e) { } }
    root.innerHTML = '';
    mounted = d;
    mountedKey = key;
    try {
      d.mount(root, { scene: sc, kase: c, K: K, atlas: A });
    } catch (err) {
      root.innerHTML = '<div class="callout warn"><span class="ci">错误</span><span>示范挂载失败：' +
        esc(err.message) + '。检查 <b>' + esc(c.id) + '</b> 的 tabs.demo.mount。</span></div>';
      console.error('[case:' + c.id + '] demo mount failed', err);
    }
  }

  function bindChecklist() {
    var items = document.querySelectorAll('.cl-item');
    if (!items.length) return;
    var total = items.length;
    var fill = document.getElementById('cl-fill');
    var txt = document.getElementById('cl-txt');

    function sync() {
      var n = document.querySelectorAll('.cl-item.done').length;
      if (fill) fill.style.width = (n / total * 100) + '%';
      if (txt) txt.textContent = n + ' / ' + total;
    }
    [].forEach.call(items, function (it) {
      it.addEventListener('click', function () {
        it.classList.toggle('done');
        sync();
      });
    });
    sync();
  }

  /* =========================================================
     八、案例库控制台
     ========================================================= */
  /* 案例卡片：一个案例一张卡 */
  function caseCard(sc, c, ck) {
    var errs = ck.filter(function (x) { return x.level === 'error'; }).length;
    var warns = ck.filter(function (x) { return x.level === 'warn'; }).length;
    var state = errs
      ? '<span class="bad-mark">✕ ' + errs + ' 错误</span>'
      : warns ? '<span class="mono" style="font-size:11px;color:var(--warn)">! ' + warns + '</span>'
        : '<span class="ok-mark">✓</span>';
    var tabFlags = ['background', 'workflow', 'demo'].map(function (k) {
      return '<span class="' + (c.tabs[k] ? 'ok-mark' : 'dim-mark') + '" title="' + k + '">' + (c.tabs[k] ? '●' : '○') + '</span>';
    }).join(' ');
    var mChips = (c.methods || []).map(caseChip).join('') ||
      '<span class="dim-mark">' + esc((sc.methods || []).map(function (k) { return (A.methods[k] || {}).name || k; }).join(' / ')) + '</span>';
    var href = '#/scene/' + sc.id + '?case=' + esc(c.id);

    return '<div class="cs-card">' +
      '<div class="cs-top"><span class="cs-id">' + esc(c.id) + '</span>' + state + '</div>' +
      '<a class="cs-name" href="' + href + '">' + esc(c.title || sc.name) +
      (c.imported ? '<span class="badge-local">本地导入</span>' : '') + '</a>' +
      '<div class="cs-sc">' + esc(sc.stageName) + ' / ' + esc(sc.name) + '</div>' +
      '<div class="cs-chips">' + mChips + '</div>' +
      '<div class="cs-foot"><span class="cs-meta">' + esc(c.version || '—') + ' · ' + esc(c.updated || '—') +
      '<em class="cs-flags">' + tabFlags + '</em></span>' +
      '<a class="btn sm ghost" href="' + href + '">查看 →</a></div>' +
      '</div>';
  }

  function casesHTML(q) {
    var list = Cases.list();
    var checks = Cases.validateAll();
    var s = Cases.stats();
    var pending = A.allScenes.filter(function (sc) { return !Cases.bySceneAll(sc.id).length; });
    var cur = (q && q.stage) || 'all';

    /* 顶部：13 个作业环节一行铺开（不带"全部"——未选中任何环节时即展示全部） */
    var stageChips = A.stages.map(function (st) {
      var n = 0;
      st.scenes.forEach(function (sc) { n += Cases.bySceneAll(sc.id).length; });
      return '<button type="button" class="cs-chip' + (cur === st.id ? ' on' : '') + '" data-cs-stage="' + st.id + '">' +
        esc(st.name) + ' <i>' + n + '</i></button>';
    }).join('');

    /* 卡片网格：按环节分组（选单环节时只出一组、不重复标题） */
    /* 未选环节：按作业顺序平铺全部案例，不加分组标题；选中环节：只出该环节卡片 */
    var all = cur === 'all';
    var flat = [];
    A.stages.forEach(function (st) {
      if (!all && cur !== st.id) return;
      st.scenes.forEach(function (sc) {
        Cases.bySceneAll(sc.id).forEach(function (c) {
          flat.push(caseCard(sc, c, checks[c.id] || []));
        });
      });
    });
    var groups = flat.length
      ? '<div class="cs-grid">' + flat.join('') + '</div>'
      : '<div class="empty" style="padding:48px 0"><b>该环节暂无已接入案例</b>去<a href="#/map" style="color:var(--jade-d)">介入点图谱</a>看看候选场景。</div>';

    /* 接入状态与校验：默认收起，点击展开 */
    var rows = list.map(function (c) {
      var sc = A.index.byScene[c.sceneId];
      var ck = checks[c.id] || [];
      var errs = ck.filter(function (x) { return x.level === 'error'; }).length;
      var warns = ck.filter(function (x) { return x.level === 'warn'; }).length;
      var state = '<button type="button" class="lnk-check" data-check-case="' + esc(c.id) + '" title="点击查看校验明细">' +
        (errs ? '<span class="bad-mark">✕ ' + errs + ' 项错误</span>'
          : warns ? '<span class="mono" style="font-size:11px;color:var(--warn)">! ' + warns + ' 项提醒</span>'
            : '<span class="ok-mark">✓ 通过</span>') + '</button>';
      var tabFlags = ['background', 'workflow', 'demo'].map(function (k) {
        return '<span class="' + (c.tabs[k] ? 'ok-mark' : 'dim-mark') + '" title="' + k + '">' + (c.tabs[k] ? '●' : '○') + '</span>';
      }).join(' ');
      var mChips = (c.methods || []).map(caseChip).join('') || '<span class="dim-mark">继承场景</span>';

      return '<tr><td class="id">' + esc(c.id) + '</td>' +
        '<td><div class="nm">' + esc(c.title || sc && sc.name) +
        (c.imported ? '<span class="badge-local">本地导入</span>' : '') + '</div>' +
        '<div class="sc">' + (sc ? esc(sc.stageName) + ' / ' + esc(sc.name) : '⚠ sceneId 未匹配') + '</div></td>' +
        '<td>' + mChips + '</td>' +
        '<td class="sc">' + esc(c.version || '—') + '</td>' +
        '<td class="sc">' + esc(c.updated || '—') + '</td>' +
        '<td style="letter-spacing:.16em">' + tabFlags + '</td>' +
        '<td>' + state + '</td>' +
        '<td class="acts">' + (sc ? '<a class="btn sm ghost" href="#/scene/' + sc.id + '?case=' + esc(c.id) + '">查看</a>' : '—') +
        '<a href="#" class="link-remove" data-remove-case="' + esc(c.id) + '" title="' +
        (c.imported ? '从本机移除这份上传的案例包' : '从站点删除这个插件案例（文件保留，可恢复）') + '">' +
        (c.imported ? '移除' : '删除') + '</a>' +
        '</td></tr>';
    }).join('');

    /* 被删除（隐藏）的插件案例——可恢复 */
    var blocked = (global.CaseImport && global.CaseImport.blockedList ? global.CaseImport.blockedList() : [])
      .filter(function (id) { return !Cases.get(id); });
    var blockedBlock = '';
    if (blocked.length) {
      blockedBlock =
        '<div class="blocked-box">' +
        '<div class="bb-h"><span class="kicker clay">HIDDEN</span>' +
        '<b>已删除的插件案例（' + blocked.length + '）</b>' +
        '<span class="bb-sub">.js 文件仍在磁盘上，恢复后重新加载页面即可回到上表</span></div>' +
        '<div class="bb-list">' + blocked.map(function (id) {
          return '<span class="bb-item"><span class="mono">' + esc(id) + '</span>' +
            '<a href="#" class="link-remove" data-restore-case="' + esc(id) + '">恢复</a></span>';
        }).join('') + '</div></div>';
    }

    /* 视图：卡片（默认）/ 列表（原接入状态校验表）
       优先级：URL 的 ?view= > localStorage 里记住的偏好；带 URL 参数时顺带更新偏好 */
    var VIEW = 'grid';
    try { VIEW = localStorage.getItem('csView') === 'list' ? 'list' : 'grid'; } catch (e) {}
    var qView = q && (q.view === 'list' || q.view === 'grid') ? q.view : '';
    if (qView) { VIEW = qView; try { localStorage.setItem('csView', qView); } catch (e) {} }

    var listView = '<div class="console-bar">' +
      '<span class="num">' + s.coveredScenes + '<small>/' + s.totalScenes + '</small></span>' +
      '<span class="lbl">个场景已有案例实现（共 ' + s.registered + ' 个案例）</span><span class="sp"></span>' +
      '<button class="btn sm amber" data-import>' + T('addCase') + '</button>' +
      '<button class="btn sm ghost" data-batch-import title="' + (LANG === 'en' ? 'Pick one root folder; auto-split, validate and import packages in batch' : '一次选择一个总文件夹，自动分包逐包校验后批量导入') + '">' + (LANG === 'en' ? 'Batch import' : '批量导入') + '</button>' +
      '<button class="btn sm ghost" id="rerun">' + (LANG === 'en' ? 'Re-check' : '重新校验') + '</button></div>' +
      '<div class="matrix-wrap" style="box-shadow:var(--sh-1)">' +
      '<table class="sys-table"><thead><tr>' +
      '<th>案例 id</th><th>绑定场景</th><th>涉及技术</th><th>版本</th><th>更新</th><th>三块内容</th><th>校验</th><th></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="empty">暂无已注册案例</td></tr>') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:9px">三块内容依次为 background / workflow / demo，● 已提供、○ 未提供。技术标签可在导入时勾选，不选则继承场景；同一个场景支持挂多个案例，场景页顶部会出现切换器。删除上传案例会清掉本机存档；删除插件案例只是隐藏，文件不动，可随时恢复。</p>' +
      blockedBlock;

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/cases', '案例库']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">CASE REGISTRY</div>' +
      '<h1>案例库</h1>' +
      '<p class="blurb">按作业环节浏览已接入的案例实现。每个案例绑定一个场景，含专业背景、作业流程与可交互示范三块内容。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + s.registered + '</div><div class="l">已注册</div></div>' +
      '<div><div class="n">' + s.withDemo + '</div><div class="l">含示范</div></div>' +
      '<div><div class="n">' + pending.length + '</div><div class="l">待接入</div></div>' +
      '</div></div></div>' +

      /* 环节条 + 右侧视图切换（卡片 / 列表） */
      '<div class="cs-bar">' +
      '<div class="cs-stages">' + stageChips + '</div>' +
      '<div class="cs-view" role="group">' +
      '<button type="button" class="cs-vbtn' + (VIEW === 'grid' ? ' on' : '') + '" data-cs-view="grid" title="卡片视图">▦ 卡片</button>' +
      '<button type="button" class="cs-vbtn' + (VIEW === 'list' ? ' on' : '') + '" data-cs-view="list" title="列表视图（接入状态与校验）">☰ 列表</button>' +
      '</div></div>' +
      (VIEW === 'grid' ? groups : listView) +

      '<div class="section" style="padding:36px 0 56px">' +
      '<div class="sec-head"><div><span class="kicker">BACKLOG</span>' +
      '<h2 style="margin-top:10px">还有 ' + pending.length + ' 个场景等待接入</h2>' +
      '<p>下面这些场景已有元数据，缺的是案例实现。接入一个大约需要「一份专业背景 + 一条流程 + 一个能跑的最小示范」。</p>' +
      '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:7px">' +
      pending.slice(0, 24).map(function (sc) {
        return '<a class="tag" href="#/scene/' + sc.id + '">' + esc(sc.name) + '</a>';
      }).join('') +
      (pending.length > 24 ? '<span class="tag">… 另有 ' + (pending.length - 24) + ' 个</span>' : '') +
      '</div></div></main>';
  }

  /* ---- 校验明细弹窗：点击表格里的「通过 / 提醒 / 错误」弹出 ---- */
  function openCheckModal(id) {
    var c = Cases.get(id);
    if (!c) return;
    var ck = Cases.validateAll()[id] || [];
    var errs = ck.filter(function (x) { return x.level === 'error'; }).length;
    var warns = ck.filter(function (x) { return x.level === 'warn'; }).length;
    var summary = errs ? '<span class="bad-mark">✕ ' + errs + ' 项错误</span>'
      : warns ? '<span class="mono" style="font-size:11px;color:var(--warn)">! ' + warns + ' 项提醒</span>'
        : '<span class="ok-mark">✓ 全部通过</span>';
    var rows = ck.map(function (x) {
      var lv = x.level === 'ok' ? 'ok' : x.level === 'warn' ? 'warn' : 'error';
      var mark = lv === 'ok' ? '✓' : lv === 'warn' ? '!' : '✕';
      return '<div class="imp-item" data-lv="' + lv + '">' +
        '<span class="imp-i">' + mark + '</span>' +
        '<span class="imp-m"><b>' + esc(x.label) + '</b>' +
        (x.detail ? '<span class="check-detail">' + esc(x.detail) + '</span>' : '') +
        '</span></div>';
    }).join('');
    closeCheckModal();
    var ov = document.createElement('div');
    ov.className = 'mdl';
    ov.id = 'check-modal';
    ov.innerHTML =
      '<div class="mdl-bg" data-check-close="1"></div>' +
      '<div class="mdl-p check-p">' +
      '<div class="mdl-h"><div>' +
      '<div class="eyebrow">VALIDATION · 校验明细</div>' +
      '<h3>' + esc(c.id) + '</h3>' +
      '<div class="mdl-hsub">' + esc(c.title || '') + ' · 共 ' + ck.length + ' 项 · ' + summary + '</div>' +
      '</div></div><button type="button" class="mdl-x" data-check-close="1">✕</button></div>' +
      '<div class="mdl-b"><div class="check-list">' + rows + '</div></div>' +
      '<div class="mdl-f"><span class="imp-tip">校验在案例注册与「重新校验」时运行；红色必须处理，黄色建议处理。修改案例包后可拖回「添加案例」重新导入。</span></div>' +
      '</div></div>';
    document.body.appendChild(ov);
    document.documentElement.classList.add('mdl-open');
  }
  function closeCheckModal() {
    var m = document.getElementById('check-modal');
    if (m) m.remove();
    if (!document.querySelector('.mdl')) document.documentElement.classList.remove('mdl-open');
  }
  var checkModalBound = false;
  function bindCheckModal() {
    if (checkModalBound) return;
    checkModalBound = true;
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-check-case]')) {
        e.preventDefault();
        openCheckModal(e.target.closest('[data-check-case]').getAttribute('data-check-case'));
        return;
      }
      if (e.target.closest('[data-check-close]')) closeCheckModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCheckModal();
    });
  }
  bindCheckModal();

  /* =========================================================
     九、接入指南
     ========================================================= */
  function guideHTML() {
    var fileTree = K.tree([
      '<b>项目根目录</b>',
      '├── index.html                <span class="cm">← 新增案例时加一行 script</span>',
      '├── serve.js                  <span class="cm">本地静态服务器（node serve.js）</span>',
      '├── _build-plugins.js         <span class="cm">案例包 → 插件 批量构建脚本</span>',
      '├── _audit-cases.js           <span class="cm">案例质量体检脚本</span>',
      '├── assets/',
      '│   ├── data.js               <span class="cm">场景元数据（13 环节 / 77 场景）</span>',
      '│   ├── cases/                <span class="dir">← 案例都放这里</span>',
      '│   │   ├── welllog-layer.case.js   <span class="new">测井分层（示例）</span>',
      '│   │   └── *.case.js               <span class="new">其余插件案例（由 _build-plugins.js 自动生成）</span>',
      '│   └── core/                 <span class="cm">外壳，一般不用动</span>',
      '│       ├── tokens.css        <span class="cm">颜色 / 字号 / 圆角</span>',
      '│       ├── layout.css        <span class="cm">导航 / 页头 / 页脚</span>',
      '│       ├── ui.css            <span class="cm">卡片 / 表格 / 四段式 / 示范</span>',
      '│       ├── polish.css        <span class="cm">界面精修与打印样式（覆盖层）</span>',
      '│       ├── registry.js       <span class="cm">Cases.register 契约与校验</span>',
      '│       ├── kit.js            <span class="cm">K.sec4 / K.figure / K.code…</span>',
      '│       ├── case-demo-host.js <span class="cm">示范宿主：iframe 整页 / Shadow DOM 模块</span>',
      '│       ├── case-upload.js    <span class="cm">案例包导入：单个 / 批量 / 校验 / 打包</span>',
      '│       ├── learn.js          <span class="cm">收藏 / 对比 / 演示模式 / 导出</span>',
      '│       └── shell.js          <span class="cm">路由与页面</span>',
      '└── docs/',
      '    └── 如何添加新案例.md      <span class="cm">本页的离线版</span>'
    ]);

    var sample = [
      "Cases.register({",
      "  id: 'logging-mud-loss',          // 必填，kebab-case，全局唯一",
      "  sceneId: 'd3',                    // 必填，data.js 里已有的场景 id",
      "  title: '钻井液漏失层位识别',",
      "  status: 'ready',                  // ready | draft",
      "  version: '1.0.0',",
      "  updated: '2026-10-22',",
      "",
      "  tabs: {",
      "    // ① 专业背景：四段式，返回 HTML 字符串",
      "    background: {",
      "      label: '专业背景',",
      "      judge: [",
      "        { label: '任务', value: '序列分割' },",
      "        { label: '数据', value: '随钻曲线 + 漏失记录' }",
      "      ],",
      "      lede: '一句话说明这个场景到底在做什么。',",
      "      sections: [",
      "        { no: 1, en: 'PROBLEM', title: '当前做法与问题',",
      "          html: '<p>……</p>' + K.figure(svgManual(), 1, '图注') },",
      "        { no: 2, en: 'INTERVENTION', title: 'AI 能做什么', html: '……' },",
      "        { no: 3, en: 'DATA', title: '你需要准备什么',",
      "          html: K.checklist([['随钻曲线', '1 s 采样'], ['漏失记录', '人工登记']]) },",
      "        { no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向', html: '……' }",
      "      ]",
      "    },",
      "",
      "    // ② 案例流程：一条真实项目走过的路",
      "    workflow: {",
      "      label: '案例流程',",
      "      title: '某某区块 18 口井的漏失识别',",
      "      lead: ['项目目标不是做模型，而是把漏失层位定位时间压到 10 分钟。'],",
      "      stats: [['样本井', '18 口'], ['目标准确率', '85%']],",
      "      steps: [",
      "        { name: '数据对齐', do: '……', role: '工程环节',",
      "          effect: '……', trap: '……' }",
      "      ],",
      "      fails: [{ name: '标签滞后', why: '……' }]",
      "    },",
      "",
      "    // ③ 可运行示范（可选）：给一个 DOM 容器就能跑",
      "    demo: {",
      "      label: '可运行示范',",
      "      mount: function (root, ctx) {",
      "        root.innerHTML = '<div>……</div>';",
      "        // ctx.scene / ctx.kase / ctx.K / ctx.atlas 都可直接用",
      "      },",
      "      unmount: function () { /* 清理定时器、事件监听 */ }",
      "    }",
      "  }",
      "});"
    ].join('\n');

    var fields = [
      ['§ 文件结构（方式 A 的包里放什么）'],
      ['case.json', '必填', '清单，放包根目录；下面「清单字段」都写在它里面'],
      ['demo/index.html', '可选', '整页示范；自动内联 css/js，图片相对路径自动内嵌'],
      ['demo/demo.css', '可选', '示范页样式，只在沙箱 iframe 里生效'],
      ['demo/demo.js', '可选', '示范脚本；没有 html 时走模块模式，需导出 mount'],
      ['图片 / JSON 素材', '可选', '放进包里即可被引用，路径自动替换成内嵌资源'],
      ['§ 清单字段（两种方式共用）'],
      ['id', '必填', '全局唯一标识，kebab-case。显示在场景页头部与案例库。'],
      ['sceneId', '必填', '绑定到 data.js 中的某个场景 id。校验会检查它是否存在。'],
      ['title', '必填', '案例标题，通常与场景名一致或更具体。'],
      ['methods', '可选', '数组。案例涉及的 AI 技术；不填则继承场景标签。'],
      ['status', '建议', 'ready = 可用于教学；draft = 内容未定稿，控制台标黄。'],
      ['version / updated', '建议', '语义化版本，改了内容就升一格 / 最后更新日期。'],
      ['tabs.background', '必填', '对象。judge（30 秒判断）/ lede（导语）/ sections（四段式数组）。'],
      ['tabs.background.sections[]', '必填', '每段 { no, en, title, html }。建议恰好四段，与全站一致。'],
      ['tabs.background.judge', '可选', '「30 秒判断」四格 { label, value, desc }。'],
      ['tabs.workflow', '建议', '对象。title / lead[] / stats[] / steps[] / metrics / fails[]。'],
      ['tabs.workflow.steps[]', '建议', '每步 { name, do, role, effect, trap, viz }。role 会渲染成小标签。'],
      ['§ 示范配置（可选）'],
      ['tabs.demo（包）', '可选', '{ html, js, height }；mode 一般不用写（auto 自动判断）。'],
      ['tabs.demo.builtin', '可选', '复用某个已有案例的示范（填它的 id）。'],
      ['tabs.demo（插件）', '可选', '{ label, mount(root, ctx), unmount() }；mount 必填。']
    ].map(function (r) {
      if (r[0].charAt(0) === '§') {
        return '<tr class="ct-group"><td colspan="3">' + esc(r[0].slice(1).trim()) + '</td></tr>';
      }
      var req = r[1] === '必填' ? '<span class="req">必填</span>'
        : r[1] === '建议' ? '<span class="opt">建议</span>' : '<span class="opt">可选</span>';
      return '<tr><td>' + esc(r[0]) + '</td><td>' + req + '</td><td>' + rich(r[2]) + '</td></tr>';
    }).join('');

    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/guide', '接入指南']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">EXTENDING</div>' +
      '<h1>案例接入规范</h1>' +
      '<p class="blurb">本站提供两种案例接入方式：无需编写代码的案例包上传，以及用于承载真实算法示范的插件开发。两种方式接入后效果一致，场景页将自动生成对应标签页，并被检索路径收录。</p>' +
      '</div></div></div>' +

      /* ---- 方式 A：上传案例包 ---- */
      '<div class="sec-head" style="margin-top:4px">' +
      '<div class="sec-rail"><span class="sec-num">A</span><span class="kicker">UPLOAD PACKAGE · 推荐</span>' +
      '<span class="r"><span class="tag">无需修改站点文件</span></span></div>' +
      '<h2>上传案例包：三步完成接入</h2>' +
      '<p>第一步下载模板（zip，含可运行示范页）；第二步修改清单并替换演示内容；第三步将整个文件夹上传至本站。系统将逐项校验格式，通过后即时在站点中生效。要一次接入多个案例包，用案例库控制条上的<b>批量导入</b>：选一个总文件夹（每个包一个子文件夹），自动分包、逐包校验、勾选导入。</p>' +
      '</div>' +

      '<div class="upcard">' +
      '<div class="upcard-l">' +
      '<h4>案例包是什么</h4>' +
      '<p>是一个<b>文件夹</b>：一份 JSON 清单 + 任意演示文件。清单写名称、所属场景和两块正文（专业背景 / 案例流程）；' +
      '示范可以是一个完整的 <b>index.html</b>、配套的 <b>demo.js</b> / <b>demo.css</b>，以及图片、JSON 数据等素材。</p>' +
      '<p>拖进弹窗时会整个读进浏览器——<b>html 自动内联 css 与 js、图片自动转成内嵌资源</b>，所以不需要服务器，双击 index.html 也能跑。</p>' +
      '<p>示范页跑在 <b>sandbox iframe</b> 里，你可以随便写样式和脚本，不会污染主站；只有 demo.js 没有 html 时，脚本会挂进 <b>Shadow DOM</b>，样式同样隔离。</p>' +
      '<div class="upcard-acts">' +
      '<button class="btn amber" data-import>打开添加案例</button>' +
      '<button class="btn" data-dl-template>下载案例包模板（.zip）</button>' +
      '</div>' +
      '<div class="upcard-note">模板解压后就是一个可直接运行的完整包：清单 + 示范页 + 样式 + 脚本，改完整个文件夹拖回去即可。' +
      '上传的案例保存在本机浏览器（localStorage），换电脑需重新上传；要永久发布给所有人，用下面的方式 B，或用根目录的 _build-plugins.js 把案例包批量构建成插件。</div>' +
      '</div>' +
      '<div class="upcard-r">' +
      K.tree([
        '<b>my-case/</b>     <span class="cm">一个文件夹 = 一份案例</span>',
        '├── case.json  <span class="cm">清单（必填）</span>',
        '└── demo/',
        '    ├── index.html  <span class="cm">整页示范（可选）</span>',
        '    ├── demo.css    <span class="cm">样式（可选）</span>',
        '    └── demo.js     <span class="cm">脚本（可选）</span>'
      ]) +
      '</div>' +
      '</div>' +

      /* ---- 方式 B：插件 ---- */
      '<div class="sec-head" style="margin-top:26px">' +
      '<div class="sec-rail"><span class="sec-num">B</span><span class="kicker">PLUGIN · 需承载真实算法示范</span></div>' +
      '<h2>开发案例插件</h2>' +
      '<p>若需提供可交互的算法示范（可调参数的曲线、实时计算的结果），应采用插件方式。请按下列三个步骤实施。</p>' +
      '</div>' +

      '<div class="gsteps">' +
      '<div class="gstep"><div class="gn">1</div><div>' +
      '<h3>复制模板，改三处</h3>' +
      '<p>把 <b>assets/cases/_template.case.js</b> 复制成 <b>你的案例.case.js</b>，然后只改三处：<b>id</b>、<b>sceneId</b>、以及三个 tab 里的内容。</p>' +
      '<p>id 用 kebab-case，保证唯一；sceneId 必须是 <b>assets/data.js</b> 里已经存在的场景 id（比如 <b>w1</b> 是测井分层）。如果这个场景还不存在，先在 data.js 的对应环节 scenes 数组里加一条元数据。</p>' +
      '</div></div>' +

      '<div class="gstep"><div class="gn">2</div><div>' +
      '<h3>在 index.html 里挂上去</h3>' +
      '<p>找到页面底部的脚本区，在你的案例文件后面加一行：</p>' +
      K.code('<script src="assets/cases/你的案例.case.js"><' + '/script>', { file: 'index.html', note: '加在 shell.js 之前' }) +
      '<p>加载顺序是：data.js → registry.js → kit.js → 案例 → shell.js。案例必须在 shell.js 之前注册完，否则首屏渲染时找不到它。</p>' +
      '</div></div>' +

      '<div class="gstep"><div class="gn">3</div><div>' +
      '<h3>打开控制台看校验结果</h3>' +
      '<p>刷新页面，进 <a href="#/cases" style="color:var(--jade-d);font-weight:600">案例库</a>。点击每行「校验」列的 <b>✓ 通过 / 提醒</b> 会弹出校验明细：id 是否规范、sceneId 是否存在、三段内容是否齐全、demo.mount 是否为函数、场景与案例的 demo 标记是否一致、可视化密度是否达标。</p>' +
      '<p>全部通过后即完成接入：场景页标签、面包屑、相关场景与技术反查页中的条目均会自动生成，无需改动其它文件。</p>' +
      '</div></div>' +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">STRUCTURE</span>' +
      '<h2 style="margin-top:8px">文件在哪</h2></div></div>' + fileTree + '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">CONTRACT</span>' +
      '<h2 style="margin-top:8px">契约字段</h2>' +
      '<p>两种接入方式共用同一份契约：方式 A 把字段写进 case.json，方式 B 把同一个对象传给 Cases.register()。只有标「必填」的字段缺失会报错，其余缺失只是案例库「校验明细」里的一条提醒。</p></div></div>' +
      '<div class="matrix-wrap"><table class="contract"><thead><tr><th>字段</th><th>级别</th><th>说明</th></tr></thead><tbody>' +
      fields + '</tbody></table></div></div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">EXAMPLE</span>' +
      '<h2 style="margin-top:8px">一个完整的案例声明</h2>' +
      '<p>这是最小可用的骨架，把省略号换成你的内容即可。</p></div></div>' +
      K.code(sample, { file: 'assets/cases/your-case.case.js' }) +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">KIT</span>' +
      '<h2 style="margin-top:8px">内容怎么写：工具箱</h2>' +
      '<p>不要在案例里写 CSS 类名，用这些函数生成结构，版式改动会全站同步。</p></div></div>' +
      K.dtable(['函数', '用途'], [
        ['K.sec4(no, en, title, html)', '四段式中的一段，带编号与英文小标'],
        ['K.figure(svg, no, caption)', '插图 + 图注，图注支持 **粗体**'],
        ['K.judge([{label,value,desc}])', '页面顶部那排"30 秒判断"格子'],
        ['K.checklist(items)', '可勾选的数据准备清单，items 为 [名称, 规格, 标注要求]'],
        ['K.dtable(head, rows)', '普通数据表格'],
        ['K.pipeline(steps)', '带编号的流程步骤，每步可写效果与坑'],
        ['K.fails([{name, why}])', '失败模式四宫格'],
        ['K.cells([[标签, 值]])', '流程页右侧的指标格'],
        ['K.meter(diff)', '三段式难度条'],
        ['K.refs([...], href)', '参考方向胶囊'],
        ['K.callout(text, "warn")', '提示条'],
        ['K.code(str, {file})', '代码块，带语法着色']
      ]) +
      K.callout('文本里可以直接用 **粗体** 与 `等宽` 两种标记，所有函数都会自动转义 HTML，不需要手动防注入。') +

      '<p style="margin-top:24px"><span class="kicker plain" style="color:var(--ink-4)">可视化图元库 V · assets/core/vizkit.js</span></p>' +
      '<p style="margin-bottom:12px">图多且与内容贴合的案例，读起来才更有说服力：背景四段配示意图、流程每步配 viz、再加交互示范。这些图<b>不用手写 SVG</b>，调用 V 的图元函数即可（也可写作 K.V.*）。配色与版式全站统一。</p>' +
      K.dtable(['函数', '出什么图'], [
        ['V.flow([{name, role, note}], {cols})', '流程链：按 role（工程 / 算法 / 人工 / 闭环）自动配色，自动折行'],
        ['V.io({inputs, model, outputs, human})', '输入—模型—输出 + 人机分工：最能体现"AI 替换的是哪一步"'],
        ['V.wellbore({depth, layers, casings, perf, packer})', '井筒剖面：地层、套管、油管、封隔器、射孔段、人工井底'],
        ['V.strata([{name, sub, h, pat}])', '地层柱状图：pat 用 dot（砂岩）/ dash（泥岩）/ brick（灰岩）'],
        ['V.logTrack({curves, bounds, bands})', '测井曲线道：深度轴 + 多条曲线 + 层界面 + 层色带'],
        ['V.bars({labels, series, target})', '分组柱状对比（人工 vs AI、规则过滤前后）'],
        ['V.matrix({labels, rows})', '热力矩阵 / 混淆矩阵'],
        ['V.curve(pts, {auc})', 'ROC / PR 曲线，带对角基线与 AUC'],
        ['V.scatter(pts, {fit, band})', '散点 + 拟合线 + 置信带'],
        ['V.series({lines, band, xTicks})', '时序曲线 + 预测区间带'],
        ['V.radar({dims, names})', '人工 vs AI 能力雷达'],
        ['V.concept([{term, unit, viz, plain}])', '给外行的概念卡：在 background.concepts 填好即自动渲染'],
        ['V.cap(text)', '图注（支持 **粗体**）；步骤图写法：steps[i].viz = 图 + V.cap("图注")']
      ]) +
      K.callout('三个可选的新字段：background.concepts（概念卡）、background.io（人机分工图）、workflow.io。不填完全不影响渲染——流程页顶部的总览图由 steps 自动生成，所有案例零改动即得。') +
      '</div>' +

      '<div class="section tight">' +
      '<div class="sec-head"><div><span class="kicker">PITFALLS</span>' +
      '<h2 style="margin-top:8px">四个常踩的坑</h2></div></div>' +
      '<div class="fails" style="grid-template-columns:1fr 1fr">' +
      '<div class="fail"><div class="fi">PITFALL 01</div><h5>script 顺序放反</h5><p>案例写在 shell.js 后面，页面已经渲染完了才注册，控制台里能看到但场景页没有 tab。案例脚本必须在 shell.js 之前。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 02</div><h5>sceneId 拼错</h5><p>id 区分大小写。写错不会报 JS 错误，只是这个案例永远不出现。控制台的"绑定场景"列会显示 ⚠。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 03</div><h5>demo 里没有清理</h5><p>用 setInterval / addEventListener 的示范要在 unmount 里清掉，否则切换场景后老定时器还在跑。</p></div>' +
      '<div class="fail"><div class="fi">PITFALL 04</div><h5>把样式写死在案例里</h5><p>内联颜色会让案例在改配色时掉队。颜色一律用 var(--jade) 这类令牌，或干脆用 K.* 生成。</p></div>' +
      '</div></div>' +

      '<div class="pending" style="margin-top:36px"><div class="pending-top">' +
      '<span class="badge-ready">下一步</span><h3>从最简单的案例开始</h3></div>' +
      '<p>若尚未确定选题，建议优先选择<b>数据易得、任务边界清晰</b>的场景：专业背景写满四段、案例流程不少于三步，示范可后续补充。内容完整的小型案例优于空缺的场景条目。</p>' +
      '<div class="pending-actions">' +
      '<a class="btn primary" href="#/cases">看当前案例库 →</a>' +
      '<a class="btn" href="#/scene/w1">对照测井分层的写法</a></div></div>' +
      '</main>';
  }

  /* =========================================================
     九之二、全站搜索
     ---------------------------------------------------------
     搜索范围：场景（名称 / 介入点 / 简介 / 环节 / 技术）+ 已接入案例
     ========================================================= */
  function searchAll(q, limit) {
    var s = String(q || '').trim().toLowerCase();
    if (!s) return [];
    var out = [];

    A.allScenes.forEach(function (sc) {
      var score = 0;
      if (String(sc.name).toLowerCase().indexOf(s) >= 0) score += 6;
      if (String(sc.point || '').toLowerCase().indexOf(s) >= 0) score += 3;
      if (String(sc.intro || '').toLowerCase().indexOf(s) >= 0) score += 2;
      if (String(sc.stageName || '').toLowerCase().indexOf(s) >= 0) score += 2;
      if (String(sc.problem || '').toLowerCase().indexOf(s) >= 0) score += 1;
      sc.methods.forEach(function (k) {
        var m = M[k]; if (!m) return;
        if ((m.name + ' ' + m.abbr).toLowerCase().indexOf(s) >= 0) score += 3;
      });
      if (!score) return;
      out.push({
        kind: 'scene', score: score, title: sc.name, id: sc.id,
        sub: sc.stageName + ' · ' + sc.point, tail: sc.diff,
        href: '#/scene/' + sc.id
      });
    });

    Cases.list().forEach(function (c) {
      var score = 0;
      if (String(c.title || '').toLowerCase().indexOf(s) >= 0) score += 5;
      if (String(c.id).toLowerCase().indexOf(s) >= 0) score += 3;
      var sc = A.index.byScene[c.sceneId];
      if (sc && (sc.name + ' ' + sc.point).toLowerCase().indexOf(s) >= 0) score += 2;
      if (!score) return;
      out.push({
        kind: 'case', score: score, title: c.title || c.id,
        sub: (sc ? sc.name : c.sceneId) + ' · 案例',
        tail: (c.tabs && c.tabs.demo) ? '可运行' : '案例',
        href: '#/scene/' + c.sceneId + '?case=' + encodeURIComponent(c.id)
      });
    });

    out.sort(function (a, b) { return b.score - a.score; });
    return limit ? out.slice(0, limit) : out;
  }

  function mark(text, q) {
    var t = esc(text || '');
    var s = String(q || '').trim();
    if (!s) return t;
    var i = t.toLowerCase().indexOf(s.toLowerCase());
    if (i < 0) return t;
    return t.slice(0, i) + '<em class="hit-mark">' + t.slice(i, i + s.length) + '</em>' + t.slice(i + s.length);
  }

  function searchOutHTML(q) {
    var res = searchAll(q);
    var scenes = res.filter(function (r) { return r.kind === 'scene'; });
    var cases = res.filter(function (r) { return r.kind === 'case'; });

    if (!String(q || '').trim()) {
      return '<div class="empty"><b>输入关键词开始检索</b>' +
        '可以搜场景名（如「压裂」「防砂」）、技术（如「KG」「时序」）、环节（如「完井」）或已接入案例。</div>';
    }
    if (!res.length) {
      return '<div class="empty"><b>没有匹配「' + esc(q) + '」的内容</b>' +
        '换个词试试，或去<a href="#/chain" style="color:var(--clay-d)">作业链</a>按环节浏览。</div>';
    }

    var sceneHTML2 = scenes.slice(0, 40).map(function (r) {
      return '<a class="scene-row" href="' + r.href + '">' +
        '<div class="sr-n">' + esc(r.id || '').toUpperCase() + '</div>' +
        '<div><div class="sr-name">' + mark(r.title, q) + '<span class="arrow">→</span></div>' +
        '<div class="sr-point">' + mark(r.sub, q) + '</div></div>' +
        '<div class="sr-right"><span class="dtag" data-d="' + esc(r.tail) + '">难度 ' + esc(r.tail) + '</span></div>' +
        '</a>';
    }).join('');

    var caseHTML2 = cases.length
      ? '<div class="method-group"><div class="mg-head"><span class="idx">CASE</span><h3>匹配的案例</h3>' +
        '<span class="cnt">' + cases.length + ' 个</span></div><div class="mg-list">' +
        cases.slice(0, 20).map(function (r) {
          return '<a class="mrow" href="' + r.href + '">' +
            '<div><div class="nm">' + mark(r.title, q) + '</div>' +
            '<div class="pt">' + mark(r.sub, q) + '</div></div>' +
            '<div class="rt"><span class="tag">' + esc(r.tail) + '</span></div></a>';
        }).join('') + '</div></div>'
      : '';

    return (sceneHTML2
      ? '<div class="method-group"><div class="mg-head"><span class="idx">SCENE</span><h3>匹配的场景</h3>' +
        '<span class="cnt">' + scenes.length + ' 个</span></div><div class="scenes">' + sceneHTML2 + '</div></div>'
      : '') + caseHTML2;
  }

  function searchHTML(q) {
    var quick = Object.keys(M).map(function (k) {
      return '<a class="chip" data-m="' + (M[k].colorKey || k) + '" href="#/method/' + k + '">' + M[k].abbr + ' ' + esc(M[k].name) + '</a>';
    }).join('');
    return '<main class="wrap">' +
      crumb([['#/', '总览'], ['#/search', '搜索']]) +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">SEARCH</div>' +
      '<h1>全站搜索<span class="en">SCENES · CASES · METHODS</span></h1>' +
      '<p class="blurb">场景名、介入点、技术类别、环节名、已接入案例都可以搜。</p>' +
      '</div></div></div>' +
      '<div class="search-box">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" stroke-width="2.2" stroke-linecap="round">' +
      '<circle cx="10.5" cy="10.5" r="6.4"/><path d="M15.6 15.6 L21 21"/></svg>' +
      '<input id="sp-in" type="text" placeholder="例如：压裂 / 防砂 / KG / 完井" value="' + esc(q || '') + '">' +
      '<span class="n" id="sp-n"></span></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 4px">' + quick + '</div>' +
      '<div id="search-out">' + searchOutHTML(q) + '</div>' +
      '</main>';
  }

  function bindSearch() {
    var inp = document.getElementById('sp-in');
    var out = document.getElementById('search-out');
    if (!inp || !out) return;
    function run() {
      var v = inp.value;
      out.innerHTML = searchOutHTML(v);
      var n = searchAll(v).length;
      var cnt = document.getElementById('sp-n');
      if (cnt) cnt.textContent = String(v).trim() ? n + ' 条结果' : '';
      setHashQuiet('#/search?q=' + encodeURIComponent(v));
    }
    inp.addEventListener('input', run);
    run();
  }

  /* 顶栏：搜索建议 / 键盘操作 */
  function bindHeader() {
    var inp = document.getElementById('gs-in');
    var sug = document.getElementById('gsug');
    if (!inp || !sug) return;
    var sel = -1, items = [];

    function close() { sug.hidden = true; sel = -1; }

    function render(q) {
      items = searchAll(q, 7);
      if (!String(q).trim() || !items.length) { close(); return; }
      sug.innerHTML = '<div class="gsug-h">' + searchAll(q).length + ' 条结果 · 回车查看全部</div>' +
        items.map(function (r, i) {
          return '<div class="gsug-item" data-i="' + i + '" data-href="' + r.href + '">' +
            '<div><div class="t">' + mark(r.title, q) + '</div><div class="s">' + mark(r.sub, q) + '</div></div>' +
            '<div class="g">' + esc(r.tail) + '</div></div>';
        }).join('') +
        '<a class="gsug-more" href="#/search?q=' + encodeURIComponent(q) + '">查看全部结果 →</a>';
      sug.hidden = false; sel = -1;
    }

    function move(d) {
      if (sug.hidden || !items.length) return;
      var nodes = sug.querySelectorAll('.gsug-item');
      sel = (sel + d + nodes.length) % nodes.length;
      [].forEach.call(nodes, function (n, i) { n.classList.toggle('sel', i === sel); });
    }

    inp.addEventListener('input', function () { render(inp.value); });
    inp.addEventListener('focus', function () { if (inp.value) render(inp.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Escape') { close(); inp.blur(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (sel >= 0 && items[sel]) go(items[sel].href);
        else go('#/search?q=' + encodeURIComponent(inp.value));
      }
    });

    sug.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.gsug-item');
      if (!it) return;
      e.preventDefault();
      go(it.dataset.href);
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.gs-wrap')) close();
    });

    /* 斜杠快捷键：把光标送进搜索框 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      inp.focus(); inp.select();
    });
  }

  /* 顶栏工具：中英切换 / 明暗切换 */
  function bindTools() {
    var lt = document.getElementById('lang-toggle');
    if (lt) lt.addEventListener('click', function () {
      LANG = LANG === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('atlas-lang', LANG); } catch (e) { }
      document.documentElement.setAttribute('lang', LANG === 'en' ? 'en' : 'zh-CN');
      render();
    });

    var tt = document.getElementById('theme-toggle');
    if (tt) tt.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('atlas-theme', next); } catch (e) { }
      tt.innerHTML = next === 'dark' ? ICON_MOON : ICON_SUN;
      tt.title = T('themeTip');
    });
  }

  /* 词条按长度降序，供句内短语匹配使用 */
  var LONG_KEYS = null;
  function longKeys(dict) {
    if (LONG_KEYS) return LONG_KEYS;
    LONG_KEYS = Object.keys(dict).sort(function (a, b) { return b.length - a.length; });
    return LONG_KEYS;
  }

  /* 整串命中 → 顿号分句 → 句内长短语，逐层降级；无命中返回 undefined */
  function trText(s, dict) {
    var hit = dict[s];
    if (hit !== undefined) return hit;

    if (s.indexOf('、') > -1) {
      var segs = s.split('、').map(function (p) { return p.trim(); });
      var outs = segs.map(function (p) { return dict[p]; });
      if (outs.every(function (x) { return x !== undefined; })) return outs.join(' · ');
    }

    var ks = longKeys(dict), out = '', i = 0, changed = false;
    while (i < s.length) {
      var matched = null;
      for (var j = 0; j < ks.length; j++) {
        if (s.substr(i, ks[j].length) !== ks[j]) continue;
        /* 短词（<4 字）只有后面不紧跟汉字时才替换，避免切坏词组 */
        if (ks[j].length < 4) {
          var nx = s.charAt(i + ks[j].length);
          if (nx && /[\u4e00-\u9fa5]/.test(nx)) continue;
        }
        matched = ks[j]; break;
      }
      if (matched) { out += dict[matched]; i += matched.length; changed = true; }
      else { out += s[i]; i++; }
    }

    /* 量词：数字后的「个 / 项 / 个场景 / 个环节 / 个案例」 */
    var u = out
      .replace(/(\d+)\s*个场景/g, '$1 scenes')
      .replace(/(\d+)\s*个环节/g, '$1 stages')
      .replace(/(\d+)\s*个案例/g, '$1 cases')
      .replace(/(\d+)\s*项/g, '$1 items')
      .replace(/(\d+)\s*条/g, '$1 items')
      .replace(/(\d+)\s*个/g, '$1');
    if (u !== out) { out = u; changed = true; }

    /* 已替换过的节点顺带把中文标点换成英文标点并压缩空白 */
    if (changed) {
      out = out
        .replace(/，/g, ', ').replace(/。/g, '.')
        .replace(/：/g, ': ').replace(/；/g, '; ')
        .replace(/（/g, '(').replace(/）/g, ')')
        .replace(/「/g, '"').replace(/」/g, '"')
        .replace(/\s+/g, ' ');
    }

    return changed ? out : undefined;
  }

  /* 渲染后整树替换文案：LANG=en 时按 i18n.en.js 的词条逐条替换 */
  function applyI18n(root) {
    if (LANG !== 'en') return;
    var dict = window.ATLAS_EN;
    if (!dict) return;
    var host = root || document.body;

    /* 语言按钮自身不翻译（其中含「中」字） */
    function blocked(node) {
      var p = node.parentNode;
      while (p && p !== host) {
        if (p.classList && p.classList.contains('hdr-tools')) return true;
        p = p.parentNode;
      }
      return false;
    }

    var walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      var tag = n.parentNode && n.parentNode.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue;
      if (blocked(n)) continue;
      nodes.push(n);
    }
    nodes.forEach(function (t) {
      var v = t.nodeValue;
      if (!v || !/[\u4e00-\u9fa5]/.test(v)) return;
      var hit = trText(v.trim(), dict);
      if (hit === undefined) return;
      t.nodeValue = v.replace(v.trim(), hit);
    });

    ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (attr) {
      [].forEach.call(host.querySelectorAll('[' + attr + ']'), function (el) {
        if (el.closest('.hdr-tools')) return;
        var v = el.getAttribute(attr) || '';
        var s = v.trim();
        if (!/[\u4e00-\u9fa5]/.test(s)) return;
        var hit = trText(s, dict);
        if (hit !== undefined) el.setAttribute(attr, hit);
      });
    });

    /* 兜住异步插入的节点（completion 标签、图谱详情、示范宿主等在
       applyI18n 之后才渲染的内容）：只观察 childList，翻译本身只改
       文本/属性，不会再次触发，避免循环。 */
    if (!applyI18n._mo) {
      applyI18n._mo = new MutationObserver(function () {
        clearTimeout(applyI18n._t);
        applyI18n._t = setTimeout(function () { applyI18n(document.body); }, 80);
      });
      applyI18n._mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  /* 载入偏好：主题 / 语言（在首次渲染前生效） */
  function initPrefs() {
    var theme = 'light';
    try { theme = localStorage.getItem('atlas-theme') === 'dark' ? 'dark' : 'light'; } catch (e) { }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('lang', LANG === 'en' ? 'en' : 'zh-CN');
  }

  /* 阅读进度 + 回到顶部：只注册一次，元素按 id 现取 */
  function bindScrollUI() {
    var scrolling = false;
    function sync() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? Math.min(1, h.scrollTop / max) : 0;
      var bar = document.getElementById('hdr-prog');
      if (bar) bar.style.width = (pct * 100) + '%';
      var tt = document.getElementById('totop');
      if (tt) tt.classList.toggle('on', h.scrollTop > 420);
      scrolling = false;
    }
    window.addEventListener('scroll', function () {
      if (scrolling) return;
      scrolling = true;
      window.requestAnimationFrame(sync);
    }, { passive: true });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#totop')) return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    sync();
  }

  /* 作业链：横向滑动箭头 + 配套面板（一次性委托） */
  var chainNavBound = false;
  function bindChainNav() {
    if (chainNavBound) return;
    chainNavBound = true;
    document.addEventListener('click', function (e) {
      /* 顶部节点图：平滑滚动到对应环节 */
      var jp = e.target.closest('[data-jump]');
      if (jp) {
        e.preventDefault();
        var target = document.getElementById(jp.getAttribute('data-jump'));
        if (target) {
          var hdr = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h'), 10);
          if (!hdr) hdr = 84;
          var y = target.getBoundingClientRect().top + window.pageYOffset - hdr - 14;
          window.scrollTo({ top: y, behavior: 'smooth' });
          target.classList.remove('flash');
          void target.offsetWidth;
          target.classList.add('flash');
        }
        return;
      }
      var btn = e.target.closest('[data-chainscroll]');
      if (btn) {
        var wrap = btn.closest('.chain-wrap');
        var sc = wrap && wrap.querySelector('.chain-scroll');
        if (sc) sc.scrollBy({ left: 640 * Number(btn.getAttribute('data-chainscroll')), behavior: 'smooth' });
        return;
      }
      /* 配套面板：四个链路切换 */
      var tab = e.target.closest('[data-pnl]');
      if (tab) {
        var pnl = tab.closest('.pnl');
        if (!pnl) return;
        [].forEach.call(pnl.querySelectorAll('.pnl-tab'), function (t) { t.classList.toggle('on', t === tab); });
        [].forEach.call(pnl.querySelectorAll('.pnl-b'), function (b) {
          b.hidden = b.getAttribute('data-pb') !== tab.getAttribute('data-pnl');
        });
        return;
      }
      /* 公开案例丰富度链路：点击阶段展开该阶段场景清单 */
      var mn = e.target.closest('[data-mat]');
      if (mn) {
        var box = mn.closest('.pnl-b');
        if (!box) return;
        var key = mn.getAttribute('data-mat');
        [].forEach.call(box.querySelectorAll('.mn'), function (m) { m.classList.toggle('on', m === mn); });
        [].forEach.call(box.querySelectorAll('.ml'), function (l) {
          l.hidden = l.getAttribute('data-ml') !== key;
        });
      }
    });
  }

  /* =========================================================
     十、调度
     ========================================================= */
  function unmountCurrent() {
    if (mounted && mounted.unmount) {
      try { mounted.unmount(); } catch (e) { }
    }
    mounted = null;
    mountedKey = '';
  }

  function render() {
    var r = parseHash();
    var p = r.parts;
    unmountCurrent();
    window.scrollTo(0, 0);

    var html;
    if (!p.length) html = homeHTML();
    else if (p[0] === 'chain') html = chainHTML();
    else if (p[0] === 'map') {
      html = global.MapPage ? global.MapPage.html(r.q)
        : '<main class="wrap"><div class="empty" style="padding:120px 0"><b>正在加载图谱</b>' +
        '若持续显示，请检查 assets/map.js 是否已引入。</div></main>';
    } else if (p[0] === 'find') {
      /* 选题问答已并入 #/data 右侧面板：旧链接重定向 */
      location.replace('#/data');
      return;
    }
    else if (p[0] === 'plan') {
      html = global.PlanPage ? global.PlanPage.html(r.q)
        : '<main class="wrap"><div class="empty" style="padding:120px 0"><b>正在加载立项决策台</b>' +
        '若持续显示，请检查 assets/plan.js 是否已引入。</div></main>';
    }
    else if (p[0] === 'cases') html = casesHTML(r.q);
    else if (p[0] === 'guide') html = guideHTML();
    else if (p[0] === 'search') html = searchHTML(r.q.q || '');
    else if (p[0] === 'data') {
      html = global.DataPage ? global.DataPage.html(r.q)
        : '<main class="wrap"><div class="empty" style="padding:120px 0"><b>正在加载数据资产页</b>' +
        '若持续显示，请检查 assets/data.js 是否已引入。</div></main>';
    }
    else if (p[0] === 'mine') {
      html = global.WorkPage ? global.WorkPage.html()
        : '<main class="wrap"><div class="empty" style="padding:120px 0"><b>正在加载工作区</b>' +
        '若持续显示，请检查 assets/work.js 是否已引入。</div></main>';
    }
    else if (p[0] === 'admin') html = global.Admin ? global.Admin.route(p, r.q) : notFound('管理模块未加载');
    else if (p[0] === 'stage') {
      var st = A.index.byStage[p[1]];
      html = st ? stageHTML(st, r.q) : notFound('没有这个环节');
    } else if (p[0] === 'method') {
      html = methodHTML(p[1], r.q);
    } else if (p[0] === 'scene') {
      var sc = A.index.byScene[p[1]];
      html = sc ? sceneHTML(sc, r.q) : notFound('没有这个场景');
    } else html = notFound('页面不存在');

    view.innerHTML = header() + html + footer();
    injectCrumbBack(view);

    // 顶栏（每次重渲染后重新绑定搜索框与工具按钮）
    bindHeader();
    bindTools();

    // 页面级交互
    if (p[0] === 'stage') bindFilters(view);
    if (p[0] === 'search') bindSearch();
    if (p[0] === 'scene') {
      var sc2 = A.index.byScene[p[1]];
      var all2 = sc2 && Cases.bySceneAll(sc2.id);
      var c2 = all2 && all2.filter(function (x) { return x.id === r.q.case; })[0] || (all2 && all2[0]) || null;
      if (c2) bindTabs(sc2, c2);
      /* 多案例切换器 */
      [].forEach.call(view.querySelectorAll('.case-switch [data-case]'), function (b) {
        b.addEventListener('click', function () {
          var tab = parseHash().q.tab;
          go('#/scene/' + sc2.id + '?case=' + b.dataset.case + (tab ? '&tab=' + tab : ''));
        });
      });
    }
    if (p[0] === 'map' && global.MapPage) global.MapPage.bind(view);
    if (p[0] === 'find' && global.FindPage) global.FindPage.bind(view);
    if (p[0] === 'data' && global.DataPage) global.DataPage.bind(view);
    if (p[0] === 'mine' && global.WorkPage) global.WorkPage.bind(view);
    if (p[0] === 'plan' && global.PlanPage) global.PlanPage.bind(view);
    if (p[0] === 'cases') {
      var rb = document.getElementById('rerun');
      if (rb) rb.addEventListener('click', render);
      /* 环节切换：写入 URL；点击已选中的环节则取消选择、回到全部 */
      view.querySelectorAll('[data-cs-stage]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-cs-stage');
          var now = (location.hash.match(/stage=([a-z0-9-]+)/i) || [])[1] || 'all';
          location.hash = now === id ? '#/cases' : '#/cases?stage=' + id;
        });
      });
      /* 视图切换：卡片 / 列表，记忆选择 */
      view.querySelectorAll('[data-cs-view]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-cs-view');
          try { localStorage.setItem('csView', v); } catch (e) {}
          var m = location.hash.match(/stage=([a-z0-9-]+)/i);
          location.hash = '#/cases?view=' + v + (m ? '&stage=' + m[1] : '');
        });
      });
    }
    if (p[0] === 'admin' && global.Admin) global.Admin.bind(view);
    document.title = pageTitle(p) + (LANG === 'en' ? ' · Petro × AI Atlas' : ' · 智能化可能性地图');

    /* 语言 = EN 时，整页文本 / 占位符按词条表替换 */
    applyI18n(view);
  }

  function pageTitle(p) {
    if (!p.length) return '总览';
    if (p[0] === 'scene') { var s = A.index.byScene[p[1]]; return s ? s.name : '场景'; }
    if (p[0] === 'stage') { var t = A.index.byStage[p[1]]; return t ? t.name : '环节'; }
    if (p[0] === 'method') return M[p[1]] ? M[p[1]].name : '方法';
    if (p[0] === 'admin') return global.Admin && global.Admin.loggedIn() ? '管理后台' : '管理员登录';
    return { chain: '作业链', map: '介入点图谱', data: '数据资产', cases: '案例库', guide: '接入指南',
      search: '搜索', data: '数据资产', plan: '立项参考', mine: '我的工作区' }[p[0]] || '地图';
  }

  function notFound(msg) {
    return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>' + esc(msg) + '</b>' +
      '检查地址，或<a href="#/" style="color:var(--jade-d)">回到总览</a>。</div></main>';
  }

  window.addEventListener('hashchange', render);
  initPrefs();
  render();
  bindScrollUI();
  bindChainNav();
  bindTips();

  // 启动自检：把注册阶段的异常打到控制台，便于排查
  var probs = Cases.problems();
  if (probs.length) console.warn('[case registry]', probs);

  // 供页面模块（如我的工作区）触发整页重绘
  global.__render = render;

})(window);
