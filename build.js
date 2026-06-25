#!/usr/bin/env node
/*
 * build.js — Claude / Codex 每日技巧站生成器（零依赖）
 * 由 tips.json 生成 index.html（静态卡片 + 内联 TIPS 数据 + 交互 JS）与每条 tip 详情页。
 * 用法：node build.js
 * 设计 token、鸟图、版式见 README / SKILL。插图本地相对路径 img/birds/<拉丁名>.png|-2.png。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const CAT_COLORS = { '提示词技巧': '#C75D43', 'Cowork 功能': '#3E7B8C', '文档生成': '#BE9233', 'API': '#7D67A9', 'Codex 使用': '#4F6F52' };
const CAT_FALLBACK = '#8A7E70';
const CAT_ORDER = ['Codex 使用', '提示词技巧', 'Cowork 功能', '文档生成', 'API'];
const catColor = c => CAT_COLORS[c] || CAT_FALLBACK;
const PRODUCT_COLORS = { 'Claude': '#C75D43', 'Codex': '#4F6F52' };
const PRODUCT_ORDER = ['Claude', 'Codex'];
const productColor = p => PRODUCT_COLORS[p] || CAT_FALLBACK;
const productOf = t => t.product || (t.category === 'Codex 使用' || /^codex-tip-/i.test(t.permalink || '') ? 'Codex' : 'Claude');

// 分类 → 鸟池（同色系），栖息 <slug>.png + 飞行 <slug>-2.png 须在 img/birds/
const BIRD_POOLS = {
  '提示词技巧': ['piranga-ludoviciana','calypte-anna','icterus-bullockii','piranga-rubra'],
  'Cowork 功能': ['cyanocitta-stelleri','sialia-currucoides','sialia-mexicana','passerina-amoena','passerina-cyanea'],
  '文档生成': ['spinus-tristis','spinus-psaltria','icterus-galbula'],
  'API': ['bombycilla-cedrorum','corvus-corax'],
  'Codex 使用': ['corvus-corax','bombycilla-cedrorum']
};
const BIRD_FALLBACK = ['bombycilla-cedrorum','corvus-corax'];

// 安全网：若某条缺 bird，按分类鸟池轮换补一个（避免与同类相邻重复），并写回 tips.json
function assignBirds(tips){
  let changed = false;
  // 自旧到新处理，便于“避免相邻重复”
  const ordered = tips.slice().reverse();
  const lastUsed = {}; // category -> 上一次用的 slug
  ordered.forEach(t => {
    const pool = BIRD_POOLS[t.category] || BIRD_FALLBACK;
    if (t.bird && (pool.includes(t.bird) || BIRD_FALLBACK.includes(t.bird))) { lastUsed[t.category] = t.bird; return; }
    if (t.bird) { lastUsed[t.category] = t.bird; return; } // 池外自定义鸟，尊重之
    let pick = pool[0];
    const prev = lastUsed[t.category];
    const used = ordered.filter(x => x.category===t.category && x.bird).map(x => x.bird);
    pick = pool.find(s => s!==prev && used.indexOf(s)<0) || pool.find(s => s!==prev) || pool[0];
    t.bird = pick; lastUsed[t.category] = pick; changed = true;
  });
  if (changed) fs.writeFileSync(path.join(ROOT,'tips.json'), JSON.stringify(tips, null, 2) + '\n');
  return changed;
}

const SITE_URL = 'https://daily-site.pages.dev';

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function attr(s){ return esc(s); }

function loadTips(){
  const tips = JSON.parse(fs.readFileSync(path.join(ROOT,'tips.json'),'utf8'));
  tips.sort((a,b)=> a.date < b.date ? 1 : a.date > b.date ? -1 : 0); // 新→旧
  tips.forEach(t => { t.product = productOf(t); });
  return tips;
}

/* ---------- 共享 CSS ---------- */
const BASE_CSS = `
:root{
  --paper:#FBF8F3; --card:#FFFFFF; --ink:#2B2724; --ink2:#6E665C; --ink3:#9A9085;
  --line:#E9E1D4; --illo1:#FCF8EF; --illo2:#F2E9D7; --cat:#8A7E70;
  --r:20px; --ease:cubic-bezier(.2,.7,.2,1);
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono","PingFang SC",monospace;
}
*{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.7;-webkit-font-smoothing:antialiased;}
a{color:inherit;}
.mono{font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);}
img{display:block;max-width:100%;}
.illo{position:relative;background:linear-gradient(160deg,var(--illo1),var(--illo2));overflow:hidden;}
.illo img{width:100%;height:100%;object-fit:contain;object-position:center;
  filter:drop-shadow(0 10px 18px rgba(43,39,36,.10));mix-blend-mode:multiply;}
.tag{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--cat);
  font-family:var(--sans);letter-spacing:.01em;white-space:nowrap;}
.tag::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--cat);flex:0 0 auto;}
.prompt{background:var(--ink);color:var(--paper);border-radius:14px;padding:14px 16px 16px;margin:18px 0;}
.prompt-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:12px;}
.prompt-label{color:#C9C1B4;}
.prompt pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);
  font-size:13px;line-height:1.65;color:var(--paper);}
.copy-btn{font-family:var(--mono);font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;
  color:var(--paper);background:rgba(251,248,243,.12);border:1px solid rgba(251,248,243,.28);
  border-radius:999px;padding:5px 12px;cursor:pointer;transition:background .2s var(--ease);}
.copy-btn:hover{background:rgba(251,248,243,.22);}
.copy-btn.done{background:var(--cat);border-color:var(--cat);}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important;}}
`;

