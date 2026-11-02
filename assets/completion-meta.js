/* =========================================================
   completion-meta.js —— 完井模块专用元数据（选填叠加层）
   ---------------------------------------------------------
   不改动 data.js 的场景结构，加载后为 co1–co20 叠加：
     deps     数据依赖（上游完井场景 id，只画完井内部）
     risk     { eng 工程约束, ai 算法落地风险 }
     badges   列表徽标（安全敏感 / 不可自动决策）
     maturity 公开案例丰富度分层：key 依次为 仿真 / 小试 / 试用 / 常态，
     显示名为 案例极少 / 案例较少 / 案例若干 / 案例较多（key 保留以兼容场景字段与 URL）
     innov    创新度：高（公开案例极少）/ 中 / 成熟
   模块级：matrix 数据互通矩阵 · comparePresets 对比预设组 ·
   sandbox 井型参数预设（值数组与示范页滑杆 DOM 顺序一致，且已对齐 step）
   papers 参考方向归集（选填，有则填）
   仅完井环节使用；其他环节不受影响。
   ========================================================= */
(function (g) {
  'use strict';

  var M = {
    co1: {
      deps: [], maturity: '小试', badges: ['不可自动决策'], innov: '中',
      risk: { eng: '完井方式下入后难以低成本更改，须符合完井设计规范与出砂管理要求', ai: '推荐结果为候选排序与证据清单，最终方式由工程师结合地应力与经济性裁定' }
    },
    co2: {
      deps: ['co1'], maturity: '小试', badges: ['安全敏感'], innov: '成熟',
      risk: { eng: '孔密与穿深受套管强度、枪身级别与安全余量限制', ai: '代理模型预测须经试井验证后方可写入设计文件' }
    },
    co3: {
      deps: ['co1'], maturity: '小试', badges: ['安全敏感', '不可自动决策'], innov: '成熟',
      risk: { eng: '承压与屈曲校核须按行业标准执行，模型不可替代工程校核', ai: '安全系数结论仅作筛查参考，正式设计以专业软件为准' }
    },
    co4: {
      deps: ['co1', 'co6'], maturity: '仿真', badges: ['不可自动决策'], innov: '高',
      risk: { eng: '滑套动作直接改变分层生产制度，须符合采油生产制度管理规定', ai: '强化学习策略须叠加物理约束层，最终开关指令由现场确认' }
    },
    co5: {
      deps: [], maturity: '仿真', badges: [], innov: '中',
      risk: { eng: '完井液与储层配伍性须通过实验评价，禁用未经试验区段的结论', ai: '配方推荐须以岩心实验恢复率验证为准' }
    },
    co6: {
      deps: ['co1', 'co3', 'co11'], maturity: '小试', badges: ['安全敏感'], innov: '高',
      risk: { eng: '封隔器承压须满足管柱强度与套管完好的双重校核', ai: '坐封位置与型号最终由完井设计师确认' }
    },
    co7: {
      deps: ['co3', 'co6'], maturity: '仿真', badges: ['安全敏感', '不可自动决策'], innov: '中',
      risk: { eng: '压裂施工压力受套管抗内压与地面设备限压约束', ai: '缝长预测存在多解，方案须经压裂软件与现场工程师复核' }
    },
    co8: {
      deps: ['co1'], maturity: '常态', badges: [], innov: '成熟',
      risk: { eng: '举升方式更换成本高，须符合采油工程与地面流程限制', ai: '选型结论对气液比口径敏感，须以实测数据复核' }
    },
    co9: {
      deps: ['co1', 'co2'], maturity: '小试', badges: ['安全敏感'], innov: '中',
      risk: { eng: '防砂工具一旦下入难以更换，须满足出砂管理规范', ai: '出砂预测存在长期不确定性，须定期以含砂计量校准' }
    },
    co10: {
      deps: ['co5'], maturity: '试用', badges: [], innov: '成熟',
      risk: { eng: '缓蚀剂加注须符合环保与药剂兼容要求', ai: '腐蚀速率预测依赖介质数据准确性，须挂片实测校验' }
    },
    co11: {
      deps: [], maturity: '小试', badges: [], innov: '成熟',
      risk: { eng: '候凝期测井结论受水泥浆凝期影响，须按时间窗复测', ai: '缺陷分级须由有资质的解释人员签认' }
    },
    co12: {
      deps: ['co2', 'co6', 'co7'], maturity: '仿真', badges: ['安全敏感', '不可自动决策'], innov: '高',
      risk: { eng: '异常预警须符合作业许可与 STOP 管理流程', ai: '预警不能替代司钻与监督的现场判断' }
    },
    co13: {
      deps: ['co4', 'co6', 'co19'], maturity: '小试', badges: [], innov: '高',
      risk: { eng: '仪器耐温耐压须满足井下工况，采购须符合设备兼容规范', ai: '布点方案为建议，最终配置由完井设计师裁定' }
    },
    co14: {
      deps: ['co4', 'co8', 'co9'], maturity: '仿真', badges: ['安全敏感', '不可自动决策'], innov: '高',
      risk: { eng: '投产压差受出砂临界与套管强度红线约束', ai: '优化制度须经现场确认后执行，禁止直接下发指令' }
    },
    co15: {
      deps: ['co2'], maturity: '小试', badges: [], innov: '中',
      risk: { eng: '归因结论依赖资料口径统一，不能作为责任判定依据', ai: '反演存在多解，结论须经工程师确认后使用' }
    },
    co16: {
      deps: ['co11', 'co19'], maturity: '仿真', badges: ['不可自动决策'], innov: '高',
      risk: { eng: '侧钻与重完井须符合老井利用与弃置管理规定', ai: '成功率来自历史先验，不构成投资承诺' }
    },
    co17: {
      deps: ['co1'], maturity: '仿真', badges: [], innov: '高',
      risk: { eng: '井组协同须符合配注与矿权分摊约定', ai: '协同方案为建议，井间责任分摊由开发部门裁定' }
    },
    co18: {
      deps: ['co1', 'co2', 'co5'], maturity: '常态', badges: [], innov: '中',
      risk: { eng: '成本口径须与公司经济评价规范一致', ai: '测算结果依赖油价与折现假设，须附敏感性说明' }
    },
    co19: {
      deps: ['co3', 'co10'], maturity: '仿真', badges: ['安全敏感', '不可自动决策'], innov: '中',
      risk: { eng: '套管完整性评价涉及承压安全红线，须按规范出具报告', ai: '失效模式判断须由有资质人员复核后方可处置' }
    },
    co20: {
      deps: ['co6', 'co11', 'co19'], maturity: '小试', badges: ['安全敏感', '不可自动决策'], innov: '高',
      risk: { eng: '报废屏障须满足环保与井筒屏障规范，永久承担隔离责任', ai: '屏障设计须通过验收试压，模型结论仅作设计辅助' }
    }
  };

  /* 创新度口径：公开报道/可检索案例的多寡，用于找新题时的粗筛 */
  M.innovNote = '按公开报道与可检索案例的多寡粗分数据档：高 = 公开案例极少、适合找新题；成熟 = 已有大量公开工作，适合复现类题目。';

  /* 公开案例丰富度四档（仅完井模块内部使用，区别于全站低/中/高难度） */
  M.maturityNote = '公开案例丰富度四档：案例极少 = 只有论文与仿真算例，无现场试验；案例较少 = 单井试点报道；案例若干 = 多井组规模化试用；案例较多 = 公开实践已常见。这是按公开可见信息多少做的分层，不等于该技术在现场的工程成熟水平。';

  /* 数据互通矩阵：2 = 需要 · 1 = 可选 · 0 = 不需要 */
  M.matrix = {
    types: [
      { k: 'D1', name: '井身结构与套管程序' },
      { k: 'D2', name: '固井质量与水泥环' },
      { k: 'D3', name: '岩石力学与出砂指数' },
      { k: 'D4', name: '地层压力与流体参数' },
      { k: 'D5', name: '射孔参数与孔眼数据' },
      { k: 'D6', name: '完井液与工作液体系' },
      { k: 'D7', name: '生产动态时序' },
      { k: 'D8', name: '井筒监测与检测数据' },
      { k: 'D9', name: '经济参数（油价 / 预算）' },
      { k: 'D10', name: '作业工序与历史井次' }
    ],
    cells: {
      D1:  { co3: 2, co6: 2, co12: 1, co13: 2, co16: 2, co19: 2, co20: 2 },
      D2:  { co6: 2, co11: 2, co16: 1, co19: 2, co20: 2 },
      D3:  { co1: 2, co2: 2, co7: 1, co9: 2, co14: 2 },
      D4:  { co1: 2, co5: 2, co8: 1, co10: 2, co14: 1, co15: 1, co17: 2 },
      D5:  { co2: 2, co9: 1, co15: 2 },
      D6:  { co5: 2, co10: 2 },
      D7:  { co8: 1, co14: 2, co15: 2, co17: 1 },
      D8:  { co13: 2, co19: 2 },
      D9:  { co16: 2, co18: 2 },
      D10: { co12: 2, co11: 1 }
    }
  };

  /* 对比预设组（一键载入到最多 3 个的对比浮层） */
  M.comparePresets = [
    { name: '输入—输出链', desc: '完井方式优选 → 管柱受力分析：上游方式的输出就是下游校核的输入', ids: ['co1', 'co3'] },
    { name: '生产管控类', desc: '投产制度优化 → 生产动态反演：都吃生产动态时序，适合复用一套数据集', ids: ['co14', 'co15'] },
    { name: '防砂与射孔', desc: '出砂预测 → 射孔参数设计：共用岩石力学与孔眼数据', ids: ['co9', 'co2'] },
    { name: '完整性与屏障', desc: '套管完整性 → 报废封隔：共用井筒检测与固井质量数据', ids: ['co19', 'co20'] },
    { name: '案例极少档新题', desc: '公开案例丰富度处于「案例极少」档的四个场景：创新度高、公开案例少', ids: ['co4', 'co14', 'co16', 'co17'] }
  ];

  /* 沙箱参数预设：三种典型井工况
     值数组与各示范页滑杆的 DOM 顺序一一对应，且已按 min/step 对齐（由 _tmp-cofix.js 校验） */
  M.sandboxLabels = {
    normal: { t: '直井常规完井', d: '常规直井、单一储层、无特殊工艺约束的基准工况' },
    hp: { t: '水平井分段压裂完井', d: '长水平段、多簇压裂，施工压力与投产压差都更高的工况' },
    sand: { t: '定向井防砂完井', d: '弱胶结 / 易出砂储层，出砂风险高、提液受限的工况' }
  };
  M.sandbox = {
    co1:   { normal: [0.3, 12, 45, 12, 8],                hp: [0.15, 20, 60, 25, 10],        sand: [0.75, 6, 80, 9, 12] },
    co2:   { normal: [16, 2, 420, 45, 0.5],               hp: [24, 3, 600, 40, 0.6],         sand: [20, 1, 350, 25, 0.75] },
    co3:   { normal: [20, 55, 3200, 1350],                hp: [28, 70, 4500, 1400],          sand: [15, 40, 2600, 1300] },
    co4:   { normal: [0.7, 600],                          hp: [1.1, 900],                    sand: [1, 700] },
    co5:   { normal: [14, 120, 12, 1.5, 0.8, 2.8],        hp: [10, 140, 16, 2.5, 1.2, 3.5],  sand: [20, 100, 8, 1, 0.5, 2.2] },
    co6:   { normal: [10, 120, 82, 3.5],                  hp: [14, 145, 88, 4.2],            sand: [8, 105, 70, 3] },
    co7:   { normal: [12, 14, 60, 50, 700],               hp: [18, 18, 110, 56, 960],        sand: [8, 10, 45, 40, 560] },
    co8:   { normal: [150, 84, 240, 1750, 0.6, 95],       hp: [260, 70, 180, 2400, 0.3, 110], sand: [120, 90, 300, 1400, 2.5, 85] },
    co9:   { normal: [8, 18, 6, 8, 16, 6],                hp: [12, 15, 9, 12, 24, 8],        sand: [5, 25, 10, 18, 12, 8] },
    co10:  { normal: [0.3, 50, 40000, 95, 22, 150],       hp: [0.8, 120, 60000, 120, 30, 260], sand: [0.16, 30, 90000, 80, 15, 100] },
    co11:  { normal: [1.4, 28, 70, 12, 80],               hp: [2.2, 46, 86, 20, 160],        sand: [1, 18, 56, 8, 50] },
    co12:  { normal: [0.06, 4, 0.36, 0.55],               hp: [0.09, 7, 0.56, 0.55],         sand: [0.05, 3, 0.3, 0.55] },
    co13:  { normal: [118, 660, 5, 0.46],                 hp: [150, 1400, 8, 0.4],           sand: [100, 400, 4, 0.6] },
    co14:  { normal: [0.5, 0.3, 0.46, 6.4],               hp: [0.4, 0.26, 0.5, 7.6],         sand: [0.8, 0.4, 0.3, 5.6] },
    co15:  { normal: [4, 0.82, 0.2, 0.22, 18],            hp: [6, 0.9, 0.3, 0.36, 24],       sand: [8, 0.7, 0.46, 0.5, 12] },
    co16:  { normal: [0.7, 0.45, 0.4, 420, 260],          hp: [0.8, 0.55, 0.3, 480, 320],    sand: [0.5, 0.35, 0.56, 380, 300] },
    co17:  { normal: [7, 0.46, 0.36, 0.56, 5],            hp: [8, 0.56, 0.46, 0.6, 6],       sand: [6, 0.6, 0.26, 0.5, 4] },
    co18:  { normal: [65, 5, 20, 0.46, 8],                hp: [80, 6, 22, 0.36, 8],          sand: [60, 5, 25, 0.76, 8] },
    co19:  { normal: [9, 0.5, 0.4, 0.7],                  hp: [15, 0.7, 0.26, 0.5],          sand: [12, 0.4, 0.8, 0.6] },
    co20:  { normal: [1.36, 0.6, 1],                      hp: [1.5, 0.7, 2],                 sand: [1.3, 0.36, 2] }
  };

  /* 参考方向归集（选填：有就填，url 留空则只显示文字） */
  M.papers = {
    co1:  [{ t: 'OnePetro 文献库', d: '检索方向：completion selection / knowledge graph', url: 'https://onepetro.org/' },
           { t: '中文期刊综述', d: '《石油钻采工艺》《石油学报》"完井方式优选"相关综述' }],
    co3:  [{ t: 'OnePetro 文献库', d: '检索方向：tubing stress analysis / surrogate model', url: 'https://onepetro.org/' }],
    co4:  [{ t: 'SPE 智能完井专题', d: '检索方向：intelligent completion / sliding sleeve RL', url: 'https://www.spe.org/en/' },
           { t: '强化学习 + 油藏综述', d: '方向：约束型策略优化在分层开采中的适配与安全层设计' }],
    co7:  [{ t: 'SPE 水力压裂与增产', d: '检索方向：fracture design optimization / pad ratio', url: 'https://www.spe.org/en/' }],
    co9:  [{ t: 'OnePetro 文献库', d: '检索方向：sand production prediction / sand control selection', url: 'https://onepetro.org/' },
           { t: '出砂管理行业实践', d: '方向：出砂临界压差标定、含砂监测校核口径' }],
    co10: [{ t: 'NACE / AMPP 腐蚀与防护', d: '检索方向：CO₂/H₂S corrosion prediction, scale inhibition', url: 'https://www.ampp.org/' }],
    co11: [{ t: 'OnePetro 文献库', d: '检索方向：cement bond log interpretation / machine learning', url: 'https://onepetro.org/' }],
    co12: [{ t: '钻井与完井复杂情况报告公开素材', d: '方向：施工曲线异常窗口的时间戳标注实践' }],
    co14: [{ t: 'OnePetro 文献库', d: '检索方向：production optimization under sanding constraint', url: 'https://onepetro.org/' }],
    co19: [{ t: 'OnePetro 文献库', d: '检索方向：casing integrity / failure diagnostics', url: 'https://onepetro.org/' }],
    co20: [{ t: '井筒屏障与弃置规范', d: '方向：永久封隔屏障的验收试压与冗余等级设计要求' }]
  };

  /* ---------------- 叠加到场景对象 ---------------- */
  function patch() {
    var A = g.ATLAS;
    if (!A || !A.index || !A.index.byId) return false;
    var SKIP = { matrix: 1, comparePresets: 1, sandbox: 1, sandboxLabels: 1, papers: 1, innovNote: 1, maturityNote: 1 };
    Object.keys(M).forEach(function (k) {
      if (SKIP[k]) return;
      var sc = A.index.byId[k];
      if (!sc) return;
      var m = M[k];
      sc.deps = m.deps || [];
      sc.risk = m.risk || null;
      sc.badges = m.badges || [];
      sc.maturity = m.maturity || '仿真';
      sc.innov = m.innov || '中';
    });
    g.COMPLETION_META = M;
    /* 排序后的 20 个完井场景 id（byStage.completion 是环节对象本体） */
    M.sceneIds = ((A.index.byStage.completion || {}).scenes || []).map(function (s) { return s.id; });
    return true;
  }
  if (!patch()) {
    var t = setInterval(function () { if (patch()) clearInterval(t); }, 120);
    setTimeout(function () { clearInterval(t); }, 6000);
  }
})(window);
