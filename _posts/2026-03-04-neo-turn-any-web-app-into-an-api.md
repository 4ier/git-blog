---
layout: post
title: "Neo：把任意 Web App 变成 API"
date: 2026-03-04
categories: [ai-agent]
tags: [neo, chrome-extension, api-discovery, browser-automation, ai-tools]
---

每个 Web App 都已经有一套完整的 API——前端每次点击按钮时都在调用它。Neo 捕获这些调用，让你或 AI 直接 replay。

![Neo](/git-blog/public/neo-header.png)

<!-- more -->

## 一个没人解决好的问题

AI Agent 操作网页，目前只有两条路，都不好走：

**官方 API** —— 大多数 SaaS 没有。有的也只暴露实际功能的 10%。想做 API 不支持的事？没办法。

**浏览器自动化** —— 截图，OCR 识别文字，找到按钮坐标，点击，等待，再截图。一个 200ms 的 API 调用变成 5 秒的截图-解析-点击循环。慢、脆弱，每次 UI 改版就全部崩掉。

2026 年了，几十亿美金的 AI 基础设施，我们还在像 2015 年写 Selenium 一样截网页的图。

## 第三条路

核心洞察：**浏览器已经知道每一个 API 调用**。你在 Twitter 上点「发推」，浏览器发出 `POST /i/api/graphql/.../CreateTweet`，带着认证头、CSRF token 和推文内容。这就是真正的 API——完整、已认证、经过实战检验，因为这就是产品自己在用的。

Neo 坐在浏览器里静静观察。每个 `fetch()`、每个 `XMLHttpRequest`、每条 WebSocket 消息——URL、请求头、请求/响应体、耗时，甚至是哪个 DOM 元素触发了这次调用，全部捕获。

```
正常浏览 → Neo 记录所有 API 流量 → 自动生成 Schema → AI 直接调用 API
```

不用逆向工程，不用读文档，不用申请 API key。正常用网站，Neo 自己学会它怎么工作。

## 怎么用

### 1. 被动捕获

装上 Chrome 扩展，正常浏览。Neo 在后台默默记录一切——URL、请求头、请求/响应体、状态码、耗时。它甚至能追踪是哪个按钮的点击触发了哪个 API 调用（2 秒的时间窗口做 DOM 事件和网络请求的关联）。

```bash
neo capture search "CreateTweet" --method POST
# Found: POST /i/api/graphql/a1p9RWp.../CreateTweet (x-csrf-token required)
```

### 2. Schema 生成

一条命令，Neo 把某个域名的所有捕获提炼成结构化的 API Schema：端点、认证头、参数模式、响应结构、错误码。

```bash
neo schema generate x.com
```

Schema 输出会展示哪些 UI 元素触发了哪些 API，以及哪些字段是变化的：

```
POST /i/api/graphql/:hash/CreateTweet  (12x, 340ms) [auth: x-csrf-token]
  body: {variables, features} [varies: variables]
  ← click button.tweet-btn "Post" (8x)
```

最后一行是关键——它映射了 **用户意图 → UI 元素 → API 调用 → 可参数化字段**。AI Agent 读完这个 Schema，就知道怎么发推，根本不需要看到 Twitter 的界面。

### 3. Replay

API 调用在浏览器标签页的上下文中执行，通过 Chrome DevTools Protocol。Cookie、CSRF token、Session 认证——全部自动继承。

```bash
# 智能调用：Schema 查找 + 自动认证 + 自动选择标签页
neo api x.com CreateTweet --body '{"variables":{"tweet_text":"hello from neo"}}'

# 或者 replay 一个之前捕获的调用
neo replay <capture-id> --tab x.com
```

不用管 Token，不用走 OAuth 流程。你登录了，Neo 就登录了。

## v2：没有 API 的时候，驱动 UI

有些操作没有干净的 API 端点——复杂的多步向导、拖拽界面、Canvas 编辑器。对于这些场景，Neo v2 加入了基于无障碍树的 UI 自动化层：

