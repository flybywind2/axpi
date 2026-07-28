import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { course } from '../study/content.js';

const readStudyFile = (name) => readFile(new URL(`../study/${name}`, import.meta.url), 'utf8');

test('app module can be imported without browser globals', async () => {
  const appModule = await import('../study/app.js');
  assert.ok(appModule);
});

test('bad hashes resolve to the safe home route', async () => {
  const { parseRoute } = await import('../study/app.js');
  assert.equal(parseRoute('#/day99/not-real').type, 'home');
  assert.equal(parseRoute('#/broken').type, 'home');
});

test('day continuation opens the first unfinished lesson', async () => {
  const { dayContinuePath } = await import('../study/app.js');
  const day = course.days[0];
  const state = { completedLessons: [day.lessons[0].id], quizScores: {} };
  assert.equal(dayContinuePath(day, state), `#/day1/${day.lessons[1].id}`);
});

test('day continuation opens the quiz after all lessons are done', async () => {
  const { dayContinuePath } = await import('../study/app.js');
  const day = course.days[0];
  const state = { completedLessons: day.lessons.map((lesson) => lesson.id), quizScores: {} };
  assert.equal(dayContinuePath(day, state), '#/day1/quiz');
});

test('a completed day restarts at its first lesson for review, including a zero quiz score', async () => {
  const { dayContinuePath } = await import('../study/app.js');
  const day = course.days[0];
  const state = {
    completedLessons: day.lessons.map((lesson) => lesson.id),
    quizScores: { [day.id]: 0 },
  };
  assert.equal(dayContinuePath(day, state), `#/day1/${day.lessons[0].id}`);
});

test('course state sanitization filters unknown lesson and day IDs', async () => {
  const { sanitizeCourseState } = await import('../study/app.js');
  const result = sanitizeCourseState({
    completedLessons: ['d1l1', 'unknown-lesson'],
    quizScores: { day1: 0, unknownDay: 100 },
    lastLocation: { dayId: 'unknownDay', lessonId: 'unknown-lesson' },
  }, course);

  assert.deepEqual(result.completedLessons, ['d1l1']);
  assert.deepEqual(result.quizScores, { day1: 0 });
  assert.deepEqual(result.lastLocation, { dayId: 'day1', lessonId: 'd1l1' });
});

test('course state sanitization preserves a valid quiz location', async () => {
  const { sanitizeCourseState } = await import('../study/app.js');
  const result = sanitizeCourseState({
    completedLessons: [],
    quizScores: {},
    lastLocation: { dayId: 'day3', lessonId: 'quiz' },
  }, course);
  assert.deepEqual(result.lastLocation, { dayId: 'day3', lessonId: 'quiz' });
});

test('course state sanitization rejects a lesson paired with the wrong day', async () => {
  const { sanitizeCourseState } = await import('../study/app.js');
  const result = sanitizeCourseState({
    completedLessons: [],
    quizScores: {},
    lastLocation: { dayId: 'day2', lessonId: 'd1l2' },
  }, course);
  assert.deepEqual(result.lastLocation, { dayId: 'day1', lessonId: 'd1l1' });
});

test('global continuation retains a valid quiz as the last location', async () => {
  const { globalContinuePath } = await import('../study/app.js');
  const state = {
    completedLessons: course.days[1].lessons.map((lesson) => lesson.id),
    quizScores: {},
    lastLocation: { dayId: 'day2', lessonId: 'quiz' },
  };
  assert.equal(globalContinuePath(course, state), '#/day2/quiz');
});

test('quiz score retention keeps the best score and accepts zero as submitted', async () => {
  const { retainBestQuizScore } = await import('../study/app.js');
  assert.equal(retainBestQuizScore(undefined, 0), 0);
  assert.equal(retainBestQuizScore(80, 60), 80);
  assert.equal(retainBestQuizScore(80, 100), 100);
});

test('scroll behavior disables smooth motion when the user requests reduced motion', async () => {
  const { preferredScrollBehavior } = await import('../study/app.js');
  const reduced = { matchMedia: () => ({ matches: true }) };
  const standard = { matchMedia: () => ({ matches: false }) };
  assert.equal(preferredScrollBehavior(reduced), 'auto');
  assert.equal(preferredScrollBehavior(standard), 'smooth');
});

test('study page exposes the complete accessible learning shell', async () => {
  const html = await readStudyFile('index.html');
  const requiredIds = [
    'course-progress',
    'course-progress-text',
    'continue-button',
    'day-navigation',
    'study-home',
    'lesson-content',
    'quiz-panel',
    'reset-progress',
    'reset-dialog',
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }

  for (const landmark of ['header', 'main', 'aside', 'nav']) {
    assert.match(html, new RegExp(`<${landmark}\\b`, 'i'), `missing <${landmark}> landmark`);
  }

  assert.match(html, /<script\s+type=["']module["']\s+src=["']\.\/app\.js["']/i);
  assert.match(html, /<link[^>]+href=["']\.\/styles\.css["']/i);
  assert.match(html, /<progress[^>]+id=["']course-progress["'][^>]+aria-label=/i);
  assert.match(html, /<dialog[^>]+id=["']reset-dialog["'][^>]+aria-labelledby=["']reset-dialog-title["']/i);
  assert.match(html, /id=["']reset-dialog-title["']/i);
  assert.match(html, /value=["']cancel["']/i);
  assert.match(html, /value=["']confirm["']/i);
});

test('styles implement the approved responsive AI Center learning system', async () => {
  const css = await readStudyFile('styles.css');

  for (const color of ['#F7F9FC', '#FFFFFF', '#111827', '#465161', '#245BFF', '#7C3AED', '#21D4FD']) {
    assert.ok(css.toUpperCase().includes(color), `missing color signal ${color}`);
  }

  assert.match(css, /Pretendard/i);
  assert.match(css, /line-height:\s*1\.65/i);
  assert.match(css, /max-width:\s*(?:760px|47\.5rem)/i);
  assert.match(css, /min-height:\s*44px/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /@media\s*\(min-width:\s*1024px\)/i);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /\.origin-dot/i);
  assert.match(css, /\.signal-line/i);
  assert.doesNotMatch(
    css,
    /#reset-progress\s*\{[^}]*display:\s*none/i,
    'the only reset control must remain available on mobile',
  );
});

test('app implements routing, persistence, grading, reset, and every content block', async () => {
  const app = await readStudyFile('app.js');

  assert.match(app, /from\s+["']\.\/content\.js["']/);
  assert.match(app, /from\s+["']\.\/state\.js["']/);
  assert.ok(app.includes('axpi-study-v1'));
  for (const api of ['localStorage', 'hashchange', 'gradeQuiz', 'normalizeState', 'calculateProgress', 'showModal', 'close']) {
    assert.ok(app.includes(api), `missing app capability ${api}`);
  }

  for (const blockType of ['paragraph', 'heading', 'callout', 'compare', 'steps', 'table', 'formula', 'flow', 'checklist']) {
    assert.match(app, new RegExp(`(?:case\\s+["']${blockType}["']|${blockType}\\s*:)`), `missing ${blockType} renderer`);
  }

  assert.match(app, /#\/home/);
  assert.match(app, /#\/day\$\{day\.dayNumber\}\/\$\{lesson\.id\}/);
  assert.match(app, /#\/day\$\{day\.dayNumber\}\/quiz/);
  assert.match(app, /textContent/);
  assert.doesNotMatch(app, /\beval\s*\(/);
  assert.doesNotMatch(app, /document\.write\s*\(/);
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'content must be rendered with DOM APIs, not innerHTML');
});