const INDEX_CSS = BASE_CSS + `
.wrap{max-width:1080px;margin:0 auto;padding:0 24px;}
header.hero{text-align:center;padding:72px 0 30px;}
.eyebrow{display:inline-flex;align-items:center;gap:8px;}
.pulse{width:8px;height:8px;border-radius:50%;background:#C75D43;position:relative;}
.pulse::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid #C75D43;opacity:.5;animation:pulse 2.4s var(--ease) infinite;}
@keyframes pulse{0%{transform:scale(.6);opacity:.7}70%{transform:scale(1.7);opacity:0}100%{opacity:0}}
h1.title{font-size:46px;line-height:1.1;margin:18px 0 12px;letter-spacing:-.02em;font-weight:700;}
.subtitle{font-size:16.5px;color:var(--ink2);max-width:520px;margin:0 auto;}
section{margin:34px 0;}
.sec-label{margin:0 0 16px;display:flex;align-items:baseline;gap:10px;}
.sec-label .cn{font-family:var(--sans);font-size:13px;font-weight:600;letter-spacing:.12em;color:var(--ink2);text-transform:none;}
.controls{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;justify-content:space-between;margin:0 0 18px;}
.filter-stack{display:flex;flex-direction:column;gap:10px;align-items:flex-start;}
.product-tabs{display:inline-flex;border:1px solid var(--line);border-radius:999px;background:var(--card);padding:3px;gap:3px;}
.product-tab{font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink2);background:transparent;
  border:0;border-radius:999px;padding:7px 15px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;
  transition:background .2s var(--ease),color .2s var(--ease);}
.product-tab .n{font-weight:500;color:var(--ink3);font-variant-numeric:tabular-nums;}
.product-tab:hover{color:var(--ink);}
.product-tab[aria-pressed="true"]{background:var(--p,var(--ink));color:#fff;}
.product-tab[aria-pressed="true"] .n{color:rgba(255,255,255,.82);}
.chips{display:flex;flex-wrap:wrap;gap:8px;}
.chip{font-family:var(--sans);font-size:13px;font-weight:500;color:var(--ink2);background:var(--card);
  border:1px solid var(--line);border-radius:999px;padding:7px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;
  transition:border-color .2s var(--ease),color .2s var(--ease),background .2s var(--ease);}
.chip .dot{width:8px;height:8px;border-radius:50%;background:var(--c,transparent);}
.chip .n{color:var(--ink3);font-variant-numeric:tabular-nums;}
.chip:hover{border-color:var(--c,#C75D43);color:var(--ink);}
.chip[aria-pressed="true"]{background:var(--c,#2B2724);border-color:var(--c,#2B2724);color:#fff;}
.chip[aria-pressed="true"] .n{color:rgba(255,255,255,.8);}
.chip[aria-pressed="true"] .dot{background:#fff;}
.sorts{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;background:var(--card);}
.sorts button{font-family:var(--sans);font-size:13px;color:var(--ink2);background:transparent;border:0;padding:7px 14px;cursor:pointer;transition:background .2s var(--ease);}
.sorts button[aria-pressed="true"]{background:var(--ink);color:#fff;}

.card{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);
  border-radius:var(--r);overflow:hidden;transition:transform .25s var(--ease),border-color .25s var(--ease),box-shadow .25s var(--ease);}
.card:hover{transform:translateY(-3px);border-color:var(--cat);box-shadow:0 14px 30px rgba(43,39,36,.08);}
.card:focus-visible{outline:2px solid var(--cat);outline-offset:3px;}
/* 统一卡片尺寸（参考 apartment birds 的小图块，所有插图同尺寸） */
.card .illo{aspect-ratio:1/1;}
.today-badge{position:absolute;top:10px;left:10px;z-index:1;font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  color:var(--paper);background:var(--ink);border-radius:999px;padding:4px 9px;}
.card .body{padding:13px 15px 15px;}
.card .meta{display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap;}
.card .meta .eyebrow{color:var(--ink3);font-size:11px;}
.product-pill{font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--product);
  border:1px solid color-mix(in srgb,var(--product) 42%,transparent);border-radius:999px;padding:1px 7px;line-height:1.6;background:#fff;}
.card .ctitle{font-size:14.5px;font-weight:650;line-height:1.45;margin:0;}

#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(208px,1fr));gap:16px;}
#grid-empty{color:var(--ink2);text-align:center;padding:46px 0;font-size:14.5px;}

footer{border-top:1px solid var(--line);margin-top:48px;padding:30px 0 64px;color:var(--ink3);font-size:12.5px;line-height:1.8;}
footer .credit{max-width:760px;}
footer a{color:var(--ink2);text-decoration:underline;text-underline-offset:2px;}

/* 弹窗 */
.modal[hidden]{display:none;}
.modal{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;}
.modal-backdrop{position:absolute;inset:0;background:rgba(43,39,36,.46);backdrop-filter:blur(3px);}
.dialog{position:relative;z-index:1;width:min(920px,100%);max-height:88vh;background:var(--card);border-radius:24px;overflow:hidden;
  display:grid;grid-template-columns:1fr 1fr;box-shadow:0 30px 80px rgba(43,39,36,.30);animation:pop .3s var(--ease);}
@keyframes pop{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:none;opacity:1}}
.m-illo{position:relative;background:linear-gradient(160deg,var(--illo1),var(--illo2));display:flex;align-items:center;justify-content:center;min-height:320px;padding:28px;}
.m-illo img{width:100%;height:100%;max-height:60vh;object-fit:contain;filter:drop-shadow(0 12px 22px rgba(43,39,36,.12));mix-blend-mode:multiply;}
.pose-toggle{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:inline-flex;background:rgba(255,255,255,.7);
  border:1px solid var(--line);border-radius:999px;overflow:hidden;backdrop-filter:blur(4px);}
.pose-toggle button{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--ink2);background:transparent;border:0;padding:6px 14px;cursor:pointer;}
.pose-toggle button.is-on{background:var(--cat);color:#fff;}
.m-content{padding:34px 36px;overflow:auto;}
.m-eyebrow{margin-bottom:12px;}
.m-content h2{font-size:24px;line-height:1.3;margin:10px 0 16px;font-weight:700;letter-spacing:-.01em;}
.m-content .m-intro p{margin:0 0 14px;font-size:15.5px;color:var(--ink);}
.m-content code{font-family:var(--mono);font-size:.92em;background:var(--line);border-radius:5px;padding:1px 6px;}
.m-note{font-size:13px;color:var(--ink2);line-height:1.75;border-top:1px solid var(--line);padding-top:14px;margin-top:6px;}
.m-note a{color:var(--cat);text-decoration:underline;text-underline-offset:2px;}
.m-close{position:absolute;top:14px;right:16px;z-index:3;width:38px;height:38px;border-radius:50%;border:1px solid var(--line);
  background:rgba(255,255,255,.85);color:var(--ink);font-size:22px;line-height:1;cursor:pointer;transition:background .2s var(--ease);}
.m-close:hover{background:#fff;}
.m-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);
  background:rgba(255,255,255,.9);color:var(--ink);font-size:22px;cursor:pointer;transition:background .2s var(--ease),opacity .2s;}
.m-nav:hover{background:#fff;}
.m-prev{left:-21px;}.m-next{right:-21px;}
.m-nav[disabled]{opacity:.32;cursor:default;}
.dialog :focus-visible{outline:2px solid var(--cat);outline-offset:2px;}
html.modal-open{overflow:hidden;}

@media (max-width:900px){
  .m-prev{left:8px;}.m-next{right:8px;}
}
@media (max-width:640px){
  h1.title{font-size:34px;}
  #grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
  .controls{flex-direction:column;align-items:flex-start;gap:12px;}
  .product-tabs{width:100%;}
  .product-tab{flex:1;justify-content:center;padding-inline:10px;}
  /* 移动端弹窗：底部抽屉 */
  .modal{padding:0;align-items:flex-end;}
  .dialog{grid-template-columns:1fr;width:100%;max-height:92vh;border-radius:22px 22px 0 0;animation:drawer .32s var(--ease);}
  @keyframes drawer{from{transform:translateY(100%)}to{transform:none}}
  .m-illo{min-height:200px;}
  .m-illo img{max-height:32vh;}
  .m-content{padding:24px 22px 30px;}
  .m-nav{top:auto;bottom:14px;transform:none;}
  .m-prev{left:14px;}.m-next{right:14px;}
  .m-close{top:10px;right:12px;}
}
`;

