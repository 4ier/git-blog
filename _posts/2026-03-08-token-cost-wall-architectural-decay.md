---
layout: post
title: "Token 成本墙：架构腐烂如何杀死 AI 驱动的软件进化"
date: 2026-03-08
categories: [ai-agent]
tags: [openclaw, architecture, software-engineering, token-economics, regression]
---

![Header](/git-blog/public/token-cost-wall-header.jpg)

上周我写了 [OpenClaw 的 98 天架构腐败史](/git-blog/ai-agent/2026/03/01/openclaw-architectural-decay-timeline/)，论证了 288K 行代码库的结构性问题。这周我拿到了实证：**一次版本升级引发了跨模块的连锁崩溃，而对源码的依赖图分析揭示了一个精确的机制——耦合密度决定了 bug 修复的 token 成本增长阶。**

<!-- more -->

## 核心论点

修复一个 bug 所需的 LLM token 消耗，取决于 agent 必须加载多少上下文才能理解因果链。在模块边界完整的系统中，这个成本是多项式增长的。**但当架构腐烂导致模块边界消融，参与隐式耦合的子系统数量的组合爆炸使成本趋近指数增长。** 当 token 成本触达不可承受的阈值，软件停止进化。

这不是推断。以下全部基于 OpenClaw 源码的静态分析和 GitHub issue 数据。

## 耦合结构的演化：从 10 个模块到 49 个节点的完全图

我对 OpenClaw 源码的 `src/` 目录做了跨模块 import 分析。以下是架构随时间变化的硬数据：

### 规模膨胀

| 版本 | 时间 | src/ 子模块数 | 非测试 .ts 文件数 |
|------|------|:---:|:---:|
| v0.1.1 | 2025-12 | 10 | 46 |
| v2026.1.15 | 2026-01 | 56 | 1,265 |
| v2026.2.1 | 2026-02 | 69 | 1,621 |
| v2026.2.15 | 2026-02 | 66 | 1,982 |
| v2026.3.1 | 2026-03 | 69 | 2,460 |
| v2026.3.7 | 2026-03 | 72 | 2,816 |

3 个月，模块数 7x，文件数 61x。

### 当前耦合图（v2026.3.7 实测）

对当前 `src/` 的 2,816 个非测试 .ts 文件做了跨模块 import 解析：

```
活跃模块:  49
有向依赖边: 492
最大可能边: 2,352
耦合密度:  20.9%
双向依赖对: 90
```

**20.9% 的耦合密度意味着什么？** 在一个 49 节点的有向图中，随机取两个模块，有超过 1/5 的概率存在直接依赖。这已经不是稀疏图。

### Hub 模块：爆炸半径

| 模块 | 被依赖(fan-in) | 依赖(fan-out) | 爆炸半径(in×out) |
|------|:---:|:---:|:---:|
| config | 41 | 18 | **738** |
| infra | 38 | 19 | **722** |
| agents | 26 | 22 | **572** |
| gateway | 15 | 25 | **375** |
| channels | 25 | 15 | **375** |
| plugin-sdk | 12 | 28 | **336** |

`config` 被 49 个模块中的 41 个依赖，同时自身依赖 18 个模块。改动 `config` 中的任何接口，**理论上可以影响 738 条传递路径**。`infra` 同理。

这两个模块是整个系统的"上帝对象"。而 #39010 的根因正是 `dedup/session` 基础设施的变更——它藏在 `infra`/`channels` 的共享层中。

### Channel 间的隐式耦合

每个 channel 理论上是独立的——Telegram、Discord、Slack 不应该互相影响。但实际上：

```
telegram ↔ discord:  10 个共享依赖
telegram ↔ slack:    10 个共享依赖
telegram ↔ signal:   11 个共享依赖
telegram ↔ line:     10 个共享依赖
discord  ↔ slack:     9 个共享依赖
```

Telegram 直接依赖 **21 个**其他模块，其中 15 个是被 10+ 模块共享的基础设施。**这就是为什么一个"飞书功能 PR"能炸掉 Telegram**——它们共享 `routing`、`channels`、`infra`、`config`、`auto-reply` 等 10+ 个底层模块。

### 双向依赖：最紧的耦合

90 对双向依赖意味着大量的循环依赖。仅 `agents` 模块就和 **13 个**其他模块存在双向依赖：

```
agents ↔ infra, auto-reply, config, utils, security,
         plugins, channels, media, cli, routing,
         gateway, providers, hooks
```

