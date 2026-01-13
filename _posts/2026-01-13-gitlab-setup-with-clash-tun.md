---
layout: post
title: "企业 GitLab + Clash TUN 模式配置指南"
date: 2026-01-13
categories: [devops]
tags: [GitLab, glab, SSH, Clash, TUN, proxy]
---

在 Clash TUN 模式下配置企业自建 GitLab 的 SSH 访问，需要处理 fake-ip DNS 和代理规则的兼容问题。本文记录完整的配置过程。

<!-- more -->

## 问题背景

Clash TUN 模式使用 fake-ip 实现透明代理：

```yaml
dns:
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
```

当 SSH 连接企业 GitLab 时，DNS 返回 fake-ip 地址（如 `198.18.0.118`），流量被代理服务器接管。但代理通常不支持转发 SSH 协议，导致连接失败：

```
Connection closed by 198.18.0.118 port 22
```

## SSH 配置

在 `~/.ssh/config` 中添加企业 GitLab 配置：

```
# GitLab 企业实例
Host gitlab.company.com
    HostName gitlab.company.com
    User git
    IdentityFile ~/.ssh/id_ed25519_company
    IdentitiesOnly yes
```

生成密钥（如果没有）：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_company -C "your-email@company.com"
```

将公钥添加到 GitLab：Settings → SSH Keys。

## Clash 规则配置

在 Clash 规则中添加企业域名直连，确保 SSH 流量不经过代理。

### 方案 1：Clash Verge Merge 配置（推荐）

使用 Merge 覆写，不影响订阅更新：

```yaml
prepend-rules:
  - 'DOMAIN-SUFFIX,company.com,DIRECT'
```

### 方案 2：直接修改配置

在 `rules:` 最前面添加：

```yaml
rules:
  - 'DOMAIN-SUFFIX,company.com,DIRECT'
  # ... 其他规则
```

修改后重载配置，验证规则生效。

## 添加 Host Key

首次连接需要添加 host key：

```bash
# 获取并添加 host key
ssh-keyscan gitlab.company.com >> ~/.ssh/known_hosts

# 测试连接
ssh -T git@gitlab.company.com
# 期望输出：Welcome to GitLab, @username!
```

## glab CLI 配置

glab 是 GitLab 官方 CLI 工具，类似 GitHub 的 gh。

### 安装

```bash
# Windows (scoop)
scoop install glab

# macOS
brew install glab

# Linux
# 参考 https://gitlab.com/gitlab-org/cli
```

### 登录

```bash
glab auth login --hostname gitlab.company.com
```

交互式配置：

```
? What domains does this host use for the container registry...
> gitlab.company.com,gitlab.company.com:443,registry.gitlab.company.com

? Choose default Git protocol:
> SSH          # 选择 SSH，配合已有密钥

? Choose host API protocol:
> HTTPS        # API 走 HTTPS
```

### 验证

```bash
glab auth status
```

输出示例：

```
gitlab.company.com
  ✓ Logged in to gitlab.company.com as username
  ✓ Git operations configured to use ssh protocol.
  ✓ API calls are made over https protocol.
  ✓ Token found: **************************
```

### 常用命令

```bash
# 查看项目
glab repo view

# MR 操作
glab mr list
glab mr create --title "feat: xxx" --description "..."
glab mr view 123
glab mr merge 123

# Issue 操作
glab issue list
glab issue create --title "bug: xxx"

# CI/CD
glab ci status
glab ci view
```

## 配置文件位置

| 配置 | 路径 |
|------|------|
| SSH config | `~/.ssh/config` |
| SSH known_hosts | `~/.ssh/known_hosts` |
| glab config | `~/.config/glab-cli/config.yml` (Linux/macOS) |
| glab config | `%LOCALAPPDATA%\glab-cli\config.yml` (Windows) |
| Clash config | Clash Verge 配置目录 |

## 故障排查

### SSH 连接被关闭

```
Connection closed by 198.18.0.x port 22
```

原因：Clash fake-ip + 流量走代理。解决：添加 DIRECT 规则。

### Host key verification failed

```bash
# 清除旧记录（如有）
ssh-keygen -R gitlab.company.com

# 重新添加
ssh-keyscan gitlab.company.com >> ~/.ssh/known_hosts
```

### glab token 失效

```bash
# 重新登录
glab auth login --hostname gitlab.company.com
```

## 一句话总结

Clash TUN + 企业 GitLab = 域名直连规则 + SSH 密钥 + glab CLI。
