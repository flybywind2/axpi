const DEFAULT_LOCATION = { dayId: 'day1', lessonId: 'd1l1' };

function isValidId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueValidIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter(isValidId).map((value) => value.trim()))];
}

export function createInitialState() {
  return {
    completedLessons: [],
    lastLocation: { ...DEFAULT_LOCATION },
    quizScores: {},
  };
}

export function calculateProgress(completedLessons, totalLessons) {
  if (!Number.isFinite(totalLessons) || totalLessons <= 0) return 0;

  const completedCount = uniqueValidIds(completedLessons).length;
  return Math.min(100, Math.round((completedCount / totalLessons) * 100));
}

export function gradeQuiz(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { score: 0, results: [] };
  }

  const submittedAnswers = Array.isArray(answers) ? answers : [];
  const results = Array.from({ length: questions.length }, (_, index) => {
    const question = questions[index];
    return (
      question !== null
      && typeof question === 'object'
      && Object.hasOwn(question, 'answer')
      && index < submittedAnswers.length
      && submittedAnswers[index] === question.answer
    );
  });
  const correctCount = results.filter(Boolean).length;

  return {
    score: Math.round((correctCount / questions.length) * 100),
    results,
  };
}

export function normalizeState(value) {
  const defaults = createInitialState();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const lastLocation = value.lastLocation;
  const hasValidLocation = (
    lastLocation !== null
    && typeof lastLocation === 'object'
    && !Array.isArray(lastLocation)
    && isValidId(lastLocation.dayId)
    && isValidId(lastLocation.lessonId)
  );

  const quizScores = {};
  if (value.quizScores !== null && typeof value.quizScores === 'object' && !Array.isArray(value.quizScores)) {
    for (const [quizId, score] of Object.entries(value.quizScores)) {
      if (isValidId(quizId) && Number.isInteger(score) && score >= 0 && score <= 100) {
        quizScores[quizId] = score;
      }
    }
  }

  return {
    completedLessons: uniqueValidIds(value.completedLessons),
    lastLocation: hasValidLocation
      ? { dayId: lastLocation.dayId, lessonId: lastLocation.lessonId }
      : defaults.lastLocation,
    quizScores,
  };
}
