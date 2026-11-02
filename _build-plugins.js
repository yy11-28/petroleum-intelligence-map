/* =========================================================
   _build-plugins.js —— 案例包 → 插件案例 构建脚本
   ---------------------------------------------------------
   用法：node _build-plugins.js
   扫描根目录下所有含 case.json 的案例包文件夹，把每一份
   构建成 assets/cases/<id>.case.js 插件（内容全内联，
   示范页以 srcdoc iframe 挂载，自带高度自适应回报），
   并把 <script> 行写入 index.html 的自动生成区。
   可重复运行：再次构建时覆盖生成的文件与脚本区。
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CASES_DIR = path.join(ROOT, 'assets', 'cases');
const INDEX = path.join(ROOT, 'index.html');
const BEGIN = '<!-- ===== 自动生成的插件案例（node _build-plugins.js）===== -->';
const END = '<!-- ===== 自动生成结束 ===== -->';

/* ---------- srcdoc 内的高度回报器 ---------- */
const REPORTER = '<script>(function(){function p(){try{var h=Math.max(document.body?document.body.scrollHeight:0,document.documentElement.scrollHeight);parent.postMessage({__caseDemoH:h},"*")}catch(e){}}if(window.ResizeObserver){try{new ResizeObserver(p).observe(document.documentElement)}catch(e){}}window.addEventListener("load",p);setTimeout(p,200);setTimeout(p,900);setTimeout(p,2200)})()</script>';

/* ---------- 站点统一排版规范（注入每个示范页，标题/正文分层、行距一致） ---------- */
const TYPO_CSS = '<style>\n' +
  '/* ===== 排版统一（站点构建注入）：标题 / 导语 / 说明 分层，行距字号全站一致 ===== */\n' +
  'body{font-size:13px;line-height:1.75}\n' +
  'h1{font-size:19px;line-height:1.45;margin:0 0 10px;padding-bottom:9px;border-bottom:1px solid var(--line)}\n' +
  'h2{font-size:15px;line-height:1.5;margin:24px 0 10px;padding-top:14px;border-top:1px solid var(--line)}\n' +
  'h3{font-size:13.5px;line-height:1.5;margin:18px 0 8px}\n' +
  'p{margin:9px 0;line-height:1.85}\n' +
  '.lead{font-size:13px;line-height:1.9;margin:0 0 16px}\n' +
  '.note{font-size:12.5px;line-height:1.85;margin:14px 0 0}\n' +
  '.note b{color:var(--ink)}\n' +
  'li{line-height:1.85;margin:4px 0}\n' +
  'td,th{line-height:1.65}\n' +
  'caption{line-height:1.7}\n' +
  'svg{margin-top:12px}\n' +
  'svg + svg{margin-top:-1px}\n' +
  '/* ===== 示范页分区板块（构建注入）：内容按职责分块，不再杂糅 =====\n' +
  '     每块都是实卡：白底 + 明显描边 + 浮起阴影；画布底色加深反衬 */\n' +
  'body{background:#e2dac6}\n' +
  '.blk{margin-top:24px}\n' +
  '.blk-card{background:#fff;border:1px solid #a89a7d;border-radius:10px;padding:13px 16px 9px;box-shadow:0 2px 4px rgba(80,70,50,.13),0 6px 18px rgba(80,70,50,.15)}\n' +
  '.blk-card>.ctl:last-child{margin-bottom:8px}\n' +
  '.blk-raw{background:#fff;border:1px solid #a89a7d;border-radius:10px;box-shadow:0 2px 4px rgba(80,70,50,.13),0 6px 18px rgba(80,70,50,.15);overflow:hidden;padding-top:6px}\n' +
  '.blk-raw>svg{margin-top:0;border:0;border-radius:0;background:transparent}\n' +
  '.blk-raw>svg:first-child{overflow:visible}\n' +
  '.blk-raw>svg rect:first-of-type{fill:#fff}\n' +
  '.blk-raw>svg+svg{border-top:1px solid #c4b89c}\n' +
  '.blk-raw .readouts,.blk-raw .tbl{margin-top:0;border:0;border-radius:0;box-shadow:none}\n' +
  '.blk-raw .tbl{border-top:1px solid var(--line)}\n' +
  '.blk-note{background:#f1ecdf;border:1px solid #a89a7d;border-radius:10px;padding:11px 16px;box-shadow:0 1px 3px rgba(80,70,50,.1)}\n' +
  '.blk-note .note{margin:0}\n' +
  '.blk-note .legend{margin:0}\n' +
  '</style>';

