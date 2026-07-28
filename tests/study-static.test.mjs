import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { course } from '../study/content.js';

const readStudyFile = (name) => readFile(new URL(`../study/${name}`, import.meta.url), 'utf8');
const readRootFile = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

function parseColorVariables(css) {
  return Object.fromEntries(
    [...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)]
      .map((match) => [match[1], match[2]]),
  );
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function visibleText(markup) {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('app module can be imported without browser globals', async () => {
  const appModule = await import('../study/app.js');
  assert.ok(appModule);
});

test('route focus helper ignores initial load and focuses after user navigation', async () => {
  const { focusRenderedView } = await import('../study/app.js');
  const calls = [];
  const target = { focus: (options) => calls.push(options) };

  assert.equal(focusRenderedView(target, false), false);
  assert.deepEqual(calls, []);
  assert.equal(focusRenderedView(target, true), true);
  assert.deepEqual(calls, [{ preventScroll: true }]);
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
  assert.match(html, /<link[^>]+rel=["']icon["'][^>]+href=["']\.\.\/assets\/img\/favicon\.svg["']/i);
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

test('muted and success text plus the focus outline meet WCAG contrast', async () => {
  const css = await readStudyFile('styles.css');
  const colors = parseColorVariables(css);
  const backgrounds = { white: '#FFFFFF', canvas: colors.canvas };

  for (const token of ['muted', 'success']) {
    for (const [surface, background] of Object.entries(backgrounds)) {
      const ratio = contrastRatio(colors[token], background);
      assert.ok(ratio >= 4.5, `--${token} contrast on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  }

  const focusRule = css.match(/:focus-visible\s*\{[^}]*outline:\s*[^;]*var\(--([a-z-]+)\)/is);
  assert.ok(focusRule, 'focus outline must use a declared color variable');
  const focusColor = colors[focusRule[1]];
  for (const [surface, background] of Object.entries(backgrounds)) {
    const ratio = contrastRatio(focusColor, background);
    assert.ok(ratio >= 3, `focus outline contrast on ${surface} is ${ratio.toFixed(2)}:1`);
  }
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
  assert.match(app, /focusRenderedView\(elements\.learningView, focusAfterRender\)/);
  assert.match(app, /addEventListener\(['"]hashchange['"],\s*\(\)\s*=>\s*renderRoute\(\{\s*focusAfterRender:\s*true\s*\}\)\)/);
  assert.doesNotMatch(app, /addEventListener\(['"]popstate['"]/);
  assert.match(app, /const feedback = createElement\(['"]div['"],\s*\{\s*attrs:\s*\{[^}]*['"]aria-live['"]:\s*['"]polite['"][^}]*tabindex:\s*['"]-1['"]/s);
  assert.doesNotMatch(app, /\beval\s*\(/);
  assert.doesNotMatch(app, /document\.write\s*\(/);
  assert.doesNotMatch(app, /\.innerHTML\s*=/, 'content must be rendered with DOM APIs, not innerHTML');
});

test('learning hub navigation exposes the personal study course', async () => {
  const html = await readRootFile('index.html');
  const navigation = html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? '';

  assert.match(
    navigation,
    /<a\b[^>]*href=["']study\/["'][^>]*>[^<]*개인\s*학습[^<]*<\/a>/i,
    'top navigation must link to the personal study course',
  );
});

test('learning hub hero distinguishes self-paced and instructor-led modes', async () => {
  const html = await readRootFile('index.html');
  const hero = html.match(/<header\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>[\s\S]*?<\/header>/i)?.[0] ?? '';

  assert.match(
    hero,
    /<a\b(?=[^>]*class=["'][^"']*\bprimary\b[^"']*["'])(?=[^>]*href=["']study\/["'])[^>]*>[^<]*개인\s*학습\s*시작[^<]*<\/a>/i,
    'hero primary action must start the five-day personal course',
  );
  assert.match(
    hero,
    /<a\b(?=[^>]*href=["']slides\/module1\.html["'])(?![^>]*class=["'][^"']*\bprimary\b)[^>]*>[^<]*(?:강의형|워크숍)[^<]*슬라이드[^<]*<\/a>/i,
    'hero secondary action must open the instructor-led slides',
  );
  assert.match(hero, /href=["']slides\/worksheet\.html["']/i, 'worksheet must remain reachable');
});

test('README documents the personal study app structure and browser storage behavior', async () => {
  const readme = await readRootFile('README.md');

  for (const file of ['study/index.html', 'styles.css', 'app.js', 'content.js', 'state.js']) {
    assert.ok(readme.includes(file), `README must document ${file}`);
  }

  assert.match(readme, /5일|5-day/i);
  assert.match(readme, /진도\s*(?:자동\s*)?저장/);
  assert.match(readme, /해설(?:형|이\s*제공되는)?\s*퀴즈/);
  assert.match(readme, /axpi-study-v1/);
  assert.match(readme, /로그인[^\n]*(?:없|불필요)|(?:없|불필요)[^\n]*로그인/);
  assert.match(readme, /서버[^\n]*(?:없|불필요)|(?:없|불필요)[^\n]*서버/);
  assert.match(readme, /브라우저[^\n]*(?:진도|저장)|(?:진도|저장)[^\n]*브라우저/);
  assert.match(readme, /(?:초기화|리셋)/);
});

test('hub metadata and hero consistently introduce both learning modes', async () => {
  const html = await readRootFile('index.html');
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const description = html.match(/<meta\b(?=[^>]*name=["']description["'])(?=[^>]*content=["']([^"']+)["'])[^>]*>/i)?.[1] ?? '';
  const hero = html.match(/<header\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>[\s\S]*?<\/header>/i)?.[0] ?? '';
  const eyebrow = visibleText(hero.match(/<[^>]*class=["'][^"']*\beyebrow\b[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/i)?.[0] ?? '');
  const summary = visibleText(hero.match(/<p\b[^>]*class=["'][^"']*\bsub\b[^"']*["'][^>]*>[\s\S]*?<\/p>/i)?.[0] ?? '');
  const chips = visibleText(hero.match(/<div\b[^>]*class=["'][^"']*\bchips\b[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0] ?? '');
  const footer = visibleText(html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? '');

  for (const [area, text] of Object.entries({ title, description, eyebrow, summary, chips, footer })) {
    assert.match(text, /5일/, `${area} must mention the five-day offering`);
    assert.match(text, /1일/, `${area} must mention the one-day offering`);
    assert.match(text, /개인\s*학습|자기\s*주도/, `${area} must identify the self-paced mode`);
    assert.match(text, /강의형|워크숍/, `${area} must identify the instructor-led mode`);
  }

  assert.match(visibleText(hero), /AX/);
  assert.match(visibleText(hero), /E2E/);
});

test('hub statistics represent both course offerings with accurate counts', async () => {
  const html = await readRootFile('index.html');
  const stats = visibleText(html.match(/<div\b[^>]*class=["'][^"']*\bstats\b[^"']*["'][^>]*>[\s\S]*?<\/header>/i)?.[0] ?? '');

  assert.match(stats, /2\s*(?:개\s*)?(?:학습\s*)?모드/);
  assert.match(stats, /20\s*(?:개\s*)?(?:개인\s*학습\s*)?(?:레슨|학습)/);
  assert.match(stats, /119\s*(?:장|개)?\s*(?:강의형\s*)?슬라이드/);
  assert.match(stats, /16\s*(?:개|문항)?\s*(?:해설형\s*)?퀴즈/);
});

test('README heading and introduction frame the project as two learning modes', async () => {
  const readme = await readRootFile('README.md');
  const heading = readme.match(/^#\s+(.+)$/m)?.[1] ?? '';
  const introduction = readme.match(/^#\s+.+\r?\n\r?\n([^\n]+)/)?.[1] ?? '';

  for (const [area, text] of Object.entries({ heading, introduction })) {
    assert.match(text, /5일/);
    assert.match(text, /1일/);
    assert.match(text, /개인\s*학습|자기\s*주도/);
    assert.match(text, /강의형|워크숍/);
  }
});
