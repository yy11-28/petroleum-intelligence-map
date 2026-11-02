/* =========================================================
   data.js —— 数据资产页 #/data
   ---------------------------------------------------------
   把全站归一后的 11 类数据口径摊开讲清楚：
     这类数据是什么 / 从哪来 / 常见坑 / 哪些场景需要它 / 覆盖到哪些环节
   所有统计都由场景元数据实时算出（STAGE_META.cellOf），页面内只补充
   「定义 / 常见来源 / 常见坑」三类说明文案，不改动数据层。
   ========================================================= */
(function (g) {
  'use strict';

  var A = null, SM = null, CATS = [];

  /* 每类数据的说明：d 定义 / s 常见来源 / t 常见坑 */
  var NOTE = {
    D1: ['照片、显微图像、电成像、示功图、监控视频这类以像素为载体的资料',
      '实验室、现场摄像头、井下成像仪、录井视频',
      '同一设备不同批次分辨率与色彩口径不一，需要先归一化；图像里的时间/深度信息常不见了'],
    D2: ['炮集、道集、属性体、微地震监测、近地表调查等地球物理数据体',
      '物探采集与处理解释中心',
      '体量大、版本多，不同年份处理流程不一致，同一区块的两次成果往往不能直接合并'],
    D3: ['常规九条曲线、CBL/VDL、井径、电成像/声成像等井筒连续测量记录',
      '测井队、随钻测量、固井质量测井',
      '深度对齐与不同仪器刻度差异是要害，缺失段怎么补直接影响模型能不能用'],
    D4: ['钻井参数、生产参数、DCS 运行参数、压力/流量/温度/振动等时间序列',
      'SCADA、DCS、实时数据库、现场计量',
      '采样频率不齐，工况切换段和稳态混在一起，建模前通常要先把稳态/过渡态分开'],
    D5: ['岩心描述、薄片、物性分析、流体性质、配伍与靶件实验',
      '研究院实验室、化验中心',
      '样本少、批次效应明显，结论代表性取决于取样设计，不取决于模型复杂度'],
    D6: ['设计书、完井总结、地质描述、工单、规范与事故报告等非结构化文本',
      '各岗位归档、资料室、OA',
      '口径随人变化，同类事件写法差异大；抽取结果必须有人工复核环节'],
    D7: ['施工记录、检修台账、事件与事故、历史先例、整改反馈',
      '作业现场、设备管理、生产例会',
      '记录不及时、关键字段缺失是常态；异常样本本来就少，这类数据尤其金贵'],
    D8: ['套管管材、射孔弹型、扶正器、药剂、仪器、价格库与定额库',
      '厂商资料、物资与定额部门',
      '型号别名多、跨单位命名不统一，几乎总要做一遍实体对齐才能用'],
    D9: ['构造、地层、沉积相、地应力、压力体系、剩余油分布等地质与油藏模型',
      '地质/油藏研究院、建模工作站',
      '模型版本多、网格与坐标系各异，加载前通常要投影转换与重采样'],
    D10: ['解释成果、缺陷掩膜、事件标签、验证与确认样本',
      '由专家人工标注产生',
      '最贵也最缺的一环，标注一致性（多人交叉）基本决定了模型上限'],
    D11: ['油价、电价、材料价格、投资计划、环保与安全约束、定额与费用标准',
      '计划经营部门、公开市场、主管部门文件',
      '口径随时间变化，必须写清基准年与假设条件，否则结论无法复现']
  };

  function init() {
    A = g.ATLAS;
    SM = g.STAGE_META;
    if (SM && SM.DATA_CATS) CATS = SM.DATA_CATS;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 某类数据的需求统计：need 必需 / opt 提及 / cases 已接入 / stages 覆盖环节 */
  function statOf(k) {
    var need = [], opt = [], stageSet = {}, cases = 0;
    A.stages.forEach(function (st) {
      st.scenes.forEach(function (sc) {
        var lv = SM ? SM.cellOf(sc, k) : 0;
        if (!lv) return;
        if (lv === 2) need.push(sc);
        else opt.push(sc);
        stageSet[st.id] = 1;
        if (g.Cases && g.Cases.bySceneAll(sc.id).length) cases++;
      });
    });
    return {
      need: need, opt: opt, cases: cases,
      stages: Object.keys(stageSet).length,
      total: A.allScenes.length
    };
  }

  /* 全站矩阵：环节 × 数据类，值为该环节必需的用例数 */
  function matrix() {
    return A.stages.map(function (st) {
      var row = [st];
      CATS.forEach(function (c) {
        var n = 0, m = 0;
        st.scenes.forEach(function (sc) {
          var lv = SM ? SM.cellOf(sc, c.k) : 0;
          if (lv === 2) n++; else if (lv === 1) m++;
        });
        row.push({ n: n, m: m });
      });
      return row;
    });
  }

  function catCard(c, st, cur) {
    var kw = (c.kw || []).slice(0, 6).map(function (w) {
      return '<span>' + esc(w) + '</span>';
    }).join('');
    var pct = st.total ? Math.round(st.need.length / st.total * 100) : 0;
    var note = NOTE[c.k] || [];
    return '<button type="button" class="dc-card' + (cur === c.k ? ' on' : '') + '" data-dc="' + c.k + '">' +
      '<div class="dc-top"><span class="dc-id">' + esc(c.k) + '</span>' +
      '<span class="dc-n">必需 ' + st.need.length + '</span></div>' +
      '<b class="dc-name">' + esc(c.name) + '</b>' +
      '<p class="dc-desc">' + esc(note[0] || '') + '</p>' +
      '<div class="dc-kw">' + kw + '</div>' +
      '<div class="dc-bar"><i style="width:' + pct + '%"></i>' +
      '<em>' + pct + '% 场景必需 · 覆盖 ' + st.stages + ' 环节</em></div>' +
      '</button>';
  }

  function detail(c, st) {
    var note = NOTE[c.k] || [];
    var rows = st.need.concat(st.opt).map(function (sc) {
      var lv = SM.cellOf(sc, c.k);
      var cn = g.Cases ? g.Cases.bySceneAll(sc.id).length : 0;
      return '<tr><td>' + esc(sc.stageName) + '</td>' +
        '<td><a href="#/scene/' + sc.id + '">' + esc(sc.name) + '</a></td>' +
        '<td>' + (lv === 2 ? '<span class="dc-lv need">必需</span>' : '<span class="dc-lv opt">提及</span>') + '</td>' +
        '<td>' + (cn ? '<span class="ok-mark">已有 ' + cn + ' 案例</span>' : '<span class="dim-mark">待接入</span>') + '</td>' +
        '<td class="mono">' + esc(sc.diff || '—') + '</td></tr>';
    }).join('');

    return '<div class="dc-detail">' +
      '<button type="button" class="btn sm ghost dc-back" data-dc="close">← 返回数据卡片</button>' +
      '<div class="dc-d-h"><span class="dc-id big">' + esc(c.k) + '</span>' +
      '<h3>' + esc(c.name) + '</h3>' +
      '<div class="dc-d-acts">' +
      '<button type="button" class="btn sm primary" data-dc-use="' + c.k + '">用这类数据选题 →</button>' +
      '<a class="btn sm ghost" href="#/map">看依赖图</a>' +
      '</div></div>' +
      '<div class="dc-d-note">' +
      '<div><b>这类数据是什么</b><p>' + esc(note[0] || '—') + '</p></div>' +
      '<div><b>通常从哪来</b><p>' + esc(note[1] || '—') + '</p></div>' +
      '<div><b>常见坑</b><p>' + esc(note[2] || '—') + '</p></div>' +
      '</div>' +
      '<div class="dc-d-stat">' +
      '<div><b>' + st.need.length + '</b><span>必需该类数据的场景</span></div>' +
      '<div><b>' + st.opt.length + '</b><span>正文提及的场景</span></div>' +
      '<div><b>' + st.cases + '</b><span>已接入案例</span></div>' +
      '<div><b>' + st.stages + '</b><span>覆盖环节</span></div>' +
      '</div>' +
      '<div class="matrix-wrap"><table class="sys-table"><thead><tr>' +
      '<th>作业环节</th><th>场景</th><th>需求程度</th><th>案例</th><th>难度</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="empty">暂无场景需要这类数据</td></tr>') +
      '</tbody></table></div></div>';
  }

  function html(q) {
    if (!A) init();
    if (!A || !CATS.length) {
      return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>数据字典未加载</b>' +
        '请确认 assets/stage-meta.js 与 assets/data.js 已引入。</div></main>';
    }

    var cur = (q && q.cat) || '';
    var stats = {};
    CATS.forEach(function (c) { stats[c.k] = statOf(c.k); });

    var cards = CATS.map(function (c) { return catCard(c, stats[c.k], cur); }).join('');

    /* 环节 × 数据类矩阵 */
    var mx = matrix();
    var maxN = 1;
    mx.forEach(function (row) {
      for (var i = 1; i < row.length; i++) if (row[i].n > maxN) maxN = row[i].n;
    });
    var mHead = CATS.map(function (c) {
      var short = c.name.split(' / ')[0];
      return '<th class="dc-mth' + (cur === c.k ? ' on' : '') + '" data-dc="' + c.k + '" title="' + esc(c.name) + '">' +
        esc(short) + '</th>';
    }).join('');
    var mBody = mx.map(function (row) {
      var st = row[0];
      var cells = '';
      for (var i = 1; i < row.length; i++) {
        var v = row[i];
        var a = v.n ? (0.12 + 0.62 * v.n / maxN) : 0;
        cells += '<td class="dc-mc' + (v.n ? ' has' : '') + '" style="background:rgba(26,71,121,' + a.toFixed(2) + ')"' +
          ' title="' + esc(st.name + ' · ' + CATS[i - 1].name + '：' + v.n + ' 必需 / ' + v.m + ' 提及') + '">' +
          (v.n || '') + '</td>';
      }
      return '<tr><th class="dc-mrh">' + esc(st.name) + '</th>' + cells + '</tr>';
    }).join('');

    var totalNeed = CATS.reduce(function (a, c) { return a + stats[c.k].need.length; }, 0);
    var avg = (totalNeed / A.allScenes.length).toFixed(1);

    return '<main class="wrap">' +
      '<nav class="crumb"><a href="#/">总览</a><span class="sep">/</span>' +
      '<span>数据资产</span></nav>' +
      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">DATA ASSETS</div>' +
      '<h1>数据资产</h1>' +
      '<p class="blurb">全站把 77 个场景需要的数据归一到 11 类口径。弄清楚每一类到底是什么、从哪来、容易在哪出错，才能判断一个题目能不能起步。</p>' +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + CATS.length + '</div><div class="l">类数据口径</div></div>' +
      '<div><div class="n">' + avg + '</div><div class="l">场景平均需要</div></div>' +
      '<div><div class="n">' + (g.Cases ? g.Cases.stats().coveredScenes : 0) + '</div><div class="l">有案例场景</div></div>' +
      '</div></div></div>' +

      '<div class="dc-layout">' +
      '<div class="dc-main">' +
      /* 有选中类别：详情整页覆盖卡片网格，顶部返回按钮回卡片页 */
      (cur && stats[cur]
        ? detail((function () {
            var sel = { k: cur, name: '' };
            CATS.forEach(function (c) { if (c.k === cur) sel = c; });
            return sel;
          })(), stats[cur])
        : '<div class="dc-grid">' + cards + '</div>') +

      '<div class="section" style="padding:40px 0 8px">' +
      '<div class="sec-head"><div><span class="kicker">COVERAGE MATRIX</span>' +
      '<h2 style="margin-top:10px">环节 × 数据口径</h2>' +
      '<p>每个格子是该环节内<b>必需</b>这类数据的场景数，颜色越深越集中；空白表示该环节不用这类数据。鼠标悬停可看提及数。</p>' +
      '</div></div>' +
      '<div class="matrix-wrap dc-mat"><table><thead><tr><th class="dc-mrh"></th>' + mHead + '</tr></thead>' +
      '<tbody>' + mBody + '</tbody></table></div></div>' +

      '<div class="section" style="padding:36px 0 56px">' +
      '<div class="sec-head"><div><span class="kicker">NEXT</span>' +
      '<h2 style="margin-top:10px">数据齐备了，能做什么题？</h2>' +
      '<p>把已经具备的数据类别勾上去，看哪些场景的数据条件已经成立。</p>' +
      '</div><div class="upcard-acts">' +
      '<a class="btn ghost" href="#/cases">已接入案例 →</a>' +
      '</div></div></div>' +
      '</div>' +

      '<aside class="dc-side">' + mini() + '</aside>' +
      '</div></main>';
  }

  /* 右侧精简选题面板：状态保存在 FindPanel 模块内，重渲染不丢失。
     FindPanel 未就绪或渲染出错时返回空，由 bind 阶段的补渲染兜底 */
  function mini() {
    if (!g.FindPanel || !g.FindPanel.miniHTML) return '';
    try { return g.FindPanel.miniHTML() || ''; }
    catch (e) { console.warn('[data] 选题面板渲染失败，稍后由 bind 补渲染', e); return ''; }
  }

  function rerenderSide(view) {
    var side = view.querySelector('.dc-side');
    if (!side || !g.FindPanel) return;
    side.innerHTML = mini();
    if (g.FindPanel.miniBind) g.FindPanel.miniBind(side, function () { rerenderSide(view); });
  }

  function bind(view) {
    view.querySelectorAll('[data-dc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-dc');
        location.hash = (k === 'close') ? '#/data' : '#/data?cat=' + k;
      });
    });

    var side = view.querySelector('.dc-side');
    if (side) {
      /* shell 首次渲染早于 find.js 执行（脚本顺序），侧栏可能留空：
         FindPanel 已就绪就立即补；未就绪则等 DOMContentLoaded（那时同步脚本都已执行完）再补 */
      if (!side.innerHTML.trim()) {
        if (g.FindPanel && g.FindPanel.miniHTML) rerenderSide(view);
        else document.addEventListener('DOMContentLoaded', function () {
          if (document.contains(side) && !side.innerHTML.trim()) rerenderSide(view);
        });
      }
      if (g.FindPanel && g.FindPanel.miniBind) {
        g.FindPanel.miniBind(side, function () { rerenderSide(view); });
      }
    }

    /* 某类数据详情里的「用这类数据选题」：把这一类带进右侧面板 */
    view.querySelectorAll('[data-dc-use]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-dc-use');
        if (g.FindPanel && g.FindPanel.ensureMini) g.FindPanel.ensureMini(k);
        rerenderSide(view);
        var s = view.querySelector('.dc-side');
        if (s && s.scrollIntoView) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  g.DataPage = { html: html, bind: bind };
})(window);