```bash
neo snapshot              # 获取无障碍树，带 @ref 映射
neo click @14             # 通过引用点击元素
neo fill @7 "hello"       # 填充输入框
neo press Enter           # 键盘输入
neo screenshot            # 截图
```

一个工具，两个层面。有 API 就直接调（快、稳），没有 API 就驱动 UI。Agent 不需要纠结用哪种方式——两种都有。

## 能做什么

**给 AI Agent 用**：不再截图→OCR→点击，直接调 API。30 秒的浏览器自动化变成 200ms 的 API 调用。更快，也更稳——API 契约比像素位置稳定得多。

**给开发者用**：任意 Web App 的即时 API 文档。不用再手动翻 Network 面板。`neo schema show` 给你完整的 API 地图，`neo schema openapi` 导出 OpenAPI 3.0 格式，直接用 Postman 或代码生成器。

**给自动化用**：`neo workflow discover` 发现多步 API 序列（登录→获取数据→提交表单），一条命令 replay。

**给调试用**：`neo capture watch` 实时查看所有 API 流量。`neo flows` 展示调用序列模式。`neo deps` 追踪 API 响应和后续请求之间的数据流。

## 架构

Neo 有三层：

1. **Chrome 扩展** —— 被动捕获。通过 `chrome.webRequest` 和 `chrome.debugger` 拦截所有网络流量。追踪 DOM 触发关联。按域名存储捕获记录（500 条上限，自动清理）。

2. **CLI** —— 交互界面。查询捕获、生成 Schema、执行调用、分析模式。所有操作通过 `neo <command>`。

3. **CDP Bridge** —— 执行层。API 调用在浏览器标签页的 JavaScript 上下文中运行，通过 Chrome DevTools Protocol。这就是为什么认证继承能 work——调用就像是页面自己发出的。

扩展还支持 WebSocket Bridge（`neo bridge`）做实时流式传输，适合监控或者管道到其他工具。

## 设计决策

**被动优于主动。** Neo 不注入修改页面行为的脚本。它在扩展层观察。这意味着它在任何网站上都能工作，不会触发反 bot 检测。

**本地优先。** 所有捕获和 Schema 都存在本机。没有云端，没有遥测。你的浏览模式是你自己的数据。

**Schema 即知识。** 生成的 Schema 是持久化的 API 知识库。AI Agent 读完一个 Schema 文件，就能理解一个 Web App 的整个 API 面，不需要先发任何请求。

**浏览器上下文执行。** API 调用在浏览器标签页内执行（而不是从独立的 HTTP 客户端），彻底消除了认证问题。浏览器有什么认证状态，Neo 就有什么。

## Electron 桌面应用支持

Neo 现在支持 Electron 桌面应用——VS Code、Slack、Discord、Cursor，任何基于 Electron 的应用都行。这些应用内置 Chromium，走同样的 fetch/XHR，Neo 通过 CDP 直接连接，不依赖 Chrome 扩展。

```bash
# 启动 VS Code 并自动连接
neo launch code --port 9230
neo snapshot                # 看到 VS Code 的无障碍树
neo click @14               # 点击菜单项

# 或者连接已经在运行的 Electron 应用
neo connect --electron slack

# 注入 Neo 捕获脚本
neo inject --persist        # 页面导航后仍然生效
```

Session 自动管理，可以在多个应用之间切换：

```bash
neo --session vscode snapshot
neo --session chrome api x.com HomeTimeline
```

## 开始使用

```bash
git clone https://github.com/4ier/neo.git
cd neo && npm install && npm run build
npm link  # 全局可用 neo 命令
```

在 Chrome 中加载扩展（开发者模式 → 加载已解压的扩展 → `extension/dist/`），浏览任何网站，就开始捕获了。

```bash
neo status                    # 看看我们知道什么
neo schema generate x.com     # 生成 API 地图
neo api x.com HomeTimeline    # 调用
```

三条命令，从零到调用 Twitter 内部 API。

---

Neo 开源在 [github.com/4ier/neo](https://github.com/4ier/neo)，已突破 550 ⭐。如果你在做需要和 Web App 交互的 AI Agent，试试看。截图点击的时代该结束了。
