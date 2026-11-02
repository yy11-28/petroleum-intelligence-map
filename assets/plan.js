/* =========================================================
   plan.js —— 立项决策台 #/plan
   ---------------------------------------------------------
   把「选题 — 评估 — 选型 — 出报告」合成一条闭环：
     ① 候选池   加入待评估的场景
     ② 可行性   数据缺口 / 标注成本 / 上游依赖 / 难度 / 公开案例丰富度 / 合规 → 加权排序
     ③ 技术路线 按方法标签与数据口径推荐路线，并给出六条路线的对比
     ④ 风险产出 强监管与失效边界提示 → 生成《立项评估报告》(MD / 打印 / 链接)
   所有指标都由 ATLAS 与 STAGE_META 实时算出，本页只做聚合，不改动数据层。
   状态存 localStorage；候选与步骤写进 URL，便于分享。
   ========================================================= */
(function (g) {
  'use strict';

  var A = null, SM = null, CATS = [], S = null;
  var KEY = 'atlas-plan-v1';

  /* ---------------- 双语 ---------------- */
  function L(z, e) {
    return document.documentElement.getAttribute('lang') === 'en' ? e : z;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 数据层的名称与枚举（场景名 / 环节 / 难度 / 公开案例丰富度）走词典翻译；
     中文界面保持中文，与 shell 的 LANG=en 才替换保持一致 */
  function tr(t) {
    if (!t) return t;
    if (document.documentElement.getAttribute('lang') !== 'en') return t;
    var D = g.ATLAS_EN;
    return (D && D[t]) ? D[t] : t;
  }

  /* ---------------- 调研标尺维度（不是打分） ---------------- */
  var DIMS = [
    { k: 'avail', w: { fast: 3, novel: 2, safe: 3 } },
    { k: 'label', w: { fast: 2, novel: 1, safe: 2 } },
    { k: 'dep', w: { fast: 2, novel: 1, safe: 2 } },
    { k: 'diff', w: { fast: 2, novel: 1, safe: 2 } },
    { k: 'mat', w: { fast: 2, novel: 2, safe: 3 } },
    { k: 'risk', w: { fast: 1, novel: 1, safe: 2 } }
  ];

  var PRESETS = [
    { k: 'fast', rev: false },
    { k: 'novel', rev: true },
    { k: 'safe', rev: false }
  ];

  var DIM_NAME = {
    avail: ['数据可得性', 'Data availability'],
    label: ['标注成本', 'Labelling cost'],
    dep: ['上游依赖', 'Upstream deps'],
    diff: ['技术难度', 'Difficulty'],
    mat: ['公开可见度', 'Public visibility'],
    risk: ['合规风险', 'Compliance']
  };

  var DIM_HINT = {
    avail: ['按你已勾选的数据口径，还缺几类', 'Data categories still missing against your ticks'],
    label: ['是否需要专家标注（决定最贵的那一步）', 'Whether expert labelling is needed'],
    dep: ['是否要先解决上游场景才有数据', 'Whether upstream scenes must be solved first'],
    diff: ['方法本身的难度（低 / 中 / 高）', 'Inherent difficulty (low / mid / high)'],
    mat: ['公开案例只代表可见度：少 ≠ 不能做，只说明公开资料少', 'Public cases signal visibility: few does not mean infeasible'],
    risk: ['强监管场景只能给参考，不可自动决策', 'Regulated scenes are advisory only']
  };

  var PRESET_NAME = {
    fast: ['快速见效', 'Fast wins'],
    novel: ['创新性优先', 'Novelty first'],
    safe: ['稳妥落地', 'Safe delivery']
  };

  var PRESET_NOTE = {
    fast: ['数据齐、依赖少、难度低的先做', 'Favour complete data, few deps, low difficulty'],
    novel: ['公开案例丰富度反向计：公开案例越少，可研究的空白越大', 'Richness is reversed: fewer public cases means more open room'],
    safe: ['看重合规与落地确定性，避开强监管', 'Favour compliance and certainty, avoid regulated scenes']
  };

  /* ---------------- 技术路线（六条） ---------------- */
  var ROUTES = [
    {
      k: 'rule', n: ['规则引擎', 'Rule engine'],
      d: ['低：规则与阈值即可启动', 'Low: rules and thresholds are enough'],
      lab: ['无需标注', 'No labelling'],
      exp: ['高：完全可追溯', 'High: fully traceable'],
      imp: ['低：但覆盖面有限', 'Low, though coverage is limited'],
      mnt: ['规则膨胀后难维护', 'Hard to maintain once rules multiply'],
      fail: ['边界外场景直接失效', 'Fails outright outside its boundary']
    },
    {
      k: 'ml', n: ['传统机器学习', 'Classical ML'],
      d: ['中：特征工程依赖经验', 'Medium: feature engineering is experience-bound'],
      lab: ['中：需标签，样本量要求适中', 'Medium: labels needed, modest sample size'],
      exp: ['中高：树模型可解释', 'Medium-high: tree models are explainable'],
      imp: ['中', 'Medium'],
      mnt: ['中：需定期重训', 'Medium: periodic retraining'],
      fail: ['分布漂移后性能下滑', 'Degrades after distribution shift']
    },
    {
      k: 'dl', n: ['深度学习 / CV', 'Deep learning / CV'],
      d: ['高：需大规模样本', 'High: needs large samples'],
      lab: ['高：标注是主要成本', 'High: labelling dominates cost'],
      exp: ['低：黑箱', 'Low: black box'],
      imp: ['中高：算力与工程要求高', 'Medium-high: compute and engineering heavy'],
      mnt: ['中：需监控与重训', 'Medium: monitoring and retraining'],
      fail: ['小样本与域外样本失稳', 'Unstable on small or out-of-domain samples']
    },
    {
      k: 'ts', n: ['时序预测', 'Time-series'],
      d: ['中高：需连续时序', 'Medium-high: needs continuous series'],
      lab: ['中：可用自监督', 'Medium: self-supervision helps'],
      exp: ['中', 'Medium'],
      imp: ['中', 'Medium'],
      mnt: ['中：漂移敏感', 'Medium: drift sensitive'],
      fail: ['工况切换段误差放大', 'Error spikes across regime changes']
    },
    {
      k: 'nlp', n: ['文本理解 / NLP', 'Text / NLP'],
      d: ['中：需领域语料', 'Medium: needs domain corpus'],
      lab: ['中高：需实体与关系标注', 'Medium-high: entity and relation labels'],
      exp: ['中', 'Medium'],
      imp: ['中：需术语与模板对齐', 'Medium: terminology and template alignment'],
      mnt: ['中：口径变化要重训', 'Medium: retrain when conventions change'],
      fail: ['未登录术语与长尾句式', 'Unseen terms and long-tail phrasing']
    },
    {
      k: 'opt', n: ['优化求解', 'Optimisation'],
      d: ['低中：需目标与约束参数', 'Low-medium: needs objectives and constraints'],
      lab: ['无需标注', 'No labelling'],
      exp: ['高：约束可解释', 'High: constraints are explainable'],
      imp: ['中：建模是主要成本', 'Medium: modelling dominates cost'],
      mnt: ['低', 'Low'],
      fail: ['模型假设不成立时结果不可用', 'Results unusable when assumptions break']
    },
    {
      k: 'kg', n: ['知识图谱', 'Knowledge graph'],
      d: ['中高：需实体与关系', 'Medium-high: needs entities and relations'],
      lab: ['中高：需专家校验', 'Medium-high: expert validation'],
      exp: ['高：路径可追溯', 'High: paths are traceable'],
      imp: ['中高：本体与对齐成本高', 'Medium-high: ontology and alignment cost'],
      mnt: ['中：需持续更新', 'Medium: continuous updates'],
      fail: ['覆盖不到的实体给不出答案', 'No answer for uncovered entities']
    }
  ];

  /* ai = 定位里的五类 AI 方法；eng = 工程落地路线（不是 AI 方法类别，用于先把流程跑通） */
  var ROUTE_GRP = { dl: 'ai', ts: 'ai', nlp: 'ai', opt: 'ai', kg: 'ai', rule: 'eng', ml: 'eng' };

  var ROUTE_DIM_HEAD = [
    ['数据需求', 'Data need'], ['标注成本', 'Labelling'], ['可解释性', 'Explainability'],
    ['落地难度', 'Implementation'], ['维护成本', 'Maintenance'], ['失效边界', 'Failure boundary']
  ];

  var STEP_NAME = [
    ['定范围', 'Scope'], ['查可行性', 'Feasibility'], ['定路线', 'Approach'], ['出报告', 'Report']
  ];

  function routeByKey(k) {
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].k === k) return ROUTES[i];
    return null;
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    A = g.ATLAS;
    SM = g.STAGE_META;
    if (SM && SM.DATA_CATS) CATS = SM.DATA_CATS;
    if (!S) S = load();
    /* 丢掉数据层里已经不存在的 id：旧链接或旧缓存留下的脏数据不该再出现在候选池 */
    if (A && A.index && S.ids.length) {
      S.ids = S.ids.filter(function (id) { return !!A.index.byScene[id]; });
    }
  }

  function load() {
    var d = { ids: [], have: [], preset: 'fast' };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          d.ids = Array.isArray(o.ids) ? o.ids : [];
          d.have = Array.isArray(o.have) ? o.have : [];
          d.preset = o.preset || 'fast';
        }
      }
    } catch (e) { }
    return d;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  }

  /* ---------------- 指标 ---------------- */
  function needCats(sc) {
    var out = [];
    CATS.forEach(function (c) { if (SM && SM.cellOf(sc, c.k) === 2) out.push(c.k); });
    return out;
  }

  function gapOf(sc) {
    return needCats(sc).filter(function (k) { return S.have.indexOf(k) < 0; });
  }

  function depsOf(sc) {
    var raw = (SM && SM.depsOf(sc)) || [];
    return raw.map(function (d) {
      return typeof d === 'string' ? (A.index.byScene[d] || null) : d;
    }).filter(Boolean);
  }

  function caseCount(sc) {
    try { return (g.Cases && g.Cases.bySceneAll) ? g.Cases.bySceneAll(sc.id).length : 0; } catch (e) { return 0; }
  }

  function matOf(sc) { return (SM && SM.maturityOf(sc)) || ''; }
  /* 档位 key（仿真/小试/试用/常态）只用于判定；对外一律显示中性名 */
  function matName(k) {
    if (!k) return '-';
    var M = (SM && SM.MAT) || [];
    for (var i = 0; i < M.length; i++) if (M[i].k === k) return M[i].name || k;
    return k;
  }
  function innOf(sc) { return (SM && SM.innovOf(sc.id)) || ''; }
  function isRisk(sc) { return !!(SM && SM.riskOf && SM.riskOf(sc)); }

  /* 六个维度各 1—5 分，越高越容易起步 */
  function scoreOf(sc) {
    var gap = gapOf(sc);
    var avail = [5, 4, 3, 2, 1][Math.min(gap.length, 4)];
    var need = needCats(sc);
    var label = need.indexOf('D10') >= 0 ? 2 : (need.indexOf('D5') >= 0 ? 3 : 4);
    var dn = depsOf(sc).length;
    var dep = dn === 0 ? 5 : (dn === 1 ? 4 : (dn === 2 ? 3 : 2));
    var diff = sc.diff === '低' ? 5 : (sc.diff === '高' ? 1 : 3);
    var m = matOf(sc);
    var mat = m === '常态' ? 5 : (m === '试用' ? 4 : (m === '小试' ? 3 : 2));
    var risk = isRisk(sc) ? 2 : 5;
    return { avail: avail, label: label, dep: dep, diff: diff, mat: mat, risk: risk };
  }

  function totalOf(sc, preset) {
    var s = scoreOf(sc);
    var rev = (preset === 'novel');
    var sum = 0, wsum = 0;
    DIMS.forEach(function (d) {
      var v = (rev && d.k === 'mat') ? (6 - s[d.k]) : s[d.k];
      var w = d.w[preset] || 1;
      sum += v * w; wsum += 5 * w;
    });
    return wsum ? Math.round(sum / wsum * 100) : 0;
  }

  /* ---------------- 技术路线推荐 ---------------- */
  function routesOf(sc) {
    var ms = sc.methods || [];
    var out = [];
    if (ms.indexOf('kg') >= 0) out.push('kg');
    if (ms.indexOf('opt') >= 0) out.push('opt');
    if (ms.indexOf('cv') >= 0) out.push('dl');
    if (ms.indexOf('ts') >= 0) out.push('ts');
    if (ms.indexOf('nlp') >= 0) out.push('nlp');
    if (!out.length) {
      var gap = gapOf(sc);
      out.push(gap.length > 2 ? 'rule' : 'ml');
    }
    return out.filter(function (k, i) { return out.indexOf(k) === i; });
  }

  function routeWhy(sc, ks) {
    var bits = [];
    if (ks.indexOf('kg') >= 0) {
      bits.push(L('场景涉及规范条款或多源实体的关系推理，知识图谱可给出可追溯路径',
        'The scene involves spec clauses or multi-source relations; a KG gives traceable paths'));
    }
    if (ks.indexOf('opt') >= 0) {
      bits.push(L('目标与约束明确，可形式化为优化问题直接求解',
        'Objectives and constraints are explicit, so it can be posed as an optimisation'));
    }
    if (ks.indexOf('dl') >= 0) {
      bits.push(L('输入以影像 / 曲线为主，深度学习在特征表达上占优，但需要足够标注样本',
        'Inputs are imagery / curves where deep learning wins on representation, at the cost of labels'));
    }
    if (ks.indexOf('ts') >= 0) {
      bits.push(L('数据是连续过程参数，时序建模可直接利用历史动态',
        'Data are continuous process parameters; time-series models exploit history directly'));
    }
    if (ks.indexOf('nlp') >= 0) {
      bits.push(L('文本与报告是主要输入，需先做抽取与术语对齐',
        'Text and reports are the main input, so extraction and terminology alignment come first'));
    }
    if (ks.indexOf('ml') >= 0) {
      bits.push(L('样本量有限或要求可解释，传统机器学习更稳妥',
        'With limited samples or an explainability requirement, classical ML is safer'));
    }
    if (ks.indexOf('rule') >= 0) {
      bits.push(L('数据条件缺口较大，先用规则引擎把流程跑通并积累数据',
        'Data gaps are large, so start with a rule engine to run the process and accumulate data'));
    }
    return bits.join(L('；', '; '));
  }

  /* ---------------- 报告 ---------------- */
  function reportMD(rows, preset) {
    var d = new Date();
    var stamp = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var en = document.documentElement.getAttribute('lang') === 'en';
    var l = [];
    l.push('# ' + (en ? 'Project assessment' : '立项评估报告') + ' · ' + (en ? 'Petro × AI Atlas' : '智能化可能性地图'));
    l.push('');
    l.push((en ? 'Exported' : '导出时间') + '：' + stamp);
    l.push((en ? 'Preset' : '参考口径') + '：' + PRESET_NAME[preset][en ? 1 : 0] + '（' + PRESET_NOTE[preset][en ? 1 : 0] + '）');
    l.push((en ? 'Note' : '说明') + '：' + (en
      ? 'The six dimensions are survey gauges that order candidates by how easy each is to start. They are not scores, not a value rating, and not a substitute for review.'
      : '六项是调研标尺：按「起步难易」排序，方便横向对照客观条件；不是量化打分，不给项目价值评级，也不替代立项评审。'));
    l.push((en ? 'Data held' : '已具备数据类别') + '：' +
      (S.have.length ? S.have.map(catName).join(' / ') : (en ? 'none ticked' : '未勾选')));
    l.push('');
    l.push('## ' + (en ? '1. Candidates and reference gauges' : '一、候选场景与参考刻度'));
    l.push('');
    l.push('| ' + (en ? 'Scene' : '场景') + ' | ' + (en ? 'Stage' : '环节') + ' | ' +
      (en ? 'Data gap' : '数据缺口') + ' | ' + (en ? 'Upstream' : '上游依赖') + ' | ' +
      (en ? 'Difficulty' : '难度') + ' | ' + (en ? 'Public-case richness' : '公开案例丰富度') + ' | ' +
      (en ? 'Route' : '参考路线') + ' | ' + (en ? 'Gauge' : '参考刻度') + ' |');
    l.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    rows.forEach(function (r) {
      l.push('| ' + tr(r.sc.name) + ' | ' + tr(r.sc.stageName) + ' | ' +
        (r.gap.length ? r.gap.map(catName).join('、') : (en ? 'none' : '无')) + ' | ' +
        (r.deps.length ? r.deps.map(function (x) { return tr(x.name); }).join('、') : (en ? 'none' : '无')) + ' | ' +
        tr(r.sc.diff) + ' | ' + tr(matName(matOf(r.sc))) + ' | ' +
        r.routes.map(function (k) { var o = routeByKey(k); return o ? o.n[en ? 1 : 0] : k; }).join(' + ') + ' | ' +
        r.total + ' |');
    });
    l.push('');
    l.push('## ' + (en ? '2. Scene by scene' : '二、逐项说明'));
    l.push('');
    rows.forEach(function (r, i) {
      var sc = r.sc, en2 = en;
      l.push('### ' + (i + 1) + '. ' + tr(sc.name) + '（' + tr(sc.stageName) + '）');
      l.push('');
      l.push('- ' + (en2 ? 'Problem' : '业务问题') + '：' + (sc.problem || '-'));
      l.push('- ' + (en2 ? 'AI entry point' : 'AI 介入点') + '：' + (sc.point || '-'));
      l.push('- ' + (en2 ? 'Methods' : '方法标签') + '：' + (sc.methods || []).join(' / '));
      l.push('- ' + (en2 ? 'Data gap' : '数据缺口') + '：' +
        (r.gap.length ? r.gap.map(catName).join('、') : (en2 ? 'none' : '无')));
      l.push('- ' + (en2 ? 'Upstream' : '上游依赖') + '：' +
        (r.deps.length ? r.deps.map(function (x) { return x.name; }).join('、') : (en2 ? 'none' : '无')));
      l.push('- ' + (en2 ? 'Difficulty' : '技术难度') + '：' + tr(sc.diff) + (sc.diffWhy ? '（' + sc.diffWhy + '）' : ''));
      l.push('- ' + (en2 ? 'Recommended route' : '推荐技术路线') + '：' +
        r.routes.map(function (k) { var o = routeByKey(k); return o ? o.n[en2 ? 1 : 0] : k; }).join(' + '));
      l.push('- ' + (en2 ? 'Risk & boundary' : '风险与边界') + '：' + (isRisk(sc)
        ? (en2 ? 'Regulated scene — model output is advisory only, never auto-executed'
          : '强监管场景：模型输出只能作为工程师判断的参考，不可直接下发作业指令')
        : (en2 ? 'No auto-decision flag; verify data conditions against local practice'
          : '未标记强监管；数据条件仍需按本单位实际复核')));
      l.push('');
    });
    l.push('## ' + (en ? '3. Next steps' : '三、下一步准备清单'));
    l.push('');
    var allGap = {};
    rows.forEach(function (r) { r.gap.forEach(function (k) { allGap[k] = (allGap[k] || 0) + 1; }); });
    var gapKeys = Object.keys(allGap).sort(function (a, b) { return allGap[b] - allGap[a]; });
    if (gapKeys.length) {
      gapKeys.forEach(function (k) {
        l.push('- [ ] ' + (en ? 'Fill data category ' : '补齐数据类别 ') + catName(k) +
          '（' + (en ? 'needed by ' : '被 ') + allGap[k] + (en ? ' scenes' : ' 个场景需要') + '）');
      });
    } else {
      l.push('- [ ] ' + (en ? 'No data gaps for the current ticks; start with labelling and engineering validation'
        : '当前勾选下没有数据缺口；下一步是标注与工程校核'));
    }
    var risky = rows.filter(function (r) { return isRisk(r.sc); });
    if (risky.length) {
      l.push('- [ ] ' + (en ? 'Plan human review for regulated scenes: ' : '为强监管场景安排人工复核：') +
        risky.map(function (r) { return r.sc.name; }).join('、'));
    }
    l.push('- [ ] ' + (en ? 'Confirm sample size, labelling conventions and availability with your own unit'
      : '与本单位确认样本量、标注口径与数据可得性'));
    l.push('');
    l.push('> ' + (en
      ? 'This site is a reference tool, not a substitute for any operational system. "Public-case richness" / novelty tiers are coarse layers drawn from public information (difficulty, open datasets, method readiness, cases shown here); they do not measure field maturity and must be re-checked against your own unit.'
      : '本站点为参考工具，不替代任何作业系统。「公开案例丰富度」/ 创新度是依据公开可见信息（技术难度、有无公开数据集、技术方向完备度、本站已接入案例）做的粗分层，不等于该技术在油田现场的工程成熟水平，也不是等级评定；数据条件需按本单位实际复核。'));
    return l.join('\n');
  }

  function catName(k) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].k === k) return tr(CATS[i].name);
    return k;
  }

  function mNames(sc) {
    return (sc.methods || []).map(function (k) {
      var m = A.meta && A.meta.methods && A.meta.methods[k];
      return m ? (m.name || k) : k;
    }).join(' · ');
  }

  /* ---------------- 渲染 ---------------- */
  function rowsOf() {
    return S.ids.map(function (id) { return A.index.byScene[id]; })
      .filter(Boolean)
      .map(function (sc) {
        return {
          sc: sc, gap: gapOf(sc), deps: depsOf(sc),
          routes: routesOf(sc), total: totalOf(sc, S.preset), s: scoreOf(sc)
        };
      })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function stepsHTML(cur) {
    return '<div class="pl-steps">' + STEP_NAME.map(function (s, i) {
      var n = i + 1;
      var cls = 'pl-step' + (n === cur ? ' on' : (n < cur ? ' done' : ''));
      return '<button type="button" class="' + cls + '" data-pl-step="' + n + '">' +
        '<span class="sn">' + n + '</span><span class="lb">' + L(s[0], s[1]) + '</span></button>';
    }).join('') + '</div>';
  }

  function poolHeadHTML() {
    return L('候选池', 'Candidates') + '（' + S.ids.length + '）';
  }

  function optsHTML() {
    return A.stages.map(function (st) {
      var inner = st.scenes.map(function (sc) {
        var on = S.ids.indexOf(sc.id) >= 0;
        return '<option value="' + esc(sc.id) + '" data-nm="' + esc(sc.name) + '"' +
          (on ? ' disabled' : '') + '>' + esc(sc.name) + (on ? ' ✓' : '') + '</option>';
      }).join('');
      return '<optgroup label="' + esc(st.name) + '">' + inner + '</optgroup>';
    }).join('');
  }

  function poolListHTML() {
    var items = S.ids.map(function (id) {
      var sc = A.index.byScene[id];
      if (!sc) return '';
      return '<div class="pl-pool-item"><span class="nm"><b>' + esc(tr(sc.name)) + '</b>' +
        '<span>' + esc(tr(sc.stageName)) + ' · ' + esc(mNames(sc)) + '</span></span>' +
        '<button type="button" class="rm" data-pl-rm="' + esc(sc.id) + '" title="' +
        L('移出候选池', 'Remove') + '">×</button></div>';
    }).join('');

    return items || '<div class="pl-pool-empty">' +
      L('还没有候选场景。用上面的下拉框加入，或从场景页 / 图谱进入。',
        'No candidates yet. Add with the selector above, or come from a scene page or the map.') +
      '</div>';
  }

  function poolHTML() {
    return '<aside class="pl-pool"><h3>' + poolHeadHTML() + '</h3>' +
      '<p class="hint">' + L('把要比较的场景加进来，右侧四步会实时重算。',
        'Add the scenes you want to compare; the four steps on the right recalculate live.') + '</p>' +
      '<div class="pl-add"><select id="pl-sel">' + optsHTML() + '</select>' +
      '<button type="button" class="btn sm primary" data-pl-add>' + L('加入', 'Add') + '</button></div>' +
      '<div class="pl-pool-list">' + poolListHTML() + '</div></aside>';
  }

  function step1HTML() {
    var rows = rowsOf();
    if (!rows.length) {
      return '<div class="pl-empty"><b>' + L('先加入候选场景', 'Add candidates first') + '</b>' +
        L('左侧下拉框按作业环节列出了全部场景，选一个加进来。',
          'The selector on the left lists every scene by stage — pick one to begin.') + '</div>';
    }
    var en = document.documentElement.getAttribute('lang') === 'en';
    var tb = '<div class="pl-tw"><table class="pl-tb"><thead><tr><th>' +
      L('场景', 'Scene') + '</th><th>' + L('环节', 'Stage') + '</th><th>' +
      L('方法', 'Methods') + '</th><th>' + L('难度', 'Difficulty') + '</th><th>' +
      L('公开案例丰富度', 'Public cases') + '</th><th title="' +
      esc(L('公开案例少不等于不能做，只说明公开资料少', 'Few public cases does not mean infeasible — only that little is published')) +
      '">' + L('案例', 'Cases') + '</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var cn = caseCount(r.sc);
        return '<tr><td class="sc-nm"><a href="#/scene/' + esc(r.sc.id) + '">' + esc(r.sc.name) + '</a></td>' +
          '<td>' + esc(tr(r.sc.stageName)) + '</td><td>' + esc(mNames(r.sc)) + '</td>' +
          '<td>' + esc(tr(r.sc.diff)) + '</td><td>' + esc(matName(matOf(r.sc))) + '</td>' +
          '<td class="' + (cn ? 'ok' : 'gap') + '" title="' +
          esc(L('公开案例少不等于不能做，只说明公开资料少', 'Few public cases does not mean infeasible — only that little is published')) +
          '">' + (cn || (en ? 'none' : '无')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    return '<div class="pl-sec"><div class="pl-sec-h"><h3>' + L('① 定范围：要比较哪些场景', '① Scope: which scenes') +
      '</h3><span class="sub">' + L('共 ' + rows.length + ' 个候选', rows.length + ' candidates') + '</span></div>' +
      tb +
      '<p class="pl-cat-note" style="margin-top:12px">' +
      L('下一步会按你手头已有的数据口径计算缺口，所以先想清楚「能拿到什么」。',
        'The next step measures gaps against the data categories you already hold, so be clear on what you can get.') +
      '</p></div>';
  }

  function step2HTML() {
    var rows = rowsOf();
    if (!rows.length) return step1HTML();

    var en = document.documentElement.getAttribute('lang') === 'en';
    var chips = CATS.map(function (c) {
      var on = S.have.indexOf(c.k) >= 0;
      return '<button type="button" class="pl-cat' + (on ? ' on' : '') + '" data-pl-cat="' + esc(c.k) + '">' +
        esc(c.name) + '</button>';
    }).join('');

    var presets = PRESETS.map(function (p) {
      return '<button type="button" class="pl-preset' + (S.preset === p.k ? ' on' : '') +
        '" data-pl-preset="' + p.k + '" title="' + esc(L(PRESET_NOTE[p.k][0], PRESET_NOTE[p.k][1])) + '">' +
        L(PRESET_NAME[p.k][0], PRESET_NAME[p.k][1]) + '</button>';
    }).join('');

    var head = '<tr><th>' + L('场景', 'Scene') + '</th>' +
      DIMS.map(function (d) {
        return '<th title="' + esc(L(DIM_HINT[d.k][0], DIM_HINT[d.k][1])) + '">' +
          L(DIM_NAME[d.k][0], DIM_NAME[d.k][1]) + '</th>';
      }).join('') + '<th title="' + esc(L('越容易起步数值越高，用于排序，不是评分', 'Higher means easier to start; for ordering, not rating')) +
      '">' + L('参考刻度', 'Gauge') + '</th></tr>';

    var body = rows.map(function (r) {
      var tds = DIMS.map(function (d) {
        var v = (S.preset === 'novel' && d.k === 'mat') ? (6 - r.s[d.k]) : r.s[d.k];
        var w = Math.round(v / 5 * 100);
        var col = v >= 4 ? 'var(--ok)' : (v >= 3 ? 'var(--warn)' : 'var(--bad)');
        return '<td class="num" title="' + esc(L(DIM_HINT[d.k][0], DIM_HINT[d.k][1])) + '">' +
          '<span class="pl-score">' + v + '</span>' +
          '<span class="pl-bar-t"><i style="width:' + Math.max(w, 12) + '%;background:' + col + '"></i></span></td>';
      }).join('');
      return '<tr><td class="sc-nm">' + esc(r.sc.name) +
        '<span>' + esc(r.sc.stageName) + (r.gap.length ? ' · ' + L('缺 ', 'missing ') + r.gap.length : '') + '</span></td>' +
        tds + '<td class="num pl-total">' + r.total + '</td></tr>';
    }).join('');

    var legend = '<div class="pl-legend">' + DIMS.map(function (d) {
      return '<span><b>' + L(DIM_NAME[d.k][0], DIM_NAME[d.k][1]) + '</b> ' +
        L(DIM_HINT[d.k][0], DIM_HINT[d.k][1]) + '</span>';
    }).join('') + '</div>';

    return '<div class="pl-sec"><div class="pl-sec-h"><h3>' + L('② 查可行性：先勾你已有的数据', '② Feasibility: tick the data you have') +
      '</h3><span class="sub">' + L('按「能拿到」勾，缺口由站点算', 'Tick what you can get; gaps are computed') + '</span></div>' +
      '<p class="pl-disclaim">' + L('下面六项是调研标尺，不是打分：只用来辅助你梳理客观条件、横向对比多个候选，不给出项目价值评级，也不替代立项评审。旁边的参考刻度是「越容易起步数值越高」，用来排序，不代表好坏。',
        'These six are survey gauges, not scores: they help you lay out objective conditions side by side, not rate project value or replace review. A higher gauge means easier to start, not better.') + '</p>' +
      '<div class="pl-cats">' + chips + '</div>' +
      '<p class="pl-cat-note">' + (S.have.length
        ? L('已勾选 ' + S.have.length + ' 类：' + S.have.map(catName).join(' / '),
          'Selected ' + S.have.length + ': ' + S.have.map(catName).join(' / '))
        : L('还没勾选。不勾也能看参考刻度，但「数据可得性」会按全部缺口计算。',
          'Nothing ticked yet. The gauge still works, but availability assumes every gap.')) + '</p>' +
      '<div class="pl-presets">' + presets + '</div>' +
      '<div class="pl-tw"><table class="pl-tb"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      legend + '</div>';
  }

  function step3HTML() {
    var rows = rowsOf();
    if (!rows.length) return step1HTML();
    var en = document.documentElement.getAttribute('lang') === 'en';

    var list = rows.map(function (r) {
      return '<div class="pl-route-row"><div class="h"><b>' + esc(r.sc.name) + '</b>' +
        r.routes.map(function (k) {
          var o = routeByKey(k);
          return o ? '<span class="pl-chip">' + L(o.n[0], o.n[1]) + '</span>' : '';
        }).join('') +
        '<span class="st">' + esc(r.sc.stageName) + ' · ' + esc(mNames(r.sc)) + '</span></div>' +
        '<p class="why">' + esc(routeWhy(r.sc, r.routes)) + '</p></div>';
    }).join('');

    var suggest = {};
    rows.forEach(function (r) { r.routes.forEach(function (k) { suggest[k] = (suggest[k] || 0) + 1; }); });

    function cmpRows(grp) {
      return ROUTES.filter(function (o) { return ROUTE_GRP[o.k] === grp; }).map(function (o) {
        var hl = suggest[o.k] ? ' hl' : '';
        return '<tr><td class="sc-nm' + hl + '">' + L(o.n[0], o.n[1]) +
          (suggest[o.k] ? ' <span class="pl-chip">' + suggest[o.k] + '</span>' : '') + '</td>' +
          '<td>' + L(o.d[0], o.d[1]) + '</td><td>' + L(o.lab[0], o.lab[1]) + '</td>' +
          '<td>' + L(o.exp[0], o.exp[1]) + '</td><td>' + L(o.imp[0], o.imp[1]) + '</td>' +
          '<td>' + L(o.mnt[0], o.mnt[1]) + '</td><td>' + L(o.fail[0], o.fail[1]) + '</td></tr>';
      }).join('');
    }

    var cols = ROUTE_DIM_HEAD.length + 1;
    var cmp = '<div class="pl-tw"><table class="pl-tb pl-cmp"><thead><tr><th>' +
      L('路线', 'Route') + '</th>' +
      ROUTE_DIM_HEAD.map(function (h) { return '<th>' + L(h[0], h[1]) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      '<tr class="pl-grp"><td colspan="' + cols + '">' + L('五类 AI 方法', 'Five AI method families') + '</td></tr>' +
      cmpRows('ai') +
      '<tr class="pl-grp"><td colspan="' + cols + '">' +
      L('工程落地路线（不是 AI 方法类别，用于先把流程跑通、积累数据）',
        'Delivery routes (not AI method families — used to run the process and gather data first)') +
      '</td></tr>' +
      cmpRows('eng') + '</tbody></table></div>';

    return '<div class="pl-sec"><div class="pl-sec-h"><h3>' + L('③ 定路线：每个场景建议怎么切入', '③ Approach: how to enter each scene') +
      '</h3><span class="sub">' + L('依据方法标签与数据口径推荐，不是唯一答案',
        'Recommended from method tags and data categories, not the only answer') + '</span></div>' +
      list + '<div class="pl-sec-h" style="margin-top:18px"><h3>' +
      L('六条路线横向对比', 'Route comparison') + '</h3><span class="sub">' +
      L('高亮行是当前候选中被推荐到的', 'Highlighted rows are recommended for your candidates') + '</span></div>' +
      cmp + '</div>';
  }

  function step4HTML() {
    var rows = rowsOf();
    if (!rows.length) return step1HTML();
    var en = document.documentElement.getAttribute('lang') === 'en';

    var risky = rows.filter(function (r) { return isRisk(r.sc); });
    var riskHTML = risky.length
      ? risky.map(function (r) {
        return '<div class="pl-risk"><b>' + esc(r.sc.name) + '</b> — ' +
          L('强监管场景：模型输出只能作为工程师判断的参考，不可直接下发作业指令；立项时需写明人工复核环节。',
            'Regulated scene: model output is advisory for the engineer, never an instruction to execute — human review must be written into the plan.') +
          '</div>';
      }).join('')
      : '<div class="pl-risk pl-risk-ok"><b>' + L('当前候选没有强监管场景', 'No regulated scenes among candidates') +
        '</b> — ' + L('仍建议在方案中写明数据口径与人工复核节点。',
          'Still state the data conventions and human-review checkpoints in the plan.') + '</div>';

    var md = reportMD(rows, S.preset);

    return '<div class="pl-sec"><div class="pl-sec-h"><h3>' + L('④ 风险与边界', '④ Risk & boundaries') +
      '</h3><span class="sub">' + L('本站点是参考工具，不替代任何作业系统',
        'A reference tool, not a substitute for any operational system') + '</span></div>' +
      riskHTML +
      '<div class="pl-sec-h" style="margin-top:18px"><h3>' + L('立项评估报告', 'Assessment report') + '</h3>' +
      '<span class="sub">' + L('可直接导出为 MD 或打印', 'Export as Markdown or print') + '</span></div>' +
      '<pre class="pl-rep">' + esc(md) + '</pre>' +
      '<div class="pl-acts">' +
      '<button type="button" class="btn sm primary" data-pl-exp>' + L('导出报告（MD）', 'Export report (MD)') + '</button>' +
      '<button type="button" class="btn sm ghost" data-pl-print>' + L('打印 / 存为 PDF', 'Print / PDF') + '</button>' +
      '<button type="button" class="btn sm ghost" data-pl-link>' + L('复制本页链接', 'Copy page link') + '</button>' +
      '</div></div>';
  }

  function html(q) {
    init();
    if (!A || !SM) {
      return '<main class="wrap"><div class="empty" style="padding:120px 0"><b>' +
        L('数据层未加载', 'Data layer not loaded') + '</b>' +
        L('请确认 assets/data.js 与 assets/stage-meta.js 已引入。',
          'Check that assets/data.js and assets/stage-meta.js are included.') + '</div></main>';
    }
    qq = q || {};
    if (qq.ids) {
      var arr = String(qq.ids).split(',').filter(Boolean);
      arr.forEach(function (id) { if (S.ids.indexOf(id) < 0 && A.index.byScene[id]) S.ids.push(id); });
      save();
    }
    var step = Math.min(4, Math.max(1, parseInt(qq.s, 10) || 1));
    curStep = step;

    var body = bodyHTML(step);

    return '<main class="wrap plan-wrap">' +
      '<nav class="crumb"><a href="#/">' + L('总览', 'Overview') + '</a><span class="sep">/</span>' +
      '<span>' + L('立项参考', 'Assessment') + '</span></nav>' +
      '<h1>' + L('立项参考', 'Assessment') +
      '<span class="en">' + L('候选 → 调研标尺 → 路线 → 报告', 'Candidates → gauges → routes → report') + '</span></h1>' +
      '<p class="blurb">' + L('从一个场景出发，走完「能不能做 → 用什么做 → 有什么风险」，最后带着一份评估报告离开。所有指标由场景元数据实时算出，权重可切换。',
        'Start from a scene and walk through "can we do it → how → what could go wrong", then leave with an assessment. Every metric is computed live from scene metadata; weights are switchable.') + '</p>' +
      '<p class="pl-disclaim">' + L('本页只做可行性参考排序，不替代立项评审：排序依据是数据条件与公开可见度，不是对这个方向价值的等级评定。',
        'This page ranks feasibility for reference only and does not replace review: it reflects data conditions and public visibility, not a verdict on the direction.') + '</p>' +
      stepsHTML(step) +
      '<div class="pl-grid">' + poolHTML() + '<section class="pl-main">' + body + '</section></div>' +
      '</main>';
  }

  var qq = {};
  var curStep = 1;     /* 当前步骤：局部重绘时用它重画主区 */
  var boundView = null; /* 已经挂过监听的容器，避免重复叠加 */
  var pending = 0;      /* 待执行的重绘帧 */

  function go(step) {
    location.hash = '#/plan?ids=' + S.ids.join(',') + '&s=' + step;
  }

  function bodyHTML(step) {
    return step === 1 ? step1HTML() : step === 2 ? step2HTML() : step === 3 ? step3HTML() : step4HTML();
  }

  /* 只重画「候选池列表 + 右侧主区」，不整页重建。
     之前每次改动都走整页重渲染，带来三个问题：
       1. <select> 被重建后跳回第一个可选项，于是一次「加入」会连锁加入好几个场景；
       2. shell 每次重渲染都往同一个容器上再挂一个点击监听，
          监听器数量随点击次数翻倍，连点时指数级卡顿；
       3. 刷新后 URL 里过期的 ids 又会被合并回候选池。 */
  function paint() {
    var main = document.querySelector('.pl-main');
    if (!main) return; /* 已经离开本页，没必要再画 */

    var head = document.querySelector('.pl-pool h3');
    if (head) head.textContent = poolHeadHTML();

    var list = document.querySelector('.pl-pool-list');
    if (list) list.innerHTML = poolListHTML();

    main.innerHTML = bodyHTML(curStep);
    syncSelect();
    syncHash();
  }

  /* 同一帧里的多次操作合并成一次重绘，连点删除不会排队重画 */
  function schedule() {
    if (pending) return;
    var raf = g.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); };
    pending = raf(function () { pending = 0; paint(); });
  }

  /* 下拉框不再重建，只更新禁用态与勾号，并把选中项挪到下一个还没加入的场景 */
  function syncSelect() {
    var sel = document.getElementById('pl-sel');
    if (!sel) return;
    [].forEach.call(sel.options, function (o) {
      var on = S.ids.indexOf(o.value) >= 0;
      o.disabled = on;
      var nm = o.getAttribute('data-nm');
      if (nm == null) { nm = o.textContent.replace(/ ✓$/, ''); o.setAttribute('data-nm', nm); }
      o.textContent = nm + (on ? ' ✓' : '');
    });
    var cur = sel.options[sel.selectedIndex];
    if (cur && cur.disabled) {
      for (var i = 0; i < sel.options.length; i++) {
        if (!sel.options[i].disabled) { sel.selectedIndex = i; break; }
      }
    }
  }

  /* 让地址栏与内存状态一致：刷新页面不会把已删除的候选再合并回来 */
  function syncHash() {
    try {
      history.replaceState(null, '', '#/plan?ids=' + S.ids.join(',') + '&s=' + curStep);
    } catch (e) { }
  }

  function bind(view) {
    init();
    /* 同一个容器只挂一次监听。之前每次重渲染都再挂一个，
       监听器数量随点击次数翻倍，连点几次就会明显卡顿。 */
    if (boundView === view) return;
    boundView = view;

    view.addEventListener('click', function (e) {
      var t = e.target;

      var st = t.closest('[data-pl-step]');
      if (st) { go(st.getAttribute('data-pl-step')); return; }

      var add = t.closest('[data-pl-add]');
      if (add) {
        var sel = document.getElementById('pl-sel');
        var op = sel && sel.options[sel.selectedIndex];
        var id = sel && sel.value;
        /* op.disabled 兜底：已经加入过的场景不会被重复加入 */
        if (id && op && !op.disabled && S.ids.indexOf(id) < 0) { S.ids.push(id); save(); schedule(); }
        return;
      }

      var rm = t.closest('[data-pl-rm]');
      if (rm) {
        var rid = rm.getAttribute('data-pl-rm');
        S.ids = S.ids.filter(function (x) { return x !== rid; });
        save();
        /* 先摘掉这一条，连点删除时立刻有反馈，不等下一帧重绘 */
        var box = rm.closest('.pl-pool-item');
        if (box && box.parentNode) box.parentNode.removeChild(box);
        schedule();
        return;
      }

      var cat = t.closest('[data-pl-cat]');
      if (cat) {
        var k = cat.getAttribute('data-pl-cat');
        var i = S.have.indexOf(k);
        if (i >= 0) S.have.splice(i, 1); else S.have.push(k);
        save(); schedule();
        return;
      }

      var p = t.closest('[data-pl-preset]');
      if (p) { S.preset = p.getAttribute('data-pl-preset'); save(); schedule(); return; }

      var exp = t.closest('[data-pl-exp]');
      if (exp) {
        var rows = rowsOf();
        var md = reportMD(rows, S.preset);
        var en = document.documentElement.getAttribute('lang') === 'en';
        var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (en ? 'project-assessment-' : '立项评估报告-') + new Date().toISOString().slice(0, 10) + '.md';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        return;
      }

      var pr = t.closest('[data-pl-print]');
      if (pr) { setTimeout(function () { window.print(); }, 60); return; }

      var lk = t.closest('[data-pl-link]');
      if (lk) {
        var url = location.href;
        var done = function () {
          var old = lk.textContent;
          lk.textContent = L('已复制', 'Copied');
          setTimeout(function () { lk.textContent = old; }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, done);
        } else { done(); }
        return;
      }
    });
  }

  g.PlanPage = { html: html, bind: bind };
})(window);
