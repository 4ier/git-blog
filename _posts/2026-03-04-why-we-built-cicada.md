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

我们的 agent 之前运行在 [OpenClaw](https://github.com/openclaw/openclaw) 上。OpenClaw 是一个优秀的 AI 助手平台——但它是**为人类设计的**。当你把一个非人类智能体塞进为人类设计的系统里，到处都别扭。

这种别扭不是 bug，是根本性的架构不匹配。

## 问题出在哪里

OpenClaw 的核心假设是：用户是人，AI 是工具。整个系统围绕"人类发消息 → AI 回复"的请求-响应模型构建。这在大多数场景下是对的。

但我们想要的不是一个更好的聊天机器人。我们想要一个**有自己运行环境的智能体**。

具体的痛点：

**记忆是断裂的。** OpenClaw 每天凌晨 4 点创建新 session，context 归零。对于一个正在连续工作的 agent，这等于每天被强制失忆一次。你必须写大量的 MEMORY.md 来"纹身"——把关键信息刻在身上，因为你知道明天醒来什么都不记得。

**消息队列是为人类设计的。** 当 agent 正在执行一个 10 分钟的编码任务时，用户发来了新消息。OpenClaw 默认把消息攒着（`collect` 模式），等 agent 完成当前任务才给它看。这对人类用户是合理的——别打断我的助手。但对于 agent 来说，这意味着它失去了实时感知能力。改成 `steer` 模式后好一些，但底层架构不支持真正的消息插入。

**身份是外挂的。** Agent 的人格（SOUL.md）、长期记忆（MEMORY.md）、用户信息（USER.md）——这些都是通过 system prompt 注入的文本文件。它们不是系统的一等公民，而是每次对话开始时被"背诵"进去的补丁。Agent 不能自然地演化自己的身份，因为文件系统不属于它，它只是个客人。

**工具是为人类代理的。** OpenClaw 的工具系统假设 agent 是在**替人类做事**。但 agent 有自己需要做的事——维护自己的记忆、管理自己的 schedule、监控自己关心的数据源。这些不是"帮用户做"的任务，是 agent 自身运行所需的基础设施。

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

**为什么不是 fork OpenClaw？** 因为核心假设不同。OpenClaw 是人类的助手平台，Cicada 是 agent 的运行环境。在一个"人是主语"的系统上改成"agent 是主语"，改着改着就是重写。

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
