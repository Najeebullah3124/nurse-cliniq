/**
 * Nurse ClinIQ – Frontend application.
 * Handles login, register, student dashboard, quizzes, and admin panel.
 */

const API = '/api';

// ----- State -----
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

// ----- API helpers -----
function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (res.ok) data = {};
    }
  }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ----- Auth -----
function setAuth(newToken, newUser) {
  token = newToken;
  user = newUser;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

function logout() {
  setAuth(null, null);
  render();
}

function isAdmin() {
  return user && user.is_admin === 1;
}

// ----- Routing -----
function getHash() {
  const hash = (location.hash || '#').slice(1);
  const [view, ...rest] = hash.split('/');
  return { view, id: rest[0] };
}

function navigate(hash) {
  location.hash = hash;
}

// ----- Render -----
let renderVersion = 0;
function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs) && !(attrs instanceof Node)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k === 'onclick') e.onclick = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (v != null && k !== 'textContent') e.setAttribute(k, v);
    }
  } else if (attrs !== undefined && (typeof attrs === 'string' || attrs instanceof Node || Array.isArray(attrs))) {
    children = [attrs, ...children];
  }
  for (const c of children) {
    if (c == null) continue;
    if (Array.isArray(c)) e.append(...c);
    else if (typeof c === 'string' || typeof c === 'number') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  }
  return e;
}

async function render() {
  const root = document.getElementById('view-root');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');

  if (!token) {
    sidebar.classList.add('hide');
    main.classList.remove('main-with-sidebar');
    const { view } = getHash();
    root.innerHTML = '';
    if (view === 'register') {
      root.appendChild(renderRegister());
    } else if (view === 'login') {
      root.appendChild(renderLogin());
    } else {
      root.appendChild(renderLanding());
    }
    return;
  }

  sidebar.classList.remove('hide');
  main.classList.add('main-with-sidebar');
  sidebar.innerHTML = '';

  const { view, id } = getHash();
  const currentHash = '#' + (id ? view + '/' + id : view);

  const brand = el('div', { className: 'sidebar-brand' }, 'Nurse ClinIQ');
  const nav = el('nav', { className: 'sidebar-nav' });

  if (isAdmin()) {
    [
      ['Overview', '#admin'],
      ['Competencies', '#admin/competencies'],
      ['Quizzes', '#admin/quizzes'],
      ['Students', '#admin/students'],
      ['Reports', '#admin/reports']
    ].forEach(([label, hash]) => {
      const active = hash === currentHash;
      nav.appendChild(el('a', {
        href: hash,
        className: 'sidebar-link' + (active ? ' sidebar-link-active' : ''),
        textContent: label
      }));
    });
  } else {
    [
      ['Dashboard', '#dashboard'],
      ['Profile', '#profile']
    ].forEach(([label, hash]) => {
      const active = hash === currentHash || (hash === '#dashboard' && view === 'quiz');
      nav.appendChild(el('a', {
        href: hash,
        className: 'sidebar-link' + (active ? ' sidebar-link-active' : ''),
        textContent: label
      }));
    });
  }

  const logoutBtn = el('button', { type: 'button', className: 'sidebar-logout', textContent: 'Log out', onclick: logout });
  sidebar.appendChild(brand);
  sidebar.appendChild(nav);
  sidebar.appendChild(logoutBtn);

  root.innerHTML = '';
  const thisVersion = ++renderVersion;
  try {
    let content;
    if (view === 'admin' || (view === 'admin' && id)) {
      content = await renderAdmin(id);
    } else if (view === 'dashboard') {
      content = await renderDashboard();
    } else if (view === 'quiz' && id) {
      content = await renderQuiz(id);
    } else if (view === 'profile') {
      content = await renderProfile();
    } else {
      content = await renderDashboard();
    }
    if (thisVersion === renderVersion) {
      root.innerHTML = '';
      root.appendChild(content);
    }
  } catch (err) {
    console.error('Render error:', err);
    if (thisVersion === renderVersion) {
      root.innerHTML = '<div class="alert alert-error">Something went wrong. Check the console.</div>';
    }
  }
}

// ----- Landing page (hero + 6 functionalities) -----
function landingIcon(type) {
  const w = 28;
  const h = 28;
  const svgs = {
    lock: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    chart: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16v-5M12 16v-2M17 16V8"/></svg>`,
    quiz: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h6"/></svg>`,
    user: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3"/><path d="M5 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>`,
    admin: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
    ai: `<svg width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L9 8H3l5 4-2 6 6-4 6 4-2-6 5-4h-6z"/></svg>`
  };
  const span = document.createElement('span');
  span.className = 'landing-feature-icon';
  span.innerHTML = svgs[type] || '';
  return span;
}

