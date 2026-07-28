# AX 자기주도 학습 앱 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/axpi/study/`에 5일 개념 중심 자기주도 학습 앱을 추가하고, 진도·퀴즈 결과·마지막 위치를 브라우저에 저장한다.

**Architecture:** 빌드 과정 없는 정적 단일 페이지 앱으로 구현한다. 콘텐츠(`content.js`)와 상태·렌더링 로직(`app.js`)을 분리하고, 순수 상태 함수는 Node 기본 테스트 러너로 검증한다. GitHub Pages의 기존 루트 배포 구조를 유지한다.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript ES modules, Web Storage API, Node.js `node:test`, Playwright CLI, GitHub Pages

---

### Task 1: 학습 상태 모델과 테스트 기반 구축

**Files:**
- Create: `study/state.js`
- Create: `tests/study-state.test.mjs`

**Step 1: Write the failing test**

`tests/study-state.test.mjs`에 다음 동작을 검증한다.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, normalizeState, calculateProgress, gradeQuiz } from '../study/state.js';

test('initial state starts at day 1 lesson 1 with zero progress', () => {
  const state = createInitialState();
  assert.deepEqual(state.completedLessons, []);
  assert.deepEqual(state.lastLocation, { dayId: 'day1', lessonId: 'd1l1' });
});

test('progress counts unique completed lessons', () => {
  assert.equal(calculateProgress(['d1l1', 'd1l1', 'd1l2'], 10), 20);
});

test('quiz grading returns score and per-question correctness', () => {
  const result = gradeQuiz([{ answer: 1 }, { answer: 0 }], [1, 1]);
  assert.equal(result.score, 50);
  assert.deepEqual(result.results, [true, false]);
});

