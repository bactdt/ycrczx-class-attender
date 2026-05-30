(function () {
  const TARGET_PATH = '/studyCenter/getClassNameDataQh';

  function emit(payload) {
    try {
      document.dispatchEvent(new CustomEvent('class-attender:study-center-response', {
        detail: JSON.stringify(payload)
      }));
    } catch (_) {}
  }

  function isTarget(url) {
    try {
      return String(url || '').includes(TARGET_PATH);
    } catch (_) {
      return false;
    }
  }

  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__classAttenderMethod = method;
      this.__classAttenderUrl = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (isTarget(this.__classAttenderUrl)) {
        this.addEventListener('loadend', () => {
          try {
            emit({
              type: 'xhr',
              method: this.__classAttenderMethod || 'POST',
              url: this.__classAttenderUrl,
              body: typeof body === 'string' ? body : '',
              status: this.status,
              responseText: typeof this.responseText === 'string' ? this.responseText : ''
            });
          } catch (_) {}
        }, { once: true });
      }
      return originalSend.apply(this, arguments);
    };
  } catch (_) {}

  try {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : input && input.url;
      const body = init && typeof init.body === 'string' ? init.body : '';
      return originalFetch.apply(this, arguments).then((response) => {
        if (isTarget(url)) {
          try {
            response.clone().text().then((responseText) => {
              emit({
                type: 'fetch',
                method: init?.method || 'GET',
                url,
                body,
                status: response.status,
                responseText
              });
            }).catch(() => {});
          } catch (_) {}
        }
        return response;
      });
    };
  } catch (_) {}
})();
