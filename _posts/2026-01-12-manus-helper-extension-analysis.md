---
layout: post
title: "Manus Helper 浏览器扩展开发分析文档"
---

## 目录
1. [概述](#概述)
2. [架构设计](#架构设计)
3. [核心功能模块](#核心功能模块)
4. [文件结构](#文件结构)
5. [API接口](#api接口)
6. [开发环境搭建](#开发环境搭建)
7. [核心代码分析](#核心代码分析)
8. [功能实现细节](#功能实现细节)
9. [开发指南](#开发指南)


<!-- more -->
---

## 概述

### 基本信息
- **扩展名称**: Manus Helper
- **版本**: 1.1.11
- **Manifest版本**: 3
- **描述**: Helps Manus to use this browser.
- **用途**: 为Manus AI Agent提供浏览器自动化能力，包括内容提取、元素交互、页面分析等功能

### 核心价值
Manus Helper是一个功能丰富的浏览器扩展，专门为AI Agent设计，提供了：
- 智能文章内容提取
- 可点击元素识别和高亮
- 关键词查找和上下文提取
- 图片提取和处理
- Cookie自动接受
- PDF内容提取
- 页面加载状态检测
- 网络请求跟踪

---

## 架构设计

### 扩展架构

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Popup UI   │    │  Background  │    │  Content  │ │
│  │   (popup)    │◄──►│   Service    │◄──►│  Scripts  │ │
│  │              │    │    Worker    │    │           │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│         │                   │                  │        │
│         └───────────────────┼──────────────────┘        │
│                             │                            │
│                    ┌─────────▼─────────┐                │
│                    │  Message Passing  │                │
│                    │   (Chrome APIs)   │                │
│                    └────────────────────┘                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 组件说明

1. **Background Service Worker** (`background.ts.js`)
   - 页面加载状态检测
   - 网络请求跟踪和过滤
   - 图片获取和截图
   - 消息路由和处理

2. **Content Scripts** (`content.ts.js`)
   - 文章内容提取
   - 元素高亮和标记
   - 关键词查找
   - Cookie自动接受
   - 页面交互处理

3. **Popup UI** (`popup.html`)
   - 开发调试界面
   - 功能测试工具

4. **辅助脚本**
   - `contentInitScript.js` - postMessage保护
   - `queryPdf.js` - PDF内容提取
   - `ReaderArticleFinder.js` - 文章阅读器查找

---

## 核心功能模块

### 1. 文章内容提取 (ArticleExtractor)

**功能**: 从网页中提取主要文章内容并转换为Markdown格式

**实现类**: `ArticleExtractor` (在content.ts.js中)

**核心特性**:
- 使用Readability库进行内容提取
- 智能过滤广告、导航、侧边栏等无关内容
- 支持Markdown转换（使用Turndown库）
- 置信度计算，确保提取质量
- 支持代码块、表格、图片等复杂元素

**关键方法**:
- `extract()` - 主提取方法
- `extractWithReadability()` - 使用Readability库提取
- `extractMarkdown()` - 转换为Markdown
- `calculateConfidence()` - 计算提取置信度

**使用场景**:
```javascript
const extractor = new ArticleExtractor();
const result = extractor.extract();
// 返回: { title: string, markdown: string }
```

### 2. 可点击元素管理 (ClickableElementManager)

**功能**: 识别、标记和高亮页面中的可点击元素

**实现类**: `ClickableElementManager` (在content.ts.js中)

**核心特性**:
- 自动识别按钮、链接、输入框等可点击元素
- 为元素分配唯一索引ID
- 高亮显示可点击元素
- 生成元素描述信息（包含tagName、id、hint等）
- 支持Shadow DOM
- 可见性检测和视口裁剪

**关键方法**:
- `refreshClickableElements()` - 刷新可点击元素列表
- `showHighlights()` - 显示元素高亮
- `hideHighlights()` - 隐藏元素高亮
- `getVisibleClickableRects()` - 获取可见元素的位置信息
- `findElementFromPoint()` - 根据坐标查找元素

**数据结构**:
```typescript
interface ClickableElement {
  element: HTMLElement;
  index: number;
  text: string;
  description: string; // 格式: "tagName {domId:"id", hint:"hint"} text"
}
```

### 3. 关键词查找 (KeywordFinder)

**功能**: 在页面文本中查找关键词并返回相关段落

**实现类**: `KeywordFinder` (在content.ts.js中)

**核心特性**:
- 使用Intl.Segmenter进行句子分割
- 智能上下文扩展（包含前后句子）
- 支持中英文关键词匹配
- 返回包含关键词的完整段落

**关键方法**:
- `findKeywordInPage(text, keyword)` - 查找关键词

**返回格式**:
```typescript
string[] // 包含关键词的段落数组，每个段落约20个单词
```

### 4. Cookie自动接受 (CookieAutoAccepter)

**功能**: 自动检测并接受Cookie同意弹窗

**实现类**: `CookieAutoAccepter` (在content.ts.js中)

**核心特性**:
- 监听DOM变化，检测Cookie相关文本
- 识别常见的Cookie接受按钮文本
- 自动点击接受按钮
- 使用MutationObserver实时监控

**识别的按钮文本**:
- "accept all cookies"
- "allow all cookies"
- "accept cookies"
- "agree all"
- "i agree"
- 等

### 5. 图片提取 (ImageExtractor)

**功能**: 从页面元素中提取图片

**实现类**: `ImageExtractor` (在content.ts.js中)

**核心特性**:
- 支持img标签图片提取
- 支持canvas元素转图片
- 支持CSS背景图片提取
- 支持截图功能（通过background script）
- 自动处理跨域和权限问题

**关键方法**:
- `getImageFromElement(element)` - 从元素提取图片
- `findElementFromPoint(x, y)` - 根据坐标查找图片元素
- `fetchImageViaBackground(url)` - 通过background获取图片
- `getImageViaScreenshot(element)` - 截图方式获取图片

**返回格式**:
```typescript
{
  dataUrl: string;  // base64编码的图片数据
  width: number;
  height: number;
}
```

### 6. 页面加载检测 (LoadingDetector)

**功能**: 检测页面是否完全加载完成

**实现类**: `LoadingDetector` (在background.ts.js中)

**核心特性**:
- 跟踪网络请求状态
- 检测DOM变化
- 过滤第三方跟踪脚本
- 判断页面加载完成时机

**关键方法**:
- `isLoading()` - 判断是否仍在加载
- `shouldTrackRequest()` - 判断是否跟踪请求
- `isTrackingUrl()` - 判断是否为跟踪URL

### 7. PDF内容提取

**功能**: 从PDF embed元素中提取文本内容

**实现**: `queryPdf.js`

**使用方法**:
```javascript
// 向PDF embed发送消息
document.querySelector('embed').postMessage({ type: 'getSelectedText' }, '*')
```

### 8. 点击可视化效果

**功能**: 显示点击时的视觉反馈

**实现类**: `ClickVisualEffect` (在content.ts.js中)

**特性**:
- 涟漪动画效果
- 显示点击位置
- 自动消失

---

## 文件结构

```
manus-helper/
├── manifest.json                    # 扩展配置文件
├── service-worker-loader.js         # Service Worker入口
├── background.ts.js                 # Background Service Worker (编译后)
├── content.ts.js                    # Content Script主文件 (编译后)
├── contentInitScript.js             # Content Script初始化脚本
├── popup.html                       # Popup UI界面
├── popup.html.js                    # Popup逻辑 (编译后)
├── logo.png                         # 扩展图标
│
├── assets/                          # 资源文件目录
│   ├── content.ts-loader.js        # Content Script加载器
│   ├── contentInitScript.js         # Content Script初始化脚本副本
│   ├── queryPdf.js                 # PDF查询脚本
│   └── ReaderArticleFinder.js      # 文章阅读器查找脚本
│
└── src/                             # 源代码目录 (如果存在)
    └── popup.html                   # Popup HTML源文件
```

### 关键文件说明

#### manifest.json
```json
{
  "manifest_version": 3,
  "name": "Manus Helper",
  "version": "1.1.11",
  "permissions": [
    "declarativeNetRequest",  // 网络请求修改
    "scripting",              // 脚本注入
    "webRequest",             // 网络请求监听
    "webNavigation",          // 导航事件
    "tabCapture"             // 标签页截图
  ],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["assets/contentInitScript.js"],
      "run_at": "document_start",
      "world": "MAIN"  // 主世界执行
    },
    {
      "js": ["assets/content.ts-loader.js"],
      "matches": ["<all_urls>"],
      "run_at": "document_start"
    }
  ]
}
```

---

## API接口

### Content Script API

扩展通过`window.postMessage`和`chrome.runtime.sendMessage`进行通信。

#### 1. Agent Action消息格式

```typescript
interface AgentAction {
  type: "__agentAction__";
  action: string;           // 操作类型
  actionId?: string;        // 操作ID
  [key: string]: any;       // 其他参数
}
```

#### 2. Agent Action Result消息格式

```typescript
interface AgentActionResult {
  type: "__agentActionResult__";
  action: string;
  actionId?: string;
  success: boolean;
  [key: string]: any;       // 结果数据
}
```

### 支持的操作类型

#### checkReady
检查页面是否准备就绪

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "checkReady",
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "checkReady",
  actionId: "unique-id",
  success: true,
  ready: boolean  // 页面是否准备就绪
}
```

#### extractContent
提取页面内容

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "extractContent",
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "extractContent",
  actionId: "unique-id",
  success: true,
  elements: {
    [index: string]: {
      index: number,
      description: string
    }
  },
  markdown: string,        // 截断的markdown (8KB)
  fullMarkdown: string,    // 完整markdown
  pixelsAbove: number,     // 页面上方像素数
  pixelsBelow: number,     // 页面下方像素数
  markdownTime: number,    // markdown提取耗时(ms)
  markClickableTime: number // 可点击元素标记耗时(ms)
}
```

#### showMarks / hideMarks
显示/隐藏元素高亮

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "showMarks",  // 或 "hideMarks"
  actionId: "unique-id"
}
```

#### getVisibleElements
获取可见的可点击元素

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "getVisibleElements",
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "getVisibleElements",
  actionId: "unique-id",
  success: true,
  e: [                    // 元素数组
    {
      i: number,          // 元素索引
      b: [left, top, width, height],  // 边界框
      t: string,          // 标签名
      it?: string         // input类型 (如果是input元素)
    }
  ],
  v: {
    w: number,           // 视口宽度
    h: number,           // 视口高度
    d: number            // 设备像素比
  }
}
```

#### findKeyword
查找关键词

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "findKeyword",
  keyword: "search term",
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "findKeyword",
  actionId: "unique-id",
  success: true,
  results: string[]  // 包含关键词的段落数组
}
```

#### extractImage
提取图片

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "extractImage",
  x: number,        // 可选：X坐标
  y: number,        // 可选：Y坐标
  index: number,    // 可选：元素索引
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "extractImage",
  actionId: "unique-id",
  success: true,
  image: {
    dataUrl: string,  // base64编码的图片
    width: number,
    height: number
  }
}
```

#### showClickVisualEffect
显示点击视觉效果

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "showClickVisualEffect",
  x: number,        // X坐标
  y: number,        // Y坐标
  // 或
  index: number,    // 元素索引
  actionId: "unique-id"
}
```

#### locate
定位元素并生成选择器

**请求**:
```javascript
{
  type: "__agentAction__",
  action: "locate",
  index: number,    // 元素索引
  actionId: "unique-id"
}
```

**响应**:
```javascript
{
  type: "__agentActionResult__",
  action: "locate",
  actionId: "unique-id",
  success: true,
  info: {
    selector: string,  // CSS选择器，格式: "body > div > button:nth-of-type(2)"
    tagName: string   // 标签名
  }
}
```

### Background Script API

#### CHECK_LOADING_STATE
检查页面加载状态

**请求**:
```javascript
chrome.runtime.sendMessage({
  type: "CHECK_LOADING_STATE"
}, (response) => {
  console.log(response.isLoading);  // boolean
});
```

#### SCREENSHOT
截图当前标签页

**请求**:
```javascript
chrome.runtime.sendMessage({
  type: "SCREENSHOT"
}, (response) => {
  console.log(response.dataUrl);  // base64图片
});
```

#### FETCH_IMAGE
获取图片（处理CORS）

**请求**:
```javascript
chrome.runtime.sendMessage({
  type: "FETCH_IMAGE",
  url: "https://example.com/image.jpg"
}, (response) => {
  console.log(response.dataUrl);  // base64图片
});
```

---

## 开发环境搭建

### 1. 项目初始化

```bash
# 创建项目目录
mkdir manus-helper-extension
cd manus-helper-extension

# 初始化npm项目
npm init -y

# 安装TypeScript和构建工具
npm install --save-dev typescript @types/chrome
npm install --save-dev webpack webpack-cli ts-loader
npm install --save-dev copy-webpack-plugin
```

### 2. 项目结构

```
manus-helper-extension/
├── src/
│   ├── background/
│   │   └── background.ts
│   ├── content/
│   │   ├── content.ts
│   │   └── contentInitScript.ts
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.ts
│   └── assets/
│       ├── queryPdf.ts
│       └── ReaderArticleFinder.ts
├── public/
│   ├── manifest.json
│   └── logo.png
├── dist/                    # 构建输出目录
├── tsconfig.json
├── webpack.config.js
└── package.json
```

### 3. TypeScript配置 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Webpack配置 (webpack.config.js)

```javascript
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.' },
        { from: 'src/content/contentInitScript.ts', to: 'assets/contentInitScript.js' },
        { from: 'src/assets', to: 'assets' },
      ],
    }),
  ],
};
```

### 5. 开发脚本 (package.json)

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "type-check": "tsc --noEmit"
  }
}
```

