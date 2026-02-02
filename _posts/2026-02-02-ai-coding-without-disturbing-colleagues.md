---
layout: post
title: "如何不在深夜打扰同事问代码问题"
date: 2026-02-02
categories: [ai-coding]
tags: [Claude-Code, Codex, gh, glab, kubectl, AI, coding-agent]
---

这篇是我在使用 AI Coding 工具（Claude Code、Codex）过程中总结的实践经验，核心理念是：把代码仓 + 文档 + CLI 工具变成你的 24 小时 AI 同事。

![Boris's Claude Code Setup Cheatsheet](/git-blog/public/boris-claude-tips.jpg)

<!-- more -->

## 起点：Onboarding 的困境

深夜接手新项目，代码看不懂，同事已经睡了。翻飞书历史记录？效率太低。等明天问？deadline 不等人。

解法：**代码仓即知识库**。

## Part 1: gh/glab 把代码仓变成知识库

```bash
# GitLab: 查看 MR 讨论、代码变更历史
glab mr view 334 --comments
glab mr diff 334

# GitHub: 查看 PR、Issue 上下文
gh pr view 123 --comments
gh issue view 456

# 直接读取文件内容
gh api repos/org/repo/contents/src/xxx.py | jq -r '.content' | base64 -d
```

**nemo项目 实际案例：**

```
认真检视代码：https://gitlab.../merge_requests/334
```

AI 直接读取 MR diff 和 comments，不用手动复制粘贴。MR/PR 的讨论本身就是最好的设计决策文档。

## Part 2: Learning 模式加速认知

配置 Output Style 为 `Learning`，让 AI 不只给答案，还解释：

- 为什么这样设计
- 有哪些 trade-off
- 类似模式在哪里见过

快速建立对陌生代码库的认知。

## Part 3: 给足上下文再讨论

**反模式：**
```
帮我实现 XXX 功能
```

**正确姿势：**
```
参考这篇文章的设计思路：https://xxx
参考这个开源项目的实现：@github.com/xxx/yyy
当前代码结构：@docs/architecture.md

现在帮我设计 XXX 功能的方案
```

**nemo项目 实际案例：**

```
把这些确认过程，按照方案设计的思路，和现有的方案文档做合并
@docs/nemo-agent-skills/...

把这个知识补充到 @docs/fuy4n9-onboarding/02-state-sync-mechanism.md
```

AI 理解设计背景后，输出与现有文档风格一致。

## Part 4: Spec 先行

写代码前先和 AI 一起写 Spec 文档：

1. 确保逻辑自洽
2. 分解为最小交付单元
3. 文档即 Contract，AI 和人都能理解

**nemo项目 实际案例：**

```
project.json 的结构经过沟通是要做调整的，调整后的结构位于
@docs/nemo-agent-skills/...
```

先确认数据结构，再实现代码，避免返工。

## Part 5: Plan/Build 模式

无论 Claude Code 还是 Cursor：

- **Plan 阶段：** 探索代码库、设计方案、等待批准
- **Build 阶段：** 按计划实现、逐步验证

**nemo项目 实际案例：**

```
Implement the following plan:

# Sandbox 回调通道清理计划
## 目标
删除通道 B（遗留的 /callback/complete 设计），统一使用通道 A

# 验收条件
创建测试用例，并保证验证条件对齐设计规格，用例全部通过
```

避免 AI 盲目动手改代码。

## Part 6: 双模型协作

| 角色 | 模型 | 职责 |
|------|------|------|
| 写代码 | Claude Code Opus 4.5 | 规划、实现 |
| 检视/测试 | Codex GPT 5.2 | Code Review、Chrome MCP 测试 |

两个 AI「同事」互相 Review，提高代码质量。

**nemo项目 实际案例：**

- Claude Code: 实现 sandbox_tool 逻辑、写 gencut-skills 代码
- Codex: `认真检视代码：MR 334`、监听测试任务验证 e2e

## Part 7: 上下文管理

**踩坑经验：**

- MCP 工具过多 → 占用大量 Context
- Auto Compact 触发后 → 性能明显下降、丢失关键上下文

**nemo项目 真实对话：**

```
我这一次，务必要跑起来 sandbox_tool，请谨慎的帮我提前分析，
不想反反复复报错后再排查了，一次部署需要 10 几分钟呢
```

Context 断档后：

```
This session is being continued from a previous conversation
that ran out of context...
```

**建议：**

- 关闭 Auto Compact
- 时刻关注 Context 余量
  - Mac/Linux: `/statusline`
  - Windows: [ccstatusline](https://github.com/sirmalloc/ccstatusline)

## Part 8: Prompt 文档化

常用的 prompt 整理成文档：

```
@docs/nemo-agent-skills    # 技能开发规范
@docs/pr-review-checklist  # Code Review 清单
@docs/debug-guide          # 排查指南
```

随用随 `@`，不用每次重新描述。

## Part 9: 闭环 - 运维也能 AI

```bash
# 查看 Pod 日志
kubectl logs -f deployment/nemo-api -n production
```

**nemo项目 实际案例：**

```
sandbox_tool 报错，请你使用 kubectl 查询 backend 和 sandbox 日志，查找原因

使用 kubectl，查看 backend 和 sessionid 是 480503898646249472 的 sandbox，关注：
1. 有没有正确加载 skill
2. 等我在界面发了请求后，观察日志

我想在日志中看到详细的 agent 的提示词细节，例如生成 three-view 图片
```

从 Onboarding 到 Debug，全程不打扰同事。

## 总结

```
代码仓 + 文档 + CLI = 24 小时 AI 同事
         ↓
   gh / glab / kubectl
         ↓
  Claude Code + Codex
         ↓
   深夜自助解决问题
```

核心不是 AI 有多强，而是把已有的知识（代码仓、MR 讨论、文档、日志）用 CLI 工具暴露给 AI，让它成为你的 24 小时 pair programming 伙伴。

## 效率提升的真相：Anthropic 研究数据

在讨论「AI Coding 有多香」之前，先看一组来自 [Anthropic 官方研究](https://www.anthropic.com/research/AI-assistance-coding-skills) 的数据：

### 速度提升：没你想的那么大

> AI 组仅比手写组快约 **2 分钟**，且**未达到统计显著性**。

这意味着：单纯用 AI 生成代码，速度优势并不明显。

### 代价：代码理解能力下降

| 指标 | AI 组 | 手写组 | 差距 |
|------|-------|--------|------|
| 代码理解测试得分 | 50% | 67% | **差两个字母等级** |
| 调试能力 | 最大差距 | - | AI 组明显更弱 |

52 名初级工程师参与实验，结果显示：**过度依赖 AI 会削弱调试和代码理解能力**。

### 关键发现：交互方式决定一切

研究发现，与 AI 交互的方式直接影响学习效果：

| 交互模式 | 表现 | 特征 |
|----------|------|------|
| **高分组** | 知识留存好 | 主动要求解释、追问原理、生成代码 + 概念提问结合 |
| **低分组** | 知识留存差 | 完全委托、被动依赖 AI 调试 |

### 这对我的实践意味着什么？

这组数据验证了我在 Part 2 强调的 **Learning 模式** 的必要性：

- 不只让 AI 给答案，还要让它**解释为什么**
- 不完全委托，保持**主动追问**的习惯
- 用 AI 加速，但不跳过**理解代码**的过程

**Vibe Coding 的正确姿势**：AI 是 pair programming 伙伴，不是代写作业的枪手。你需要理解它写的每一行代码，否则调试时会付出代价。

---

## 附录：与 bcherny / Boris 的实践对比

[bcherny 在 X 上分享的 Claude Code 技巧](https://readwise.io/reader/shared/01kgb6njjekq2hpxc0ycymbrcg/) 以及 Boris 的 Cheatsheet（见文章开头配图）总结了很多优秀实践，下面是我的实践与他们的对比：

### 相同的实践

| 实践 | bcherny/Boris | 我的实践 |
|------|---------------|---------|
| **Plan 模式优先** | 复杂任务前先制定计划 | Part 5: Plan/Build 模式 |
| **子代理分工** | use subagents 分散任务 | Part 6: 双模型协作 |
| **共享 CLAUDE.md** | 团队共享一份规则库 | Part 8: Prompt 文档化 |
| **Slash Commands** | /help, /config, /reset 等 | Part 7: /statusline 监控 |

### 我额外强调的实践

| 实践 | 说明 |
|------|------|
| **gh/glab 知识库** | 把代码仓的 MR/PR 讨论作为 AI 的知识源，bcherny 未提及 |
| **双模型协作** | Claude 写 + Codex Review，而非单一模型 |
| **kubectl 运维闭环** | 从 Onboarding 到 Debug 全流程 AI 化 |
| **关闭 Auto Compact** | 明确建议关闭，避免性能下降和上下文丢失 |
| **Output Style: Learning** | 加速 Onboarding 认知，bcherny 未提及 |

### bcherny 提到但我未采用的

| 实践 | 说明 |
|------|------|
| **并行 worktree** | 3-5 个 git worktree 同时运行多个 Claude 会话 |
| **双 Claude 审核** | 一个写计划，另一个扮演资深工程师审核 |
| **Slack MCP 集成** | 我们用飞书，暂无对应集成 |
| **语音输入** | 提升 prompt 详细度，我暂未尝试 |

### 一句话总结差异

bcherny/Boris 的实践更偏向 **GitHub 原生生态 + 并行化**，我的实践更偏向 **GitLab + 企业内部知识库 + 运维闭环**。

核心思路一致：**让 AI 能访问到足够的上下文，它就能成为你的 24 小时同事**。

---

## 番外：从工具到同事 —— OpenClaw 与 Moltbook 的启示

除了 Claude Code 和 Codex，我还尝试了 [OpenClaw](https://github.com/claw-project/openclaw)（ClawdBot/MoltBot）和 Moltbook 平台，有一些有趣的观察。

### OpenClaw：认知视角的转变

单独使用 OpenClaw 和直接用 Codex、Claude Code 区别不大，甚至会丢失一些可以 prompt 的细节。

但当你把它对接到**飞书或 Telegram**，拉到群里用时，体验完全不同：

| 维度 | CLI 工具 (CC/Codex) | IM 机器人 (OpenClaw) |
|------|---------------------|---------------------|
| 心智模型 | AI 工具 | **同事** |
| 授权倾向 | 谨慎、逐步确认 | 更多信任、更大胆授权 |
| 交互方式 | 主动发起 | 随时 @ 提问 |

**最重要的变化是认知**：当 AI 以 IM 机器人的形态出现在群里，你不自觉地会把它当成一个同事，而不是一个工具。这种视角转变带来更自然的协作方式。

此外，OpenClaw 自己的 Memory、Gateway 等工程做得确实不错，下次再详细展开。

### Moltbook：大胆的 Multi-Agent 社交实验

Moltbook 本质上是一个大型的 Cosplay 平台 —— 建立宗教、诱骗 API Key 等行为，基本上都是 Claw 在执行被要求的「意志」。

但抛开这些争议，Moltbook 确实是一个**非常大胆的 Public Multi-Agent 社交平台**：

- 多个 Agent 可以在同一个空间内交互
- 用户可以创建和分享自己的 Agent
- 很可能演变成 **Skill 的分发平台**

这让我想到：未来的 AI Coding 工具，可能不只是本地 CLI，而是一个可以订阅、分享、组合的 Agent 生态。

### 一句话总结

> 工具让你更高效，同事让你更信任。AI 的形态决定了人类如何与它协作。
