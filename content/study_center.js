(function () {
  function isStudyCenterPage() {
    return /\/studyCenter\/page/.test(location.pathname);
  }
  if (!isStudyCenterPage()) return;

  const state = {
    courses: [],
    logs: []
  };
  const COURSE_QUEUE_KEY = 'class_attender_course_queue';

  function appendLog(message) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    state.logs.unshift(`${time} ${message}`);
    state.logs = state.logs.slice(0, 10);
    try { console.info('[Class Attender]', message); } catch (_) {}
    updatePanel();
  }

  function normalizeUrl(url) {
    if (!url) return '';
    try { return new URL(url, location.origin).href; } catch (_) { return ''; }
  }

  function getText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractCourseTarget(el) {
    const html = el.outerHTML || '';
    const href = el.matches('a[href]') ? el.getAttribute('href') : el.querySelector('a[href]')?.getAttribute('href');
    const raw = [href || '', html].join(' ');

    const learnMatch = raw.match(/(?:https?:\/\/[^"'\s]*|)\/video\/courseLearnPage\?[^"'\s]*/);
    if (learnMatch) {
      const url = normalizeUrl(learnMatch[0]);
      try {
        const parsed = new URL(url);
        return { url, classId: parsed.searchParams.get('classId') || '' };
      } catch (_) {
        return { url, classId: '' };
      }
    }

    const detailMatch = raw.match(/\/zzpx\/courseDetail\/(\d+)/);
    if (detailMatch) {
      return {
        url: normalizeUrl(`/zzpx/courseDetail/${detailMatch[1]}`),
        classId: detailMatch[1]
      };
    }

    const kpsMatch = raw.match(/kps\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (kpsMatch) {
      return {
        url: normalizeUrl(`/video/courseLearnPage?id=${kpsMatch[1]}&&classId=${kpsMatch[2]}`),
        classId: kpsMatch[2]
      };
    }

    const functionMatch = raw.match(/(?:goTuijainClassPage|goClassName|classPage|courseDetail|study|learn)\s*\(\s*(\d+)\s*\)/i);
    if (functionMatch) {
      return {
        url: normalizeUrl(`/zzpx/courseDetail/${functionMatch[1]}`),
        classId: functionMatch[1]
      };
    }

    const classIdMatch = raw.match(/(?:classId|classNameId|cnid)\D{0,20}(\d+)/i);
    if (classIdMatch) {
      return {
        url: normalizeUrl(`/zzpx/courseDetail/${classIdMatch[1]}`),
        classId: classIdMatch[1]
      };
    }

    return { url: '', classId: '' };
  }

  function parseProgress(text) {
    const m = text.match(/已完成\s*([\d.]+)\s*\/\s*([\d.]+)\s*学时/);
    if (!m) return { current: null, total: null, completed: /已完成|学习完成|100\s*%/.test(text) };
    const current = Number(m[1]);
    const total = Number(m[2]);
    return {
      current,
      total,
      completed: Number.isFinite(current) && Number.isFinite(total) && total > 0 && current >= total
    };
  }

  function parseCoursesFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = Array.from(doc.querySelectorAll('li'));
    const courses = [];

    for (const li of items) {
      const titleEl = li.querySelector('p, h3, .title, [title]');
      const title = (titleEl?.getAttribute('title') || getText(titleEl || li)).trim();
      const target = extractCourseTarget(li);
      const text = getText(li);
      const progress = parseProgress(text);
      if (!title || (!target.url && !target.classId)) continue;
      courses.push({
        title,
        url: target.url || normalizeUrl(`/zzpx/courseDetail/${target.classId}`),
        classId: target.classId,
        progressText: text.match(/已完成[^ ]+学时/)?.[0] || '',
        completed: progress.completed
      });
    }

    return courses;
  }

  function mergeCourses(courses) {
    const map = new Map(state.courses.map(course => [course.url || course.title, course]));
    courses.forEach(course => map.set(course.url || course.title, course));
    state.courses = Array.from(map.values());
    saveCourseQueue();
    updatePanel();
  }

  function saveCourseQueue() {
    const queue = state.courses
      .filter(course => !course.completed && (course.url || course.classId))
      .map(course => ({
        title: course.title,
        url: course.url,
        classId: course.classId,
        progressText: course.progressText || ''
      }));
    try {
      localStorage.setItem(COURSE_QUEUE_KEY, JSON.stringify(queue));
    } catch (_) {}
  }

  function openCourse(course) {
    if (!course?.url) {
      appendLog('课程缺少可打开的链接');
      return;
    }
    try {
      localStorage.setItem('class_attender_active_class_id', course.classId || '');
    } catch (_) {}
    appendLog(`打开课程：${course.title}`);
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_URL_IN_TAB', url: course.url });
    } catch (_) {
      window.open(course.url, '_blank');
    }
  }

  function openFirstUnfinished() {
    const course = state.courses.find(item => !item.completed) || state.courses[0];
    if (!course) {
      appendLog('暂无课程，请先切换未学习/正在学习标签或点击读取当前列表');
      return;
    }
    openCourse(course);
  }

  function openAllUnfinished() {
    const courses = state.courses.filter(item => !item.completed);
    if (!courses.length) {
      appendLog('暂无未完成课程');
      return;
    }
    appendLog(`批量打开 ${courses.length} 门未完成课程`);
    courses.forEach((course, idx) => {
      setTimeout(() => openCourse(course), idx * 500);
    });
  }

  function readCurrentList() {
    const courses = parseCoursesFromHtml(document.body.innerHTML || '');
    mergeCourses(courses);
    appendLog(`读取当前页面课程 ${courses.length} 门`);
  }

  function updatePanel() {
    const summary = document.getElementById('class-attender-study-summary');
    if (summary) {
      const unfinished = state.courses.filter(course => !course.completed).length;
      summary.textContent = `已捕获 ${state.courses.length} 门，未完成 ${unfinished} 门`;
    }

    const list = document.getElementById('class-attender-study-course-list');
    if (list) {
      list.textContent = '';
      const courses = state.courses.length ? state.courses.slice(0, 8) : [{ title: '等待课程数据...', progressText: '', completed: false }];
      courses.forEach((course) => {
        const item = document.createElement('div');
        const stateText = course.completed ? '已完成' : '未完成';
        item.textContent = `${stateText} | ${course.title}${course.progressText ? ' | ' + course.progressText : ''}`;
        item.style.lineHeight = '1.45';
        item.style.wordBreak = 'break-all';
        list.appendChild(item);
      });
    }

    const logs = document.getElementById('class-attender-study-log-list');
    if (logs) {
      logs.textContent = '';
      const entries = state.logs.length ? state.logs : ['等待接口返回...'];
      entries.forEach((entry) => {
        const item = document.createElement('div');
        item.textContent = entry;
        item.style.lineHeight = '1.45';
        item.style.wordBreak = 'break-all';
        logs.appendChild(item);
      });
    }
  }

  function createPanel() {
    if (document.getElementById('class-attender-study-panel')) return;

    const root = document.createElement('div');
    root.id = 'class-attender-study-panel';
    Object.assign(root.style, {
      position: 'fixed',
      right: '16px',
      bottom: '24px',
      zIndex: '2147483647',
      width: '360px',
      maxWidth: 'calc(100vw - 32px)',
      padding: '10px 12px',
      boxSizing: 'border-box',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.72)',
      color: '#fff',
      fontSize: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
    });

    const title = document.createElement('div');
    title.textContent = 'Class Attender 学习中心';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px', marginBottom: '6px' });

    const summary = document.createElement('div');
    summary.id = 'class-attender-study-summary';
    Object.assign(summary.style, { color: 'rgba(255,255,255,0.84)', marginBottom: '8px' });

    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' });
    const makeBtn = (text, onClick) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      Object.assign(btn.style, {
        background: '#1677ff',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer'
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return btn;
    };
    buttonRow.appendChild(makeBtn('读取当前列表', readCurrentList));
    buttonRow.appendChild(makeBtn('打开第一门未完成', openFirstUnfinished));
    buttonRow.appendChild(makeBtn('批量打开未完成', openAllUnfinished));

    const courseTitle = document.createElement('div');
    courseTitle.textContent = '课程列表';
    Object.assign(courseTitle.style, { color: 'rgba(255,255,255,0.86)', margin: '6px 0 4px' });
    const courseList = document.createElement('div');
    courseList.id = 'class-attender-study-course-list';
    Object.assign(courseList.style, {
      maxHeight: '120px',
      overflowY: 'auto',
      padding: '6px',
      borderRadius: '6px',
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.9)',
      marginBottom: '8px'
    });

    const logTitle = document.createElement('div');
    logTitle.textContent = '执行日志';
    Object.assign(logTitle.style, { color: 'rgba(255,255,255,0.86)', margin: '6px 0 4px' });
    const logList = document.createElement('div');
    logList.id = 'class-attender-study-log-list';
    Object.assign(logList.style, {
      maxHeight: '120px',
      overflowY: 'auto',
      padding: '6px',
      borderRadius: '6px',
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.9)'
    });

    root.appendChild(title);
    root.appendChild(summary);
    root.appendChild(buttonRow);
    root.appendChild(courseTitle);
    root.appendChild(courseList);
    root.appendChild(logTitle);
    root.appendChild(logList);
    document.body.appendChild(root);
    updatePanel();
  }

  document.addEventListener('class-attender:study-center-response', (event) => {
    try {
      const payload = JSON.parse(event.detail || '{}');
      const courses = parseCoursesFromHtml(payload.responseText || '');
      appendLog(`捕获接口 ${payload.status || '-'}，body=${payload.body || '(空)'}`);
      if (courses.length) {
        mergeCourses(courses);
        appendLog(`解析课程 ${courses.length} 门`);
      } else {
        appendLog('接口返回中未解析到课程 ID 或链接');
      }
    } catch (_) {}
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createPanel();
      readCurrentList();
    });
  } else {
    createPanel();
    readCurrentList();
  }
})();