`agents` 既依赖 `channels`，`channels` 又依赖 `agents`。这不是分层架构，**这是一团意大利面**。

## Case Study：#39010 — 耦合图上的实际传播路径

2026 年 3 月 7 日，升级到 2026.3.2 后出现两条**完全无关的核心功能崩溃**：

**死亡链 A**：Telegram 消息每 30 分钟重放一轮，~20 条旧消息在 4+ 个 session 中无限循环。**死亡链 B**：飞书 Topic 群组回复静默失败，0% 投递成功率（升级前 89.4%，回滚后 100%）。

根因追溯到同一个 PR：[#29575](https://github.com/openclaw/openclaw/pull/29575)（Feishu group broadcast dispatch），改动了 `dedup/session` 共享基础设施。

在依赖图上，传播路径清晰可见：

```
PR #29575 (feishu broadcast)
  → channels/dedup (共享基础设施)
    → telegram/offset-管理 (死亡链 A)
    → feishu/topic-routing  (死亡链 B)
```

**这不是意外。耦合密度 20.9% 的系统中，任何对共享层的改动都有 ~1/5 的概率传播到另一个模块。**

## Regression 数据：从 7.7% 到 20.9%

以下是从 GitHub issue 数据统计的 regression 率演化：

| 时期 | 新开 issues | 含 regression 的 | Regression 率 |
|------|:---:|:---:|:---:|
| 2025-12-01 | 13 | 1 | 7.7% |
| 2026-01-01 | 270 | 28 | 10.4% |
| 2026-01-15 | 1,652 | 53 | 3.2% |
| 2026-02-01 | 5,730 | 374 | 6.5% |
| 2026-02-15 | 5,838 | 835 | **14.3%** |
| 2026-03-01 | 2,810 | 587 | **20.9%** |

1 月中旬 regression 率一度降到 3.2%——那恰好是社区 PR 大量涌入的时期，新功能（channel adapter）多，改动集中在叶子模块，不触及核心。

但从 2 月起，regression 率持续攀升到 **20.9%**——每 5 个新 bug 中就有 1 个是"修了 A 炸了 B"。这和耦合密度 20.9% 形成了**惊人的数值巧合**：**regression 率 ≈ 耦合密度**。

直觉上这说得通：如果一次改动有 20.9% 的概率传播到另一个模块，那 20.9% 的 bug 是 regression 就是统计必然。

## Token 成本的增长阶：严格分析

### 模型

设 $n$ = 参与耦合的模块数，$d$ = 因果链深度，$k$ = 每步分叉数。

定位一个跨模块 bug，agent 需要沿因果链回溯。搜索空间：

$$T_{locate} \propto k^d$$

**关键问题：$d$ 和 $k$ 怎么随系统增长？**

- **良好架构**（稀疏耦合）：$k \approx 1$, $d \approx O(1)$。定位成本 $O(1)$。
- **腐烂架构**（密集耦合）：$k$ 和 $d$ 都随 $n$ 增长。

OpenClaw 的实际因果链：

| Bug | 因果链深度 $d$ | 分叉数 $k$ | 搜索空间 |
|-----|:---:|:---:|:---:|
| 早期 CLI bug | 1-2 | 1 | ~2 |
| #32106 compaction | 3 | 2 | ~8 |
| #39010 replay storm | 3 | 2-3 | ~12-27 |
| #39798 kimi crash | 4 | 2 | ~16 |
| #39609 context collapse | 5 | 2 | ~32 |

### 增长阶取决于耦合结构

**"指数增长"不是无条件成立的。** 更精确的表述：

- **稀疏耦合图**（每个模块只和固定几个模块耦合）：$d$ 和 $k$ 有上界，token 成本 $O(n \log n)$ 到 $O(n^2)$ — **多项式**。
- **密集耦合图**（任何模块都可能影响任何模块）：$k$ 随参与交互的子系统数增长，$k^d$ 趋近 $O(2^n)$ — **指数**。

OpenClaw 处于哪种状态？数据说话：

- 耦合密度 20.9%（接近完全图的 1/5）
- 90 对双向依赖（循环耦合）
- Top 3 hub 模块爆炸半径 > 500
- Channel 间共享 10+ 个底层依赖

**这不是稀疏图。** config/infra/agents 三个 hub 节点使几乎所有模块间接相连。当 hub 被改动时（#39010 正是这种情况），影响范围不是"邻居"，而是"全图"。

在这种结构下，$k$ 随系统增长而增长，token 成本趋近指数。

### 实测 token 消耗

| 项目阶段 | 代码行数 | 估算 token/fix | 增长比 |
|---------|:---:|:---:|:---:|
| v0.1 (CLI) | ~1K | ~5K | 1x |
| v2026.1 (Gateway) | ~50K | ~30K | 6x |
| v2026.2 (Channel爆炸) | ~200K | ~100K | 20x |
| v2026.3 (当前) | ~288K | ~500K+ | 100x+ |

代码量增长 288x，修复成本增长 **100x+**。如果是线性关系，应该只增长 288x / 10 ≈ 30x（因为大部分新代码是独立的 channel adapter）。实际增长远超线性，原因正是跨模块耦合的组合效应。

## 为什么 AI Agent 救不了这个

### 1. 上下文 ≠ 理解

把 6,000 行代码塞进 1M context window 和**理解这 6,000 行代码之间的隐式耦合**是完全不同的事。#39010 的根因是 `channels/dedup` 的行为变化传播到 `telegram/offset`——这种耦合不在任何显式接口声明中，只存在于运行时的状态共享中。

当前最强的 coding agent 在 SWE-bench 上修复**模块内 bug** 表现出色。但 #39010 这类跨模块涌现 bug 的成功率急剧下降——因为根因不在任何单个文件里。

### 2. Fix 制造新的 fix

#39798 完美演示：v3.7 为修 Copilot Claude 的 thinking signature 问题，把 `preserveSignatures` 从 `false` 改成 `isAnthropic`。修好了 Claude，炸掉了 kimi-coding——因为 kimi 也用 `modelApi: "anthropic-messages"` 但不能处理 signature。

**每一轮修复需要加载更多上下文**（理解前几轮修了什么），token 消耗逐轮递增。Regression 率 20.9% 意味着每 5 个 fix 产生 1 个新 bug。这是正反馈循环。

### 3. Token 价格下降追不上复杂度增长

```
成本 = token_price × tokens_per_fix

token_price:    线性下降 (摩尔定律，~2x/18个月)
tokens_per_fix: 指数上升 (耦合密度驱动的组合爆炸)
```

在 OpenClaw 的时间尺度上：3 个月内 token/fix 从 5K 增长到 500K+（100x）。同期 token 价格下降了多少？大约 30-50%。**指数 > 线性。**

## 软件的热寂

OpenClaw 的 open issues 增长：

```
02-01:  ~6,000
02-15:  ~8,000
03-01:  ~9,886
03-08: ~10,875
```

6 周 +80%。Stars 同期从 242K 涨到 278K（+15%）。**用户增长 15%，问题增长 80%。** 问题积累速度是用户增长的 5 倍。

这就是"软件热寂"：**投入越来越多的能量（commits 创历史新高），但熵的增长速度更快（regression 率持续上升）。** 当修复成本超过容忍阈值，理性选择是停止修复，只做表面维护。项目变成 zombie：持续收 star、持续发版、核心问题永远不被解决。

## 结论

1. **耦合密度决定了 token 成本的增长阶。** OpenClaw 当前 20.9% 的耦合密度和 90 对循环依赖，使其处于"密集耦合"状态——token 成本趋近指数增长。
2. **Regression 率和耦合密度数值上趋同（均为 ~20.9%）。** 这不是巧合——耦合密度就是"一次改动传播到其他模块"的概率。
3. **AI agent 加速了代码生产，同时加速了熵积累。** 98 天 288K 行 = 传统项目 5 年的技术债在 3 个月到期。
4. **"指数增长"不是修辞，是耦合图结构的数学后果。** 稀疏耦合 → 多项式；密集耦合 → 指数。OpenClaw 的数据证明它处于后者。

**你的 agent 写代码越快，你就越需要一个更严格的架构师。** 否则你不是在建软件，是在用 GPU 算力加速制造一个未来没有任何 agent 能修的系统。

---

*这是 OpenClaw 系列的第二篇。第一篇：[从 288 行到 288,000 行：OpenClaw 的 98 天架构腐败史](/git-blog/ai-agent/2026/03/01/openclaw-architectural-decay-timeline/)*

*数据来源：OpenClaw v2026.3.7 源码静态分析（跨模块 import 解析），GitHub Issues API（issue/regression 计数），作者实际运行 OpenClaw 的 incident report（[#39010](https://github.com/openclaw/openclaw/issues/39010)）。分析代码和原始数据可在 [4ier/openclaw-analysis](https://github.com/4ier) 获取。*
