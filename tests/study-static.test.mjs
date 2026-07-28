import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readStudyFile = (name) => readFile(new URL(`../study/${name}`, import.meta.url), 'utf8');

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
