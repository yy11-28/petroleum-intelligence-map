/* =========================================================
   stage.js —— 全环节配套增强（除完井外的 12 个环节）
   ---------------------------------------------------------
   目标：让每个作业环节都拥有与完井同构的页面能力——
     · 环节内快搜 + 公开案例丰富度 / 创新度 / 数据 / 方法筛选
     · 场景数据依赖图（谁的输出是别人的输入）
     · 右侧配套面板：数据互通矩阵 / 技术栈 / 公开案例丰富度 / 创新度
     · 列表行徽标、详情页风险与约束面板、参考方向归集
     · 批量导出（JSON / 开题说明 MD）与讲义打印
   数据来源：assets/data.js（场景）+ assets/stage-meta.js（配套元数据）
   纯前端、只新增节点与类名，不改任何既有逻辑；
   完井环节仍由 completion.js 独占（这里主动跳过），其它页面零侵入。
   ========================================================= */

(function (g) {
  'use strict';

  var A = g.ATLAS, SM = g.STAGE_META;
  var MAT = SM.MAT, INN = SM.INN, CATS = SM.DATA_CATS;
  var PRINT_FLAG = 'atlas.stage.print';

  /* ---------------- 基础 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function L(zh, en) { return document.documentElement.getAttribute('lang') === 'en' ? (en || zh) : zh; }
  function ready() { return !!(A && A.index && A.index.byStage && SM); }
  function pick(arr, k) {
    for (var i = 0; i < arr.length; i++) if (arr[i].k === k) return arr[i];
    return arr[arr.length - 1];
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  /* 当前所处环节：环节页看 hash，场景页看场景归属 */
  var SID = '';
  function syncStage() {
    var h = g.location.hash || '';
    var m = h.match(/^#\/stage\/([a-z]+)/i);
    if (m) { SID = m[1]; return; }
    var ms = h.match(/^#\/scene\/([a-z]+[0-9]+)/i);
    if (ms) {
      var sc = A.index.byScene[ms[1]];
      SID = sc ? sc.stageId : '';
      return;
    }
    SID = '';
  }
  function owned() { return !!(SID && SM.owns(SID) && SID !== 'completion'); }
  function scenes() {
    var st = A.index.byStage[SID];
    return (st && st.scenes) || [];
  }
  function ids() { return scenes().map(function (s) { return s.id; }); }
  function scene(id) { return A.index.byId[id] || A.index.byScene[id] || null; }
  function stageName() {
    var st = A.index.byStage[SID];
    return st ? st.name : '';
  }
  function matOf(id) { return SM.maturityOf(SID, id); }
  function innOf(id) { return SM.innovOf(SID, id); }
  function depsOf(id) { return SM.depsOf(SID, id); }
  function riskOf(id) { return SM.riskOf(SID, id); }
  function shortId(id) { return String(id).toUpperCase(); }

  /* ---------------- 筛选状态 ---------------- */
  var F = { q: '', mat: '', inn: '', dt: '', m: '' };

  function rows() {
    var list = document.getElementById('scene-list');
    return list ? [].slice.call(list.querySelectorAll('a.scene-row')) : [];
  }
  function rowId(row) {
    var m = (row.getAttribute('href') || '').match(/#\/scene\/([a-z]+[0-9]+)/i);
    return m ? m[1] : '';
  }
  var txtCache = {};
  function rowText(id) {
    if (txtCache[id]) return txtCache[id];
    var sc = scene(id);
    if (!sc) return '';
    var parts = [sc.name, sc.point, sc.intro, sc.problem, sc.diffWhy || '', id];
    (sc.data || []).forEach(function (d) { parts.push(d[0], d[1] || '', d[2] || ''); });
    (sc.refs || []).forEach(function (r) { parts.push(r); });
    (sc.datasets || []).forEach(function (r) { parts.push(r); });
    txtCache[id] = parts.join(' ').toLowerCase();
    return txtCache[id];
  }
  function match(id) {
    var sc = scene(id);
    if (!sc) return false;
    /* chips 是抽象主题词：经同义扩展表展开后再匹配 */
    if (F.q) {
      var words = (g.STAGE_META && g.STAGE_META.kwExpand) ? g.STAGE_META.kwExpand(F.q) : [F.q];
      var hit = words.some(function (w) { return rowText(id).toLowerCase().indexOf(w.toLowerCase()) >= 0; });
      if (!hit) return false;
    }
    if (F.mat && matOf(id) !== F.mat) return false;
    if (F.inn && innOf(id) !== F.inn) return false;
    if (F.m && (sc.methods || []).indexOf(F.m) < 0) return false;
    if (F.dt && SM.cellOf(sc, F.dt) !== 2) return false;
    return true;
  }
  function activeLabel() {
    var bits = [];
    if (F.q) bits.push('关键词「' + F.q + '」');
    if (F.mat) bits.push('公开案例丰富度 ' + F.mat);
    if (F.inn) bits.push('创新度 ' + F.inn);
    if (F.dt) {
      var c = CATS.filter(function (x) { return x.k === F.dt; })[0];
      bits.push('含数据 ' + (c ? c.name : F.dt));
    }
    if (F.m) bits.push('方法 ' + ((A.methods[F.m] || {}).abbr || F.m));
    return bits.length ? bits.join(' · ') : L('未启用附加筛选，显示本环节全部场景', 'No extra filter — showing all scenes of this stage');
  }
  function syncControls() {
    [].forEach.call(document.querySelectorAll('[data-st-kw]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-st-kw') === F.q);
    });
    [].forEach.call(document.querySelectorAll('[data-st-mat]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-st-mat') === F.mat);
    });
    [].forEach.call(document.querySelectorAll('[data-st-inn]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-st-inn') === F.inn);
    });
    var tip = document.querySelector('[data-st="filter-tip"]');
    if (tip) tip.textContent = activeLabel();
  }
  function applyFilter() {
    var n = 0;
    rows().forEach(function (row) {
      var id = rowId(row);
      var ok = id ? match(id) : true;
      row.classList.toggle('cpt-hide', !ok);
      if (ok && row.style.display !== 'none') n++;
    });
    var cnt = document.getElementById('f-count');
    if (cnt) cnt.textContent = n + ' 个场景';
    var cnt2 = document.querySelector('[data-st="count"]');
    if (cnt2) cnt2.textContent = n + ' 个场景';

    /* 依赖图联动：命中节点全亮；连线只保留与命中节点相连的（对端邻居淡化保留）；
       与命中节点无关的节点和连线全部隐藏 */
    var show = {}, near = {};
    rows().forEach(function (row) {
      var id = rowId(row);
      if (id && match(id)) show[id.toLowerCase()] = 1;
    });
    [].forEach.call(document.querySelectorAll('[data-st-edge]'), function (p) {
      var rel = p.getAttribute('data-st-edge').split('>');
      var up = rel[0].toLowerCase(), dn = rel[1].toLowerCase();
      var hit = !F.q || show[up] || show[dn];
      p.style.display = hit ? '' : 'none';
      p.classList.toggle('on', F.q && hit);
      p.setAttribute('marker-end', hit ? 'url(#st-ar-on)' : 'url(#st-ar)');
      p.setAttribute('stroke', hit ? '#1A4779' : '#8FA6BA');
      if (F.q && hit) { if (!show[up]) near[up] = 1; if (!show[dn]) near[dn] = 1; }
    });
    [].forEach.call(document.querySelectorAll('[data-st-node]'), function (nd) {
      var id = (nd.getAttribute('data-st-node') || '').toLowerCase();
      var vis = !F.q || show[id] || near[id];
      nd.style.display = vis ? '' : 'none';
      nd.classList.toggle('cpt-dep-off', !!near[id] && !show[id]);
    });

    /* 自建空态：站点自带的空态只在它自己的筛选生效时出现 */
    var list = document.getElementById('scene-list');
    if (list) {
      var empty = list.querySelector('[data-st="empty"]');
      if (n === 0 && !empty) {
        var d = document.createElement('div');
        d.className = 'empty';
        d.setAttribute('data-st', 'empty');
        d.innerHTML = '<b>没有符合条件的场景</b>清除附加筛选再试。';
        list.appendChild(d);
      } else if (n > 0 && empty) empty.remove();
    }
    syncControls();
  }
  function resetFilter() {
    F = { q: '', mat: '', inn: '', dt: '', m: '' };
    var q = document.querySelector('[data-st="q"]');
    if (q) q.value = '';
    applyFilter();
  }
  function toggle(key, val) {
    F[key] = (F[key] === val) ? '' : val;
    applyFilter();
  }

  /* =========================================================
     1. 工具条：快搜 / 导出 / 打印
     ========================================================= */
  function injectTools() {
    var head = document.querySelector('.page-head');
    if (!head || document.querySelector('[data-st="tools"]')) return;
    var kws = SM.kwOf(SID);
    var n = scenes().length;
    var bar = document.createElement('div');
    bar.className = 'cpt-tools';
    bar.setAttribute('data-st', 'tools');
    bar.innerHTML =
      '<div class="cpt-t-row">' +
      '<div class="cpt-search">' +
      '<input type="search" data-st="q" placeholder="' + esc(L('在' + stageName() + ' ' + n + ' 个场景内检索：名称 / 介入点 / 数据 / 参考方向…',
        'Search within the ' + n + ' scenes of this stage')) + '">' +
      (kws.length ? '<div class="cpt-kws">' + kws.map(function (k) {
        var words = (g.STAGE_META && g.STAGE_META.kwExpand) ? g.STAGE_META.kwExpand(k) : [k];
        var n = scenes().filter(function (sc) {
          var txt = [sc.name, sc.point, sc.intro, (sc.methods || []).join(' '), (sc.refs || []).join(' ')].join(' ').toLowerCase();
          return words.some(function (w) { return txt.indexOf(w.toLowerCase()) >= 0; });
        }).length;
        return '<button type="button" class="cpt-kw" data-st-kw="' + esc(k) + '" title="' + esc('筛选含「' + k + '」相关内容的 ' + n + ' 个场景') + '">' + esc(k) + '<b>' + n + '</b></button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="cpt-t-acts">' +
      '<button type="button" class="btn sm ghost" data-st="clear">' + esc(L('清除筛选', 'Clear filters')) + '</button>' +
      '<button type="button" class="btn sm ghost" data-st="exp">' + esc(L('导出 ' + n + ' 场景元数据（JSON）', 'Export ' + n + ' scenes (JSON)')) + '</button>' +
      '<button type="button" class="btn sm ghost" data-st="md">' + esc(L('导出开题说明模板（MD）', 'Export proposal template (MD)')) + '</button>' +
      '<button type="button" class="btn sm" data-st="print">' + esc(L('打印' + stageName() + '讲义', 'Print handout')) + '</button>' +
      '</div></div>' +
      '<div class="cpt-t-foot">' +
      '<span class="cpt-tip" data-st="filter-tip"></span>' +
      '<b class="cpt-count" data-st="count"></b>' +
      '<label class="cpt-ck"><input type="checkbox" data-st="printmode">' +
      esc(L('Ctrl+P 时输出「' + stageName() + '场景讲义」而不是本页', 'Ctrl+P prints the stage handout instead of this page')) + '</label>' +
      '</div>';
    head.parentNode.insertBefore(bar, head.nextSibling);

    bar.addEventListener('input', function (e) {
      if (!e.target.matches('[data-st="q"]')) return;
      F.q = e.target.value.trim().toLowerCase();
      applyFilter();
    });
    bar.addEventListener('change', function (e) {
      if (!e.target.matches('[data-st="printmode"]')) return;
      try { localStorage.setItem(PRINT_FLAG, e.target.checked ? '1' : '0'); } catch (err) { }
    });
    bar.addEventListener('click', function (e) {
      var kw = e.target.closest('[data-st-kw]');
      if (kw) {
        var v = kw.getAttribute('data-st-kw');
        var input = bar.querySelector('[data-st="q"]');
        if (F.q === v.toLowerCase()) { F.q = ''; input.value = ''; }
        else { F.q = v.toLowerCase(); input.value = v; }
        applyFilter();
        return;
      }
      if (e.target.closest('[data-st="clear"]')) { resetFilter(); return; }
      if (e.target.closest('[data-st="exp"]')) { exportJSON(); return; }
      if (e.target.closest('[data-st="md"]')) { exportMD(); return; }
      if (e.target.closest('[data-st="print"]')) { printHandout(); return; }
    });
    var ck = bar.querySelector('[data-st="printmode"]');
    var saved = '0';
    try { saved = localStorage.getItem(PRINT_FLAG) || '0'; } catch (err) { }
    ck.checked = saved === '1';
  }

  /* =========================================================
     2. 数据依赖图
     ========================================================= */
  function depDepth() {
    var depth = {};
    function d(id, seen) {
      if (depth[id] !== undefined) return depth[id];
      if (seen.indexOf(id) >= 0) return 0;
      seen.push(id);
      var deps = depsOf(id);
      depth[id] = deps.length ? 1 + Math.max.apply(null, deps.map(function (x) { return d(x, seen.slice()); })) : 0;
      return depth[id];
    }
    ids().forEach(function (s) { d(s, []); });
    return depth;
  }
  function depViewHTML() {
    var list = ids();
    var depth = depDepth();
    var maxD = Math.max.apply(null, list.map(function (i) { return depth[i] || 0; }));
    var nodeW = 152, nodeH = 44, colW = 196, rowH = 54, padX = 16, padY = 30;
    var layers = [];
    for (var l = 0; l <= maxD; l++) layers.push([]);
    list.forEach(function (id) { layers[depth[id] || 0].push(id); });
    var pos = {};
    layers.forEach(function (arr, li) {
      arr.forEach(function (id, i) { pos[id] = { x: padX + li * colW, y: padY + i * rowH }; });
    });
    var rc = Math.max.apply(null, layers.map(function (a) { return a.length; }));
    var W = padX * 2 + (maxD + 1) * colW, H = padY + rc * rowH + 14;

    var s = '<svg class="cpt-dep-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      esc(stageName() + '场景数据依赖图') + '">';
    s += '<defs><marker id="st-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#8FA6BA"/></marker>' +
      '<marker id="st-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#1A4779"/></marker></defs>';

    list.forEach(function (id) {
      depsOf(id).forEach(function (up) {
        if (!pos[id] || !pos[up]) return;
        var x1 = pos[up].x + nodeW, y1 = pos[up].y + nodeH / 2;
        var x2 = pos[id].x, y2 = pos[id].y + nodeH / 2;
        s += '<path class="cpt-dep-edge" data-st-edge="' + up + '>' + id + '" d="M' + x1 + ' ' + y1 +
          ' C ' + (x1 + 40) + ' ' + y1 + ', ' + (x2 - 40) + ' ' + y2 + ', ' + x2 + ' ' + y2 +
          '" fill="none" stroke="#8FA6BA" stroke-width="1.3" marker-end="url(#st-ar)"/>';
      });
    });

    list.forEach(function (id) {
      var p = pos[id], sc = scene(id);
      var name = sc ? sc.name : id;
      var short = name.length > 9 ? name.slice(0, 8) + '…' : name;
      var up = depsOf(id).length;
      var mat = pick(MAT, matOf(id));
      s += '<g class="cpt-dep-node" data-st-node="' + id + '" tabindex="0" role="button" aria-label="' + esc(name) + '">' +
        '<title>' + esc(name + ' · ' + shortId(id) + (up ? ' · 需要 ' + up + ' 项上游输出' : ' · 无上游依赖')) + '</title>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="' + nodeW + '" height="' + nodeH + '" rx="4" fill="#fff" stroke="#C3D1DF"/>' +
        '<rect x="' + p.x + '" y="' + p.y + '" width="3.5" height="' + nodeH + '" fill="' + mat.col + '"/>' +
        '<text x="' + (p.x + 11) + '" y="' + (p.y + 19) + '" font-size="10.5" font-weight="600" fill="#222B38">' + esc(short) + '</text>' +
        '<text x="' + (p.x + 11) + '" y="' + (p.y + 34) + '" font-size="8.5" font-family="ui-monospace,Consolas,monospace" fill="#718096">' +
        esc(shortId(id) + (up ? ' · 上游 ' + up : ' · 起点')) + '</text>' +
        '</g>';
    });
    return s + '</svg>';
  }
  function injectDepView() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-st="dep"]')) return;
    var filters = main.querySelector('.filters');
    if (!filters) return;
    var box = document.createElement('div');
    box.className = 'cpt-dep';
    box.setAttribute('data-st', 'dep');
    box.innerHTML =
      '<div class="cpt-dep-head"><span class="cpt-dep-t">' + esc(stageName() + '场景数据依赖图') + '</span>' +
      '<span class="cpt-dep-s">' + esc('箭头 = 左端场景需要右端场景的输出；点节点可定位到下方场景卡片') + '</span></div>' +
      '<div class="cpt-dep-body fold">' + depViewHTML() +
      '<div class="cpt-dep-legend">' +
      MAT.map(function (m) { return '<span><i style="background:' + m.col + '"></i>' + esc(m.name) + '</span>'; }).join('') +
      '<span class="cpt-dep-hint">' + esc('节点左侧色条 = 公开案例丰富度分层；根节点（无上游）适合作为首个题目') + '</span>' +
      '</div></div>' +
      '<div class="cpt-dep-foot"><button type="button" class="cpt-dep-toggle" data-st="dep-toggle" ' +
      'aria-expanded="false"><span class="cpt-dep-tx">展开全部</span><i class="cpt-dep-ar">▾</i></button></div>';
    main.insertBefore(box, filters);

    /* 底部居中切换按钮：收起态显示前三行 + 渐隐，展开显示全部 */
    var tog = box.querySelector('[data-st="dep-toggle"]');
    var body = box.querySelector('.cpt-dep-body');
    tog.addEventListener('click', function () {
      var open = !body.classList.contains('fold');
      body.classList.toggle('fold', open);
      tog.setAttribute('aria-expanded', String(!open));
      box.querySelector('.cpt-dep-tx').textContent = open ? '展开全部' : '收起';
      box.querySelector('.cpt-dep-ar').textContent = open ? '▾' : '▴';
      if (!open) {
        try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (e) { box.scrollIntoView(); }
      }
    });

    function hit(e) {
      var node = e.target.closest('[data-st-node]');
      if (!node) return;
      selectNode(node.getAttribute('data-st-node'), box);
    }
    box.addEventListener('click', hit);
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var node = e.target.closest('[data-st-node]');
      if (!node) return;
      e.preventDefault();
      selectNode(node.getAttribute('data-st-node'), box);
    });
  }
  function selectNode(id, box) {
    [].forEach.call(box.querySelectorAll('.cpt-dep-node'), function (n) {
      n.classList.toggle('sel', n.getAttribute('data-st-node') === id);
    });
    [].forEach.call(box.querySelectorAll('.cpt-dep-edge'), function (p) {
      var rel = p.getAttribute('data-st-edge').split('>');
      var on = rel[0] === id || rel[1] === id;
      p.classList.toggle('on', on);
      p.setAttribute('marker-end', on ? 'url(#st-ar-on)' : 'url(#st-ar)');
      p.setAttribute('stroke', on ? '#1A4779' : '#8FA6BA');
    });
    jumpToRow(id);
  }
  function jumpToRow(id) {
    var row = document.querySelector('#scene-list a.scene-row[href="#/scene/' + id + '"]');
    if (!row) return;
    row.classList.remove('cpt-hide');
    try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { row.scrollIntoView(); }
    var bd = row.style.boxShadow;
    row.style.boxShadow = '0 0 0 2px rgba(26,71,121,.35)';
    setTimeout(function () { row.style.boxShadow = bd; }, 1200);
  }

  /* =========================================================
     3. 公开案例丰富度分层条
     ========================================================= */
  function injectMaturityStrip() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-st="strip"]')) return;
    var filters = main.querySelector('.filters');
    if (!filters) return;
    var bar = document.createElement('div');
    bar.className = 'cpt-strip cpt-strip-tip';
    bar.setAttribute('data-st', 'strip');
    bar.innerHTML = '<span class="cpt-tip-ic">i</span>' +
      esc('按「公开案例丰富度 / 创新度」筛选：用右上角配套面板——点「公开案例丰富度」或「创新度」标签里的任意一档即可。');
    main.insertBefore(bar, filters);
  }

  /* =========================================================
     4. 右侧配套面板
     ========================================================= */
  function buildStageShell() {
    var main = document.querySelector('main.wrap');
    if (!main || document.querySelector('[data-st="layout"]')) return;
    var filters = main.querySelector('.filters');
    var list = document.getElementById('scene-list');
    if (!filters || !list) return;
    var pager = main.querySelector('.pager');

    /* 方法/难度/只看收藏工具条已删除：方法筛选在右栏「技术栈」，计数在工具条 */
    var layout = document.createElement('div');
    layout.className = 'cpt-layout';
    layout.setAttribute('data-st', 'layout');
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
    aside.setAttribute('data-st', 'side');
    aside.innerHTML =
      '<div class="pnl">' +
      '<div class="pnl-h"><span class="mono">STAGE COMPANION · ' + esc(stageName()) + '配套</span></div>' +
      '<div class="pnl-tabs">' +
      '<button type="button" class="pnl-tab on" data-st-tab="matrix">数据矩阵</button>' +
      '<button type="button" class="pnl-tab" data-st-tab="tech">技术栈</button>' +
      '<button type="button" class="pnl-tab" data-st-tab="mature">公开案例丰富度</button>' +
      '<button type="button" class="pnl-tab" data-st-tab="innov">创新度</button>' +
      '</div>' +
      '<div class="pnl-b" data-st-pane="matrix">' + matrixHTML() + '</div>' +
      '<div class="pnl-b" data-st-pane="tech" hidden>' + techHTML() + '</div>' +
      '<div class="pnl-b" data-st-pane="mature" hidden>' + tierHTML() + '</div>' +
      '<div class="pnl-b" data-st-pane="innov" hidden>' + innovHTML() + '</div>' +
      '</div>';
    aside.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-st-tab]');
      if (tab) {
        [].forEach.call(aside.querySelectorAll('.pnl-tab'), function (b) { b.classList.toggle('on', b === tab); });
        var key = tab.getAttribute('data-st-tab');
        [].forEach.call(aside.querySelectorAll('[data-st-pane]'), function (p) {
          p.hidden = p.getAttribute('data-st-pane') !== key;
        });
        return;
      }
      var dt = e.target.closest('[data-st-dt]');
      if (dt) { toggle('dt', dt.getAttribute('data-st-dt')); return; }
      var mm = e.target.closest('[data-st-m]');
      if (mm) { toggle('m', mm.getAttribute('data-st-m')); return; }
      var mt = e.target.closest('[data-st-mat]');
      if (mt) { toggle('mat', mt.getAttribute('data-st-mat')); return; }
      var iv = e.target.closest('[data-st-inn]');
      if (iv) { toggle('inn', iv.getAttribute('data-st-inn')); return; }
    });
    return aside;
  }
  function matrixHTML() {
    var list = ids();
    var head = '<thead><tr><th>数据类型</th>' + list.map(function (id) {
      var sc = scene(id);
      return '<th title="' + esc(sc ? sc.name : id) + '">' + shortId(id) + '</th>';
    }).join('') + '</tr></thead>';
    var rowsHtml = CATS.map(function (ty) {
      var need = 0, opt = 0;
      var cells = list.map(function (id) {
        var sc = scene(id), v = sc ? SM.cellOf(sc, ty.k) : 0;
        if (v === 2) need++; else if (v === 1) opt++;
        return '<td class="' + (v === 2 ? 'on' : v === 1 ? 'opt' : '') + '">' + (v === 2 ? '●' : v === 1 ? '○' : '·') + '</td>';
      }).join('');
      return '<tr data-st-dt="' + ty.k + '" title="点此筛选出需要该数据的场景">' +
        '<td class="cpt-mat-n"><span>' + esc(ty.name) + '</span><b>' + need + (opt ? '+' + opt : '') + '</b></td>' +
        cells + '</tr>';
    }).join('');
    return '<div class="cpt-mat-hint">● 需要 · ○ 可选 · 点数据类型所在行，筛选出用到它的场景</div>' +
      '<div class="cpt-mat-wrap"><table class="cpt-mat">' + head + '<tbody>' + rowsHtml + '</tbody></table></div>' +
      '<div class="pnl-note">同一份数据集常能覆盖多个场景：先看这一行都为 ● 的场景，往往可以共用一套数据做一组题目。</div>';
  }
  function techHTML() {
    var counts = {}, order = [];
    scenes().forEach(function (s) {
      (s.methods || []).forEach(function (k) {
        if (counts[k] === undefined) { counts[k] = 0; order.push(k); }
        counts[k]++;
      });
    });
    return '<div class="cpt-mat-hint">' + esc(stageName() + ' ' + scenes().length + ' 个场景的方法构成，点任一标签筛选场景') + '</div>' +
      '<div class="cpt-slist">' + order.map(function (k) {
        var mm = A.methods[k] || {};
        return '<button type="button" class="cpt-srow" data-st-m="' + k + '">' +
          '<span class="mtag" data-m="' + (mm.colorKey || k) + '"><b>' + esc(mm.abbr || k.slice(0, 2).toUpperCase()) + '</b>' + esc(mm.name || k) + '</span>' +
          '<b>' + counts[k] + '</b></button>';
      }).join('') + '</div>' +
      '<div class="pnl-note">方法标签与全站一致；这里的计数只统计' + esc(stageName()) + '环节。</div>';
  }
  function tierHTML() {
    return '<div class="cpt-mat-hint cpt-mat-hint-lead">点击下面任意一档，即可筛选左侧场景列表</div>' +
      '<div class="cpt-mat-hint">' + esc(SM.noteOf(SID, 'maturityNote')) + '</div>' +
      '<div class="cpt-slist">' + MAT.map(function (m) {
        var hit = ids().filter(function (id) { return matOf(id) === m.k; });
        return '<button type="button" class="cpt-srow" data-st-mat="' + m.k + '">' +
          '<span><i class="cpt-dot" style="background:' + m.col + '"></i>' + esc(m.name) + '</span><b>' + hit.length + '</b></button>' +
          '<div class="cpt-srow-sub">' + esc(hit.slice(0, 3).map(function (id) {
            var sc = scene(id); return sc ? sc.name : id;
          }).join('、') || '—') + (hit.length > 3 ? ' …' : '') + '</div>';
      }).join('') + '</div>';
  }
  function innovHTML() {
    return '<div class="cpt-mat-hint cpt-mat-hint-lead">点击下面任意一档，即可筛选左侧场景列表</div>' +
      '<div class="cpt-mat-hint">' + esc(SM.noteOf(SID, 'innovNote')) + '</div>' +
      '<div class="cpt-slist">' + INN.map(function (n) {
        var hit = ids().filter(function (id) { return innOf(id) === n.k; });
        return '<button type="button" class="cpt-srow" data-st-inn="' + n.k + '">' +
          '<span><i class="cpt-dot" style="background:' + n.col + '"></i>' + esc(n.name) + '</span><b>' + hit.length + '</b></button>' +
          '<div class="cpt-srow-sub">' + esc(hit.slice(0, 3).map(function (id) {
            var sc = scene(id); return sc ? sc.name : id;
          }).join('、') || '—') + (hit.length > 3 ? ' …' : '') + '</div>';
      }).join('') + '</div>';
  }

  /* =========================================================
     5. 列表行徽标
     ========================================================= */
  function injectRowBadges() {
    rows().forEach(function (row) {
      var id = rowId(row);
      if (!id || row.querySelector('[data-st="badge"]')) return;
      var right = row.querySelector('.sr-right');
      if (!right) return;
      var mat = pick(MAT, matOf(id)), inn = pick(INN, innOf(id));
      var risk = riskOf(id);
      var html = '<span class="cpt-tg" data-st="badge" style="--c:' + mat.col + '" title="' + esc(mat.name + '：' + mat.tip) + '">' +
        '<i></i>' + esc(mat.k) + '</span>' +
        '<span class="cpt-tg solid" data-st="badge" style="--c:' + inn.col + '" title="' + esc('创新度 ' + inn.name + '：' + inn.tip) + '">' +
        esc(inn.name) + '</span>';
      if (risk && risk.strict) html += '<span class="cpt-tg warn" data-st="badge" title="安全敏感：模型只给参考，不可自动决策">安全敏感</span>';
      right.insertAdjacentHTML('afterbegin', html);
    });
  }

  /* =========================================================
     6. 场景详情页：徽标 / 风险与约束 / 参考方向
     ========================================================= */
  function sceneIdOfHash() {
    var m = (g.location.hash || '').match(/^#\/scene\/([a-z]+[0-9]+)/i);
    if (!m) return null;
    var sc = scene(m[1]);
    if (!sc || sc.stageId === 'completion') return null;
    return m[1];
  }
  function injectSceneHead() {
    var sid = sceneIdOfHash();
    if (!sid || document.querySelector('[data-st="dh-badge"]')) return;
    var tags = document.querySelector('.dh-tags');
    if (!tags) return;
    var mat = pick(MAT, matOf(sid)), inn = pick(INN, innOf(sid));
    var risk = riskOf(sid);
    var html = '<span class="cpt-tg" style="--c:' + mat.col + '" data-st="dh-badge" title="' + esc(mat.tip) + '">' +
      '<i></i>' + esc(mat.name) + '</span>' +
      '<span class="cpt-tg solid" style="--c:' + inn.col + '" data-st="dh-badge" title="' + esc(inn.tip) + '">' +
      esc('创新度·' + inn.name) + '</span>';
    if (risk && risk.strict) html += '<span class="cpt-tg warn" data-st="dh-badge">不可自动决策</span>';
    tags.insertAdjacentHTML('beforeend', html);
  }
  function injectRiskPanel() {
    var sid = sceneIdOfHash();
    if (!sid) return;
    var panel = document.querySelector('.panel[data-panel="bg"]');
    if (panel && panel.querySelector('[data-st="risk"]')) return;
    if (document.querySelector('[data-st="risk"]')) return;
    var risk = riskOf(sid);
    if (!risk) return;

    var deps = depsOf(sid).map(function (d) {
      var sc = scene(d);
      return '<a class="cpt-dep-chip" href="#/scene/' + d + '">' + esc(sc ? sc.name : d) + '</a>';
    }).join('') || '<span class="muted">无上游依赖，可直接从本场景切入</span>';

    var box = document.createElement('div');
    box.className = 'cpt-risk';
    box.setAttribute('data-st', 'risk');
    box.innerHTML =
      '<div class="cpt-risk-h"><span class="cpt-risk-t">风险与工程约束</span>' +
      (risk.strict ? '<span class="cpt-tg warn">强监管环节</span>' : '') + '</div>' +
      '<div class="cpt-risk-body">' +
      '<div class="cpt-risk-row"><span class="rk">工程约束</span><span class="rv">' + esc(risk.eng) + '</span></div>' +
      '<div class="cpt-risk-row"><span class="rk">算法落地风险</span><span class="rv">' + esc(risk.ai) + '</span></div>' +
      '<div class="cpt-risk-row"><span class="rk">上游依赖</span><span class="rv cpt-dep-list">' + deps + '</span></div>' +
      '</div>' +
      '<div class="cpt-risk-note">' + esc(risk.strict
        ? '本场景涉及安全或合规约束：模型输出只能作为工程师判断的参考，不能直接下发作业指令。'
        : '模型输出用于辅助判断，结论仍须由专业人员复核后进入正式成果。') + '</div>';

    if (panel) {
      var blocks = [].slice.call(panel.children).filter(function (el) { return el.classList.contains('sec4'); });
      if (blocks.length > 2) panel.insertBefore(box, blocks[2]);
      else panel.appendChild(box);
    } else {
      var pend = document.querySelector('main.wrap .pending');
      if (pend && pend.parentNode) pend.parentNode.insertBefore(box, pend.nextSibling);
      else {
        var mw = document.querySelector('main.wrap');
        if (mw) mw.appendChild(box);
      }
    }
  }
  function injectPapers() {
    var sid = sceneIdOfHash();
    if (!sid) return;
    var sc = scene(sid);
    if (!sc) return;
    var panel = document.querySelector('.panel[data-panel="bg"]');
    if (panel && panel.querySelector('[data-st="papers"]')) return;
    if (document.querySelector('[data-st="papers"]')) return;
    var items = (sc.refs || []).map(function (r) {
      return '<li><span class="cpt-p-tag">参考方向</span>' + esc(r) + '</li>';
    });
    (sc.datasets || []).forEach(function (r) {
      items.push('<li><span class="cpt-p-tag">公开数据</span>' + esc(r) + '</li>');
    });
    if (!items.length) return;
    var det = document.createElement('details');
    det.className = 'cpt-papers';
    det.setAttribute('data-st', 'papers');
    det.innerHTML = '<summary>参考方向与公开数据归集<span class="cpt-papers-n">' + items.length + '</span></summary>' +
      '<ul>' + items.join('') + '</ul>';
    if (panel) panel.appendChild(det);
    else {
      var pend = document.querySelector('main.wrap .pending');
      if (pend && pend.parentNode) pend.parentNode.insertBefore(det, pend.nextSibling);
      else {
        var mw = document.querySelector('main.wrap');
        if (mw) mw.appendChild(det);
      }
    }
  }

  /* =========================================================
     7. 导出 / 打印
     ========================================================= */
  function snapshot() {
    return scenes().map(function (sc) {
      var types = CATS.map(function (c) {
        return { k: c.k, name: c.name, level: SM.cellOf(sc, c.k) };
      }).filter(function (t) { return t.level > 0; });
      return {
        id: sc.id, name: sc.name, methods: sc.methods || [],
        methodNames: (sc.methods || []).map(function (k) { return (A.methods[k] || {}).name || k; }),
        diff: sc.diff, diffWhy: sc.diffWhy || '', point: sc.point || '',
        intro: sc.intro || '', problem: sc.problem || '',
        data: (sc.data || []).map(function (d) { return { name: d[0], spec: d[1] || '', label: d[2] || '' }; }),
        dataTypes: types,
        refs: sc.refs || [], datasets: sc.datasets || [], cross: sc.cross || '',
        maturity: matOf(sc.id), innov: innOf(sc.id),
        deps: depsOf(sc.id), risk: riskOf(sc.id)
      };
    });
  }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    toast('已导出 ' + name);
  }
  function exportJSON() {
    var st = A.index.byStage[SID] || {};
    var payload = {
      site: '石油勘探开发智能化可能性地图',
      note: '选题参考工具，不是工业生产系统；公开案例丰富度/创新度为人工维护的分层口径，不是等级评定。',
      stage: { id: SID, name: st.name, en: st.en || '', blurb: st.blurb || '' },
      generated: stamp(),
      meta: {
        maturity: MAT, innov: INN, dataTypes: CATS.map(function (c) { return { k: c.k, name: c.name }; }),
        maturityNote: SM.noteOf(SID, 'maturityNote'), innovNote: SM.noteOf(SID, 'innovNote')
      },
      scenes: snapshot()
    };
    download(SID + '-scenes-' + stamp() + '.json', JSON.stringify(payload, null, 2), 'application/json');
  }
  function exportMD() {
    var st = A.index.byStage[SID] || {};
    var rows = snapshot();
    var l = [];
    l.push('# ' + st.name + '环节智能化场景 · 开题说明模板');
    l.push('');
    l.push('> 来源：石油勘探开发智能化可能性地图（选题参考工具）。导出日期 ' + stamp() + '。');
    l.push('> 公开案例丰富度 / 创新度为"公开案例多寡"的粗分层，不是等级评定；数据条件一栏需按本单位实际复核。');
    l.push('');
    l.push('## 一、场景一览（' + rows.length + ' 个）');
    l.push('');
    l.push('| 编号 | 场景 | 方法 | 难度 | 公开案例丰富度 | 创新度 | 候选 |');
    l.push('| --- | --- | --- | --- | --- | --- | --- |');
    rows.forEach(function (s) {
      l.push('| ' + shortId(s.id) + ' | ' + s.name + ' | ' + s.methodNames.join(' / ') + ' | ' + s.diff +
        ' | ' + s.maturity + ' | ' + s.innov + ' | □ |');
    });
    l.push('');
    l.push('## 二、逐场景详情');
    rows.forEach(function (s) {
      l.push('');
      l.push('### ' + shortId(s.id) + '　' + s.name);
      l.push('');
      l.push('- **AI 介入点**：' + (s.point || '—'));
      l.push('- **问题背景**：' + (s.problem || '—'));
      l.push('- **难度与理由**：' + s.diff + '　' + (s.diffWhy || '—'));
      l.push('- **公开案例丰富度 / 创新度**：' + s.maturity + ' / ' + s.innov);
      l.push('- **上游依赖**：' + (s.deps.length ? s.deps.map(function (d) {
        var up = scene(d); return (up ? up.name : d) + '（' + shortId(d) + '）';
      }).join('、') : '无（可直接切入）'));
      l.push('- **所需数据**：');
      (s.data.length ? s.data : [{ name: '—', spec: '', label: '' }]).forEach(function (d) {
        l.push('  - ' + d.name + (d.spec ? '　规格：' + d.spec : '') + (d.label ? '　标注：' + d.label : ''));
      });
      if (s.risk) {
        l.push('- **工程约束**：' + s.risk.eng);
        l.push('- **算法落地风险**：' + s.risk.ai);
      }
      if (s.refs.length) l.push('- **参考方向**：' + s.refs.join('、'));
      if (s.datasets.length) l.push('- **公开数据集**：' + s.datasets.join('、'));
      l.push('- **选题勾选**：□ 候选　□ 数据不足　□ 已有同类　□ 排除');
    });
    l.push('');
    l.push('## 三、说明');
    l.push('');
    l.push('本模板只用于开题调研与内部讨论。涉及安全与合规的环节，模型输出只能作为参考，不得直接下发作业指令。');
    download(SID + '-proposal-' + stamp() + '.md', l.join('\n'), 'text/markdown');
  }
  function printRoot() {
    var el = document.getElementById('cpt-print');
    if (!el) { el = document.createElement('div'); el.id = 'cpt-print'; document.body.appendChild(el); }
    return el;
  }
  function handoutHTML() {
    var st = A.index.byStage[SID] || {};
    var rows = snapshot();
    var counts = {};
    MAT.forEach(function (m) { counts[m.k] = 0; });
    rows.forEach(function (s) { if (counts[s.maturity] !== undefined) counts[s.maturity]++; });
    var head = '<div class="cpt-p-hd">' +
      '<div class="cpt-p-kick">' + esc(String(st.en || SID).toUpperCase()) + ' · ' + esc(st.name) + '环节 · 开题调研清单</div>' +
      '<h1>' + esc(st.name) + '智能化场景选题清单（' + rows.length + ' 个场景）</h1>' +
      '<div class="cpt-p-meta">导出日期 ' + stamp() + '　·　来源：石油勘探开发智能化可能性地图（选题参考工具，不是工业生产系统）' +
      '　·　公开案例丰富度分布：' + MAT.map(function (m) { return m.name + ' ' + counts[m.k]; }).join('　') + '</div></div>';
    var body = rows.map(function (s) {
      var matC = MAT.filter(function (m) { return m.k === s.maturity; })[0] || MAT[0];
      var depsLine = s.deps.length ? s.deps.map(function (d) {
        var up = scene(d);
        return (up ? up.name : d) + '（' + shortId(d) + '）';
      }).join('、') : '无（可直接切入）';
      return '<section class="cpt-p-scene">' +
        '<div class="cpt-p-t"><span class="cpt-p-n">' + shortId(s.id) + '</span><h2>' + esc(s.name) + '</h2>' +
        '<span class="cpt-p-st">' + esc(s.methodNames.join(' / ')) + '　难度 ' + esc(s.diff) +
        '　公开案例丰富度 ' + esc(matC.name) + '　创新度 ' + esc(s.innov) + '</span></div>' +
        '<div class="cpt-p-checks">□ 候选　□ 数据不足　□ 已有同类　□ 排除</div>' +
        '<dl>' +
        '<dt>介入点</dt><dd>' + esc(s.point || '—') + '</dd>' +
        '<dt>技术难点</dt><dd>' + esc(s.diffWhy || '—') + '</dd>' +
        '<dt>上游依赖</dt><dd>' + esc(depsLine) + '</dd>' +
        '<dt>所需数据</dt><dd>' + esc(s.data.length ? s.data.map(function (d) {
          return d.name + (d.spec ? '（' + d.spec + '）' : '');
        }).join('、') : '—') + '</dd>' +
        (s.risk ? '<dt>工程约束</dt><dd>' + esc(s.risk.eng) + '</dd><dt>算法风险</dt><dd>' + esc(s.risk.ai) + '</dd>' : '') +
        (s.refs.length ? '<dt>参考方向</dt><dd>' + esc(s.refs.join('、')) + '</dd>' : '') +
        '</dl></section>';
    }).join('');
    var tail = '<div class="cpt-p-ft">模型输出只能作为工程师判断的参考，不能直接下发作业指令；合规判断请以现行标准与现场工程师意见为准。</div>';
    return '<div class="cpt-paper">' + head + body + tail + '</div>';
  }
  function printHandout() {
    if (!ready() || !owned()) return;
    printRoot().innerHTML = handoutHTML();
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
      if (!on || !ready() || !owned()) return;
      printRoot().innerHTML = handoutHTML();
      document.body.classList.add('cpt-printing');
    });
    g.addEventListener('afterprint', function () { document.body.classList.remove('cpt-printing'); });
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.querySelector('.cpt-toast');
    if (!el) { el = document.createElement('div'); el.className = 'cpt-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  /* =========================================================
     8. 挂接
     ========================================================= */
  function enhance() {
    if (!ready()) return;
    syncStage();
    if (!owned()) return;
    var h = g.location.hash || '';
    if (/^#\/stage\//.test(h)) {
      injectTools();
      injectDepView();
      injectMaturityStrip();
      buildStageShell();
      injectRowBadges();
      applyFilter();
      /* 站点自带的方法/难度筛选与本模块叠加生效 */
      var fbar = document.querySelector('.filters');
      if (fbar && !fbar.getAttribute('data-st-bound')) {
        fbar.setAttribute('data-st-bound', '1');
        fbar.addEventListener('click', function () { setTimeout(applyFilter, 0); });
      }
    } else if (/^#\/scene\//.test(h)) {
      injectSceneHead();
      injectRiskPanel();
      injectPapers();
    }
  }

  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(enhance, 90);
  });

  function start() {
    var view = document.getElementById('view');
    if (!view) { setTimeout(start, 200); return; }
    bindPrintMode();
    mo.observe(view, { childList: true, subtree: true });
    enhance();
    g.addEventListener('hashchange', function () { txtCache = {}; setTimeout(enhance, 90); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
