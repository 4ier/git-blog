---
layout: post
title: "OpenClaw + QQ 机器人配置复盘（脱敏版）"
date: 2026-02-25
categories: [automation]
tags: [OpenClaw, QQ, NapCat, OneBot, Docker, launchd, proxy]
---

这篇给未来的我：一套能稳定跑起来的 OpenClaw + NapCat + QQ 机器人配置手册，已脱敏（账号、token、路径中的个人标识都用占位符）。

<!-- more -->

## 目标架构

- OpenClaw 作为主代理/大模型执行层
- `@izhimu/qq` 作为 OpenClaw 的 QQ 通道插件
- NapCat 作为 QQ 客户端 + OneBot11 网关
- OpenClaw 通过 `ws://127.0.0.1:3001` 与 NapCat 通信

## 1. OpenClaw 侧：插件与通道配置

配置文件：`~/.openclaw/openclaw.json`

关键点：

1. `plugins.allow` 必须显式包含 `qq`，否则会出现安全告警。
2. 关闭不用的通道（例如 telegram / feishu）。
3. `channels.qq.wsUrl` 指向本机 `3001`。

示例（脱敏）：

```json
{
  "plugins": {
    "allow": ["qq"],
    "entries": {
      "qq": { "enabled": true },
      "telegram": { "enabled": false }
    }
  },
  "channels": {
    "qq": {
      "enabled": true,
      "wsUrl": "ws://127.0.0.1:3001",
      "accessToken": ""
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai-codex/gpt-5.3-codex"
      }
    }
  }
}
```

## 2. NapCat 侧：OneBot11 监听必须正确

最容易踩的坑：**新 QQ 号登录后，`onebot11_<QQ_UIN>.json` 里 `websocketServers` 可能是空数组**，这会导致 OpenClaw 持续 `ECONNRESET`，表现为“能收消息但不回复/一直重连”。

配置文件：

- `~/.napcat/config/onebot11_<QQ_BOT_UIN>.json`
- `~/.napcat/config/webui.json`

关键字段（脱敏）：

```json
{
  "network": {
    "websocketServers": [
      {
        "name": "WsServer",
        "enable": true,
        "host": "0.0.0.0",
        "port": 3001,
        "messagePostFormat": "array",
        "reportSelfMessage": false,
        "token": "",
        "enableForcePushEvent": true,
        "debug": false,
        "heartInterval": 30000
      }
    ]
  }
}
```

`webui.json` 关键字段：

```json
{
  "autoLoginAccount": "<QQ_BOT_UIN>"
}
```

## 3. Docker 运行建议（NapCat）

容器名固定为 `napcat`，并启用重启策略：

```bash
docker update --restart unless-stopped napcat
```

检查状态：

```bash
docker inspect napcat --format 'running={{.State.Running}} restart={{.HostConfig.RestartPolicy.Name}}'
```

应看到 `running=true restart=unless-stopped`。

## 4. OpenClaw 代理问题（关键）

如果模型请求 `fetch failed` / timeout，大概率是网关进程没吃到代理环境变量。

文件：`~/Library/LaunchAgents/ai.openclaw.gateway.plist`

建议在 `EnvironmentVariables` 中同时配置大小写：

- `NODE_USE_ENV_PROXY=1`
- `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY`
- `http_proxy` / `https_proxy` / `all_proxy`
- `NO_PROXY` / `no_proxy`（至少包含 `localhost,127.0.0.1,::1`）

修改后重载：

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ai.openclaw.gateway.plist
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway
```

## 5. 登录后自动启动（macOS）

### OpenClaw

OpenClaw 网关用 `launchd` 托管即可，确认 `state = running`。

### NapCat

两层保障：

1. Docker 自带 `unless-stopped`
2. 可额外放一个 LaunchAgent，在登录后执行 `docker start napcat`（容器不在运行时才拉起）

示例任务名：`ai.napcat.autostart`

## 6. 验证链路（按顺序）

1. NapCat 日志应出现：
   - `WebSocket服务: 0.0.0.0:3001 ... 已启动`
   - `[OneBot] [WebSocket Server] Server Started :::3001`
2. OpenClaw 日志应出现：
   - `Connected to NapCat`
   - `State changed: connecting -> connected`
3. 发一条测试消息后应看到：
   - `Dispatching to agent ...`
   - `deliver(final)`
   - `Sent reply`
   - `Dispatch completed`

## 7. 故障速查

### 7.1 `plugins.allow is empty`

原因：没显式信任插件。  
处理：`openclaw.json` 中加入 `"plugins.allow": ["qq"]`。

### 7.2 一直 `ECONNRESET`

原因：NapCat 当前账号 `websocketServers` 为空，或端口没监听。  
处理：修 `onebot11_<QQ_BOT_UIN>.json`，重启容器。

### 7.3 收到消息但长时间不回

原因：OpenClaw 到模型侧请求超时（常见于代理未生效）。  
处理：检查 launchd 环境变量并重启网关。

### 7.4 切换 QQ 小号后又坏了

原因：新账号生成了新配置文件，但没继承 OneBot11 的 WS 配置。  
处理：检查新文件 `onebot11_<new_uin>.json`，不要只看旧号文件。

## 最小可记忆结论

这套链路能否回复，核心只看三件事：

1. NapCat 的 `3001` 是否在监听  
2. OpenClaw 是否 `Connected to NapCat`  
3. OpenClaw 网关是否真的走了代理（模型请求是否成功）

