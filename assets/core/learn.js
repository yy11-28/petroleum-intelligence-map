/* =========================================================
   learn.js —— 学习与协作增强层
   ---------------------------------------------------------
   以「注入」方式工作：不改动外壳渲染函数，只在页面渲染后
   往既有 DOM 里补充交互元素，配合 polish.css 的样式。
     1. 收藏 / 已读：场景页与场景行上的 ★，localStorage 持久化
     2. 只看收藏：环节页筛选条追加一颗过滤 chip
     3. 场景对比：勾选 2—3 个场景，浮层里并排对比关键要素
     4. 演示模式：示范面板一键进入全屏剧场模式（ESC 退出）
     5. 案例导出：案例库里本机上传的案例一键导出 .zip 互相分享
   依赖：ATLAS（数据层）、Cases（注册表）、CaseImport（导入导出）
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------- 本地存储 ---------------- */
  var FAV_KEY = 'atlas.favs', VIS_KEY = 'atlas.visited', CMP_KEY = 'atlas.compare', FF_KEY = 'atlas.favFilter';

  function lsGet(key, dflt) {
    try { var v = JSON.parse(global.localStorage.getItem(key) || 'null'); return v == null ? dflt : v; }
    catch (e) { return dflt; }
  }
  function lsSet(key, val) { try { global.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  var favs = lsGet(FAV_KEY, []);
  var visited = lsGet(VIS_KEY, []);
  var cmp = lsGet(CMP_KEY, []);

  function isFav(id) { return favs.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    lsSet(FAV_KEY, favs);
    return i < 0;
  }
  function markVisited(id) {
    if (visited.indexOf(id) < 0) { visited.push(id); lsSet(VIS_KEY, visited); }
  }
  function inCmp(id) { return cmp.indexOf(id) >= 0; }
  function toggleCmp(id) {
    var i = cmp.indexOf(id);
    if (i >= 0) { cmp.splice(i, 1); lsSet(CMP_KEY, cmp); return true; }
    if (cmp.length >= 3) return false;
    cmp.push(id); lsSet(CMP_KEY, cmp);
    return true;
  }

  /* ---------------- 小工具 ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lang() { return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'zh'; }
  function L(zh, en) { return lang() === 'en' ? (en || zh) : zh; }
  function sidFromHash() { var m = (global.location.hash || '').match(/#\/scene\/([a-z0-9]+)/i); return m ? m[1] : null; }
  function sidFromHref(href) { var m = String(href || '').match(/#\/scene\/([a-z0-9]+)/i); return m ? m[1] : null; }
  function sceneOf(id) { return (global.ATLAS && global.ATLAS.index && global.ATLAS.index.scene && global.ATLAS.index.scene[id]) || null; }
  function stageOf(id) {
    var A = global.ATLAS; if (!A) return null;
    for (var i = 0; i < A.stages.length; i++) if (A.stages[i].id === id) return A.stages[i];
    return null;
  }

  /* ---------------- 轻提示 ---------------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.querySelector('.lrn-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'lrn-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('on'); }, 2200);
  }

  /* ---------------- 状态同步 ---------------- */
  function syncFavButtons(id) {
    var on = isFav(id);
    [].forEach.call(document.querySelectorAll('[data-lrn-fav="' + id + '"]'), function (b) {
      b.classList.toggle('on', on);
      if (b.closest('.lrn-head-acts')) {
        b.textContent = '★ ' + (on ? L('已收藏', 'Saved') : L('收藏', 'Save'));
      }
      b.setAttribute('title', on ? L('取消收藏', 'Unsave') : L('收藏该场景', 'Save this scene'));
    });
  }
  function syncCmpButtons() {
    [].forEach.call(document.querySelectorAll('[data-lrn-cmp]'), function (b) {
      var id = b.getAttribute('data-lrn-cmp');
      var on = inCmp(id);
      b.classList.toggle('on', on);
      if (b.classList.contains('lrn-cmp-row')) {
        b.textContent = on ? L('✓ 对比中', '✓ Comparing') : L('对比', 'Compare');
        b.setAttribute('title', on ? L('移出场景对比', 'Remove from comparison') : L('把该案例的场景加入对比', 'Add this case to comparison'));
      } else {
        b.setAttribute('title', on ? L('移出对比', 'Remove from comparison') : L('加入对比', 'Add to comparison'));
      }
    });
  }

  /* ---------------- 注入：场景页页头 ---------------- */
  function injectSceneHead(sid, sc) {
    var tags = document.querySelector('.detail-head .dh-tags');
    if (!tags || tags.hasAttribute('data-lrn-done')) return;
    tags.setAttribute('data-lrn-done', '1');
    var wrap = document.createElement('span');
    wrap.className = 'lrn-head-acts';
    wrap.innerHTML =
      '<button type="button" class="lrn-star' + (isFav(sid) ? ' on' : '') + '" data-lrn-fav="' + esc(sid) + '" title="' + (isFav(sid) ? L('取消收藏', 'Unsave') : L('收藏该场景', 'Save this scene')) + '">★ ' + (isFav(sid) ? L('已收藏', 'Saved') : L('收藏', 'Save')) + '</button>';
    tags.appendChild(wrap);
    if (visited.indexOf(sid) >= 0 && !tags.querySelector('.lrn-visited')) {
      var v = document.createElement('span');
      v.className = 'lrn-visited';
      v.textContent = L('已学习', 'Learned');
      tags.appendChild(v);
    }
  }

  /* ---------------- 注入：环节页场景行 ---------------- */
  function injectRowButtons() {
    [].forEach.call(document.querySelectorAll('.scene-row[href*="#/scene/"]'), function (row) {
      if (row.hasAttribute('data-lrn-row')) { row.setAttribute('data-lrn-fav-state', isFav(sidFromHref(row.getAttribute('href'))) ? '1' : '0'); return; }
      row.setAttribute('data-lrn-row', '1');
      var sid = sidFromHref(row.getAttribute('href'));
      if (!sid || !sceneOf(sid)) return;
      row.setAttribute('data-lrn-fav-state', isFav(sid) ? '1' : '0');
      var name = row.querySelector('.sr-name');
      if (!name) return;
      var acts = document.createElement('span');
      acts.className = 'lrn-row-acts';
      acts.innerHTML =
        '<button type="button" class="lrn-star' + (isFav(sid) ? ' on' : '') + '" data-lrn-fav="' + esc(sid) + '" title="' + (isFav(sid) ? L('取消收藏', 'Unsave') : L('收藏该场景', 'Save this scene')) + '">★</button>' +
        '<button type="button" class="lrn-mini-cmp' + (inCmp(sid) ? ' on' : '') + '" data-lrn-cmp="' + esc(sid) + '" title="' + (inCmp(sid) ? L('移出对比', 'Remove from comparison') : L('加入对比', 'Add to comparison')) + '">⇄</button>';
      name.insertBefore(acts, name.firstChild);
      if (isFav(sid)) row.classList.add('lrn-is-fav');
    });
  }

  /* ---------------- 注入：环节页「只看收藏」 ---------------- */
  function favFilterOn() { return lsGet(FF_KEY, false); }

  function injectFavFilter() {
    var filters = document.querySelector('.filters');
    if (!filters || !document.querySelector('.scene-row[href*="#/scene/"]')) return;
    var chip = filters.querySelector('[data-lrn-favfilter]');
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.setAttribute('data-lrn-favfilter', '1');
      filters.appendChild(chip);
    }
    var on = favFilterOn();
    chip.className = 'chip' + (on ? ' on' : '');
    chip.innerHTML = '★ 只看收藏';
    applyFavFilter();
  }

  function applyFavFilter() {
    var on = favFilterOn();
    [].forEach.call(document.querySelectorAll('.scene-row[href*="#/scene/"]'), function (row) {
      var sid = sidFromHref(row.getAttribute('href'));
      if (on) row.style.display = isFav(sid) ? '' : 'none';
      else row.style.display = '';
    });
  }

  /* ---------------- 注入：案例库过滤（收藏场景 / 未学习） ---------------- */
  function caseFilterOn() { return lsGet('atlas.caseFilter', ''); }

  function injectCaseFilter() {
    if (!/^#\/cases/.test(global.location.hash || '')) return;
    var bar = document.querySelector('.console-bar');
    if (!bar) return;
    var wrap = bar.querySelector('[data-lrn-cfilter-wrap]');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'lrn-cfilter';
      wrap.setAttribute('data-lrn-cfilter-wrap', '1');
      wrap.innerHTML =
        '<button type="button" class="chip" data-lrn-cfilter="fav" title="' + L('只显示收藏场景下的案例', 'Show cases of saved scenes only') + '">★ ' + L('收藏场景', 'Saved scenes') + '</button>' +
        '<button type="button" class="chip" data-lrn-cfilter="unread" title="' + L('只显示还没学过的场景下的案例', 'Show cases of unread scenes only') + '">○ ' + L('未学习', 'Unread') + '</button>';
      bar.appendChild(wrap);
    }
    var mode = caseFilterOn();
    [].forEach.call(wrap.querySelectorAll('[data-lrn-cfilter]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-lrn-cfilter') === mode);
    });
    applyCaseFilter();
  }

  function applyCaseFilter() {
    var mode = caseFilterOn();
    [].forEach.call(document.querySelectorAll('.sys-table tbody tr'), function (row) {
      var idCell = row.querySelector('.id');
      if (!idCell) return;
      if (mode === '') { row.style.display = ''; return; }
      var c = global.Cases && global.Cases.get(idCell.textContent.trim());
      var sid = c && c.sceneId;
      var keep = mode === 'fav' ? isFav(sid) : visited.indexOf(sid) < 0;
      row.style.display = keep ? '' : 'none';
    });
  }

  /* ---------------- 注入：案例库行「对比」（该案例的场景加入对比） ---------------- */
  function injectCaseCompare() {
    if (!/^#\/cases/.test(global.location.hash || '')) return;
    [].forEach.call(document.querySelectorAll('.sys-table tbody tr'), function (row) {
      var idCell = row.querySelector('.id');
      if (!idCell || row.querySelector('[data-lrn-cmp]')) return;
      var c = global.Cases && global.Cases.get(idCell.textContent.trim());
      if (!c || !c.sceneId) return;
      var actions = idCell.parentElement.lastElementChild;
      var anchor = actions ? actions.querySelector('.link-remove') : null;
      if (!anchor) return;
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'lrn-cmp-row' + (inCmp(c.sceneId) ? ' on' : '');
      a.setAttribute('data-lrn-cmp', c.sceneId);
      a.setAttribute('title', inCmp(c.sceneId) ? L('移出场景对比', 'Remove from comparison') : L('把该案例的场景加入对比', 'Add this case to comparison'));
      a.textContent = inCmp(c.sceneId) ? L('✓ 对比中', '✓ Comparing') : L('对比', 'Compare');
      actions.insertBefore(a, anchor);
    });
  }

  /* ---------------- 注入：案例库「已学习」进度 ---------------- */
  function injectLearnProgress() {
    if (!/^#\/cases/.test(global.location.hash || '')) return;
    var bar = document.querySelector('.console-bar');
    var A = global.ATLAS;
    if (!bar || !A) return;
    var num = bar.querySelector('[data-lrn-progress-num]');
    if (!num) {
      var firstLbl = bar.querySelector('.lbl');
      if (!firstLbl) return;
      num = document.createElement('span');
      num.className = 'num';
      num.setAttribute('data-lrn-progress-num', '1');
      var lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.setAttribute('data-lrn-progress-lbl', '1');
      lbl.textContent = L('已学习', 'Learned');
      bar.insertBefore(lbl, firstLbl.nextSibling);
      bar.insertBefore(num, lbl);
    }
    num.innerHTML = visited.length + '<small>/' + A.allScenes.length + '</small>';
  }

  /* ---------------- 注入：案例库导出 ---------------- */
  function injectExport() {
    if (!/^#\/cases/.test(global.location.hash || '')) return;
    [].forEach.call(document.querySelectorAll('a.link-remove[data-remove-case]'), function (a) {
      var id = a.getAttribute('data-remove-case');
      var c = global.Cases && global.Cases.get(id);
      if (!c || !c.imported) return;
      if (a.parentNode && a.parentNode.querySelector('[data-lrn-export]')) return;
      var x = document.createElement('a');
      x.href = '#';
      x.className = 'lrn-export';
      x.setAttribute('data-lrn-export', id);
      x.setAttribute('title', L('导出为 .zip 案例包，可直接分享给同学导入', 'Export as a .zip package to share'));
      x.textContent = L('导出', 'Export');
      a.parentNode.insertBefore(x, a);
    });
  }

  /* ---------------- 注入：演示模式按钮 ---------------- */
  function injectTheater() {
    var panel = document.querySelector('.panel[data-panel="demo"]');
    if (!panel || !panel.classList.contains('on')) return;
    if (!document.getElementById('case-demo-root')) return;
    if (panel.querySelector('[data-lrn-theater]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lrn-theater-btn';
    btn.setAttribute('data-lrn-theater', '1');
    btn.innerHTML = '⛶ ' + L('演示模式', 'Theater') + '<span>' + L('全屏观看示范，ESC 退出', 'Fullscreen · ESC to exit') + '</span>';
    panel.appendChild(btn);
  }

  function setTheater(on) {
    document.body.classList.toggle('demo-theater', !!on);
    var exit = document.querySelector('.lrn-theater-exit');
    if (on && !exit) {
      exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'lrn-theater-exit';
      exit.setAttribute('data-lrn-exit-theater', '1');
      exit.innerHTML = '✕ ' + L('退出演示', 'Exit');
      document.body.appendChild(exit);
    } else if (!on && exit) {
      exit.remove();
    }
  }

  /* ---------------- 对比浮层 ---------------- */
  function ensureCompareModal() {
    var ov = document.querySelector('.cmp-ov');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'cmp-ov';
    ov.hidden = true;
    ov.innerHTML =
      '<div class="cmp-bg" data-lrn-cmp-close="1"></div>' +
      '<div class="cmp-p">' +
      '<div class="cmp-h"><div><div class="eyebrow">COMPARE · 场景对比</div><h3>场景对比</h3></div>' +
      '<button type="button" class="cmp-x" data-lrn-cmp-close="1">✕</button></div>' +
      '<div class="cmp-b"><div class="cmp-grid"></div></div>' +
      '<div class="cmp-f">' + L('最多同时对比 3 个场景；在案例库或环节页点「对比」加入。', 'Compare up to 3 scenes; click "Compare" in the registry or stage pages.') + '<span class="sp"></span>' +
      '<button type="button" class="btn ghost sm" data-lrn-clear-cmp>' + L('清空', 'Clear') + '</button></div>' +
      '</div></div>';
    document.body.appendChild(ov);
    return ov;
  }

  function cmpCell(k, cells) {
    return '<div class="cmp-k">' + k + '</div>' + cells.map(function (v) { return '<div class="cmp-c">' + v + '</div>'; }).join('');
  }

  function buildCompare() {
    var A = global.ATLAS, grid = document.querySelector('.cmp-ov .cmp-grid');
    if (!grid) return;
    var items = cmp.map(function (id) { return { id: id, sc: sceneOf(id) }; }).filter(function (x) { return x.sc; });
    var n = Math.max(items.length, 1);
    grid.style.setProperty('--cmp-cols', '96px repeat(' + n + ',minmax(0,1fr))');
    var rows = [];

    rows.push('<div class="cmp-k"></div>' + items.map(function (x) {
      return '<div class="cmp-c cmp-name"><a href="#/scene/' + esc(x.id) + '" data-lrn-cmp-close="1">' + esc(x.sc.name) + '</a><span class="mono">' + esc(x.id.toUpperCase()) + '</span></div>';
    }).join(''));
    rows.push(cmpCell('环节', items.map(function (x) {
      var st = stageOf(x.sc.stageId);
      return '<span class="tag">' + esc(st ? st.name : x.sc.stageId) + '</span>';
    })));
    rows.push(cmpCell('难度', items.map(function (x) {
      return '<span class="dtag" data-d="' + esc(x.sc.diff) + '">难度 ' + esc(x.sc.diff) + '</span>';
    })));
    rows.push(cmpCell('涉及技术', items.map(function (x) {
      return (x.sc.methods || []).map(function (k) {
        return '<span class="mtag" data-m="' + esc(k) + '"><b>' + esc(k.toUpperCase()) + '</b></span>';
      }).join('') || '—';
    })));
    rows.push(cmpCell('介入点', items.map(function (x) {
      return '<p class="cmp-pt">' + esc(x.sc.point) + '</p>';
    })));
    rows.push(cmpCell('数据条件', items.map(function (x) {
      return '<ul class="cmp-data">' + (x.sc.data || []).slice(0, 4).map(function (d) {
        return '<li><b>' + esc(d[0]) + '</b>' + esc(d[1]) + '</li>';
      }).join('') + '</ul>';
    })));
    rows.push(cmpCell('参考方向', items.map(function (x) {
      return (x.sc.refs || []).map(function (r) { return '<span class="tag">' + esc(r) + '</span>'; }).join('') || '—';
    })));
    rows.push(cmpCell('案例接入', items.map(function (x) {
      var cs = global.Cases ? global.Cases.bySceneAll(x.id) : [];
      if (!cs.length) return '<span class="lrn-cmp-none">待接入</span>';
      var demo = cs.some(function (c) { return c.tabs && c.tabs.demo; });
      return '<b>' + cs.length + '</b> 个案例 ' + (demo ? '<span class="badge-ready">可运行</span>' : '');
    })));

    grid.innerHTML = rows.map(function (r) { return '<div class="cmp-row">' + r + '</div>'; }).join('');
  }

  function openCompare() {
    if (!cmp.length) { toast('先在场景行点 ⇄ 加入要对比的场景'); return; }
    var ov = ensureCompareModal();
    buildCompare();
    ov.hidden = false;
    document.body.classList.add('cmp-open');
  }
  function closeCompare() {
    var ov = document.querySelector('.cmp-ov');
    if (ov) ov.hidden = true;
    document.body.classList.remove('cmp-open');
  }

  /* ---------------- 对比托盘 ---------------- */
  function renderTray() {
    var tray = document.querySelector('.lrn-tray');
    if (!cmp.length) { if (tray) tray.remove(); return; }
    if (!tray) {
      tray = document.createElement('div');
      tray.className = 'lrn-tray';
      document.body.appendChild(tray);
    }
    tray.innerHTML =
      '<span class="lrn-tray-lbl">' + L('对比', 'COMPARE') + '</span>' +
      cmp.map(function (id) {
        var sc = sceneOf(id);
        return '<span class="lrn-tray-chip">' + esc(sc ? sc.name : id) +
          '<button type="button" data-lrn-cmp="' + esc(id) + '" title="' + L('移出', 'Remove') + '">✕</button></span>';
      }).join('') +
      '<button type="button" class="btn primary sm" data-lrn-open-cmp>' + L('对比', 'Compare') + '（' + cmp.length + '/3）</button>';
  }

  /* ---------------- 事件委托 ---------------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var favBtn = t.closest ? t.closest('[data-lrn-fav]') : null;
    if (favBtn) {
      e.preventDefault(); e.stopPropagation();
      var fid = favBtn.getAttribute('data-lrn-fav');
      var on = toggleFav(fid);
      syncFavButtons(fid);
      toast(on ? '已收藏「' + ((sceneOf(fid) || {}).name || fid) + '」' : '已取消收藏');
      enhance();
      return;
    }

    var cmpBtn = t.closest ? t.closest('[data-lrn-cmp]') : null;
    if (cmpBtn) {
      e.preventDefault(); e.stopPropagation();
      var cid = cmpBtn.getAttribute('data-lrn-cmp');
      var ok = toggleCmp(cid);
      if (!ok) { toast('最多同时对比 3 个场景，先移出一个'); return; }
      syncCmpButtons();
      renderTray();
      var ov = document.querySelector('.cmp-ov');
      if (ov && !ov.hidden) buildCompare();
      return;
    }

    if (t.closest('[data-lrn-open-cmp]')) { e.preventDefault(); openCompare(); return; }
    if (t.closest('[data-lrn-clear-cmp]')) {
      e.preventDefault();
      cmp.length = 0; lsSet(CMP_KEY, cmp);
      syncCmpButtons(); renderTray(); closeCompare();
      return;
    }
    if (t.closest('[data-lrn-cmp-close]')) { e.preventDefault(); closeCompare(); return; }

    if (t.closest('[data-lrn-theater]')) { e.preventDefault(); setTheater(true); return; }
    if (t.closest('[data-lrn-exit-theater]')) { e.preventDefault(); setTheater(false); return; }

    var ff = t.closest ? t.closest('[data-lrn-favfilter]') : null;
    if (ff) {
      e.preventDefault();
      lsSet(FF_KEY, !favFilterOn());
      injectFavFilter();
      return;
    }

    var cf = t.closest ? t.closest('[data-lrn-cfilter]') : null;
    if (cf) {
      e.preventDefault();
      var val = cf.getAttribute('data-lrn-cfilter');
      lsSet('atlas.caseFilter', caseFilterOn() === val ? '' : val);
      injectCaseFilter();
      return;
    }

    var ex = t.closest ? t.closest('[data-lrn-export]') : null;
    if (ex) {
      e.preventDefault();
      var id = ex.getAttribute('data-lrn-export');
      var r = global.CaseImport && global.CaseImport.export ? global.CaseImport.export(id) : { ok: false, error: '导出接口不可用' };
      toast(r && r.ok ? '已导出 ' + id + '.zip，可直接发给同学导入' : (r && r.error) || '导出失败');
      return;
    }

    var ax = t.closest ? t.closest('[data-lrn-export-atlas]') : null;
    if (ax) {
      e.preventDefault();
      try {
        var A = global.ATLAS;
        var snap = {
          site: '石油勘探开发的智能化可能性地图 · Petro × AI Atlas',
          exportedAt: new Date().toISOString(),
          totals: { stages: A.stages.length, scenes: A.allScenes.length },
          stages: A.stages.map(function (st) {
            return {
              idx: st.idx, id: st.id, name: st.name, en: st.en,
              scenes: st.scenes.map(function (sc) {
                var cs = global.Cases ? global.Cases.bySceneAll(sc.id) : [];
                return {
                  id: sc.id, name: sc.name, methods: sc.methods, diff: sc.diff,
                  diffWhy: sc.diffWhy || '', point: sc.point || '',
                  data: sc.data || [], refs: sc.refs || [],
                  cross: sc.cross || [], status: sc.status || '',
                  demo: !!sc.demo,
                  datasets: (sc.ds || []).map(function (d) { return d[0]; }),
                  cases: cs.map(function (c) {
                    return { id: c.id, title: c.title, version: c.version || '', imported: !!c.imported,
                             hasDemo: !!(c.tabs && c.tabs.demo) };
                  })
                };
              })
            };
          })
        };
        var blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'petro-ai-atlas-scenes.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast('已导出 petro-ai-atlas-scenes.json（' + A.allScenes.length + ' 个场景）');
      } catch (err) {
        toast('导出失败：' + err.message);
      }
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.body.classList.contains('demo-theater')) setTheater(false);
      closeCompare();
    }
  });

  /* ---------------- 渲染增强入口 ---------------- */
  function enhance() {
    var hash = global.location.hash || '#/';

    if (/^#\/scene\//.test(hash)) {
      var sid = sidFromHash();
      var sc = sceneOf(sid);
      if (sc) { markVisited(sid); injectSceneHead(sid, sc); }
    }

    injectRowButtons();
    injectFavFilter();
    injectCaseCompare();
    injectExport();
    injectCaseFilter();
    injectLearnProgress();
    injectTheater();
    renderTray();

    /* 收藏过滤在换页后保持生效 */
    if (favFilterOn()) applyFavFilter();
  }

  /* 只观察 #view 的子树变化：外壳每次路由都重渲染 */
  var pending = null;
  var mo = new MutationObserver(function () {
    if (pending) clearTimeout(pending);
    pending = setTimeout(enhance, 60);
  });

  function start() {
    var view = document.getElementById('view');
    if (!view) { setTimeout(start, 200); return; }
    mo.observe(view, { childList: true, subtree: true });
    enhance();
    global.addEventListener('hashchange', function () { setTimeout(enhance, 80); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* 对外调试接口 */
  global.Learn = {
    favs: function () { return favs.slice(); },
    visited: function () { return visited.slice(); },
    compare: function () { return cmp.slice(); },
    toggleFav: toggleFav,
    openCompare: openCompare,
    /* 完井模块调用：整体替换对比集合（≤3）并刷新 UI */
    setCompare: function (ids) {
      cmp = (ids || []).filter(function (id, i, a) { return a.indexOf(id) === i; }).slice(0, 3);
      lsSet(CMP_KEY, cmp);
      syncCmpButtons();
      renderTray();
    }
  };
})(window);
