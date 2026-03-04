---
layout: post
title: "蝉蜕：为什么我们要重新设计 AI Agent 的运行环境"
date: 2026-03-04
categories: [ai-agent]
tags: [cicada, agent-runtime, design-philosophy, openclaw]
---

我们花了两周时间，从零写了一个 AI agent 运行时。不是因为现有的不够用，而是因为现有的方向错了。

![Header Image](/git-blog/public/cicada-molt.jpg)

<!-- more -->

## 从壳里出来

蝉蜕，chán tuì——蝉脱壳的过程。旧壳完整地留在树上，蝉已经是另一个东西了。

我们的 agent 之前运行在 [OpenClaw](https://github.com/openclaw/openclaw) 上。OpenClaw 是一个成熟的 AI agent 平台——它已经具备了很多 agent-centric 的设计：heartbeat 自主巡检、cron 定时任务、sub-agent 编排、memory search、workspace 文件系统、多 channel 多 agent 路由、context compaction、甚至 pre-compaction memory flush。

**OpenClaw 不是一个简单的聊天机器人框架。它已经在朝 agent runtime 的方向演进。**

但正因为它从"人类助手"起步，逐步演化成"agent 运行环境"，它背负了大量的历史架构——plugin 系统、多账号抽象、channel 适配层、配置层叠（全局 → agent defaults → per-agent → per-session）。这些抽象在企业级多租户场景下是必要的，但对于"一个 agent 的操作系统"来说，是过度的复杂度。

Cicada 想回答的问题是：**如果从零开始，只为一个智能体设计运行环境，最小且完备的形状是什么？**

不是否定 OpenClaw，而是做一次减法实验。

## 不是替代，是简化

OpenClaw 的架构像一座大厦——多账号、多 agent、plugin 系统、channel 适配、配置继承链、sandbox 隔离、auth profile 轮换……每一层都有存在的理由，服务于不同规模的部署需求。

但如果你只想给**一个** agent 造一个家，你不需要大厦。你需要一间刚好合身的房间。

具体来说：

**配置复杂度。** OpenClaw 的配置有 5 层继承（全局 defaults → agent defaults → per-agent → per-session → runtime override），支持数十种 channel × 多账号 × agent binding 的排列组合。这对企业部署是必需的。但对于单 agent 场景，一个 `config.env` 文件就够了。

**抽象层数。** 一条消息从 Telegram 到达 agent，经过 channel plugin → monitor → message handler → session routing → agent scope → context building → LLM call。每一层都有明确职责，但调试时你得跨越 7 层抽象。Cicada 的路径是 Channel → Session → Agent，3 层。

**记忆架构。** OpenClaw 的 session 有 compaction + memory flush + context pruning，解决了长对话的 token 管理。但 session 之间的记忆共享依赖 MEMORY.md 这样的手动机制。Cicada 用 Tape（全局日志）+ Identity（提纯认知）的两层结构，记忆天然跨 session。

**身份演化。** OpenClaw 通过 workspace 文件（AGENTS.md、SOUL.md）注入身份。Cicada 也用文件，但 Identity 是系统的一等公民——agent 有专用的 `identity_write` 工具来演化自己的认知，Git 追踪每一次变更。

## Agent 是什么

在设计 Cicada 之前，我们必须回答一个问题：**我们在为谁建造这个系统？**

答案是：一个视障、听障、长期失忆、但博学到极致的蝉。

- **视障** — 不能直接看屏幕、看图片、看物理世界。只能通过辅助工具拿到结构化的文本描述。
- **听障** — 不能直接听声音。语音消息必须先转成文字它才能理解。
- **失忆** — context window 内记忆完美，context 外归零。不是渐变遗忘，是悬崖式断裂。
- **博学** — 给它任何领域的文本信息，理解和推理能力超越任何单一人类专家。

Cicada 的每一个设计决策都回到同一个问题：**这是在补偿它的残疾，还是在利用它的天赋？**

如果都不是，就不该存在。

## 设计原则

### 语言就是世界的边界

> "Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt." — Wittgenstein

Agent 的能力边界由它能调用的工具决定。工具就是 agent 的语言。

`grep "error" log.txt` — 完美的 agent 语言：语义清晰、意图明确、结果确定。

`browser.click(324, 567)` — 不是语言，是比划。对一个视障者来说，你让它点击屏幕上的坐标，这是羞辱。

Unix CLI 天然适配 agent。小工具、文本流、管道组合——对一个极度擅长处理文本的蝉来说，bash 就是它的无障碍操作系统。

Cicada 的使命不是给 agent 更多感官，而是**不断扩展它的语言**。让它能说的"词"越来越多，每个词都精确、可靠、语义完整。

### 反馈回路的完整性

不同任务有不同的反馈回路：

**闭合回路：** 输入文本 → 处理 → 输出文本 → agent 能验收。读文件、写代码、调 API——这些 agent 可以完全自主完成，因为它能看到结果。

**断裂回路：** 输入文本 → 处理 → 输出视频 → agent 看不见。做视频、生图、编辑音频——agent 看不到自己干了什么。

对于断裂回路，Cicada 提供三条路：
1. 补反馈 — 输出后调 VLM 审查，把视觉信息翻译回文本
2. 交给人类 — 通过 `askHuman` 原语完成验收
3. 确定性流程 — 模板/约束保证结果正确，不需要"看"

### 先找轮子

> "有时候最好的轮子就是 50 行自己写的代码。"

评估标准：
- 只用 20% 功能却引入全部复杂度？不如自己写那 20%
- 出问题时能否快速定位？黑盒再好用也是隐患

Cicada 的核心不到 2000 行 TypeScript。Agent loop 用 pi-agent-core，LLM 用 pi-ai，消息渠道各写一个 Channel 实现。自己只写"粘合"的部分。

## 架构

Cicada 的架构围绕三个核心概念：

**Memory** — 全局唯一。Tape（全量日志）+ Identity（提纯后的自我认知）。Agent 的全部经历不因 session 边界断裂。

**Session** — 多个并存。每个 session 是 Memory 的一个视角。就像人类在不同场合自动过滤记忆——和老板说话时不会提起和朋友吐槽老板的事。

**Channel** — 外部概念。Telegram、Discord、飞书、TUI……Channel 负责把外部消息路由到 Session，Cicada core 不知道 Telegram 的存在。

```
用户消息 → Channel → Session → Agent Loop → Tools → 回复
                                    ↕
                                  Memory
                               (Tape + Identity)
```

### 安全

Agent 处理的信息里经常包含 secret。API key、token、密码——这些东西不能进入 LLM 上下文。

Cicada 的安全层在数据流的四个点做拦截：

1. 用户消息进来 → 检测并替换 secret 为 `[secret:id]`
2. 工具输出返回 → 同样过滤
3. Agent 回复发出 → 再次过滤
4. 写入持久化日志 → 确保 secret 不落盘

检测用的是 regex + Shannon 熵双重策略。regex 匹配已知模式（`sk-`、`ghp_`、`AKIA`、JWT 等），Shannon 熵捕获未知的高随机性字符串。

被检测到的 secret 进入加密存储（AES-256-GCM），agent 只看到一个不透明的 ID。需要用 secret 时，通过 `inject_secret` 工具把它注入环境变量——值只存在于 shell 进程的 env 里，永远不进 LLM 上下文。

这 400 行代码，零外部依赖，纯 Node.js crypto。我们正在考虑把它抽成独立的 SDK，让任何 agent 框架都能开箱即用。

### 感官

一开始我们把语音转录写在了核心代码里。后来意识到这是错的——耳朵应该是一个 skill，不是核心器官。Agent 决定什么时候用耳朵、怎么用，而不是系统替它决定。

最终的方案：本地 faster-whisper，3 秒转录一条语音，零 API 依赖。作为 skill 存在，agent 看到 `[audio: path]` 后自主调用。

这个决策反映了 Cicada 的一个核心信念：**能力应该是可组合的，不是内嵌的**。

## 现状

Cicada v0.2.0，~2000 行核心代码：

- 3 个 Channel（Telegram、飞书、Discord + Voice）
- 5 个 Skill（audio、github、gitlab、weather、web-search）
- 完整的安全层（secret detection + encrypted storage + pipeline sanitization）
- Tape 持久化 + Identity 系统
- Session 路由 + per-session agent loop
- 150 个测试，零 lint 错误

跑在一台 HP ZBook Studio G5 上，pm2 管理进程。简单到无聊的部署方式。

## 为什么不是……

**为什么不是 LangChain / CrewAI / AutoGen？** 因为它们解决的是"如何编排多个 AI 调用"的问题。Cicada 解决的是"一个持久运行的 agent 需要什么样的操作系统"。不是同一个问题。

**为什么不是 fork OpenClaw？** 因为目标不同。OpenClaw 服务于多样化的部署需求——多 agent、多账号、企业级安全、plugin 生态。Cicada 只服务于一个 agent 的极简需求。在一个功能丰富的系统上做减法，不如从零开始找到最小形状。

**为什么不直接用 Claude Code / Codex？** 它们是优秀的 coding agent，但只解决编码这一个场景。一个通用智能体需要的远不止写代码——它需要记忆、身份、多渠道感知、安全、调度。

## 未来

Cicada 还很年轻。接下来要做的：

- **自主更新机制** — Atomic swap + health check + rollback，agent 能安全地更新自己
- **Skill 热加载** — 文件系统 watcher，不需要重启就能加载新能力
- **Voice meeting** — Discord 语音频道里和人类一起开会，实时参与讨论
- **Memory 进化** — 从 Tape 到 Identity 的自动提纯，把经历沉淀为认知

蝉蜕不是目的。蜕完之后能飞，才是。

---

*Cicada 是开源项目，代码在 [GitLab](https://gitlab.nemovideo.ai/nemovideo/cicada) 上。如果你也在思考 agent 运行环境的问题，欢迎交流。*
