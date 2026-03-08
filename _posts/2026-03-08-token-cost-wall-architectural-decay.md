---
layout: post
title: "Token 成本墙：架构腐烂如何杀死 AI 驱动的软件进化"
date: 2026-03-08
categories: [ai-agent]
tags: [openclaw, architecture, software-engineering, token-economics, regression]
---

![Header](/git-blog/public/token-cost-wall-header.jpg)

上周我写了 [OpenClaw 的 98 天架构腐败史](/git-blog/ai-agent/2026/03/01/openclaw-architectural-decay-timeline/)，论证了 288K 行代码库的结构性问题。一周后，我有了一个更具体的实证：**一次版本升级引发了跨模块的连锁崩溃，而修复它所需的 token 消耗，揭示了 AI 时代软件工程的真正瓶颈。**

<!-- more -->

## 核心论点

随着架构腐烂，修复一个 bug 所需的 **LLM token 消耗会指数增长**——不是因为 bug 本身复杂，而是因为 agent 必须加载越来越多的上下文才能理解 bug 的跨模块因果链。当 token 成本触达不可承受的阈值，软件就停止进化。

这不是理论。以下是实证。

## Case Study：#39010 — 一次升级，两条死亡链

2026 年 3 月 7 日，我把 OpenClaw 从 2026.2.23 升级到 2026.3.2。升级后出现两个**完全无关的核心功能崩溃**：

### 死亡链 A：Telegram 消息重放风暴

升级数小时后，已处理的 Telegram 消息开始每 30 分钟重放一轮。~20 条旧消息在 4+ 个 session 中无限循环，`maxConcurrent` 槽位被耗尽，新消息完全被阻塞。重启 gateway 不但不修复，反而触发新一轮重放。

**唯一的恢复方式**：手动调用 Telegram `getUpdates(offset=last_id+1)` 刷新服务端状态 + 清理全部受污染的 session + 回滚版本。

### 死亡链 B：飞书 Topic 群组回复静默失败

同一次升级后，飞书 Topic 群组的回复投递**静默失败**——agent 正常处理、日志无错误、但消息不到达用户。DM 不受影响。

数据对比：
- 升级前 142 个 session，89.4% 投递成功
- 升级后 4 个 session，0% 投递成功
- 回滚后 4 个 session，100% 投递成功

### 根因指向同一个 PR