/* ---------- SVG 文字防叠（注入每个示范页，图表重画后自动重修） ----------
   示范拉宽后 SVG 内部按比例放大，原本贴在一起的文字会明显压边。
   这里在运行时检测同图内两两文字包围盒：上下叠的把下面这块下推、
   同行横叠的把右边一块右移，最后按需扩展 viewBox 高度，
   纯数字刻度（坐标轴刻度）不做移动，避免破坏对齐。 */
const SVG_FIXER = '<script>\n' +
  '(function(){\n' +
  '  var MIN_OY=3,MIN_OX=2,PAD=2,NUM=/^[0-9.,()%\\s\\/-]+\$/;\n' +
  '  function fixOne(svg){\n' +
  '    var vb=svg.viewBox&&svg.viewBox.baseVal; if(!vb||!vb.width||vb.width>4000) return;\n' +
  '    var texts=[].filter.call(svg.querySelectorAll("text"),function(t){\n' +
  '      return t.textContent.trim()&&!t.getAttribute("transform");\n' +
  '    });\n' +
  '    var moved=true,guard=0;\n' +
  '    while(moved&&guard++<40){\n' +
  '      moved=false;\n' +
  '      var bx=texts.map(function(t){ try{ return t.getBBox(); }catch(e){ return null; } });\n' +
  '      for(var i=0;i<texts.length;i++)for(var j=0;j<texts.length;j++){\n' +
  '        if(i===j) continue;\n' +
  '        var ra=bx[i],rb=bx[j];\n' +
  '        if(!ra||!rb) continue;\n' +
  '        var a=texts[i],b=texts[j];\n' +
  '        var ox=Math.min(ra.x+ra.width,rb.x+rb.width)-Math.max(ra.x,rb.x);\n' +
  '        var oy=Math.min(ra.y+ra.height,rb.y+rb.height)-Math.max(ra.y,rb.y);\n' +
  '        if(ox<MIN_OX||oy<MIN_OY) continue;\n' +
  '        if(NUM.test(a.textContent.trim())||NUM.test(b.textContent.trim())) continue;\n' +
  '        /* 只动 y：b 在 a 下方（或同排且靠右 / 完全叠放的备选标签）时下移错开 */\n' +
  '        var lower=rb.y-ra.y;\n' +
  '        var take=lower>0.5||(lower>-0.5&&rb.x>ra.x+0.5)||(Math.abs(lower)<=0.5&&Math.abs(rb.x-ra.x)<=0.5&&j>i);\n' +
  '        if(!take) continue;\n' +
  '        var dy=(ra.y+ra.height+PAD)-rb.y;\n' +
  '        if(dy>0.5){ b.setAttribute("y",((parseFloat(b.getAttribute("y"))||rb.y+rb.height)+dy).toFixed(1)); moved=true; }\n' +
  '      }\n' +
  '    }\n' +
  '    /* 下端是数字刻度、上端是说明标题时：把标题上移，刻度对齐不动 */\n' +
  '    var bx2=texts.map(function(t){ try{ return t.getBBox(); }catch(e){ return null; } });\n' +
  '    for(var p=0;p<texts.length;p++)for(var q=0;q<texts.length;q++){\n' +
  '      if(p===q) continue;\n' +
  '      var ta=texts[p],tb=texts[q],pa=bx2[p],pb=bx2[q];\n' +
  '      if(!pa||!pb) continue;\n' +
  '      if(!NUM.test(tb.textContent.trim())||NUM.test(ta.textContent.trim())) continue;\n' +
  '      var ox2=Math.min(pa.x+pa.width,pb.x+pb.width)-Math.max(pa.x,pb.x);\n' +
  '      var oy2=Math.min(pa.y+pa.height,pb.y+pb.height)-Math.max(pa.y,pb.y);\n' +
  '      if(ox2<MIN_OX||oy2<2) continue;\n' +
  '      if(pb.y-pa.y>2){ ta.setAttribute("y",((parseFloat(ta.getAttribute("y"))||pa.y+pa.height)-(oy2+1)).toFixed(1)); }\n' +
  '    }\n' +
  '    /* 只扩展高度（宽度永远不动，避免整图缩放），把被推出底边的内容装回来 */\n' +
  '    var maxB=0;\n' +
  '    [].forEach.call(svg.querySelectorAll("text,rect,line,circle,path,polyline,polygon"),function(el){\n' +
  '      try{var b2=el.getBBox(); maxB=Math.max(maxB,b2.y+b2.height);}catch(e){}\n' +
  '    });\n' +
  '    if(maxB>vb.height-1) svg.setAttribute("viewBox","0 0 "+vb.width+" "+Math.ceil(maxB+4));\n' +
  '  }\n' +
  '  function fixAll(){ [].forEach.call(document.querySelectorAll("svg"),fixOne); }\n' +
  '  function boot(){\n' +
  '    fixAll();\n' +
  '    if(window.MutationObserver){\n' +
  '      var mo=new MutationObserver(function(){clearTimeout(fixAll._t);fixAll._t=setTimeout(fixAll,80);});\n' +
  '      [].forEach.call(document.querySelectorAll("svg"),function(s){mo.observe(s,{childList:true,subtree:true});});\n' +
  '    }\n' +
  '  }\n' +
  '  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();\n' +
  '  window.addEventListener("load",function(){setTimeout(fixAll,120);});\n' +
  '})();\n' +
  '<\/script>';