### 6. 加载扩展到Chrome

1. 打开Chrome浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的`dist`目录

---

## 核心代码分析

### 1. Content Script主类 (ContentScript)

**位置**: `content.ts.js`

**核心类**: `ContentScript`

**主要职责**:
- 监听Agent Action消息
- 处理各种操作请求
- 协调各个功能模块
- 返回操作结果

**关键方法**:
```typescript
class ContentScript {
  async handleAgentAction(action: AgentAction): Promise<void> {
    switch (action.action) {
      case "checkReady":
        // 检查页面是否准备就绪
        break;
      case "extractContent":
        // 提取页面内容
        break;
      case "showMarks":
        // 显示元素高亮
        break;
      // ... 其他操作
    }
  }
  
  async onPageReady(): Promise<void> {
    // 页面加载完成后的初始化
    await this.waitForDomStable();
    new CookieAutoAccepter().checkAndAccept();
  }
}
```

### 2. Background Service Worker

**位置**: `background.ts.js`

**核心类**: `BackgroundService`

**主要职责**:
- 管理页面加载检测器
- 处理截图请求
- 处理图片获取请求
- 管理网络请求规则

**关键类**:
```typescript
class LoadingDetector {
  // 检测页面加载状态
  isLoading(): boolean;
  shouldTrackRequest(request): boolean;
  isTrackingUrl(url): boolean;
}

class BackgroundService {
  async init(): Promise<void> {
    // 初始化网络请求规则
    await chrome.declarativeNetRequest.updateDynamicRules(...);
    // 注册内容脚本
    await chrome.scripting.registerContentScripts(...);
    // 初始化加载检测器
    this.initLoadingDetector();
  }
}
```