const TIP_CSS = BASE_CSS + `
.wrap{max-width:640px;margin:0 auto;padding:0 22px;}
.back{display:inline-flex;align-items:center;gap:6px;margin:26px 0 0;font-size:13px;color:var(--ink2);text-decoration:none;}
.back:hover{color:var(--ink);}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin:18px 0 26px;}
.card .illo{aspect-ratio:16/10;}
.pad{padding:30px 34px 34px;}
.meta{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap;}
.meta .eyebrow{color:var(--ink3);}
.product-pill{font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--product);
  border:1px solid color-mix(in srgb,var(--product) 42%,transparent);border-radius:999px;padding:1px 7px;line-height:1.6;background:#fff;}
h1{font-size:25px;line-height:1.3;margin:6px 0 18px;font-weight:700;letter-spacing:-.01em;}
p{font-size:15.5px;margin:0 0 15px;color:var(--ink);}
code{font-family:var(--mono);font-size:.92em;background:var(--line);border-radius:5px;padding:1px 6px;}
.note{font-size:13px;color:var(--ink2);line-height:1.75;border-top:1px solid var(--line);padding-top:14px;margin-top:18px;}
.note a{color:var(--cat);text-decoration:underline;text-underline-offset:2px;}
footer{border-top:1px solid var(--line);margin-top:30px;padding:24px 0 56px;color:var(--ink3);font-size:12px;line-height:1.8;}
footer a{color:var(--ink2);text-decoration:underline;text-underline-offset:2px;}
@media (max-width:640px){ .pad{padding:24px 22px 28px;} h1{font-size:22px;} }
`;