/* ---------- 示范页自动分区（注入每个示范页） ----------
   示范 HTML 是平铺的：标题、滑杆、图、读数、表格、结论之间没有任何分隔，
   全部内容杂糅在一块底色上。这里在运行时按元素职责把 .panel 的直接子元素
   分组并包进板块：连续的滑杆(.ctl)→白卡、连续的图(svg)→图表块、
   读数/表格→输出块、说明/图例→浅底注释块；标题导语保持页头不包卡。 */
const PARTITION_JS = '<script>\n' +
  '(function(){\n' +
  '  function kind(el){\n' +
  '    var cl=el.classList;\n' +
  '    if(/^(H1|H2|H3)$/.test(el.tagName)||cl.contains("lead")) return "head";\n' +
  '    if(cl.contains("ctl")) return "ctl";\n' +
  '    if(el.tagName==="svg") return "viz";\n' +
  '    if(cl.contains("readouts")||cl.contains("tbl")||el.tagName==="TABLE") return "out";\n' +
  '    if(cl.contains("note")||cl.contains("legend")||cl.contains("btnrow")) return "note";\n' +
  '    return "other";\n' +
  '  }\n' +
  '  function partition(){\n' +
  '    var root=document.querySelector(".panel");\n' +
  '    if(!root||root.dataset.blkDone) return;\n' +
  '    root.dataset.blkDone="1";\n' +
  '    var kids=[].slice.call(root.children);\n' +
  '    var groups=[],cur=null;\n' +
  '    kids.forEach(function(el){\n' +
  '      var k=kind(el);\n' +
  '      var merge=(cur&&cur.k===k&&(k==="ctl"||k==="viz"||k==="note"));\n' +
  '      if(merge){cur.els.push(el);}else{groups.push(cur={k:k,els:[el]});}\n' +
  '    });\n' +
  '    groups.forEach(function(g){\n' +
  '      if(g.k==="ctl"||g.k==="viz"||g.k==="out"||g.k==="note"){\n' +
  '        var sec=document.createElement("section");\n' +
  '        sec.className="blk blk-"+(g.k==="ctl"?"card":(g.k==="note"?"note":"raw"));\n' +
  '        g.els[0].parentNode.insertBefore(sec,g.els[0]);\n' +
  '        g.els.forEach(function(el){sec.appendChild(el);});\n' +
  '      }\n' +
  '    });\n' +
  '  }\n' +
  '  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",partition); else partition();\n' +
  '})();\n' +
  '<\/script>';

