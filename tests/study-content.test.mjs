import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

const moduleUrl = new URL('../study/content.js', import.meta.url);

async function loadCourse() {
  try {
    await access(moduleUrl);
  } catch {
    assert.fail('study/content.js must exist and export the self-study course');
  }
  return (await import(moduleUrl.href)).course;
}

const textOf = (value) => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' ');
  return '';
};

const allowedBlockTypes = new Set([
  'paragraph', 'heading', 'callout', 'compare', 'steps',
  'table', 'formula', 'flow', 'checklist',
]);

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertStringArray(value, minimum, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  assert.ok(value.length >= minimum, `${label} must contain at least ${minimum} items`);
  value.forEach((item, index) => assertNonEmptyString(item, `${label}[${index}]`));
}

function assertValidBlock(block, label) {
  assert.ok(block && typeof block === 'object', `${label} must be an object`);
  assert.ok(allowedBlockTypes.has(block.type), `${label} has unsupported type ${block.type}`);

  if (block.type === 'paragraph' || block.type === 'heading') {
    assertNonEmptyString(block.text, `${label}.text`);
  } else if (block.type === 'callout') {
    assertNonEmptyString(block.tone, `${label}.tone`);
    assertNonEmptyString(block.title, `${label}.title`);
    assertNonEmptyString(block.text, `${label}.text`);
  } else if (block.type === 'compare') {
    for (const side of ['left', 'right']) {
      assert.ok(block[side] && typeof block[side] === 'object', `${label}.${side} is required`);
      assertNonEmptyString(block[side].title, `${label}.${side}.title`);
      assertStringArray(block[side].items, 1, `${label}.${side}.items`);
    }
  } else if (block.type === 'steps' || block.type === 'flow' || block.type === 'checklist') {
    assertStringArray(block.items, 1, `${label}.items`);
  } else if (block.type === 'table') {
    assertStringArray(block.headers, 1, `${label}.headers`);
    assert.ok(Array.isArray(block.rows) && block.rows.length > 0, `${label}.rows must not be empty`);
    block.rows.forEach((row, rowIndex) => {
      assert.ok(Array.isArray(row), `${label}.rows[${rowIndex}] must be an array`);
      assert.equal(row.length, block.headers.length, `${label}.rows[${rowIndex}] must match headers`);
      row.forEach((cell, cellIndex) => assertNonEmptyString(cell, `${label}.rows[${rowIndex}][${cellIndex}]`));
    });
  } else if (block.type === 'formula') {
    assertNonEmptyString(block.expression, `${label}.expression`);
    assertNonEmptyString(block.explanation, `${label}.explanation`);
  }
}

test('exports a complete five-day course shell', async () => {
  const course = await loadCourse();
  assert.ok(course && typeof course === 'object');
  for (const field of ['id', 'title', 'subtitle', 'description']) {
    assertNonEmptyString(course[field], `course.${field}`);
  }
  assert.equal(course.totalDays, 5);
  assert.ok(Array.isArray(course.days));
  assert.equal(course.days.length, 5);
});

test('each day follows the individual-study schema and optional practice stays optional', async () => {
  const { days } = await loadCourse();
  days.forEach((day, dayIndex) => {
    const number = dayIndex + 1;
    assert.equal(day.id, `day${number}`);
    assert.equal(day.dayNumber, number);
    assertNonEmptyString(day.title, `${day.id}.title`);
    assertNonEmptyString(day.subtitle, `${day.id}.subtitle`);
    assert.ok(Number.isInteger(day.estimatedMinutes));
    assert.ok(day.estimatedMinutes >= 45 && day.estimatedMinutes <= 70);
    assertStringArray(day.objectives, 3, `${day.id}.objectives`);
    assert.ok(Array.isArray(day.lessons) && day.lessons.length >= 4);
    assert.ok(Array.isArray(day.quiz) && day.quiz.length >= 3);
    assertStringArray(day.summary, 3, `${day.id}.summary`);
    assert.ok(day.optionalPractice && typeof day.optionalPractice === 'object');
    assertNonEmptyString(day.optionalPractice.title, `${day.id}.optionalPractice.title`);
    assertNonEmptyString(day.optionalPractice.description, `${day.id}.optionalPractice.description`);
    assert.match(day.optionalPractice.description, /선택|선택형|필수.*아니|완료.*무관/);
    assertStringArray(day.optionalPractice.prompts, 1, `${day.id}.optionalPractice.prompts`);
  });
});

test('lessons have canonical unique IDs, explicit blocks, and enough prose for solo study', async () => {
  const { days } = await loadCourse();
  const ids = [];
  days.forEach((day) => {
    day.lessons.forEach((lesson, lessonIndex) => {
      const label = `${day.id}.lessons[${lessonIndex}]`;
      assert.equal(lesson.id, `d${day.dayNumber}l${lessonIndex + 1}`);
      ids.push(lesson.id);
      assertNonEmptyString(lesson.title, `${label}.title`);
      assertNonEmptyString(lesson.kicker, `${label}.kicker`);
      assert.ok(Number.isInteger(lesson.estimatedMinutes) && lesson.estimatedMinutes >= 5);
      assertNonEmptyString(lesson.intro, `${label}.intro`);
      assert.ok(lesson.intro.length >= 100, `${label}.intro must be substantial explanatory prose`);
      assert.ok(Array.isArray(lesson.blocks) && lesson.blocks.length >= 3);
      lesson.blocks.forEach((block, index) => assertValidBlock(block, `${label}.blocks[${index}]`));
      assertNonEmptyString(lesson.takeaway, `${label}.takeaway`);
      const prose = textOf({ intro: lesson.intro, blocks: lesson.blocks, takeaway: lesson.takeaway });
      assert.ok(prose.length >= 350, `${label} needs at least 350 text characters, found ${prose.length}`);
      assert.doesNotMatch(prose, /<\/?[a-z][^>]*>/i, `${label} must not contain raw HTML`);
    });
  });
  assert.equal(new Set(ids).size, ids.length, 'lesson IDs must be globally unique');
});