function renderLanding() {
  const features = [
    { iconType: 'lock', title: 'Student Registration & Login', desc: 'Secure sign-up with student number and password. Register once, sign in anytime to access your competency dashboard.' },
    { iconType: 'chart', title: 'Competency Dashboard', desc: 'Track your progress across all clinical competencies. See completed, passed, and overall progress at a glance. Take or retake quizzes per competency.' },
    { iconType: 'quiz', title: 'Interactive Quizzes', desc: 'Multiple question types: multiple choice, matching pairs, and drag-and-drop ordering. Get instant pass/fail and score feedback after each quiz.' },
    { iconType: 'user', title: 'Profile', desc: 'View and manage your account details: student number, name, and email in one place.' },
    { iconType: 'admin', title: 'Admin Panel', desc: 'Overview of student progress, manage competencies, build quizzes per competency, manage students, and export reports in JSON or CSV.' },
    { iconType: 'ai', title: 'AI Quiz Generation', desc: 'Admins can generate quiz questions automatically using AI based on competency name and description—saving time while keeping content relevant.' }
  ];

  const hero = el('section', { className: 'landing-hero' }, [
    el('div', { className: 'landing-hero-bg' }),
    el('div', { className: 'landing-hero-content' }, [
      el('h1', { className: 'landing-hero-title' }, 'Nurse ClinIQ'),
      el('p', { className: 'landing-hero-tagline' }, 'Assessing Clinical Competency for Future Nurses'),
      el('p', { className: 'landing-hero-desc' }, 'Track progress, take quizzes, and demonstrate competency across key clinical skills. Built for nursing students and educators.'),
      el('div', { className: 'landing-hero-ctas' }, [
        el('a', { href: '#register', className: 'btn btn-landing-primary' }, 'Get Started'),
        el('a', { href: '#login', className: 'btn btn-landing-secondary' }, 'Sign In')
      ])
    ])
  ]);

  const featuresSection = el('section', { className: 'landing-features' }, [
    el('h2', { className: 'landing-features-title' }, 'Everything you need'),
    el('p', { className: 'landing-features-subtitle' }, 'Six core features powering your clinical competency journey.'),
    el('div', { className: 'landing-features-grid' }, features.map(f => el('div', { className: 'landing-feature-card' }, [
      landingIcon(f.iconType),
      el('h3', { className: 'landing-feature-title' }, f.title),
      el('p', { className: 'landing-feature-desc' }, f.desc)
    ])))
  ]);

  const ctaSection = el('section', { className: 'landing-cta' }, [
    el('h2', { className: 'landing-cta-title' }, 'Ready to get started?'),
    el('p', { className: 'landing-cta-desc' }, 'Register as a student or sign in to access your dashboard and quizzes.'),
    el('div', { className: 'landing-cta-buttons' }, [
      el('a', { href: '#register', className: 'btn btn-landing-primary' }, 'Register'),
      el('a', { href: '#login', className: 'btn btn-landing-secondary' }, 'Sign In')
    ])
  ]);

  const footer = el('footer', { className: 'landing-footer' }, [
    el('p', {}, 'Nurse ClinIQ – Clinical competency assessment for nursing education.')
  ]);

  const nav = el('nav', { className: 'landing-nav' }, [
    el('a', { href: '#', className: 'landing-nav-brand' }, 'Nurse ClinIQ'),
    el('div', { className: 'landing-nav-links' }, [
      el('a', { href: '#login' }, 'Sign In'),
      el('a', { href: '#register', className: 'landing-nav-cta' }, 'Register')
    ])
  ]);

  return el('div', { className: 'landing-page' }, [nav, hero, featuresSection, ctaSection, footer]);
}

// ----- Login / Register -----
function renderLogin() {
  const errDiv = el('div', { className: 'alert alert-error hide', id: 'loginError' });
  const form = el('form', {
    onSubmit: async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('loginError');
      errEl.classList.add('hide');
      const sn = document.getElementById('loginSN').value.trim();
      const pw = document.getElementById('loginPW').value;
      try {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ student_number: sn, password: pw }) });
        setAuth(data.token, data.user);
        if (data.user.is_admin === 1) navigate('#admin');
        else navigate('#dashboard');
        render();
      } catch (err) {
        errEl.textContent = err.data?.error || err.message;
        errEl.classList.remove('hide');
      }
    }
  }, [
    el('h1', {}, 'Sign in'),
    el('p', { className: 'auth-subtitle' }, 'Welcome back. Enter your details to continue.'),
    errDiv,
    el('div', { className: 'form-group' }, [
      el('label', { for: 'loginSN' }, 'Student number'),
      el('input', { id: 'loginSN', type: 'text', required: true, placeholder: 'e.g. S001', autocomplete: 'username' })
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { for: 'loginPW' }, 'Password'),
      el('input', { id: 'loginPW', type: 'password', required: true, autocomplete: 'current-password' })
    ]),
    el('button', { type: 'submit', className: 'btn btn-block' }, 'Sign in')
  ]);
  const toggle = el('p', { className: 'auth-toggle' }, [
    document.createTextNode("Don't have an account? "),
    el('a', { href: '#register', textContent: 'Register' })
  ]);
  const backLink = el('a', { href: '#', className: 'auth-back' }, '← Back to home');
  return el('div', { className: 'auth-screen' }, [
    el('div', { className: 'auth-card' }, [backLink, form, toggle])
  ]);
}

