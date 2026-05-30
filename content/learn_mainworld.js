(function () {
  // 在页面主世界执行，避免内联脚本 CSP 限制：通过 content_scripts world: MAIN 注入
  try {
    const define = (obj, key, getter) => {
      try { Object.defineProperty(obj, key, { get: getter, configurable: true }); } catch (_) {}
    };
    // 伪装可见性/焦点
    define(document, 'hidden', () => false);
    define(Document.prototype || {}, 'hidden', () => false);
    define(document, 'visibilityState', () => 'visible');
    define(Document.prototype || {}, 'visibilityState', () => 'visible');
    define(document, 'webkitHidden', () => false);
    define(document, 'mozHidden', () => false);
    try { document.hasFocus = () => true; } catch (_) {}

    // 阻断可见性相关事件注册
    const blockedEvents = new Set(['visibilitychange','webkitvisibilitychange','blur','pagehide','freeze']);
    const origAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      try { if (blockedEvents.has(String(type))) return; } catch (_) {}
      return origAddEventListener.call(this, type, listener, options);
    };
    const stop = (e) => { try { e.stopImmediatePropagation(); } catch (_) {} };
    blockedEvents.forEach((t) => {
      try { window.addEventListener(t, stop, true); } catch (_) {}
      try { document.addEventListener(t, stop, true); } catch (_) {}
    });
    try { Object.defineProperty(document, 'onvisibilitychange', { set() {}, get() { return null; } }); } catch (_) {}

    const completionDialogRe = /(?:播放|视频|学习|课程|课时|本节|本课).{0,16}(?:完成|结束|已完成|学完|看完)|(?:完成|结束|学完|看完).{0,16}(?:播放|视频|学习|课程|课时|本节|本课)/;
    const shouldAutoAcceptDialog = (message) => {
      const text = String(message || '').replace(/\s+/g, '');
      return completionDialogRe.test(text);
    };
    const wrapDialog = (key, returnValue) => {
      try {
        const original = window[key];
        if (typeof original !== 'function' || original.__classAttenderWrapped) return;
        const wrapped = function (message) {
          if (shouldAutoAcceptDialog(message)) return returnValue;
          return original.apply(this, arguments);
        };
        Object.defineProperty(wrapped, '__classAttenderWrapped', { value: true });
        Object.defineProperty(window, key, { value: wrapped, configurable: true, writable: true });
      } catch (_) {}
    };
    const installDialogOverrides = () => {
      wrapDialog('alert', undefined);
      wrapDialog('confirm', true);
    };
    installDialogOverrides();
    setInterval(installDialogOverrides, 1000);

    const isProceedingNext = () => {
      try {
        return document.documentElement && document.documentElement.getAttribute('data-class-attender-next-pending') === '1';
      } catch (_) {
        return false;
      }
    };
    const isVideoComplete = (video) => {
      try {
        const duration = Number(video.duration);
        const currentTime = Number(video.currentTime);
        return video.ended || (Number.isFinite(duration) && duration > 0 && Number.isFinite(currentTime) && duration - currentTime <= 0.4);
      } catch (_) {
        return false;
      }
    };

    // 劫持 HTMLMediaElement.prototype.pause，阻止被动暂停
    try {
      const proto = HTMLMediaElement.prototype;
      const _pause = proto.pause;
      Object.defineProperty(proto, 'pause', {
        value: function () {
          try {
            if (this && this.tagName === 'VIDEO') {
              if (isProceedingNext() || isVideoComplete(this)) {
                return _pause.apply(this, arguments);
              }
              this.muted = true;
              try { this.play(); } catch (_) {}
              return;
            }
          } catch (_) {}
          return _pause.apply(this, arguments);
        },
        configurable: true
      });
    } catch (_) {}

    // 主动派发前台事件
    const fire = (type) => {
      try {
        document.dispatchEvent(new Event(type));
        window.dispatchEvent(new Event(type));
      } catch (_) {}
    };
    const burst = () => {
      ['visibilitychange','webkitvisibilitychange','focus','pageshow'].forEach(fire);
    };
    setTimeout(burst, 300);
    setTimeout(burst, 1000);
    setInterval(burst, 10000);

    // 捕获暂停事件，立即恢复
    document.addEventListener('pause', (e) => {
      try {
        const v = e.target;
        if (v && v.tagName === 'VIDEO') {
          if (isProceedingNext() || isVideoComplete(v)) return;
          v.muted = true;
          v.play().catch(() => {});
        }
      } catch (_) {}
    }, true);
  } catch (e) {
    // ignore
  }
})();