test('quizzes have unique IDs, four choices, valid answers, and teaching explanations', async () => {
  const { days } = await loadCourse();
  const ids = [];
  days.forEach((day) => day.quiz.forEach((quiz, index) => {
    const label = `${day.id}.quiz[${index}]`;
    assertNonEmptyString(quiz.id, `${label}.id`);
    ids.push(quiz.id);
    assertNonEmptyString(quiz.question, `${label}.question`);
    assertStringArray(quiz.options, 4, `${label}.options`);
    assert.equal(quiz.options.length, 4);
    const normalizedOptions = quiz.options.map((option) => option.trim());
    assert.equal(
      new Set(normalizedOptions).size,
      normalizedOptions.length,
      `${label}.options must be unique after trimming`,
    );
    assert.ok(Number.isInteger(quiz.answer) && quiz.answer >= 0 && quiz.answer <= 3);
    assertNonEmptyString(quiz.explanation, `${label}.explanation`);
    assert.ok(quiz.explanation.length >= 80, `${label}.explanation must teach the reasoning`);
  }));
  assert.equal(new Set(ids).size, ids.length, 'quiz IDs must be globally unique');
});

test('the five days cover the required AX and E2E Process Innovation concepts', async () => {
  const { days } = await loadCourse();
  const dayText = days.map(textOf);
  const coverage = [
    [/AX|AI Transformation/, /DX/, /프로세스 우선|process.first/i, /cowpath|소길/, /성숙도/],
    [/E2E|End.to.End|엔드투엔드/i, /가치.?흐름|value stream/i, /SIPOC/, /VSM/, /8대 낭비|여덟 가지 낭비/, /Lead Time|리드타임/i, /Cycle Time|사이클타임/i, /Touch Time|터치타임/i, /%STP|STP/, /병목/],
    [/ECRS\+A/, /Eliminate|제거/, /Combine|결합/, /Rearrange|재배열/, /Simplify|단순화/, /Automate|자동화/, /2.?x.?2|2×2/, /HITL/, /다섯 가지 에이전틱|5가지 에이전틱/, /가드레일/, /데이터 전제|데이터.*전제/],
    [/후보.*문장|candidate statement/i, /ICE/, /Impact|임팩트/, /Ease|용이성/, /TCO/, /ROI/, /회수기간|payback/i, /2.?x.?2|2×2/, /원.?페이지.*비즈니스 케이스/],
    [/6주|6-week/i, /좁고 깊|narrow.*deep/i, /성공 기준/, /중단 기준|kill criteria/i, /CoE/, /플랫폼/, /AI 거버넌스/, /책임.*AI|Responsible AI/i, /ADKAR/, /KPI.*대시보드/],
  ];
  coverage.forEach((patterns, index) => patterns.forEach((pattern) => {
    assert.match(dayText[index], pattern, `day${index + 1} is missing coverage for ${pattern}`);
  }));
});

test('numeric cases are labeled as educational examples', async () => {
  const { days } = await loadCourse();
  const caseText = textOf(days);
  assert.match(caseText, /교육용 예시/);
  assert.match(dayTextFor(days[3]), /교육용 예시|예시/);
});

test('the Day 4 worked example explicitly calculates a numeric payback period', async () => {
  const { days } = await loadCourse();
  const lesson = days[3].lessons.find(({ id }) => id === 'd4l3');
  assert.ok(lesson, 'Day 4 must contain the Benefit, TCO, ROI, and payback lesson');

  const payback = lesson.blocks.find(({ type, expression = '' }) => (
    type === 'formula' && /회수기간/.test(expression)
  ));
  assert.ok(payback, 'the worked example needs a dedicated payback formula block');
  const workedExample = `${payback.expression} ${payback.explanation}`.replaceAll(',', '');
  assert.match(workedExample, /연간 순편익[^.]*9000만원[^.]*2000만원[^.]*7000만원/);
  assert.match(workedExample, /월 순편익[^.]*583만원/);
  assert.match(workedExample, /초기 (?:투자|비용)[^.]*4000만원/);
  const monthValues = [...workedExample.matchAll(/(\d+(?:\.\d+)?)개월/g)]
    .map((match) => Number(match[1]));
  const paybackMonths = monthValues.find((months) => months >= 6.8 && months <= 7);
  assert.ok(
    paybackMonths,
    `the example must state a numeric payback result near 6.9 months, found ${monthValues.join(', ')}`,
  );
  assert.match(workedExample, /교육용 예시/);
});

test('the Day 5 quality KPI raises accuracy while lowering return or rejection rate', async () => {
  const { days } = await loadCourse();
  const lesson = days[4].lessons.find(({ id }) => id === 'd5l2');
  const criteriaTable = lesson?.blocks.find(({ type, headers = [] }) => (
    type === 'table' && headers.includes('성공 기준 교육용 예시')
  ));
  assert.ok(criteriaTable, 'Day 5 must contain the pilot success and kill criteria table');
  const qualityRow = criteriaTable.rows.find(([category]) => category === '품질');
  assert.ok(qualityRow, 'the criteria table must contain a quality row');
  const successCriterion = qualityRow[1];
  assert.match(successCriterion, /정확도.{0,12}(?:목표|기준선).{0,5}(?:이상|상회)/);
  assert.match(successCriterion, /(?:반송률|반려율|거절률).{0,12}(?:목표|기준선).{0,5}(?:이하|하회)/);
});

function dayTextFor(day) {
  return textOf(day);
}