/* ---------- 公共片段 ---------- */
function attribution(){
  return '鸟类插画 © Teddy Warner，源自 <a href="https://bird.onethreenine.net/" target="_blank" rel="noopener">apartment birds</a>'
    + '（<a href="https://github.com/Twarner491/AvianVisitors" target="_blank" rel="noopener">AvianVisitors</a>），'
    + '依 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a> 授权使用（已缩放、压缩）。本站为个人非商业作品，相同方式共享。';
}
function fmtDate(t){ return t.date.slice(5).replace('-',' / ') + ' · ' + t.weekday; }

/* ---------- 卡片（首页，静态：SEO + 无 JS 兜底）---------- */
function cardHTML(t, isToday){
  const loading = isToday ? 'eager' : 'lazy';
  const badge = isToday ? '<span class="today-badge">今天</span>' : '';
  const product = productOf(t);
  return ''
  + '<a class="card" href="' + attr(t.permalink) + '" data-date="' + attr(t.date) + '" data-cat="' + attr(t.category) + '" data-product="' + attr(product) + '" style="--cat:' + catColor(t.category) + ';--product:' + productColor(product) + '">'
  +   '<span class="illo">' + badge + '<img src="img/birds/' + attr(t.bird) + '.png" alt="" loading="' + loading + '"></span>'
  +   '<span class="body">'
  +     '<span class="meta"><span class="eyebrow mono">' + esc(fmtDate(t)) + '</span><span class="product-pill">' + esc(product) + '</span><span class="tag">' + esc(t.category) + '</span></span>'
  +     '<span class="ctitle">' + esc(t.title) + '</span>'
  +   '</span>'
  + '</a>';
}

