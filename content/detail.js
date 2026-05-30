(function () {
  function isCourseDetailPage() {
    return /\/zzpx\/courseDetail\/(\d+)/.test(location.pathname);
  }

  function ensureButton() {
    if (document.getElementById('class-attender-batch-play')) return;

    const btn = document.createElement('button');
    btn.id = 'class-attender-batch-play';
    btn.textContent = '继续学习';
    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '24px',
      zIndex: '2147483647',
      padding: '10px 14px',
      background: '#1677ff',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    });
    btn.addEventListener('click', onContinueStudyClick);
    document.body.appendChild(btn);
  }

  function normalizeUrl(url) {
    if (!url) return null;
    try {
      return new URL(url, location.origin).href;
    } catch (_) {
      return null;
    }
  }

  function extractUrlsFromHtml(html) {
    const urls = new Set();
    const absRe = /https?:\/\/[^"'\s]*\/video\/courseLearnPage\?[^"'\s]*/g;
    const relRe = /\/(?:video)\/courseLearnPage\?[^"'\s]*/g;
    let m;
    while ((m = absRe.exec(html)) !== null) {
      const u = normalizeUrl(m[0]);
      if (u) urls.add(u);
    }
    while ((m = relRe.exec(html)) !== null) {
      const u = normalizeUrl(m[0]);
      if (u) urls.add(u);
    }
    return Array.from(urls);
  }

  function getLessonUrlsFromElement(el) {
    const urls = new Set();
    // 直接 a[href]
    const a = el.matches('a[href]') ? el : el.querySelector('a[href]');
    if (a && /courseLearnPage/.test(a.getAttribute('href') || '')) {
      const u = normalizeUrl(a.href);
      if (u) urls.add(u);
    }
    // data-href / data-url
    const attrs = ['data-href', 'data-url', 'href'];
    for (const key of attrs) {
      const v = el.getAttribute && el.getAttribute(key);
      if (v && /courseLearnPage/.test(v)) {
        const u = normalizeUrl(v);
        if (u) urls.add(u);
      }
    }
    // onclick 内联
    const onclick = el.getAttribute && el.getAttribute('onclick');
    if (onclick) {
      const kpsMatch = onclick.match(/kps\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (kpsMatch) urls.add(normalizeUrl(`/video/courseLearnPage?id=${kpsMatch[1]}&&classId=${kpsMatch[2]}`));
    }
    if (onclick && /courseLearnPage/.test(onclick)) {
      extractUrlsFromHtml(onclick).forEach(u => urls.add(u));
    }
    // outerHTML 兜底
    try {
      extractUrlsFromHtml(el.outerHTML || '').forEach(u => urls.add(u));
    } catch (_) {}
    return Array.from(urls);
  }

  function collectLessonElements() {
    const selectors = [
      '.section',
      '.lesson',
      '.course-item',
      '.catalog-item',
      '[onclick*="courseLearnPage"]',
      '[onclick*="kps("]',
      '[data-href*="courseLearnPage"]',
      '[data-url*="courseLearnPage"]',
      'a[href*="/video/courseLearnPage"]',
      'a[href*="courseLearnPage?"]'
    ];
    const nodeList = selectors.map(s => Array.from(document.querySelectorAll(s))).flat();
    // 去重
    return Array.from(new Set(nodeList));
  }

  function isCompletedFor(el) {
    if (!el) return false;
    // 仅在元素本身或其最近的容器内判断，避免被页面整体进度误伤
    const container = el.closest('.section, .lesson, .course-item, .catalog-item, li, tr, .item, [class*="lesson"], [class*="section"], [class*="item"]') || el;
    const progressEls = container.querySelectorAll('span.layui-progress-text');
    for (const p of progressEls) {
      const text = (p.textContent || '').trim();
      const m = text.match(/(\d+)\s*%/);
      if (m && Number(m[1]) >= 100) return true;
    }
    const text = (container.textContent || '').replace(/\s+/g, '');
    if (/已完成|学习完成|已学完|100\s*%/.test(text)) return true;
    return false;
  }

  function openSingleLesson(url) {
    if (!url) return false;
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_URL_IN_TAB', url });
    } catch (_) {
      try { window.open(url, '_blank'); } catch (__) {}
    }
    return true;
  }

  async function onContinueStudyClick() {
    const elements = collectLessonElements();
    let clickable = elements.filter(el => !isCompletedFor(el));
    // 如果全部被过滤（可能误判），则不做过滤直接尝试
    if (elements.length > 0 && clickable.length === 0) clickable = elements.slice();

    if (clickable.length > 0) {
      const first = clickable[0];
      const urls = getLessonUrlsFromElement(first);
      if (urls.length && openSingleLesson(urls[0])) return;
      try {
        first.click();
        return;
      } catch (_) {
        // continue to HTML fallback
      }
    }

    // 进一步：直接从页面 HTML 中抓取所有播放链接
    const html = document.documentElement ? document.documentElement.outerHTML : (document.body ? document.body.innerHTML : '');
    const urlCandidates = extractUrlsFromHtml(html);
    const uniqueUrls = Array.from(new Set(urlCandidates));
    if (uniqueUrls.length === 0) {
      // 延时重试一次，适配异步渲染
      setTimeout(() => {
        const html2 = document.documentElement ? document.documentElement.outerHTML : (document.body ? document.body.innerHTML : '');
        const urls2 = extractUrlsFromHtml(html2);
        if (urls2.length) {
          openSingleLesson(normalizeUrl(urls2[0]));
        } else {
          alert('未找到课时入口（.section 或播放链接）。');
        }
      }, 1200);
      return;
    }
    openSingleLesson(uniqueUrls[0]);
  }

  function init() {
    if (!isCourseDetailPage()) return;
    ensureButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