/* JS 字符串字面量安全化：JSON 序列化后把 </ 转义为 <\/，
   防止内容里出现 </script> 提前终止 <script> 块 */
function jsStr(v) {
  return JSON.stringify(v).replace(/<\//g, '<\\/');
}

/* ---------- 把 demo/index.html 的相对引用内联 ---------- */
function inlineDemo(pkgDir) {
  const demoDir = path.join(pkgDir, 'demo');
  let html = fs.readFileSync(path.join(demoDir, 'index.html'), 'utf8');

  /* <link rel="stylesheet" href="xxx.css"> → <style> */
  html = html.replace(/<link[^>]*href="([^"]+\.css)"[^>]*>/g, (m, href) => {
    const f = path.join(demoDir, href);
    if (!/^(\w[\w.-]*)$/.test(href) || !fs.existsSync(f)) return m;
    return '<style>\n' + fs.readFileSync(f, 'utf8') + '\n</style>';
  });

  /* <script src="xxx.js"></script> → 内联，防 </script> 提前终止 */
  html = html.replace(/<script[^>]*src="([^"]+\.js)"[^>]*>\s*<\/script>/g, (m, src) => {
    const f = path.join(demoDir, src);
    if (!/^(\w[\w.-]*)$/.test(src) || !fs.existsSync(f)) return m;
    const code = fs.readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
    return '<script>\n' + code + '\n</script>';
  });

  /* 相对引用的图片等素材：转 dataURL（没有就保持原样） */
  html = html.replace(/(src|href)="([^"]+\.(png|jpe?g|gif|webp|svg))"/g, (m, attr, href) => {
    const f = path.join(demoDir, href);
    if (!/^(\w[\w./-]*)$/.test(href) || href.startsWith('/') || !fs.existsSync(f)) return m;
    const ext = path.extname(href).slice(1).toLowerCase().replace('jpg', 'jpeg');
    const b64 = fs.readFileSync(f).toString('base64');
    return attr + '="data:image/' + ext + ';base64,' + b64 + '"';
  });

  /* 高度回报器 */
  html = html.replace(/<\/body>/i, REPORTER + '\n</body>');
  /* 示范拉宽适配：旧的 780px 定宽解除，占满示范区 */
  html = html.replace(/max-width\s*:\s*780px/g, 'width:100%');
  /* 站点统一排版规范 + SVG 文字防叠 */
  html = html.replace(/<\/head>/i, TYPO_CSS + '\n</head>');
  html = html.replace(/<\/body>/i, SVG_FIXER + '\n' + PARTITION_JS + '\n</body>');
  return html;
}

