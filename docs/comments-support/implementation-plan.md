# 实施计划

## 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `_config.yml` | 修改 | 添加 Giscus 配置项 |
| `_layouts/post.html` | 修改 | 调整布局结构，引入批注组件 |
| `_includes/annotation.html` | 新增 | 批注 UI 组件 |
| `_includes/giscus.html` | 新增 | Giscus 脚本组件 |
| `public/css/annotation.css` | 新增 | 批注相关样式 |
| `public/js/annotation.js` | 新增 | 批注核心逻辑 |

## 实施步骤

### Phase 1: 基础设施

#### 1.1 配置 Giscus
- [ ] 在 GitHub 仓库启用 Discussions
- [ ] 访问 giscus.app 生成配置
- [ ] 更新 _config.yml

#### 1.2 调整布局
- [ ] 修改 post.html 为 grid 布局
- [ ] 创建 annotation.css
- [ ] 添加右侧栏容器

### Phase 2: 文本选择

#### 2.1 SelectionDetector
- [ ] 实现 mouseup 监听
- [ ] 实现选区范围检测
- [ ] 实现浮动按钮显示/隐藏

#### 2.2 浮动按钮 UI
- [ ] 按钮样式
- [ ] 定位逻辑
- [ ] 点击外部关闭

### Phase 3: 批注输入

#### 3.1 AnnotationEditor
- [ ] 模态框 UI
- [ ] 引用块展示
- [ ] Markdown 输入框
- [ ] 提交/取消按钮

#### 3.2 Giscus 集成
- [ ] 引入 giscus.html
- [ ] postMessage 通信
- [ ] 提交批注到 Discussion

### Phase 4: 批注展示

#### 4.1 AnnotationRenderer
- [ ] 获取 Discussion comments
- [ ] 解析批注格式
- [ ] 渲染到右侧栏

#### 4.2 交互增强
- [ ] 点击批注高亮原文
- [ ] 嵌套回复展示
- [ ] 空状态处理

### Phase 5: 优化完善

#### 5.1 响应式适配
- [ ] 移动端布局
- [ ] 触摸设备选择支持

#### 5.2 用户体验
- [ ] 加载状态
- [ ] 错误处理
- [ ] 键盘快捷键

## 依赖关系

```
Phase 1 (基础设施)
    │
    ├── Phase 2 (文本选择)
    │       │
    │       └── Phase 3 (批注输入)
    │               │
    └───────────────┴── Phase 4 (批注展示)
                            │
                            └── Phase 5 (优化完善)
```

## MVP 范围

首次发布仅包含核心功能：

**包含**：
- 文本选择 + 浮动按钮
- 基础批注输入框
- Giscus 评论集成
- 右侧栏布局（桌面端）
- 移动端底部显示

**不包含**（后续迭代）：
- 点击批注高亮原文
- Markdown 实时预览
- 批注数量统计
- 批注筛选/搜索
