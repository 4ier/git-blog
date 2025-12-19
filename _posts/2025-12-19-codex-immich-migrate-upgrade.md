---
layout: post
title: "用 Codex CLI 远程迁移与升级 Immich：从外挂盘到本地阵列（含自启自愈）"
date: 2025-12-19
categories: [运维]
tags: [Immich, Codex, Docker, rsync, systemd, NAS]
---

这是一篇带一点“复盘味道”的运维记录：我把 Immich 的媒体库和数据库从外挂盘迁移到 NAS 的本地阵列，并在切换后完成版本升级与开机自启/异常自愈。

本文已对域名、IP、口令等敏感信息做脱敏处理；命令里的路径/变量请按你的实际环境替换。

<!-- more -->

## 背景：为什么要迁移

- 外挂盘 I/O 慢、延迟高，影响导入/缩略图/转码等后台任务
- 希望把**媒体库**和**数据库**都落到本地阵列（SSD/RAID）以获得更稳定的吞吐
- 迁移过程中尽量缩短停机窗口

## 这次用 Codex CLI 做了什么

Codex CLI 的价值点不是“写代码”，而是把它当作一个**远程运维搭档**：

- 通过 SSH 在目标机器上执行命令、收集状态、排查卡点
- 把迁移拆成可控步骤：预同步、停机切换、验证、再升级
- 把最终结果固化为可持续运维形态：持久化 compose + systemd 自启 + watchdog 自愈

> 关键是：它能持续追踪上下文（迁移路径、容器状态、日志）并推进到“真的能用”。

## 迁移策略：先媒体不停机预同步，再停机切换

### 1) 媒体库：先预同步（不停机）

媒体目录通常是 TB 级别，且文件数量非常多。

我的建议策略是：

- 先做一次“长时间预同步”（不停机）把大部分数据搬过去
- 切换窗口只做必要动作（例如短暂停机后补一小段增量、或直接切换路径）

预同步示例（不含 `--delete`，只做镜像式复制）：

```bash
rsync -a --info=progress2 \
  --partial --partial-dir=.rsync-partial \
  --modify-window=2 \
  "$SRC_MEDIA/" "$DST_MEDIA/"
```

### 2) 最终对齐（可选）：`rsync --delete` 的意义

所谓“最终媒体 rsync（--delete）”，目的只有一个：让目标目录**严格等于**源目录。

- 优点：保证一致性（含删除）
- 缺点：可能非常慢（尤其是海量小文件 + 目录树校验）

这次最终我选择了一个更务实的“方案 B”：**跳过最终 `--delete` 对齐，直接切换到本地阵列运行**。

后续如果你担心漏文件，可以在线补一次“只补齐、不删除”的同步：

```bash
rsync -a --ignore-existing --modify-window=2 \
  "$SRC_MEDIA/" "$DST_MEDIA/"
```

> 这个动作不会删目标文件，也不会覆盖已有文件，风险低。

### 3) 数据库：停机窗口做离线拷贝

数据库目录不大（通常几十 GB 以内），但一致性更重要。

建议：

- 切换前做一次 `pg_dump` 备份（即使最终不回滚，也能兜底）
- 停机后再拷贝数据库数据目录（或恢复 dump 到新目录）

备份示例：

```bash
docker exec immich_postgres pg_dump -U postgres -d immich -Fc > immich-backup.dump
```

## 运维落地：避免“目录丢失”和“开机不起来”

### 1) 把 compose 目录放到持久化存储

一些 NAS 平台的默认工作目录并不可靠（重启/升级/切换 shell 环境后路径可能找不到）。

做法：

- 把 `docker-compose.yml`、`.env`、`Caddyfile` 固定放到一个持久化目录（例如数据阵列）
- 如有旧脚本依赖 `/opt/immich`，用软链接兼容

目录示例：

- `.../immich/compose/`
- `/opt/immich -> .../immich/compose`

### 2) systemd 开机自启（推荐）

Docker 本身可能开机启动，但这不代表你的 compose stack 会自动起来。

一个可靠的方式是增加 systemd unit：

- `immich-compose.service`：开机执行 `docker compose up -d`

### 3) 异常自愈：restart policy + watchdog

两层防护：

- Compose 内 `restart: always`（容器异常退出会自动拉起）
- systemd timer 周期性 watchdog：发现 `unhealthy/exited` 就重启

watchdog 里建议加 `--no-recreate`：避免在升级过程中和人工操作“打架”。

## TLS：用现有证书做端口级 HTTPS

如果 NAS 已经有一套自动签发的证书体系（例如系统组件占用了 80/443），也可以走折中方案：

- Immich 只在本机监听一个 HTTP 端口（例如 `127.0.0.1:2284`）
- 用一个反代容器（Caddy/Nginx）对外监听 `:2283`，做 TLS 终止并反代到 Immich

这样对外仍然是：

- `https://<your-domain>:2283/`

## 版本升级：固定版本号 + 可回滚备份

我把版本号固定在 `.env`（例如 `IMMICH_VERSION=vX.Y.Z`），升级步骤基本是：

1. 先 dump 备份数据库
2. 修改版本号
3. `docker compose pull && docker compose up -d`
4. 用 `/api/server/version` 校验版本

回滚也很直接：把版本号改回去再 `up -d`。

## 真实踩坑：代理（Clash）导致浏览器打不开 HTTPS

迁移完成后出现过一种“服务端明明正常，但浏览器访问报 TLS 错误”的情况，根因是：

- 自定义域名在内网 DNS 下解析到内网 IPv6（例如 ULA 网段）
- Clash 开启后 DNS/fake-ip/代理链路导致解析或流量走偏

结论：

- 对内网网段和该域名设置 **DIRECT**
- 必要时关闭该域名的 fake-ip（或做 fake-ip filter）

具体规则写法因 Clash 内核/客户端差异很大，这里不展开，核心是：**让内网地址直连且解析不被污染**。

## 总结：Codex 帮我把“运维动作”变成“可交付结果”

这次体验最有价值的点：

- 迁移不是单一命令，而是一组“可回滚、可验证”的步骤
- 做完切换不算完，必须把运行方式固化（自启、自愈、验证路径）
- 出现异常时能快速定位（DNS/代理、容器健康、端口监听、挂载路径）

如果你也要做 Immich 迁移，我建议按这个顺序：

1. 媒体预同步（不停机）
2. 数据库备份（dump）
3. 停机窗口切换路径/数据库目录
4. 验证端口、API、容器健康
5. 再考虑版本升级