### 3. 文章提取器 (ArticleExtractor)

**核心算法**:
1. 克隆DOM树并标记跳过元素
2. 分析元素内容（文本长度、链接密度、逗号数量等）
3. 计算置信度分数
4. 如果置信度低，使用Readability库作为备选
5. 转换为Markdown格式

**置信度计算**:
```typescript
calculateConfidence(analysis, markdown): number {
  let score = 0.5;
  // 文本长度因子 (0-0.2)
  score += Math.min(markdown.length / 10000, 1) * 0.2;
  // 链接密度因子 (0-0.15)
  score += (1 - Math.min(analysis.linkDensity, 0.5) * 2) * 0.15;
  // 逗号数量因子 (0-0.1)
  score += Math.min(analysis.commas / 50, 1) * 0.1;
  // 元素分数因子 (0-0.15)
  score += Math.min(Math.max(analysis.score, 0) / 100, 1) * 0.15;
  // 段落数量因子 (0-0.1)
  score += Math.min(paragraphs.length / 10, 1) * 0.1;
  // 标题匹配因子 (0-0.05)
  if (document.title && markdown.includes(document.title)) {
    score += 0.05;
  }
  return Math.max(0, Math.min(1, score));
}
```

### 4. 可点击元素管理器

**元素识别逻辑**:
1. 遍历DOM树，查找标记了`data-manus_clickable`的元素
2. 检查元素是否在视口中可见
3. 检查元素是否有可渲染的尺寸
4. 计算可见性比例
5. 生成元素描述信息

