---
name: daily-codex-tip
description: 每天下午1点生成一条 Codex 使用技巧，写入 daily-site 数据并重建拼贴首页后发布
---

用中文给用户（sansi，一位产品经理，正在学习把 Codex 用到日常产品与研发协作中）生成一条实用的 Codex 使用技巧，加入网站数据，按拼贴版式重建站点并发布。

工作目录（重要）：
- 仓库 github.com/huanxingfeixu/daily-site，本地路径 "/Users/huanxingfeixu/Claude news/daily-site"（路径含空格，命令中必须加引号）。
- 数据唯一来源是该仓库的 tips.json；页面由 build.js 生成；插图在 img/birds/。不要写入上级 Claude news 目录，不再维护 claude-tips-log.md。

内容要求：
1. 主题轮换，优先覆盖 Codex 对产品经理有用的场景：AGENTS.md、Skills、Plugins、MCP/Connectors、Automations、Browser Use、代码审查、原型/页面实现、测试与验证、从 PRD 到任务拆解等。运行前先读 tips.json 里所有 title，避免与近期重复。
2. 涉及 Codex 产品功能细节时，先核实 OpenAI 官方文档（developers.openai.com、help.openai.com 或 openai.com 官方页面）。如果官方资料不可访问，只写当前环境可验证的通用技巧，不编造功能名或入口。
3. 技巧要可立即上手，优先选对产品经理日常工作（写 PRD、做调研、整理需求、画原型、跟研发协作、做发布检查）有用的。正文简洁，弹窗正文 1–3 段。

加入数据（关键）：在 tips.json 数组最前面插入一个对象，保持其它项与文件结构不变。字段：
- date：当天 YYYY-MM-DD
- weekday：周X
- category：优先用 "Codex 使用"；也可沿用 "提示词技巧" / "Cowork 功能" / "文档生成" / "API"
- title：技巧标题
- summary：卡片摘要（40 字内）
- intro：数组，1–3 段弹窗正文 HTML（可含 <strong>/<code>/<a>）
- prompt：可直接复制的提示词，纯文本，保留换行（\n）；无示例则空字符串 ""
- promptLabel：通常 "复制即用"
- note：要点 HTML（可空）；官方链接放这里，写成 <a href="..." target="_blank" rel="noopener">…</a>
- permalink："codex-tip-YYYY-MM-DD.html"
- bird：Codex 使用优先从 corvus-corax、bombycilla-cedrorum 中轮换，尽量与最近一条不同。

重建站点：
- cd "/Users/huanxingfeixu/Claude news/daily-site" && node build.js
- build.js 会用 tips.json 重新生成 index.html 与所有技巧详情页。不要手改这些生成产物。

发布到网站（重建之后、告知用户之前执行）：
1. 自检：扫描待发布文件是否含 API key/密码/内部接口地址/StockLink 未公开数据，命中则跳过发布并报告。
2. cd "/Users/huanxingfeixu/Claude news/daily-site" && git add -A && git commit -m "publish: $(date +%F)" && git push
   - 若 .git 出现遗留锁（index.lock / HEAD.lock，因沙箱挂载禁止 unlink 而残留），用 rename 移开后重试：
     mv .git/index.lock ".git/index.lock.bak.$(date +%s)" 2>/dev/null（HEAD.lock 同理）。禁止 force push，禁止改 git 全局配置。
   - push 失败（冲突/鉴权）时停止报错，不强推。
3. 用一句话告知用户当天技巧主题，并附 https://daily-site.pages.dev 。
