---
layout: post
title: "自建 Agent Sandbox 经验总结与实施指南"
---

## 目录
1. [核心经验总结](#核心经验总结)
2. [技术选型建议](#技术选型建议)
3. [架构设计](#架构设计)
4. [实施步骤](#实施步骤)
5. [最佳实践](#最佳实践)
6. [常见问题与解决方案](#常见问题与解决方案)


<!-- more -->
---

## 核心经验总结

### 1. 平台选择经验

#### E2B平台的优势
- ✅ **成熟稳定**: 多个平台选择E2B作为基础，说明其稳定性和可靠性
- ✅ **网络配置统一**: 使用 `169.254.0.21/30` 网络模式，便于管理
- ✅ **环境管理**: envd服务提供统一的环境管理
- ✅ **快速部署**: 基于模板快速创建sandbox实例

#### 自定义容器的优势
- ✅ **完全控制**: 可以完全自定义容器配置
- ✅ **资源优化**: 可以针对特定需求优化资源使用
- ✅ **安全定制**: 可以实现更严格的安全策略

#### Kata Containers的优势 (从OpenAI Agent模式学习)
- ✅ **更强隔离**: 使用轻量级虚拟机提供更强的安全隔离
- ✅ **virtiofs性能**: 使用virtiofs文件系统，性能优于9p
- ✅ **双网卡支持**: 支持多网络接口，便于网络隔离和路由
- ✅ **内核更新**: 可以使用更新的内核版本 (6.12.13)

**建议**: 
- 初期使用E2B平台快速搭建
- 有特殊需求时考虑自定义容器
- 对安全要求极高时考虑Kata Containers

### 2. 网络架构经验

#### 网络模式选择
从分析中发现三种主要模式：

**E2B模式** (推荐用于快速部署):
```
IP: 169.254.0.21/30
网关: 169.254.0.22
特点: 链路本地地址，避免IP冲突
```

**Docker模式** (推荐用于自定义方案):
```
IP: 172.30.0.x/16 或 172.17.0.x/16
网关: 172.30.0.1
特点: 标准Docker网络
```

**Kata模式** (推荐用于高安全需求):
```
主网卡: 172.19.0.x/16
辅助网卡: 172.31.x.x/28
网关: 172.19.0.1
特点: 双网卡，支持网络隔离和特殊路由
```

#### 端口转发策略
- **socat工具**: 简单有效的端口转发方案
- **转发目的**: 将外部IP端口转发到内部localhost服务
- **常见场景**: Chrome调试端口、应用服务端口

**实施建议**:
```bash
# 使用socat进行端口转发
socat TCP4-LISTEN:9222,bind=169.254.0.21,reuseaddr,fork TCP4:localhost:9222
```

### 3. 存储架构经验

#### 存储方案对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|----------|
| **本地ext4** | 性能好，简单 | 容量有限 | 临时数据、缓存 |
| **S3FS** | 容量大，持久化 | 性能较差 | 大文件、备份 |
| **FUSE文件系统** | 灵活，可定制 | 开发复杂 | 特殊需求 |
| **Overlay** | Docker原生 | 容量限制 | 容器临时存储 |
| **virtiofs (KataShared)** | 性能好，隔离强 | 需要Kata环境 | Kata容器，高安全需求 |

#### 数据持久化策略
1. **用户数据**: 使用持久化卷挂载 `/home/user`
2. **应用数据**: 使用云存储 (S3) 或NFS
3. **临时数据**: 使用tmpfs提高性能
4. **浏览器数据**: 独立目录，可选择性持久化

**实施建议**:
- 关键数据使用S3FS或NFS持久化
- 临时数据使用tmpfs
- 用户工作目录使用持久化卷

### 4. 进程管理经验

#### Init系统选择

**systemd** (推荐用于完整系统):
- ✅ 功能完整，支持服务依赖
- ✅ 资源限制和监控
- ❌ 容器内需要特殊配置

**Supervisor** (推荐用于轻量级容器):
- ✅ 轻量级，适合容器
- ✅ 配置简单
- ❌ 功能相对简单

**实施建议**:
- 完整Ubuntu/Debian系统使用systemd
- 最小化容器使用supervisor
- E2B平台使用envd + systemd组合

### 5. 文件同步经验 (从OpenAI Agent模式学习)

#### rsync文件同步方案
OpenAI Agent模式使用rsync实现文件同步，这是一个很好的实践：

**优势**:
- ✅ **实时同步**: 使用inotify监控文件变化
- ✅ **高效传输**: rsync只传输差异部分
- ✅ **双向同步**: 支持容器内外文件同步
- ✅ **过滤支持**: 可以排除特定文件/目录

**实施建议**:
```bash
# 启动rsync守护进程
rsync --daemon --no-detach

# 使用inotify监控文件变化
inotifywait -mrq -e close_write,delete,move \
  --exclude '(^|/)(\.rsync-tmp|.*tmp|node_modules(/|$))' \
  /home/user/share/

# 同步脚本
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '*.tmp' \
  /home/user/share/ remote-host:/backup/share/
```

**应用场景**:
- 用户工作目录同步
- 代码和配置文件同步
- 日志文件收集
- 多容器间文件共享

### 6. 浏览器集成经验

#### Chrome/Chromium配置要点

**必须配置**:
```bash
--remote-debugging-port=9222        # 远程调试
--user-data-dir=<独立目录>           # 用户数据隔离
--no-first-run                      # 跳过首次运行
--disable-gpu                       # 禁用GPU (容器环境)
```

**推荐配置**:
```bash
--load-extension=<扩展路径>          # 加载扩展
--use-angle=swiftshader-webgl      # 软件渲染
--disable-dev-shm-usage            # 避免/dev/shm问题
--no-sandbox                       # 容器环境可能需要
```

**安全配置**:
```bash
--remote-debugging-address=127.0.0.1  # 仅本地访问
# 或使用socat转发到外部IP
```

#### VNC集成方案

**方案1: x11vnc + websockify** (推荐)
- x11vnc提供VNC服务
- websockify提供Web访问
- 配置简单，性能好

**方案2: Xvfb + x11vnc** (无头环境)
- Xvfb创建虚拟显示
- x11vnc连接虚拟显示
- 适合无GPU环境

**实施建议**:
```bash
# 启动Xvfb
Xvfb :1 -screen 0 1280x1024x24 -ac

# 启动x11vnc
x11vnc -display :1 -rfbport 5900 -shared -forever -nopw

# 启动websockify
websockify --web /opt/noVNC 6080 localhost:5900
```

### 7. 功能模块化经验 (从OpenAI学习)

#### 环境变量控制功能开关
OpenAI使用环境变量控制功能启用/禁用，这是一个很好的设计模式：

**优势**:
- ✅ **同一镜像多配置**: 使用同一基础镜像，通过环境变量控制功能
- ✅ **灵活部署**: 可以根据需求选择启用哪些功能
- ✅ **易于管理**: 配置集中，易于维护

**实施建议**:
```bash
# 功能开关环境变量
ENABLE_JUPYTER=true
ENABLE_CHROME=true
ENABLE_VNC=false
ENABLE_CODE_SERVER=false
ENABLE_PDF_READER=true

# 启动脚本根据环境变量决定启动哪些服务
if [ "$ENABLE_JUPYTER" = "true" ]; then
    start_jupyter
fi

if [ "$ENABLE_CHROME" = "true" ]; then
    start_chrome
fi
```

**功能模块建议**:
- Jupyter Notebook/Server
- Chrome/Chromium浏览器
- VNC/远程桌面
- Code Server
- PDF阅读器服务
- 文件同步服务
- 终端服务器

### 8. 安全机制经验

#### 权限控制策略

**用户隔离**:
- 所有服务以非root用户运行
- 使用专用用户账户 (如 `agent`, `sandbox`)
- UID/GID统一管理

**sudo策略**:
- **严格模式**: 完全禁用sudo (OpenAI方案)
- **宽松模式**: 部分sudo功能 (其他平台)
- **建议**: 根据安全需求选择，生产环境建议严格模式

**文件系统保护**:
- `/proc/1/environ` 禁止访问
- 系统目录只读挂载
- 用户目录可写但受限

#### 网络安全策略

**防火墙规则**:
```bash
# 仅允许必要端口
iptables -A INPUT -p tcp --dport 22 -j ACCEPT    # SSH
iptables -A INPUT -p tcp --dport 8888 -j ACCEPT  # Jupyter
iptables -A INPUT -p tcp --dport 9222 -j ACCEPT  # Chrome调试
iptables -A INPUT -j DROP                         # 其他拒绝
```

**网络隔离**:
- 使用私有网络
- 外部访问通过NAT或代理
- 内部服务仅监听localhost

---

## 技术选型建议

### 1. 容器化方案

#### 方案1: Docker + containerd (推荐用于一般场景)

**优势**:
- 成熟稳定，生态丰富
- 资源隔离好
- 易于管理和部署

**配置示例**:
```dockerfile
FROM ubuntu:22.04

# 安装基础工具
RUN apt-get update && apt-get install -y \
    systemd \
    python3 \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# 配置systemd
RUN systemctl set-default multi-user.target

# 创建用户
RUN useradd -m -s /bin/bash agent

WORKDIR /home/agent
```

#### 方案2: Kata Containers (推荐用于高安全场景)

**优势**:
- 更强的安全隔离 (轻量级VM)
- 可以使用更新的内核
- 支持virtiofs高性能文件系统
- 支持多网卡配置

**配置示例**:
```yaml
# kata-containers配置
apiVersion: v1
kind: Pod
metadata:
  name: agent-sandbox
spec:
  runtimeClassName: kata
  containers:
  - name: agent
    image: agent-sandbox:latest
    resources:
      limits:
        memory: "4Gi"
        cpu: "2"
```

**选择建议**:
- **一般场景**: 使用Docker
- **高安全需求**: 使用Kata Containers
- **快速部署**: 使用E2B平台

### 2. 网络方案

#### 推荐方案: Docker Bridge网络 + 端口转发

**配置示例**:
```yaml
version: '3.8'
services:
  agent:
    image: agent-sandbox:latest
    networks:
      - agent-net
    ports:
      - "8888:8888"
      - "9222:9222"

networks:
  agent-net:
    driver: bridge
    ipam:
      config:
        - subnet: 169.254.0.0/16
          gateway: 169.254.0.22
```

### 3. 存储方案

#### 方案1: 本地存储 + S3FS + tmpfs组合 (Docker)

**配置示例**:
```yaml
volumes:
  agent-data:
    driver: local
  agent-cache:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
  persistent-storage:
    driver: s3fs
    driver_opts:
      endpoint: s3.amazonaws.com
      bucket: agent-storage
```

#### 方案2: virtiofs + 本地存储 (Kata Containers)

**配置示例**:
```yaml
# Kata容器使用virtiofs挂载
volumes:
  - name: shared-data
    virtiofs:
      path: /host/path/to/share
  - name: agent-data
    emptyDir: {}
```

**选择建议**:
- **Docker环境**: 使用方案1
- **Kata环境**: 使用方案2，获得更好的性能

### 4. 进程管理方案

#### 推荐方案: systemd (容器内) + 外部编排

**容器内systemd配置**:
```dockerfile
# 启用systemd
RUN systemctl set-default multi-user.target

# 创建服务文件
COPY jupyter.service /etc/systemd/system/
RUN systemctl enable jupyter.service
```

**外部编排** (Kubernetes/Docker Compose):
```yaml
services:
  agent:
    image: agent-sandbox:latest
    command: /sbin/init
    privileged: true  # systemd需要
```

---

## 架构设计

### 1. 整体架构

```
┌─────────────────────────────────────────┐
│         Host System / Kubernetes        │
│  ┌───────────────────────────────────┐  │
│  │   Agent Sandbox Container         │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  systemd / supervisor       │  │  │
│  │  │  ┌───────────────────────┐ │  │  │
│  │  │  │  Jupyter Server       │ │  │  │
│  │  │  ├───────────────────────┤ │  │  │
│  │  │  │  Chrome/Chromium      │ │  │  │
│  │  │  ├───────────────────────┤ │  │  │
│  │  │  │  VNC Server           │ │  │  │
│  │  │  ├───────────────────────┤ │  │  │
│  │  │  │  Code Server          │ │  │  │
│  │  │  └───────────────────────┘ │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
│           │                              │
│           ▼                              │
│  ┌───────────────────────────────────┐  │
│  │   Persistent Storage (S3/NFS)     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 2. 网络架构

```
External Network
    │
    ▼
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Port Forward   │  (socat/iptables)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Container      │
│  169.254.0.21   │
│  ┌───────────┐  │
│  │ Services  │  │
│  │ :8888     │  │
│  │ :9222     │  │
│  │ :5900     │  │
│  └───────────┘  │
└─────────────────┘
```

### 3. 存储架构

```
Container
    │
    ├── /home/agent/workspace  ──► Persistent Volume (NFS/EBS)
    ├── /tmp                  ──► tmpfs (内存)
    ├── /mnt/storage          ──► S3FS (对象存储)
    └── /var/log              ──► Log Volume (持久化)
```

---

## 实施步骤

### 阶段1: 基础环境搭建 (1-2周)

#### 1.1 构建基础镜像
```dockerfile
FROM ubuntu:22.04

# 安装基础工具
RUN apt-get update && apt-get install -y \
    systemd \
    python3 \
    python3-pip \
    nodejs \
    npm \
    git \
    curl \
    wget \
    vim \
    && rm -rf /var/lib/apt/lists/*

# 安装开发工具
RUN apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 配置systemd
RUN systemctl set-default multi-user.target

# 创建用户
RUN useradd -m -s /bin/bash agent && \
    usermod -aG sudo agent

WORKDIR /home/agent
```

#### 1.2 配置网络
```yaml
# docker-compose.yml
version: '3.8'
services:
  agent:
    build: .
    networks:
      - agent-net
    ports:
      - "8888:8888"
      - "9222:9222"

networks:
  agent-net:
    driver: bridge
    ipam:
      config:
        - subnet: 169.254.0.0/16
```

#### 1.3 配置存储
```yaml
volumes:
  agent-workspace:
    driver: local
  agent-cache:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
```

### 阶段2: 核心服务集成 (2-3周)

#### 2.1 集成Jupyter
```bash
# 安装Jupyter
pip install jupyter jupyterlab

# 创建systemd服务
cat > /etc/systemd/system/jupyter.service <<EOF
[Unit]
Description=Jupyter Lab
After=network.target

[Service]
Type=simple
User=agent
ExecStart=/usr/local/bin/jupyter lab \
    --ip=0.0.0.0 \
    --port=8888 \
    --no-browser \
    --allow-root
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable jupyter.service
systemctl start jupyter.service
```

#### 2.2 集成Chrome
```bash
# 安装Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# 创建启动脚本
cat > /usr/local/bin/start-chrome.sh <<EOF
#!/bin/bash
google-chrome-stable \
    --remote-debugging-port=9222 \
    --remote-debugging-address=127.0.0.1 \
    --user-data-dir=/home/agent/.config/browser \
    --no-first-run \
    --disable-gpu \
    --use-angle=swiftshader-webgl \
    --no-sandbox \
    --disable-dev-shm-usage
EOF

chmod +x /usr/local/bin/start-chrome.sh
```

#### 2.3 集成VNC
```bash
# 安装VNC相关工具
apt-get install -y x11vnc websockify xvfb fluxbox

# 创建启动脚本
cat > /usr/local/bin/start-vnc.sh <<EOF
#!/bin/bash
# 启动Xvfb
Xvfb :1 -screen 0 1280x1024x24 -ac &
export DISPLAY=:1

# 启动窗口管理器
fluxbox &

# 启动x11vnc
x11vnc -display :1 -rfbport 5900 -shared -forever -nopw &

# 启动websockify
websockify --web /opt/noVNC 6080 localhost:5900 &
EOF

chmod +x /usr/local/bin/start-vnc.sh
```

#### 2.4 集成文件同步 (rsync)
```bash
# 安装rsync和inotify工具
apt-get install -y rsync inotify-tools

# 创建rsync配置文件
cat > /etc/rsyncd.conf <<EOF
[share]
path = /home/agent/share
comment = Agent Share Directory
read only = no
auth users = agent
secrets file = /etc/rsyncd.secrets
EOF

# 创建rsync密钥文件
echo "agent:password" > /etc/rsyncd.secrets
chmod 600 /etc/rsyncd.secrets

# 创建文件同步脚本
cat > /usr/local/bin/sync-share.sh <<EOF
#!/bin/bash
# 使用inotify监控文件变化
inotifywait -mrq -e close_write,delete,move \\
  --exclude '(^|/)(\.rsync-tmp|.*tmp|node_modules(/|$))' \\
  /home/agent/share/ | while read path action file; do
    # 同步到远程
    rsync -avz --delete \\
      --exclude 'node_modules' \\
      --exclude '*.tmp' \\
      /home/agent/share/ remote-host:/backup/share/
done
EOF

chmod +x /usr/local/bin/sync-share.sh

# 创建systemd服务
cat > /etc/systemd/system/rsync.service <<EOF
[Unit]
Description=rsync daemon
After=network.target

[Service]
Type=forking
ExecStart=/usr/bin/rsync --daemon --no-detach
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable rsync.service
systemctl start rsync.service
```

### 阶段3: 安全加固 (1-2周)

#### 3.1 用户权限控制
```bash
# 创建专用用户
useradd -m -s /bin/bash sandbox
usermod -aG sudo sandbox

# 配置sudo (严格模式)
cat > /etc/sudoers.d/sandbox <<EOF
sandbox ALL=(ALL) NOPASSWD: /usr/bin/apt-get update
sandbox ALL=(ALL) NOPASSWD: /usr/bin/pip install *
# 其他必要命令
EOF
```

#### 3.2 文件系统保护
```bash
# 只读挂载系统目录
mount -o remount,ro /usr
mount -o remount,ro /opt
mount -o remount,ro /etc
```

#### 3.3 网络安全
```bash
# 配置防火墙
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 8888 -j ACCEPT
iptables -A INPUT -p tcp --dport 9222 -j ACCEPT
iptables -A INPUT -j DROP
```

### 阶段4: 监控与运维 (1-2周)

#### 4.1 日志收集
```bash
# 配置日志收集
apt-get install -y rsyslog

# 配置日志转发
cat >> /etc/rsyslog.conf <<EOF
*.* @@log-server:514
EOF
```

#### 4.2 监控指标
```bash
# 安装监控工具
pip install prometheus-client

# 创建监控脚本
cat > /usr/local/bin/metrics-exporter.py <<EOF
#!/usr/bin/env python3
from prometheus_client import start_http_server, Gauge
import psutil

cpu_usage = Gauge('cpu_usage_percent', 'CPU usage percentage')
memory_usage = Gauge('memory_usage_percent', 'Memory usage percentage')

def collect_metrics():
    cpu_usage.set(psutil.cpu_percent())
    memory_usage.set(psutil.virtual_memory().percent)

if __name__ == '__main__':
    start_http_server(8000)
    while True:
        collect_metrics()
        time.sleep(5)
EOF
```

---

## 最佳实践

### 1. 容器镜像优化

#### 多阶段构建
```dockerfile
# 构建阶段
FROM ubuntu:22.04 AS builder
RUN apt-get update && apt-get install -y build-essential
# ... 编译步骤

# 运行阶段
FROM ubuntu:22.04
COPY --from=builder /usr/local/bin/app /usr/local/bin/app
# ... 运行配置
```

#### 层缓存优化
```dockerfile
# 先安装依赖 (变化少)
RUN apt-get update && apt-get install -y \
    python3 \
    pip

# 后复制代码 (变化多)
COPY app.py /app/
```

### 2. 服务配置管理

#### 使用配置文件
```yaml
# config.yaml
jupyter:
  port: 8888
  ip: 0.0.0.0
chrome:
  debug_port: 9222
  user_data_dir: /home/agent/.config/browser
vnc:
  port: 5900
  web_port: 6080
```

#### 环境变量注入
```bash
# 使用环境变量配置
export JUPYTER_PORT=8888
export CHROME_DEBUG_PORT=9222
```

### 3. 资源限制

#### CPU限制
```yaml
# docker-compose.yml
services:
  agent:
    deploy:
      resources:
        limits:
          cpus: '2'
        reservations:
          cpus: '1'
```

#### 内存限制
```yaml
services:
  agent:
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

### 4. 健康检查

#### Docker健康检查
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8888/health || exit 1
```

#### Kubernetes健康检查
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8888
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 8888
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## 常见问题与解决方案

### 1. systemd在容器中无法启动

**问题**: systemd需要特权模式

**解决方案**:
```yaml
# docker-compose.yml
services:
  agent:
    privileged: true
    # 或
    cap_add:
      - SYS_ADMIN
```

### 2. Chrome在容器中崩溃

**问题**: 容器环境缺少必要的系统资源

**解决方案**:
```bash
# 添加Chrome启动参数
--no-sandbox
--disable-dev-shm-usage
--disable-gpu
```

### 3. 端口转发不工作

**问题**: socat配置错误或权限问题

**解决方案**:
```bash
# 检查socat是否运行
ps aux | grep socat

# 检查端口是否监听
ss -tulpn | grep 9222

# 重新启动socat
socat TCP4-LISTEN:9222,bind=169.254.0.21,reuseaddr,fork TCP4:localhost:9222
```

### 4. S3FS挂载失败

**问题**: 认证或网络问题

**解决方案**:
```bash
# 检查认证信息
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# 测试S3连接
aws s3 ls s3://bucket-name

# 重新挂载
umount /mnt/storage
s3fs bucket-name /mnt/storage -o url=https://s3.amazonaws.com
```

### 5. VNC连接黑屏

**问题**: X服务器未启动或显示配置错误

**解决方案**:
```bash
# 检查X服务器
ps aux | grep Xvfb
ps aux | grep Xorg

# 检查DISPLAY环境变量
echo $DISPLAY

# 重新启动X服务器
Xvfb :1 -screen 0 1280x1024x24 -ac
export DISPLAY=:1
```

---

## 总结

通过分析多个Agent Sandbox平台（包括OpenAI的Chat和Agent两种模式），我们总结出以下关键经验：

1. **平台选择**: 
   - E2B适合快速部署
   - Docker适合一般自定义需求
   - Kata Containers适合高安全需求

2. **网络架构**: 
   - E2B使用链路本地地址
   - Docker使用标准网络
   - Kata支持双网卡配置

3. **存储方案**: 
   - 本地存储 + 云存储组合
   - Kata环境使用virtiofs获得更好性能

4. **进程管理**: 
   - systemd用于完整系统
   - supervisor用于轻量级容器

5. **功能模块化**: 
   - 使用环境变量控制功能开关
   - 同一镜像支持多种配置

6. **文件同步**: 
   - rsync + inotify实现实时同步
   - 支持双向同步和过滤

7. **安全策略**: 
   - 多层安全防护
   - 严格权限控制
   - Kata提供更强的隔离

8. **监控运维**: 
   - 完整的日志和监控体系
   - 日志转发服务

遵循这些经验，可以构建一个功能完整、安全可靠的Agent Sandbox平台。