**元素描述格式**:
```
tagName {domId:"id", hint:"hint", type:"input_type", placeholder:"placeholder"} text
```

示例:
```
button {domId:"submit-btn", hint:"Submit form"} Submit
input {type:"text", placeholder:"Enter email"} 
```

---

## 功能实现细节

### 1. postMessage保护机制

**目的**: 防止页面代码干扰扩展的消息通信

**实现**: `contentInitScript.js`

```javascript
if (!window.__manusOriginalPostMessage) {
  window.__manusOriginalPostMessage = window.postMessage;
  window.__manusOrigin = window.origin;
}
```

扩展会检查消息的origin，确保只处理来自扩展的消息。

### 2. 网络请求规则

**目的**: 强制将下载改为内联显示

**实现**: `declarativeNetRequest` API

```javascript
{
  id: 1,
  priority: 1,
  action: {
    type: "MODIFY_HEADERS",
    responseHeaders: [
      { header: "content-disposition", operation: "REMOVE" },
      { header: "content-disposition", operation: "SET", value: "inline" }
    ]
  },
  condition: {
    urlFilter: "*",
    resourceTypes: ["main_frame", "sub_frame"]
  }
}
```

### 3. 元素选择器生成

**算法**: 从目标元素向上遍历DOM树，生成CSS选择器

