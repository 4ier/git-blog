# 技术设计文档

## 1. 批注数据格式

每条批注作为 GitHub Discussion 的一条 Comment，采用以下格式：

```markdown
<!-- annotation:start -->
> 被选中的原文片段在这里显示
> 可以是多行内容

批注正文，支持 **Markdown** 语法。

可以有代码块：
```js
console.log('hello')
```
<!-- annotation:end -->
```

### 解析规则

- `<!-- annotation:start/end -->` 标记区分批注与普通评论
- 第一个 `>` 引用块 = 关联的原文
- 引用块之后 = 批注内容
- 嵌套回复使用 GitHub Discussions 原生的回复功能

## 2. 模块架构

```
public/js/annotation.js
├── SelectionDetector    - 监听文本选择，显示浮动按钮
├── AnnotationEditor     - 批注输入框（Markdown）
├── GiscusAdapter        - 与 Giscus 交互
└── AnnotationRenderer   - 解析并渲染批注到右侧栏
```

### 2.1 SelectionDetector

负责检测用户在文章区域的文本选择行为。

```js
// 核心逻辑
class SelectionDetector {
  constructor(articleSelector, onSelect) {
    this.article = document.querySelector(articleSelector);
    this.onSelect = onSelect;
    this.init();
  }

  init() {
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('selectionchange', this.handleSelectionChange.bind(this));
  }

  handleMouseUp(e) {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0 && this.isInArticle(selection)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.onSelect({ text, rect, range });
    }
  }

  isInArticle(selection) {
    if (selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return this.article.contains(range.commonAncestorContainer);
  }
}
```

### 2.2 AnnotationEditor

简单的 Markdown 输入组件。

功能：
- textarea 输入框
- 预填引用块（选中的原文）
- 实时预览（可选，MVP 阶段可省略）
- 提交按钮

### 2.3 GiscusAdapter

与 Giscus 的交互层。

**MVP 方案**：利用 Giscus iframe 的 postMessage API

```js
// 发送消息给 Giscus iframe
function postToGiscus(message) {
  const iframe = document.querySelector('iframe.giscus-frame');
  if (iframe) {
    iframe.contentWindow.postMessage(
      { giscus: message },
      'https://giscus.app'
    );
  }
}
```

**备选方案**：直接跳转到 GitHub Discussion 页面完成评论

### 2.4 AnnotationRenderer

负责从 Giscus 获取批注数据并渲染到右侧栏。

```js
class AnnotationRenderer {
  constructor(sidebarSelector) {
    this.sidebar = document.querySelector(sidebarSelector);
  }

  // 解析批注格式
  parseAnnotation(commentBody) {
    const annotationRegex = /<!-- annotation:start -->\n([\s\S]*?)\n<!-- annotation:end -->/;
    const match = commentBody.match(annotationRegex);

    if (!match) return null;

    const content = match[1];
    const quoteMatch = content.match(/^((?:>.*\n?)+)/);

    return {
      quote: quoteMatch ? quoteMatch[1].replace(/^> ?/gm, '') : '',
      body: content.replace(/^((?:>.*\n?)+)/, '').trim()
    };
  }

  render(annotations) {
    this.sidebar.innerHTML = annotations
      .map(a => this.renderAnnotation(a))
      .join('');
  }

  renderAnnotation(annotation) {
    return `
      <div class="annotation-item" data-quote="${this.escapeHtml(annotation.quote)}">
        <div class="annotation-quote">${this.escapeHtml(annotation.quote)}</div>
        <div class="annotation-body">${marked.parse(annotation.body)}</div>
        <div class="annotation-replies">
          ${annotation.replies.map(r => this.renderReply(r)).join('')}
        </div>
      </div>
    `;
  }
}
```

## 3. 布局方案

### 3.1 HTML 结构

```html
<!-- _layouts/post.html -->
<article class="post-wrapper">
  <div class="post-content">
    {{ content }}
  </div>
  <aside class="annotation-sidebar">
    <div class="annotation-list"></div>
  </aside>
</article>

<!-- 浮动按钮 -->
<div class="annotation-trigger" style="display: none;">
  <button class="btn-add-annotation">添加批注</button>
</div>

<!-- 批注输入框 -->
<div class="annotation-editor" style="display: none;">
  <div class="editor-header">添加批注</div>
  <div class="editor-quote"></div>
  <textarea class="editor-input" placeholder="写下你的批注..."></textarea>
  <div class="editor-actions">
    <button class="btn-cancel">取消</button>
    <button class="btn-submit">提交</button>
  </div>
</div>

<!-- Giscus -->
<div class="giscus-container">
  <!-- giscus script here -->
</div>
```

### 3.2 CSS 布局

```css
/* 桌面端三栏布局 */
.post-wrapper {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.post-content {
  min-width: 0; /* 防止内容溢出 */
}

.annotation-sidebar {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

/* 移动端单栏 */
@media (max-width: 960px) {
  .post-wrapper {
    grid-template-columns: 1fr;
  }

  .annotation-sidebar {
    position: static;
    margin-top: 2rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
}
```

## 4. Giscus 配置

### 4.1 仓库准备

1. 在 GitHub 仓库 Settings → Features 启用 Discussions
2. 创建 `Annotations` 分类（或使用默认分类）

### 4.2 配置参数

```html
<script src="https://giscus.app/client.js"
  data-repo="4ier/git-blog"
  data-repo-id="[REPO_ID]"
  data-category="Annotations"
  data-category-id="[CATEGORY_ID]"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="1"
  data-input-position="top"
  data-theme="light"
  data-lang="zh-CN"
  data-loading="lazy"
  crossorigin="anonymous"
  async>
</script>
```

### 4.3 _config.yml 配置

```yaml
# Giscus 批注系统
giscus:
  repo: "4ier/git-blog"
  repo_id: ""  # 从 giscus.app 获取
  category: "Annotations"
  category_id: ""  # 从 giscus.app 获取
  mapping: "pathname"
  theme: "light"
  lang: "zh-CN"
```

## 5. 交互细节

### 5.1 文本选择

- 最小选择长度：5 个字符
- 最大选择长度：500 个字符（超出截断）
- 仅在文章正文区域有效

### 5.2 浮动按钮

- 位置：选区上方居中
- 点击外部区域消失
- ESC 键关闭

### 5.3 批注输入框

- 模态框形式
- 引用块只读显示
- 支持 Tab 键缩进
- Ctrl+Enter 提交

### 5.4 右侧栏

- 按创建时间倒序排列
- 点击批注高亮对应原文
- 鼠标悬停显示完整引用
