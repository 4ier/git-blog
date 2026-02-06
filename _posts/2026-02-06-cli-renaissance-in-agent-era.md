---
layout: post
title: "AI Agent 时代的 CLI 复兴：数据、案例与判断"
date: 2026-02-06
categories: [ai-agent]
tags: [CLI, AI-Agent, GitHub, SaaS, Protocol, Developer-Tools]
---

AI Agent 的崛起正在悄悄重塑一个古老的界面形态：命令行。这篇文章用 GitHub 数据论证这个趋势，分析案例，并提出一个可能的判断。

<!-- more -->

## 起因：一个直觉

最近我在思考一个问题：AI agent 的出现，是否让 CLI 工具迎来了新一轮繁荣？

直觉上似乎是的——打开 GitHub Trending，CLI 项目到处都是。但直觉不可靠，需要数据。

## 数据：CLI 生态确实在 2025 爆发了，但要看清是什么在爆发

我统计了 2020-2025 年 GitHub 上新创建的、获得 1000+ stars 的 CLI 项目数量，并区分了 AI 相关和非 AI 项目：

```
年份 | 总数 | AI相关 | 非AI | AI占比
2020 |  55  |   12   |  43  |  22%
2021 |  43  |   12   |  31  |  28%
2022 |  41  |   13   |  28  |  32%
2023 |  43  |   20   |  23  |  47%
2024 |  29  |   15   |  14  |  52%
2025 |  66  |   51   |  15  |  77%
```

两个事实：

**事实一：CLI 项目总量确实在 2025 爆发了。** 66 个千星项目，是 2024 年的 2.3 倍，超过 2020 年的 55 个。

**事实二：增量几乎全部来自 AI。** 非 AI 的 CLI 项目持续走低（43 → 31 → 28 → 23 → 14 → 15），并未因为 agent 时代的到来而增长。

所以第一轮结论：**繁荣的不是"CLI 生态"，而是"AI 工具选择了 CLI 作为界面形态"。**

## 但为什么 Agent 选择了 CLI？

这不是偶然。CLI 对 agent 来说有天然优势：

1. **零成本接入** — 有 shell 就能用。不需要装 SDK、起 server、管连接。
2. **自描述** — `--help` 就是文档。Agent 运行时可以自行发现能力。
3. **无状态** — 每次调用独立。不用管 session、连接池、心跳。
4. **天然隔离** — 一个进程挂了不影响其他。
5. **文本即协议** — LLM 原生就是处理文本的。CLI 的输入输出是纯文本。零阻抗。

对比 MCP/API：需要起 server、管连接、处理协议协商、装语言特定的 SDK。对 agent 来说，这些都是额外的复杂度。

一个有说服力的例证：看看那些主流 AI coding agent（Claude Code、Gemini CLI、Codex CLI、OpenCode）——它们操作文件系统用 `ls`/`cat`/`grep`，操作 Git 用 `git` CLI，操作 GitHub 用 `gh` CLI。没有一个去调 REST API 或 MCP server。

**CLI 是 agent 的母语。**

## 案例：Linear CLI 的进化

Linear 是一个项目管理工具（类似 Jira，但更现代）。它的 CLI 生态演变很有意思：

**2021-2023**：零星几个社区 CLI，个位数 stars，个人爱好项目。

