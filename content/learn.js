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
      padding: '8px 10px',
      borderRadius: '8px',
      fontSize: '12px',
      userSelect: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
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

    root.appendChild(minus);
    root.appendChild(label);
    root.appendChild(plus);
    document.body.appendChild(root);
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
    try {
      // 设置静音，避免未授权播放被拦截
      video.muted = true;
      video.volume = 0;
      // 保证播放速度和暂停状态
      video.playbackRate = getTargetRate();
      // 劫持在主世界脚本中实现（learn_mainworld.js），此处不做任何内联注入以避免 CSP
      await video.play();
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
    const video = document.querySelector('video');
    if (!video) return;
    video.addEventListener('ended', () => {
      // 页面可能有“下一节/下一集”按钮，尝试点击
      const nextSelectors = [
        'a.next',
        'button.next',
        'a[aria-label*="下一"], button[aria-label*="下一"]'
      ];
      for (const sel of nextSelectors) {
        const el = document.querySelector(sel);
        if (el) { el.click(); return; }
      }
      // 回退：遍历所有 a/button，基于文本匹配“下一”
      const candidates = Array.from(document.querySelectorAll('a, button'));
      for (const el of candidates) {
        const text = (el.textContent || '').trim();
        if (text.includes('下一')) { el.click(); return; }
      }
      // 若没有明确“下一节”，可根据站点结构扩展：点击目录中下一个未学项
    });
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
    // 尽早伪装为前台可见状态，并派发相应事件
    injectForegroundSpoofing();
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