function renderRegister() {
  const errDiv = el('div', { className: 'alert alert-error hide', id: 'regError' });
  const form = el('form', {
    onSubmit: async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('regError');
      errEl.classList.add('hide');
      const sn = document.getElementById('regSN').value.trim();
      const name = document.getElementById('regName').value.trim();
      const pw = document.getElementById('regPW').value;
      const email = document.getElementById('regEmail').value.trim();
      try {
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ student_number: sn, name, password: pw, email: email || undefined })
        });
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ student_number: sn, password: pw }) });
        setAuth(data.token, data.user);
        navigate('#dashboard');
        render();
      } catch (err) {
        errEl.textContent = err.data?.error || err.message;
        errEl.classList.remove('hide');
      }
    }
  }, [
    el('h1', {}, 'Create account'),
    el('p', { className: 'auth-subtitle' }, 'Register with your student number to get started.'),
    errDiv,
    el('div', { className: 'form-group' }, [
      el('label', { for: 'regSN' }, 'Student number'),
      el('input', { id: 'regSN', type: 'text', required: true, placeholder: 'e.g. S001' })
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { for: 'regName' }, 'Full name'),
      el('input', { id: 'regName', type: 'text', required: true })
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { for: 'regEmail' }, 'Email (optional)'),
      el('input', { id: 'regEmail', type: 'email' })
    ]),
    el('div', { className: 'form-group' }, [
      el('label', { for: 'regPW' }, 'Password'),
      el('input', { id: 'regPW', type: 'password', required: true })
    ]),
    el('button', { type: 'submit', className: 'btn btn-block' }, 'Register')
  ]);
  const toggle = el('p', { className: 'auth-toggle' }, [
    document.createTextNode('Already have an account? '),
    el('a', { href: '#login', textContent: 'Sign in' })
  ]);
  const backLink = el('a', { href: '#', className: 'auth-back' }, '← Back to home');
  return el('div', { className: 'auth-screen' }, [
    el('div', { className: 'auth-card' }, [backLink, form, toggle])
  ]);
}

// ----- Dashboard -----
async function renderDashboard() {
  const [progress, competencies] = await Promise.all([
    api('/my-progress'),
    api('/competencies')
  ]);
  const total = progress.length;
  const completed = progress.filter(p => p.status === 'Completed').length;
  const passed = progress.filter(p => p.result === 'Pass').length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const header = el('div', { className: 'dashboard-header' }, [
    el('h1', { className: 'dashboard-title' }, 'My Competencies'),
    el('p', { className: 'dashboard-subtitle' }, 'Track your progress and take quizzes below.'),
    el('div', { className: 'dashboard-stats' }, [
      el('div', { className: 'stat-item' }, [el('span', { className: 'stat-value' }, String(completed)), el('span', { className: 'stat-label' }, 'Completed')]),
      el('div', { className: 'stat-item' }, [el('span', { className: 'stat-value' }, String(passed)), el('span', { className: 'stat-label' }, 'Passed')]),
      el('div', { className: 'stat-item' }, [el('span', { className: 'stat-value' }, pct + '%'), el('span', { className: 'stat-label' }, 'Progress')])
    ]),
    el('div', { className: 'progress-bar-wrap' }, [
      el('div', { className: 'progress-bar-fill', style: `width:${pct}%` })
    ])
  ]);

  const cards = progress.map(p => {
    const statusClass = p.status === 'Completed' ? 'badge-completed' : 'badge-pending';
    const resultClass = p.result === 'Pass' ? 'badge-pass' : p.result === 'Fail' ? 'badge-fail' : '';
    const resultBadge = p.result ? el('span', { className: `badge ${resultClass}` }, p.result) : null;
    const takeQuiz = el('button', {
      className: 'btn btn-secondary',
      onclick: () => navigate('#quiz/' + p.competency_id)
    }, p.status === 'Completed' ? 'Retake Quiz' : 'Take Quiz');
    return el('div', { className: 'card' }, [
      el('div', { className: 'card-info' }, [
        el('h3', {}, p.name),
        el('p', {}, p.description || ''),
        el('span', { className: `badge ${statusClass}` }, p.status),
        resultBadge,
        p.quiz_score != null ? el('span', { style: 'margin-left:0.5rem' }, `Score: ${p.quiz_score}%`) : null
      ]),
      el('div', { className: 'card-actions' }, takeQuiz)
    ]);
  });

  return el('div', { className: 'dashboard-page' }, [header, el('div', { className: 'cards' }, cards)]);
}

// ----- Quiz -----
function parseOptions(opts) {
  if (typeof opts === 'string') {
    try { return JSON.parse(opts); } catch (_) { return opts; }
  }
  return opts;
}

