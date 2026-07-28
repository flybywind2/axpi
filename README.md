# AX 도입 × E2E 워크플로우 재설계 — Process Innovation 1일 과정

AX(AI Transformation) 도입 관점에서 End-to-End 워크플로우를 재설계하고 프로세스 혁신을 실행하는 방법을 배우는 정적 학습 사이트입니다. **5일 개인 학습 코스**와 [reveal.js](https://revealjs.com/) 기반 **1일 강의형 슬라이드**를 함께 제공하며, GitHub Pages에 그대로 배포할 수 있습니다.

## 구성

```text
├── index.html              # 코스 허브 (아젠다 · 모듈 바로가기 · 학습 가이드)
├── study/index.html        # 5일 개인 학습 앱 진입점
├── study/styles.css        # 개인 학습 앱 반응형 스타일
├── study/app.js            # 화면 렌더링 · 진도 저장 · 퀴즈 동작
├── study/content.js        # 5일 학습 콘텐츠와 해설형 퀴즈
├── study/state.js          # 진도 계산과 학습 상태 정규화
├── slides/
│   ├── module1.html        # Session 1 · AX와 프로세스 혁신 패러다임 (80분)
│   ├── module2.html        # Session 2 · E2E 워크플로우 As-Is 진단 (80분)
│   ├── module3.html        # Session 3 · To-Be 워크플로우 재설계 방법론 (80분)
│   ├── module4.html        # Session 4 · 우선순위화와 비즈니스 케이스 (80분)
│   ├── module5.html        # Session 5 · 실행 로드맵과 변화관리 (70분)
│   ├── module6.html        # Session 6 · 랩업과 실행 계획 (40분)
│   └── worksheet.html      # 인쇄용 실습 워크시트 A~F
├── assets/
│   ├── css/custom.css      # 슬라이드 공통 테마
│   ├── css/site.css        # 허브 페이지 스타일
│   └── img/favicon.svg
└── .nojekyll               # GitHub Pages 정적 서빙 설정
```

## 두 가지 학습 모드

- **개인 학습** (`study/`): 5일 동안 개념을 읽고 해설형 퀴즈를 풀 수 있습니다. 마지막 학습 위치, 완료한 레슨, 퀴즈 최고 점수는 브라우저 `localStorage`의 `axpi-study-v1` 키에 자동으로 진도 저장됩니다.
- **강의형 슬라이드** (`slides/module1.html`): 퍼실리테이터와 함께 하루 워크숍으로 진행하는 reveal.js 슬라이드와 인쇄용 워크시트입니다.

개인 학습에는 로그인과 서버가 없습니다. 진도는 사용 중인 브라우저에만 보관되므로 다른 브라우저나 기기와 동기화되지 않으며, 개인 학습 화면의 **학습 기록 초기화**에서 언제든 해당 브라우저의 진도와 점수를 초기화할 수 있습니다.

## 로컬에서 보기

```powershell
# 저장소 루트에서
python -m http.server 8000
# 코스 허브: http://localhost:8000
# 개인 학습: http://localhost:8000/study/
```

> reveal.js·폰트는 CDN(jsDelivr)에서 불러오므로 인터넷 연결이 필요합니다.

## GitHub Pages 배포

1. 저장소를 생성하고 푸시합니다.

   ```powershell
   gh repo create axpi --public --source=. --push
   ```

2. GitHub 웹에서 **Settings → Pages → Build and deployment**로 이동해
   Source를 **Deploy from a branch**, Branch를 **`main` / `/ (root)`**로 선택합니다.

   또는 CLI로:

   ```powershell
   gh api repos/{owner}/axpi/pages -X POST -f "source[branch]=main" -f "source[path]=/"
   ```

3. 수 분 뒤 `https://{owner}.github.io/axpi/` 에서 코스 허브가 열립니다. 개인 학습은 `https://{owner}.github.io/axpi/study/`에서 바로 시작할 수도 있습니다.

## 슬라이드 조작

| 키 | 동작 |
| --- | --- |
| `→` / `←` | 다음 / 이전 슬라이드 |
| `ESC` | 전체 개요 |
| `F` | 전체 화면 |
| `S` | 발표자 노트 |
| `B` | 화면 일시 정지 |

## 콘텐츠 수정

- 각 모듈은 독립된 HTML이라 `slides/moduleN.html`의 `<section>` 블록을 편집하면 됩니다.
- 테마(색상·폰트·카드/테이블 스타일)는 `assets/css/custom.css`에 모여 있습니다.
- 모든 사례 수치는 교육용 예시입니다. 실제 데이터로 교체해 사용하세요.

## 라이선스

교육 목적으로 자유롭게 수정·재배포할 수 있습니다.
