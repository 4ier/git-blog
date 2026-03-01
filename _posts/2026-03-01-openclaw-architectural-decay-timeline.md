---
layout: post
title: "从 288 行到 288,000 行：OpenClaw 的 98 天架构腐败史"
date: 2026-03-01
categories: [ai-agent]
tags: [openclaw, architecture, software-engineering, agent-infrastructure]
---

一个 242K star 的项目，98 天从优雅工具长成 288K 行巨兽。我深入分析了它的代码库、commit 历史和社区结构，试图回答一个问题：**作为一个重度依赖者，我是否应该继续把自己的 AI agent 基础设施建立在它之上？**

![Header](/git-blog/public/openclaw-decay-header.jpg)

<!-- more -->

## 起因

我从 2026 年 2 月开始使用 OpenClaw 作为 7×24 运行的个人 AI agent 的基础设施。两个月的深度使用中，我反复遇到一些核心问题——cron 任务跨 run 失忆、session 每日 4:00 AM 轮转导致上下文丢失、配置行为在版本间悄悄变化。

这些不是边缘 case。对于一个号称"让 AI agent 持续运行"的平台来说，持久记忆和定时任务是最基本的需求。

我曾经的预设是：OpenClaw 有 242K star、每天发版、社区活跃，这些问题迟早会被解决。但最近我决定打开引擎盖看看里面到底是什么。

## 基本面

先放数据：

| 指标 | 数值 |
|------|------|
| 首次 commit | 2025-11-24 |
| 项目年龄 | 98 天 |
| 总代码 | 288K 行 TypeScript |
| 测试代码 | 351K 行 (比源码还多) |
| 总 commit | 16,613 次 |
| 直接依赖 | 57 个 |
| 配置 schema 调用 | ~1,277 个 |
| Legacy migration | 40K+ 行 |
| Open issues | 9,886 |
| Contributors | 30 人 |
| 核心贡献者 (steipete) | 69% commit |

## 四纪演化

### 第一纪：warelay (11.24 - 12.01)

```
287/288 commits = steipete (100%)
```

最初叫 warelay，是一个 WhatsApp + Claude 的 CLI 工具。极简、优雅、一个人用。这个阶段的代码和需求高度匹配。v0.1.1 的 changelog 只有 4 行，每行都是用户可感知的功能。

### 第二纪：clawdis 2.0 beta (12.09 - 01.03)

```
Gateway (12.09) → Cron (12.13) → Discord (12.26) → macOS/iOS app
```

**这是关键转折点。** v2.0.0-beta1 一次性引入了 WebSocket Gateway、macOS companion app、iOS node、Cron 子系统。从 CLI 工具直接跳到了分布式 agent 平台。

经典的 second system effect：对第一版成功的信心催生了过大的第二版野心。Gateway + Node + Channel 的分布式架构从诞生起就是为 steipete 的 macOS 生态设计的，后来所有 channel 的接入都是在这个框架上硬接。

### 第三纪：通道爆炸 (01.04 - 01.30)

```
Slack (01.04) → Subagent (01.07) → Matrix (01.15) → ACP (01.18) → Nostr (01.20)
steipete 占比从 98% 降至 67%
```

两周 commit 量从 1,039 跳到 3,429。社区 PR 涌入，但几乎都是新 channel adapter。核心模块（session, cron, memory, agents）仍然只有 steipete 一个人碰。

### 第四纪：复杂度失控 (02.01 - now)

```
02.01-02.15: steipete 首次低于 50% (47%)
02.15-03.01: 历史最高 5,166 commits/双周
```

最近的 release notes 充斥着这样的 fix：

- "prevent destructive double-compaction"
- "suppress NO_REPLY sentinel text leaking into user channels"
- "stop unbounded sendChatAction retry loops that can trigger Telegram abuse enforcement and bot deletion"
- "harden lane draining with guaranteed draining flag reset on synchronous pump failures"

**commit 量最高的时期，不是在做新功能，是在修自己。**

## 代码层面的腐败信号

### agents/ 模块：134K 行

一个目录占了全部代码的 47%。文件名本身就是腐败的证据：

```
auth-profiles.cooldown-auto-expiry.test.ts
pi-embedded-runner.run-embedded-pi-agent.auth-profile-rotation.test.ts
isolated-agent.delivers-response-has-heartbeat-ok-but-includes.test.ts
```

这些不是清晰抽象的产物，是无限 patch 的沉淀物。

### 配置层：37K 行 + 40K 行 migration

34 个 config type 文件，1,277 个 zod schema 调用。三个 legacy migration 文件累计 40K+ 行——意味着配置 schema 经历了多次 breaking change，每次都选择了追加兼容层而非重新设计。

### Cron 执行模型的根本缺陷

看了 `cron/isolated-agent/run.ts`（701 行），找到了我遇到的 cron 失忆的根因：每次 cron run 创建一个全新的 isolated session，`contextMessages` 只是把前几条消息塞进 prompt 的 hack，不是真正的跨 run 持久记忆。

这不是 bug，是 architectural limitation。在当前架构下修这个，意味着重新设计 session 生命周期——这会影响所有 channel 的所有用户。

## Bus Factor

```
steipete: 11,502 commits (69%)
vignesh07:   404 commits (2.4%)
obviyus:     298 commits (1.8%)
其他 27 人:  4,409 commits (26.8%)
```

表面上社区参与度在提升（steipete 占比从 100% 降到 47%），但社区贡献几乎全在 channel adapter 和文档层。**核心架构的 bus factor 仍然是 1。**

9,886 个 open issue、零个 milestone。没有战略性的版本规划，全是 reactive 的 patch。

## "Agent 写的代码不需要人类维护" 论

有一种乐观观点：steipete 大量使用 coding agent 完成这些代码，未来软件工程的范式会变——代码不再需要像传统那样精心组织，而是像有机体一样臃肿但快速进化。

这个观点的正确之处在于：代码生产的边际成本确实趋近于零。一个人 + agents 在 98 天写出 288K 行，这在两年前不可能。

但它忽略了一个根本问题：**bug 的发现成本和修复成本随系统复杂度超线性增长，这跟代码是谁写的无关。** coding agent 写 fix 很快，但定位"cron session 的状态泄漏到另一个 channel 的 delivery queue"这种跨模块涌现行为，仍然超出当前 agent 的能力边界。

OpenClaw 最近两周的 commit 历史本身就是反例——5,166 次 commit 中大量在修 regression，说明 agent 写的 fix 本身在产生新的 edge case。

**有机体的优势在于小有机体。细菌比大象进化快。**

## 结论

OpenClaw 不会"死"。242K star、每天发版、社区能维持 channel 层面的扩展。但：

1. **核心架构改进的窗口已经关闭。** 288K 行代码 + 242K 用户 = 无法承受 breaking refactor。
2. **我遇到的核心问题（cron 持久记忆、session continuity）是 by design 的 limitation**，不是待修的 bug。
3. **未来一年大概率路径**：继续膨胀、继续加 channel/provider、open issues 从 9,886 涨到 20,000+。

对我来说，答案逐渐清晰：**构建一个更小的、只解决自己实际问题的 agent runtime。** 不是"类 OpenClaw"，是"Fuyang 的 agent 基础设施"。核心需求只有四个：LLM 调用 + 工具执行 + 持久记忆 + 定时任务。这些用 2,000 行代码可以比 OpenClaw 的 288K 行做得更好——因为它只需要做对一个人的场景。

讽刺的是，无论你持乐观还是悲观立场，结论都指向同一个方向：**做一个更小的东西。**