async function renderQuiz(competencyId) {
  const [questions, progress] = await Promise.all([
    api('/quiz/' + competencyId),
    api('/my-progress')
  ]);
  const comp = progress.find(p => String(p.competency_id) === String(competencyId));
  const compName = comp ? comp.name : 'Quiz';

  const state = { answers: [], submitted: false, result: null };

  const backBtn = el('a', { href: '#dashboard', className: 'btn btn-secondary' }, '← Back to Dashboard');

  function buildQuestion(q, index) {
    const opts = parseOptions(q.options);
    let inputArea;

    if (q.question_type === 'multiple-choice') {
      const options = Array.isArray(opts) ? opts : [];
      inputArea = el('ul', { className: 'mc-options' }, options.map((opt, i) => {
        const li = el('li', {
          onclick: () => {
            state.answers[index] = opt;
            li.parentElement.querySelectorAll('li').forEach(l => l.classList.remove('selected'));
            li.classList.add('selected');
          }
        }, opt);
        return li;
      }));
    } else if (q.question_type === 'matching') {
      const left = opts.left || [];
      const right = opts.right || [];
      inputArea = el('div', { className: 'matching-pairs' }, left.map((leftItem, i) => {
        const sel = el('select', {
          'data-index': index,
          'data-left': leftItem,
          onchange: function () {
            if (!state.answers[index]) state.answers[index] = {};
            state.answers[index][leftItem] = this.value;
          }
        });
        sel.appendChild(el('option', { value: '' }, '-- Select --'));
        right.forEach(r => sel.appendChild(el('option', { value: r }, r)));
        return el('div', { className: 'matching-row' }, [
          el('label', {}, leftItem),
          sel
        ]);
      }));
    } else if (q.question_type === 'drag-drop') {
      const items = Array.isArray(opts) ? [...opts] : [];
      const list = el('ul', { className: 'drag-list', 'data-index': index });
      state.answers[index] = [...items];
      items.forEach((item, i) => {
        const li = el('li', { 'data-item': item, draggable: true }, [
          el('span', { className: 'drag-handle' }, '⋮⋮'),
          document.createTextNode(item)
        ]);
        li.dataset.order = i;
        li.ondragstart = (e) => {
          e.dataTransfer.setData('text/plain', i);
          e.dataTransfer.effectAllowed = 'move';
          li.classList.add('sortable-ghost');
        };
        li.ondragend = () => li.classList.remove('sortable-ghost');
        li.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        li.ondrop = (e) => {
          e.preventDefault();
          const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const arr = state.answers[index];
          const [removed] = arr.splice(from, 1);
          const to = Array.from(list.children).indexOf(li);
          arr.splice(to, 0, removed);
          list.innerHTML = '';
          arr.forEach((it, j) => {
            const l = el('li', { 'data-item': it, draggable: true }, [el('span', { className: 'drag-handle' }, '⋮⋮'), document.createTextNode(it)]);
            l.dataset.order = j;
            l.ondragstart = (ev) => { ev.dataTransfer.setData('text/plain', j); ev.dataTransfer.effectAllowed = 'move'; l.classList.add('sortable-ghost'); };
            l.ondragend = () => l.classList.remove('sortable-ghost');
            l.ondragover = (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; };
            l.ondrop = (ev) => {
              ev.preventDefault();
              const fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
              const a = state.answers[index];
              const [rem] = a.splice(fromIdx, 1);
              const toIdx = Array.from(list.children).indexOf(l);
              a.splice(toIdx, 0, rem);
              state.answers[index] = a;
              rebuildDragList(list, a, index);
            };
            list.appendChild(l);
          });
        };
        list.appendChild(li);
      });
      function rebuildDragList(ul, arr, idx) {
        ul.innerHTML = '';
        arr.forEach((it, j) => {
          const l = el('li', { 'data-item': it, draggable: true }, [el('span', { className: 'drag-handle' }, '⋮⋮'), document.createTextNode(it)]);
          l.ondragstart = (ev) => { ev.dataTransfer.setData('text/plain', j); ev.dataTransfer.effectAllowed = 'move'; l.classList.add('sortable-ghost'); };
          l.ondragend = () => l.classList.remove('sortable-ghost');
          l.ondragover = (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; };
          l.ondrop = (ev) => {
            ev.preventDefault();
            const fromIdx = parseInt(ev.dataTransfer.getData('text/plain'), 10);
            const a = state.answers[idx];
            const [rem] = a.splice(fromIdx, 1);
            const toIdx = Array.from(ul.children).indexOf(l);
            a.splice(toIdx, 0, rem);
            state.answers[idx] = a;
            rebuildDragList(ul, a, idx);
          };
          ul.appendChild(l);
        });
      }
      inputArea = list;
    } else {
      inputArea = el('p', {}, 'Unknown question type');
    }

    return el('div', { className: 'quiz-question' }, [
      el('h3', {}, `Question ${index + 1}: ${q.question_text}`),
      inputArea
    ]);
  }

  const questionsDiv = el('div', { id: 'quiz-questions' }, questions.map((q, i) => buildQuestion(q, i)));

  const submitBtn = el('button', {
    className: 'btn',
    textContent: 'Submit Quiz',
    onclick: async () => {
      if (state.submitted) return;
      try {
        const result = await api('/quiz/' + competencyId + '/submit', {
          method: 'POST',
          body: JSON.stringify({ answers: state.answers })
        });
        state.submitted = true;
        state.result = result;
        const resultCard = el('div', {
          className: 'result-card ' + (result.result === 'Pass' ? 'result-pass' : 'result-fail')
        }, [
          el('h2', {}, result.result === 'Pass' ? 'Passed!' : 'Not passed'),
          el('div', { className: 'score' }, result.score + '%'),
          el('p', {}, `You got ${result.correct} out of ${result.total} correct.`),
          el('a', { href: '#dashboard', className: 'btn' }, 'Back to Dashboard')
        ]);
        document.getElementById('quiz-questions').innerHTML = '';
        document.getElementById('quiz-questions').appendChild(resultCard);
        submitBtn.classList.add('hide');
      } catch (err) {
        alert(err.data?.error || err.message);
      }
    }
  });

  const container = el('div', {}, [
    backBtn,
    el('div', { className: 'quiz-header' }, [
      el('h1', {}, compName),
      el('p', {}, questions.length + ' question(s)')
    ]),
    questionsDiv,
    el('div', { className: 'quiz-actions' }, submitBtn)
  ]);

  return container;
}

