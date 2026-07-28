import { course } from './content.js';
import {
  calculateProgress,
  createInitialState,
  gradeQuiz,
  normalizeState,
} from './state.js';

const STORAGE_KEY = 'axpi-study-v1';
const allLessons = course.days.flatMap((day) => day.lessons);
const totalLessons = allLessons.length;
const hasBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

function lessonPath(day, lesson) {
  return `#/day${day.dayNumber}/${lesson.id}`;
}

function quizPath(day) {
  return `#/day${day.dayNumber}/quiz`;
}

export function sanitizeCourseState(value, courseData = course) {
  const normalized = normalizeState(value);
  const firstDay = courseData.days[0];
  const firstLesson = firstDay?.lessons[0];
  const fallbackLocation = firstDay && firstLesson
    ? { dayId: firstDay.id, lessonId: firstLesson.id }
    : createInitialState().lastLocation;
  const validLessonIds = new Set(courseData.days.flatMap((day) => day.lessons.map((lesson) => lesson.id)));
  const validDayIds = new Set(courseData.days.map((day) => day.id));

  const completedLessons = normalized.completedLessons.filter((lessonId) => validLessonIds.has(lessonId));
  const quizScores = Object.fromEntries(
    Object.entries(normalized.quizScores).filter(([dayId]) => validDayIds.has(dayId)),
  );
  const locationDay = courseData.days.find((day) => day.id === normalized.lastLocation.dayId);
  const locationIsValid = locationDay && (
    normalized.lastLocation.lessonId === 'quiz'
    || locationDay.lessons.some((lesson) => lesson.id === normalized.lastLocation.lessonId)
  );

  return {
    completedLessons,
    quizScores,
    lastLocation: locationIsValid ? normalized.lastLocation : fallbackLocation,
  };
}

export function dayContinuePath(day, courseState) {
  const completed = new Set(Array.isArray(courseState?.completedLessons) ? courseState.completedLessons : []);
  const firstUnfinished = day.lessons.find((lesson) => !completed.has(lesson.id));
  if (firstUnfinished) return lessonPath(day, firstUnfinished);
  if (!Object.hasOwn(courseState?.quizScores ?? {}, day.id)) return quizPath(day);
  return lessonPath(day, day.lessons[0]);
}

export function globalContinuePath(courseData, courseState) {
  const sanitized = sanitizeCourseState(courseState, courseData);
  const day = courseData.days.find((candidate) => candidate.id === sanitized.lastLocation.dayId);
  if (sanitized.lastLocation.lessonId === 'quiz') return quizPath(day);
  const lesson = day.lessons.find((candidate) => candidate.id === sanitized.lastLocation.lessonId);
  return lessonPath(day, lesson);
}

export function retainBestQuizScore(previousScore, submittedScore) {
  return previousScore === undefined ? submittedScore : Math.max(previousScore, submittedScore);
}

export function preferredScrollBehavior(browserWindow) {
  return browserWindow?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth';
}

const elements = hasBrowser ? {
  progress: document.querySelector('#course-progress'),
  progressText: document.querySelector('#course-progress-text'),
  continueButton: document.querySelector('#continue-button'),
  dayNavigation: document.querySelector('#day-navigation'),
  home: document.querySelector('#study-home'),
  lesson: document.querySelector('#lesson-content'),
  quiz: document.querySelector('#quiz-panel'),
  resetButton: document.querySelector('#reset-progress'),
  resetDialog: document.querySelector('#reset-dialog'),
  learningView: document.querySelector('#learning-view'),
} : null;

let state = hasBrowser ? loadState() : sanitizeCourseState(null);
let currentRoute = { type: 'home' };

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = String(options.text);
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      element.setAttribute(name, String(value));
    }
  }
  return element;
}

function appendTextList(parent, items, className = '') {
  const list = createElement('ul', { className });
  for (const item of items) list.append(createElement('li', { text: item }));
  parent.append(list);
  return list;
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeCourseState(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeCourseState(null);
  }
}

