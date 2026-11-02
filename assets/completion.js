/* =========================================================
   completion.js —— 完井模块增强（只作用于完井 20 个场景）
   ---------------------------------------------------------
   环节页 #/stage/completion
     1 工具条：完井内快搜 / 清除筛选 / 导出元数据 JSON / 导出开题模板 MD / 打印讲义
     2 数据依赖视图：完井内部的有向依赖图，可折叠，点节点定位到场景卡片
     3 侧栏配套面板：数据互通矩阵 / 技术栈 / 公开案例丰富度 / 创新度，点任意一项即筛场景
     4 场景行徽标：公开案例丰富度 · 安全敏感 · 不可自动决策 · 创新度
   场景页 #/scene/coN
     5 档案头徽标 + 专业背景里的「风险与工程约束」小栏（含上游依赖）+ 参考方向归集
     6 示范面板：三种典型井工况的参数预设（跨 iframe 的消息桥）
   全站
     7 对比浮层：完井专用推荐对比组，一键载入
   依赖：ATLAS / Cases / COMPLETION_META / Learn（可选）
   ========================================================= */
(function (g) {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function L(zh, en) { return document.documentElement.getAttribute('lang') === 'en' ? (en || zh) : zh; }
  function meta() { return g.COMPLETION_META || null; }
  var PRINT_FLAG = 'atlas.completion.print';

  /* 公开案例丰富度四档（完井专用分层，区别于全站低/中/高难度） */
  var MAT = [
    { k: '仿真', name: '案例极少', en: 'Very few', col: '#BAC6D2', tip: '公开可见的只有论文与仿真算例，尚无现场试验；可研究空间大、可参考经验少' },
    { k: '小试', name: '案例较少', en: 'Few', col: '#3D86BD', tip: '已有单井或单个井组试点的公开报道，验证样本仍很少' },
    { k: '试用', name: '案例若干', en: 'Some', col: '#238868', tip: '进入多井组试用的公开实践，工程口径与数据格式基本成型' },
    { k: '常态', name: '案例较多', en: 'Many', col: '#1A4779', tip: '公开实践已常见，选题多为复现、提效与工程化，空白较少' }
  ];
  /* 创新度三档：按公开报道 / 可检索案例的多寡粗分 */
  var INN = [
    { k: '高', name: '高创新', en: 'Novel', col: '#725994', tip: '公开案例极少，容易做出新意；可参考的资料也少' },
    { k: '中', name: '中等', en: 'Moderate', col: '#1A4779', tip: '已有一定公开工作，需要找差异化切入点' },
    { k: '成熟', name: '成熟', en: 'Established', col: '#5B6B7C', tip: '公开报道多，适合复现类或工程落地型题目' }
  ];
  function pick(arr, k) { for (var i = 0; i < arr.length; i++) if (arr[i].k === k) return arr[i]; return arr[arr.length - 1]; }

  /* ---------------- 场景数据访问 ---------------- */
  function ready() { return !!(g.ATLAS && g.ATLAS.index && g.ATLAS.index.byStage && meta()); }
  /* 注意：ATLAS.index.byStage.completion 是「环节对象本体」，场景数组在 .scenes 上 */
  function coScenes() {
    var st = g.ATLAS.index.byStage.completion;
    return (st && st.scenes) || [];
  }
  function scene(id) { return g.ATLAS.index.byId[id]; }
  function metaOf(id) {
    var m = meta();
    if (!m) return {};
    return (typeof m[id] === 'object' && m[id] && m[id].deps) ? m[id] : {};
  }
  function idNum(id) { return String(id).replace(/^co/i, ''); }
  function casesOf(id) { return g.Cases ? g.Cases.bySceneAll(id) : []; }

  /* ---------------- 列表行访问 ---------------- */
  function rowEls() {
    var list = document.getElementById('scene-list');
    return list ? [].slice.call(list.querySelectorAll('a.scene-row')) : [];
  }
  function rowId(row) {
    var m = (row.getAttribute('href') || '').match(/(co\d+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  /* =========================================================
     环节页筛选：统一状态 + 统一应用
     用 class 隐藏（不与 shell 自己的 display 内联样式互相覆盖），
     所以方法 / 难度筛选与这里的筛选天然是「与」的关系。
     ========================================================= */
  var F = { q: '', m: '', mat: '', innov: '', dt: '' };

  function rowVisible(id) {
    var sc = scene(id);
    if (!sc) return false;
    /* chips 是抽象主题词：经同义扩展表展开后再匹配（如「配产」→ 投产/举升/复产…） */
    var words = (g.STAGE_META && g.STAGE_META.kwExpand) ? g.STAGE_META.kwExpand(F.q) : [F.q];
    var okQ = !F.q || words.some(function (w) { return rowText(id).toLowerCase().indexOf(w.toLowerCase()) >= 0; });
    var okM = !F.m || (sc.methods || []).indexOf(F.m) >= 0;
    var okMat = !F.mat || sc.maturity === F.mat;
    var okIn = !F.innov || sc.innov === F.innov;
    var okDt = !F.dt || (((meta().matrix.cells[F.dt] || {})[id]) || 0) > 0;
    return okQ && okM && okMat && okIn && okDt;
  }
  var rowTextCache = {};
  function rowText(id) {
    if (rowTextCache[id] === undefined) {
      var sc = scene(id) || {};
      var parts = [sc.name, sc.point, sc.intro, id].concat(sc.methods || [], sc.refs || []);
      var el = document.querySelector('#scene-list a.scene-row[href="#/scene/' + id + '"]');
      if (el) parts.push(el.textContent);
      rowTextCache[id] = parts.join(' ');
    }
    return rowTextCache[id];
  }
  function applyFilter() {
    rowEls().forEach(function (row) {
      var id = rowId(row);
      row.classList.toggle('cpt-hide', id ? !rowVisible(id) : false);
    });
    /* 依赖图联动：命中节点全亮；连线只保留与命中节点相连的（对端邻居淡化保留）；
       与命中节点无关的节点和连线全部隐藏 */
    var show = {}, near = {};
    rowEls().forEach(function (row) {
      var id = rowId(row);
      if (id && rowVisible(id)) show[id] = 1;
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-edge]'), function (p) {
      var rel = p.getAttribute('data-cpt-edge').split('>');
      var up = rel[0].toLowerCase(), dn = rel[1].toLowerCase();
      var hit = !F.q || show[up] || show[dn];
      p.style.display = hit ? '' : 'none';
      p.classList.toggle('on', F.q && hit);
      p.setAttribute('marker-end', hit ? 'url(#cpt-ar-on)' : 'url(#cpt-ar)');
      p.setAttribute('stroke', hit ? '#1A4779' : '#8FA6BA');
      if (F.q && hit) { if (!show[up]) near[up] = 1; if (!show[dn]) near[dn] = 1; }
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-node]'), function (n) {
      var id = (n.getAttribute('data-cpt-node') || '').toLowerCase();
      var vis = !F.q || show[id] || near[id];
      n.style.display = vis ? '' : 'none';
      n.classList.toggle('cpt-dep-off', !!near[id] && !show[id]);
    });
    syncCount();
    syncControls();
  }
  function syncCount() {
    var n = rowEls().filter(function (r) { return !r.classList.contains('cpt-hide'); }).length;
    var c = document.getElementById('f-count');
    if (c) c.textContent = n + ' ' + L('个场景', 'scenes');
    var c2 = document.querySelector('[data-cpt="count"]');
    if (c2) c2.textContent = n + ' ' + L('个场景', 'scenes');
    var tip = document.querySelector('[data-cpt="filter-tip"]');
    if (tip) tip.textContent = activeLabel();
  }
  function activeLabel() {
    var bits = [];
    if (F.q) bits.push('检索「' + F.q + '」');
    if (F.m) bits.push(L('方法', 'Method') + '：' + mName(F.m));
    if (F.mat) bits.push(pick(MAT, F.mat).name);
    if (F.innov) bits.push(pick(INN, F.innov).name);
    if (F.dt) bits.push(L('数据：', 'Data: ') + dtName(F.dt));
    return bits.length ? L('已选：', 'Filter: ') + bits.join(' · ') : L('未叠加完井专项筛选', 'No completion-specific filter');
  }
  function mName(k) {
    var M2 = g.ATLAS.methods || {};
    return (M2[k] && M2[k].name) || k;
  }
  function dtName(k) {
    var ts = meta().matrix.types;
    for (var i = 0; i < ts.length; i++) if (ts[i].k === k) return ts[i].name;
    return k;
  }
  function resetFilter() {
    F.q = ''; F.m = ''; F.mat = ''; F.innov = ''; F.dt = '';
    var inp = document.querySelector('[data-cpt="q"]');
    if (inp) inp.value = '';
    applyFilter();
  }
  function syncControls() {
    [].forEach.call(document.querySelectorAll('[data-cpt-kw]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cpt-kw') === F.q);
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-mat]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cpt-mat') === F.mat);
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-inn]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cpt-inn') === F.innov);
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-dt]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cpt-dt') === F.dt);
    });
    [].forEach.call(document.querySelectorAll('[data-cpt-m]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-cpt-m') === F.m);
    });
    var clr = document.querySelector('[data-cpt="clear"]');
    if (clr) clr.disabled = !(F.q || F.m || F.mat || F.innov || F.dt);
  }

  /* =========================================================
     1. 环节页：完井专项工具条
     ========================================================= */
  var KW = ['防砂', '压裂', '管柱', '配产', '试井', '腐蚀', '滑套', '监测', '完整性', '弃井'];
  function injectTools() {
    var head = document.querySelector('.page-head');
    if (!head || document.querySelector('[data-cpt="tools"]')) return;
    var bar = document.createElement('div');
    bar.className = 'cpt-tools';
    bar.setAttribute('data-cpt', 'tools');
    bar.innerHTML =
      '<div class="cpt-t-row">' +
      '<div class="cpt-search">' +
      '<input type="search" data-cpt="q" placeholder="' + esc(L('在完井 20 个场景内检索：名称 / 介入点 / 参考方向…', 'Search within the 20 completion scenes')) + '">' +
      '<div class="cpt-kws">' + KW.map(function (k) {
        var words = (g.STAGE_META && g.STAGE_META.kwExpand) ? g.STAGE_META.kwExpand(k) : [k];
        var n = coScenes().filter(function (sc) {
          var txt = [sc.name, sc.point, sc.intro, (sc.methods || []).join(' '), (sc.refs || []).join(' ')].join(' ').toLowerCase();
          return words.some(function (w) { return txt.indexOf(w.toLowerCase()) >= 0; });
        }).length;
        return '<button type="button" class="cpt-kw" data-cpt-kw="' + esc(k) + '" title="' + esc('筛选含「' + k + '」相关内容的 ' + n + ' 个场景') + '">' + esc(k) + '<b>' + n + '</b></button>';
      }).join('') + '</div></div>' +
      '<div class="cpt-t-acts">' +
      '<button type="button" class="btn sm ghost" data-cpt="clear">' + esc(L('清除筛选', 'Clear filters')) + '</button>' +
      '<button type="button" class="btn sm ghost" data-cpt="exp">' + esc(L('导出 20 场景元数据（JSON）', 'Export 20 scenes (JSON)')) + '</button>' +
      '<button type="button" class="btn sm ghost" data-cpt="md">' + esc(L('导出开题说明模板（MD）', 'Export proposal template (MD)')) + '</button>' +
      '<button type="button" class="btn sm" data-cpt="print">' + esc(L('打印完井讲义', 'Print handout')) + '</button>' +
      '</div></div>' +
      '<div class="cpt-t-foot">' +
      '<span class="cpt-tip" data-cpt="filter-tip"></span>' +
      '<b class="cpt-count" data-cpt="count"></b>' +
      '<label class="cpt-ck"><input type="checkbox" data-cpt="printmode">' +
      esc(L('Ctrl+P 时输出「完井 20 场景讲义」而不是本页', 'Ctrl+P prints the completion handout instead of this page')) + '</label>' +
      '</div>';
    head.parentNode.insertBefore(bar, head.nextSibling);

    bar.addEventListener('input', function (e) {
      if (!e.target.matches('[data-cpt="q"]')) return;
      F.q = e.target.value.trim().toLowerCase();
      applyFilter();
    });
    bar.addEventListener('change', function (e) {
      if (!e.target.matches('[data-cpt="printmode"]')) return;
      try { localStorage.setItem(PRINT_FLAG, e.target.checked ? '1' : '0'); } catch (err) { }
    });
    bar.addEventListener('click', function (e) {
      var kw = e.target.closest('[data-cpt-kw]');
      if (kw) {
        var v = kw.getAttribute('data-cpt-kw');
        var input = bar.querySelector('[data-cpt="q"]');
        if (F.q === v.toLowerCase()) { F.q = ''; input.value = ''; }
        else { F.q = v.toLowerCase(); input.value = v; }
        applyFilter();
        return;
      }
      if (e.target.closest('[data-cpt="clear"]')) { resetFilter(); return; }
      if (e.target.closest('[data-cpt="exp"]')) { exportJSON(); return; }
      if (e.target.closest('[data-cpt="md"]')) { exportMD(); return; }
      if (e.target.closest('[data-cpt="print"]')) { printHandout(); return; }
    });
    var ck = bar.querySelector('[data-cpt="printmode"]');
    var saved = '0';
    try { saved = localStorage.getItem(PRINT_FLAG) || '0'; } catch (err) { }
    ck.checked = saved === '1';
  }

  /* =========================================================
     2. 环节页：数据依赖视图（完井内部）
     ========================================================= */
  function depDepth() {
    var M = meta(), depth = {};
    function d(id, seen) {
      if (depth[id] !== undefined) return depth[id];
      if (seen.indexOf(id) >= 0) return 0;
      seen.push(id);
      var deps = (metaOf(id).deps) || [];
      depth[id] = deps.length ? 1 + Math.max.apply(null, deps.map(function (x) { return d(x, seen.slice()); })) : 0;
      return depth[id];
    }
    coScenes().forEach(function (s) { d(s.id, []); });
    return depth;
  }

  function depViewHTML() {
    var ids = coScenes().map(function (s) { return s.id; });
    var depth = depDepth();
    var maxD = Math.max.apply(null, ids.map(function (i) { return depth[i] || 0; }));

    var nodeW = 152, nodeH = 44, colW = 196, rowH = 54, padX = 16, padY = 30;
    var layers = [];
    for (var l = 0; l <= maxD; l++) layers.push([]);
    ids.forEach(function (id) { layers[depth[id] || 0].push(id); });
    layers.forEach(function (arr) { arr.sort(function (a, b) { return +idNum(a) - +idNum(b); }); });

    var pos = {};
    layers.forEach(function (arr, li) {
      arr.forEach(function (id, i) { pos[id] = { x: padX + li * colW, y: padY + i * rowH }; });
    });
    var rows = Math.max.apply(null, layers.map(function (a) { return a.length; }));
    var W = padX * 2 + (maxD + 1) * colW, H = padY + rows * rowH + 14;

    var s = '<svg class="cpt-dep-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(L('完井场景数据依赖图', 'Completion data-dependency graph')) + '">';
    s += '<defs><marker id="cpt-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#8FA6BA"/></marker>' +
      '<marker id="cpt-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#1A4779"/></marker></defs>';

    /* 边：上游 → 下游 */
    ids.forEach(function (id) {
      var deps = metaOf(id).deps || [];
      deps.forEach(function (up) {
        if (!pos[id] || !pos[up]) return;
        var x1 = pos[up].x + nodeW, y1 = pos[up].y + nodeH / 2;
        var x2 = pos[id].x, y2 = pos[id].y + nodeH / 2;
        s += '<path class="cpt-dep-edge" data-cpt-edge="' + up + '>' + id + '" d="M' + x1 + ' ' + y1 +
          ' C ' + (x1 + 40) + ' ' + y1 + ', ' + (x2 - 40) + ' ' + y2 + ', ' + x2 + ' ' + y2 +
          '" fill="none" stroke="#8FA6BA" stroke-width="1.3" marker-end="url(#cpt-ar)"/>';
      });
    });

    /* 节点 */
    ids.forEach(function (id) {
      var p = pos[id], sc = scene(id), m = metaOf(id);
      var name = sc ? sc.name : id;
      var short = name.length > 9 ? name.slice(0, 8) + '…' : name;
      var up = (m.deps || []).length;
      var mat = sc && sc.maturity ? pick(MAT, sc.maturity) : null;
      s += '<g class="cpt-dep-node" data-cpt-node="' + id + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(name + '（' + id.toUpperCase() + '）') + '">' +
        '<title>' + esc(name + ' · ' + id.toUpperCase() + (up ? ' · 需要 ' + up + ' 项上游输出' : ' · 无上游依赖')) + '</title>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + nodeW + '" height="' + nodeH + '" rx="4" fill="#fff" stroke="#C3D1DF"/>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="3.5" height="' + nodeH + '" fill="' + (mat ? mat.col : '#1A4779') + '"/>' +
        '<text x="' + (p.x + 11) + '" y="' + (p.y + 19) + '" font-size="10.5" font-weight="600" fill="#222B38">' + esc(short) + '</text>' +
        '<text x="' + (p.x + 11) + '" y="' + (p.y + 34) + '" font-size="8.5" font-family="ui-monospace,Consolas,monospace" fill="#718096">' +
        esc(id.toUpperCase() + (up ? ' · 上游 ' + up : ' · 起点')) + '</text>' +
        '</g>';
    });
    s += '</svg>';
    return s;
  }

  function injectDepView() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-cpt="dep"]')) return;
    var filters = main.querySelector('.filters');
    if (!filters) return;
    var box = document.createElement('div');
    box.className = 'cpt-dep';
    box.setAttribute('data-cpt', 'dep');
    box.innerHTML =
      '<div class="cpt-dep-head"><span class="cpt-dep-t">' + esc(L('完井场景数据依赖图', 'Completion data-dependency graph')) + '</span>' +
      '<span class="cpt-dep-s">' + esc(L('箭头 = 左端场景需要右端场景的输出；点节点可定位到下方场景卡片',
        'Arrows point from an upstream scene to the scene that consumes its output; click a node to locate the card below')) + '</span></div>' +
      '<div class="cpt-dep-body fold">' + depViewHTML() +
      '<div class="cpt-dep-legend">' +
      '<span><i style="background:#BAC6D2"></i>' + esc(pick(MAT, '仿真').name) + '</span>' +
      '<span><i style="background:#3D86BD"></i>' + esc(pick(MAT, '小试').name) + '</span>' +
      '<span><i style="background:#238868"></i>' + esc(pick(MAT, '试用').name) + '</span>' +
      '<span><i style="background:#1A4779"></i>' + esc(pick(MAT, '常态').name) + '</span>' +
      '<span class="cpt-dep-hint">' + esc(L('节点左侧色条 = 公开案例丰富度分层；根节点（无上游）适合作为首个题目',
        'Left bar = maturity tier; root nodes (no upstream) suit a first project')) + '</span>' +
      '</div></div>' +
      '<div class="cpt-dep-foot"><button type="button" class="cpt-dep-toggle" data-cpt="dep-toggle" ' +
      'aria-expanded="false"><span class="cpt-dep-tx">' + esc(L('展开全部', 'Expand all')) +
      '</span><i class="cpt-dep-ar">▾</i></button></div>';
    main.insertBefore(box, filters);

    /* 底部居中切换按钮：收起态显示前三行 + 渐隐，展开显示全部 */
    var tog = box.querySelector('[data-cpt="dep-toggle"]');
    var body = box.querySelector('.cpt-dep-body');
    tog.addEventListener('click', function () {
      var open = !body.classList.contains('fold');
      body.classList.toggle('fold', open);
      tog.setAttribute('aria-expanded', String(!open));
      box.querySelector('.cpt-dep-tx').textContent = open
        ? L('展开全部', 'Expand all')
        : L('收起', 'Collapse');
      box.querySelector('.cpt-dep-ar').textContent = open ? '▾' : '▴';
      if (!open) {
        try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (e) { box.scrollIntoView(); }
      }
    });

    box.addEventListener('click', function (e) {
      var node = e.target.closest('[data-cpt-node]');
      if (!node) return;
      selectNode(node.getAttribute('data-cpt-node'), box);
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target.closest('[data-cpt-node]');
      if (!node) return;
      e.preventDefault();
      selectNode(node.getAttribute('data-cpt-node'), box);
    });
  }

  function selectNode(id, box) {
    [].forEach.call(box.querySelectorAll('.cpt-dep-node'), function (n) {
      n.classList.toggle('sel', n.getAttribute('data-cpt-node') === id);
    });
    [].forEach.call(box.querySelectorAll('.cpt-dep-edge'), function (p) {
      var rel = p.getAttribute('data-cpt-edge').split('>');
      var hit = rel[0] === id || rel[1] === id;
      p.classList.toggle('on', hit);
      p.setAttribute('marker-end', hit ? 'url(#cpt-ar-on)' : 'url(#cpt-ar)');
      p.setAttribute('stroke', hit ? '#1A4779' : '#8FA6BA');
    });
    jumpToRow(id);
  }

  function jumpToRow(id) {
    var row = rowEls().filter(function (r) { return rowId(r) === id; })[0];
    if (!row) return;
    row.classList.remove('cpt-hide');
    var top = row.getBoundingClientRect().top + (g.pageYOffset || 0) - 120;
    try { g.scrollTo({ top: top, behavior: 'smooth' }); }
    catch (e) { g.scrollTo(0, top); }
    row.classList.add('flash');
    setTimeout(function () { row.classList.remove('flash'); }, 1600);
  }

  /* =========================================================
     3. 环节页：公开案例丰富度分层条（与筛选联动）
     ========================================================= */
  /* =========================================================
     3. 环节页：分层筛选已并入右侧配套面板，这里只留引导提示
     ========================================================= */
  function injectMaturityStrip() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-cpt="strip"]')) return;
    var filters = main.querySelector('.filters');
    if (!filters) return;
    var strip = document.createElement('div');
    strip.className = 'cpt-strip cpt-strip-tip';
    strip.setAttribute('data-cpt', 'strip');
    strip.innerHTML =
      '<span class="cpt-tip-ic">i</span>' +
      esc(L('按「公开案例丰富度 / 创新度」筛选：用右上角「完井配套」面板——点「公开案例丰富度」或「创新度」标签里的任意一档即可。',
        'Maturity / novelty filters live in the COMPANION panel on the right — click any tier to filter the scenes below.'));
    main.insertBefore(strip, filters);
  }

  /* =========================================================
     4. 环节页：侧栏配套面板（矩阵 / 技术栈 / 公开案例丰富度 / 创新度）
     ========================================================= */
  function buildStageShell() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-cpt="layout"]')) return;
    var filters = main.querySelector('.filters');
    var list = document.getElementById('scene-list');
    if (!filters || !list) return;
    var pager = main.querySelector('.pager');

    /* 方法/难度/只看收藏工具条已删除：方法筛选在右栏「技术栈」，计数在完井工具条 */
    var layout = document.createElement('div');
    layout.className = 'cpt-layout';
    layout.setAttribute('data-cpt', 'layout');
    var col = document.createElement('div');
    col.className = 'cpt-main';
    layout.appendChild(col);
    main.insertBefore(layout, filters); /* filters 此时仍作锚点 */
    filters.remove();
    col.appendChild(list);
    if (pager) col.appendChild(pager);
    layout.appendChild(sideHTML());
  }

  function sideHTML() {
    var aside = document.createElement('aside');
    aside.className = 'cpt-side';
    aside.setAttribute('data-cpt', 'side');
    aside.innerHTML =
      '<div class="pnl">' +
      '<div class="pnl-h"><span class="mono">COMPLETION COMPANION · 完井配套</span></div>' +
      '<div class="pnl-tabs">' +
      '<button type="button" class="pnl-tab on" data-cpt-tab="matrix">' + esc(L('数据矩阵', 'Data matrix')) + '</button>' +
      '<button type="button" class="pnl-tab" data-cpt-tab="tech">' + esc(L('技术栈', 'Methods')) + '</button>' +
      '<button type="button" class="pnl-tab" data-cpt-tab="mature">' + esc(L('公开案例丰富度', 'Maturity')) + '</button>' +
      '<button type="button" class="pnl-tab" data-cpt-tab="innov">' + esc(L('创新度', 'Novelty')) + '</button>' +
      '</div>' +
      '<div class="pnl-b" data-cpt-pane="matrix">' + matrixHTML() + '</div>' +
      '<div class="pnl-b" data-cpt-pane="tech" hidden>' + techHTML() + '</div>' +
      '<div class="pnl-b" data-cpt-pane="mature" hidden>' + tierHTML() + '</div>' +
      '<div class="pnl-b" data-cpt-pane="innov" hidden>' + innovHTML() + '</div>' +
      '</div>';

    aside.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-cpt-tab]');
      if (tab) {
        [].forEach.call(aside.querySelectorAll('.pnl-tab'), function (b) { b.classList.toggle('on', b === tab); });
        var key = tab.getAttribute('data-cpt-tab');
        [].forEach.call(aside.querySelectorAll('[data-cpt-pane]'), function (p) {
          p.hidden = p.getAttribute('data-cpt-pane') !== key;
        });
        return;
      }
      var dt = e.target.closest('[data-cpt-dt]');
      if (dt) { toggle('dt', dt.getAttribute('data-cpt-dt')); return; }
      var mm = e.target.closest('[data-cpt-m]');
      if (mm) { toggle('m', mm.getAttribute('data-cpt-m')); return; }
      var mt = e.target.closest('[data-cpt-mat]');
      if (mt) { toggle('mat', mt.getAttribute('data-cpt-mat')); return; }
      var iv = e.target.closest('[data-cpt-inn]');
      if (iv) { toggle('innov', iv.getAttribute('data-cpt-inn')); return; }
    });
    return aside;
  }
  function toggle(key, val) {
    F[key] = (F[key] === val) ? '' : val;
    applyFilter();
  }

  function matrixHTML() {
    var M = meta(), types = M.matrix.types, ids = coScenes().map(function (s) { return s.id; });
    var head = '<thead><tr><th>' + esc(L('数据类型', 'Data type')) + '</th>' +
      ids.map(function (id) {
        var sc = scene(id);
        return '<th title="' + esc(sc ? sc.name : id) + '">' + idNum(id) + '</th>';
      }).join('') + '</tr></thead>';
    var rows = types.map(function (ty) {
      var cells = M.matrix.cells[ty.k] || {};
      var need = ids.filter(function (id) { return cells[id] === 2; }).length;
      var opt = ids.filter(function (id) { return cells[id] === 1; }).length;
      return '<tr data-cpt-dt="' + ty.k + '" title="' + esc(L('点此筛选出使用该数据的完井场景', 'Click to filter completion scenes using this data')) + '">' +
        '<td class="cpt-mat-n"><span>' + esc(ty.name) + '</span><b>' + need + (opt ? '+' + opt : '') + '</b></td>' +
        ids.map(function (id) {
          var v = cells[id] || 0;
          var c = v === 2 ? 'on' : v === 1 ? 'opt' : '';
          return '<td class="' + c + '">' + (v === 2 ? '●' : v === 1 ? '○' : '·') + '</td>';
        }).join('') + '</tr>';
    }).join('');
    return '<div class="cpt-mat-hint">' +
      esc(L('● 需要 · ○ 可选 · 点数据类型所在行，筛选出用到它的完井场景',
        '● required · ○ optional · click a data row to filter scenes using it')) + '</div>' +
      '<div class="cpt-mat-wrap"><table class="cpt-mat">' + head + '<tbody>' + rows + '</tbody></table></div>' +
      '<div class="pnl-note">' + esc(L('同一份数据集常能覆盖多个完井场景：先看这一行都为 ● 的场景，往往可以共用一套数据做一组题目。',
        'One dataset often covers several scenes: look for rows full of ● — those scenes can share the same data.')) + '</div>';
  }

  function techHTML() {
    var counts = {}, order = [];
    coScenes().forEach(function (s) {
      (s.methods || []).forEach(function (k) {
        if (counts[k] === undefined) { counts[k] = 0; order.push(k); }
        counts[k]++;
      });
    });
    return '<div class="cpt-mat-hint">' + esc(L('完井 20 个场景的方法构成，点任一标签筛选场景',
      'Method mix of the 20 completion scenes; click a chip to filter')) + '</div>' +
      '<div class="cpt-slist">' + order.map(function (k) {
        return '<button type="button" class="cpt-srow" data-cpt-m="' + k + '">' +
          '<span class="mtag" data-m="' + k + '"><b>' + esc(methodAbbr(k)) + '</b>' + esc(mName(k)) + '</span>' +
          '<b>' + counts[k] + '</b></button>';
      }).join('') + '</div>' +
      '<div class="pnl-note">' + esc(L('方法标签与全站一致；这里的计数只统计完井环节。',
        'Same method taxonomy as the rest of the site; the counts here cover the completion stage only.')) + '</div>';
  }
  function methodAbbr(k) {
    var M2 = g.ATLAS.methods || {};
    return (M2[k] && M2[k].abbr) || k.slice(0, 2).toUpperCase();
  }

  function tierHTML() {
    return '<div class="cpt-mat-hint cpt-mat-hint-lead">' + esc(L('点击下面任意一档，即可筛选左侧场景列表', 'Click any tier to filter the scene list')) + '</div>' +
      '<div class="cpt-mat-hint">' + esc(meta().maturityNote || '') + '</div>' +
      '<div class="cpt-slist">' + MAT.map(function (m) {
        var ids = coScenes().filter(function (s) { return s.maturity === m.k; });
        return '<button type="button" class="cpt-srow" data-cpt-mat="' + m.k + '">' +
          '<span><i class="cpt-dot" style="background:' + m.col + '"></i>' + esc(m.name) + '</span><b>' + ids.length + '</b></button>' +
          '<div class="cpt-srow-sub">' + esc(ids.slice(0, 3).map(function (s) { return s.name; }).join('、') || '—') +
          (ids.length > 3 ? ' …' : '') + '</div>';
      }).join('') + '</div>';
  }

  function innovHTML() {
    return '<div class="cpt-mat-hint cpt-mat-hint-lead">' + esc(L('点击下面任意一档，即可筛选左侧场景列表', 'Click any tier to filter the scene list')) + '</div>' +
      '<div class="cpt-mat-hint">' + esc(meta().innovNote || '') + '</div>' +
      '<div class="cpt-slist">' + INN.map(function (n) {
        var ids = coScenes().filter(function (s) { return (s.innov || '中') === n.k; });
        return '<button type="button" class="cpt-srow" data-cpt-inn="' + n.k + '">' +
          '<span><i class="cpt-dot" style="background:' + n.col + '"></i>' + esc(n.name) + '</span><b>' + ids.length + '</b></button>' +
          '<div class="cpt-srow-sub">' + esc(ids.slice(0, 3).map(function (s) { return s.name; }).join('、') || '—') +
          (ids.length > 3 ? ' …' : '') + '</div>';
      }).join('') + '</div>';
  }

  /* =========================================================
     5. 场景行徽标
     ========================================================= */
  function injectRowBadges() {
    rowEls().forEach(function (row) {
      var id = rowId(row);
      if (!id || row.querySelector('[data-cpt="badge"]')) return;
      var sc = scene(id), right = row.querySelector('.sr-right');
      if (!sc || !right) return;
      var html = '';
      var mat = pick(MAT, sc.maturity);
      html += '<span class="cpt-tg" data-cpt="badge" style="--c:' + mat.col + '" title="' + esc(mat.name + '：' + mat.tip) + '">' +
        '<i></i>' + esc(mat.k) + '</span>';
      var inn = pick(INN, sc.innov);
      html += '<span class="cpt-tg solid" data-cpt="badge" style="--c:' + inn.col + '" title="' + esc(inn.name + '：' + inn.tip) + '">' +
        esc(inn.name) + '</span>';
      (metaOf(id).badges || []).forEach(function (b) {
        html += '<span class="cpt-tg warn" data-cpt="badge">' + esc(b) + '</span>';
      });
      right.insertAdjacentHTML('afterbegin', html);
    });
  }

  /* =========================================================
     6. 场景页：徽标 / 风险与约束 / 参考方向归集
     ========================================================= */
  function sceneIdOfHash() {
    var m = (g.location.hash || '').match(/#\/scene\/(co\d+)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function injectSceneHead() {
    var sid = sceneIdOfHash();
    if (!sid || document.querySelector('[data-cpt="dh-badge"]')) return;
    var tags = document.querySelector('.dh-tags');
    var sc = scene(sid);
    if (!sc || !tags) return;
    var mat = pick(MAT, sc.maturity), inn = pick(INN, sc.innov);
    var html = '<span class="cpt-tg" style="--c:' + mat.col + '" data-cpt="dh-badge" title="' + esc(mat.name) + '">' +
      '<i></i>' + esc(mat.name) + '</span>' +
      '<span class="cpt-tg solid" style="--c:' + inn.col + '" data-cpt="dh-badge" title="' + esc(inn.tip) + '">' +
      esc(L('创新度·', 'Novelty: ') + inn.name) + '</span>';
    (metaOf(sid).badges || []).forEach(function (b) {
      html += '<span class="cpt-tg warn" data-cpt="dh-badge">' + esc(b) + '</span>';
    });
    tags.insertAdjacentHTML('beforeend', html);
  }

  function injectRiskPanel() {
    var sid = sceneIdOfHash();
    if (!sid) return;
    var panel = document.querySelector('.panel[data-panel="bg"]');
    if (!panel || panel.querySelector('[data-cpt="risk"]')) return;
    var m = metaOf(sid);
    if (!m.risk) return;

    var blocks = [].slice.call(panel.children).filter(function (el) { return el.classList.contains('sec4'); });
    var box = document.createElement('div');
    box.className = 'cpt-risk';
    box.setAttribute('data-cpt', 'risk');
    var deps = (m.deps || []).map(function (d) {
      var sc = scene(d);
      return '<a class="cpt-dep-chip" href="#/scene/' + d + '">' + esc(sc ? sc.name : d) + '</a>';
    }).join('') || '<span class="muted">' + esc(L('无上游依赖，可直接从本场景切入', 'No upstream scene needed')) + '</span>';

    box.innerHTML =
      '<div class="cpt-risk-h">' +
      '<span class="cpt-risk-t">' + esc(L('风险与工程约束', 'Risks & engineering constraints')) + '</span>' +
      (m.badges || []).map(function (b) { return '<span class="cpt-tg warn">' + esc(b) + '</span>'; }).join('') +
      '</div>' +
      '<div class="cpt-risk-body">' +
      '<div class="cpt-risk-row"><span class="rk">' + esc(L('工程约束', 'Engineering')) + '</span><span class="rv">' + esc(m.risk.eng) + '</span></div>' +
      '<div class="cpt-risk-row"><span class="rk">' + esc(L('算法落地风险', 'AI risk')) + '</span><span class="rv">' + esc(m.risk.ai) + '</span></div>' +
      '<div class="cpt-risk-row"><span class="rk">' + esc(L('上游依赖', 'Depends on')) + '</span><span class="rv cpt-dep-list">' + deps + '</span></div>' +
      '</div>' +
      '<div class="cpt-risk-note">' + esc(L('完井属于强监管环节：模型输出只能作为工程师的参考依据，不能直接下发作业指令。',
        'Completion is heavily regulated: model output may inform engineers, never issue work orders directly.')) + '</div>';

    if (blocks.length > 2) panel.insertBefore(box, blocks[2]);
    else panel.appendChild(box);
  }

  function injectPapers() {
    var sid = sceneIdOfHash();
    if (!sid) return;
    var panel = document.querySelector('.panel[data-panel="bg"]');
    if (!panel || panel.querySelector('[data-cpt="papers"]')) return;
    var sc = scene(sid);
    var items = (meta().papers || {})[sid] || [];
    var rows = (sc.refs || []).map(function (r) { return '<li><span class="cpt-p-tag">' + esc(L('参考方向', 'Topic')) + '</span>' + esc(r) + '</li>'; });
    items.forEach(function (p) {
      var t = esc(p.t) + (p.d ? '　<span class="muted">' + esc(p.d) + '</span>' : '');
      rows.push('<li><span class="cpt-p-tag">' + esc(L('归集', 'Source')) + '</span>' +
        (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + t + '</a>' : t) + '</li>');
    });
    if (!rows.length) return;
    var det = document.createElement('details');
    det.className = 'cpt-papers';
    det.setAttribute('data-cpt', 'papers');
    det.innerHTML = '<summary>' + esc(L('参考文献与参考方向归集', 'References & reading list')) +
      '<span class="cpt-papers-n">' + rows.length + '</span></summary><ul>' + rows.join('') + '</ul>';
    panel.appendChild(det);
  }

  /* =========================================================
     7. 示范面板：典型井工况参数预设（跨 iframe 消息桥）
     ========================================================= */
  var BRIDGE =
    '<script>(function(){function apply(vals){var rs=document.querySelectorAll("input[type=range]");' +
    'for(var i=0;i<vals.length&&i<rs.length;i++){var r=rs[i],v=Number(vals[i]);if(isNaN(v))continue;' +
    'r.value=v;try{r.dispatchEvent(new Event("input",{bubbles:true}));r.dispatchEvent(new Event("change",{bubbles:true}))}catch(e){}}' +
    'try{parent.postMessage({__cptPreset:1,n:rs.length},"*")}catch(e){}}' +
    'window.addEventListener("message",function(e){var d=e.data||{};' +
    'if(d&&d.__cptApply&&Array.isArray(d.values))apply(d.values)});' +
    'try{parent.postMessage({__cptReady:1},"*")}catch(e){}})();<\/script>';

  function patchSrcdoc() {
    try {
      var d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
      if (!d || !d.set) return;
      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        configurable: true,
        get: d.get,
        set: function (v) {
          var html = String(v == null ? '' : v);
          if (html.indexOf('__cptApply') < 0) {
            if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, BRIDGE + '</body>');
            else html += BRIDGE;
          }
          d.set.call(this, html);
        }
      });
    } catch (e) { /* 老浏览器不支持时退回主控另行处理 */ }
  }

  function injectSandbox() {
    var sid = sceneIdOfHash();
    if (!sid) return;
    var panel = document.querySelector('.panel[data-panel="demo"]');
    if (!panel || !panel.classList.contains('on')) return;
    if (panel.querySelector('[data-cpt="sandbox"]')) return;
    var sb = (meta().sandbox || {})[sid];
    if (!sb) return;
    var bar = document.createElement('div');
    bar.className = 'cpt-sandbox';
    bar.setAttribute('data-cpt', 'sandbox');
    bar.innerHTML = '<span class="cpt-sb-l">' + esc(L('典型井工况预设', 'Well presets')) + '</span>' +
      ['normal', 'hp', 'sand'].map(function (k) {
        var lab = (meta().sandboxLabels || {})[k] || {};
        return '<button type="button" class="cpt-sb-btn" data-cpt-sb="' + k + '" title="' + esc(lab.d || '') + '">' +
          esc(lab.t || k) + '</button>';
      }).join('') +
      '<span class="cpt-sb-tip" data-cpt-sb-tip>' + esc(L('切换后立即把这套基准参数灌进下面的滑杆',
        'Switching loads the baseline parameters into the sliders below')) + '</span>';
    var root = panel.querySelector('#case-demo-root') || panel.firstChild;
    panel.insertBefore(bar, root);

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cpt-sb]');
      if (!b) return;
      var vals = sb[b.getAttribute('data-cpt-sb')];
      [].forEach.call(bar.querySelectorAll('.cpt-sb-btn'), function (x) { x.classList.toggle('on', x === b); });
      var tipEl = bar.querySelector('[data-cpt-sb-tip]');
      var lab = (meta().sandboxLabels || {})[b.getAttribute('data-cpt-sb')] || {};
      if (tipEl) tipEl.textContent = L('已套用：', 'Applied: ') + (lab.t || '');
      postPreset(vals);
    });
  }

  function postPreset(vals) {
    var root = document.getElementById('case-demo-root');
    if (!root) return;
    var frame = root.querySelector('iframe');
    if (!frame || !frame.contentWindow) return;
    var send = function () {
      try { frame.contentWindow.postMessage({ __cptApply: 1, values: vals }, '*'); } catch (e) { }
    };
    [0, 150, 450, 1000].forEach(function (t) { setTimeout(send, t); });
  }

  /* =========================================================
     8. 对比浮层：完井推荐对比组
     ========================================================= */
  function injectComparePresets() {
    if (!g.Learn || !g.Learn.setCompare) return;
    var ov = document.querySelector('.cmp-ov');
    if (!ov || ov.hidden) return;
    var f = ov.querySelector('.cmp-f');
    if (!f || f.querySelector('[data-cpt="presets"]')) return;
    var presets = (meta().comparePresets || []);
    if (!presets.length) return;
    var span = document.createElement('span');
    span.className = 'cpt-presets';
    span.setAttribute('data-cpt', 'presets');
    span.innerHTML = '<span class="cpt-pre-l">' + esc(L('完井预设', 'Completion presets')) + '</span>' +
      presets.map(function (p) {
        return '<button type="button" class="cpt-pre-b" data-cpt-pre="' + esc(p.ids.join(',')) + '" title="' + esc(p.desc) + '">' +
          esc(p.name) + '</button>';
      }).join('');
    /* 预设组放在浮层底部操作条里：清空按钮之前 */
    var clear = f.querySelector('[data-lrn-clear-cmp]');
    if (clear) f.insertBefore(span, clear);
    else f.appendChild(span);

    span.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cpt-pre]');
      if (!b) return;
      g.Learn.setCompare(b.getAttribute('data-cpt-pre').split(','));
      if (g.Learn.openCompare) g.Learn.openCompare();
    });
  }

  /* =========================================================
     9. 导出：完井场景数据包 + 开题说明模板
     ========================================================= */
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  function snapshot() {
    var M = meta();
    return coScenes().map(function (sc) {
      var cs = casesOf(sc.id), m = metaOf(sc.id);
      return {
        id: sc.id, name: sc.name, stage: 'completion',
        methods: sc.methods, methodNames: (sc.methods || []).map(mName),
        diff: sc.diff, diffWhy: sc.diffWhy || '',
        point: sc.point || '', intro: sc.intro || '', problem: sc.problem || '',
        data: (sc.data || []).map(function (d) { return { name: d[0], desc: d[1], note: d[2] || '' }; }),
        refs: sc.refs || [], cross: sc.cross || [],
        maturity: sc.maturity || '', maturityDesc: pick(MAT, sc.maturity).name,
        innov: sc.innov || '', innovDesc: pick(INN, sc.innov).name,
        deps: m.deps || [], badges: m.badges || [], risk: m.risk || null,
        demo: !!sc.demo,
        caseCount: cs.length,
        cases: cs.map(function (c) {
          return { id: c.id, title: c.title, version: c.version || '', hasDemo: !!(c.tabs && c.tabs.demo) };
        }),
        dataTypes: (M.matrix.types || []).filter(function (t) {
          return ((M.matrix.cells[t.k] || {})[sc.id] || 0) > 0;
        }).map(function (t) { return { key: t.k, name: t.name, level: (M.matrix.cells[t.k] || {})[sc.id] }; }),
        papers: (M.papers || {})[sc.id] || []
      };
    });
  }

  function exportJSON() {
    if (!ready()) return;
    var M = meta();
    var pack = {
      schema: 'petro-ai-atlas/completion@1',
      module: { id: 'completion', name: '完井', en: 'Completion', sceneCount: coScenes().length },
      generatedAt: new Date().toISOString(),
      description: L('完井环节 20 个场景的元数据快照：数据依赖、风险与工程约束、公开案例丰富度分层、创新度、数据互通矩阵与已接入案例。可直接用于选题对照或二次开发。',
        'Snapshot of the 20 completion scenes: dependencies, risk constraints, maturity tiers, novelty, data matrix and linked cases.'),
      fieldNotes: {
        deps: '上游完井场景 id：做这个场景前需要先拿到哪些输出（仅完井内部依赖）',
        maturity: M.maturityNote, innov: M.innovNote,
        risk: '风险与工程约束：eng = 工程红线，ai = 模型输出的使用边界',
        dataTypes: '数据互通矩阵：2 = 需要，1 = 可选'
      },
      matrix: M.matrix,
      comparePresets: M.comparePresets,
      scenes: snapshot()
    };
    download('completion-scenes-' + stamp() + '.json', JSON.stringify(pack, null, 2), 'application/json;charset=utf-8');
    toast(L('已导出完井 20 场景元数据包', 'Exported the 20-scene completion package'));
  }

  function exportMD() {
    if (!ready()) return;
    var rows = snapshot();
    var md = [];
    md.push('# 完井环节智能化场景 · 开题调研清单');
    md.push('');
    md.push('> 来源：石油勘探开发智能化可能性地图（完井模块）　导出日期：' + stamp());
    md.push('>');
    md.push('> 本站是**可能性地图与选题参考工具**，不是工业生产系统；下面每个场景都是"值得试的切入点"，不是已落地的产品。');
    md.push('');
    md.push('## 怎么用这份清单');
    md.push('');
    md.push('1. 先看「公开案例丰富度」：想找公开案例少、可研究空间大的方向，挑「案例极少 / 案例较少」；' +
      '想跟随已有公开实践，挑「案例若干 / 案例较多」。这只是公开可见信息的分层，不代表该技术在现场的工程成熟度。');
    md.push('2. 再看「上游依赖」：依赖多的场景，做之前要先确认能拿到上游输出，否则数据链断在最前面。');
    md.push('3. 然后核「数据条件」：这是立项时最容易低估的一项，先问清楚能拿到几口井、什么口径。');
    md.push('4. 最后读「工程约束」：完井属于强监管环节，模型结论只能作为工程师的参考，不能直接执行。');
    md.push('');
    md.push('## 字段口径');
    md.push('');
    md.push('| 字段 | 含义 |');
    md.push('| --- | --- |');
    md.push('| 公开案例丰富度 | 案例极少＝只有论文与仿真算例；案例较少＝单井试点报道；案例若干＝多井组试用；案例较多＝公开实践已常见。' +
      '这是按公开可见信息多少做的分层，不等于该技术在现场的工程成熟水平 |');
    md.push('| 创新度 | 按公开报道多寡粗分：高＝公开案例极少；成熟＝公开工作多，多为复现/提效题 |');
    md.push('| 上游依赖 | 本场景需要哪些完井场景的输出作为输入 |');
    md.push('| 数据条件 | 立项前必须确认能拿到的数据 |');
    md.push('');
    md.push('## 20 个场景一览');
    md.push('');
    md.push('| 编号 | 场景 | 方法 | 难度 | 公开案例丰富度 | 创新度 | 已有示范 | 已接入案例 |');
    md.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    rows.forEach(function (s) {
      md.push('| ' + s.id.toUpperCase() + ' | ' + s.name + ' | ' + s.methodNames.join(' / ') + ' | ' + s.diff +
        ' | ' + s.maturityDesc + ' | ' + s.innovDesc + ' | ' + (s.demo ? '有' : '—') + ' | ' + (s.caseCount || 0) + ' |');
    });
    md.push('');
    md.push('## 逐个场景详情');
    md.push('');
    rows.forEach(function (s) {
      md.push('### ' + s.id.toUpperCase() + '　' + s.name);
      md.push('');
      md.push('- **介入点**：' + (s.point || '—'));
      md.push('- **技术难点**：' + (s.diffWhy || '—'));
      md.push('- **方法**：' + s.methodNames.join(' / ') + '　**难度**：' + s.diff +
        '　**公开案例丰富度**：' + s.maturityDesc + '　**创新度**：' + s.innovDesc);
      md.push('- **上游依赖**：' + (s.deps.length ? s.deps.map(function (d) {
        var up = scene(d);
        return up ? up.name + '（' + d.toUpperCase() + '）' : d;
      }).join('、') : '无'));
      md.push('- **所需数据**：' + (s.dataTypes.length ? s.dataTypes.map(function (d) {
        return d.name + '（' + (d.level === 2 ? '需要' : '可选') + '）';
      }).join('、') : '—'));
      if (s.data.length) {
        md.push('- **数据条件明细**：');
        s.data.forEach(function (d) { md.push('  - ' + d.name + '：' + d.desc + (d.note ? '（' + d.note + '）' : '')); });
      }
      if (s.risk) {
        md.push('- **工程约束**：' + s.risk.eng);
        md.push('- **算法落地风险**：' + s.risk.ai);
      }
      if (s.refs.length) md.push('- **参考方向**：' + s.refs.join('、'));
      md.push('- **选题标记**：□ 候选　□ 数据不足　□ 已有同类　□ 排除');
      md.push('');
    });
    md.push('---');
    md.push('');
    md.push('_说明：本清单由完井环节的"场景—数据—约束"元数据自动生成，用于在选题阶段快速对齐；');
    md.push('具体工程的合规判断请以现行标准与现场工程师意见为准。_');
    download('completion-proposal-template-' + stamp() + '.md', md.join('\n'), 'text/markdown;charset=utf-8');
    toast(L('已导出开题说明模板（Markdown）', 'Exported the proposal template (Markdown)'));
  }

  /* =========================================================
     10. 打印：完井 20 场景讲义（开题调研清单版式）
     ========================================================= */
  function printRoot() {
    var el = document.getElementById('cpt-print');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cpt-print';
      document.body.appendChild(el);
    }
    return el;
  }
  function handoutHTML() {
    var rows = snapshot();
    var counts = {};
    MAT.forEach(function (m) { counts[m.k] = 0; });
    rows.forEach(function (s) { if (counts[s.maturity] !== undefined) counts[s.maturity]++; });
    var head =
      '<div class="cpt-p-hd">' +
      '<div class="cpt-p-kick">COMPLETION · 完井环节 · 开题调研清单</div>' +
      '<h1>完井智能化场景选题清单（20 个场景）</h1>' +
      '<div class="cpt-p-meta">导出日期 ' + stamp() + '　·　来源：石油勘探开发智能化可能性地图（可能性地图 / 选题参考工具，不是工业生产系统）' +
      '　·　公开案例丰富度分布：' + MAT.map(function (m) { return m.name + ' ' + counts[m.k]; }).join('　') + '</div>' +
      '</div>';

    var body = rows.map(function (s, i) {
      var matC = (MAT.filter(function (m) { return m.k === s.maturity; })[0] || MAT[0]);
      var depsLine = s.deps.length ? s.deps.map(function (d) {
        var up = scene(d);
        return (up ? up.name : d) + '（' + d.toUpperCase() + '）';
      }).join('、') : '无（可直接切入）';
      return '<section class="cpt-p-scene">' +
        '<div class="cpt-p-t"><span class="cpt-p-n">' + s.id.toUpperCase() + '</span>' +
        '<h2>' + esc(s.name) + '</h2>' +
        '<span class="cpt-p-st">' + esc(s.methodNames.join(' / ')) + '　难度 ' + esc(s.diff) +
        '　公开案例丰富度 ' + esc(matC.name) + '　创新度 ' + esc(s.innovDesc) + '</span></div>' +
        '<div class="cpt-p-checks">□ 候选　□ 数据不足　□ 已有同类　□ 排除</div>' +
        '<dl>' +
        '<dt>介入点</dt><dd>' + esc(s.point || '—') + '</dd>' +
        '<dt>技术难点</dt><dd>' + esc(s.diffWhy || '—') + '</dd>' +
        '<dt>上游依赖</dt><dd>' + esc(depsLine) + '</dd>' +
        '<dt>所需数据</dt><dd>' + esc(s.dataTypes.length ? s.dataTypes.map(function (d) {
          return d.name + '（' + (d.level === 2 ? '需要' : '可选') + '）';
        }).join('、') : '—') + '</dd>' +
        (s.risk ? '<dt>工程约束</dt><dd>' + esc(s.risk.eng) + '</dd>' +
          '<dt>算法风险</dt><dd>' + esc(s.risk.ai) + '</dd>' : '') +
        (s.refs.length ? '<dt>参考方向</dt><dd>' + esc(s.refs.join('、')) + '</dd>' : '') +
        '</dl></section>';
    }).join('');

    var tail = '<div class="cpt-p-ft">完井属于强监管环节：模型输出只能作为工程师判断的参考，不能直接下发作业指令；' +
      '合规判断请以现行标准与现场工程师意见为准。</div>';
    return '<div class="cpt-paper">' + head + body + tail + '</div>';
  }
  function printHandout() {
    if (!ready()) return;
    var el = printRoot();
    el.innerHTML = handoutHTML();
    document.body.classList.add('cpt-printing');
    var off = function () { document.body.classList.remove('cpt-printing'); };
    g.addEventListener('afterprint', off, { once: true });
    setTimeout(function () { g.print(); }, 60);
    setTimeout(off, 60000);
  }
  function bindPrintMode() {
    g.addEventListener('beforeprint', function () {
      var on = false;
      try { on = localStorage.getItem(PRINT_FLAG) === '1'; } catch (e) { }
      if (!on || !/stage\/completion/.test(g.location.hash || '')) return;
      if (!ready()) return;
      printRoot().innerHTML = handoutHTML();
      document.body.classList.add('cpt-printing');
    });
    g.addEventListener('afterprint', function () { document.body.classList.remove('cpt-printing'); });
  }

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.querySelector('.cpt-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cpt-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  /* =========================================================
     渲染挂接
     ========================================================= */
  /* 作用域标记：只给完井环节的场景页 / 环节页加 body 类，
     让「正文与图案统一栏宽」的修正只作用于完井，不波及全站其它环节。 */
  function scopeTo() {
    var h = g.location.hash || '';
    var on = /^#\/scene\/co\d+/i.test(h) || /^#\/stage\/completion\b/.test(h);
    try { document.body.classList.toggle('cpt-scope', on); } catch (e) { }
  }

  function enhance() {
    if (!ready()) return;
    scopeTo();
    var h = g.location.hash || '';
    if (/^#\/stage\/completion\b/.test(h)) {
      injectTools();
      injectDepView();
      injectMaturityStrip();
      buildStageShell();
      injectRowBadges();
      applyFilter();
    }
    if (/^#\/scene\/co\d+/i.test(h)) {
      injectSceneHead();
      injectRiskPanel();
      injectPapers();
      injectSandbox();
    }
    injectComparePresets();
  }

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(enhance, 90);
  });

  function start() {
    var view = document.getElementById('view');
    if (!view) { setTimeout(start, 200); return; }
    patchSrcdoc();
    bindPrintMode();
    /* 对比浮层挂在 body 下、不在 #view 里，观察不到；
       所以包一层 openCompare，在打开后补注入预设组 */
    if (g.Learn && g.Learn.openCompare) {
      var rawOpen = g.Learn.openCompare;
      g.Learn.openCompare = function () {
        var r = rawOpen.apply(this, arguments);
        setTimeout(injectComparePresets, 30);
        setTimeout(injectComparePresets, 300);
        return r;
      };
    }
    mo.observe(view, { childList: true, subtree: true });
    enhance();
    g.addEventListener('hashchange', function () { rowTextCache = {}; setTimeout(enhance, 90); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
