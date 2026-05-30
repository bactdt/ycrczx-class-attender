(function () {
  function isCourseLearnPage() {
    return /\/video\/courseLearnPage/.test(location.pathname);
  }

  function injectForegroundSpoofing() {
    // 已改为在主世界注入（learn_mainworld.js），此处不再注入内联脚本以避免 CSP 报错
  }

  function tryClickPlay() {
    // 优先使用给出的选择器
    const btn = document.querySelector('.vjs-big-play-button');
    if (btn) {
      btn.click();
      return true;
    }
    // 可能页面延迟渲染，继续返回 false
    return false;
  }

  const NEXT_PENDING_ATTR = 'data-class-attender-next-pending';
  function setNextPending(active) {
    try {
      const root = document.documentElement;
      if (!root) return;
      if (active) root.setAttribute(NEXT_PENDING_ATTR, '1');
      else root.removeAttribute(NEXT_PENDING_ATTR);
    } catch (_) {}
  }
  function isNextPending() {
    try {
      return document.documentElement && document.documentElement.getAttribute(NEXT_PENDING_ATTR) === '1';
    } catch (_) {
      return false;
    }
  }
  function isVideoComplete(video) {
    if (!video) return false;
    return Boolean(video.ended);
  }

  const runtimeState = {
    logs: [],
    courseTitle: '',
    classId: '',
    lessonId: '',
    nextLessonId: '',
    lessonList: []
  };
  const COURSE_QUEUE_KEY = 'class_attender_course_queue';
  let hasLoggedAutoPlay = false;

  function getPageQueryParam(key) {
    try {
      return new URLSearchParams(location.search.replace(/&&/g, '&')).get(key) || '';
    } catch (_) {
      return '';
    }
  }

  function getLessonIdFromUrl(url) {
    try {
      return new URL(url, location.href).searchParams.get('id') || '';
    } catch (_) {
      return '';
    }
  }

  function getClassIdFromUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      return parsed.searchParams.get('classId') || parsed.pathname.match(/\/zzpx\/courseDetail\/(\d+)/)?.[1] || '';
    } catch (_) {
      return '';
    }
  }

  function readCourseQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem(COURSE_QUEUE_KEY) || '[]');
      return Array.isArray(queue) ? queue : [];
    } catch (_) {
      return [];
    }
  }

  function saveCourseQueue(queue) {
    try {
      localStorage.setItem(COURSE_QUEUE_KEY, JSON.stringify(queue || []));
    } catch (_) {}
  }

  function refreshRuntimeState(extra = {}) {
    runtimeState.classId = extra.classId || getPageQueryParam('classId') || runtimeState.classId;
    runtimeState.lessonId = extra.lessonId || getPageQueryParam('id') || runtimeState.lessonId;
    runtimeState.courseTitle = extra.courseTitle || runtimeState.courseTitle || (document.title || '').split('-')[0].trim();
    runtimeState.nextLessonId = extra.nextLessonId || runtimeState.nextLessonId;
    updatePanelUI();
  }

  function appendLog(message) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    runtimeState.logs.unshift(`${time} ${message}`);
    runtimeState.logs = runtimeState.logs.slice(0, 10);
    try { console.info('[Class Attender]', message); } catch (_) {}
    updatePanelUI();
  }

  function updatePanelUI() {
    try {
      const course = document.getElementById('class-attender-course-info');
      if (course) {
        const title = runtimeState.courseTitle || '当前课程';
        const classId = runtimeState.classId || '-';
        const lessonId = runtimeState.lessonId || '-';
        const nextLessonId = runtimeState.nextLessonId || '-';
        course.textContent = `${title} | 课程 ${classId} | 当前 ${lessonId} | 下一 ${nextLessonId}`;
      }

      const logs = document.getElementById('class-attender-log-list');
      if (logs) {
        logs.textContent = '';
        const entries = runtimeState.logs.length ? runtimeState.logs : ['等待执行日志...'];
        entries.forEach((entry) => {
          const item = document.createElement('div');
          item.textContent = entry;
          item.style.lineHeight = '1.45';
          item.style.wordBreak = 'break-all';
          logs.appendChild(item);
        });
      }

      const lessonList = document.getElementById('class-attender-lesson-list');
      if (lessonList) {
        lessonList.textContent = runtimeState.lessonList.length ? `目录：${runtimeState.lessonList.join(' -> ')}` : '目录：等待解析';
      }
    } catch (_) {}
  }

  const RATE_STORAGE_KEY = 'class_attender_rate';
  function getTargetRate() {
    const v = Number(localStorage.getItem(RATE_STORAGE_KEY) || '2');
    if (Number.isFinite(v) && v > 0) return Math.min(Math.max(v, 0.25), 16);
    return 2;
  }
  function setTargetRate(rate) {
    const r = Math.min(Math.max(Number(rate) || 1, 0.25), 16);
    localStorage.setItem(RATE_STORAGE_KEY, String(r));
    applyRateToAll(r);
    updateRateUI();
    appendLog(`倍速调整为 ${r.toFixed(2)}x`);
  }

  function applyRateToAll(rate) {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      try {
        v.playbackRate = rate;
        // 若被页面修改，监听 ratechange 立即改回
        const onRateChange = () => {
          if (Math.abs(v.playbackRate - rate) > 0.001) {
            try { v.playbackRate = rate; } catch (_) {}
          }
        };
        v.removeEventListener('ratechange', onRateChange);
        v.addEventListener('ratechange', onRateChange);
        // 元数据加载完后再设置一次
        v.addEventListener('loadedmetadata', () => { try { v.playbackRate = rate; } catch (_) {} }, { once: true });
      } catch (_) {}
    });
  }

  function observeNewVideos(rate) {
    const obs = new MutationObserver(() => applyRateToAll(rate));
    obs.observe(document.documentElement || document.body, { subtree: true, childList: true });
  }

  function updateRateUI() {
    try {
      const label = document.getElementById('class-attender-rate-value');
      if (label) label.textContent = getTargetRate().toFixed(2) + 'x';
    } catch (_) {}
  }

  function createRateControl() {
    if (document.getElementById('class-attender-rate-control')) return;
    const root = document.createElement('div');
    root.id = 'class-attender-rate-control';
    Object.assign(root.style, {
      position: 'fixed',
      right: '16px',
      bottom: '120px',
      zIndex: '2147483647',
      background: 'rgba(0,0,0,0.65)',
      color: '#fff',
      width: '320px',
      maxWidth: 'calc(100vw - 32px)',
      padding: '10px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      userSelect: 'none',
      boxSizing: 'border-box',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
    });

    const makeBtn = (text) => {
      const b = document.createElement('button');
      b.textContent = text;
      Object.assign(b.style, {
        background: '#1677ff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '2px 8px',
        cursor: 'pointer'
      });
      b.addEventListener('click', (e) => e.stopPropagation());
      return b;
    };

    const minus = makeBtn('-');
    const plus = makeBtn('+');
    const label = document.createElement('span');
    label.id = 'class-attender-rate-value';
    label.textContent = getTargetRate().toFixed(2) + 'x';
    label.style.minWidth = '44px';
    label.style.textAlign = 'center';

    minus.addEventListener('click', () => setTargetRate(getTargetRate() - 0.25));
    plus.addEventListener('click', () => setTargetRate(getTargetRate() + 0.25));

    const header = document.createElement('div');
    header.textContent = 'Class Attender';
    Object.assign(header.style, {
      fontWeight: '700',
      fontSize: '13px',
      marginBottom: '6px'
    });

    const courseInfo = document.createElement('div');
    courseInfo.id = 'class-attender-course-info';
    Object.assign(courseInfo.style, {
      color: 'rgba(255,255,255,0.82)',
      marginBottom: '4px',
      lineHeight: '1.45',
      wordBreak: 'break-all'
    });

    const lessonList = document.createElement('div');
    lessonList.id = 'class-attender-lesson-list';
    Object.assign(lessonList.style, {
      color: 'rgba(255,255,255,0.74)',
      marginBottom: '8px',
      lineHeight: '1.45',
      wordBreak: 'break-all',
      maxHeight: '42px',
      overflowY: 'auto'
    });

    const rateRow = document.createElement('div');
    Object.assign(rateRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px'
    });
    const rateTitle = document.createElement('span');
    rateTitle.textContent = '倍速';
    rateTitle.style.color = 'rgba(255,255,255,0.86)';
    rateRow.appendChild(rateTitle);
    rateRow.appendChild(minus);
    rateRow.appendChild(label);
    rateRow.appendChild(plus);

    const logTitle = document.createElement('div');
    logTitle.textContent = '执行日志';
    Object.assign(logTitle.style, {
      color: 'rgba(255,255,255,0.86)',
      margin: '6px 0 4px'
    });

    const logList = document.createElement('div');
    logList.id = 'class-attender-log-list';
    Object.assign(logList.style, {
      maxHeight: '120px',
      overflowY: 'auto',
      padding: '6px',
      borderRadius: '6px',
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.9)'
    });

    // 双击容器重置倍速
    root.addEventListener('dblclick', () => setTargetRate(1));

    // 简单拖拽
    let dragging = false; let sx = 0; let sy = 0; let sr = 0; let sb = 0;
    const onDown = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; sr = parseInt(root.style.right); sb = parseInt(root.style.bottom); e.preventDefault(); };
    const onMove = (e) => { if (!dragging) return; const dx = e.clientX - sx; const dy = e.clientY - sy; root.style.right = (sr - dx) + 'px'; root.style.bottom = (sb - dy) + 'px'; };
    const onUp = () => { dragging = false; };
    root.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    root.appendChild(header);
    root.appendChild(courseInfo);
    root.appendChild(lessonList);
    root.appendChild(rateRow);
    root.appendChild(logTitle);
    root.appendChild(logList);
    document.body.appendChild(root);
    refreshRuntimeState();
    updatePanelUI();
  }

  function bindHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (!e.altKey) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setTargetRate(getTargetRate() + 0.25);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setTargetRate(getTargetRate() - 0.25);
      } else if (e.key === '0') {
        e.preventDefault();
        setTargetRate(1);
      }
    });
  }

  async function forcePlayVideo() {
    const video = document.querySelector('video');
    if (!video) return false;
    if (isNextPending() || isVideoComplete(video)) return false;
    try {
      // 设置静音，避免未授权播放被拦截
      video.muted = true;
      video.volume = 0;
      // 保证播放速度和暂停状态
      video.playbackRate = getTargetRate();
      // 劫持在主世界脚本中实现（learn_mainworld.js），此处不做任何内联注入以避免 CSP
      await video.play();
      if (!hasLoggedAutoPlay) {
        appendLog(`自动播放课时 ${runtimeState.lessonId || getPageQueryParam('id') || '-'}`);
        hasLoggedAutoPlay = true;
      }
      return true;
    } catch (e) {
      // 若自动播放被策略拦截，继续依赖按钮点击循环
      return false;
    }
  }

  function muteTab() {
    try {
      chrome.runtime.sendMessage({ type: 'MUTE_ACTIVE_TAB' });
    } catch (_) {
      // ignore
    }
    // 同时静音页面内所有 video，双保险
    document.querySelectorAll('video').forEach(v => {
      try { v.muted = true; v.volume = 0; } catch (_) {}
    });
  }

  function waitForPlayButtonAndPlay(timeoutMs = 15000) {
    const start = Date.now();
    const timer = setInterval(async () => {
      const clicked = tryClickPlay();
      const played = await forcePlayVideo();
      if (clicked || played || Date.now() - start > timeoutMs) {
        clearInterval(timer);
      }
    }, 600);
  }

  function autoProceedNextOnEnded() {
    const boundVideos = new WeakSet();
    let lastAttemptAt = 0;

    const normalizeUrl = (url) => {
      if (!url) return null;
      try { return new URL(url, location.href).href; } catch (_) { return null; }
    };
    const getQueryParam = (key) => {
      try {
        return new URLSearchParams(location.search.replace(/&&/g, '&')).get(key);
      } catch (_) {
        return null;
      }
    };
    const buildLearnUrl = (lessonId, classId) => {
      if (!lessonId || !classId) return null;
      return `${location.origin}/video/courseLearnPage?id=${lessonId}&&classId=${classId}`;
    };

    const isVisible = (el) => {
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      } catch (_) {
        return true;
      }
    };

    const isDisabled = (el) => {
      const className = String(el.className || '');
      return Boolean(el.disabled || el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true' || /disabled|layui-disabled/.test(className));
    };

    const getText = (el) => {
      return [
        el.textContent || '',
        el.value || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        el.getAttribute('class') || ''
      ].join(' ').replace(/\s+/g, ' ').trim();
    };

    const extractCourseLearnUrl = (el) => {
      const attrs = ['href', 'data-href', 'data-url'];
      for (const key of attrs) {
        const value = el.getAttribute && el.getAttribute(key);
        if (value && /courseLearnPage/.test(value)) return normalizeUrl(value);
      }
      const html = (el.outerHTML || '') + ' ' + (el.getAttribute && el.getAttribute('onclick') || '');
      const kpsMatch = html.match(/kps\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (kpsMatch) return buildLearnUrl(kpsMatch[1], kpsMatch[2]);
      const absMatch = html.match(/https?:\/\/[^"'\s]*\/video\/courseLearnPage\?[^"'\s]*/);
      if (absMatch) return normalizeUrl(absMatch[0]);
      const relMatch = html.match(/\/video\/courseLearnPage\?[^"'\s]*/);
      return relMatch ? normalizeUrl(relMatch[0]) : null;
    };

    const navigateToUrl = (url) => {
      if (!url || url === location.href) return false;
      setNextPending(true);
      const nextId = getLessonIdFromUrl(url);
      refreshRuntimeState({ nextLessonId: nextId });
      appendLog(nextId ? `跳转下一课时 ${nextId}` : `跳转下一课时 ${url}`);
      try { location.href = url; } catch (_) { return false; }
      setTimeout(() => setNextPending(false), 5000);
      return true;
    };

    const clickNext = (el, url) => {
      if (!el) return false;
      if (el.ownerDocument !== document) return navigateToUrl(url);
      if (isDisabled(el) || !isVisible(el)) return false;
      setNextPending(true);
      const nextId = getLessonIdFromUrl(url);
      refreshRuntimeState({ nextLessonId: nextId });
      appendLog(nextId ? `点击下一课时入口 ${nextId}` : '点击下一节入口');
      const before = location.href;
      try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
      try { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
      try { el.click(); } catch (_) {}
      if (url && url !== before) {
        setTimeout(() => {
          try {
            if (location.href === before) location.href = url;
          } catch (_) {}
        }, 800);
      }
      setTimeout(() => setNextPending(false), 5000);
      return true;
    };

    const findNextByButtonText = () => {
      const nextTextRe = /(下一节|下一课|下一集|下一章|下一讲|下一个|继续学习|继续播放|下一)/;
      const rejectTextRe = /(上一|上一个|返回|重播|重新|回放|目录)/;
      const selectors = [
        'a.next',
        'button.next',
        '[class*="next"]',
        '[aria-label*="下一"]',
        '[title*="下一"]',
        'a',
        'button'
      ];
      const candidates = Array.from(new Set(selectors.map(s => Array.from(document.querySelectorAll(s))).flat()));
      return candidates.find((el) => {
        if (!isVisible(el) || isDisabled(el)) return false;
        const text = getText(el);
        return nextTextRe.test(text) && !rejectTextRe.test(text);
      });
    };

    const collectCourseLinkItems = (root = document, requireVisible = true) => {
      const selectors = [
        'a[href*="courseLearnPage"]',
        '[onclick*="courseLearnPage"]',
        '[data-href*="courseLearnPage"]',
        '[data-url*="courseLearnPage"]',
        '[onclick*="kps("]',
        '.section'
      ];
      const items = Array.from(new Set(selectors.map(s => Array.from(root.querySelectorAll(s))).flat()))
        .map(el => ({ el, url: extractCourseLearnUrl(el) }))
        .filter(item => item.url && (!requireVisible || isVisible(item.el)) && !isDisabled(item.el));
      const lessonIds = Array.from(new Set(items.map(item => getLessonIdFromUrl(item.url)).filter(Boolean)));
      if (lessonIds.length) {
        runtimeState.lessonList = lessonIds;
        updatePanelUI();
      }
      return items;
    };

    const findNextByCourseLinks = (root = document, requireVisible = true) => {
      const currentId = getQueryParam('id');
      const items = collectCourseLinkItems(root, requireVisible);
      if (items.length === 0) return null;

      let index = -1;
      if (currentId) {
        index = items.findIndex(({ url }) => {
          try { return new URL(url).searchParams.get('id') === currentId; } catch (_) { return false; }
        });
      }
      if (index < 0) {
        index = items.findIndex(({ el }) => Boolean(el.closest('.active, .current, .on, .selected, .playing, [class*="active"], [class*="current"]')));
      }
      if (index < 0) return null;

      for (let i = index + 1; i < items.length; i += 1) {
        if (items[i].url !== location.href) return items[i];
      }
      return null;
    };

    const findNextFromCourseDetail = async () => {
      const classId = getQueryParam('classId');
      if (!classId) return null;
      appendLog(`读取课程详情 ${classId}`);
      try {
        const res = await fetch(`${location.origin}/zzpx/courseDetail/${classId}`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = (doc.querySelector('.u-coursetitle_title')?.textContent || doc.title || '').trim();
        if (title) refreshRuntimeState({ courseTitle: title, classId });
        const target = findNextByCourseLinks(doc, false);
        if (target?.url) {
          const nextId = getLessonIdFromUrl(target.url);
          refreshRuntimeState({ nextLessonId: nextId });
          appendLog(nextId ? `详情页解析到下一课时 ${nextId}` : '详情页解析到下一课时');
        }
        return target;
      } catch (_) {
        return null;
      }
    };

    const findFirstLessonFromCourseDetail = async (classId) => {
      if (!classId) return null;
      appendLog(`读取下一门课程详情 ${classId}`);
      try {
        const res = await fetch(`${location.origin}/zzpx/courseDetail/${classId}`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (!res.ok) return null;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = (doc.querySelector('.u-coursetitle_title')?.textContent || doc.title || '').trim();
        const items = collectCourseLinkItems(doc, false);
        const target = items[0] || null;
        if (target?.url) {
          const lessonId = getLessonIdFromUrl(target.url);
          appendLog(title ? `下一门课程：${title}，首课时 ${lessonId || '-'}` : `下一门首课时 ${lessonId || '-'}`);
        }
        return target;
      } catch (_) {
        return null;
      }
    };

    const goToNextCourseFromQueue = async () => {
      const currentClassId = getQueryParam('classId');
      const originalQueue = readCourseQueue();
      const courseClassId = (course) => course.classId || getClassIdFromUrl(course.url || '');
      const currentIndex = originalQueue.findIndex(course => courseClassId(course) === currentClassId);
      const orderedQueue = currentIndex >= 0
        ? originalQueue.slice(currentIndex + 1).concat(originalQueue.slice(0, currentIndex))
        : originalQueue;
      const queue = orderedQueue.filter(course => {
        const classId = course.classId || getClassIdFromUrl(course.url || '');
        return classId && classId !== currentClassId;
      });
      saveCourseQueue(originalQueue.filter(course => courseClassId(course) !== currentClassId));

      if (!queue.length) {
        appendLog('课程队列里没有下一门未完成课程');
        return false;
      }

      for (const course of queue) {
        const classId = course.classId || getClassIdFromUrl(course.url || '');
        appendLog(`准备进入下一门课程：${course.title || classId}`);
        const firstLesson = await findFirstLessonFromCourseDetail(classId);
        if (firstLesson?.url && navigateToUrl(firstLesson.url)) return true;
        if (course.url && navigateToUrl(course.url)) return true;
      }

      appendLog('未能打开下一门课程');
      return false;
    };

    const findNextTarget = () => {
      const nextButton = findNextByButtonText();
      if (nextButton) return { el: nextButton, url: extractCourseLearnUrl(nextButton) };
      return findNextByCourseLinks();
    };

    const proceedToNext = () => {
      const now = Date.now();
      if (isNextPending() || now - lastAttemptAt < 6000) return;
      lastAttemptAt = now;
      setNextPending(true);
      appendLog('检测到视频完成，寻找下一节');

      const delays = [0, 500, 1500, 3000];
      let clicked = false;
      delays.forEach((delay, idx) => {
        setTimeout(() => {
          if (clicked) return;
          const target = findNextTarget();
          if (target && clickNext(target.el, target.url)) {
            clicked = true;
            return;
          }
          if (idx === delays.length - 1) {
            findNextFromCourseDetail().then(async (detailTarget) => {
              if (clicked) return;
              if (detailTarget && clickNext(detailTarget.el, detailTarget.url)) {
                clicked = true;
                return;
              }
              const movedToNextCourse = await goToNextCourseFromQueue();
              if (movedToNextCourse) {
                clicked = true;
                return;
              }
              appendLog('未找到下一节入口，也没有下一门未完成课程');
              setNextPending(false);
            });
          }
        }, delay);
      });
    };

    const bindVideos = () => {
      document.querySelectorAll('video').forEach((video) => {
        if (boundVideos.has(video)) return;
        boundVideos.add(video);
        video.addEventListener('ended', proceedToNext);
      });
    };

    const checkEndedVideos = () => {
      bindVideos();
      document.querySelectorAll('video').forEach((video) => {
        if (video.ended) proceedToNext();
      });
    };

    bindVideos();
    const obs = new MutationObserver(bindVideos);
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    setInterval(checkEndedVideos, 1000);
  }

  function autoDismissCompletionDialogs() {
    const completionDialogRe = /(?:播放|视频|学习|课程|课时|本节|本课).{0,24}(?:完成|结束|已完成|学完|看完)|(?:完成|结束|学完|看完).{0,24}(?:播放|视频|学习|课程|课时|本节|本课)/;
    const okTextRe = /^(确定|确认|知道了|我知道了|完成|关闭|OK)$/i;
    const dialogSelectors = [
      '.layui-layer',
      '.el-message-box',
      '.ant-modal',
      '.van-dialog',
      '.modal',
      '.dialog',
      '.popup',
      '[role="dialog"]'
    ];
    const primaryButtonSelectors = [
      '.layui-layer-btn0',
      '.el-button--primary',
      '.ant-btn-primary',
      '.van-button--default',
      '.van-button--primary'
    ];

    const isVisible = (el) => {
      try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      } catch (_) {
        return true;
      }
    };

    const findConfirmButton = (dialog) => {
      for (const selector of primaryButtonSelectors) {
        const btn = dialog.querySelector(selector);
        if (btn && !btn.disabled && isVisible(btn)) return btn;
      }
      const controls = Array.from(dialog.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
      return controls.find((el) => {
        if (el.disabled || !isVisible(el)) return false;
        const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
        return okTextRe.test(text);
      });
    };

    const tryDismiss = () => {
      const dialogs = dialogSelectors.map(selector => Array.from(document.querySelectorAll(selector))).flat();
      for (const dialog of dialogs) {
        if (!isVisible(dialog)) continue;
        const text = (dialog.textContent || '').replace(/\s+/g, '');
        if (!completionDialogRe.test(text)) continue;
        const btn = findConfirmButton(dialog);
        if (btn) {
          if (dialog.getAttribute('data-class-attender-dismissed') !== '1') {
            dialog.setAttribute('data-class-attender-dismissed', '1');
            appendLog('自动确认播放完成弹框');
          }
          try { btn.click(); } catch (_) {}
        }
      }
    };

    tryDismiss();
    const obs = new MutationObserver(tryDismiss);
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    setInterval(tryDismiss, 1000);
  }

  function init() {
    if (!isCourseLearnPage()) return;
    refreshRuntimeState();
    // 尽早伪装为前台可见状态，并派发相应事件
    injectForegroundSpoofing();
    appendLog(`插件启动：课程 ${runtimeState.classId || '-'}，课时 ${runtimeState.lessonId || '-'}`);
    // 静音
    muteTab();
    // 自动播放
    waitForPlayButtonAndPlay();
    // 进度保活：若卡住不动，周期性强制 play
    setInterval(() => { forcePlayVideo(); }, 5000);
    // 设置并维持播放速度
    const rate = getTargetRate();
    applyRateToAll(rate);
    observeNewVideos(rate);
    setInterval(() => applyRateToAll(getTargetRate()), 3000);
    bindHotkeys();
    createRateControl();
    autoDismissCompletionDialogs();
    // 自动下一节（尽量）
    autoProceedNextOnEnded();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