/* ---------- 单个案例包 → 插件源码 ---------- */
function buildPlugin(pkgDir) {
  const j = JSON.parse(fs.readFileSync(path.join(pkgDir, 'case.json'), 'utf8'));
  const demoCfg = (j.tabs && j.tabs.demo) || {};
  const hasDemoPage = fs.existsSync(path.join(pkgDir, 'demo', 'index.html'));

  let demoCode = '';
  if (hasDemoPage) {
    const H = Number(demoCfg.height) || 1100;
    demoCode = `
  /* ---- 可运行示范：构建时内联的整页示范，srcdoc 沙箱挂载 ---- */
  var DEMO_HTML = ${jsStr(inlineDemo(pkgDir))};
  function mountDemo(root) {
    var iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts allow-forms allow-pointer-lock");
    iframe.setAttribute("title", ${jsStr(demoCfg.label || '可运行示范')});
    iframe.style.cssText = "width:100%;border:0;display:block;background:#fbfaf6;border-radius:8px";
    iframe.style.height = ${H} + "px";
    iframe.srcdoc = DEMO_HTML;
    root.appendChild(iframe);
    var onMsg = function (e) {
      var d = e.data || {};
      if (d && d.__caseDemoH && typeof d.h === "number") {
        iframe.style.height = Math.max(320, d.h + 14) + "px";
      }
    };
    window.addEventListener("message", onMsg);
    return function () { window.removeEventListener("message", onMsg); };
  }
`;
  } else if (demoCfg.builtin) {
    demoCode = `
  /* ---- 可运行示范：复用内置示范 ${demoCfg.builtin} ---- */
  function mountDemo(root, ctx) {
    var src = ${jsStr(demoCfg.builtin)};
    var host = window.CaseDemoHost;
    if (host && typeof host.mountBuiltin === "function") return host.mountBuiltin(root, src, ctx);
    root.innerHTML = '<div class="empty"><b>内置示范不可用</b>未找到 ' + src + '</div>';
    return null;
  }
`;
  } else {
    demoCode = '\n  function mountDemo() { return null; }\n';
  }

  const head = '/* =========================================================\n' +
    '   自动生成的插件案例：' + j.id + '\n' +
    '   来源：/' + path.basename(pkgDir) + '/ （node _build-plugins.js 构建）\n' +
    '   手动修改会被下次构建覆盖；要长期维护请改案例包源文件。\n' +
    '   ========================================================= */\n' +
    '(function () {\n' +
    '  "use strict";\n';

  const body =
    demoCode + '\n' +
    '  Cases.register({\n' +
    '    id: ' + jsStr(j.id) + ',\n' +
    '    sceneId: ' + jsStr(j.sceneId) + ',\n' +
    '    methods: ' + jsStr(j.methods || []) + ',\n' +
    '    title: ' + jsStr(j.title) + ',\n' +
    '    version: ' + jsStr(j.version || '1.0.0') + ',\n' +
    '    updated: ' + jsStr(j.updated || '') + ',\n' +
    '    status: "ready",\n' +
    '    tabs: ' + jsStr(Object.assign({}, j.tabs, {
      demo: hasDemoPage || demoCfg.builtin ? {
        label: demoCfg.label || '可运行示范',
        height: Number(demoCfg.height) || 1100,
        intro: demoCfg.intro || '',
        mount: '__MOUNT__',
        unmount: '__UNMOUNT__'
      } : undefined
    })).replace(/"__MOUNT__"/g, 'mountDemo').replace(/"__UNMOUNT__"/g, 'function () { if (offDemo) { offDemo(); offDemo = null; } }') + ',\n' +
    '    imported: false\n' +
    '  });\n' +
    '  var offDemo = null;\n' +
    '  /* 包一层：shell 调用 tabs.demo.mount(root, ctx) */\n' +
    '  var reg = Cases.get(' + jsStr(j.id) + ');\n' +
    '  if (reg && reg.tabs && reg.tabs.demo) {\n' +
    '    var rawMount = reg.tabs.demo.mount;\n' +
    '    reg.tabs.demo.mount = function (root, ctx) {\n' +
    '      if (offDemo) { offDemo(); offDemo = null; }\n' +
    '      offDemo = rawMount(root, ctx) || null;\n' +
    '    };\n' +
    '  }\n' +
    '})();\n';

  return head + body;
}

/* ---------- 主流程 ---------- */
const dirs = fs.readdirSync(ROOT)
  .filter(d => {
    const p = path.join(ROOT, d);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'case.json')) &&
      !fs.existsSync(path.join(p, '.nobuild'));
  })
  .sort();

if (!fs.existsSync(CASES_DIR)) fs.mkdirSync(CASES_DIR, { recursive: true });