**2024 末**：[schpet/linear-cli](https://github.com/schpet/linear-cli) 出现（234⭐），README 直接写着 "agent friendly"，内置 agent skill。

**2025-2026**：突然冒出 5-6 个新的 Linear CLI 项目：
- [dorkitude/linctl](https://github.com/dorkitude/linctl)（95⭐）— 明确标注 "built with agents in mind (but useful to humans too)"
- [joa23/linear-cli](https://github.com/joa23/linear-cli)（29⭐，2026-01 创建）— 核心卖点是 "token-efficient"，三级输出粒度（minimal ~50 tokens/issue, compact ~150, full ~500）

而 Linear 官方从未出过 CLI。这些全是第三方社区封装。

进化路径很清晰：**人类爱好 CLI → agent-friendly CLI → token-efficient CLI → 自带 skill 安装的 CLI。**

同样的模式也在发生在 Todoist 身上。社区 CLI（[sachaos/todoist](https://github.com/sachaos/todoist)，1.6k⭐）做了 8 年，Doist 官方一直没动。直到 2026 年 1 月 15 日，官方终于发布了 [Doist/todoist-cli](https://github.com/Doist/todoist-cli)。SaaS 厂商开始意识到：**CLI 不再只是给极客用的，而是 agent 生态的入口。**

## 全景图：SaaS CLI 生态的现状与缺位

我扫描了主流 SaaS 产品的 CLI 生态。分布很不均匀：

**有成熟 CLI 生态的（开发者工具类）：**
- GitHub `gh`（40k+⭐，标杆级）
- Stripe CLI（1.8k⭐，官方）
- Vercel CLI（14.8k⭐，官方）
- Supabase CLI（1.6k⭐，官方）
- Jira CLI（5k⭐，社区）

**有 CLI 但生态弱的（协作工具类）：**
- Notion — 最大的社区 CLI 仅 37⭐；2026-02-03 刚出了一个 notion-cli-agent
- Trello — 307⭐，2013 年的老项目
- Asana — 248⭐，刚起步

**完全空白的（巨大缺口）：**
- Figma — 最大的 CLI 仅 5⭐
- ClickUp — 搜索 2153 个结果，最高星仅 72⭐
- Monday.com — 最高 51⭐
- Miro — 22⭐
- Calendly — 几乎不存在
- Mixpanel / Amplitude / Segment — 搜索结果为 0

一个规律：**开发者工具天然有 CLI（因为用户就是开发者），而面向非开发者的 SaaS 大面积缺位。** Agent 时代的到来正在填补这个缺口——不是厂商自己做，而是社区驱动的第三方 CLI wrapper。

## 一个判断：CLI 是 agent 时代的 REST API

回顾移动互联网时代：移动 app 没有发明 REST API，但让 REST API 变成了每个服务的标配。API 不是给用户用的，是给 app 用的。

类比 agent 时代：**Agent 不会发明 CLI，但会让 CLI 变成每个服务的标配。** CLI 不是给用户用的，是给 agent 用的。

有人会说：MCP / function calling 才是未来，CLI 只是过渡。

但现实是：
- 全世界每台机器都有 shell，不是每台都有 MCP runtime
- `git`、`docker`、`kubectl`、`ffmpeg` 永远不会去搞 MCP server
- 给现有软件加 CLI 比搭 MCP server 成本低一个数量级
- CLI 的进化版本（结构化 JSON 输出、token-efficient 格式）已经在出现

MCP 和 CLI 不是替代关系，更可能是共存：**CLI 做广度（所有工具都能 CLI 化），MCP 做深度（高频工具的优化通道）。**

## 未来 5 年会怎样？

我的预测：

1. **第三方 CLI wrapper 会大量涌现。** 每一个有 API 的 SaaS，都会被社区封装成 CLI。就像每个有数据的网站都被人做了爬虫一样。

2. **部分 SaaS 会出官方 CLI。** Todoist 已经走出了第一步。预计 Notion、Figma 等公司会跟上。

3. **CLI 的设计范式会转变。** 从"人类友好"转向"双向友好"——既有 `--help` 和彩色输出给人看，也有 `--json` 和 `--format minimal` 给 agent 看。joa23/linear-cli 的三级输出粒度就是这个方向的先驱。

4. **"Agent-native CLI" 会成为一个品类。** 特征：结构化输出、token 效率优化、自带 skill/plugin 安装、内置 `--help` 的机器可读版本。

CLI 这个 40 年前发明的界面形态，正在被 AI agent 赋予新的生命。不是因为它最优雅，而是因为它最务实。

---

*本文的数据分析和讨论在 2026 年 2 月 7 日凌晨完成。所有 GitHub 数据通过 `gh` CLI 实时查询获取。*
