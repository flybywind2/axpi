import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateProgress,
  createInitialState,
  gradeQuiz,
  normalizeState,
} from '../study/state.js';

test('createInitialState returns a fresh default learning state', () => {
  const first = createInitialState();
  const second = createInitialState();

  assert.deepEqual(first, {
    completedLessons: [],
    lastLocation: { dayId: 'day1', lessonId: 'd1l1' },
    quizScores: {},
  });
  assert.notStrictEqual(first.completedLessons, second.completedLessons);
  assert.notStrictEqual(first.lastLocation, second.lastLocation);
  assert.notStrictEqual(first.quizScores, second.quizScores);
});

test('calculateProgress counts unique valid lesson IDs', () => {
  assert.equal(calculateProgress(['d1l1', 'd1l1', 'd1l2'], 10), 20);
  assert.equal(calculateProgress(['d1l1', '', null, 12, 'd2l3'], 4), 50);
});

test('calculateProgress safely handles invalid totals and input', () => {
  assert.equal(calculateProgress(['d1l1'], 0), 0);
  assert.equal(calculateProgress(['d1l1'], -1), 0);
  assert.equal(calculateProgress(['d1l1'], Number.NaN), 0);
  assert.equal(calculateProgress(null, 10), 0);
});

test('gradeQuiz returns an integer percentage and per-question results', () => {
  assert.deepEqual(
    gradeQuiz([{ answer: 1 }, { answer: 0 }], [1, 1]),
    { score: 50, results: [true, false] },
  );
});

test('gradeQuiz safely treats missing answers as incorrect', () => {
  assert.deepEqual(
    gradeQuiz([{ answer: 'a' }, { answer: 'b' }, { answer: 'c' }], ['a']),
    { score: 33, results: [true, false, false] },
  );
  assert.deepEqual(gradeQuiz([], []), { score: 0, results: [] });
  assert.deepEqual(gradeQuiz(null, null), { score: 0, results: [] });
});

test('normalizeState preserves valid stored learning state', () => {
  assert.deepEqual(
    normalizeState({
      completedLessons: ['d1l1', 'd1l1', 'd2l3', '', null],
      lastLocation: { dayId: 'day2', lessonId: 'd2l3' },
      quizScores: { day1: 80, day2: 100 },
    }),
    {
      completedLessons: ['d1l1', 'd2l3'],
      lastLocation: { dayId: 'day2', lessonId: 'd2l3' },
      quizScores: { day1: 80, day2: 100 },
    },
  );
});

test('normalizeState falls back malformed fields independently', () => {
  assert.deepEqual(
    normalizeState({
      completedLessons: 'd1l1',
      lastLocation: { dayId: '', lessonId: 1 },
      quizScores: { day1: 90, day2: '100', day3: Number.NaN },
    }),
    {
      completedLessons: [],
      lastLocation: { dayId: 'day1', lessonId: 'd1l1' },
      quizScores: { day1: 90 },
    },
  );
  assert.deepEqual(normalizeState(null), createInitialState());
});
