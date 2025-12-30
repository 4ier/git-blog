---
layout: post
title: "gh-cli多号进阶"
date: 2025-12-30
categories: [devops]
tags: [GitHub, SSH, gh, multi-account, automation, AI]
---

这是我对「同机多 GitHub 账号」的工程级方案说明书，已对用户名、组织名、主机别名、密钥名、token 等敏感信息做脱敏。目标很明确：个人与公司账号长期共存，且绝不串号。

<!-- more -->

## 核心原则

1) Git 与 gh 是两套系统  
Git 负责代码传输（SSH + Host），gh 负责 GitHub API（PR/issue/仓库操作）。GH_TOKEN 只用于 CI，不参与本地开发。

2) SSH Host 是身份真相源  
只要 remote 使用 `git@github-company:...` 就是公司身份，其他一律个人身份。

## 统一 SSH 结构（跨平台）

```
~/.ssh/
├── id_ed25519              # 个人账号 key
├── id_ed25519.pub
├── id_ed25519_company      # 公司账号 key
├── id_ed25519_company.pub
└── config
```

```
# 公司 GitHub
Host github-company
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_company
    IdentitiesOnly yes

# 个人 GitHub（默认）
Host github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

## gh 多账号的正确使用方式

- 本地登录两个账号（keyring/钥匙串保存）
- `gh auth status` 看到两个账号且没有 `(GH_TOKEN)`
- 一旦 GH_TOKEN 被注入（尤其是系统级变量），gh 会被锁死在单一身份

## Windows 方案要点

- 使用系统 OpenSSH + ssh-agent 常驻
- PowerShell 根据 `remote.origin.url` 自动切换 gh 账号
- 公司仓库含 `github-company` → 公司账号，否则 → 个人账号

## macOS 方案要点

- `ssh-add --apple-use-keychain` 加入钥匙串
- `.ssh/config` 开启 `UseKeychain yes`
- `zsh` 用 `chpwd` hook 自动切换 gh 账号

## 稳态验收

- 公司仓库目录：`gh auth status` → 公司账号
- 个人仓库目录：`gh auth status` → 个人账号
- 新开终端：`echo $GH_TOKEN` 无输出

## AI + gh：把 GitHub 变成可执行知识库

当 gh 在当前目录已经“正确指向账号”，AI 只需运行命令即可完成真实 GitHub 操作：查询代码实现、创建 PR、定位问题提交、生成仓库级分析。这比做静态 RAG 更工程化，因为数据永远来自实时代码。

## 一句话收尾

SSH Host 决定“谁在推代码”，gh 自动切换决定“谁在操作 GitHub”，GH_TOKEN 只存在于 CI。
