/* =========================================================
   map.js —— AI 介入点图谱页（#/map）
   ---------------------------------------------------------
   一张图看全站：13 个作业环节横向铺开（流程方向从左到右，
   第 7 个环节后折行），每个环节一列、列内纵向列出它的候选场景。
     · 节点左侧色条 = 公开案例丰富度分层；右上 = 强监管三角与已接入案例圆点；
       右下一排五角星 = 该场景用到的方法（与图例「方法构成」同色同形）
     · 箭头 = 上游场景的输出，是下游场景的输入
     · 列顶细条 = 该环节的方法构成
   交互：
     · 概览：每列最多列出前 SHOW 个场景，其余收进「还有 N 个」入口
     · 点任一节点 / 环节名 / 该入口 → 该环节展开放大并移到画面中间，
       其余环节整体虚化（不消失），依赖箭头随之重画
     · 再次点该环节名或「返回全部环节」→ 回到概览
   纯前端：只读 ATLAS + STAGE_META + COMPLETION_META，
   不新增场景与案例，也不改动任何既有页面。
   ========================================================= */

(function (g) {
  'use strict';

  /* ---------------- 基础 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /* 场景名：只有英文界面才查词典；中文界面保持中文场景名
     （shell 的 i18n 也是 LANG=en 才整树替换，这里跟随同一约定） */
  function nameText(s) {
    var t = String(s || '');
    if (document.documentElement.getAttribute('lang') !== 'en') return t;
    var D = g.ATLAS_EN;
    return (D && D[t]) ? D[t] : t;
  }

  /* 节点内只放场景名称：按显示宽度折成最多两行。
     line 是每行宽度单位容量：中文全角记 2、英文记 1。 */
  function nameLines(s, line) {
    var t = nameText(s);
    var LINE = line || 22, CAP = LINE * 2;

    /* 英文按空格分词（保留尾随空格），中文逐字切，避免从英文单词中间断开 */
    var parts = /[a-zA-Z0-9]/.test(t) && t.indexOf(' ') > 0
      ? t.split(' ').map(function (x, k, arr) { return k < arr.length - 1 ? x + ' ' : x; })
      : t.split('');

    var w = 0, i;
    for (i = 0; i < t.length; i++) w += t.charCodeAt(i) > 255 ? 2 : 1;
    if (w > CAP) {
      /* 超过两行容量：截到末尾并留一个单位给省略号，且尽量停在词边界 */
      var acc = 0, out = '';
      for (i = 0; i < parts.length; i++) {
        var pw = 0;
        for (var j = 0; j < parts[i].length; j++) pw += parts[i].charCodeAt(j) > 255 ? 2 : 1;
        if (acc + pw > CAP - 1) break;
        acc += pw; out += parts[i];
      }
      t = out.replace(/\s+$/, '') + '…';
      parts = /[a-zA-Z0-9]/.test(t) && t.indexOf(' ') > 0
        ? t.split(' ').map(function (x, k, arr) { return k < arr.length - 1 ? x + ' ' : x; })
        : t.split('');
    }

    var lines = [], cur = '', cw = 0;
    for (i = 0; i < parts.length; i++) {
      var tw = 0;
      for (var k2 = 0; k2 < parts[i].length; k2++) tw += parts[i].charCodeAt(k2) > 255 ? 2 : 1;
      if (cw + tw > LINE && cur) { lines.push(cur.replace(/\s+$/, '')); cur = ''; cw = 0; if (lines.length === 2) break; }
      cur += parts[i]; cw += tw;
    }
    if (cur && lines.length < 2) lines.push(cur.replace(/\s+$/, ''));
    return lines.length ? lines.slice(0, 2) : [nameText(s)];
  }

  /* 五类方法色（与 tokens.css 一致） */
  var MCOL = { cv: '#238868', ts: '#A06B37', nlp: '#725994', opt: '#1A4779', kg: '#707A38' };
  /* 难度三档色（与 .dtag 一致）：技术视角列头的构成条用 */
  var DCOL = { 低: '#3F8560', 中: '#A97A1C', 高: '#B05A51' };

  /* 五角星路径：「方法构成」的统一图案，节点标记 / 图例 / 筛选按钮共用 */
  function starPath(cx, cy, R) {
    var r = R * 0.45, p = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var d = i % 2 ? r : R;
      p.push((cx + d * Math.cos(a)).toFixed(2) + ' ' + (cy + d * Math.sin(a)).toFixed(2));
    }
    return 'M' + p.join('L') + 'Z';
  }
  function starIco(col, size) {
    return '<svg width="' + (size || 11) + '" height="' + (size || 11) + '" viewBox="0 0 10 10" style="flex:none" aria-hidden="true">' +
      '<path d="' + starPath(5, 5.3, 4.6) + '" fill="' + col + '"/></svg>';
  }

  /* 公开案例丰富度四档（默认口径；若 STAGE_META 已加载则直接用它的色板） */
  var MATDEF = [
    { k: '仿真', name: '案例极少', col: '#B7C6D6', tip: '公开可见的多为方法研究与仿真算例，鲜有现场试验' },
    { k: '小试', name: '案例较少', col: '#3D86BD', tip: '有个位数试点报道，效果未大范围验证' },
    { k: '试用', name: '案例若干', col: '#238868', tip: '有现场试用或产品化雏形的公开实践' },
    { k: '常态', name: '案例较多', col: '#1B6B51', tip: '公开实践已常见，可参考资料多、空白少' }
  ];
  var INNDEF = [
    { k: '高', col: '#9A5A28', tip: '公开案例少' },
    { k: '中', col: '#3D86BD', tip: '有同类工作' },
    { k: '成熟', col: '#7E93A8', tip: '方法成熟' }
  ];

  /* 几何常量。节点内部一律按 (0,0) 起绘制，靠 transform 定位，
     这样聚焦前后可以只改 transform 做动画，不必重排 DOM。 */
  var NW = 150, NH = 40, VGAP = 8, SUBGAP = 6, COLGAP = 16;
  var HEAD = 48, ROWGAP = 34, PAD = 18;
  var SHOW = 5;            /* 流程视角：每列最多直接展示的场景数 */
  var SHOW_T = 7;          /* 技术视角：方法列的场景更多，多给两行 */
  var SCALE = 1.34;        /* 聚焦时该列的放大倍数 */
  var FNW = NW * SCALE, FNH = NH * SCALE, FVGAP = VGAP * SCALE, FSUBGAP = SUBGAP * SCALE;
  var STRIP_HEAD = 22;     /* 依赖侧栏表头高度 */
  var STRIP_MAX = 12;      /* 一侧最多列出的依赖场景数，超出只显示前若干并标注总数 */
  var CET_GAP = 40;        /* 中间聚焦区与左右依赖侧栏之间的留白 */

  var A = null, SM = null, CM = null;
  var MAT = MATDEF, INN = INNDEF, CATS = [];
  var LAZY = null;   // 概览布局缓存
  var LF = {};       // 各环节聚焦布局缓存
  var curFocus = ''; // 当前聚焦的列 key（''=概览；流程视角=环节 id，技术视角=方法 key）
  var MODE = 'flow'; // 'flow' 流程依赖视图 / 'tech' 技术聚类视图
  var curSel = '';   // 当前选中（详情卡展示）的场景 id，链路导出用
  var edgeT = 0;     // 依赖边重画计时器

  /* 导出文件里统一带的口径声明 */
  var DISCLAIMER = '本站点为参考工具，不替代任何作业系统。「公开案例丰富度」/ 创新度是依据公开可见信息（技术难度、有无公开数据集、技术方向完备度、本站已接入案例）做的粗分层，不等于该技术在油田现场的工程成熟水平，也不是等级评定；数据条件需按本单位实际复核。';

  function init() {
    A = g.ATLAS;
    SM = g.STAGE_META;
    CM = g.COMPLETION_META;
    if (SM && SM.MAT && SM.MAT.length) MAT = SM.MAT;
    if (SM && SM.INN && SM.INN.length) INN = SM.INN;
    CATS = (SM && SM.DATA_CATS) || [];
  }

  /* ---------------- 取值：完井走自己的元数据，其余环节走 STAGE_META ---------------- */
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
  function strictOf(sc) {
    var b = sc.badges || [];
    if (b.indexOf('安全敏感') >= 0 || b.indexOf('不可自动决策') >= 0) return true;
    if (SM && SM.owns && SM.owns(sc.stageId)) {
      var r = SM.riskOf(sc.stageId, sc.id);
      return !!(r && r.strict);
    }
    return false;
  }
  function caseCount(sc) {
    return g.Cases ? g.Cases.bySceneAll(sc.id).length : 0;
  }
  function matColor(k) {
    for (var i = 0; i < MAT.length; i++) if (MAT[i].k === k) return MAT[i].col;
    return MAT[0].col;
  }
  function matName(k) {
    for (var i = 0; i < MAT.length; i++) if (MAT[i].k === k) return MAT[i].name || MAT[i].k;
    return k;
  }
  function matTip(k) {
    for (var i = 0; i < MAT.length; i++) if (MAT[i].k === k) return MAT[i].tip;
    return '';
  }
  function innColor(k) {
    for (var i = 0; i < INN.length; i++) if (INN[i].k === k) return INN[i].col;
    return INN[1].col;
  }
  function catName(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return CATS[i].name;
    return k;
  }
  function textOf(sc) {
    return [sc.name, sc.point || '', sc.intro || '', sc.problem || '', sc.id].join(' ').toLowerCase();
  }
  function stageById(id) {
    if (!A || !A.stages) return null;
    for (var i = 0; i < A.stages.length; i++) if (A.stages[i].id === id) return A.stages[i];
    return null;
  }
  function stageOfScene(id) {
    var sc = A && A.index && A.index.byScene[id];
    return sc ? sc.stageId : '';
  }

  /* ---------------- 布局 ---------------- */
  function sceneTotal() {
    var n = 0;
    A.stages.forEach(function (st) { n += st.scenes.length; });
    return n;
  }

  /* 列规格：两种视图共用同一套布局/聚焦/连线逻辑，只是「列是什么」不同
       flow：一列 = 一个作业环节；tech：一列 = 一类 AI 方法（场景按环节先后排） */
  function colSpecs() {
    if (MODE === 'tech') {
      return Object.keys(MCOL).map(function (k) {
        var m = A.methods[k] || {};
        var scenes = [];
        A.stages.forEach(function (st) {
          st.scenes.forEach(function (sc) {
            if ((sc.methods || []).indexOf(k) >= 0) scenes.push(sc);
          });
        });
        return { id: k, kind: 'tech', name: m.name || k, abbr: m.abbr || k.toUpperCase(), scenes: scenes };
      });
    }
    return A.stages.map(function (st) {
      return { id: st.id, kind: 'flow', name: st.name, idx: st.idx, scenes: st.scenes };
    });
  }
  /* 场景所属列（技术视角下多方法场景会重复出现，取第一次出现的列作主列） */
  function colKeyOf(id) {
    var L = buildLayout();
    return L.keyOf[id] || '';
  }
  /* 按列 key 取列对象（两种视图通用），非法 key 返回 null */
  function colById(key) {
    if (!key) return null;
    var L = buildLayout();
    var c = L.colBy[key];
    return c ? { id: c.st.id, kind: c.st.kind, name: c.st.name, idx: c.st.idx, scenes: c.st.scenes } : null;
  }

  /* 概览布局：每列最多 show 个场景；被折叠的场景也给坐标——
     收在最后一个可见节点的位置上，展开时从那里散开，动画才连贯 */
  function buildLayout() {
    if (LAZY && LAZY.total === sceneTotal() && LAZY.mode === MODE) return LAZY;
    LAZY = null; LF = {};
    var cols = [], byId = {}, byUid = {}, colBy = {}, moreBy = {}, keyOf = {}, edges = [];
    var specs = colSpecs();
    var show = MODE === 'tech' ? SHOW_T : SHOW;
    /* 流程视角：13 个环节分两行（第 7 个后折行）；技术视角：5 个方法一行 */
    var rowGroups = MODE === 'tech' ? [specs] : [specs.slice(0, 7), specs.slice(7)];

    var y = PAD, maxW = 0;
    rowGroups.forEach(function (group) {
      var rowCols = group.map(function (st) {
        var n = st.scenes.length;
        var rows = Math.min(n, show) + (n > show ? 1 : 0);
        return { st: st, w: NW, h: HEAD + rows * (NH + VGAP) - VGAP, more: n > show };
      });
      var rowH = 0;
      rowCols.forEach(function (c) { if (c.h > rowH) rowH = c.h; });

      var x = PAD;
      rowCols.forEach(function (c) {
        c.x = x; c.y = y;
        c.items = c.st.scenes.map(function (sc, i) {
          var vis = i < show;
          var r = vis ? i : (show - 1);
          var it = {
            id: sc.id, uid: c.st.id + '|' + sc.id, sc: sc,
            /* 技术视角下列 key 是方法，节点上仍标它真正的作业环节 */
            stage: MODE === 'tech' ? (stageById(sc.stageId) || c.st) : c.st,
            vis: vis, sub: 0,
            x: c.x, y: c.y + HEAD + r * (NH + VGAP)
          };
          if (!byId[sc.id]) { byId[sc.id] = it; keyOf[sc.id] = c.st.id; }
          byUid[it.uid] = it;
          return it;
        });
        if (c.more) {
          var mi = {
            more: true, stage: c.st, vis: true, n: c.st.scenes.length - show,
            x: c.x, y: c.y + HEAD + show * (NH + VGAP), w: NW, h: 26
          };
          c.items.push(mi);
          moreBy[c.st.id] = mi;   /* 折叠场景的依赖边会画到这个入口上 */
        }
        colBy[c.st.id] = c;
        cols.push(c);
        x += c.w + COLGAP;
      });

      var rowW = x - COLGAP + PAD;
      if (rowW > maxW) maxW = rowW;
      y += rowH + ROWGAP;
    });

    /* 依赖边：全量保留（详情卡与导出需要完整上下游），绘制时再按坐标取舍 */
    A.stages.forEach(function (st) {
      st.scenes.forEach(function (sc) {
        depsOf(sc).forEach(function (up) {
          if (A.index.byScene[up]) edges.push({ from: up, to: sc.id });
        });
      });
    });

    var all = [];
    cols.forEach(function (c) { c.items.forEach(function (it) { all.push(it); }); });
    LAZY = {
      mode: MODE,
      w: maxW, h: y - ROWGAP + PAD, cols: cols, colBy: colBy, byId: byId, byUid: byUid,
      keyOf: keyOf, moreBy: moreBy,
      edges: edges, nodes: all, total: sceneTotal()
    };
    return LAZY;
  }

  /* 聚焦布局：把该环节的场景按可用高度排成若干子列，整体居中放大。
     画布尺寸不变，所以「放大 + 移到中间」只是 transform 变化，可以做动画。 */
  /* 与该环节有箭头往来的场景：上游依赖（输出给它的）与下游场景（拿它输出的）。
     这些场景即使在概览里被折叠，也要在聚焦视图里显示出来，否则箭头只通到
     「还有 N 个」入口，看不到真正的另一端。 */
  function partners(L, st) {
    var U = [], D = {}, seen = {};
    L.edges.forEach(function (e) {
      /* 技术视角下一个场景可能属于多列，按主列判断「是否在本列之外」 */
      var fa = L.keyOf[e.from], fb = L.keyOf[e.to];
      if (fb === st.id && fa !== st.id && !seen['u' + e.from]) { seen['u' + e.from] = 1; U.push(e.from); }
      else if (fa === st.id && fb !== st.id && !seen['d' + e.to]) { seen['d' + e.to] = 1; D[e.to] = 1; }
    });
    var order = {};
    L.cols.forEach(function (c, i) { order[c.st.id] = i; });
    var dl = Object.keys(D).filter(function (id) { return U.indexOf(id) < 0; });
    function byFlow(a, b) {
      return ((order[L.keyOf[a]] || 0) - (order[L.keyOf[b]] || 0)) ||
        ((L.byId[a] ? L.byId[a].y : 0) - (L.byId[b] ? L.byId[b].y : 0));
    }
    U.sort(byFlow); dl.sort(byFlow);
    return { U: U, D: dl };
  }

  /* 一侧依赖侧栏的排布：条目多时分子列 */
  function stripCols(n, rowsMax) {
    if (!n) return { sub: 0, rows: 0, w: 0, h: 0 };
    var sub = Math.max(1, Math.ceil(n / rowsMax));
    var rows = Math.ceil(n / sub);
    return { sub: sub, rows: rows, w: sub * NW + (sub - 1) * SUBGAP, h: STRIP_HEAD + rows * (NH + VGAP) - VGAP };
  }

  /* 聚焦布局 = 中间放大的选中环节 + 左右两栏依赖场景（自我中心视图），
     画布尺寸不变，全部位移都靠 transform 完成，可以平滑动画。 */
  function focusLayout(L, st) {
    var lk = MODE + ':' + st.id;
    if (LF[lk] && LF[lk].total === sceneTotal()) return LF[lk];
    var n = st.scenes.length;
    var avail = Math.max(FNH + FVGAP, L.h - HEAD - PAD * 2);
    var vstep = FNH + FVGAP;
    var rowsN = Math.max(1, Math.floor(avail / vstep));
    var sub = Math.max(1, Math.ceil(n / rowsN));
    rowsN = Math.ceil(n / sub);
    var w = sub * FNW + (sub - 1) * FSUBGAP;
    var h = HEAD + rowsN * vstep - FVGAP;

    var pr = partners(L, st);
    var rowsMax = Math.max(1, Math.floor((L.h - PAD * 2 - HEAD - STRIP_HEAD) / (NH + VGAP)));
    var cap = Math.min(rowsMax, STRIP_MAX);
    var u = pr.U.slice(0, cap), d = pr.D.slice(0, cap);
    var uMore = Math.max(0, pr.U.length - u.length), dMore = Math.max(0, pr.D.length - d.length);
    var cu = stripCols(u.length, rowsMax), cd = stripCols(d.length, rowsMax);

    var total = cu.w + (cu.w ? CET_GAP : 0) + w + (cd.w ? CET_GAP : 0) + cd.w;
    var startX = Math.max(PAD, Math.round((L.w - total) / 2));
    var xu = startX;
    var xf = startX + (cu.w ? cu.w + CET_GAP : 0);
    var xd = xf + w + (cd.w ? CET_GAP : 0);

    var maxH = Math.max(h, cu.h, cd.h);
    var y = Math.max(PAD, Math.round((L.h - maxH) / 2));
    var stripTop = y + HEAD;

    var nodes = {};
    st.scenes.forEach(function (sc, i) {
      var s = Math.floor(i / rowsN), r = i % rowsN;
      nodes[sc.id] = { x: xf + s * (FNW + FSUBGAP), y: y + HEAD + r * vstep, w: FNW, h: FNH };
    });
    function place(ids, c, cx) {
      if (!ids.length) return;
      var rows = c.rows || 1;
      ids.forEach(function (id, i) {
        var s = Math.floor(i / rows), r = i % rows;
        nodes[id] = { x: cx + s * (NW + SUBGAP), y: stripTop + STRIP_HEAD + r * (NH + VGAP), w: NW, h: NH };
      });
    }
    place(u, cu, xu);
    place(d, cd, xd);

    function lab(cx, cnt, more, dir) {
      if (!cnt && !more) return null;
      var t = (dir === 'u' ? '↑ 上游依赖 ' : '下游场景 ') + (cnt + more) +
        (more ? '（此处列出 ' + cnt + ' 个）' : '');
      return { x: cx, y: stripTop + 12, t: t };
    }

    LF[lk] = {
      st: st, x: xf, y: y, w: w, h: h, nodes: nodes, total: sceneTotal(),
      ulab: lab(xu + cu.w / 2, u.length, uMore, 'u'),
      dlab: lab(xd + cd.w / 2, d.length, dMore, 'd')
    };
    return LF[lk];
  }

  /* 端点坐标：聚焦列取聚焦布局；概览下被折叠的场景用所属列的
     「还有 N 个」入口作代理端点，这样折叠不会让依赖箭头断链 */
  function ptOf(L, F, id) {
    if (curFocus && F && F.nodes[id]) return F.nodes[id];   /* 聚焦区或依赖侧栏 */
    var it = L.byId[id];
    if (it && it.vis) return { x: it.x, y: it.y, w: NW, h: NH };
    var more = L.moreBy[L.keyOf[id]];
    if (more) return { x: more.x, y: more.y, w: NW, h: more.h, proxy: true };
    return null;
  }

  function edgeD(pa, pb) {
    var ay = pa.y + pa.h / 2, by = pb.y + pb.h / 2;
    /* 放大节点之间的连线弧度同步加大，箭头的绕行与指向更清晰 */
    var k = Math.max(pa.w, pb.w) / NW;   /* 1 = 概览；>1 = 聚焦放大 */
    if (pa.x === pb.x) {
      /* 同一子列：从右侧绕行回来 */
      var ox = pa.x + pa.w, off = k > 1 ? 26 : 14;
      return 'M' + ox + ' ' + ay + ' C ' + (ox + off) + ' ' + ay + ', ' + (ox + off) + ' ' + by + ', ' + ox + ' ' + by;
    }
    var o1 = k > 1 ? 16 : 10, o2 = k > 1 ? 16 : 10;
    return 'M' + (pa.x + pa.w) + ' ' + ay +
      ' C ' + (pa.x + pa.w + o1) + ' ' + ay + ', ' + (pb.x - o2) + ' ' + by + ', ' + pb.x + ' ' + by;
  }

  /* 要画的边：两端都是可见节点时直接相连；一端被折叠时并入该列入口；
     同一对端点只画一条；聚焦时与该环节无关的边淡显（0.14）而不是消失 */
  function edgeSegs(L, F) {
    var segs = [], seen = {};
    L.edges.forEach(function (e) {
      var a = ptOf(L, F, e.from), b = ptOf(L, F, e.to);
      if (!a || !b) return;
      var fa = L.keyOf[e.from], fb = L.keyOf[e.to];
      if (a.proxy && b.proxy && fa === fb) return;   /* 同列折叠场景之间：都收在同一个入口里 */
      var key = (a.proxy ? 'M:' + fa : e.from) + '>' + (b.proxy ? 'M:' + fb : e.to);
      if (seen[key]) return;
      seen[key] = 1;
      var rel = !curFocus || fa === curFocus || fb === curFocus;
      segs.push({ from: e.from, to: e.to, d: edgeD(a, b), op: rel ? 1 : 0.14 });
    });
    return segs;
  }

  /* ---------------- 图谱 SVG ---------------- */
  /* 列头：流程视角显示环节名 + 方法构成；技术视角显示方法名 + 难度构成 */
  function headInner(c0, bw) {
    var c = c0.st || c0;          /* 传列对象或列规格都行 */
    var isTech = c.kind === 'tech';
    var m = isTech ? (A.methods[c.id] || {}) : null;
    var nm = isTech ? (m.name || c.name) : c.name;
    var sub = isTech
      ? (m.abbr || c.id.toUpperCase()) + ' · ' + c.scenes.length + ' 场景'
      : pad2(c.idx) + ' · ' + c.scenes.length + ' 场景';

    var s = '<text class="mp-st-name" x="' + (bw / 2) + '" y="15" text-anchor="middle" ' +
      'font-size="12" font-weight="600" fill="#222B38">' + esc(nm) + '</text>';
    s += '<text class="mp-st-sub" x="' + (bw / 2) + '" y="28" text-anchor="middle" font-size="8.5" ' +
      'font-family="ui-monospace,Consolas,monospace" fill="#8A97A6">' + esc(sub) + '</text>';
    s += '<rect class="mp-bar-base" x="0" y="34" width="' + bw + '" height="4" rx="2" fill="#E7ECF1"/>';

    var cnt = {}, total = 0;
    c.scenes.forEach(function (sc) {
      if (isTech) { cnt[sc.diff] = (cnt[sc.diff] || 0) + 1; total++; }
      else (sc.methods || []).forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; total++; });
    });
    var ox = 0;
    var keys = isTech ? ['低', '中', '高'] : Object.keys(MCOL);
    keys.forEach(function (k) {
      if (!cnt[k]) return;
      var r = cnt[k] / (total || 1), w = bw * r;
      var col = isTech ? (DCOL[k] || '#8A97A6') : MCOL[k];
      var tip = isTech ? ('难度 ' + k + ' ' + cnt[k] + ' 个')
        : (((A.methods[k] || {}).name || k) + ' ' + cnt[k] + ' 次');
      s += '<rect class="mp-bar-seg" data-r="' + r + '" x="' + ox.toFixed(1) + '" y="34" width="' + w.toFixed(1) +
        '" height="4" fill="' + col + '"><title>' + esc(tip) + '</title></rect>';
      ox += w;
    });
    return s;
  }

  function nodeHTML(it, p, sc, vis, faded) {
    var sc2 = it.sc, mat = matOf(sc2), cn = caseCount(sc2);
    var strict = strictOf(sc2);
    /* 该场景用到的方法，按图例顺序排 */
    var mkeys = Object.keys(MCOL).filter(function (k) {
      return (sc2.methods || []).indexOf(k) >= 0;
    });
    function mLabel(k) {
      var m = A.methods[k] || {};
      return (m.abbr ? m.abbr + ' ' : '') + (m.name || k);
    }
    var tip = sc2.name + '（' + sc2.id.toUpperCase() + '）\n' + sc2.stageName + ' · 难度 ' + sc2.diff +
      '\n公开案例丰富度 ' + matName(mat) + ' · 创新度 ' + innOf(sc2) +
      (mkeys.length ? '\n方法：' + mkeys.map(mLabel).join(' · ') : '') +
      (cn ? '\n已接入案例 ' + cn + ' 个' : '\n暂未接入案例') +
      (depsOf(sc2).length ? '\n上游：' + depsOf(sc2).join('、').toUpperCase() : '\n无上游依赖');
    var lines = nameLines(sc2.name);
    var ty0 = lines.length > 1 ? 17 : 24;
    var cls = 'mp-node' + (vis ? '' : ' hid') + (sc > 1 ? ' big' : (faded ? ' faded' : ''));
    var s = '<g class="' + cls + '" data-id="' + sc2.id + '" data-uid="' + esc(it.uid) + '" ' +
      'data-stage="' + it.stage.id + '" tabindex="0" role="button" ' +
      'aria-label="' + esc(sc2.name) + '" data-m="' + (sc2.methods || []).join(' ') + '" ' +
      'data-mat="' + mat + '" data-d="' + sc2.diff + '" data-c="' + (cn ? 1 : 0) + '" ' +
      'style="transform:translate(' + p.x + 'px,' + p.y + 'px)' + (sc > 1 ? ' scale(' + sc + ')' : '') + '">' +
      '<title>' + esc(tip) + '</title>' +
      '<rect class="mp-n-bg" width="' + NW + '" height="' + NH + '" rx="3"/>' +
      '<rect width="3" height="' + NH + '" fill="' + matColor(mat) + '"/>';
    s += lines.map(function (ln, li) {
      return '<text class="mp-n-t" x="9" y="' + (ty0 + li * 13) + '" font-size="10.5" fill="#2B3442">' + esc(ln) + '</text>';
    }).join('');
    /* 图例标记直接标进节点：右上 = 强监管三角 + 案例圆点；右下 = 方法构成五角星 */
    if (strict) {
      s += '<path d="M' + (NW - 11) + ' 8 L' + (NW - 5) + ' 8 L' + (NW - 8) + ' 13 z" fill="#B26A39">' +
        '<title>强监管环节：模型只给参考，不可自动决策</title></path>';
    }
    if (cn) {
      s += '<circle cx="' + (NW - (strict ? 16 : 8)) + '" cy="9" r="2.6" fill="#238868">' +
        '<title>已接入案例 ' + cn + ' 个</title></circle>';
    }
    mkeys.forEach(function (k, i) {
      s += '<path d="' + starPath(NW - 8 - i * 8, NH - 6.5, 3.2) + '" fill="' + MCOL[k] + '">' +
        '<title>方法：' + esc(mLabel(k)) + '</title></path>';
    });
    return s + '</g>';
  }

  /* 依赖侧栏标题：聚焦时显示在左（上游）/ 右（下游）两栏上方 */
  function slabHTML(lab, kind) {
    var cls = 'mp-slab mp-slab-' + kind + (lab ? '' : ' hid');
    var tx = lab ? lab.x : PAD, ty = lab ? lab.y : PAD;
    return '<text class="' + cls + '" text-anchor="middle" ' +
      'style="transform:translate(' + tx + 'px,' + ty + 'px)">' + esc(lab ? lab.t : '') + '</text>';
  }

  function mapSVG() {
    var L = buildLayout();
    var F = curFocus ? focusLayout(L, colById(curFocus)) : null;
    var aria = MODE === 'tech'
      ? 'AI 介入点图谱（技术聚类视图）：按 AI 方法聚合的场景与数据依赖'
      : 'AI 介入点图谱：13 个作业环节的场景与数据依赖';
    var s = '<svg class="mp-svg" viewBox="0 0 ' + L.w + ' ' + L.h + '" width="' + L.w +
      '" height="' + L.h + '" role="img" aria-label="' + aria + '">';

    s += '<defs><marker id="mp-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#9DB0C4"/></marker>' +
      '<marker id="mp-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="#1A4779"/></marker></defs>';

    /* 列：聚焦列最后渲染，压在虚化的其它列之上 */
    var ordered = L.cols.slice().sort(function (a, b) {
      return (a.st.id === curFocus ? 1 : 0) - (b.st.id === curFocus ? 1 : 0);
    });

    s += '<g class="mp-cols">';
    ordered.forEach(function (c) {
      var on = !!curFocus && c.st.id === curFocus;
      /* 虚化下沉到元素级：进入依赖侧栏的场景要保持清晰 */
      s += '<g class="mp-col" data-stage="' + c.st.id + '">';

      var hp = on ? { x: F.x, y: F.y, sc: SCALE, bw: F.w / SCALE } : { x: c.x, y: c.y, sc: 1, bw: c.w };
      s += '<g class="mp-st-head' + (on ? ' on' : (curFocus ? ' faded' : '')) + '" data-stage="' + c.st.id +
        '" tabindex="0" role="button" ' +
        'style="transform:translate(' + hp.x + 'px,' + hp.y + 'px)' + (hp.sc > 1 ? ' scale(' + hp.sc + ')' : '') + '" ' +
        'aria-label="' + (on ? '返回全部环节' : '展开 ' + esc(c.st.name) + ' 的全部场景') + '">' +
        '<title>' + (on ? '点击返回全部环节' : '点击展开该环节全部场景') + '</title>' +
        headInner(c, hp.bw) + '</g>';

      c.items.forEach(function (it) {
        if (it.more) {
          s += '<g class="mp-more' + (on ? ' hid' : (curFocus ? ' faded' : '')) + '" data-stage="' + it.stage.id +
            '" tabindex="0" role="button" ' +
            'style="transform:translate(' + it.x + 'px,' + it.y + 'px)" ' +
            'aria-label="展开 ' + esc(it.stage.name) + ' 的全部 ' + (it.n + SHOW) + ' 个场景">' +
            '<title>点击展开该环节全部场景</title>' +
            '<rect class="mp-more-bg" width="' + it.w + '" height="' + it.h + '" rx="3"/>' +
            '<text x="' + (it.w / 2) + '" y="17" text-anchor="middle" font-size="10.5" font-weight="600" fill="#3D86BD">' +
            '还有 ' + it.n + ' 个场景 ›</text></g>';
          return;
        }
        /* 聚焦区：放大；依赖侧栏：原尺寸列出（即使它本来被折叠） */
        var np = F ? F.nodes[it.id] : null;
        var big = !!np && np.w > NW;
        s += nodeHTML(it, np || it, big ? SCALE : 1, !!np || it.vis, !!curFocus && !np);
      });
      s += '</g>';
    });
    s += '</g>';

    /* 左右依赖侧栏标题 */
    s += slabHTML(F && F.ulab, 'u') + slabHTML(F && F.dlab, 'd');

    /* 画布左上角的返回按钮：仅聚焦态显示，概览时隐藏 */
    s += '<g class="mp-back' + (curFocus ? '' : ' hid') + '" data-mp-back="1" tabindex="0" role="button" ' +
      'style="transform:translate(' + PAD + 'px,2px)" aria-label="返回全部环节">' +
      '<rect width="124" height="26" rx="13"/><text x="62" y="17" text-anchor="middle">‹ 返回全部环节</text></g>';

    /* 依赖边：折叠场景的连线并入「还有 N 个」入口，箭头链不断 */
    s += '<g class="mp-edges">';
    edgeSegs(L, F).forEach(function (seg) {
      s += '<path class="mp-edge" data-a="' + seg.from + '" data-b="' + seg.to + '" data-e="' + seg.from + '>' + seg.to + '" ' +
        'd="' + seg.d + '" fill="none" stroke="#9DB0C4" stroke-width="1.2" ' +
        'marker-end="url(#mp-ar)" style="opacity:' + seg.op + '"/>';
    });
    s += '</g>';

    return s + '</svg>';
  }

  /* ---------------- 页面 ---------------- */
  function html(q) {
    init();
    if (!A || !A.stages) return '<main class="wrap"><div class="empty"><b>数据未加载</b>请确认 assets/data.js 已引入。</div></main>';

    /* 视图模式：URL ?v=tech 切到技术聚类；聚焦列：URL ?f=<列 key>，非法值退回概览 */
    MODE = q.v === 'tech' ? 'tech' : 'flow';
    var fq = q.f || '';
    curFocus = colById(fq) ? fq : '';

    var total = A.allScenes ? A.allScenes.length : 0;
    var withCase = 0, reg = 0;
    A.stages.forEach(function (st) {
      st.scenes.forEach(function (sc) {
        if (caseCount(sc)) withCase++;
        if (strictOf(sc)) reg++;
      });
    });
    if (!total) A.stages.forEach(function (st) { total += st.scenes.length; });

    /* 技术视角：同一场景有多个方法会在多列出现，节点数 > 场景数 */
    var isTech = MODE === 'tech';
    var slots = buildLayout().nodes.filter(function (it) { return !it.more; }).length;
    var show = isTech ? SHOW_T : SHOW;

    var mF = q.m || '', matF = q.mat || '', dF = q.d || '', dtF = q.dt || '';
    var caseF = q.c === '1', edgeF = q.e !== '0';

    var mChips = ['<button type="button" class="chip' + (mF ? '' : ' on') + '" data-mp-f="m" data-mp-v="">全部方法</button>']
      .concat(Object.keys(A.methods).map(function (k) {
        return '<button type="button" class="chip' + (mF === k ? ' on' : '') + '" data-m="' + k +
          '" data-mp-f="m" data-mp-v="' + k + '">' + starIco(MCOL[k] || '#8A97A6', 10) + ' ' +
          A.methods[k].abbr + ' ' + esc(A.methods[k].name) + '</button>';
      })).join('');

    var matChips = ['<button type="button" class="chip' + (matF ? '' : ' on') + '" data-mp-f="mat" data-mp-v="">全部丰富度</button>']
      .concat(MAT.map(function (m) {
        return '<button type="button" class="chip' + (matF === m.k ? ' on' : '') + '" data-mp-f="mat" data-mp-v="' + m.k + '">' +
          '<i class="mp-dot" style="background:' + m.col + '"></i>' + esc(m.name || m.k) + '</button>';
      })).join('');

    var dChips = ['<button type="button" class="chip' + (dF ? '' : ' on') + '" data-mp-f="d" data-mp-v="">全部难度</button>']
      .concat(['低', '中', '高'].map(function (d) {
        return '<button type="button" class="chip' + (dF === d ? ' on' : '') + '" data-mp-f="d" data-mp-v="' + d + '">' + d + '</button>';
      })).join('');

    var dtOpts = '<option value="">全部数据类型</option>' + CATS.map(function (c) {
      return '<option value="' + c.k + '"' + (dtF === c.k ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    return '<main class="wrap">' +
      /* 介入点图谱是顶级页面，不挂在作业链目录下；
         与作业链的关联用平级跳转按钮表达（.crumb-x 不参与返回按钮推导） */
      '<nav class="crumb"><a href="#/">总览</a><span class="sep">/</span><span class="cur">介入点图谱</span>' +
      '<a class="crumb-x" href="#/chain">作业链 →</a></nav>' +

      '<div class="page-head"><div class="ph-top"><div>' +
      '<div class="ph-idx">AI ENTRY-POINT MAP</div>' +
      '<h1>介入点图谱<span class="en">' +
      (isTech ? '5 类方法 × ' + slots + ' 场景位' : '13 环节 × ' + total + ' 场景') + '</span></h1>' +
      (isTech
        ? '<p class="blurb">按 <b>AI 方法</b>横向聚类：同一类方法（CV / TS / NLP / OPT / KG）的场景聚成一列，' +
          '列内仍按作业环节先后排列，适合先定算法方向、再挑落地的工程问题。' +
          '一个场景用到多个方法时会在多列各出现一次；箭头依旧表示<b>上游场景的输出，是下游场景的输入</b>。' +
          '每列默认只列前 ' + show + ' 个场景，<b>点其中任一场景</b>可展开该列全部分场景。</p>'
        : '<p class="blurb">顺着作业流程看全站：每个环节一列，列内是它的候选场景。' +
          '箭头方向表示<b>上游场景的输出，是下游场景的输入</b>——先解决起点的场景，后面的题目才有数据可用。' +
          '每列默认只列前 ' + show + ' 个场景，<b>点其中任一场景</b>即可展开该环节全部场景。</p>') +
      '</div><div class="ph-stat">' +
      '<div><div class="n">' + total + '</div><div class="l">候选场景</div></div>' +
      '<div><div class="n">' + withCase + '</div><div class="l">已接入案例</div></div>' +
      '<div><div class="n">' + reg + '</div><div class="l">强监管场景</div></div>' +
      '</div></div></div>' +

      /* 工具条 */
      '<div class="cpt-tools">' +
      '<div class="cpt-t-row">' +
      '<div class="cpt-search">' +
      '<input type="search" data-mp="q" value="' + esc(q.q || '') + '" placeholder="在 ' + total + ' 个场景里检索：名称 / 介入点 / 环节…"></div>' +
      '<div class="cpt-t-acts">' +
      '<button type="button" class="btn sm primary" data-mp-back="1"' + (curFocus ? '' : ' hidden') + '>‹ 返回全部环节</button>' +
      '<button type="button" class="btn sm ghost" data-mp="clear">清除筛选</button>' +
      '<button type="button" class="btn sm ghost" data-mp="exp">导出当前结果（MD）</button>' +
      '</div></div>' +
      '<div class="cpt-t-foot">' +
      '<span class="cpt-tip" data-mp="tip">未启用筛选，显示全部 ' + total + ' 个场景</span>' +
      '<label class="cpt-ck"><input type="checkbox" data-mp="edge"' + (edgeF ? ' checked' : '') + '>显示依赖箭头</label>' +
      '<label class="cpt-ck"><input type="checkbox" data-mp="case"' + (caseF ? ' checked' : '') + '>只看已接入案例</label>' +
      '</div></div>' +

      /* 视图切换：流程依赖（作业时序 / 上下游数据流）↔ 技术聚类（按 AI 方法聚合） */
      '<div class="mp-modes">' +
      '<span class="mp-md-lbl">VIEW · 视图</span>' +
      '<div class="mp-md">' +
      '<button type="button" class="' + (isTech ? '' : 'on') + '" data-mp-mode="flow"' +
      ' aria-pressed="' + (isTech ? 'false' : 'true') + '">流程依赖视图</button>' +
      '<button type="button" class="' + (isTech ? 'on' : '') + '" data-mp-mode="tech"' +
      ' aria-pressed="' + (isTech ? 'true' : 'false') + '">技术聚类视图</button>' +
      '</div>' +
      '<span class="mp-md-note">' + (isTech
        ? '技术视角：一列一类方法，适合按算法方向找课题；列内仍按作业先后排序'
        : '流程视角：一列一个作业环节，按作业时序与上下游数据流展开') + '</span>' +
      '</div>' +

      /* 筛选行按组分块：每组内部不换行，换行只发生在组之间 */
      '<div class="mp-filters">' +
      '<span class="mp-fgrp"><span class="lbl">方法</span>' + mChips + '<span class="divider"></span></span>' +
      '<span class="mp-fgrp slim"><span class="lbl" title="公开案例丰富度">丰富度</span>' + matChips + '<span class="divider"></span></span>' +
      '<span class="mp-brk"></span>' +
      '<span class="mp-fgrp"><span class="lbl">难度</span>' + dChips + '<span class="divider"></span></span>' +
      '<span class="mp-fgrp"><span class="lbl">数据</span>' +
      '<select class="mp-sel" data-mp="dt">' + dtOpts + '</select></span>' +
      '</div>' +

      '<div class="mp-wrap"><div class="mp-scroll">' + mapSVG() + '</div></div>' +

      /* 按智能化方法反查：方法汇总页（#/method/<key>）的入口。
         此前这些页面只能从案例「参考方向」胶囊进入，图谱页没有入口 */
      '<section class="mp-methods"><div class="mp-m-head">' +
      '<span class="mp-m-t">按智能化方法反查</span>' +
      '<span class="mp-m-sub">每类 AI 方法在全部作业环节的可应用场景汇总——从方法找场景，或从场景反查它用了哪些方法</span>' +
      '</div><div class="mp-m-grid">' +
      Object.keys(A.methods).map(function (k) {
        var m = A.methods[k];
        var n = (A.index.byMethod && A.index.byMethod[k] || []).length;
        var col = MCOL[k] || '#8A97A6';
        return '<a class="mp-mc" data-m="' + k + '" href="#/method/' + k + '">' +
          '<span class="mp-mc-top"><span class="mp-mc-ab" style="color:' + col + '">' + esc(m.abbr || k) + '</span>' +
          '<span class="mp-mc-nm">' + esc(m.name) + '</span>' +
          '<span class="mp-mc-n">' + n + ' 场景</span></span>' +
          '<span class="mp-mc-ds">' + esc(m.desc || '') + '</span>' +
          '<span class="mp-mc-go">查看方法页 →</span></a>';
      }).join('') +
      '</div></section>' +

      /* 图例 */
      '<div class="mp-legend">' +
      '<span class="mp-lg-t">公开案例丰富度</span>' +
      MAT.map(function (m) {
        return '<span class="mp-lg" title="' + esc(m.tip || '') + '"><i style="background:' + m.col + '"></i>' + esc(m.name || m.k) + '</span>';
      }).join('') +
      '<span class="divider"></span><span class="mp-lg-t">方法构成</span>' +
      Object.keys(MCOL).map(function (k) {
        return '<span class="mp-lg">' + starIco(MCOL[k]) + esc((A.methods[k] || {}).abbr || k) + '</span>';
      }).join('') +
      '<span class="divider"></span>' +
      '<span class="mp-lg"><i class="mp-ci"></i>已接入案例</span>' +
      '<span class="mp-lg"><i class="mp-tr"></i>强监管（不可自动决策）</span>' +
      '<span class="mp-lg"><i class="mp-ar-ico">→</i>上游输出供下游使用</span>' +
      '</div>' +

      /* 详情卡 */
      '<div class="mp-detail" data-mp="detail"><div class="mp-d-empty">' +
      '点任一场景即可展开它所在的' + (isTech ? '方法' : '环节') + '列；展开后再点场景查看详情，卡片里的按钮可直接进入场景。' +
      '先点<b>没有上游箭头</b>的起点场景，数据最独立。' +
      '选中场景后，卡片底部可导出以它为中心的<b>上下游依赖链</b>（MD / JSON），直接贴进立项报告的「项目链路分析」章节。' +
      '</div></div>' +

      '</main>';
  }

  /* ---------------- 筛选 ---------------- */
  function passes(sc, f) {
    if (f.m && (sc.methods || []).indexOf(f.m) < 0) return false;
    if (f.mat && matOf(sc) !== f.mat) return false;
    if (f.d && sc.diff !== f.d) return false;
    if (f.dt && (!SM || SM.cellOf(sc, f.dt) < 1)) return false;
    if (f.c && !caseCount(sc)) return false;
    if (f.q && textOf(sc).indexOf(f.q) < 0) return false;
    return true;
  }
  function currF(root) {
    var f = { m: '', mat: '', d: '', dt: '', c: false, q: '' };
    [].forEach.call(root.querySelectorAll('.mp-filters .chip.on'), function (c) {
      f[c.getAttribute('data-mp-f')] = c.getAttribute('data-mp-v') || '';
    });
    var sel = root.querySelector('[data-mp="dt"]');
    if (sel) f.dt = sel.value || '';
    var cc = root.querySelector('[data-mp="case"]');
    if (cc) f.c = cc.checked;
    var ec = root.querySelector('[data-mp="edge"]');
    if (ec) f.e = ec.checked;
    var qi = root.querySelector('[data-mp="q"]');
    if (qi) f.q = (qi.value || '').trim().toLowerCase();
    return f;
  }
  function apply(root) {
    init();
    var f = currF(root), n = 0, seen = {};
    [].forEach.call(root.querySelectorAll('.mp-node'), function (node) {
      var sid = node.getAttribute('data-id');
      var sc = A.index.byScene[sid];
      var ok = sc ? passes(sc, f) : true;
      node.classList.toggle('dim', !ok);
      /* 技术视角下同一场景可能在多列出现，计数只算一次 */
      if (ok && !seen[sid]) { seen[sid] = 1; n++; }
    });
    var tip = root.querySelector('[data-mp="tip"]');
    if (tip) {
      var bits = [];
      if (f.q) bits.push('关键词「' + f.q + '」');
      if (f.m) bits.push('方法 ' + (A.methods[f.m] || {}).abbr);
      if (f.mat) bits.push('公开案例丰富度 ' + matName(f.mat));
      if (f.d) bits.push('难度 ' + f.d);
      if (f.dt) bits.push('涉及数据 ' + catName(f.dt));
      if (f.c) bits.push('仅已接入案例');
      tip.textContent = bits.length
        ? bits.join(' · ') + ' — 命中 ' + n + ' 个场景'
        : '未启用筛选，显示全部 ' + n + ' 个场景';
    }
  }

  /* ---------------- 详情卡 ---------------- */
  function detailHTML(sc) {
    if (!sc) return '<div class="mp-d-empty">点任一节点查看场景详情。</div>';
    var up = depsOf(sc);
    var L = buildLayout();
    var down = L.edges.filter(function (e) { return e.from === sc.id; }).map(function (e) { return e.to; });
    function chips(ids, label) {
      if (!ids.length) return '';
      return '<div class="mp-d-row"><span class="rk">' + label + '</span><span class="rv">' +
        ids.map(function (id) {
          var t = A.index.byScene[id];
          return '<a class="mp-chip" href="#/scene/' + id + '">' + esc(t ? t.name : id) +
            '<b>' + id.toUpperCase() + '</b></a>';
        }).join('') + '</span></div>';
    }
    var mat = matOf(sc), inn = innOf(sc);
    /* 链路规模：以该场景为中心的上下游闭包，导出按钮用它做预览 */
    var ch = chainOf(sc.id), chLv = 0;
    ch.ids.forEach(function (s) { if (ch.depth[s] + 1 > chLv) chLv = ch.depth[s] + 1; });
    return '<div class="mp-d-head">' +
      '<div class="mp-d-l"><span class="mp-d-id">' + esc(sc.id.toUpperCase()) + '</span>' +
      '<h3>' + esc(sc.name) + '</h3>' +
      '<div class="mp-d-sub">' + esc(sc.stageName) + '环节 · 难度 ' + esc(sc.diff) +
      '<i class="mp-dot" style="background:' + matColor(mat) + '"></i>' + esc(matName(mat)) +
      '<i class="mp-dot" style="background:' + innColor(inn) + '"></i>创新度' + esc(inn) +
      '</div></div>' +
      '<div class="mp-d-r">' +
      '<a class="btn sm primary" href="#/scene/' + sc.id + '">进入场景 →</a>' +
      '<a class="btn sm ghost" href="#/stage/' + sc.stageId + '">同环节场景</a>' +
      '</div></div>' +
      '<div class="mp-d-body">' +
      '<div class="mp-d-row"><span class="rk">AI 介入点</span><span class="rv">' + esc(sc.point || '—') + '</span></div>' +
      (sc.methods && sc.methods.length ? '<div class="mp-d-row"><span class="rk">方法</span><span class="rv">' +
        sc.methods.map(function (k) {
          return '<span class="mtag sm" data-m="' + k + '"><b>' + esc((A.methods[k] || {}).abbr || k) + '</b>' +
            esc((A.methods[k] || {}).name || k) + '</span>';
        }).join('') + '</span></div>' : '') +
      ((sc.data && sc.data.length) ? '<div class="mp-d-row"><span class="rk">所需数据</span><span class="rv">' +
        esc(sc.data.slice(0, 3).map(function (d) { return d[0]; }).join('、')) + '</span></div>' : '') +
      chips(up, '上游依赖') +
      chips(down, '下游场景') +
      (strictOf(sc) ? '<div class="mp-d-warn">强监管场景：模型输出只能作为工程师判断的参考，不能直接下发作业指令。</div>' : '') +
      '<div class="mp-d-chain">' +
      '<div class="mp-dc-h"><span class="mp-dc-t">项目链路分析 · 上下游依赖链</span>' +
      '<span class="mp-dc-n">' + ch.ids.length + ' 个场景 / ' + ch.edges.length + ' 条依赖 / ' + chLv + ' 层</span></div>' +
      '<div class="mp-dc-acts">' +
      '<button type="button" class="btn sm primary" data-mp="chainmd">导出链路（MD）</button>' +
      '<button type="button" class="btn sm ghost" data-mp="chainjson">导出链路（JSON）</button>' +
      '</div></div>' +
      '</div>';
  }

  /* ---------------- 导出 ---------------- */
  function exportMD(root) {
    init();
    var f = currF(root);
    var hits = [];
    A.stages.forEach(function (st) {
      st.scenes.forEach(function (sc) { if (passes(sc, f)) hits.push(sc); });
    });
    var L = buildLayout();
    var l = [];
    l.push('# 介入点图谱 · 当前筛选结果（' + hits.length + ' 个场景）');
    l.push('');
    l.push('> 来源：石油勘探开发智能化可能性地图 · 介入点图谱（#/map）。导出日期 ' + new Date().toISOString().slice(0, 10) + '。');
    l.push('> 本站点为参考工具，不替代任何作业系统。「公开案例丰富度」/ 创新度是依据公开可见信息（技术难度、有无公开数据集、技术方向完备度、本站已接入案例）做的粗分层，不等于该技术在油田现场的工程成熟水平，也不是等级评定；数据条件需按本单位实际复核。');
    l.push('');
    var byStage = {};
    hits.forEach(function (sc) { (byStage[sc.stageName] = byStage[sc.stageName] || []).push(sc); });
    Object.keys(byStage).forEach(function (stName) {
      l.push('## ' + stName);
      l.push('');
      byStage[stName].forEach(function (sc) {
        var up = depsOf(sc);
        var down = L.edges.filter(function (e) { return e.from === sc.id; }).map(function (e) { return e.to; });
        l.push('- **' + sc.id.toUpperCase() + '　' + sc.name + '**（难度 ' + sc.diff +
          ' · 公开案例丰富度 ' + matName(matOf(sc)) + ' · 创新度 ' + innOf(sc) + (caseCount(sc) ? ' · 已接入案例' : '') + '）');
        l.push('  - 介入点：' + (sc.point || '—'));
        if (up.length) l.push('  - 上游依赖：' + up.map(function (id) {
          var t = A.index.byScene[id]; return (t ? t.name : id) + '（' + id.toUpperCase() + '）';
        }).join('、'));
        if (down.length) l.push('  - 下游场景：' + down.map(function (id) {
          var t = A.index.byScene[id]; return (t ? t.name : id) + '（' + id.toUpperCase() + '）';
        }).join('、'));
        l.push('  - 选题勾选：□ 候选　□ 数据不足　□ 已有同类　□ 排除');
      });
      l.push('');
    });
    download('entry-map-' + hits.length + '-' + today() + '.md', l.join('\n'), 'text/markdown;charset=utf-8');
  }

  /* ---------------- 下载 / 依赖链 ---------------- */
  function today() { return new Date().toISOString().slice(0, 10); }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* 邻接表：up[场景] = 它的上游，dn[场景] = 它的下游 */
  function adj() {
    var L = buildLayout(), up = {}, dn = {};
    L.edges.forEach(function (e) {
      (up[e.to] = up[e.to] || []).push(e.from);
      (dn[e.from] = dn[e.from] || []).push(e.to);
    });
    return { up: up, dn: dn };
  }

  /* 以某场景为中心的依赖链：全部上游闭包 + 自身 + 全部下游闭包，
     并按「离起点的最长距离」分层，得到上游 → 下游的顺序 */
  function chainOf(id) {
    var L = buildLayout(), gr = adj();
    var set = {}, stack = [id], x;
    set[id] = 1;
    while (stack.length) {
      x = stack.pop();
      (gr.up[x] || []).forEach(function (u) { if (!set[u]) { set[u] = 1; stack.push(u); } });
    }
    stack = [id];
    while (stack.length) {
      x = stack.pop();
      (gr.dn[x] || []).forEach(function (v) { if (!set[v]) { set[v] = 1; stack.push(v); } });
    }
    var ids = Object.keys(set), depth = {}, on = {};
    function dep(n) {
      if (depth[n] != null) return depth[n];
      if (on[n]) return 0;                 /* 出现环时不深究，按 0 处理 */
      on[n] = 1;
      var d = 0;
      (gr.up[n] || []).forEach(function (u) { if (set[u]) d = Math.max(d, dep(u) + 1); });
      on[n] = 0; depth[n] = d;
      return d;
    }
    ids.forEach(dep);

    var ord = {};
    A.stages.forEach(function (s, i) { ord[s.id] = i; });
    ids.sort(function (a, b) {
      var sa = A.index.byScene[a], sb = A.index.byScene[b];
      return (depth[a] - depth[b]) ||
        ((ord[sa ? sa.stageId : ''] || 0) - (ord[sb ? sb.stageId : ''] || 0)) ||
        ((L.byId[a] ? L.byId[a].y : 0) - (L.byId[b] ? L.byId[b].y : 0));
    });
    var edges = L.edges.filter(function (e) { return set[e.from] && set[e.to]; });
    return { center: id, ids: ids, depth: depth, edges: edges, up: gr.up, dn: gr.dn };
  }

  /* 链上场景的导出字段：方法 / 难度 / 监管风险 / 数据条件一次备齐 */
  function scInfo(id) {
    var sc = A.index.byScene[id];
    if (!sc) return null;
    return {
      id: id, name: sc.name, stageId: sc.stageId, stageName: sc.stageName,
      methods: (sc.methods || []).slice(), diff: sc.diff, point: sc.point || '',
      mat: matOf(sc), matName: matName(matOf(sc)), innov: innOf(sc),
      strict: strictOf(sc), cases: caseCount(sc),
      data: (sc.data || []).slice(0, 3).map(function (d) { return d[0]; })
    };
  }
  function mLine(i) {
    return i.methods.map(function (k) {
      var m = A.methods[k] || {};
      return (m.abbr || k) + (m.name ? ' ' + m.name : '');
    }).join(' / ') || '—';
  }
  function nm(id) {
    var t = A.index.byScene[id];
    return (t ? t.name : id) + '（' + id.toUpperCase() + '）';
  }

  /* 链路 Markdown：可直接粘进立项报告的「项目链路分析」章节 */
  function chainMD(id) {
    var c = chainOf(id), sc = A.index.byScene[id];
    if (!sc) return '';
    var lvMax = 0;
    c.ids.forEach(function (s) { if (c.depth[s] + 1 > lvMax) lvMax = c.depth[s] + 1; });
    var stages = {}, starts = [], ends = [], strict = [], thin = [], hard = [];
    c.ids.forEach(function (s) {
      var i = scInfo(s); if (!i) return;
      stages[i.stageName] = 1;
      var upIn = (c.up[s] || []).filter(function (u) { return c.depth[u] != null; });
      var dnIn = (c.dn[s] || []).filter(function (v) { return c.depth[v] != null; });
      if (!upIn.length) starts.push(nm(s));
      if (!dnIn.length) ends.push(nm(s));
      if (i.strict) strict.push(nm(s));
      if (i.mat === '仿真' || i.mat === '小试') thin.push(nm(s) + '（公开案例' + i.matName + '）');
      if (i.diff === '高') hard.push(nm(s));
    });

    var l = [];
    l.push('# 项目链路分析 · ' + sc.name + '（' + id.toUpperCase() + '）');
    l.push('');
    l.push('> 来源：石油勘探开发智能化可能性地图 · 介入点图谱（#/map）。导出日期 ' + today() + '。');
    l.push('> 口径说明：链路 = 以该场景为中心的**全部上游依赖闭包 + 自身 + 全部下游依赖闭包**，按「上游 → 下游」的层级（L1…）排列；难度 / 公开案例丰富度 / 创新度口径见站点首页「指标口径」说明。');
    l.push('');
    l.push('## 一、链路概览');
    l.push('');
    l.push('- 中心场景：' + nm(id) + '，所在环节「' + sc.stageName + '」，难度 ' + sc.diff + '，方法 ' + mLine(scInfo(id)));
    l.push('- 链路规模：' + c.ids.length + ' 个场景 / ' + c.edges.length + ' 条依赖 / ' + lvMax + ' 层，涉及 ' +
      Object.keys(stages).length + ' 个作业环节（' + Object.keys(stages).join('、') + '）');
    l.push('- 起点场景（链路内无上游，数据最独立，建议先做）：' + (starts.join('、') || '—'));
    l.push('- 末端场景（链路内无下游）：' + (ends.join('、') || '—'));
    l.push('');
    l.push('## 二、链路顺序（上游 → 下游）');
    var byLv = {};
    c.ids.forEach(function (s) { (byLv[c.depth[s]] = byLv[c.depth[s]] || []).push(s); });
    Object.keys(byLv).map(Number).sort(function (a, b) { return a - b; }).forEach(function (lv) {
      l.push('');
      l.push('### L' + (lv + 1) + (lv === c.depth[id] ? ' · 中心场景' : ''));
      l.push('');
      byLv[lv].forEach(function (s) {
        var i = scInfo(s); if (!i) return;
        var upIn = (c.up[s] || []).filter(function (u) { return c.depth[u] != null; });
        var dnIn = (c.dn[s] || []).filter(function (v) { return c.depth[v] != null; });
        l.push('- **' + s.toUpperCase() + '　' + i.name + '**（' + i.stageName + ' · 难度 ' + i.diff +
          ' · 方法 ' + mLine(i) + ' · 公开案例丰富度 ' + i.matName + ' · 创新度 ' + i.innov +
          (i.cases ? ' · 已接入案例 ' + i.cases + ' 个' : ' · 暂未接入案例') +
          (i.strict ? ' · ⚠ 强监管' : '') + '）');
        l.push('  - 介入点：' + (i.point || '—'));
        if (i.data.length) l.push('  - 主要数据：' + i.data.join('、'));
        if (upIn.length) l.push('  - 上游：' + upIn.map(nm).join('、'));
        if (dnIn.length) l.push('  - 下游：' + dnIn.map(nm).join('、'));
        l.push('  - 选题勾选：□ 候选　□ 数据不足　□ 已有同类　□ 排除');
      });
    });
    l.push('');
    l.push('## 三、风险与落地提示');
    l.push('');
    l.push('- 强监管场景（模型只给参考，不可自动决策）：' + (strict.length ? strict.join('、') : '无'));
    l.push('- 公开案例薄弱（资料少、需自行验证）：' + (thin.length ? thin.join('、') : '无'));
    l.push('- 难度偏高（涉密数据 / 机理耦合强）：' + (hard.length ? hard.join('、') : '无'));
    l.push('- 依赖深度：链路共 ' + lvMax + ' 层' +
      (lvMax >= 4 ? '，中心场景上游链条较长，建议先完成起点场景再逐级推进' : '，链条不长，可整体推进') + '。');
    l.push('');
    l.push('## 四、可直接引用的表述');
    l.push('');
    l.push('以「' + sc.name + '」为中心的依赖链覆盖 ' + c.ids.length + ' 个场景、' + c.edges.length +
      ' 条上下游依赖，横跨 ' + Object.keys(stages).join('、') + ' 等环节。' +
      '链条起点为' + (starts.length ? starts[0] : '本场景') + '，其输出依次作为下游场景的输入；' +
      '立项时建议以起点场景为数据基础，逐级验证后再向' +
      (ends.length ? '末端场景「' + (A.index.byScene[ends[0]] ? A.index.byScene[ends[0]].name : ends[0]) + '」' : '下游') +
      '推进。');
    l.push('');
    l.push('> ' + DISCLAIMER);
    return l.join('\n');
  }

  /* 链路 JSON：给后续做二次分析 / 画图用 */
  function chainJSON(id) {
    var c = chainOf(id), sc = A.index.byScene[id];
    if (!sc) return '{}';
    var lvMax = 0;
    c.ids.forEach(function (s) { if (c.depth[s] + 1 > lvMax) lvMax = c.depth[s] + 1; });
    var nodes = c.ids.map(function (s) {
      var i = scInfo(s);
      return {
        id: s, name: i.name, level: c.depth[s] + 1, isCenter: s === id,
        stage: i.stageId, stageName: i.stageName,
        methods: i.methods,
        methodNames: i.methods.map(function (k) { return (A.methods[k] || {}).name || k; }),
        difficulty: i.diff, maturity: i.mat, maturityName: i.matName, innovation: i.innov,
        regulated: i.strict, cases: i.cases, point: i.point, data: i.data,
        upstream: (c.up[s] || []).filter(function (u) { return c.depth[u] != null; }),
        downstream: (c.dn[s] || []).filter(function (v) { return c.depth[v] != null; })
      };
    });
    var risks = { regulated: [], thinEvidence: [], hard: [] };
    nodes.forEach(function (n) {
      if (n.regulated) risks.regulated.push(n.id);
      if (n.maturity === '仿真' || n.maturity === '小试') risks.thinEvidence.push(n.id);
      if (n.difficulty === '高') risks.hard.push(n.id);
    });
    var o = {
      meta: {
        source: '石油勘探开发智能化可能性地图 · 介入点图谱（#/map）',
        version: (A.meta && A.meta.version) || '',
        exportedAt: today(),
        view: MODE,
        disclaimer: DISCLAIMER
      },
      center: { id: id, name: sc.name, stage: sc.stageId, stageName: sc.stageName },
      chain: {
        scenes: c.ids.length, edges: c.edges.length, levels: lvMax,
        stages: nodes.map(function (n) { return n.stageName; })
          .filter(function (x, i, arr) { return arr.indexOf(x) === i; })
      },
      order: c.ids,
      nodes: nodes,
      edges: c.edges.map(function (e) {
        return { from: e.from, to: e.to };
      }),
      risks: risks
    };
    return JSON.stringify(o, null, 2);
  }

  function exportChain(id, kind) {
    init();
    if (!A || !A.index.byScene[id]) return;
    var name = 'chain-' + id + '-' + today();
    if (kind === 'json') download(name + '.json', chainJSON(id), 'application/json;charset=utf-8');
    else download(name + '.md', chainMD(id), 'text/markdown;charset=utf-8');
  }

  /* ---------------- 高亮 ---------------- */
  function highlight(root, id) {
    var L = buildLayout();
    var near = {}, edges = {};
    if (id) {
      var sc = A.index.byScene[id];
      near[id] = 1;
      if (sc) {
        depsOf(sc).forEach(function (u) { near[u] = 1; edges[u + '>' + id] = 1; });
        L.edges.forEach(function (e) {
          if (e.from === id) { near[e.to] = 1; edges[id + '>' + e.to] = 1; }
        });
      }
    }
    [].forEach.call(root.querySelectorAll('.mp-node'), function (n) {
      var nid = n.getAttribute('data-id');
      n.classList.toggle('sel', !!id && nid === id);
      n.classList.toggle('near', !!id && !!near[nid] && nid !== id);
    });
    [].forEach.call(root.querySelectorAll('.mp-edge'), function (p) {
      var on = !!edges[p.getAttribute('data-e')];
      p.classList.toggle('on', on);
      p.setAttribute('stroke', on ? '#1A4779' : '#9DB0C4');
      p.setAttribute('marker-end', on ? 'url(#mp-ar-on)' : 'url(#mp-ar)');
    });
  }

  /* ---------------- 聚焦：不重渲染，只改 transform 做动画 ---------------- */
  function redrawEdges(root) {
    var L = buildLayout();
    var F = curFocus ? focusLayout(L, colById(curFocus)) : null;
    var grp = root.querySelector('.mp-edges');
    if (!grp) return;
    grp.classList.add('fade');
    clearTimeout(edgeT);
    edgeT = setTimeout(function () {
      var byKey = {};
      edgeSegs(L, F).forEach(function (sg) { byKey[sg.from + '>' + sg.to] = sg; });
      [].forEach.call(grp.querySelectorAll('.mp-edge'), function (p) {
        var seg = byKey[p.getAttribute('data-e')];
        p.style.opacity = seg ? seg.op : 0;
        if (seg) p.setAttribute('d', seg.d);
      });
      grp.classList.remove('fade');
    }, 240);
  }

  function setSlab(root, sel, lab) {
    var el = root.querySelector(sel);
    if (!el) return;
    el.classList.toggle('hid', !lab);
    el.textContent = lab ? lab.t : '';   /* 清空旧文案，避免下次淡入时闪出上一个环节的标题 */
    if (!lab) return;
    el.textContent = lab.t;
    el.style.transform = 'translate(' + lab.x + 'px,' + lab.y + 'px)';
  }

  function applyFocus(root, id) {
    init();
    var L = buildLayout();
    curFocus = colById(id) ? id : '';
    var F = curFocus ? focusLayout(L, colById(curFocus)) : null;
    var backTxt = '返回全部' + (MODE === 'tech' ? '方法' : '环节');

    /* 列头：聚焦时放大并随列一起居中，其余淡化到背景（元素级，列内的依赖场景不受影响） */
    [].forEach.call(root.querySelectorAll('.mp-st-head'), function (h) {
      var sid = h.getAttribute('data-stage'), c = L.colBy[sid];
      var on = !!curFocus && sid === curFocus;
      var p = on ? { x: F.x, y: F.y } : { x: c.x, y: c.y };
      var bw = on ? F.w / SCALE : c.w;
      h.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)' + (on ? ' scale(' + SCALE + ')' : '');
      h.classList.toggle('on', on);
      h.classList.toggle('faded', !!curFocus && !on);
      h.setAttribute('aria-label', on ? backTxt : '展开 ' + c.st.name + ' 的全部场景');
      var ttl = h.querySelector('title');
      if (ttl) ttl.textContent = on ? '点击' + backTxt : '点击展开该列全部场景';
      var base = h.querySelector('.mp-bar-base');
      if (base) base.setAttribute('width', bw);
      var ox = 0;
      [].forEach.call(h.querySelectorAll('.mp-bar-seg'), function (sg) {
        var r = parseFloat(sg.getAttribute('data-r')) || 0;
        sg.setAttribute('x', ox.toFixed(1));
        sg.setAttribute('width', (bw * r).toFixed(1));
        ox += bw * r;
      });
      var nm = h.querySelector('.mp-st-name'), sub = h.querySelector('.mp-st-sub');
      if (nm) nm.setAttribute('x', bw / 2);
      if (sub) sub.setAttribute('x', bw / 2);
    });

    /* 节点：聚焦区的放大居中；依赖侧栏的场景原尺寸列出并保持清晰；
       其余回到概览位置并淡化。侧栏里的场景即使原本被折叠，也会显示出来。 */
    [].forEach.call(root.querySelectorAll('.mp-node'), function (n) {
      var nid = n.getAttribute('data-id');
      /* 技术视角下同一场景可能在多列出现，用 uid 找回它这一格的位置 */
      var it = L.byUid[n.getAttribute('data-uid')] || L.byId[nid];
      var np = F ? F.nodes[nid] : null;
      var p = np || it;
      var big = !!np && np.w > NW;
      n.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)' + (big ? ' scale(' + SCALE + ')' : '');
      n.classList.toggle('hid', !np && !it.vis);
      n.classList.toggle('big', big);
      n.classList.toggle('rel', !!np && !big);
      n.classList.toggle('faded', !!curFocus && !np);
    });

    /* 「还有 N 个」入口：展开后不再需要；聚焦时其余淡出 */
    [].forEach.call(root.querySelectorAll('.mp-more'), function (m) {
      var sid = m.getAttribute('data-stage');
      var on = !!curFocus && sid === curFocus;
      m.classList.toggle('hid', on);
      m.classList.toggle('faded', !!curFocus && !on);
    });

    /* 左右依赖侧栏标题 */
    setSlab(root, '.mp-slab-u', F && F.ulab);
    setSlab(root, '.mp-slab-d', F && F.dlab);

    var back = root.querySelector('[data-mp-back]');
    if (back) back.hidden = !curFocus;
    var bk = root.querySelector('.mp-back');
    if (bk) bk.classList.toggle('hid', !curFocus);

    redrawEdges(root);

    /* URL 同步（replaceState 不触发重渲染，动画不会被打断） */
    try {
      var ps = (g.location.hash.split('?')[1] || '').split('&').filter(Boolean)
        .filter(function (p) { return p.indexOf('f=') !== 0; });
      if (curFocus) ps.push('f=' + curFocus);
      history.replaceState(null, '', '#/map' + (ps.length ? '?' + ps.join('&') : ''));
    } catch (e) { }
  }

  /* ---------------- 交互 ---------------- */
  function urlWith(f) {
    var ps = [];
    if (MODE === 'tech') ps.push('v=tech');   /* 视图模式写进 URL，可分享 / 刷新保持 */
    if (f.m) ps.push('m=' + f.m);
    if (f.mat) ps.push('mat=' + encodeURIComponent(f.mat));
    if (f.d) ps.push('d=' + encodeURIComponent(f.d));
    if (f.dt) ps.push('dt=' + f.dt);
    if (f.c) ps.push('c=1');
    if (!f.e) ps.push('e=0');
    if (curFocus) ps.push('f=' + curFocus);
    return '#/map' + (ps.length ? '?' + ps.join('&') : '');
  }

  function bind(root) {
    init();
    if (!A) return;

    /* 筛选 chips / 下拉 / 复选框 → 写入 URL 后由外层重渲染 */
    root.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-mp-f]');
      if (chip) {
        var key = chip.getAttribute('data-mp-f'), val = chip.getAttribute('data-mp-v') || '';
        var f = currF(root);
        f[key] = f[key] === val ? '' : val;
        location.hash = urlWith(f);
        return;
      }
      var btn = e.target.closest('[data-mp="clear"]');
      if (btn) { location.hash = MODE === 'tech' ? '#/map?v=tech' : '#/map'; return; }
      if (e.target.closest('[data-mp="exp"]')) { exportMD(root); return; }
      /* 链路导出：以当前选中场景为中心的上下游依赖链 */
      if (e.target.closest('[data-mp="chainmd"]')) { if (curSel) exportChain(curSel, 'md'); return; }
      if (e.target.closest('[data-mp="chainjson"]')) { if (curSel) exportChain(curSel, 'json'); return; }
      /* 视图切换：流程依赖 ↔ 技术聚类，切视图时退回概览 */
      var mdb = e.target.closest('[data-mp-mode]');
      if (mdb) {
        var mv = mdb.getAttribute('data-mp-mode');
        if (mv !== MODE) { MODE = mv === 'tech' ? 'tech' : 'flow'; curFocus = ''; curSel = ''; location.hash = urlWith(currF(root)); }
        return;
      }
      if (e.target.closest('[data-mp-back]')) { applyFocus(root, ''); return; }
    });
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute('data-mp') === 'dt' || t.getAttribute('data-mp') === 'case' || t.getAttribute('data-mp') === 'edge') {
        var f = currF(root);
        f.e = root.querySelector('[data-mp="edge"]').checked;
        location.hash = urlWith(f);
      }
    });

    /* 搜索：本地即时过滤，不触发重渲染 */
    var timer = null;
    root.addEventListener('input', function (e) {
      if (e.target.getAttribute('data-mp') !== 'q') return;
      clearTimeout(timer);
      timer = setTimeout(function () { apply(root); }, 150);
    });

    /* 图谱交互 */
    var wrap = root.querySelector('.mp-wrap');
    if (wrap) {
      wrap.addEventListener('click', function (e) {
        /* 画布左上角的返回按钮 */
        if (e.target.closest('[data-mp-back]')) { applyFocus(root, ''); return; }

        /* 列头：未聚焦→展开该环节；已聚焦→返回 */
        var head = e.target.closest('.mp-st-head');
        if (head) {
          var hs = head.getAttribute('data-stage');
          applyFocus(root, curFocus === hs ? '' : hs);
          return;
        }
        var more = e.target.closest('.mp-more');
        if (more) { applyFocus(root, more.getAttribute('data-stage')); return; }

        var node = e.target.closest('.mp-node');
        if (!node) return;
        var id = node.getAttribute('data-id');
        if (e.detail === 2) { location.hash = '#/scene/' + id; return; }

        var st = colKeyOf(id);
        /* 点任一场景：先展开它所在的列；已经展开的列里再点才看详情 */
        if (curFocus !== st) { applyFocus(root, st); return; }
        curSel = id;
        highlight(root, id);
        var d = root.querySelector('.mp-detail');
        if (d) d.innerHTML = detailHTML(A.index.byScene[id]);
      });
      wrap.addEventListener('mouseover', function (e) {
        var node = e.target.closest('.mp-node');
        if (node) highlight(root, node.getAttribute('data-id'));
      });
      wrap.addEventListener('mouseout', function (e) {
        if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.mp-node')) highlight(root, '');
      });
      wrap.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('[data-mp-back]')) { e.preventDefault(); applyFocus(root, ''); return; }
        var head = e.target.closest('.mp-st-head');
        if (head) {
          e.preventDefault();
          var hs2 = head.getAttribute('data-stage');
          applyFocus(root, curFocus === hs2 ? '' : hs2);
          return;
        }
        var more2 = e.target.closest('.mp-more');
        if (more2) { e.preventDefault(); applyFocus(root, more2.getAttribute('data-stage')); return; }
        var node = e.target.closest('.mp-node');
        if (!node) return;
        e.preventDefault();
        var nid = node.getAttribute('data-id');
        var ck = colKeyOf(nid);
        if (curFocus !== ck) { applyFocus(root, ck); return; }
        location.hash = '#/scene/' + nid;
      });
    }

    /* 连线显隐 */
    var ec = root.querySelector('[data-mp="edge"]');
    if (ec && root.querySelector('.mp-svg')) {
      root.querySelector('.mp-svg').classList.toggle('no-edge', !ec.checked);
    }

    apply(root);
  }

  g.MapPage = { html: html, bind: bind };

  /* 本模块在 shell.js 之后加载：若首屏就是图谱页，补一次重渲染 */
  if ((g.location.hash || '').indexOf('#/map') === 0) {
    try { g.dispatchEvent(new Event('hashchange')); } catch (e) { }
  }
})(window);