/* ---------- index.html ---------- */
function buildIndex(tips){
  const hero = tips[0];
  const rest = tips.slice(1);

  // 动态分类（不硬编码）：按偏好序排列，计数
  const counts = {};
  tips.forEach(t => { counts[t.category] = (counts[t.category]||0)+1; });
  const cats = Object.keys(counts).sort((a,b)=>{
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    return (ia<0?99:ia)-(ib<0?99:ib);
  });
  let chips = '<button class="chip" data-cat="*" aria-pressed="true">全部 <span class="n">' + tips.length + '</span></button>';
  cats.forEach(c => {
    chips += '<button class="chip" data-cat="' + attr(c) + '" aria-pressed="false" style="--c:' + catColor(c) + '">'
      + '<span class="dot"></span>' + esc(c) + ' <span class="n">' + counts[c] + '</span></button>';
  });
  const productCounts = {};
  tips.forEach(t => { productCounts[productOf(t)] = (productCounts[productOf(t)]||0)+1; });
  let productTabs = '<button class="product-tab" data-product="*" aria-pressed="true" style="--p:#2B2724">全部 <span class="n">' + tips.length + '</span></button>';
  PRODUCT_ORDER.forEach(p => {
    productTabs += '<button class="product-tab" data-product="' + attr(p) + '" aria-pressed="false" style="--p:' + productColor(p) + '">' + esc(p) + ' <span class="n">' + (productCounts[p] || 0) + '</span></button>';
  });

  const gridCards = tips.map((t,i) => cardHTML(t, i===0)).join('\n        ');

  const tipsJson = JSON.stringify(tips).replace(/</g, '\\u003c');
  const catJson = JSON.stringify(CAT_COLORS);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude / Codex 每日技巧 — 写给产品经理的实用小贴士</title>
<meta name="description" content="每天一条可立即上手的 Claude / Codex 使用技巧，覆盖提示词、自动化、项目协作与文档生成，专为产品经理日常工作打造。">
<meta name="theme-color" content="#C75D43">
<meta property="og:type" content="website">
<meta property="og:title" content="Claude / Codex 每日技巧">
<meta property="og:description" content="每天一条可立即上手的 Claude / Codex 使用技巧，专为产品经理打造。">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary">
<style>${INDEX_CSS}</style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <span class="eyebrow mono"><span class="pulse"></span>每天下午 1 点更新</span>
      <h1 class="title">Claude / Codex 每日技巧</h1>
      <p class="subtitle">每天一条可立即上手的小贴士，覆盖 Claude 与 Codex 的提示词、自动化、项目协作与文档生成，写给把 AI 用在日常工作里的产品经理。</p>
    </header>

    <section class="feed" aria-label="技巧合集">
      <div class="controls">
        <div class="filter-stack">
          <div class="product-tabs" id="product-tabs" role="group" aria-label="按产品筛选">${productTabs}</div>
          <div class="chips" id="filters" role="group" aria-label="按分类筛选">${chips}</div>
        </div>
        <div class="sorts" id="sorts" role="group" aria-label="排序">
          <button data-sort="new" aria-pressed="true">最新</button>
          <button data-sort="old" aria-pressed="false">最早</button>
        </div>
      </div>
      <div id="grid">
        ${gridCards}
      </div>
      <p id="grid-empty" hidden>该分类下暂无技巧。</p>
    </section>

    <footer>
      <p>由定时任务 <strong>daily-codex-tip</strong> 自动维护 · 基于 Claude / Codex 生成</p>
      <p class="credit">${attribution()}</p>
    </footer>
  </div>

  <!-- 弹窗详情（渐进增强：无 JS 时卡片直接跳转 claude-tip-*.html 原文页）-->
  <div class="modal" id="modal" hidden>
    <div class="modal-backdrop" data-close="1"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <button class="m-close" id="m-close" aria-label="关闭弹窗">&times;</button>
      <div class="m-illo">
        <img id="m-img" alt="">
        <div class="pose-toggle" role="group" aria-label="切换栖息 / 飞行姿态">
          <button type="button" data-pose="perch" class="is-on">栖息</button>
          <button type="button" data-pose="flight">飞行</button>
        </div>
      </div>
      <div class="m-content">
        <div class="m-eyebrow mono" id="m-date"></div>
        <span class="tag" id="m-tag"></span>
        <h2 id="m-title"></h2>
        <div class="m-intro" id="m-intro"></div>
        <div class="prompt" id="m-prompt-wrap">
          <div class="prompt-head"><span class="prompt-label mono" id="m-prompt-label">复制即用</span><button type="button" class="copy-btn" id="m-copy">复制</button></div>
          <pre id="m-prompt"></pre>
        </div>
        <div class="m-note" id="m-note"></div>
      </div>
      <button class="m-nav m-prev" id="m-prev" aria-label="上一条">&lsaquo;</button>
      <button class="m-nav m-next" id="m-next" aria-label="下一条">&rsaquo;</button>
    </div>
  </div>

  <script>window.__TIPS__=${tipsJson};window.__CATCOLORS__=${catJson};</script>
  <script>${CLIENT_JS}</script>
</body>
</html>
`;
}

/* ---------- claude-tip-*.html（独立页：SEO / 无 JS 兜底 / 弹窗“原文”目标）---------- */
function buildTip(t){
  const product = productOf(t);
  const intro = t.intro.map(p => '<p>' + p + '</p>').join('\n    ');
  const promptBlock = (t.prompt && t.prompt.trim()) ? (''
    + '<div class="prompt">'
    +   '<div class="prompt-head"><span class="prompt-label mono">' + esc(t.promptLabel || '复制即用') + '</span><button type="button" class="copy-btn" id="copy">复制</button></div>'
    +   '<pre id="prompt">' + esc(t.prompt) + '</pre>'
    + '</div>') : '';
  const note = t.note ? '<div class="note">' + t.note + '</div>' : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)} · Claude / Codex 每日技巧</title>
<meta name="description" content="${attr(t.summary)}">
<meta name="theme-color" content="${catColor(t.category)}">
<style>${TIP_CSS}</style>
</head>
<body style="--cat:${catColor(t.category)};--product:${productColor(product)}">
  <div class="wrap">
    <a class="back" href="index.html">&larr; 全部技巧</a>
    <article class="card">
      <div class="illo"><img src="img/birds/${attr(t.bird)}.png" alt="" loading="eager"></div>
      <div class="pad">
        <div class="meta"><span class="eyebrow mono">${esc(fmtDate(t))}</span><span class="product-pill">${esc(product)}</span><span class="tag">${esc(t.category)}</span></div>
        <h1>${esc(t.title)}</h1>
        ${intro}
        ${promptBlock}
        ${note}
      </div>
    </article>
    <footer>
      <p>由定时任务 <strong>daily-codex-tip</strong> 自动维护 · 基于 Claude / Codex 生成</p>
      <p>${attribution()}</p>
    </footer>
  </div>
  <script>
  (function(){
    var b=document.getElementById('copy'),p=document.getElementById('prompt');
    if(!b||!p)return;
    b.addEventListener('click',function(){
      var txt=p.textContent;
      function ok(){b.textContent='已复制';b.classList.add('done');setTimeout(function(){b.textContent='复制';b.classList.remove('done');},1500);}
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fallback);}else{fallback();}
      function fallback(){try{var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);ok();}catch(e){}}
    });
  })();
  </script>
</body>
</html>
`;
}

