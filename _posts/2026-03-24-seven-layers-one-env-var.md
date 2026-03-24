---
layout: post
title: "七层配置，一行 env 击穿"
date: 2026-03-24
categories: [devops]
tags: [debugging, configuration, architecture, shell]
---

七层精心设计的配置架构，被启动脚本里一行 inline 环境变量从外面捅穿了。这次排查让我重新思考"配置兜底"到底是在防御还是在制造攻击面。

![Header](/git-blog/public/seven-layers-one-env.jpg)

<!-- more -->

## 现场

Cicada 线上跑的模型不对。代码里写的是 `gemini-3.1-pro-preview-customtools`，实际请求全打到了 `gemini-2.0-flash`。

第一反应：某层配置覆盖了默认值。于是开始追配置链路。

## 七层追踪

Cicada 的模型配置有七层 fallback：

1. **defaults.ts** — 硬编码默认值
2. **app/index.ts** — 应用层覆盖
3. **Project config** — 项目级配置
4. **Session config** — 会话级配置
5. **resolveModel()** — 运行时解析逻辑
6. **Google SDK** — SDK 层参数传递
7. **Gateway passthrough** — 网关透传

每一层都查了。每一层都是对的。

`gemini-3.1-pro-preview-customtools` 从 defaults 一路传到 Gateway，没有任何一层篡改它。但线上的请求日志白纸黑字写着 `gemini-2.0-flash`。

## 第八层

最后在启动脚本里找到了：

```bash
CICADA_LLM_MODEL=gemini-2.0-flash bash /opt/cicada/start.sh
```

Shell 的 inline 环境变量。它不在代码里，不在配置文件里，不在任何 config management 系统里。它在运维同事某天手动加的一行部署命令里。

`process.env.CICADA_LLM_MODEL` 存在时，代码最早期的某个分支会读它——比七层 fallback 中的任何一层都早。

七层防弹玻璃，后门没锁。

## 模式

这不是个案。这是一个反复出现的模式：**系统越复杂，被绕过的方式越简单。**

Kubernetes 的 RBAC 精心配置了八种角色，但有人把 admin kubeconfig 扔在了共享文档里。数据库有行级权限控制，但 backup 脚本用的是 root 账号。API Gateway 有速率限制、认证、鉴权三层中间件，但内部服务之间的调用走的是无认证的 gRPC。

复杂性制造的不是安全感，是**认知负担**。当一个系统有七层配置，没有人能在脑子里同时持有所有七层的状态。每多一层"兜底"，就多一个可能被悄悄覆盖的点，同时降低了任何一个人能完整理解系统的概率。

## 反直觉的推论

配置链路最安全的长度可能不是"层层兜底"，而是**只有一层**。

一个权威源（single source of truth），其他全删掉。少一层 fallback 就少一个被悄悄覆盖的机会。

后来的修复方案就是这么改的：Gateway 是唯一权威源，Cicada 不做模型路由，只接收。代码里删掉了 `process.env.CICADA_LLM_MODEL` 的读取，删掉了 defaults.ts 的 fallback，删掉了 Session 级的覆盖能力。模型配置只有一个入口，改错了也只需要查一个地方。

## 更一般的原则

这个案例的底层逻辑其实是：**防御的层数和安全性不成正比。**

直觉告诉我们，多一层防护就多一分安全。但每一层防护本身也是代码，也有 bug，也有被绕过的可能。当防护层数超过人脑的工作记忆容量（大约 4±1），系统的实际安全性开始下降——不是因为每一层不够好，而是因为没有人能同时看清所有层。

真正的健壮不是堆叠层数，而是**减少需要正确的东西的数量**。

这和结构工程的逻辑一样：桥的强度不取决于有多少根缆绳，而取决于最弱的那根。配置系统的可靠性不取决于有多少层 fallback，而取决于最容易被悄悄绕过的那一层。

把那些"以防万一"的 fallback 删掉，不是偷懒，是在缩小攻击面。

## 检查清单

给自己的备忘：

- **`grep -r process.env` 是 code review 的必查项。** 环境变量是代码的隐式入参，和函数签名一样重要，但不会出现在类型签名里。
- **启动命令是配置的一部分。** Dockerfile CMD、systemd ExecStart、k8s command/args、CI/CD 的 run step——这些都是配置，不是"运维细节"。
- **能画出完整的配置优先级链路图吗？** 如果不能，说明系统已经超过可理解的复杂度了。
- **fallback 的数量应该趋近于零。** 每个 fallback 都在说"我不确定上游会不会给我正确的值"。如果需要这么多不确定性的缓冲，问题不在 fallback 不够多，在于上游不够可靠。修上游。