// ----- Profile -----
async function renderProfile() {
  const me = await api('/me');
  return el('div', { className: 'profile-page' }, [
    el('div', { className: 'profile-header' }, [
      el('h1', { className: 'profile-title' }, 'Profile'),
      el('p', { className: 'profile-subtitle' }, 'Your account details.')
    ]),
    el('div', { className: 'profile-card' }, [
      el('div', { className: 'profile-field' }, [
        el('span', { className: 'profile-label' }, 'Student number'),
        el('span', { className: 'profile-value' }, me.student_number)
      ]),
      el('div', { className: 'profile-field' }, [
        el('span', { className: 'profile-label' }, 'Name'),
        el('span', { className: 'profile-value' }, me.name)
      ]),
      el('div', { className: 'profile-field' }, [
        el('span', { className: 'profile-label' }, 'Email'),
        el('span', { className: 'profile-value' }, me.email || '—')
      ])
    ])
  ]);
}

// ----- Admin -----
async function renderAdmin(subTab) {
  const tab = subTab || 'dashboard';
  const content = el('div', { id: 'admin-content' });

  const load = async () => {
    content.innerHTML = '';
    if (tab === 'dashboard') {
      const list = await api('/admin/student-progress');
      const rows = list.map(s => [
        el('td', {}, s.student_number),
        el('td', {}, s.name),
        el('td', {}, (s.completed_count || 0) + ' / ' + (s.total_competencies || 0)),
        el('td', {}, (s.pass_count || 0) + ' passed')
      ]);
      content.appendChild(el('div', { className: 'admin-section admin-overview' }, [
        el('h2', {}, 'Overview'),
        el('p', { className: 'admin-overview-desc', textContent: 'Student progress across competencies.' }),
        el('table', { className: 'admin-table' }, [
          el('thead', {}, el('tr', {}, [
            el('th', {}, 'Student #'),
            el('th', {}, 'Name'),
            el('th', {}, 'Completed'),
            el('th', {}, 'Passed')
          ])),
          el('tbody', {}, rows.map(r => el('tr', {}, r)))
        ])
      ]));
    } else if (tab === 'competencies') {
      const list = await api('/admin/competencies');
      const addErr = el('div', { className: 'alert alert-error hide', id: 'compErr' });
      const addForm = el('div', { className: 'inline-form' }, [
        el('input', { id: 'newCompName', placeholder: 'Competency name', type: 'text' }),
        el('input', { id: 'newCompDesc', placeholder: 'Description (optional)', type: 'text' }),
        el('button', { className: 'btn', textContent: 'Add competency', onclick: async () => {
          const name = document.getElementById('newCompName').value.trim();
          const desc = document.getElementById('newCompDesc').value.trim();
          if (!name) { document.getElementById('compErr').textContent = 'Name required'; document.getElementById('compErr').classList.remove('hide'); return; }
          try {
            await api('/admin/competencies', { method: 'POST', body: JSON.stringify({ name, description: desc || null }) });
            document.getElementById('compErr').classList.add('hide');
            document.getElementById('newCompName').value = '';
            document.getElementById('newCompDesc').value = '';
            load();
          } catch (e) {
            document.getElementById('compErr').textContent = e.data?.error || e.message;
            document.getElementById('compErr').classList.remove('hide');
          }
        }})
      ]);
      const rows = list.map(c => el('tr', {}, [
        el('td', {}, c.competency_id),
        el('td', {}, c.name),
        el('td', {}, c.description || '—'),
        el('td', {}, [
          el('a', { href: '#admin/quizzes', className: 'btn btn-secondary', style: 'margin-right:0.5rem', onclick: (e) => { e.preventDefault(); sessionStorage.setItem('adminQuizCompetency', c.competency_id); navigate('#admin/quizzes'); } }, 'Quizzes'),
          el('button', { className: 'btn btn-secondary', textContent: 'Delete', onclick: async () => {
            if (!confirm('Delete this competency and its quizzes?')) return;
            await api('/admin/competencies/' + c.competency_id, { method: 'DELETE' });
            load();
          }})
        ])
      ]));
      content.appendChild(el('div', { className: 'admin-section' }, [
        el('h2', {}, 'Competencies'),
        addErr,
        addForm,
        el('table', { className: 'admin-table' }, [
          el('thead', {}, el('tr', {}, [el('th', {}, 'ID'), el('th', {}, 'Name'), el('th', {}, 'Description'), el('th', {}, 'Actions')])),
          el('tbody', {}, rows)
        ])
      ]));
    } else if (tab === 'quizzes') {
      const compId = sessionStorage.getItem('adminQuizCompetency');
      let compName = 'Select a competency';
      let list = [];
      const comps = await api('/admin/competencies');
      if (compId) {
        list = await api('/admin/quizzes/' + compId);
        const comp = comps.find(c => String(c.competency_id) === String(compId));
        if (comp) compName = comp.name;
      }
      const select = el('select', {
        onchange: async function () {
          const id = this.value;
          sessionStorage.setItem('adminQuizCompetency', id);
          if (id) navigate('#admin/quizzes');
        }
      }, [el('option', { value: '' }, '-- Select competency --'), ...comps.map(c => el('option', { value: c.competency_id, selected: String(c.competency_id) === String(compId) }, c.name))]);
      const rows = list.map(q => el('tr', {}, [
        el('td', {}, q.quiz_id),
        el('td', {}, q.question_text.substring(0, 50) + (q.question_text.length > 50 ? '…' : '')),
        el('td', {}, q.question_type),
        el('td', {}, el('button', { className: 'btn btn-secondary', textContent: 'Delete', onclick: async () => {
          if (!confirm('Delete this question?')) return;
          await api('/admin/quizzes/' + q.quiz_id, { method: 'DELETE' });
          load();
        }}))
      ]));
      const addQErr = el('div', { className: 'alert alert-error hide', id: 'addQuizErr' });
      const optionsContainer = el('div', { id: 'addQuestionOptionsContainer' });
      function buildOptionsUI(qType) {
        optionsContainer.innerHTML = '';
        if (qType === 'multiple-choice') {
          const list = el('div', { className: 'add-q-mc-list' });
          const correctSelect = el('select', { className: 'add-q-correct', id: 'addQCorrectSelect' });
          function addChoice(label) {
            const row = el('div', { className: 'form-group add-q-mc-row' }, [
              el('label', {}, label),
              el('input', { type: 'text', className: 'add-q-mc-option', placeholder: 'Enter choice text' })
            ]);
            list.appendChild(row);
            correctSelect.appendChild(el('option', { value: String(correctSelect.options.length) }, label));
          }
          addChoice('Choice 1');
          addChoice('Choice 2');
          const addBtn = el('button', { type: 'button', className: 'btn btn-secondary add-q-add-btn' }, 'Add another choice');
          addBtn.onclick = () => {
            const n = list.querySelectorAll('.add-q-mc-option').length + 1;
            addChoice('Choice ' + n);
          };
          optionsContainer.appendChild(el('div', { className: 'add-q-options-block' }, [
            list,
            addBtn,
            el('div', { className: 'form-group', style: 'margin-top:1rem' }, [
              el('label', {}, 'Correct answer'),
              el('p', { className: 'add-q-hint', style: 'margin:0.25rem 0 0 0;font-size:0.85rem;color:var(--text-muted)' }, 'Which choice is correct?'),
              correctSelect
            ])
          ]));
        } else if (qType === 'matching') {
          const pairs = el('div', { className: 'add-q-match-pairs' });
          function addPair(n) {
            const row = el('div', { className: 'add-q-match-row', style: 'display:flex;gap:0.75rem;align-items:center;margin-bottom:0.5rem' }, [
              el('input', { type: 'text', className: 'add-q-match-left', placeholder: 'Left item ' + n, style: 'flex:1' }),
              el('span', {}, '→'),
              el('input', { type: 'text', className: 'add-q-match-right', placeholder: 'Right item ' + n, style: 'flex:1' })
            ]);
            pairs.appendChild(row);
          }
          addPair(1); addPair(2);
          const addBtn = el('button', { type: 'button', className: 'btn btn-secondary add-q-add-btn' }, 'Add another pair');
          addBtn.onclick = () => {
            addPair(pairs.querySelectorAll('.add-q-match-row').length + 1);
          };
          optionsContainer.appendChild(el('div', { className: 'add-q-options-block' }, [
            el('p', { className: 'add-q-hint', style: 'margin:0 0 0.5rem 0;font-size:0.9rem;color:var(--text-muted)' }, 'Enter matching pairs. Students will see left items and choose the correct right item.'),
            pairs,
            addBtn
          ]));
        } else {
          const list = el('div', { className: 'add-q-drag-list' });
          function addItem(n) {
            const row = el('div', { className: 'form-group' }, [
              el('label', {}, 'Item ' + n + ' (correct order)'),
              el('input', { type: 'text', className: 'add-q-drag-item', placeholder: 'Item text' })
            ]);
            list.appendChild(row);
          }
          addItem(1); addItem(2);
          const addBtn = el('button', { type: 'button', className: 'btn btn-secondary add-q-add-btn' }, 'Add another item');
          addBtn.onclick = () => {
            addItem(list.querySelectorAll('.add-q-drag-item').length + 1);
          };
          optionsContainer.appendChild(el('div', { className: 'add-q-options-block' }, [
            el('p', { className: 'add-q-hint', style: 'margin:0 0 0.5rem 0;font-size:0.9rem;color:var(--text-muted)' }, 'List items in the correct order. Students will drag to reorder.'),
            list,
            addBtn
          ]));
        }
      }
      const typeSelect = el('select', { id: 'newQType' }, [
        el('option', { value: 'multiple-choice' }, 'Multiple choice'),
        el('option', { value: 'matching' }, 'Matching'),
        el('option', { value: 'drag-drop' }, 'Drag and drop')
      ]);
      typeSelect.onchange = () => buildOptionsUI(typeSelect.value);
      buildOptionsUI('multiple-choice');
      function getOptionsAndCorrect() {
        const qType = document.getElementById('newQType').value;
        if (qType === 'multiple-choice') {
          const inputs = document.querySelectorAll('.add-q-mc-option');
          const options = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
          const correctIdx = parseInt(document.getElementById('addQCorrectSelect').value, 10);
          const correct_answer = options[correctIdx] !== undefined ? options[correctIdx] : (options[0] || '');
          return { options, correct_answer };
        }
        if (qType === 'matching') {
          const leftInputs = document.querySelectorAll('.add-q-match-left');
          const rightInputs = document.querySelectorAll('.add-q-match-right');
          const left = Array.from(leftInputs).map(i => i.value.trim()).filter(Boolean);
          const right = Array.from(rightInputs).map(i => i.value.trim()).filter(Boolean);
          const options = { left, right };
          const correct_answer = {};
          left.forEach((l, i) => { if (l && right[i]) correct_answer[l] = right[i]; });
          return { options, correct_answer };
        }
        const items = document.querySelectorAll('.add-q-drag-item');
        const options = Array.from(items).map(i => i.value.trim()).filter(Boolean);
        return { options, correct_answer: [...options] };
      }
      const addQuizForm = compId ? el('div', { className: 'admin-section', style: 'margin-top:1rem' }, [
        el('h3', {}, 'Add question'),
        addQErr,
        el('div', { className: 'form-group' }, [el('label', {}, 'Question text'), el('input', { id: 'newQText', type: 'text', placeholder: 'e.g. What is the first step in hand hygiene?', style: 'width:100%' })]),
        el('div', { className: 'form-group' }, [
          el('label', {}, 'Question type'),
          typeSelect
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {}, 'Options & correct answer'),
          optionsContainer
        ]),
        el('button', { className: 'btn', textContent: 'Add question', onclick: async () => {
          const question_text = document.getElementById('newQText').value.trim();
          const question_type = document.getElementById('newQType').value;
          addQErr.classList.add('hide');
          if (!question_text) { addQErr.textContent = 'Please enter the question text.'; addQErr.classList.remove('hide'); return; }
          const { options, correct_answer } = getOptionsAndCorrect();
          if (question_type === 'multiple-choice' && (!options.length || !correct_answer)) {
            addQErr.textContent = 'Add at least one choice and select the correct answer.';
            addQErr.classList.remove('hide');
            return;
          }
          if (question_type === 'matching' && (!options.left?.length || !options.right?.length)) {
            addQErr.textContent = 'Add at least one left–right pair.';
            addQErr.classList.remove('hide');
            return;
          }
          if (question_type === 'drag-drop' && !options.length) {
            addQErr.textContent = 'Add at least one item.';
            addQErr.classList.remove('hide');
            return;
          }
          try {
            await api('/admin/quizzes', { method: 'POST', body: JSON.stringify({ competency_id: parseInt(compId, 10), question_text, question_type, options, correct_answer }) });
            addQErr.classList.add('hide');
            document.getElementById('newQText').value = '';
            optionsContainer.innerHTML = '';
            buildOptionsUI(question_type);
            if (document.getElementById('addQCorrectSelect')) document.getElementById('addQCorrectSelect').selectedIndex = 0;
            load();
          } catch (e) {
            addQErr.textContent = e.data?.error || e.message;
            addQErr.classList.remove('hide');
          }
        }})
      ]) : null;
      const aiErr = el('div', { className: 'alert alert-error hide', id: 'aiQuizErr' });
      const aiBtn = compId ? el('button', { className: 'btn', id: 'aiGenerateBtn', textContent: 'Generate with AI (3 questions)' }) : null;
      if (aiBtn) {
        aiBtn.onclick = async () => {
          aiErr.classList.add('hide');
          aiBtn.disabled = true;
          aiBtn.textContent = 'Generating…';
          try {
            const result = await api('/admin/ai/generate-questions', { method: 'POST', body: JSON.stringify({ competency_id: parseInt(compId, 10), count: 3 }) });
            aiBtn.textContent = 'Generate with AI (3 questions)';
            aiErr.classList.add('hide');
            load();
            if (result.added && result.added.length) alert('Added ' + result.added.length + ' AI-generated question(s).');
          } catch (e) {
            aiBtn.textContent = 'Generate with AI (3 questions)';
            aiBtn.disabled = false;
            aiErr.textContent = e.data?.error || e.message;
            aiErr.classList.remove('hide');
          }
          aiBtn.disabled = false;
        };
      }
      content.appendChild(el('div', { className: 'admin-section' }, [
        el('h2', {}, 'Quiz questions – ' + compName),
        el('div', { className: 'inline-form' }, [el('label', {}, 'Competency:'), select]),
        aiErr,
        compId ? el('div', { className: 'inline-form', style: 'margin-top:0.5rem' }, [aiBtn]) : null,
        list.length ? el('table', { className: 'admin-table' }, [
          el('thead', {}, el('tr', {}, [el('th', {}, 'ID'), el('th', {}, 'Question'), el('th', {}, 'Type'), el('th', {}, 'Actions')])),
          el('tbody', {}, rows)
        ]) : el('p', {}, 'No questions yet. Select a competency and add a question below.'),
        addQuizForm
      ]));
    } else if (tab === 'students') {
      const list = await api('/admin/students');
      const addErr = el('div', { className: 'alert alert-error hide', id: 'stuErr' });
      const addForm = el('div', { className: 'inline-form' }, [
        el('input', { id: 'newStuSN', placeholder: 'Student number', type: 'text' }),
        el('input', { id: 'newStuName', placeholder: 'Full name', type: 'text' }),
        el('input', { id: 'newStuPW', placeholder: 'Password', type: 'password' }),
        el('button', { className: 'btn', textContent: 'Add student', onclick: async () => {
          const sn = document.getElementById('newStuSN').value.trim();
          const name = document.getElementById('newStuName').value.trim();
          const pw = document.getElementById('newStuPW').value;
          if (!sn || !name || !pw) { document.getElementById('stuErr').textContent = 'Student number, name and password required'; document.getElementById('stuErr').classList.remove('hide'); return; }
          try {
            await api('/admin/students', { method: 'POST', body: JSON.stringify({ student_number: sn, name, password: pw }) });
            document.getElementById('stuErr').classList.add('hide');
            document.getElementById('newStuSN').value = ''; document.getElementById('newStuName').value = ''; document.getElementById('newStuPW').value = '';
            load();
          } catch (e) {
            document.getElementById('stuErr').textContent = e.data?.error || e.message;
            document.getElementById('stuErr').classList.remove('hide');
          }
        }})
      ]);
      const rows = list.filter(s => !s.is_admin).map(s => el('tr', {}, [
        el('td', {}, s.student_number),
        el('td', {}, s.name),
        el('td', {}, s.email || '—'),
        el('td', {}, el('div', { style: 'display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center' }, [
          el('button', { className: 'btn btn-secondary', textContent: 'Delete student', onclick: async () => {
            if (!confirm('Permanently delete ' + s.student_number + ' (' + s.name + ')? This cannot be undone.')) return;
            try {
              await api('/admin/students/' + s.student_id, { method: 'DELETE' });
              load();
            } catch (e) {
              alert(e.data?.error || e.message);
            }
          }}),
          el('button', { className: 'btn btn-secondary', textContent: 'Reset password', onclick: async () => {
            const pw = prompt('New password for ' + s.student_number);
            if (!pw) return;
            await api('/admin/students/' + s.student_id + '/reset-password', { method: 'PUT', body: JSON.stringify({ password: pw }) });
            alert('Password updated');
          }})
        ]))
      ]));
      content.appendChild(el('div', { className: 'admin-section' }, [
        el('h2', {}, 'Students'),
        addErr,
        addForm,
        el('table', { className: 'admin-table' }, [
          el('thead', {}, el('tr', {}, [el('th', {}, 'Student #'), el('th', {}, 'Name'), el('th', {}, 'Email'), el('th', {}, 'Actions')])),
          el('tbody', {}, rows)
        ])
      ]));
    } else if (tab === 'reports') {
      const downloadReport = async (format) => {
        const res = await fetch(API + '/admin/reports/export?format=' + format, { headers: headers() });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'student-performance.' + (format === 'csv' ? 'csv' : 'json');
        a.click();
        URL.revokeObjectURL(url);
      };
      const jsonBtn = el('button', { className: 'btn', textContent: 'Download JSON', onclick: () => downloadReport('json').catch(e => alert(e.message)) });
      const csvBtn = el('button', { className: 'btn btn-secondary', style: 'margin-left:0.5rem', textContent: 'Download CSV', onclick: () => downloadReport('csv').catch(e => alert(e.message)) });
      content.appendChild(el('div', { className: 'admin-section' }, [
        el('h2', {}, 'Reports'),
        el('p', {}, 'Export student performance and competency completion.'),
        el('div', { className: 'inline-form' }, [jsonBtn, csvBtn])
      ]));
    }
  };

  await load();

  return el('div', { className: 'admin-page' }, content);
}

// ----- Init -----
window.addEventListener('hashchange', render);
window.addEventListener('load', () => {
  const { view } = getHash();
  if (token && (view === 'login' || view === 'register' || view === '')) {
    if (isAdmin()) navigate('#admin');
    else navigate('#dashboard');
  }
  render();
});
