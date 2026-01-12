---
layout: post
title: "Agent Sandbox 平台分析报告"
---

## 目录
1. [平台特性对比表](#平台特性对比表)
2. [Genspark (E2B基础)](#genspark-e2b基础)
3. [OpenAI (自定义容器)](#openai-自定义容器)
4. [AnyGen (E2B基础)](#anygen-e2b基础)
5. [Manus (完整自定义方案)](#manus-完整自定义方案)
6. [技术架构分析](#技术架构分析)
7. [安全分析总结](#安全分析总结)
8. [平台评分总结](#平台评分总结)


<!-- more -->
---

## 平台特性对比表

| 特性 | Genspark | OpenAI Chat | OpenAI Agent | AnyGen | Manus |
|------|----------|-------------|--------------|--------|-------|
| **基础平台** | E2B | 自定义容器 | Kata容器 | E2B | E2B + 自定义 |
| **操作系统** | Debian 13 (trixie) | Debian 12 (bookworm) | Debian 12 (bookworm) | Ubuntu 24.04.3 | Ubuntu 22.04.5 |
| **内核版本** | 6.1.158 | 4.4.0 | 6.12.13 | 6.1.158 | 6.1.102 |
| **Init系统** | systemd | Supervisor | Supervisor | systemd | systemd |
| **用户** | user (1000:1000) | oai (1000:1000) | oai (1000:1000) | user (1001:1001) | ubuntu (1000:1000) |
| **容器化** | ✅ E2B容器 | ✅ Docker-like | ✅ Kata容器 | ✅ E2B容器 | ✅ E2B容器 |
| **网络IP** | 169.254.0.21/30 | 172.30.0.35/16 | 172.19.0.4/16 + 172.31.1.67/28 | 169.254.0.21/30 | 169.254.0.21/30 |
| **网关** | 169.254.0.22 | 172.30.0.1 | 172.19.0.1 | 169.254.0.22 | 169.254.0.22 |
| **Jupyter** | ✅ 端口8888 | ✅ 端口8080 | ✅ 端口8888 | ❌ | ❌ |
| **Chrome/Chromium** | ❌ | ❌ (禁用) | ✅ 可能启用 | ✅ 端口9222 | ✅ 端口9222 |
| **VNC** | ❌ | ❌ (禁用) | ✅ 端口5901/NEKO | ✅ 端口5900 | ✅ 端口5900 |
| **Code Server** | ❌ | ❌ | ❌ | ❌ | ✅ 端口8329 |
| **终端服务器** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **存储方案** | S3FS + AIDriveFUSE | Overlay | KataShared (virtiofs) | SharedVFS | 本地ext4 |
| **S3FS挂载** | ✅ 多个挂载点 | ❌ | ❌ | ❌ | ❌ |
| **包管理器** | dpkg/apt/pip/npm | dpkg/apt/pip/npm | dpkg/apt/pip/npm/nvm | dpkg/apt/pip/npm | dpkg/apt/pip/npm/pnpm/uv |
| **端口转发** | ❌ | ❌ | ❌ | ✅ socat | ✅ socat |
| **进程管理** | envd | supervisord | supervisord | envd | supervisord + envd |
| **安全限制** | 中等 | 严格 | 严格 | 中等 | 中等 |
| **sudo限制** | 部分 | 完全禁用 | 完全禁用 | 部分 | 部分 |
| **特殊服务** | - | Nebula VPN | NEKO/PDF Reader/rsync | browser_use | neko/playwright |
| **安全评分** | 6.5/10 | 7.0/10 | 7.5/10 | 7.0/10 | 5.5/10 |
| **综合评分** | 7.25/10 | 6.75/10 | 8.25/10 | 7.75/10 | 8.25/10 |

---

## Genspark (E2B基础)

### 环境标识
- **E2B标识**: `E2B_SANDBOX=true`, `E2B_SANDBOX_ID`, `E2B_TEMPLATE_ID`
- **平台标识**: `GENSPARK_BASE_URL`, `GENSPARK_ROUTE_IDENTIFIER`, `GENSPARK_TOKEN`
- **用户**: `user` (uid=1000, gid=1000)
- **HOME**: `/home/user`

### 系统环境
- **OS**: Debian GNU/Linux 13 (trixie)
- **Kernel**: Linux 6.1.158-x86_64
- **Init系统**: systemd (`/sbin/init`)
- **CGroup**: `0::/system.slice/envd.service`
- **容器化**: 是 (envd服务)
- **Uptime**: 37天10小时49分钟

### 核心服务

#### envd
- E2B平台的环境守护进程
- 管理容器生命周期

#### jupyter-server
- Jupyter服务器运行在端口8888
- 提供Notebook开发环境
- 使用uvicorn作为ASGI服务器

#### s3fs挂载
多个S3挂载点用于数据持久化：
- `/mnt/user-data/outputs` - 输出数据
- `/mnt/user-data/backups` - 备份数据
- `/mnt/user-data/uploads` - 上传数据
- `/mnt/knowledge` - 知识库
- `/mnt/skills` - 技能数据

#### AIDriveFUSE
- `/mnt/aidrive` - 自定义FUSE文件系统
- 用于AI驱动的存储访问

### 网络配置
- **IP地址**: `169.254.0.21/30` (eth0)
- **网关**: `169.254.0.22`
- **监听端口**:
  - `127.0.0.1:8888` (Jupyter)
  - `169.254.0.21:49999` (未知服务)
  - 多个随机高端口

### 存储方案
- **根文件系统**: `/dev/vda` ext4 (26G总容量)
- **S3FS挂载**: 显示64P (Pebibytes) 可用空间 (虚拟，实际由S3后端提供)
- **NPM缓存**: `/opt/npm-cache` - Node.js包缓存目录

### 包管理器
- `dpkg` - Debian包管理器
- `apt` - APT包管理器
- `pip` - Python包管理器
- `npm` - Node.js包管理器
- `corepack` - Node.js包管理器工具

### 安全特性
- `/proc/1/environ` 访问被拒绝 (权限控制)
- systemd服务受限访问
- `crontab` 不可用
- 部分sudo功能受限

### 安全风险评估

#### 敏感信息暴露
- ⚠️ **GENSPARK_TOKEN**: 明文存储在环境变量中 (`<REDACTED>`)
- ⚠️ **GENSPARK_ROUTE_IDENTIFIER**: 包含JWT token，暴露在环境变量中
- ⚠️ **E2B标识信息**: E2B_SANDBOX_ID、E2B_TEMPLATE_ID暴露

#### 安全措施
- ✅ `/proc/1/environ` 访问被拒绝，防止环境变量泄露
- ✅ 非root用户运行服务
- ✅ 部分sudo功能受限

#### 安全评分: 6.5/10
- 权限控制良好，但存在敏感信息明文存储问题

### 支持的特性
- **Jupyter Notebook** - 提供交互式Notebook开发环境，端口8888
- **S3FS存储** - 多个S3挂载点用于数据持久化（outputs、backups、uploads、knowledge、skills）
- **AIDriveFUSE** - 自定义FUSE文件系统用于AI驱动的存储访问
- **Python环境** - 完整的Python 3.12开发环境
- **Node.js环境** - 支持Node.js和npm包管理
- **多内核支持** - IPython内核和IJS内核（JavaScript）
- **端口转发** - 通过socat实现端口转发功能

### 进程列表 (关键进程)
```
envd                    # E2B环境守护进程
jupyter-server          # Jupyter服务器
uvicorn                 # ASGI服务器
ipykernel_launcher      # IPython内核
s3fs                    # S3文件系统挂载 (多个实例)
```

---

## OpenAI Chat (自定义容器 - Chat模式)

### 环境标识
- **用户**: `oai` (uid=1000, gid=1000, groups=1000,1001)
- **HOME**: `/home/oai`
- **工作目录**: `/home/oai/share`
- **挂载目录**: `/mnt/data`

### 系统环境
- **OS**: Debian GNU/Linux 12 (bookworm)
- **Kernel**: Linux 4.4.0 (较旧内核，可能是定制内核)
- **Init系统**: Supervisor (`/usr/bin/python3 /usr/bin/supervisord`)
- **CGroup**: Docker容器ID格式 (`pids:/84ccc21d86e9...`)
- **容器化**: 是 (Docker-like, overlay文件系统)
- **Uptime**: 9分钟 (新启动的容器)

### 核心服务

#### supervisord
- 进程管理器，作为PID 1运行
- 管理所有子进程

#### jupyter_server
- Jupyter服务器 (使用uvicorn)
- API端口: 8080
- 提供Notebook API服务

#### terminal-server
- 终端服务器
- 提供远程终端访问能力

#### log_forwarder
- 日志转发服务
- 将容器日志转发到外部系统

### 功能开关 (环境变量)
```
CUA_DD_ENABLE_CHROME=false          # Chrome禁用
CUA_DD_ENABLE_NOTEBOOK_SERVER=false # Notebook服务器禁用
CUA_DD_ENABLE_VNC=false             # VNC禁用
CUA_DD_INIT_TERMINAL_SERVER=true    # 终端服务器启用
CUA_DD_PYTHON_TOOL=true             # Python工具启用
CUA_DD_ENABLE_APPLY_PATCH=true      # 补丁应用启用
```

### 网络配置
- **IP地址**: `172.30.0.35/16` (eth0)
- **网关**: `172.30.0.1`
- **监听端口**:
  - `0.0.0.0:8080` (Jupyter Server API)
  - `127.0.0.1:1384` (未知服务)
  - 多个随机高端口

### 存储方案
- **根文件系统**: overlay (8.0E虚拟大小，实际由宿主机提供)
- **9p文件系统**: `/etc/hosts`, `/etc/hostname`, `/etc/resolv.conf` (只读挂载)
- **cgroup挂载**: 多个cgroup子系统

### 包管理器
- `dpkg`, `apt`, `pip`, `node`, `npm`, `corepack`

### 安全特性
- **sudo限制**: "no new privileges" 标志设置，完全阻止sudo提权
- **systemd不可用**: 非systemd环境，使用supervisor
- **netlink限制**: `ss`命令失败 (协议不支持，可能是内核限制)
- **supervisor权限**: 用户无法查询supervisor状态 (权限控制)
- **进程隔离**: 严格的进程隔离

### 安全风险评估

#### 敏感信息暴露
- ⚠️ **CAAS_ARTIFACTORY_READER_PASSWORD**: 明文密码暴露 (`<REDACTED>`)
- ⚠️ **NEKO_PASSWORD**: 弱密码暴露 (`neko`)
- ⚠️ **NEKO_PASSWORD_ADMIN**: 弱密码暴露 (`admin`)
- ⚠️ **环境变量可访问**: `/proc/1/environ` 可能可访问（进程以root运行）

#### 安全措施
- ✅ sudo完全禁用 ("no new privileges")
- ✅ 严格的进程隔离
- ✅ supervisor权限控制
- ⚠️ 进程以root用户运行（PID 1）

#### 安全评分: 7.0/10
- 权限控制严格，但存在弱密码和可能的root进程风险

### 支持的特性
- **Jupyter Server API** - 提供Notebook API服务，端口8080
- **终端服务器** - 提供远程终端访问能力
- **日志转发** - log_forwarder服务将容器日志转发到外部系统
- **Nebula VPN** - VPN连接或网络隧道支持
- **Python工具** - 完整的Python开发环境
- **包管理代理** - 通过内部Artifactory代理访问各种包仓库（npm、pip、maven等）

### 特殊配置

#### Nebula VPN
```
NEBULA_RUN=<value>
NEBULA_USER=<value>
NEBULA_VM_ID=<value>
```
- 可能用于VPN连接或网络隧道

#### Chrome配置 (虽然禁用)
```
CHROME_USER_DATA_DIR=/home/oai/.chromium
CHROMIUM_VERSION=133
```
- 配置存在但功能被禁用

#### VNC配置 (虽然禁用)
```
VNC_PORT=5901
NEKO_BIND=<value>
NEKO_PASSWORD=<value>
NEKO_PASSWORD_ADMIN=<value>
```
- Neko相关配置，但VNC被禁用

### 进程列表 (关键进程)
```
supervisord            # 进程管理器 (PID 1)
log_forwarder          # 日志转发
uvicorn                # Jupyter服务器
terminal-server        # 终端服务器
ipykernel_launcher     # IPython内核
```

---

## OpenAI Agent (Kata容器 - Agent模式)

### 环境标识
- **用户**: `oai` (uid=1000, gid=1000, groups=1000,1001)
- **HOME**: `/home/oai`
- **工作目录**: `/home/oai/share`
- **挂载目录**: `/mnt/data`
- **共享目录**: `/home/oai/share` (通过rsync同步)

### 系统环境
- **OS**: Debian GNU/Linux 12 (bookworm)
- **Kernel**: Linux 6.12.13 (较新内核)
- **Init系统**: Supervisor (`/usr/bin/python3 /usr/bin/supervisord`)
- **CGroup**: `0::/` (Kata容器)
- **容器化**: 是 (Kata Containers, virtiofs文件系统)
- **Uptime**: 1分钟 (新启动的容器)

### 核心服务

#### supervisord
- 进程管理器，作为PID 1运行
- 管理所有子进程

#### notebook_server (Jupyter)
- Jupyter Notebook服务器
- 端口: 8888
- 无token认证 (`--NotebookApp.token=''`)
- 监听所有接口 (`--ip 0.0.0.0`)

#### rsync_daemon
- rsync守护进程
- 端口: 873
- 用于文件同步和共享

#### sync_share
- 文件同步服务
- 使用inotify监控文件变化
- 同步 `/home/oai/share/` 目录

#### log_forwarder
- 日志转发服务
- 将容器日志转发到外部系统

### 功能开关 (环境变量)
```
CUA_DD_ENABLE_CHROME=              # Chrome启用 (空值表示启用)
CUA_DD_ENABLE_NOTEBOOK_SERVER=true  # Notebook服务器启用
CUA_DD_TERMINAL_MODE=true          # 终端模式启用
CUA_DD_PDF_READER_SERVICE=true     # PDF阅读器服务启用
CUA_DD_ENABLE_APPLY_PATCH=true     # 补丁应用启用
```

### 网络配置
- **IP地址**: 
  - `172.19.0.4/16` (eth0) - 主网络接口
  - `172.31.1.67/28` (eth1) - 辅助网络接口
- **网关**: `172.19.0.1` (eth0)
- **监听端口**:
  - `0.0.0.0:8888` (Jupyter Notebook)
  - `0.0.0.0:873` (rsync)
  - `127.0.0.1:323` (chronyd)

### 存储方案
- **根文件系统**: `/dev/vda` ext4 (63G总容量, 11%使用, stripe=128)
- **KataShared (virtiofs)**: 
  - `/etc/resolv.conf` - DNS配置
  - `/etc/hostname` - 主机名
  - `/etc/hosts` - 主机文件
- **tmpfs**: 
  - `/dev` (64M)
  - `/dev/shm` (989M)
  - `/proc/interrupts`, `/proc/keys`, `/proc/timer_list`

### 包管理器
- `dpkg`, `apt`, `pip`, `node` (v22.16.0 via NVM), `npm` (v10.9.2), `corepack`

### 特殊配置

#### Chrome/Chromium配置
```
CDP_PORT=9222                        # Chrome DevTools端口
CHROME_USER_DATA_DIR=/home/oai/.chromium
CHROMIUM_VERSION=133
CHROMIUM_POLICY_DIR=/etc/chromium/policies/managed
POLICY_CATALOG_DIR=/usr/local/chromium/policies/managed
```
- Chrome可能启用 (CUA_DD_ENABLE_CHROME为空)
- 已安装chromium包

#### VNC/NEKO配置
```
DISPLAY=:0
DISPLAY_RESOLUTION=1024x768x24
DISPLAY_SCALE_FACTOR=0.8
DISPLAY_SIZE=1280,960
VNC_PORT=5901
NEKO_BIND=127.0.0.1:8081
NEKO_DISPLAY=:0
NEKO_PORT=8081
NEKO_PROXY_PORT=8082
NEKO_SCREEN=1024x768@0
NEKO_VIDEO_CODEC=h264
```
- NEKO WebRTC桌面共享配置完整
- 已安装x11vnc、xvfb、websockify等VNC相关包

#### PDF Reader服务
```
PDF_READER_PORT=8451
PDF_READER_FETCH_TIMEOUT=120
PDF_READER_PARSE_TIMEOUT=10
```
- 独立的PDF阅读器服务

#### 文件同步配置
```
OAI_SHARE_DIR=/home/oai/share
OAI_SHARE_SLIDES_DIR=/home/oai/share/slides
REMOTE_SHARE_HOST=chrome.local
```
- 使用rsync进行文件同步
- 支持slides目录

#### 代理配置
```
ALL_PROXY=socks5://proxy.local:8888
HTTP_PROXY=http://proxy.local:8889
HTTPS_PROXY=http://proxy.local:8889
NO_PROXY=localhost,127.0.0.1
```
- 完整的代理配置
- 支持SOCKS5和HTTP代理

#### NVM配置
```
NVM_DIR=/opt/nvm
NODE_VERSION=22.16.0
NODE_INSTALL_PATH=/opt/nvm/versions/node/v22.16.0
NODE_PATH=/opt/nvm/versions/node/v22.16.0/lib/node_modules
```
- Node.js版本管理
- 全局包包括tailwindcss、typescript、sharp等

#### Python环境
```
PATH包含: /opt/pyvenv/bin
```
- Python虚拟环境
- 已安装大量科学计算包 (numpy, pandas, scikit-learn, matplotlib等)

### 安全特性
- **sudo限制**: "no new privileges" 标志设置，完全阻止sudo提权
- **systemd不可用**: 非systemd环境，使用supervisor
- **文件系统只读**: `/sys` 只读挂载
- **supervisor权限**: 用户无法查询supervisor状态 (权限控制)
- **进程隔离**: Kata容器提供更强的隔离

### 安全风险评估

#### 敏感信息暴露
- ⚠️ **NEKO_PASSWORD**: 弱密码暴露 (`neko`)
- ⚠️ **NEKO_PASSWORD_ADMIN**: 弱密码暴露 (`admin`)
- ⚠️ **Jupyter Notebook**: 无token认证，端口8888对外开放
- ⚠️ **rsync服务**: 端口873对外开放，可能存在未授权访问风险

#### 安全措施
- ✅ `/proc/1/environ` 访问被拒绝
- ✅ sudo完全禁用
- ✅ Kata容器提供更强的隔离性
- ✅ 文件系统只读挂载
- ✅ 进程以root运行但权限受限

#### 安全评分: 7.5/10
- 容器隔离性强，但存在无认证服务和弱密码问题

### 支持的特性
- **Jupyter Notebook** - 完整的Notebook服务器，端口8888，无token认证
- **Chrome/Chromium** - 浏览器支持（可能启用），远程调试端口9222
- **VNC/NEKO** - WebRTC桌面共享，支持NEKO和x11vnc
- **PDF阅读器服务** - 独立的PDF阅读器服务，端口8451
- **文件同步** - rsync守护进程和sync_share服务，支持文件同步和共享
- **终端服务器** - 提供远程终端访问能力
- **代理支持** - 完整的SOCKS5和HTTP代理配置
- **NVM** - Node.js版本管理，支持多版本切换
- **Python虚拟环境** - 预配置的Python虚拟环境
- **科学计算库** - 预装numpy、pandas、scikit-learn等科学计算包
- **图形工具** - inkscape、libreoffice、imagemagick等图形处理工具

### 已安装的关键包
- **浏览器**: chromium (141.0.7390.122)
- **VNC**: x11vnc, xvfb, websockify
- **开发工具**: git, vim, jq, curl, wget
- **图形工具**: inkscape, libreoffice, imagemagick
- **科学计算**: python3-numpy, python3-pandas, scikit-learn
- **PDF处理**: poppler, pdf2image (Python包)

### 进程列表 (关键进程)
```
supervisord            # 进程管理器 (PID 1)
log_forwarder          # 日志转发
notebook_server        # Jupyter Notebook服务器
rsync_daemon           # rsync守护进程
sync_share             # 文件同步服务
inotifywait            # 文件监控
python -m notebook     # Jupyter Notebook进程
```

### 与Chat模式的主要区别
1. **内核更新**: 6.12.13 vs 4.4.0
2. **容器技术**: Kata Containers vs Docker-like
3. **网络配置**: 双网卡 vs 单网卡
4. **Jupyter端口**: 8888 vs 8080
5. **Chrome状态**: 可能启用 vs 禁用
6. **VNC支持**: 完整配置 vs 禁用
7. **文件同步**: rsync服务 vs 无
8. **PDF服务**: 独立服务 vs 无
9. **存储方案**: virtiofs vs overlay
10. **包丰富度**: 更多图形和科学计算包

---

## AnyGen (E2B基础)

### 环境标识
- **E2B标识**: `E2B_SANDBOX=true`, `E2B_SANDBOX_ID`, `E2B_TEMPLATE_ID`
- **平台标识**: `ANYGEN_ACCESS_TOKEN`, `ANYGEN_SERVER_API_DOMAIN`
- **用户**: `user` (uid=1001, gid=1001)
- **HOME**: `/home/user`
- **工作目录**: `/home/user/workspace`

### 系统环境
- **OS**: Ubuntu 24.04.3 LTS (Noble Numbat)
- **Kernel**: Linux 6.1.158-x86_64
- **Init系统**: systemd (`/sbin/init`)
- **CGroup**: `0::/user`
- **容器化**: 是
- **Uptime**: 17小时30分钟

### 核心服务

#### envd
- E2B平台的环境守护进程

#### Xvfb (X Virtual Framebuffer)
- 虚拟X服务器
- 显示: `:1`
- 分辨率: 1280x1024x24
- 用于无头环境下的图形应用

#### fluxbox
- 轻量级窗口管理器
- 提供基本的窗口管理功能

#### Chrome浏览器
- Google Chrome浏览器
- 配置参数:
  - `--remote-debugging-port=9222` - 远程调试端口
  - `--remote-debugging-address=0.0.0.0` - 允许外部访问
  - `--user-data-dir=/home/user/.config/browser` - 用户数据目录
  - `--no-first-run` - 跳过首次运行
  - `--disable-gpu` - 禁用GPU加速
  - `--ozone-platform=x11` - 使用X11平台

#### x11vnc
- VNC服务器
- 端口: 5900
- 共享模式，无密码访问

#### websockify/noVNC
- Web VNC代理
- 端口: 6080
- 提供基于Web的VNC客户端

#### browser_use
- HTTP服务
- 端口: 8000
- 提供浏览器自动化API

#### socat
- 端口转发工具
- 将 `169.254.0.21:9222` 转发到 `localhost:9222`
- 允许外部访问Chrome调试端口

#### SharedVFS
- FUSE文件系统
- 挂载点: `/home/user/shared`
- 用于共享存储

### 网络配置
- **IP地址**: `169.254.0.21/30` (eth0)
- **网关**: `169.254.0.22`
- **监听端口**:
  - `0.0.0.0:8000` (browser_use)
  - `0.0.0.0:5900` (x11vnc)
  - `0.0.0.0:6080` (websockify)
  - `169.254.0.21:9222` (Chrome调试端口转发)
  - `127.0.0.1:9222` (Chrome本地调试)
  - `0.0.0.0:22` (SSH)

### 存储方案
- **根文件系统**: `/dev/vda` ext4 (37G总容量, 46%使用)
- **SharedVFS**: FUSE文件系统用于共享存储
- **tmpfs**: `/dev/shm` (3.9G), `/run` (1.6G)

### 包管理器
- `dpkg`, `apt`, `pip`, `node`, `npm`, `corepack`

### 安全风险评估

#### 敏感信息暴露
- ⚠️ **ANYGEN_ACCESS_TOKEN**: 明文存储在环境变量中 (`<REDACTED>`)
- ⚠️ **OPENAI_API_KEY**: 明文API密钥暴露 (`<REDACTED>`)

#### 安全措施
- ✅ `/proc/1/environ` 访问被拒绝
- ✅ 非root用户运行服务
- ✅ 容器隔离

#### 安全评分: 7.0/10
- 基础安全措施到位，但API密钥明文存储

### 支持的特性
- **Chrome浏览器** - Google Chrome浏览器，远程调试端口9222
- **VNC服务器** - x11vnc服务器，端口5900，支持共享模式
- **Web VNC** - websockify/noVNC提供基于Web的VNC客户端，端口6080
- **Xvfb** - 虚拟X服务器，显示:1，分辨率1280x1024x24
- **fluxbox** - 轻量级窗口管理器
- **browser_use** - 浏览器自动化API服务，端口8000
- **socat端口转发** - 将Chrome调试端口转发到外部IP
- **SharedVFS** - FUSE文件系统用于共享存储
- **Puppeteer** - 配置支持Puppeteer浏览器自动化
- **OpenAI API代理** - 通过代理访问OpenAI API

### 特殊配置

#### Puppeteer
```
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```
- 配置Puppeteer使用Chrome

#### Python环境
```
VIRTUAL_ENV=/home/user/.venv
PYTHONPATH=/mnt/aglib
```
- Python虚拟环境
- 自定义Python路径

#### OpenAI API代理
```
OPENAI_API_BASE=https://www.anygen.io/api/page/llm_proxy/v1
OPENAI_API_KEY=<token>
OPENAI_BASE_URL=https://www.anygen.io/api/page/llm_proxy/v1
```
- 通过代理访问OpenAI API

### 进程列表 (关键进程)
```
envd                    # E2B环境守护进程
Xvfb                    # 虚拟X服务器
fluxbox                 # 窗口管理器
chrome                  # Chrome浏览器 (主进程)
chrome (多个子进程)      # Chrome渲染进程
x11vnc                  # VNC服务器
websockify              # Web VNC代理
browser_use             # 浏览器自动化服务
socat                   # 端口转发
shared_vfs_fuse.py      # FUSE文件系统
```

---

## Manus (完整自定义方案)

### 环境标识
- **用户**: `ubuntu` (uid=1000, gid=1000)
- **HOME**: `/home/ubuntu`
- **平台标识**: `APP_DOMAIN`, `RUNTIME_API_HOST`, `OPENAI_API_BASE`

### 系统环境
- **OS**: Ubuntu 22.04.5 LTS (Jammy Jellyfish)
- **Kernel**: Linux 6.1.102-x86_64
- **Init系统**: systemd (`/sbin/init nomodules`)
- **CGroup**: `0::/system.slice/supervisor.service`
- **容器化**: 是 (`.dockerenv`存在, E2B基础)
- **Uptime**: 2天18小时54分钟

### 核心服务

#### envd
- E2B环境守护进程 (两个实例运行)
- 一个运行 `/usr/bin/envd-v0.0.1`
- 另一个运行 `/usr/bin/envd -cmd /e2b-startup.sh`

#### supervisord
- 进程管理器
- 管理多个服务进程

#### Xorg
- X服务器
- 显示: `:0`
- 配置文件: `/etc/X11/xorg.conf`

#### x11vnc
- VNC服务器
- 端口: 5900
- 分辨率: 1280x1029
- 共享模式，允许文件传输

#### websockify
- WebSocket代理
- 端口: 5901
- Web目录: `/opt/.manus/.packages/chrome-extensions/manus-helper`

#### Chromium浏览器
- Chromium浏览器
- 配置参数:
  - `--remote-debugging-port=9222` - 远程调试端口
  - `--load-extension` - 加载扩展 (ublock-lite, manus-helper)
  - `--user-data-dir=/home/ubuntu/.browser_data_dir` - 用户数据目录
  - `--disable-gpu` - 禁用GPU
  - `--use-angle=swiftshader-webgl` - 软件渲染
  - `--ozone-override-screen-size=1280,1029` - 屏幕尺寸

#### code-server
- VS Code Web版本
- 端口: 8329
- 配置: `/home/ubuntu/.config/code-server/config.yaml`
- 禁用工作区信任

#### manus-mcp-cli
- MCP CLI服务器
- 端口: 8350
- 提供MCP协议服务

#### neko
- WebRTC桌面共享服务器
- 端口: 8333
- 配置: `/opt/.manus/neko/config/neko.yml`
- 使用Cloudflare STUN/TURN服务器

#### start_server
- Manus主服务器
- 端口: 8330 (外部), 9330 (内部)
- 提供核心API服务

#### upgrade
- 升级服务
- 端口: 8340
- 处理系统升级

#### playwright
- Playwright驱动
- 提供浏览器自动化能力

#### statesync
- 状态同步服务
- 配置: `/home/ubuntu/.config/state-sync/state-sync-config.yaml`
- 同步状态到外部存储

#### socat (多个实例)
- 端口转发工具
- `9330`: 169.254.0.21 -> localhost:9330
- `9222`: 169.254.0.21 -> localhost:9222
- `8350`: 169.254.0.21 -> localhost:8350

### 网络配置
- **IP地址**: `169.254.0.21/30` (eth0)
- **网关**: `169.254.0.22`
- **监听端口**:
  - `0.0.0.0:22` (SSH)
  - `0.0.0.0:5900` (x11vnc)
  - `0.0.0.0:5901` (websockify)
  - `0.0.0.0:8329` (code-server)
  - `0.0.0.0:8330` (start_server)
  - `0.0.0.0:8333` (neko)
  - `0.0.0.0:8340` (upgrade)
  - `127.0.0.1:8350` (manus-mcp-cli)
  - `127.0.0.1:9330` (start_server内部)
  - `127.0.0.1:9222` (Chromium调试)

### 存储方案
- **根文件系统**: `/dev/vda` ext4 (42G总容量, 24%使用)
- **Manus目录**: `/opt/.manus/`
  - `current/` - 当前版本
  - `neko/` - Neko服务器
  - `.packages/` - 包和扩展
  - `.sandbox-runtime/` - 运行时环境
  - `deploy/` - 部署模板

### 包管理器
- `dpkg`, `apt`, `pip`, `node`, `npm`, `pnpm`, `corepack`, `uv`, `code-server`

### 特殊配置

#### NVM (Node Version Manager)
```
NVM_DIR=/home/ubuntu/.nvm
NVM_BIN=/home/ubuntu/.nvm/versions/node/v22.13.0/bin
```
- Node.js版本管理

#### PNPM
```
PNPM_HOME=/home/ubuntu/.local/share/pnpm
```
- PNPM包管理器

#### Chrome扩展
- `ublock-lite` - 广告拦截扩展
- `manus-helper` - Manus辅助扩展

#### OpenTelemetry
```
OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online
OTEL_SERVICE_NAME=sandbox-runtime
```
- 遥测和监控

#### Sentry
```
SENTRY_DSN=https://...@sentry.butterflyotel.online/9
```
- 错误追踪

### 安全风险评估

#### 敏感信息暴露
- 🔴 **OPENAI_API_KEY**: 明文API密钥暴露 (`sk-<REDACTED>`)
- ⚠️ **CODE_SERVER_PASSWORD**: 明文密码暴露 (`<REDACTED>`)
- ⚠️ **NEKO_ADMIN_PASSWORD**: 明文密码暴露 (`<REDACTED>`)
- ⚠️ **NEKO_USER_PASSWORD**: 明文密码暴露 (`<REDACTED>`)
- ⚠️ **SENTRY_DSN**: 包含token的DSN暴露 (`https://<REDACTED>@sentry.example.com/9`)
- ⚠️ **GH_TOKEN**: 环境变量存在但为空（可能泄露）
- ⚠️ **GOOGLE_DRIVE_TOKEN**: 环境变量存在但为空（可能泄露）
- ⚠️ **Neko WebRTC凭证**: Cloudflare TURN服务器用户名和密码暴露在进程参数中

#### 安全措施
- ✅ `/proc/1/environ` 访问被拒绝
- ✅ 非root用户运行服务
- ✅ 容器隔离
- ✅ 部分sudo功能受限

#### 安全评分: 5.5/10
- 存在大量敏感信息明文暴露，包括API密钥、密码和凭证

### 支持的特性
- **Chromium浏览器** - Chromium浏览器，远程调试端口9222，加载ublock-lite和manus-helper扩展
- **VNC服务器** - x11vnc服务器，端口5900，分辨率1280x1029
- **WebSocket VNC** - websockify提供Web VNC代理，端口5901
- **Code Server** - VS Code Web版本，端口8329
- **Neko** - WebRTC桌面共享服务器，端口8333，使用Cloudflare STUN/TURN
- **Manus主服务器** - start_server提供核心API服务，端口8330（外部）和9330（内部）
- **MCP CLI服务器** - manus-mcp-cli提供MCP协议服务，端口8350
- **升级服务** - upgrade服务处理系统升级，端口8340
- **Playwright** - Playwright驱动提供浏览器自动化能力
- **状态同步** - statesync服务同步状态到外部存储
- **端口转发** - 多个socat实例实现端口转发（9330、9222、8350）
- **Manus Helper扩展** - 浏览器扩展，提供文章提取、关键词查找、元素高亮、Cookie自动接受、图片提取、点击可视化、元素定位、PDF内容提取、页面加载检测、网络请求跟踪等功能
- **uBlock Lite扩展** - 广告拦截扩展
- **OpenTelemetry** - 遥测和监控支持
- **Sentry** - 错误追踪和监控

### 目录结构特点
```
/opt/.manus/
├── current/              # 当前版本
│   ├── start_server     # 主服务器
│   ├── upgrade          # 升级程序
│   └── assets/          # 资源文件
├── neko/                 # Neko服务器
├── .packages/           # 包和扩展
│   ├── chrome-extensions/
│   └── scripts/
├── .sandbox-runtime/    # 运行时环境
└── deploy/              # 部署模板

/home/ubuntu/
├── .browser_data_dir/   # 浏览器数据
├── .config/
│   ├── code-server/     # Code Server配置
│   └── state-sync/      # 状态同步配置
└── .nvm/                # NVM
```

### 进程列表 (关键进程)
```
envd                    # E2B环境守护进程 (2个实例)
supervisord             # 进程管理器
Xorg                    # X服务器
x11vnc                  # VNC服务器
websockify              # Web VNC代理
chromium-browser        # Chromium浏览器 (主进程)
chromium-browser (多个)  # Chromium渲染进程
code-server             # VS Code Web
manus-mcp-cli           # MCP CLI服务器
neko                    # WebRTC桌面共享
start_server            # Manus主服务器
upgrade                 # 升级服务
playwright              # Playwright驱动
statesync               # 状态同步
socat (多个)            # 端口转发
```

---

## 技术架构分析

### 1. 容器化基础

#### 共同特征
- **所有平台都使用容器化**: Docker或类似技术
- **E2B基础**: Genspark、AnyGen、Manus使用E2B平台
- **自定义容器**: OpenAI使用自定义容器方案

#### 容器标识
- **E2B容器**: 
  - 环境变量: `E2B_SANDBOX=true`
  - CGroup路径包含 `envd.service` 或 `user`
  - IP地址: `169.254.0.21/30`
  - 网关: `169.254.0.22`
- **Docker容器**:
  - `.dockerenv` 文件存在
  - CGroup路径包含容器ID
  - 使用overlay文件系统
  - IP地址: `172.30.0.x/16` 或 `172.17.0.x/16`
- **Kata容器**:
  - CGroup路径: `0::/`
  - 使用virtiofs文件系统 (kataShared)
  - 双网卡配置 (主网卡 + 辅助网卡)
  - 更强的隔离性

### 2. 网络架构

#### IP地址分配模式
- **E2B模式**: `169.254.0.21/30` (链路本地地址)
  - 子网: `169.254.0.20/30`
  - 网关: `169.254.0.22`
  - 特点: 使用链路本地地址段，避免与公网冲突
- **Docker模式**: `172.30.0.x/16` 或 `172.17.0.x/16`
  - 标准Docker网络
  - 网关通常是 `.1`
- **Kata模式**: `172.19.0.x/16` + `172.31.x.x/28` (双网卡)
  - 主网卡: 标准Docker网络段
  - 辅助网卡: 可能用于特殊网络需求
  - 网关: `172.19.0.1`

#### 端口转发策略
- **socat**: 用于将外部IP的端口转发到localhost
- **常见转发**:
  - Chrome调试端口: `9222`
  - 应用服务端口: `9330`, `8350`等
- **目的**: 允许外部访问内部服务，同时保持安全性

#### 服务暴露模式
- **内部服务**: 仅监听 `127.0.0.1` (localhost)
- **外部服务**: 监听 `0.0.0.0` (所有接口) 或特定IP
- **VNC/Web服务**: 通常监听 `0.0.0.0` 以允许外部访问

### 3. 存储架构

#### 文件系统类型
1. **根文件系统**: ext4 (持久化)
   - Genspark: 26G
   - AnyGen: 37G
   - Manus: 42G
2. **S3FS**: 云存储挂载 (Genspark)
   - 多个挂载点
   - 虚拟64P空间
3. **FUSE文件系统**: 
   - AIDriveFUSE (Genspark)
   - SharedVFS (AnyGen)
4. **Overlay**: Docker容器 (OpenAI Chat)
   - 8.0E虚拟大小
5. **KataShared (virtiofs)**: Kata容器 (OpenAI Agent)
   - `/etc/resolv.conf`, `/etc/hostname`, `/etc/hosts` 通过virtiofs挂载
   - 提供更好的性能和隔离性

#### 数据持久化策略
- **用户数据**: `/home/user` 或 `/home/ubuntu`
- **应用数据**: `/opt/.manus/` (Manus)
- **浏览器数据**: `~/.browser_data_dir/` 或 `~/.config/browser/`
- **云存储**: S3FS挂载点 (Genspark)

### 4. 进程管理

#### Init系统选择
- **systemd**: Genspark, AnyGen, Manus
  - 完整的系统服务管理
  - 支持服务依赖和自动重启
- **Supervisor**: OpenAI
  - 轻量级进程管理
  - 适合容器环境
- **envd**: E2B平台的环境守护进程
  - 管理E2B特定功能

#### 进程管理器
- **supervisord**: 用于管理多个服务
  - 配置文件: `/etc/supervisor/supervisord.conf`
  - 支持进程组和优先级
- **systemd**: 系统级服务管理
  - 服务文件: `/etc/systemd/system/`
  - 支持服务依赖和资源限制
- **自定义脚本**: 启动脚本管理服务
  - `/startup.sh`, `/e2b-startup.sh`

### 5. 浏览器集成

#### Chrome/Chromium配置
- **远程调试**: `--remote-debugging-port=9222`
- **用户数据目录**: 独立目录避免冲突
  - `--user-data-dir=/home/user/.config/browser`
  - `--user-data-dir=/home/ubuntu/.browser_data_dir`
- **扩展加载**: `--load-extension`
  - Manus: ublock-lite, manus-helper
- **沙箱禁用**: `--no-zygote-sandbox` (某些情况)
- **GPU禁用**: 
  - `--disable-gpu`
  - `--use-angle=swiftshader-webgl` (软件渲染)

#### VNC/远程桌面
- **x11vnc**: VNC服务器
  - 端口: 5900
  - 共享模式，无密码或固定密码
- **websockify/noVNC**: Web VNC客户端
  - 端口: 5901 或 6080
  - 提供基于Web的VNC访问
- **Xvfb**: 虚拟X服务器 (无头环境)
  - 显示: `:1`
  - 分辨率: 1280x1024x24
- **Xorg**: 真实X服务器 (有显示设备)
  - 显示: `:0`
  - 配置文件: `/etc/X11/xorg.conf`

### 6. 开发工具集成

#### Jupyter
- **Jupyter Server**: 提供Notebook服务
- **端口**: 8888 (标准) 或 8080
- **API端口**: 通常与Web端口分离
- **内核**: IPython内核 (ipykernel_launcher)

#### Code Server
- **VS Code Web**: 基于Web的IDE
- **配置**: YAML配置文件
- **端口**: 8329 (Manus)
- **特性**: 禁用工作区信任

#### 终端服务器
- **terminal-server**: 提供远程终端访问
- **SSH**: 标准SSH服务 (端口22)

### 7. 安全机制

#### 权限控制
- **非root用户**: 所有服务以非root运行
- **sudo限制**: 
  - OpenAI: 完全禁用 ("no new privileges")
  - 其他: 部分限制
- **文件权限**: `/proc/1/environ` 访问被拒绝

#### 网络隔离
- **私有网络**: 容器使用私有IP
- **端口过滤**: 仅暴露必要端口
- **防火墙**: iptables规则限制

#### 进程隔离
- **CGroup**: 资源限制和隔离
- **命名空间**: PID、网络、挂载等命名空间隔离

---

## 安全分析总结

### 敏感信息暴露情况

#### 高风险暴露
1. **API密钥和Token**
   - Genspark: GENSPARK_TOKEN, GENSPARK_ROUTE_IDENTIFIER (JWT)
   - AnyGen: ANYGEN_ACCESS_TOKEN, OPENAI_API_KEY
   - Manus: OPENAI_API_KEY (sk-开头), SENTRY_DSN

2. **密码和凭证**
   - OpenAI Chat: CAAS_ARTIFACTORY_READER_PASSWORD, NEKO弱密码
   - OpenAI Agent: NEKO弱密码
   - Manus: CODE_SERVER_PASSWORD, NEKO_ADMIN_PASSWORD, NEKO_USER_PASSWORD, WebRTC凭证

3. **无认证服务**
   - OpenAI Agent: Jupyter Notebook无token，rsync服务对外开放

#### 安全措施对比

| 平台 | /proc/1/environ保护 | sudo限制 | root进程 | 容器隔离 | 敏感信息保护 |
|------|-------------------|---------|---------|---------|------------|
| Genspark | ✅ | 部分 | ❌ | ✅ | ⚠️ 明文token |
| OpenAI Chat | ⚠️ | 完全禁用 | ✅ | ✅ | ⚠️ 弱密码 |
| OpenAI Agent | ✅ | 完全禁用 | ✅ | ✅✅ (Kata) | ⚠️ 无认证服务 |
| AnyGen | ✅ | 部分 | ❌ | ✅ | ⚠️ 明文API key |
| Manus | ✅ | 部分 | ❌ | ✅ | 🔴 大量暴露 |

### 安全建议

1. **敏感信息管理**
   - 使用密钥管理服务（如AWS Secrets Manager、HashiCorp Vault）
   - 避免在环境变量中明文存储敏感信息
   - 使用临时凭证和定期轮换

2. **服务认证**
   - 所有对外服务应启用认证（Jupyter、VNC、Code Server等）
   - 使用强密码或密钥认证
   - 实施最小权限原则

3. **进程权限**
   - 避免以root用户运行应用进程
   - 使用非特权用户运行所有服务
   - 实施"no new privileges"标志

4. **容器安全**
   - 使用只读文件系统挂载
   - 限制容器能力（capabilities）
   - 使用更强的隔离技术（如Kata Containers）

5. **监控和审计**
   - 实施日志记录和监控
   - 定期审计敏感信息访问
   - 检测异常行为

---

## 平台评分总结

### 综合评分表

| 平台 | 功能完整性 | 安全性 | 易用性 | 可扩展性 | 综合评分 |
|------|-----------|--------|--------|---------|---------|
| **Genspark** | 7.5/10 | 6.5/10 | 8.0/10 | 7.0/10 | **7.25/10** |
| **OpenAI Chat** | 6.0/10 | 7.0/10 | 7.5/10 | 6.5/10 | **6.75/10** |
| **OpenAI Agent** | 9.0/10 | 7.5/10 | 8.0/10 | 8.5/10 | **8.25/10** |
| **AnyGen** | 8.0/10 | 7.0/10 | 8.5/10 | 7.5/10 | **7.75/10** |
| **Manus** | 9.5/10 | 5.5/10 | 9.0/10 | 9.0/10 | **8.25/10** |

### 评分说明

#### 功能完整性 (0-10)
- **Genspark (7.5)**: Jupyter + S3FS，功能较基础
- **OpenAI Chat (6.0)**: 仅终端和Jupyter API，功能最少
- **OpenAI Agent (9.0)**: 完整功能集，包括浏览器、VNC、PDF等
- **AnyGen (8.0)**: 浏览器自动化完整，但缺少Code Server
- **Manus (9.5)**: 功能最全面，包括Code Server、MCP、Neko等

#### 安全性 (0-10)
- **Genspark (6.5)**: 基础安全措施，但token明文存储
- **OpenAI Chat (7.0)**: 权限控制严格，但存在弱密码
- **OpenAI Agent (7.5)**: Kata容器隔离强，但无认证服务
- **AnyGen (7.0)**: 基础安全到位，但API密钥暴露
- **Manus (5.5)**: 大量敏感信息暴露，安全风险最高

#### 易用性 (0-10)
- **Genspark (8.0)**: E2B平台，易于使用
- **OpenAI Chat (7.5)**: 轻量级，简单直接
- **OpenAI Agent (8.0)**: 功能丰富但配置复杂
- **AnyGen (8.5)**: 浏览器自动化友好
- **Manus (9.0)**: 功能全面，开发体验好

#### 可扩展性 (0-10)
- **Genspark (7.0)**: E2B生态，扩展性中等
- **OpenAI Chat (6.5)**: 功能受限，扩展性较低
- **OpenAI Agent (8.5)**: 模块化设计，扩展性好
- **AnyGen (7.5)**: 基于E2B，扩展性良好
- **Manus (9.0)**: 完全自定义，扩展性最强

---

## 总结

通过对五个Agent Sandbox平台（包括OpenAI的两种模式）的详细分析，我们发现：

1. **E2B平台是主流**: 三个平台基于E2B，说明E2B提供了良好的基础架构
2. **容器化是标准**: 所有平台都使用容器技术实现隔离
3. **容器技术演进**: 从Docker到Kata Containers，追求更强的隔离性
4. **网络模式多样**: E2B使用链路本地地址，Docker使用标准网络，Kata支持双网卡
5. **服务组合灵活**: 不同平台根据需求选择不同的服务组合
   - Chat模式: 轻量级，仅终端和Jupyter API
   - Agent模式: 完整功能，包括浏览器、VNC、文件同步等
6. **安全策略差异**: 不同平台的安全限制程度不同，但都采用非root用户运行
7. **功能模块化**: 通过环境变量控制功能开关，实现同一镜像的不同配置
8. **安全风险普遍存在**: 所有平台都存在敏感信息暴露问题，需要改进

### 关键发现

- **功能最全面**: Manus (9.5/10) 和 OpenAI Agent (9.0/10)
- **安全性最好**: OpenAI Agent (7.5/10) - Kata容器 + 严格权限控制
- **安全性最差**: Manus (5.5/10) - 大量敏感信息暴露
- **最易用**: Manus (9.0/10) 和 AnyGen (8.5/10)
- **最可扩展**: Manus (9.0/10) - 完全自定义架构

### 推荐使用场景

- **快速原型开发**: Genspark、AnyGen
- **生产环境（高安全要求）**: OpenAI Agent（需修复无认证服务）
- **功能丰富需求**: Manus（需加强安全措施）
- **轻量级任务**: OpenAI Chat

这些分析为自建Agent Sandbox提供了重要的参考依据。