**格式**: `body > div > button:nth-of-type(2)`

**特殊处理**:
- 如果元素有`data-manus_click_id`属性，优先使用pierce选择器
- 对于相同标签名的兄弟元素，使用`:nth-of-type()`定位

### 4. 图片提取策略

1. **img标签**: 直接获取src或currentSrc
2. **canvas元素**: 使用`toDataURL()`方法
3. **CSS背景图片**: 解析`background-image`样式
4. **截图方式**: 如果以上方法失败，使用Chrome截图API

### 5. Cookie自动接受流程

1. 页面加载完成后启动监控
2. 使用MutationObserver监听DOM变化
3. 检测新增节点中的Cookie相关文本
4. 刷新可点击元素列表
5. 查找包含"accept"、"allow"、"agree"等关键词的按钮
6. 检查按钮的父元素是否包含Cookie相关文本
7. 自动点击按钮
8. 停止后续监控

---

## 开发指南

### 1. 添加新功能

#### 步骤1: 在Content Script中添加处理逻辑

```typescript
// src/content/content.ts
async handleAgentAction(action: AgentAction) {
  switch (action.action) {
    case "newFeature":
      return await this.handleNewFeature(action);
    // ...
  }
}

async handleNewFeature(action: AgentAction) {
  // 实现新功能逻辑
  const result = await this.doSomething();
  
  this.sendActionResult(action, {
    success: true,
    data: result
  });
}
```

#### 步骤2: 更新类型定义

```typescript
interface AgentAction {
  action: "checkReady" | "extractContent" | "newFeature" | ...;
  // 新功能的参数
  param1?: string;
  param2?: number;
}
```

#### 步骤3: 在Popup中添加测试按钮（可选）

```html
<!-- src/popup/popup.html -->
<button id="test-new-feature">Test New Feature</button>
```

```typescript
// src/popup/popup.ts
document.getElementById('test-new-feature')?.addEventListener('click', async () => {
  const result = await sendAgentAction({
    action: "newFeature",
    param1: "value",
    param2: 123
  });
  console.log(result);
});
```

### 2. 调试技巧

#### 查看Content Script日志

