---
layout: post
title: "用 Codex CLI 迁移 + 升级 Immich：旧 NAS → 新 NAS（v1.131.x 跨到 v2.3.1 的升级路径与 break 处理）"
date: 2025-12-19
categories: [运维]
tags: [Immich, Codex, Docker, PostgreSQL, rsync, 升级]
---

这次我把 Immich 从**旧 NAS**迁移到**新 NAS**，同时完成一次“跨大版本升级”：从 `v1.131.x` 最终跑到 `v2.3.1`。

真正难的不是拷贝文件，而是：

- 媒体库 TB 级且小文件极多，`rsync` 很容易因为“遍历/校验”显得特别慢；
- `v1.131.x → v2.x` **不能直接升级**，中间存在官方要求的 upgrade path（以及 break 变更）。

我用 Codex CLI 当作远程运维搭档，把这条长链路任务拆成可验证、可回滚的步骤推进完成。

> 已对域名、IP、口令、Token 等敏感信息脱敏；命令中的路径/变量请按你环境替换。

<!-- more -->

## 1) 目标

- 从旧 NAS 迁移到新 NAS：
  - 媒体目录（library/upload/thumbs/encoded-video/...）
  - 数据库（PostgreSQL）
- 在新 NAS 上最终运行版本：`v2.3.1`
- 缩短停机窗口（优先让服务先恢复，再做补齐/清理）
- 迁移完成后：开机自启 + 异常自愈

## 2) 为什么 v1.131.x 不能直接升级到 v2.x

我一开始也以为“改镜像 tag，`docker compose up -d`”就完事，后来才确认：

- Immich 的 schema 升级路径有约束：**不能从 `v1.131.x` 直接跳到 `v2.x`**。
- 官方要求必须先在 `v1.132.0 ~ v1.136.0` 范围内**成功启动一次**，完成旧 schema 的升级（否则会触发类似 *Invalid upgrade path / TypeORM upgrade* 的错误）。

因此正确路线是：

- `v1.131.x` → **`v1.132.3`（过桥版本，启动一次）** → `v2.3.1`

> 过桥版本我选 `v1.132.3`，原因是稳定且符合官方 upgrade path 要求。

## 3) 迁移总体策略（我认为最稳的一套）

把迁移拆为三条线：

1. **媒体库（TB 级）**：先预同步（不停机），切换窗口避免做耗时的全量校验/删除。
2. **数据库（强一致）**：先 dump 备份兜底；再 restore/离线拷贝实现一致切换。
3. **升级链路**：严格按 upgrade path 走（`v1.132.3` 过桥启动一次）。

这样能保证：

- 即使媒体库还在补齐，服务也能尽快恢复可用；
- 数据库有 dump 可回滚；
- 升级不会卡在不可逆的中间态。

## 4) 媒体库迁移：预同步（不停机）

媒体库的痛点：文件量巨大，`rsync` 经常“前面数字几乎不动但 elapsed 在涨”，本质是它在 **scan/compare（ir-chk/to-chk）**。

建议：

- 先预同步：把大部分数据搬到新 NAS（不停机）
- 中断可续传：用 `--partial/--partial-dir`

示例：

```bash
rsync -a --info=progress2 \
  --partial --partial-dir=.rsync-partial \
  --modify-window=2 \
  "$OLD_MEDIA/" "$NEW_MEDIA/"
```

### 是否要做最终 `rsync --delete`？

“最终 rsync（带 `--delete`）”的意义是让目标端严格等于源端（包含删除）。

但现实是：

- 这一步可能非常慢，尤其是海量小文件；
- 它会拉长停机窗口。

我最终采用了一个更务实的方案（我称它为“方案 B”）：

- **不做最终 `--delete` 对齐，直接切换到新 NAS 的本地阵列路径运行**。
- 后续如果担心漏文件，用在线补齐（不删除、不覆盖）：

```bash
rsync -a --ignore-existing --modify-window=2 \
  "$OLD_MEDIA/" "$NEW_MEDIA/"
```

## 5) 数据库迁移：dump 兜底 + restore/离线拷贝

这一步我强烈建议：不管你最终怎么迁移 DB（restore 或拷贝数据目录），都先做一次 dump：

```bash
docker exec immich_postgres pg_dump -U postgres -d immich -Fc > immich-backup.dump
```

然后在新 NAS 的目标数据库里 restore（示意）：

```bash
docker exec immich_postgres pg_restore -U postgres -d immich \
  --clean --if-exists --no-owner /tmp/immich.dump
```

这样你能：

- 随时回到“可用”的 dump 时间点；
- 降低“离线拷贝数据目录/权限/UID 不匹配”带来的坑。

## 6) 过桥升级：v1.131.x → v1.132.3（必须成功启动一次）

关键动作不是“升级”，而是“**让 v1.132.3 成功启动并跑完它该跑的迁移**”。

验证点：

- `docker compose ps` 全部健康
- Immich API 能返回版本信息
- 日志里没有 upgrade path / migration 错误

这一步完成后，再继续升级到 `v2.3.1`。

## 7) 升到 v2.3.1：你会遇到的 break 变更

从 v1 到 v2，运维层面我踩到/需要处理的变化包括：

- 媒体挂载点统一为 `/data`（v2 compose 里通常是 `- ${UPLOAD_LOCATION}:/data`）
- Redis 替换为 Valkey（镜像与服务名不同）
- PostgreSQL 镜像与扩展版本变化（官方提供 `immich-app/postgres:14-vectorchord...`）
- 版本号建议固定到具体版本：`IMMICH_VERSION=v2.3.1`（避免浮动 tag）

实操上我做了两件事让升级更稳：

1) compose 与 `.env` 固定放到持久化目录（例如本地阵列），避免环境切换后“目录没了”。
2) 每个阶段都做“可验证输出”：`ps`、`curl /api/server/version`、`docker logs`。

## 8) 自启与自愈：把“一次性迁移”固化成“长期可运维”

迁移完成不等于结束；我最后补齐了运维能力：

- systemd 开机自启：开机执行 `docker compose up -d`
- 容器 `restart: always`
- watchdog 定时检查：发现 `unhealthy/exited` 自动重启

这样即使 NAS 重启或某个容器偶发异常，也能自动拉起恢复。

## 9) 额外插曲：代理（Clash）导致浏览器访问异常

迁移完成后我遇到过“服务端正常但浏览器 TLS 报错”的情况，最终发现根因不在 Immich：

- 内网域名可能解析到内网地址（尤其是 IPv6 ULA）
- 开启代理后 DNS/fake-ip/路由导致解析或流量走偏

经验是：先判断是“解析错”还是“路由错”，再针对性做 DIRECT / fake-ip-filter。

## 10) Codex CLI 的使用体感

我觉得 Codex 在这类任务里最有价值的是：

- 长任务能保持上下文，把步骤推进到“真的可用”
- 会主动补齐验证与排障（端口、健康、挂载、日志）
- 适合把迁移最后一公里变成可持续运维形态（自启/自愈/回滚点）

如果你也要做类似迁移，我建议按这个顺序：

1) 先确认 upgrade path（尤其跨大版本）
2) dump 兜底
3) 媒体预同步（不停机）
4) 过桥版本启动一次（`v1.132.x`）
5) 升到目标版本（`v2.3.1`）
6) 切换目录到本地阵列
7) 固化自启/自愈