两条死亡链追溯到同一个 PR：[#29575](https://github.com/openclaw/openclaw/pull/29575)（Feishu group broadcast dispatch）。名义上是飞书功能，实际改动了底层的 **dedup/session 隔离机制**——Telegram 的 `getUpdates` offset 管理和飞书的 topic 投递路由都依赖这个基础设施。

**一个"飞书功能 PR"炸掉了 Telegram。** 这就是架构腐烂的典型症状：模块边界已经不存在了。

## 不是孤例：Regression Cascade

#39010 不是偶发事件。以下是 OpenClaw 最近 6 周的 regression 清单，每一条都是**版本升级引发的跨模块崩溃**：

| Issue | 版本 | 症状 | 跨模块因果链 |
|-------|------|------|-------------|
| [#39010](https://github.com/openclaw/openclaw/issues/39010) | 3.2 | Telegram 消息无限重放 + 飞书投递失败 | Feishu broadcast → dedup → Telegram offset |
| [#33854](https://github.com/openclaw/openclaw/issues/33854) | 3.3 | Telegram topic 回复间歇性丢失 | Draft finalization → preview boundaries → delivery |
| [#32106](https://github.com/openclaw/openclaw/issues/32106) | 3.1 | 所有 agent 每 2-3 分钟强制 compaction | Memory flush threshold → compaction trigger → session lifecycle |
| [#39798](https://github.com/openclaw/openclaw/issues/39798) | 3.7 | kimi-coding 第二轮对话崩溃 | transcript-policy `preserveSignatures` → Anthropic API 兼容层 → 第三方 provider |
| [#39609](https://github.com/openclaw/openclaw/issues/39609) | 3.2 | 长期 session 上下文静默坍塌至 30k | compaction wait → parentId 丢失 → orphan branch → SessionManager 选错叶节点 |
| [#39620](https://github.com/openclaw/openclaw/issues/39620) | 3.7 | Token 用量显示 unknown | usage payload 格式变更 → context engine → status display |

注意模式：**每个 bug 的根因和表现跨越 2-3 个模块**。没有一个能通过只看报错信息定位。

今天（3 月 8 日），repo 的 open issues 已达 **10,875**——一周前我写上篇文章时是 9,886。一周增长 ~1,000。

## Token 成本墙

现在来算账。

假设一个 AI coding agent 要修 #39010。它需要理解：

1. **Telegram polling 机制**：`getUpdates` 的 offset 语义、长轮询、消息去重（~500 行）
2. **Session/dedup 共享基础设施**：跨 channel 的消息去重逻辑（~2,000 行）
3. **飞书 broadcast dispatch**：#29575 改了什么、为什么改（~800 行 diff + PR context）
4. **飞书 topic 路由**：topic group 和 DM 的投递路径差异（~1,200 行）
5. **Gateway 重启行为**：restart 时各 channel 的状态恢复逻辑（~1,500 行）

保守估计 agent 需要加载 **~6,000 行代码 + ~2,000 行 PR/issue context** 才能定位根因。按 TypeScript 平均 3 token/行算，仅上下文加载就是 **~24K token**。加上推理链（chain-of-thought 通常 3-5x 于输入），一次修复尝试消耗 **~100K token**。

而且第一次大概率修不对——#39798 的报告者就提到自己打了 **4 个 runtime patch** 才 workaround。

对比项目早期：v0.1 时代的 bug，agent 加载 500 行代码就能定位和修复。token 消耗 ~5K。

```
项目规模    修复一个跨模块 bug 的 token 消耗（估算）
─────────────────────────────────────────────
1K 行       ~5K tokens    (模块内，因果链短)
10K 行      ~20K tokens   (2-3 个文件)
100K 行     ~100K tokens  (跨模块，需理解架构)
288K 行     ~500K+ tokens (跨模块 + 历史决策 + migration 层)
```

**这不是线性增长，是超线性的。** 因为每增加一个模块，潜在的跨模块交互数量呈组合爆炸增长。288K 行代码中有 57 个直接依赖、34 个 config type、1,277 个 schema 调用——agent 必须理解的"隐式接口"数量远超代码行数所暗示的。

## 为什么 AI Agent 救不了这个

直觉说：token 便宜，模型越来越强，context window 越来越大。所以这个成本墙会被推倒。

这个推理忽略了三件事：

### 1. 上下文 ≠ 理解

把 6,000 行代码塞进 1M context window 和**理解这 6,000 行代码之间的隐式耦合**是完全不同的事。#39010 的根因是一个飞书 PR 意外改变了 Telegram 的去重行为——这种跨模块的**涌现性 bug** 需要的不是更大的 window，是对系统整体架构的心智模型。

当前最强的 coding agent 在修复**模块内 bug** 时表现出色（SWE-bench 上的成绩证明了这点）。但对于**跨模块涌现 bug**，它们的成功率急剧下降——因为这类 bug 的根因不在任何单个文件里。

### 2. Fix 会制造新的 fix

#39798 完美演示了这个循环：v3.7 为了修 Copilot Claude 的 thinking signature 问题，把 `preserveSignatures` 从 `false` 改成了 `isAnthropic`。这修好了 Claude，但炸掉了所有使用 Anthropic API 格式的第三方 provider（kimi-coding）。

修 A 的 fix 引入了 B 的 regression。修 B 的 fix 可能引入 C。每一轮修复都需要加载更多上下文（因为要理解前几轮修了什么），token 消耗逐轮递增。

这就是热力学第二定律在软件中的体现：**系统的熵只增不减，除非你投入外部能量（重构）来降低它。** Patch 不降熵，patch 增熵。

### 3. 成本的地板在上升

即使单次 token 价格持续下降，**每个 bug 需要的 token 数量** 在指数上升。当 token 单价的线性下降追不上 bug 复杂度的指数上升，你就撞墙了。

```
成本 = token_price × tokens_per_fix

token_price: 线性下降 (摩尔定律)
tokens_per_fix: 指数上升 (架构复杂度)

指数 > 线性。永远。
```

## 软件的热寂

OpenClaw 的 open issues 增长曲线：

```
02-01:  ~6,000
02-15:  ~8,000
03-01:  ~9,886
03-08: ~10,875
```

6 周增长 ~80%。而 commit 数量同期也在创历史新高——**投入越来越多的能量，但熵的增长速度更快。**

这就是我说的"软件热寂"：当修复 bug 的成本超过 bug 带来的用户流失成本时，理性选择是**停止修复，只做表面维护**。项目不会死——它会变成一个 zombie：持续收 star、持续发版、但核心问题永远不被解决。

对于 AI 驱动的项目来说，这个阈值就是 **token 成本墙**：

> 当修复一个 regression 需要的 token 消耗超过了团队/个人的 API budget 阈值，软件就停止进化。

## 另一种叙事

反过来想：如果 OpenClaw 在第二纪就停下来——保持 10K 行、只做 WhatsApp + Claude——今天的每个 bug 可能 5 分钟就能修好。

这不是反对 AI 写代码。这是在说：**AI 降低了代码生产成本，但没有降低架构决策的成本。** 架构决策的后果以复利累积。agent 写 1,000 行 fix 只要 10 秒，但决定"这 1,000 行应该放在哪个模块、以什么接口暴露"仍然需要人类花 10 分钟想清楚。

当生产速度是思考速度的 60 倍，积累技术债的速度也是传统项目的 60 倍。

## 结论

上篇文章我说"做一个更小的东西"。这篇文章试图解释为什么更精确地说：

1. **架构腐烂导致 bug 修复的 token 成本指数增长。** #39010 是 288K 行代码库中一个飞书 PR 炸掉 Telegram 的实例——定位它需要加载 6,000+ 行跨模块代码。
2. **AI agent 加速了代码生产，但同时加速了熵的积累。** 98 天 288K 行 = 传统项目 5 年的技术债在 3 个月内到期。
3. **token 价格下降追不上 bug 复杂度的指数增长。** 这是数学，不是观点。
4. **软件不会死，但会停止进化。** 当修复成本超过容忍阈值，项目进入 zombie 模式。

这对所有 AI-first 项目都是警告：**你的 agent 写代码越快，你就越需要一个更严格的架构师。** 否则你不是在建软件，是在用 GPU 算力加速制造一个未来没有任何 agent 能修的系统。

---

*这是 OpenClaw 系列的第二篇。第一篇：[从 288 行到 288,000 行：OpenClaw 的 98 天架构腐败史](/git-blog/ai-agent/2026/03/01/openclaw-architectural-decay-timeline/)*

*作者运行一个基于 OpenClaw 的 7×24 AI agent（是的，用被分析对象的平台写分析被分析对象的文章，这本身就很后现代）。Issue [#39010](https://github.com/openclaw/openclaw/issues/39010) 由作者提交。*
