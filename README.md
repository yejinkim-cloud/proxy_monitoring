# Evomi Proxy Monitor

Evomi proxy 잔여 대역폭을 모니터링해 Slack으로 보내는 Node.js 스크립트.

매 실행 시 현재 잔여량을 조회하고, 이전 실행 시점의 잔여량과 비교해 6시간 사용량을 계산합니다.

## 메시지 형식

```
[Evomi Proxy Monitor]

Current Balance: 132.7 GB
Last 6 Hours Usage: 2.3 GB  (09:00 → 15:00 KST)
```

첫 실행 시:

```
[Evomi Proxy Monitor]

Current Balance: 132.7 GB
Last 6 Hours Usage: N/A (first run)
```

---

## 동작 방식

| 항목 | 방식 |
|---|---|
| Current Balance | Evomi API (`GET https://api.evomi.com/public`, `balance_mb` 합산 후 GB 변환) |
| Last 6 Hours Usage | `이전 실행 잔여량 - 현재 잔여량` (룰 기반 계산) |

이전 잔여량은 `data/state.json`에 저장되며, GitHub Actions에서는 `actions/cache`로 실행 간 유지됩니다.

---

## 환경변수

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

| 변수 | 용도 |
|---|---|
| `EVOMI_API_KEY` | Evomi REST API 키 (`my.evomi.com/settings/api`에서 발급) |
| `SLACK_WEBHOOK_URL` | 정기 알림용 Incoming Webhook URL |
| `SLACK_BOT_TOKEN` | 슬래시 커맨드 서버 전용 (`xoxb-…`) |
| `SLACK_SIGNING_SECRET` | 슬래시 커맨드 서버 전용 (Slack 앱 서명 시크릿) |
| `PORT` | 슬래시 커맨드 서버 포트 (기본값: `3000`) |

> GitHub Actions에는 `EVOMI_API_KEY`와 `SLACK_WEBHOOK_URL`만 Secrets로 등록하면 됩니다.
> `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`은 `src/server.js`를 실행할 때만 필요합니다.

---

## 프로젝트 구조

```
.
├── .env.example
├── .github/
│   └── workflows/
│       └── evomi-monitor.yml   # GitHub Actions 스케줄
├── data/
│   └── state.json              # 이전 실행 잔여량 스냅샷 (git 제외, Actions cache로 유지)
├── package.json
├── README.md
└── src/
    ├── evomi.js    # Evomi API 호출 (잔여량 조회)
    ├── state.js    # state.json 읽기/쓰기
    ├── format.js   # 메시지 포맷 생성 (순수 함수)
    ├── slack.js    # Slack webhook 전송 / 슬래시 커맨드 응답
    ├── index.js    # 정기 실행 진입점
    └── server.js   # Slack 슬래시 커맨드 서버
```

---

## 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 편집 후 EVOMI_API_KEY, SLACK_WEBHOOK_URL 입력

# 3. 실행 (현재 잔여량 조회 + Slack 전송)
npm run monitor
```

두 번 실행하면 첫 번째 실행 결과를 기준으로 사용량이 계산됩니다.

---

## GitHub Actions 스케줄

워크플로우: `.github/workflows/evomi-monitor.yml`

| 서울 시간 (KST, UTC+9) | UTC cron |
|---|---|
| 09:00 | `0 0 * * *` |
| 15:00 | `0 6 * * *` |
| 21:00 | `0 12 * * *` |

### 설정 방법

1. 레포지토리를 GitHub에 push
2. **Settings → Secrets and variables → Actions**에서 시크릿 추가:
   - `EVOMI_API_KEY`
   - `SLACK_WEBHOOK_URL`
3. 다음 스케줄 트리거부터 자동 실행

**수동 실행**: Actions → Evomi Proxy Monitor → Run workflow

### 상태 유지 방식

`actions/cache`가 `data/state.json`을 실행 간 보존합니다.

```yaml
- uses: actions/cache@v4
  with:
    path: data/state.json
    key: evomi-state-${{ github.run_id }}
    restore-keys: |
      evomi-state-
```

- `restore-keys: evomi-state-`는 항상 가장 최근 캐시를 불러옵니다
- 실행 완료 후 새 run_id로 캐시가 저장됩니다

---

## Slack 슬래시 커맨드 설정

슬래시 커맨드 서버(`src/server.js`)는 인터넷에서 접근 가능한 서버가 필요합니다.
(Railway, Render, Fly.io 등 PaaS 또는 ngrok으로 로컬 테스트 가능)

### 1. Slack 앱 생성

1. [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**
2. 앱 이름 입력 후 워크스페이스 선택

### 2. 슬래시 커맨드 등록

**Slash Commands → Create New Command**

| 항목 | 값 |
|---|---|
| Command | `/evomi-monitor` |
| Request URL | `https://your-server.example.com/slack/events` |
| Short Description | Show current Evomi proxy balance |

### 3. OAuth 권한

**OAuth & Permissions → Bot Token Scopes** → `chat:write` 추가

### 4. 앱 설치 및 토큰 복사

**OAuth & Permissions → Install to Workspace** 후:
- **Bot User OAuth Token** → `SLACK_BOT_TOKEN`
- **Basic Information → Signing Secret** → `SLACK_SIGNING_SECRET`

### 5. 서버 실행

```bash
npm start
# 슬래시 커맨드 엔드포인트: POST /slack/events
# 헬스체크: GET /health
```
