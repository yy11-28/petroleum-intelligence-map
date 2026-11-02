/* =========================================================
   find.js —— 选题面板（嵌入 #/data 数据资产页右侧）
   ---------------------------------------------------------
   「我手头有这些数据，能做什么题？」
     1. 勾选已有数据类型（11 类全站口径）
     2. 按「数据齐备程度」把候选场景分成三档：
        数据齐备 / 只差一类 / 缺口较大，并逐条列出缺口
     3. 导出开题说明 MD（含数据缺口与下一步准备建议）
   本模块不再有独立页面（原 #/find 已并入 #/data 右侧）；
   旧链接 #/find 由 shell.js 重定向到 #/data。
   结果只做参考，不构成任何等级判断；数据条件以本单位实际为准。
   纯前端计算，不新增场景与案例。
   ========================================================= */

(function (g) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MATDEF = [
    { k: '仿真', name: '案例极少', col: '#B7C6D6' }, { k: '小试', name: '案例较少', col: '#3D86BD' },
    { k: '试用', name: '案例若干', col: '#238868' }, { k: '常态', name: '案例较多', col: '#1B6B51' }
  ];
  var INNDEF = [{ k: '高', col: '#9A5A28' }, { k: '中', col: '#3D86BD' }, { k: '成熟', col: '#7E93A8' }];

  var A = null, SM = null, CATS = [], MAT = MATDEF, INN = INNDEF, MAT_ORDER = {};

  function init() {
    A = g.ATLAS;
    SM = g.STAGE_META;
    if (SM && SM.DATA_CATS) CATS = SM.DATA_CATS;
    if (SM && SM.MAT && SM.MAT.length) MAT = SM.MAT;
    if (SM && SM.INN && SM.INN.length) INN = SM.INN;
    MAT.forEach(function (m, i) { MAT_ORDER[m.k] = i; });
  }

  /* ---------------- 场景元数据 ---------------- */
  function matOf(sc) {
    if (sc.maturity) return sc.maturity;
    if (SM && SM.owns && SM.owns(sc.stageId)) return SM.maturityOf(sc.stageId, sc.id);
    return '仿真';
  }
  function innOf(sc) {
    if (sc.innov) return sc.innov;
    if (SM && SM.owns && SM.owns(sc.stageId)) return SM.innovOf(sc.stageId, sc.id);
    return '中';
  }
  function depsOf(sc) {
    if (sc.deps && sc.deps.length) return sc.deps;
    if (SM && SM.owns && SM.owns(sc.stageId)) return SM.depsOf(sc.stageId, sc.id) || [];
    return [];
  }
  function caseCount(sc) { return g.Cases ? g.Cases.bySceneAll(sc.id).length : 0; }
  function matName(k) {
    for (var i = 0; i < MAT.length; i++) if (MAT[i].k === k) return MAT[i].name || MAT[i].k;
    return k;
  }
  function catName(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i].name;
    return k;
  }

  /* 场景对某类数据的需求：2 = 需要（在数据清单里），1 = 可选（正文提及） */
  function needOf(sc) {
    var out = [];
    CATS.forEach(function (c) { if (SM && SM.cellOf(sc, c.k) === 2) out.push(c.k); });
    return out;
  }
  function optOf(sc) {
    var out = [];
    CATS.forEach(function (c) { if (SM && SM.cellOf(sc, c.k) === 1) out.push(c.k); });
    return out;
  }

  /* ---------------- 计算 ---------------- */
  function analyse(f) {
    var have = f.d.slice();
    var rows = [];
    A.stages.forEach(function (st) {
      st.scenes.forEach(function (sc) {
        if (f.m && (sc.methods || []).indexOf(f.m) < 0) return;
        if (f.df && sc.diff !== f.df) return;
        if (f.q) {
          var t = [sc.name, sc.point || '', sc.intro || '', sc.id].join(' ').toLowerCase();
          if (t.indexOf(f.q) < 0) return;
        }
        var need = needOf(sc), miss = [], hit = [];
        need.forEach(function (k) { (have.indexOf(k) >= 0 ? hit : miss).push(k); });
        rows.push({
          sc: sc, need: need, miss: miss, hit: hit,
          opt: optOf(sc).filter(function (k) { return have.indexOf(k) < 0; }),
          mat: matOf(sc), inn: innOf(sc), cn: caseCount(sc)
        });
      });
    });

    var ready = rows.filter(function (r) { return r.miss.length === 0; });
    var near = rows.filter(function (r) { return r.miss.length === 1; });
    var far = rows.filter(function (r) { return r.miss.length >= 2; });

    function sort(arr) {
      return arr.sort(function (x, y) {
        if (f.s === 'new') {   /* 新题优先：创新度高、公开案例丰富度靠前段 */
          var iy = INN.map(function (i) { return i.k; });
          var d = iy.indexOf(x.inn) - iy.indexOf(y.inn);
          if (d) return d;
        } else if (f.s === 'do') {   /* 落地优先：成熟度靠后段（试用/常态） */
          var dm = MAT_ORDER[y.mat] - MAT_ORDER[x.mat];
          if (dm) return dm;
        }
        if (x.miss.length !== y.miss.length) return x.miss.length - y.miss.length;
        if (y.hit.length !== x.hit.length) return y.hit.length - x.hit.length;
        if (x.cn !== y.cn) return y.cn - x.cn;
        if (x.sc.diff !== y.sc.diff) return x.sc.diff === '低' ? -1 : (y.sc.diff === '低' ? 1 : 0);
        return x.sc.name < y.sc.name ? -1 : 1;
      });
    }
    return { rows: rows, ready: sort(ready), near: sort(near), far: sort(far), have: have };
  }

  /* ---------------- 导出开题说明 ---------------- */
  function exportMD(f) {
    init();
    f = f || { d: [], m: '', df: '', s: '', q: '' };
    var an = analyse(f);
    var l = [];
    l.push('# 开题说明草稿 · 选题面板结果');
    l.push('');
    l.push('> 由「石油勘探开发智能化可能性地图」数据资产页右侧的选题面板（#/data）生成，日期 ' + new Date().toISOString().slice(0, 10) + '。');
    l.push('> 数据齐备程度按场景自带数据清单与全站归一字典估算，样本量、标注口径与可得性需另行核实。');
    l.push('');
    l.push('## 一、已具备的数据');
    l.push('');
    l.push(f.d.length ? f.d.map(function (k) { return '- ' + catName(k); }).join('\n') : '- （未勾选）');
    l.push('');

    function dump(title, arr, extra) {
      if (!arr.length) return;
      l.push('## ' + title + '（' + arr.length + ' 个）');
      l.push('');
      if (extra) { l.push(extra); l.push(''); }
      arr.forEach(function (r, i) {
        l.push('### ' + (i + 1) + '. ' + r.sc.id.toUpperCase() + '　' + r.sc.name + '（' + r.sc.stageName + '）');
        l.push('');
        l.push('- AI 介入点：' + (r.sc.point || '—'));
        l.push('- 难度 ' + r.sc.diff + ' · 公开案例丰富度 ' + matName(r.mat) + ' · 创新度 ' + r.inn +
          (r.cn ? ' · 站内已有案例 ' + r.cn + ' 个' : ' · 站内暂无案例'));
        l.push('- 已具备数据：' + (r.hit.length ? r.hit.map(catName).join('、') : '—'));
        l.push('- 待补数据：' + (r.miss.length ? r.miss.map(catName).join('、') : '无'));
        if (r.opt && r.opt.length) l.push('- 可选补充：' + r.opt.map(catName).join('、'));
        var up = depsOf(r.sc);
        if (up.length) l.push('- 上游场景（其输出可复用）：' + up.map(function (id) {
          var t = A.index.byScene[id]; return (t ? t.name : id) + '（' + id.toUpperCase() + '）';
        }).join('、'));
        l.push('- 下一步：' + (r.miss.length
          ? '先落实「' + r.miss.map(catName).join('、') + '」的样本量与口径，再确认标注成本。'
          : '确认样本量与标注口径，复现站内同类方法做基线。'));
        l.push('- 选题勾选：□ 候选　□ 数据不足　□ 已有同类　□ 排除');
        l.push('');
      });
    }
    dump('数据齐备：清单层面的必需项已匹配', an.ready,
      '仅表示元数据标注的必需数据你都勾了；数据质量、样本量、合规性与现场授权未经核验。');
    dump('只差一类：仅缺一类必需数据', an.near,
      '把缺的这一类补齐即可进入上述核对；清单之外能否获取，仍需本单位确认。');
    dump('缺口较大：必需数据缺口较多', an.far,
      '缺两类以上，一般先做数据整理，或改走更容易拿到数据的题目。');

    var blob = new Blob([l.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'topic-brief-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* ---------------- 选题面板（嵌在 #/data 右侧） ----------------
     状态存在模块内 MINI，不走 URL：在右侧勾选不会打断左侧的阅读位置。 */
  var MINI = { d: [], more: false };

  function miniF() { return { d: MINI.d.slice(), m: '', df: '', s: '', q: '' }; }

  function miniCats() {
    return CATS.map(function (c) {
      var on = MINI.d.indexOf(c.k) >= 0;
      return '<button type="button" class="fm-cat' + (on ? ' on' : '') + '" data-fd-c="' + c.k +
        '" title="' + esc(c.name) + '"><i></i>' + esc(c.name) + '</button>';
    }).join('');
  }

  function miniRow(r) {
    return '<li><a href="#/scene/' + r.sc.id + '">' + esc(r.sc.name) + '</a>' +
      '<span class="fm-where">' + esc(r.sc.stageName) + '</span>' +
      '<span class="fm-miss' + (r.miss.length ? '' : ' ok') + '">' +
      (r.miss.length ? '缺 ' + r.miss.map(catName).join('、') : '已齐备') + '</span></li>';
  }

  function miniGroup(title, arr) {
    if (!arr.length) return '';
    var lim = MINI.more ? 999 : 5;
    return '<div class="fm-g"><h4>' + esc(title) + '<span>' + arr.length + '</span></h4>' +
      '<ul>' + arr.slice(0, lim).map(miniRow).join('') + '</ul>' +
      (arr.length > 5
        ? '<button type="button" class="fm-more" data-fd="mini-more">' +
          (MINI.more ? '收起' : '看全部 ' + arr.length + ' 个 →') + '</button>'
        : '') +
      '</div>';
  }

  function miniHTML() {
    init();
    if (!A || !A.stages || !CATS.length) return '';
    var an = analyse(miniF());
    return '<div class="fd-mini">' +
      '<div class="fm-h"><span class="kicker">FIND YOUR TOPIC</span>' +
      '<h3>按手头数据选题</h3>' +
      '<p>勾选你能拿到的数据，立刻看哪些场景的数据条件成立。' +
      '在左侧某类数据的详情里点「用这类数据选题」，可以把这一类带到这里。</p></div>' +
      '<div class="fm-cats">' + miniCats() + '</div>' +
      '<div class="fm-pick">' + (MINI.d.length
        ? '已选 <b>' + MINI.d.length + '</b> 类'
        : '未勾选任何数据：先勾两三类看看结果。') +
      (MINI.d.length ? '<button type="button" class="fm-clr" data-fd="mini-clear">清空</button>' : '') + '</div>' +
      '<div class="fm-stat">' +
      '<div><b>' + an.ready.length + '</b><span>已匹配</span></div>' +
      '<div><b>' + an.near.length + '</b><span>只差一类</span></div>' +
      '<div><b>' + an.far.length + '</b><span>缺口较大</span></div>' +
      '</div>' +
      '<div class="fm-res">' +
      (an.ready.length || an.near.length
        ? miniGroup('数据齐备', an.ready) + miniGroup('只差一类', an.near)
        : '<div class="fm-empty">当前勾选下还没有「已匹配 / 只差一类」的场景：再勾几类数据试试。</div>') +
      '</div>' +
      '<div class="fm-acts">' +
      '<button type="button" class="btn sm primary" data-fd="mini-exp">导出开题说明（MD）</button>' +
      '</div>' +
      '<p class="fm-note">只核对元数据标注的必需数据是否勾选；数据质量、样本量、合规性与现场授权未经核验。</p>' +
      '</div>';
  }

  /* rerender 由宿主提供：替换面板内容后重新绑定（用 onclick 覆盖，避免监听累积） */
  function miniBind(side, rerender) {
    init();
    if (!A) return;
    side.onclick = function (e) {
      var cat = e.target.closest('[data-fd-c]');
      if (cat) {
        var k = cat.getAttribute('data-fd-c'), i = MINI.d.indexOf(k);
        if (i >= 0) MINI.d.splice(i, 1); else MINI.d.push(k);
        rerender();
        return;
      }
      if (e.target.closest('[data-fd="mini-clear"]')) { MINI.d = []; MINI.more = false; rerender(); return; }
      if (e.target.closest('[data-fd="mini-more"]')) { MINI.more = !MINI.more; rerender(); return; }
      if (e.target.closest('[data-fd="mini-exp"]')) { exportMD(miniF()); return; }
    };
  }

  function toggleMini(k) {
    if (!k) return;
    var i = MINI.d.indexOf(k);
    if (i >= 0) MINI.d.splice(i, 1); else MINI.d.push(k);
  }

  /* 从左侧数据详情带入：确保这一类被勾上（已勾则保持不变） */
  function ensureMini(k) {
    if (!k) return;
    if (MINI.d.indexOf(k) < 0) MINI.d.push(k);
  }

  g.FindPanel = { miniHTML: miniHTML, miniBind: miniBind, toggleMini: toggleMini, ensureMini: ensureMini, miniF: miniF };
})(window);
