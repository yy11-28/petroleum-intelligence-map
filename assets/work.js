/* =========================================================
   work.js —— 我的工作区 #/mine
   ---------------------------------------------------------
   把散落在各页面的个人状态收拢到一处：
     收藏的选题 / 已读进度 / 待对比的场景 / 一键导出
   数据全部读 learn.js 维护的同一批 localStorage key，
   不新增存储、不重复记账（atlas.favs / atlas.visited / atlas.compare）。
   ========================================================= */
(function (g) {
  'use strict';

  var FAV = 'atlas.favs', VIS = 'atlas.visited', CMP = 'atlas.compare';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function ls(k, d) {
    try { var v = JSON.parse(g.localStorage.getItem(k) || 'null'); return v == null ? d : v; }
    catch (e) { return d; }
  }
  function save(k, v) { try { g.localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function sceneOf(id) { return g.ATLAS.index.byScene[id]; }
  function caseCount(sc) { return g.Cases ? g.Cases.bySceneAll(sc.id).length : 0; }
  function matOf(sc) {
    var SM = g.STAGE_META;
    if (!SM) return sc.maturity || '—';
    if (sc.maturity) return sc.maturity;
    if (SM.owns && SM.owns(sc.stageId)) return SM.maturityOf(sc.stageId, sc.id);
    return sc.maturity || '—';
  }

  /* 收藏清单 MD：给开题/汇报用 */
  function favMD(rows) {
    var L = ['# 我的收藏选题', '',
      '导出时间：' + new Date().toLocaleString(),
      '站点：石油勘探开发的智能化可能性地图', '',
      '共 ' + rows.length + ' 个场景。', '', '| 场景 | 环节 | 公开案例丰富度 | 难度 | 案例 | 地址 |',
      '| --- | --- | --- | --- | --- | --- |'];
    rows.forEach(function (r) {
      L.push('| ' + r.sc.name + ' | ' + r.sc.stageName + ' | ' + matOf(r.sc) +
        ' | ' + (r.sc.diff || '—') + ' | ' + (r.cn ? r.cn + ' 个' : '待接入') +
        ' | #/scene/' + r.sc.id + ' |');
    });
    L.push('', '## 下一步', '');
    var ready = rows.filter(function (r) { return r.cn; });
    L.push('- 已接入案例 ' + ready.length + ' 个，可直接看流程与示范；未接入的先看「待补数据」清单。');
    L.push('- 用「选题问答」核对数据缺口，用「图谱」核对上下游依赖。');
    return L.join('\n');
  }

  function html() {
    var A = g.ATLAS;
    if (!A) return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>数据层未加载</b></div></main>';

    var favs = ls(FAV, []), visited = ls(VIS, []), cmp = ls(CMP, []);
    var rows = favs.map(function (id) { return sceneOf(id); })
      .filter(Boolean)
      .map(function (sc) { return { sc: sc, cn: caseCount(sc) }; });

    /* 收藏卡 */
    var favCards = rows.length ? rows.map(function (r) {
      var sc = r.sc;
      return '<div class="wk-card">' +
        '<div class="wk-top"><span class="wk-stage">' + esc(sc.stageName) + '</span>' +
        '<span class="wk-id">' + esc(sc.id.toUpperCase()) + '</span></div>' +
        '<a class="wk-name" href="#/scene/' + sc.id + '">' + esc(sc.name) + '</a>' +
        '<div class="wk-meta">' + esc(matOf(sc)) + ' · 难度 ' + esc(sc.diff || '—') +
        ' · ' + (r.cn ? '<span class="ok-mark">已有 ' + r.cn + ' 案例</span>' : '<span class="dim-mark">待接入</span>') + '</div>' +
        '<div class="wk-acts">' +
        '<a class="btn sm ghost" href="#/scene/' + sc.id + '">打开场景 →</a>' +
        '<button type="button" class="btn sm ghost" data-wk-cmp="' + esc(sc.id) + '">' +
        (cmp.indexOf(sc.id) >= 0 ? '✓ 对比中' : '+ 加入对比') + '</button>' +
        '<button type="button" class="btn sm ghost" data-wk-unfav="' + esc(sc.id) + '">取消收藏</button>' +
        '</div></div>';
    }).join('') : '<div class="empty" style="padding:34px 0"><b>还没有收藏</b>' +
      '在任意环节页或场景页点场景名前的 ★，收藏的场景会集中到这里。' +
      '<a href="#/chain" style="color:var(--jade-d)">去作业链看看 →</a></div>';

    /* 已读进度：总量 + 按环节分布 */
    var total = A.allScenes.length, done = visited.filter(function (id) { return sceneOf(id); }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    var byStage = A.stages.map(function (st) {
      var n = st.scenes.filter(function (sc) { return visited.indexOf(sc.id) >= 0; }).length;
      return { st: st, n: n, t: st.scenes.length };
    }).filter(function (r) { return r.t; });
    var stageBars = byStage.map(function (r) {
      var p = Math.round(r.n / r.t * 100);
      return '<div class="wk-prog-row">' +
        '<span class="wk-pr-n">' + esc(r.st.name) + '</span>' +
        '<span class="wk-pr-bar"><i style="width:' + p + '%"></i></span>' +
        '<span class="wk-pr-v">' + r.n + '/' + r.t + '</span></div>';
    }).join('');

    /* 对比托盘内容 */
    var cmpItems = cmp.map(function (id) { return sceneOf(id); }).filter(Boolean);
    var cmpBlock = cmpItems.length
      ? '<div class="wk-cmp-list">' + cmpItems.map(function (sc) {
        return '<span class="wk-cmp-item">' + esc(sc.name) +
          '<button type="button" data-wk-cmp="' + esc(sc.id) + '" title="移出对比">×</button></span>';
      }).join('') + '</div>' +
        '<div class="wk-acts" style="margin-top:12px">' +
        '<button type="button" class="btn sm primary" data-wk-open>打开对比</button>' +
        '<button type="button" class="btn sm ghost" data-wk-clearcmp>清空对比</button></div>'
      : '<div class="empty" style="padding:26px 0">没有待对比的场景。场景页右上角「+ 对比」最多选 3 个。</div>';

    return '<main class="wrap">' +
      '<nav class="crumb"><a href="#/">总览</a><span class="sep">/</span><span>我的工作区</span></nav>' +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">MY WORKSPACE</div>' +
      '<h1>我的工作区</h1>' +
      '<p class="blurb">这些状态只存在本机浏览器里（localStorage），不上传、不同步。清空浏览器数据会一并清掉。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + rows.length + '</div><div class="l">收藏选题</div></div>' +
      '<div><div class="n">' + done + '</div><div class="l">已读场景</div></div>' +
      '<div><div class="n">' + cmpItems.length + '</div><div class="l">待对比</div></div>' +
      '</div></div></div>' +

      '<div class="wk-sec">' +
      '<div class="wk-sec-h"><h3>收藏的选题</h3>' +
      '<div class="wk-acts">' +
      (rows.length ? '<button type="button" class="btn sm primary" data-wk-exp>导出清单（MD）</button>' : '') +
      '<a class="btn sm ghost" href="#/data">选题问答 →</a>' +
      '</div></div>' +
      '<div class="wk-grid">' + favCards + '</div></div>' +

      '<div class="wk-sec">' +
      '<div class="wk-sec-h"><h3>学习进度</h3>' +
      '<button type="button" class="btn sm ghost" data-wk-clearvis>清空已读记录</button></div>' +
      '<div class="wk-prog-total"><div class="wk-bar big"><i style="width:' + pct + '%"></i></div>' +
      '<b>' + done + ' / ' + total + '</b><span>个场景已读过（' + pct + '%）</span></div>' +
      '<div class="wk-prog-list">' + stageBars + '</div></div>' +

      '<div class="wk-sec">' +
      '<div class="wk-sec-h"><h3>待对比的场景</h3></div>' +
      cmpBlock + '</div>' +

      '<div class="wk-sec">' +
      '<div class="wk-sec-h"><h3>数据导出</h3></div>' +
      '<div class="wk-export">' +
      '<button type="button" class="btn sm ghost" data-lrn-export-atlas>全站场景快照（JSON）</button>' +
      '<span class="wk-ex-hint">77 个场景的元数据快照：环节 / 方法 / 难度 / 数据条件 / 接入状态，可用于离线查阅或二次开发。</span>' +
      '</div></div>' +
      '</main>';
  }

  function bind(view) {
    /* 取消收藏 */
    view.querySelectorAll('[data-wk-unfav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-wk-unfav');
        if (g.Learn && g.Learn.toggleFav) g.Learn.toggleFav(id);
        else {
          var r = ls(FAV, []), i = r.indexOf(id);
          if (i >= 0) { r.splice(i, 1); save(FAV, r); }
        }
        render();
      });
    });
    /* 加入/移出对比 */
    view.querySelectorAll('[data-wk-cmp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-wk-cmp');
        var c = ls(CMP, []), i = c.indexOf(id);
        if (i >= 0) c.splice(i, 1);
        else if (c.length < 3) c.push(id);
        save(CMP, c);
        if (g.Learn && g.Learn.setCompare) g.Learn.setCompare(c);
        render();
      });
    });
    var open = view.querySelector('[data-wk-open]');
    if (open) open.addEventListener('click', function () {
      if (g.Learn && g.Learn.openCompare) g.Learn.openCompare();
    });
    var cc = view.querySelector('[data-wk-clearcmp]');
    if (cc) cc.addEventListener('click', function () {
      save(CMP, []);
      if (g.Learn && g.Learn.setCompare) g.Learn.setCompare([]);
      render();
    });
    var cv = view.querySelector('[data-wk-clearvis]');
    if (cv) cv.addEventListener('click', function () {
      save(VIS, []);
      render();
    });
    /* 收藏清单 MD */
    var exp = view.querySelector('[data-wk-exp]');
    if (exp) exp.addEventListener('click', function () {
      var rows = ls(FAV, []).map(sceneOf).filter(Boolean)
        .map(function (sc) { return { sc: sc, cn: caseCount(sc) }; });
      var blob = new Blob([favMD(rows)], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '我的收藏选题-' + new Date().toISOString().slice(0, 10) + '.md';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
    });
  }

  /* render 由 shell 提供（重绘当前页） */
  function render() {
    if (g.__render) g.__render();
    else location.reload();
  }

  g.WorkPage = { html: html, bind: bind };
})(window);