1. 打开Chrome DevTools
2. 在Console中切换到Content Script上下文
3. 查看日志输出

#### 查看Background Script日志

1. 访问 `chrome://extensions/`
2. 找到Manus Helper扩展
3. 点击"service worker"链接
4. 在打开的DevTools中查看日志

#### 测试消息通信

```javascript
// 在页面Console中测试
window.postMessage({
  type: "__agentAction__",
  action: "extractContent",
  actionId: "test-123"
}, window.origin);

// 监听响应
window.addEventListener('message', (event) => {
  if (event.data.type === "__agentActionResult__") {
    console.log('Response:', event.data);
  }
});
```

### 3. 性能优化建议

1. **延迟加载**: 只在需要时初始化功能模块
2. **防抖节流**: 对频繁触发的操作进行防抖处理
3. **缓存结果**: 缓存提取的内容和元素列表
4. **批量处理**: 批量处理DOM操作
5. **使用Web Workers**: 对于CPU密集型任务，考虑使用Web Workers

### 4. 常见问题

#### Q: Content Script无法访问页面变量？

A: 确保Content Script在正确的world中执行。如果需要访问页面变量，使用`world: "MAIN"`。

#### Q: 跨域图片无法获取？

A: 使用Background Script的`FETCH_IMAGE`消息，Background Script可以绕过CORS限制。

#### Q: 页面动态加载的内容无法识别？

A: 使用MutationObserver监听DOM变化，动态更新元素列表。

#### Q: PDF内容提取失败？

A: 确保PDF embed元素已加载完成，可能需要等待一段时间。

### 5. 构建和发布

#### 开发构建

```bash
npm run dev
```

#### 生产构建

```bash
npm run build
```

#### 打包扩展

1. 构建项目: `npm run build`
2. 压缩dist目录为zip文件
3. 在Chrome Web Store开发者控制台上传

---

## 依赖库分析

### 1. Readability

**用途**: 文章内容提取

**来源**: Mozilla Readability项目

**功能**: 
- 智能识别文章主体内容
- 过滤广告和无关内容
- 提取文章元数据（标题、作者等）

### 2. Turndown

**用途**: HTML转Markdown

**功能**:
- 将HTML元素转换为Markdown语法
- 支持代码块、表格、链接等复杂元素
- 可配置转换规则

### 3. Intl.Segmenter

**用途**: 文本分割

**功能**:
- 按句子分割文本
- 支持多语言
- 用于关键词查找的上下文提取

---

## 扩展配置说明

### Manifest V3特性

1. **Service Worker**: 替代了Background Page
2. **Declarative Net Request**: 替代了webRequest API的部分功能
3. **Host Permissions**: 分离了权限声明

### 权限说明

- `declarativeNetRequest`: 修改HTTP响应头
- `scripting`: 动态注入脚本
- `webRequest`: 监听网络请求
- `webNavigation`: 监听导航事件
- `tabCapture`: 截图功能
- `<all_urls>`: 访问所有网站

### Content Script配置

- `run_at: "document_start"`: 在DOM构建之前执行
- `world: "MAIN"`: 在主世界中执行，可以访问页面变量
- `matches: ["<all_urls>"]`: 匹配所有URL

---

## 总结

Manus Helper扩展是一个功能完善的浏览器自动化工具，为AI Agent提供了丰富的页面交互能力。通过本文档，开发者可以：

1. 理解扩展的整体架构
2. 了解各个功能模块的实现
3. 快速搭建开发环境
4. 添加新功能和调试问题

### 下一步开发建议

1. **TypeScript重构**: 将编译后的JS代码重构为TypeScript源码
2. **单元测试**: 为核心功能模块添加单元测试
3. **文档完善**: 添加API文档和使用示例
4. **性能优化**: 优化大型页面的处理性能
5. **错误处理**: 完善错误处理和日志记录
6. **国际化**: 支持多语言界面

---

## 参考资料

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Mozilla Readability](https://github.com/mozilla/readability)
- [Turndown](https://github.com/mixmark-io/turndown)

---

**文档版本**: 1.0  
**最后更新**: 2026-01-10  
**基于Manus Helper版本**: 1.1.11