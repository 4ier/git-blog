---
layout: post
title: "gh-cli-skill进阶：多git账号方案"
date: 2025-12-30
categories: [devops]
tags: [GitHub, gh, SSH, multi-account, coding-agent, GitLab, Gitea]
---

这篇是我对「开发机多 Git 账号 + gh-cli 作为 coding agent 执行器」的工程化总结，已对账号、组织名、主机别名、密钥名、token 等敏感信息做脱敏。

<!-- more -->

## gh-cli 作为 coding agent 执行器

gh 把 GitHub API 变成一组可组合的本地命令。对 agent 来说，命令就是协议：可审计、可回放、可组合，且执行上下文由本地登录态决定。

示例：

```
gh repo view --json name,description,defaultBranchRef
gh pr list --limit 10
gh pr create --title "..." --body "..."
gh issue list
gh api repos/<org>/<repo>/contents/<path>
```

这也是「gh-cli-skill 进阶」的核心：把 GitHub 变成可执行的工作面，而不是一堆网页按钮。

## 多账号的本质模型

- Git（代码传输）= SSH key + Host
- gh（平台操作）= 本地登录态
- GH_TOKEN 只用于 CI，不参与开发机

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

## gh 多账号登录与自动切换

- `gh auth login` 分别登录两个账号
- `gh auth status` 应看到多个账号且无 `(GH_TOKEN)`
- 根据 `remote.origin.url` 自动切换 `gh auth switch`

核心规则只要一条：remote 包含 `github-company` 就切公司账号，否则切个人账号。把切换逻辑挂到 PowerShell prompt 或 zsh 的 `chpwd` hook，agent 进入仓库就自动拥有正确身份。

## PowerShell 自动切换（Windows）

把下面这段放进 `$PROFILE`：

```powershell
function Update-GhAccount {
    try {
        $remote = git config --get remote.origin.url 2>$null
        if (-not $remote) { return }

        if ($remote -match "github-company") {
            gh auth switch --hostname github.com --user company-user | Out-Null
        } else {
            gh auth switch --hostname github.com --user personal-user | Out-Null
        }
    } catch {}
}

function prompt {
    Update-GhAccount
    "PS $($executionContext.SessionState.Path.CurrentLocation)> "
}
```

## zsh 自动切换（macOS / Linux）

把下面这段放进 `~/.zshrc`：

```zsh
function gh_auto_switch() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return
  fi

  local remote
  remote=$(git config --get remote.origin.url 2>/dev/null)
  [[ -z "$remote" ]] && return

  if [[ "$remote" == *"github-company"* ]]; then
    gh auth switch --hostname github.com --user company-user >/dev/null 2>&1
  else
    gh auth switch --hostname github.com --user personal-user >/dev/null 2>&1
  fi
}

autoload -U add-zsh-hook
add-zsh-hook chpwd gh_auto_switch
gh_auto_switch
```

## 不止 GitHub：GitLab / Gitea 也能纳入

- gh 原生支持 GitHub.com 与 GitHub Enterprise Server。
- 若 GitLab / Gitea 提供 GitHub API 兼容层，可通过 `gh auth login --hostname <host>` 接入。
- 若不兼容，改用对应 CLI（如 `glab` / `tea`），但多账号隔离与自动切换的模型完全一致。

## 实战：glab CLI 配置企业 GitLab

以下是配置 `glab`（GitLab CLI）连接企业自建 GitLab 的完整过程。

### SSH 配置

在 `~/.ssh/config` 中添加企业 GitLab 的配置：

```
# GitLab 企业实例
Host gitlab.company.com
    HostName gitlab.company.com
    User git
    IdentityFile ~/.ssh/id_ed25519_company
    IdentitiesOnly yes
```

验证配置：

```bash
# 检查配置是否生效
grep -n "gitlab" ~/.ssh/config

# 检查密钥文件是否存在
ls -la ~/.ssh/id_ed25519_company
```

### glab auth login

```bash
glab auth login --hostname gitlab.company.com
```

交互式配置过程：

```
? What domains does this host use for the container registry and image
dependency proxy?
> gitlab.company.com,gitlab.company.com:443,registry.gitlab.company.com

? Choose default Git protocol:
  SSH          # <-- 选择 SSH，因为已配置密钥
  HTTPS
  HTTP

? Choose host API protocol:
> HTTPS        # <-- API 走 HTTPS
```

### 验证登录状态

```bash
glab auth status
```

输出示例：

```
gitlab.company.com
  ✓ Logged in to gitlab.company.com as company-user
    (C:\Users\username\AppData\Local\glab-cli\config.yml)
  ✓ Git operations for gitlab.company.com configured to use ssh protocol.
  ✓ API calls for gitlab.company.com are made over https protocol.
  ✓ REST API Endpoint: https://gitlab.company.com/api/v4/
  ✓ GraphQL Endpoint: https://gitlab.company.com/api/graphql/
  ✓ Token found: **************************
```

### glab 配置文件

glab 的配置文件位于 `~/.config/glab-cli/config.yml`（Linux/macOS）或 `%LOCALAPPDATA%\glab-cli\config.yml`（Windows）。

可通过 `glab config set` 修改配置：

```bash
# 设置默认主机
glab config set host gitlab.company.com --global

# 设置 token（如需手动配置）
glab config set token <your-token> --host gitlab.company.com
```

### 常见问题

**连接被关闭 (Connection closed)**

如果 `ssh -T git@gitlab.company.com` 显示连接被关闭，检查：
1. 网络/VPN 是否正常连接到企业网络
2. SSH 端口是否被防火墙阻挡
3. 密钥是否已添加到 GitLab 账户

**多 GitLab 实例切换**

glab 支持多主机配置，使用 `--hostname` 指定操作目标：

```bash
glab auth status                           # 显示所有主机状态
glab mr list --hostname gitlab.company.com # 指定主机操作
```

## 一句话收尾

SSH Host 决定"谁在推代码"，gh/glab 自动切换决定"谁在操作平台"，TOKEN 只存在于 CI。
