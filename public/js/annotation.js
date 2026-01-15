/**
 * Annotation System - 博客批注功能
 *
 * 功能：
 * 1. 文本选择检测
 * 2. 浮动按钮显示
 * 3. 批注编辑器
 * 4. 与 Giscus 集成
 */

(function() {
  'use strict';

  // ============================================
  // 配置
  // ============================================

  const CONFIG = {
    minSelectionLength: 5,
    maxSelectionLength: 500,
    articleSelector: '#postContent',
    storageKey: 'blog_annotations_' + window.location.pathname
  };

  // ============================================
  // DOM 元素引用
  // ============================================

  let elements = {};

  function initElements() {
    elements = {
      article: document.querySelector(CONFIG.articleSelector),
      trigger: document.getElementById('annotationTrigger'),
      btnAdd: document.getElementById('btnAddAnnotation'),
      overlay: document.getElementById('annotationEditorOverlay'),
      editorClose: document.getElementById('editorClose'),
      editorCancel: document.getElementById('editorCancel'),
      editorSubmit: document.getElementById('editorSubmit'),
      editorQuoteText: document.getElementById('editorQuoteText'),
      editorInput: document.getElementById('editorInput'),
      annotationList: document.getElementById('annotationList'),
      annotationListMobile: document.getElementById('annotationListMobile')
    };
  }

  // ============================================
  // 状态
  // ============================================

  let state = {
    selectedText: '',
    selectionRect: null,
    annotations: []
  };

  // ============================================
  // SelectionDetector - 文本选择检测
  // ============================================

  const SelectionDetector = {
    init() {
      document.addEventListener('mouseup', this.handleMouseUp.bind(this));
      document.addEventListener('keyup', this.handleKeyUp.bind(this));
      // 点击其他区域隐藏按钮
      document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    },

    handleMouseUp(e) {
      // 如果点击在触发按钮上，不处理
      if (elements.trigger && elements.trigger.contains(e.target)) {
        return;
      }

      setTimeout(() => {
        this.checkSelection(e);
      }, 10);
    },

    handleKeyUp(e) {
      // Shift + 方向键选择文本
      if (e.shiftKey) {
        this.checkSelection(e);
      }
    },

    handleMouseDown(e) {
      // 点击非按钮区域时隐藏
      if (elements.trigger &&
          !elements.trigger.contains(e.target) &&
          elements.trigger.classList.contains('visible')) {
        FloatingButton.hide();
      }
    },

    checkSelection(e) {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length >= CONFIG.minSelectionLength && this.isInArticle(selection)) {
        const truncatedText = text.length > CONFIG.maxSelectionLength
          ? text.substring(0, CONFIG.maxSelectionLength) + '...'
          : text;

        state.selectedText = truncatedText;

        const range = selection.getRangeAt(0);
        state.selectionRect = range.getBoundingClientRect();

        FloatingButton.show(state.selectionRect);
      } else {
        state.selectedText = '';
        state.selectionRect = null;
      }
    },

    isInArticle(selection) {
      if (!elements.article || selection.rangeCount === 0) return false;

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // 检查是否在文章内容区域
      return elements.article.contains(container);
    }
  };

  // ============================================
  // FloatingButton - 浮动按钮
  // ============================================

  const FloatingButton = {
    show(rect) {
      if (!elements.trigger) return;

      // 计算位置：选区上方居中
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      const top = rect.top + scrollY - 40;
      const left = rect.left + scrollX + (rect.width / 2) - 30;

      elements.trigger.style.top = Math.max(10, top) + 'px';
      elements.trigger.style.left = Math.max(10, left) + 'px';
      elements.trigger.classList.add('visible');
    },

    hide() {
      if (elements.trigger) {
        elements.trigger.classList.remove('visible');
      }
    }
  };

  // ============================================
  // AnnotationEditor - 批注编辑器
  // ============================================

  const AnnotationEditor = {
    init() {
      if (elements.btnAdd) {
        elements.btnAdd.addEventListener('click', this.open.bind(this));
      }
      if (elements.editorClose) {
        elements.editorClose.addEventListener('click', this.close.bind(this));
      }
      if (elements.editorCancel) {
        elements.editorCancel.addEventListener('click', this.close.bind(this));
      }
      if (elements.editorSubmit) {
        elements.editorSubmit.addEventListener('click', this.submit.bind(this));
      }
      if (elements.overlay) {
        elements.overlay.addEventListener('click', (e) => {
          if (e.target === elements.overlay) {
            this.close();
          }
        });
      }
      if (elements.editorInput) {
        elements.editorInput.addEventListener('keydown', (e) => {
          // Ctrl+Enter 提交
          if (e.ctrlKey && e.key === 'Enter') {
            this.submit();
          }
          // ESC 关闭
          if (e.key === 'Escape') {
            this.close();
          }
        });
      }
    },

    open() {
      if (!state.selectedText) return;

      FloatingButton.hide();

      // 填充引用内容
      if (elements.editorQuoteText) {
        elements.editorQuoteText.textContent = state.selectedText;
      }

      // 清空输入框
      if (elements.editorInput) {
        elements.editorInput.value = '';
      }

      // 显示模态框
      if (elements.overlay) {
        elements.overlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
      }

      // 聚焦输入框
      setTimeout(() => {
        if (elements.editorInput) {
          elements.editorInput.focus();
        }
      }, 100);
    },

    close() {
      if (elements.overlay) {
        elements.overlay.classList.remove('visible');
        document.body.style.overflow = '';
      }
      state.selectedText = '';
    },

    submit() {
      const quote = elements.editorQuoteText ? elements.editorQuoteText.textContent : '';
      const body = elements.editorInput ? elements.editorInput.value.trim() : '';

      if (!body) {
        alert('请输入批注内容');
        return;
      }

      // 生成批注格式
      const annotationContent = this.formatAnnotation(quote, body);

      // 尝试提交到 Giscus
      const submitted = GiscusAdapter.submitAnnotation(annotationContent);

      if (!submitted) {
        // 如果 Giscus 未就绪，保存到本地存储并显示
        this.saveLocal(quote, body);
      }

      this.close();
    },

    formatAnnotation(quote, body) {
      const quotedText = quote.split('\n').map(line => '> ' + line).join('\n');
      return `<!-- annotation:start -->\n${quotedText}\n\n${body}\n<!-- annotation:end -->`;
    },

    saveLocal(quote, body) {
      const annotation = {
        id: Date.now(),
        quote: quote,
        body: body,
        createdAt: new Date().toISOString(),
        author: '访客'
      };

      state.annotations.push(annotation);

      // 保存到 localStorage
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.annotations));
      } catch (e) {
        console.warn('无法保存到 localStorage:', e);
      }

      // 渲染批注
      AnnotationRenderer.render();
    }
  };

  // ============================================
  // GiscusAdapter - Giscus 适配器
  // ============================================

  const GiscusAdapter = {
    init() {
      // 监听 Giscus 消息
      window.addEventListener('message', this.handleMessage.bind(this));
    },

    handleMessage(event) {
      if (event.origin !== 'https://giscus.app') return;

      const data = event.data;
      if (!data.giscus) return;

      // 处理来自 Giscus 的消息
      if (data.giscus.discussion) {
        this.parseAnnotations(data.giscus.discussion);
      }
    },

    submitAnnotation(content) {
      const iframe = document.querySelector('iframe.giscus-frame');

      if (!iframe) {
        // Giscus 未加载，显示提示
        this.showGiscusPrompt(content);
        return false;
      }

      // 尝试通过 postMessage 设置评论内容
      try {
        iframe.contentWindow.postMessage({
          giscus: {
            setConfig: {
              inputValue: content
            }
          }
        }, 'https://giscus.app');

        // 滚动到 Giscus 区域
        const giscusContainer = document.querySelector('.giscus-container');
        if (giscusContainer) {
          giscusContainer.scrollIntoView({ behavior: 'smooth' });
        }

        return true;
      } catch (e) {
        console.warn('无法与 Giscus 通信:', e);
        return false;
      }
    },

    showGiscusPrompt(content) {
      // 复制到剪贴板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(content).then(() => {
          alert('批注内容已复制到剪贴板！\n\n请滚动到页面底部的评论区，粘贴并提交。');
        }).catch(() => {
          this.showManualCopy(content);
        });
      } else {
        this.showManualCopy(content);
      }
    },

    showManualCopy(content) {
      // 降级方案：显示内容让用户手动复制
      const msg = '请复制以下内容到评论区：\n\n' + content;
      prompt('批注内容', content);
    },

    parseAnnotations(discussion) {
      if (!discussion.comments) return;

      const annotations = [];

      discussion.comments.forEach(comment => {
        const parsed = this.parseAnnotationContent(comment.body);
        if (parsed) {
          annotations.push({
            id: comment.id,
            quote: parsed.quote,
            body: parsed.body,
            createdAt: comment.createdAt,
            author: comment.author.login,
            replies: (comment.replies || []).map(reply => ({
              id: reply.id,
              body: reply.body,
              createdAt: reply.createdAt,
              author: reply.author.login
            }))
          });
        }
      });

      state.annotations = annotations;
      AnnotationRenderer.render();
    },

    parseAnnotationContent(content) {
      const regex = /<!-- annotation:start -->\n([\s\S]*?)\n<!-- annotation:end -->/;
      const match = content.match(regex);

      if (!match) return null;

      const innerContent = match[1];
      const quoteRegex = /^((?:>.*\n?)+)/;
      const quoteMatch = innerContent.match(quoteRegex);

      if (!quoteMatch) return null;

      const quote = quoteMatch[1].replace(/^> ?/gm, '').trim();
      const body = innerContent.replace(quoteRegex, '').trim();

      return { quote, body };
    }
  };

  // ============================================
  // AnnotationRenderer - 批注渲染器
  // ============================================

  const AnnotationRenderer = {
    render() {
      const html = this.generateHTML();

      if (elements.annotationList) {
        elements.annotationList.innerHTML = html;
      }
      if (elements.annotationListMobile) {
        elements.annotationListMobile.innerHTML = html;
      }
    },

    generateHTML() {
      if (state.annotations.length === 0) {
        return '<div class="annotation-empty">暂无批注</div>';
      }

      return state.annotations.map(annotation => this.renderItem(annotation)).join('');
    },

    renderItem(annotation) {
      const date = new Date(annotation.createdAt);
      const dateStr = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      const repliesHTML = annotation.replies && annotation.replies.length > 0
        ? `<div class="annotation-item-replies">
            ${annotation.replies.map(r => this.renderReply(r)).join('')}
           </div>`
        : '';

      return `
        <div class="annotation-item" data-id="${annotation.id}">
          <div class="annotation-item-quote">${this.escapeHtml(annotation.quote)}</div>
          <div class="annotation-item-body">${this.renderMarkdown(annotation.body)}</div>
          <div class="annotation-item-meta">
            <span class="annotation-item-author">${this.escapeHtml(annotation.author)}</span>
            <span>·</span>
            <span>${dateStr}</span>
          </div>
          ${repliesHTML}
        </div>
      `;
    },

    renderReply(reply) {
      const date = new Date(reply.createdAt);
      const dateStr = date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      });

      return `
        <div class="annotation-reply">
          <strong>${this.escapeHtml(reply.author)}</strong>
          <span style="color: #999; margin-left: 0.5rem;">${dateStr}</span>
          <div>${this.renderMarkdown(reply.body)}</div>
        </div>
      `;
    },

    renderMarkdown(text) {
      // 简单的 Markdown 渲染
      // 粗体
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // 斜体
      text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // 行内代码
      text = text.replace(/`(.*?)`/g, '<code>$1</code>');
      // 链接
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
      // 换行
      text = text.replace(/\n/g, '<br>');

      return text;
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  // ============================================
  // Storage - 本地存储
  // ============================================

  const Storage = {
    load() {
      try {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
          state.annotations = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('无法从 localStorage 读取:', e);
      }
    }
  };

  // ============================================
  // 初始化
  // ============================================

  function init() {
    // 确保 DOM 已加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doInit);
    } else {
      doInit();
    }
  }

  function doInit() {
    initElements();

    // 检查是否在文章页面
    if (!elements.article) {
      console.log('Annotation: 不在文章页面，跳过初始化');
      return;
    }

    // 初始化各模块
    SelectionDetector.init();
    AnnotationEditor.init();
    GiscusAdapter.init();

    // 加载本地存储的批注
    Storage.load();

    // 渲染批注
    AnnotationRenderer.render();

    console.log('Annotation: 初始化完成');
  }

  // 启动
  init();

})();