function saveState() {
  state = sanitizeCourseState(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function findDay(dayNumber, courseData = course) {
  return courseData.days.find((day) => day.dayNumber === Number(dayNumber));
}

function findLessonLocation(lessonId) {
  for (const day of course.days) {
    const lesson = day.lessons.find((candidate) => candidate.id === lessonId);
    if (lesson) return { day, lesson };
  }
  return null;
}

export function parseRoute(hash, courseData = course) {
  if (!hash || hash === '#' || hash === '#/' || hash === '#/home') return { type: 'home' };
  const match = hash.match(/^#\/day(\d+)\/([^/]+)$/);
  if (!match) return { type: 'home', invalid: true };

  const day = findDay(match[1], courseData);
  if (!day) return { type: 'home', invalid: true };
  if (match[2] === 'quiz') return { type: 'quiz', day };

  const lesson = day.lessons.find((candidate) => candidate.id === match[2]);
  return lesson ? { type: 'lesson', day, lesson } : { type: 'home', invalid: true };
}

function navigate(hash) {
  if (window.location.hash === hash) {
    renderRoute();
  } else {
    window.location.hash = hash;
  }
}

function isDayComplete(day) {
  const allComplete = day.lessons.every((lesson) => state.completedLessons.includes(lesson.id));
  return allComplete && Object.hasOwn(state.quizScores, day.id);
}

function dayLessonProgress(day) {
  return day.lessons.filter((lesson) => state.completedLessons.includes(lesson.id)).length;
}

function updateProgress() {
  const progress = calculateProgress(state.completedLessons, totalLessons);
  elements.progress.value = progress;
  elements.progress.textContent = `${progress}%`;
  elements.progressText.textContent = `전체 진도 ${progress}% · ${state.completedLessons.length}/${totalLessons} 레슨`;
  elements.progress.setAttribute('aria-valuetext', `${totalLessons}개 레슨 중 ${state.completedLessons.length}개 완료, ${progress}%`);
}

function renderDayNavigation() {
  elements.dayNavigation.replaceChildren();
  for (const day of course.days) {
    const completed = dayLessonProgress(day);
    const dayComplete = isDayComplete(day);
    const button = createElement('button', {
      className: 'day-link',
      attrs: { type: 'button', 'aria-label': `Day ${day.dayNumber} ${day.title}, ${dayComplete ? '완료' : `${completed}/${day.lessons.length} 레슨 완료`}` },
    });
    if (currentRoute.day?.id === day.id) button.setAttribute('aria-current', 'page');

    button.append(createElement('span', { className: 'day-number', text: day.dayNumber, attrs: { 'aria-hidden': 'true' } }));
    const label = createElement('span', { className: 'day-label' });
    label.append(createElement('strong', { text: day.title }));
    label.append(createElement('small', {
      className: `day-status${dayComplete ? ' complete' : ''}`,
      text: dayComplete ? '✓ 학습 완료' : `${completed}/${day.lessons.length} 레슨`,
    }));
    button.append(label);
    button.addEventListener('click', () => navigate(dayContinuePath(day, state)));
    elements.dayNavigation.append(button);
  }
}

function setVisibleView(viewName) {
  elements.home.hidden = viewName !== 'home';
  elements.lesson.hidden = viewName !== 'lesson';
  elements.quiz.hidden = viewName !== 'quiz';
}

function makeButton(label, className, onClick) {
  const button = createElement('button', { className: `button ${className}`, text: label, attrs: { type: 'button' } });
  button.addEventListener('click', onClick);
  return button;
}

function renderHome() {
  setVisibleView('home');
  elements.home.replaceChildren();

  const progress = calculateProgress(state.completedLessons, totalLessons);
  const hero = createElement('section', { className: 'home-hero' });
  hero.append(createElement('p', { className: 'eyebrow', text: '5-DAY SELF-PACED COURSE' }));
  hero.append(createElement('h1', { text: course.title, attrs: { id: 'home-title' } }));
  hero.append(createElement('p', { text: course.description }));
  const heroProgress = createElement('div', { className: 'hero-progress', attrs: { 'aria-label': `현재 학습 진도 ${progress}%` } });
  heroProgress.append(createElement('strong', { text: `${progress}%` }));
  heroProgress.append(createElement('span', { text: `${state.completedLessons.length}개 레슨 완료 · 하루 약 45~70분` }));
  hero.append(heroProgress);
  elements.home.append(hero);

  const grid = createElement('section', { className: 'day-card-grid', attrs: { 'aria-label': '5일 학습 과정' } });
  for (const day of course.days) {
    const completed = dayLessonProgress(day);
    const dayComplete = isDayComplete(day);
    const card = createElement('article', { className: 'day-card' });
    card.append(createElement('p', { className: 'eyebrow', text: `DAY ${day.dayNumber} · ${day.estimatedMinutes}분` }));
    card.append(createElement('h2', { text: day.title }));
    card.append(createElement('p', { text: day.subtitle }));
    card.append(createElement('span', {
      className: `card-status${dayComplete ? ' complete' : ''}`,
      text: dayComplete ? `✓ 완료 · 퀴즈 ${state.quizScores[day.id]}점` : `진행 ${completed}/${day.lessons.length} 레슨`,
    }));
    card.append(makeButton(dayComplete ? '다시 보기' : completed ? '계속 학습' : '학습 시작', 'button-secondary', () => {
      navigate(dayContinuePath(day, state));
    }));
    grid.append(card);
  }
  elements.home.append(grid);
}

function renderBlock(block) {
  const wrapper = createElement('section', { className: `content-block block-${block.type}` });

  switch (block.type) {
    case 'paragraph':
      wrapper.append(createElement('p', { text: block.text }));
      break;
    case 'heading':
      wrapper.append(createElement('h2', { text: block.text }));
      break;
    case 'callout': {
      wrapper.className += ` callout ${block.tone ?? ''}`;
      wrapper.append(createElement('h3', { text: block.title }));
      wrapper.append(createElement('p', { text: block.text }));
      break;
    }
    case 'compare': {
      wrapper.className += ' compare-grid';
      for (const side of [block.left, block.right]) {
        const panel = createElement('section', { className: 'compare-panel' });
        panel.append(createElement('h3', { text: side.title }));
        appendTextList(panel, side.items);
        wrapper.append(panel);
      }
      break;
    }
    case 'steps': {
      appendTextList(wrapper, block.items, 'step-list');
      break;
    }
    case 'table': {
      wrapper.className += ' table-scroll';
      const table = createElement('table');
      const head = createElement('thead');
      const headRow = createElement('tr');
      for (const header of block.headers) headRow.append(createElement('th', { text: header, attrs: { scope: 'col' } }));
      head.append(headRow);
      table.append(head);
      const body = createElement('tbody');
      for (const row of block.rows) {
        const tr = createElement('tr');
        for (const cell of row) tr.append(createElement('td', { text: cell }));
        body.append(tr);
      }
      table.append(body);
      wrapper.append(table);
      break;
    }
    case 'formula':
      wrapper.className += ' formula';
      wrapper.append(createElement('code', { text: block.expression }));
      wrapper.append(createElement('p', { text: block.explanation }));
      break;
    case 'flow':
      appendTextList(wrapper, block.items, 'flow-list');
      break;
    case 'checklist':
      appendTextList(wrapper, block.items, 'check-list');
      break;
    default:
      wrapper.append(createElement('p', { text: '지원하지 않는 콘텐츠 형식입니다.' }));
  }
  return wrapper;
}

function previousLessonRoute(day, lesson) {
  const index = allLessons.findIndex((candidate) => candidate.id === lesson.id);
  if (index <= 0) return '#/home';
  const location = findLessonLocation(allLessons[index - 1].id);
  return lessonPath(location.day, location.lesson);
}

function nextRoute(day, lesson) {
  const index = day.lessons.findIndex((candidate) => candidate.id === lesson.id);
  if (index < day.lessons.length - 1) return lessonPath(day, day.lessons[index + 1]);
  return quizPath(day);
}

function completeLessonAndContinue(day, lesson) {
  if (!state.completedLessons.includes(lesson.id)) state.completedLessons.push(lesson.id);
  state.lastLocation = { dayId: day.id, lessonId: lesson.id };
  saveState();
  updateProgress();
  renderDayNavigation();
  navigate(nextRoute(day, lesson));
}

function renderLesson(day, lesson) {
  setVisibleView('lesson');
  elements.lesson.replaceChildren();

  state.lastLocation = { dayId: day.id, lessonId: lesson.id };
  saveState();

  const lessonIndex = day.lessons.findIndex((candidate) => candidate.id === lesson.id);
  const header = createElement('header', { className: 'lesson-header' });
  header.append(createElement('p', { className: 'eyebrow', text: `DAY ${day.dayNumber} · LESSON ${lessonIndex + 1}/${day.lessons.length}` }));
  header.append(createElement('h1', { text: lesson.title }));
  const meta = createElement('div', { className: 'lesson-meta' });
  meta.append(createElement('span', { text: lesson.kicker }));
  meta.append(createElement('span', { text: `예상 ${lesson.estimatedMinutes}분` }));
  meta.append(createElement('span', { text: state.completedLessons.includes(lesson.id) ? '✓ 완료한 레슨' : '미완료 레슨' }));
  header.append(meta);
  elements.lesson.append(header);
  elements.lesson.append(createElement('p', { className: 'lesson-intro', text: lesson.intro }));

  const objectives = createElement('section', { className: 'objectives' });
  objectives.append(createElement('h2', { text: '오늘의 학습 목표' }));
  appendTextList(objectives, day.objectives);
  elements.lesson.append(objectives);

  for (const block of lesson.blocks) elements.lesson.append(renderBlock(block));

  const takeaway = createElement('aside', { className: 'takeaway', attrs: { 'aria-label': '핵심 기억 문장' } });
  takeaway.append(createElement('strong', { text: 'TAKEAWAY' }));
  takeaway.append(createElement('span', { text: lesson.takeaway }));
  elements.lesson.append(takeaway);

  if (lessonIndex === day.lessons.length - 1) {
    const practice = createElement('details', { className: 'optional-practice' });
    practice.append(createElement('summary', { text: `선택 실습 · ${day.optionalPractice.title}` }));
    const practiceBody = createElement('div');
    practiceBody.append(createElement('p', { text: day.optionalPractice.description }));
    appendTextList(practiceBody, day.optionalPractice.prompts);
    practice.append(practiceBody);
    elements.lesson.append(practice);
  }

  const actions = createElement('nav', { className: 'lesson-actions', attrs: { 'aria-label': '레슨 이동' } });
  actions.append(makeButton('이전', 'button-secondary', () => navigate(previousLessonRoute(day, lesson))));
  actions.append(makeButton(
    lessonIndex === day.lessons.length - 1 ? '완료하고 퀴즈 풀기' : '완료하고 다음 레슨',
    'button-primary',
    () => completeLessonAndContinue(day, lesson),
  ));
  elements.lesson.append(actions);
}

function selectedAnswers(form, questionCount) {
  return Array.from({ length: questionCount }, (_, index) => {
    const checked = form.querySelector(`input[name="question-${index}"]:checked`);
    return checked ? Number(checked.value) : null;
  });
}

function renderQuizFeedback(container, day, answers, result) {
  container.replaceChildren();
  const previousBest = state.quizScores[day.id];
  const bestScore = retainBestQuizScore(previousBest, result.score);
  state.quizScores[day.id] = bestScore;
  saveState();
  updateProgress();
  renderDayNavigation();

  const summary = createElement('section', { className: 'quiz-result', attrs: { 'aria-live': 'polite' } });
  summary.append(createElement('h2', { text: `이번 점수 ${result.score}점` }));
  summary.append(createElement('p', { text: `Day ${day.dayNumber} 최고 점수는 ${bestScore}점입니다. ${isDayComplete(day) ? '레슨과 퀴즈를 모두 마쳐 Day 학습이 완료되었습니다.' : '아직 완료하지 않은 레슨이 있습니다.'}` }));
  container.append(summary);

  day.quiz.forEach((question, index) => {
    const correct = result.results[index];
    const feedback = createElement('article', { className: `answer-feedback ${correct ? 'correct' : 'incorrect'}` });
    feedback.append(createElement('strong', { text: `${index + 1}번 · ${correct ? '✓ 정답' : '✕ 오답'}` }));
    feedback.append(createElement('span', { text: `선택: ${question.options[answers[index]]} · 정답: ${question.options[question.answer]}` }));
    feedback.append(createElement('p', { text: question.explanation }));
    container.append(feedback);
  });
}

function renderQuiz(day) {
  setVisibleView('quiz');
  elements.quiz.replaceChildren();

  state.lastLocation = { dayId: day.id, lessonId: 'quiz' };
  saveState();

  const header = createElement('header', { className: 'quiz-header' });
  header.append(createElement('p', { className: 'eyebrow', text: `DAY ${day.dayNumber} · KNOWLEDGE CHECK` }));
  header.append(createElement('h1', { text: `${day.title} 퀴즈` }));
  header.append(createElement('p', { text: '모든 문항에 답하면 정답 여부와 해설을 바로 확인할 수 있습니다.' }));
  if (Object.hasOwn(state.quizScores, day.id)) {
    header.append(createElement('p', { className: 'day-status complete', text: `저장된 최고 점수 ${state.quizScores[day.id]}점` }));
  }
  elements.quiz.append(header);

  const form = createElement('form', { className: 'quiz-form' });
  day.quiz.forEach((question, questionIndex) => {
    const fieldset = createElement('fieldset', { className: 'question-card' });
    fieldset.append(createElement('legend', { text: `${questionIndex + 1}. ${question.question}` }));
    question.options.forEach((option, optionIndex) => {
      const label = createElement('label', { className: 'choice' });
      const input = createElement('input', {
        attrs: { type: 'radio', name: `question-${questionIndex}`, value: optionIndex },
      });
      label.append(input, createElement('span', { text: option }));
      fieldset.append(label);
    });
    form.append(fieldset);
  });

  const message = createElement('p', { className: 'quiz-message', attrs: { 'aria-live': 'assertive', role: 'status' } });
  form.append(message);
  const actions = createElement('div', { className: 'quiz-actions' });
  actions.append(makeButton('이전 레슨', 'button-secondary', () => navigate(lessonPath(day, day.lessons.at(-1)))));
  const submit = createElement('button', { className: 'button button-primary', text: '답안 제출', attrs: { type: 'submit' } });
  actions.append(submit);
  form.append(actions);
  const feedback = createElement('div', { attrs: { 'aria-live': 'polite' } });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const answers = selectedAnswers(form, day.quiz.length);
    if (answers.some((answer) => answer === null)) {
      message.textContent = '모든 문항에 답한 뒤 제출해 주세요.';
      form.querySelector(`input[name="question-${answers.indexOf(null)}"]`)?.focus();
      return;
    }
    message.textContent = '';
    const result = gradeQuiz(day.quiz, answers);
    renderQuizFeedback(feedback, day, answers, result);
    for (const input of form.querySelectorAll('input')) input.disabled = true;
    submit.disabled = true;
    const retry = makeButton('다시 풀기', 'button-secondary', () => renderQuiz(day));
    actions.append(retry);
    feedback.focus({ preventScroll: true });
    feedback.scrollIntoView({ behavior: preferredScrollBehavior(window), block: 'start' });
  });

  elements.quiz.append(form, feedback);
}

function renderRoute() {
  const route = parseRoute(window.location.hash);
  if (route.invalid) {
    window.history.replaceState(null, '', '#/home');
    currentRoute = { type: 'home' };
    renderHome();
  } else {
    currentRoute = route;
    if (route.type === 'home') renderHome();
    if (route.type === 'lesson') renderLesson(route.day, route.lesson);
    if (route.type === 'quiz') renderQuiz(route.day);
  }

  updateProgress();
  renderDayNavigation();
  elements.continueButton.hidden = currentRoute.type !== 'home';
  document.title = currentRoute.type === 'home'
    ? `${course.title}`
    : `${currentRoute.lesson?.title ?? `${currentRoute.day.title} 퀴즈`} · ${course.title}`;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

if (hasBrowser) {
  elements.continueButton.addEventListener('click', () => {
    navigate(globalContinuePath(course, state));
  });

  elements.resetButton.addEventListener('click', () => elements.resetDialog.showModal());
  elements.resetDialog.addEventListener('close', () => {
    if (elements.resetDialog.returnValue !== 'confirm') return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset the in-memory state even when browser storage is unavailable.
    }
    state = sanitizeCourseState(createInitialState());
    navigate('#/home');
  });

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('popstate', renderRoute);

  if (!window.location.hash) window.history.replaceState(null, '', '#/home');
  renderRoute();
}
