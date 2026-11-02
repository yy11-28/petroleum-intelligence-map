/* =========================================================
   sw.js —— Service Worker：安装期预缓存 + 网络优先回退
   ---------------------------------------------------------
   · PRECACHE 清单由 node _build-plugins.js 自动维护（标记之间），
     新增案例重跑构建即可同步；
   · 策略：同源 GET 网络优先（开发永远拿最新），成功写入缓存，
     断网时回退缓存版本——离线演示可用。
   ========================================================= */
const CACHE = 'petro-ai-atlas-v81';

/* ===== PRECACHE-BEGIN（_build-plugins.js 自动维护，勿手改）===== */
const PRECACHE = [
  './',
  'manifest.webmanifest',
  'assets/icon.svg',
  'assets/core/tokens.css?v=20261102d',
  'assets/core/layout.css?v=20261102d',
  'assets/core/ui.css?v=20261102d',
  'assets/core/polish.css?v=20261102d',
  'assets/core/vizkit.css?v=20261102d',
  'assets/completion.css?v=20261102d',
  'assets/map.css?v=20261102d',
  'assets/find.css?v=20261102d',
  'assets/data.css?v=20261102d',
  'assets/plan.css?v=20261102d',
  'assets/home.css?v=20261102d',
  'assets/data.js?v=20261102d',
  'assets/completion-meta.js?v=20261102d',
  'assets/core/registry.js?v=20261102d',
  'assets/core/kit.js?v=20261102d',
  'assets/core/vizkit.js?v=20261102d',
  'assets/art.js?v=20261102d',
  'assets/art3d.js?v=20261102d',
  'assets/art3d-b.js?v=20261102d',
  'assets/art3d-c.js?v=20261102d',
  'assets/cases/welllog-layer.case.js?v=20261102d',
  'assets/cases/welllog-layer.demo.js?v=20261102d',
  'assets/cases/你的案例.case.js',
  'assets/cases/annulus-pressure-anomaly.case.js?v=20261102d',
  'assets/cases/candidate-well-ranking.case.js?v=20261102d',
  'assets/cases/casing-integrity-kg.case.js?v=20261102d',
  'assets/cases/casing-program-opt.case.js?v=20261102d',
  'assets/cases/casing-remaining-strength.case.js?v=20261102d',
  'assets/cases/cement-sheath-coupling.case.js?v=20261102d',
  'assets/cases/cementing-param-opt.case.js?v=20261102d',
  'assets/cases/cementing-quality-eval.case.js?v=20261102d',
  'assets/cases/completion-fluid-design.case.js?v=20261102d',
  'assets/cases/completion-lcc-opt.case.js?v=20261102d',
  'assets/cases/completion-mode-reco.case.js?v=20261102d',
  'assets/cases/completion-risk-warn.case.js?v=20261102d',
  'assets/cases/completion-run-analysis.case.js?v=20261102d',
  'assets/cases/completion-startup-opt.case.js?v=20261102d',
  'assets/cases/completion-string-force.case.js?v=20261102d',
  'assets/cases/corrosion-scale-protect.case.js?v=20261102d',
  'assets/cases/downhole-monitor-config.case.js?v=20261102d',
  'assets/cases/downhole-tool-fault.case.js?v=20261102d',
  'assets/cases/downhole-toolstring-design.case.js?v=20261102d',
  'assets/cases/firstbreak-stalta.case.js?v=20261102d',
  'assets/cases/formation-damage-mitigation.case.js?v=20261102d',
  'assets/cases/frac-design-opt.case.js?v=20261102d',
  'assets/cases/hpht-gas-risk.case.js?v=20261102d',
  'assets/cases/icv-zone-partition.case.js?v=20261102d',
  'assets/cases/lift-method-opt.case.js?v=20261102d',
  'assets/cases/old-well-recompletion.case.js?v=20261102d',
  'assets/cases/packer-isolation-design.case.js?v=20261102d',
  'assets/cases/perforation-param-opt.case.js?v=20261102d',
  'assets/cases/post-completion-review.case.js?v=20261102d',
  'assets/cases/pressure-buildup-analysis.case.js?v=20261102d',
  'assets/cases/sand-control-select.case.js?v=20261102d',
  'assets/cases/sand-control-skin.case.js?v=20261102d',
  'assets/cases/sleeve-control-rl.case.js?v=20261102d',
  'assets/cases/slurry-system-reco.case.js?v=20261102d',
  'assets/cases/thermal-string-stress.case.js?v=20261102d',
  'assets/cases/well-abandon-design.case.js?v=20261102d',
  'assets/cases/wellgroup-completion-opt.case.js?v=20261102d',
  'assets/cases/welltest-data-clean.case.js?v=20261102d',
  'assets/core/case-demo-host.js?v=20261102d',
  'assets/core/case-upload.js?v=20261102d',
  'assets/core/admin.js?v=20261102d',
  'assets/core/i18n.en.js?v=20261102d',
  'assets/cases/i18n.cases.en.js?v=20261102d',
  'assets/datapage.js?v=20261102d',
  'assets/work.js?v=20261102d',
  'assets/plan.js?v=20261102d',
  'assets/stage-meta.js?v=20261102d',
  'assets/core/shell.js?v=20261102d',
  'assets/core/learn.js?v=20261102d',
  'assets/completion.js?v=20261102d',
  'assets/stage.js?v=20261102d',
  'assets/map.js?v=20261102d',
  'assets/find.js?v=20261102d'
];
/* ===== PRECACHE-END ===== */

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* 逐项缓存：单项失败只跳过该项（警告），不阻断安装 */
      return Promise.all(PRECACHE.map(function (u) {
        return fetch(u).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return c.put(u, r);
        }).catch(function (err) {
          console.warn('[sw] 预缓存跳过：', u, err.message);
        });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(function () {
    return caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); });
  });
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 跨域（字体等）不拦截 */

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        /* 导航请求兜底：回缓存首页（hash 路由在首页内恢复） */
        if (req.mode === 'navigate') return caches.match('./');
        return new Response('离线且无缓存：' + url.pathname, { status: 503, statusText: 'offline' });
      });
    })
  );
});