/* ---------- 客户端交互 JS（无模板字符串 / 无 ${}，便于内联）---------- */
const CLIENT_JS = [
"(function(){",
"  var TIPS = window.__TIPS__ || [];",
"  var CAT = window.__CATCOLORS__ || {};",
"  function catColor(c){ return CAT[c] || '#8A7E70'; }",
"  var byDate = {}; TIPS.forEach(function(t){ byDate[t.date] = t; });",
"  var grid = document.getElementById('grid');",
"  var emptyEl = document.getElementById('grid-empty');",
"  var gridCards = [].slice.call(grid.querySelectorAll('.card'));",
"  var state = { product: '*', cat: '*', sort: 'new' };",
"",
"  function applyGrid(){",
"    var arr = gridCards.slice();",
"    arr.sort(function(a,b){ var da=a.getAttribute('data-date'), db=b.getAttribute('data-date');",
"      if(state.sort==='new'){ return da<db?1:(da>db?-1:0); } return da>db?1:(da<db?-1:0); });",
"    var shown=0;",
"    arr.forEach(function(c){ var m = (state.cat==='*') || (c.getAttribute('data-cat')===state.cat);",
"      m = m && ((state.product==='*') || (c.getAttribute('data-product')===state.product));",
"      c.hidden=!m; if(m) shown++; grid.appendChild(c); });",
"    emptyEl.hidden = shown!==0; grid.hidden = shown===0;",
"  }",
"",
"  // 筛选 / 排序",
"  var productTabs = document.getElementById('product-tabs');",
"  productTabs.addEventListener('click', function(e){ var b=e.target.closest('.product-tab'); if(!b) return;",
"    state.product=b.getAttribute('data-product'); state.cat='*';",
"    [].forEach.call(productTabs.querySelectorAll('.product-tab'), function(c){ c.setAttribute('aria-pressed', c===b?'true':'false'); });",
"    [].forEach.call(filters.querySelectorAll('.chip'), function(c){ c.setAttribute('aria-pressed', c.getAttribute('data-cat')==='*'?'true':'false'); });",
"    applyGrid(); });",
"  var filters = document.getElementById('filters');",
"  filters.addEventListener('click', function(e){ var b=e.target.closest('.chip'); if(!b) return;",
"    state.cat=b.getAttribute('data-cat');",
"    [].forEach.call(filters.querySelectorAll('.chip'), function(c){ c.setAttribute('aria-pressed', c===b?'true':'false'); });",
"    applyGrid(); });",
"  var sorts = document.getElementById('sorts');",
"  sorts.addEventListener('click', function(e){ var b=e.target.closest('button'); if(!b) return;",
"    state.sort=b.getAttribute('data-sort');",
"    [].forEach.call(sorts.querySelectorAll('button'), function(c){ c.setAttribute('aria-pressed', c===b?'true':'false'); });",
"    applyGrid(); });",
"",
"  // 当前可见序列（按显示顺序）—— 弹窗 ←/→ 据此导航",
"  function sequence(){ var seq=[];",
"    [].forEach.call(grid.querySelectorAll('.card'), function(c){ if(!c.hidden) seq.push(c); }); return seq; }",
"",
"  // 弹窗",
"  var modal=document.getElementById('modal'), dialog=modal.querySelector('.dialog');",
"  var mImg=document.getElementById('m-img'), mDate=document.getElementById('m-date'), mTag=document.getElementById('m-tag');",
"  var mTitle=document.getElementById('m-title'), mIntro=document.getElementById('m-intro'), mPrompt=document.getElementById('m-prompt');",
"  var mPromptWrap=document.getElementById('m-prompt-wrap'), mPromptLabel=document.getElementById('m-prompt-label');",
"  var mNote=document.getElementById('m-note');",
"  var mPrev=document.getElementById('m-prev'), mNext=document.getElementById('m-next'), mClose=document.getElementById('m-close');",
"  var mCopy=document.getElementById('m-copy');",
"  var poseBtns=[].slice.call(dialog.querySelectorAll('.pose-toggle button'));",
"  var seq=[], idx=-1, opener=null, pose='perch';",
"",
"  function fmtFull(t){ var m=parseInt(t.date.slice(5,7),10), d=parseInt(t.date.slice(8,10),10);",
"    var today=new Date(); var iso=today.getFullYear()+'-'+('0'+(today.getMonth()+1)).slice(-2)+'-'+('0'+today.getDate()).slice(-2);",
"    var pre = (t.date===iso) ? '今天' : (m+' 月 '+d+' 日'); return pre+' · '+t.weekday; }",
"",
"  function setPose(p){ pose=p; var t=byDate[curDate]; if(!t) return;",
"    mImg.src='img/birds/'+t.bird+(p==='flight'?'-2':'')+'.png';",
"    poseBtns.forEach(function(b){ b.classList.toggle('is-on', b.getAttribute('data-pose')===p); }); }",
"",
"  var curDate=null;",
"  function fill(t){ curDate=t.date;",
"    dialog.style.setProperty('--cat', catColor(t.category));",
"    mDate.textContent=fmtFull(t);",
"    mTag.textContent=t.category;",
"    mTitle.textContent=t.title;",
"    mIntro.innerHTML=(t.intro||[]).map(function(p){return '<p>'+p+'</p>';}).join('');",
"    if(t.prompt && t.prompt.trim()){ mPromptWrap.style.display=''; mPrompt.textContent=t.prompt; mPromptLabel.textContent=t.promptLabel||'复制即用'; }",
"    else { mPromptWrap.style.display='none'; }",
"    mNote.innerHTML=t.note||''; mNote.style.display=t.note?'':'none';",
"    pose='perch'; setPose('perch');",
"    mPrev.disabled = idx<=0; mNext.disabled = idx>=seq.length-1;",
"  }",
"",
"  function openAt(i){ seq=sequence(); idx=i; var card=seq[idx]; if(!card) return;",
"    var t=byDate[card.getAttribute('data-date')]; if(!t) return;",
"    fill(t); modal.hidden=false; document.documentElement.classList.add('modal-open');",
"    mClose.focus(); }",
"  function openByCard(card){ seq=sequence(); var i=seq.indexOf(card); if(i<0) return; openAt(i); }",
"  function nav(d){ var n=idx+d; if(n<0||n>=seq.length) return; idx=n;",
"    var t=byDate[seq[idx].getAttribute('data-date')]; if(t) fill(t); }",
"  function close(){ modal.hidden=true; document.documentElement.classList.remove('modal-open');",
"    if(opener && opener.focus) opener.focus(); opener=null; }",
"",
"  // 卡片点击：渐进增强（修饰键 / 中键 / 无 JS 时走原文页）",
"  function bindCard(card){ card.addEventListener('click', function(e){",
"    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button===1) return;",
"    e.preventDefault(); opener=card; openByCard(card); }); }",
"  gridCards.forEach(bindCard);",
"",
"  mClose.addEventListener('click', close);",
"  modal.addEventListener('click', function(e){ if(e.target.hasAttribute('data-close')) close(); });",
"  mPrev.addEventListener('click', function(){ nav(-1); });",
"  mNext.addEventListener('click', function(){ nav(1); });",
"  poseBtns.forEach(function(b){ b.addEventListener('click', function(){ setPose(b.getAttribute('data-pose')); }); });",
"",
"  mCopy.addEventListener('click', function(){ var txt=mPrompt.textContent;",
"    function ok(){ mCopy.textContent='已复制'; mCopy.classList.add('done'); setTimeout(function(){ mCopy.textContent='复制'; mCopy.classList.remove('done'); },1500); }",
"    function fb(){ try{ var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); ok(); }catch(e){} }",
"    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok,fb); } else { fb(); } });",
"",
"  document.addEventListener('keydown', function(e){ if(modal.hidden) return;",
"    if(e.key==='Escape'){ close(); }",
"    else if(e.key==='ArrowLeft'){ nav(-1); }",
"    else if(e.key==='ArrowRight'){ nav(1); }",
"    else if(e.key==='Tab'){ // 焦点陷阱",
"      var f=dialog.querySelectorAll('button:not([disabled]),a[href]'); if(!f.length) return;",
"      var first=f[0], last=f[f.length-1];",
"      if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }",
"      else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); } }",
"  });",
"",
"  applyGrid();",
"})();"
].join("\n");

/* ---------- 运行 ---------- */
function main(){
  const tips = loadTips();
  if(assignBirds(tips)) console.log('已为缺失 bird 的条目自动分配并写回 tips.json。');
  fs.writeFileSync(path.join(ROOT,'index.html'), buildIndex(tips));
  tips.forEach(t => fs.writeFileSync(path.join(ROOT, t.permalink), buildTip(t)));
  // 校验：每条引用的鸟图是否存在
  const missing = [];
  tips.forEach(t => {
    ['', '-2'].forEach(s => {
      const f = path.join(ROOT,'img','birds', t.bird + s + '.png');
      if(!fs.existsSync(f)) missing.push(t.bird + s + '.png');
    });
  });
  console.log('生成 index.html + ' + tips.length + ' 个技巧页。');
  if(missing.length) console.warn('⚠ 缺失鸟图：' + missing.join(', '));
  else console.log('鸟图校验通过（' + tips.length + ' 条全部命中）。');
}
main();