/* 全站资源版本号（index.html 与 sw.js 预缓存共用，改一处即可） */
const VER = '20261102d';

const generated = [];
dirs.forEach(d => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, d, 'case.json'), 'utf8'));
  const out = path.join(CASES_DIR, j.id + '.case.js');
  fs.writeFileSync(out, buildPlugin(path.join(ROOT, d)), 'utf8');
  generated.push(j.id);
  console.log('[OK] ' + d + '  ->  assets/cases/' + j.id + '.case.js  (' +
    Math.round(fs.statSync(out).size / 1024) + ' KB)');
});

/* ---------- index.html 写入脚本区 ---------- */
let index = fs.readFileSync(INDEX, 'utf8');
/* 全站资源版本号同步：所有 ?v= 旧值的本地引用统一刷成当前 VER（含 css/js） */
index = index.replace(/(\?v=)[A-Za-z0-9_-]+/g, '$1' + VER);
const block = BEGIN + '\n' +
  generated.map(id => '<script src="assets/cases/' + id + '.case.js?v=' + VER + '"></script>').join('\n') +
  '\n' + END;
const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
if (re.test(index)) {
  index = index.replace(re, block);
} else {
  const anchor = '<script src="assets/core/case-demo-host.js';
  if (!index.includes(anchor)) throw new Error('index.html 里找不到锚点：' + anchor);
  index = index.replace(anchor, block + '\n\n' + anchor);
}
fs.writeFileSync(INDEX, index, 'utf8');
console.log('\n[OK] index.html 已更新：' + generated.length + ' 个插件案例脚本');

/* ---------- sw.js 预缓存清单同步 ---------- */
const SW = path.join(ROOT, 'sw.js');
if (fs.existsSync(SW)) {
  const caseEntries = ['assets/cases/welllog-layer.case.js?v=' + VER,
    'assets/cases/welllog-layer.demo.js?v=' + VER]
    .concat(generated.map(id => 'assets/cases/' + id + '.case.js?v=' + VER));
  /* 从 index.html 自动提取所有本地引用（assets/* 与 manifest），避免手工漏项 */
  const idxNow = fs.readFileSync(INDEX, 'utf8');
  const seen = new Set(), refs = [];
  (idxNow.match(/(?:src|href)="([^"]+)"/g) || []).forEach(function (m) {
    var u = (m.match(/"([^"]+)"/) || [])[1] || '';
    if (/^(https?:)?\/\//.test(u) || u.charAt(0) === '#') return;
    var p = u.replace(/^\.\//, '');
    if (!/^(assets\/|manifest\.webmanifest)/.test(p)) return;
    if (seen.has(p)) return;
    seen.add(p); refs.push(p);
  });
  /* 运行时动态挂载、index.html 里不出现的资源 */
  ['assets/cases/welllog-layer.demo.js?v=' + VER].forEach(function (u) {
    if (refs.indexOf(u) < 0) refs.push(u);
  });

  const core = ['./'].concat(refs);

  /* 校验：index.html 里的本地引用是否全部进了预缓存清单 */
  var missing = refs.filter(function (u) { return u.indexOf('?v=' + VER) >= 0 && core.indexOf(u) < 0; });
  if (missing.length) console.log('[WARN] 预缓存缺失：' + missing.join(', '));
  const block = '/* ===== PRECACHE-BEGIN（_build-plugins.js 自动维护，勿手改）===== */\n' +
    'const PRECACHE = [\n' + core.map(u => '  \'' + u + '\'').join(',\n') + '\n];\n' +
    '/* ===== PRECACHE-END ===== */';
  let sw = fs.readFileSync(SW, 'utf8');
  const reSw = /\/\* ===== PRECACHE-BEGIN[\s\S]*?PRECACHE-END ===== \*\//;
  if (reSw.test(sw)) {
    sw = sw.replace(reSw, block);
    fs.writeFileSync(SW, sw, 'utf8');
    console.log('[OK] sw.js 预缓存清单已同步（' + core.length + ' 项）');
  }
}