test('malformed stored state falls back safely', () => {
  assert.deepEqual(normalizeState(null).completedLessons, []);
  assert.deepEqual(normalizeState({ completedLessons: 'bad' }).completedLessons, []);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/study-state.test.mjs`

Expected: FAIL because `study/state.js` does not exist.

**Step 3: Write minimal implementation**

`study/state.js`에 초기 상태 생성, 저장 상태 정규화, 중복 없는 진도율 계산, 퀴즈 채점 함수를 구현한다. `normalizeState`는 잘못된 배열·위치·점수 값을 기본값으로 복구한다.

**Step 4: Run test to verify it passes**

Run: `node --test tests/study-state.test.mjs`

Expected: 4 tests pass, 0 fail.

**Step 5: Commit**

```powershell
git add study/state.js tests/study-state.test.mjs
git commit -m "test: define self-study progress behavior"
```

### Task 2: 5일 학습 콘텐츠 작성

**Files:**
- Create: `study/content.js`
- Create: `tests/study-content.test.mjs`

**Step 1: Write the failing test**

콘텐츠가 정확히 5일이고, 각 Day에 3개 이상의 레슨, 3개 이상의 퀴즈, 요약과 선택 실습이 있으며 ID가 전체에서 고유한지 검사한다.

```js
test('course contains five complete days with unique lesson ids', () => {
  assert.equal(course.days.length, 5);
  const ids = course.days.flatMap(day => day.lessons.map(lesson => lesson.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const day of course.days) {
    assert.ok(day.lessons.length >= 3);
    assert.ok(day.quiz.length >= 3);
    assert.ok(day.summary.length >= 3);
    assert.ok(day.optionalPractice);
  }
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/study-content.test.mjs`

Expected: FAIL because `study/content.js` does not exist.

**Step 3: Write minimal implementation**

`study/content.js`에 다음 5일 콘텐츠를 작성한다.

- Day 1: AX의 정의, DX와 차이, PI 선행 이유, 성숙도
- Day 2: E2E 가치흐름, SIPOC/VSM, 8대 낭비, 핵심 지표
- Day 3: ECRS+A, 인간-AI 역할 매트릭스, HITL, 에이전틱 패턴
- Day 4: ICE, 가치와 실행 용이성, ROI/TCO, 비즈니스 케이스
- Day 5: 6주 파일럿, 성공·중단 기준, 거버넌스, ADKAR

각 레슨은 강의 없이도 이해되는 설명, 개념 도표 데이터, 예시, 핵심 문장으로 구성한다. 퀴즈 선택지에는 정답 인덱스와 해설을 포함한다.

**Step 4: Run test to verify it passes**

Run: `node --test tests/study-content.test.mjs`

Expected: all content schema tests pass.

**Step 5: Commit**

```powershell
git add study/content.js tests/study-content.test.mjs
git commit -m "feat: add five-day AX self-study curriculum"
```

### Task 3: 학습 앱 화면과 상호작용 구현

**Files:**
- Create: `study/index.html`
- Create: `study/styles.css`
- Create: `study/app.js`
- Create: `tests/study-static.test.mjs`

**Step 1: Write the failing test**

정적 페이지에 접근성 구조, 진도 표시, 이어보기, 일자별 내비게이션, 학습 본문, 퀴즈, 초기화 컨트롤과 ES module 엔트리가 있는지 검사한다.

```js
test('study page exposes required learning app landmarks', async () => {
  const html = await readFile(new URL('../study/index.html', import.meta.url), 'utf8');
  for (const token of ['id="course-progress"', 'id="continue-button"', 'id="day-navigation"', 'id="lesson-content"', 'id="quiz-panel"', 'id="reset-progress"']) {
    assert.ok(html.includes(token), token);
  }
  assert.ok(html.includes('type="module"'));
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/study-static.test.mjs`

Expected: FAIL because the study page does not exist.

**Step 3: Write minimal implementation**

- `study/index.html`: 앱 셸, 학습 홈, 사이드바, 본문, 퀴즈, 초기화 확인 대화상자
- `study/styles.css`: 기존 남색·보라·파랑·시안 테마 계승, 긴 글 가독성, 반응형 레이아웃, 포커스 스타일
- `study/app.js`: URL hash 기반 레슨 이동, localStorage 저장·복구, 완료 처리, 퀴즈 채점·해설, Day 완료, 이어보기, 초기화
- 실습은 `<details>`로 접고 완료 조건에서 제외

**Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass, 0 fail.

**Step 5: Commit**

```powershell
git add study/index.html study/styles.css study/app.js tests/study-static.test.mjs
git commit -m "feat: build self-paced AX learning experience"
```

### Task 4: 기존 허브에서 개인 학습 앱 연결

**Files:**
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/study-static.test.mjs`

**Step 1: Write the failing test**

기존 `index.html`에 `study/` 링크와 `개인 학습` 안내가 있는지 테스트한다.

**Step 2: Run test to verify it fails**

Run: `node --test tests/study-static.test.mjs`

Expected: FAIL because the hub lacks the study link.

**Step 3: Write minimal implementation**

허브 Hero에 `개인 학습 시작` 버튼을 추가하고 기존 강의형 버튼을 구분한다. README에 `/study/` 구조와 진도 저장 방식을 설명한다.

**Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

**Step 5: Commit**

```powershell
git add index.html README.md tests/study-static.test.mjs
git commit -m "docs: link self-study course from learning hub"
```

### Task 5: 브라우저 검증과 배포

**Files:**
- Create (ignored artifacts): `output/playwright/`
- Modify if required by QA: `study/styles.css`, `study/app.js`, `study/index.html`

**Step 1: Verify the complete automated suite**

Run: `node --test tests/*.test.mjs`

Expected: 0 failures.

**Step 2: Verify browser prerequisites**

Run: `Get-Command npx; npx --yes playwright --version`

Expected: both commands succeed.

**Step 3: Exercise the learning flow**

Playwright CLI로 다음을 확인한다.

1. `/study/` 첫 진입 시 0%와 Day 1 시작 버튼
2. 레슨 완료 후 진행률 증가
3. 퀴즈 오답·정답 해설 표시와 점수 저장
4. 새로고침 후 마지막 위치·진도 복원
5. 진도 초기화 후 0% 복귀

**Step 4: Visual QA**

데스크톱 1440×900과 모바일 390×844에서 홈·본문·퀴즈 화면을 캡처한다. 겹침, 잘림, 과도한 줄 길이, 터치 영역을 점검하고 필요 시 수정 후 테스트를 다시 실행한다.

**Step 5: Final verification and deploy**

```powershell
git diff --check
node --test tests/*.test.mjs
git status --short
git push origin main
```

GitHub Pages 빌드 완료 후 다음 URL이 HTTP 200인지 확인한다.

- `https://flybywind2.github.io/axpi/study/`
- `https://flybywind2.github.io/axpi/study/app.js`
- `https://flybywind2.github.io/axpi/study/content.js`

**Step 6: Commit any QA fixes**

```powershell
git add study index.html README.md tests
git commit -m "fix: polish self-study app after browser QA"
```
