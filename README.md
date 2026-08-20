# testgame

Vite + React 로 만드는 게임/인터랙티브 사이트.

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성
npm run preview  # 빌드 결과 미리보기
```

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가
빌드해서 GitHub Pages로 올립니다.

```bash
git add -A
git commit -m "변경 내용"
git push
```

`vite.config.js` 의 `base` 는 저장소 이름(`/testgame/`)과 같아야 합니다.
저장소 이름을 바꾸면 `base` 도 같이 바꿔주세요.

## 세이브 (Supabase)

별 수집 상태와 위치를 저장합니다. 저장은 두 겹이에요.

- **이 기기** — localStorage. 서버가 없어도 항상 동작합니다.
- **서버** — Supabase `cc_saves` 테이블. 익명 로그인으로 브라우저마다 계정이 하나 생기고,
  RLS 로 자기 계정 것만 읽고 쓸 수 있습니다.

좌측 상단 💾 표시가 `서버까지 저장`이면 정상, `이 기기에만 저장`이면 서버 연결이 안 된 상태입니다.

### 새 환경에서 설정하기

1. `.env.example` 를 복사해 `.env.local` 을 만들고 값을 채웁니다.
2. Supabase 대시보드 → SQL Editor 에 `supabase/schema.sql` 을 붙여넣고 Run.
3. Authentication → Providers → **Anonymous sign-ins** 를 켭니다.
4. 배포용으로 저장소 Secrets 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록.

publishable(anon) key 는 공개돼도 되는 값이지만, 그래서 **RLS 를 반드시 켜야** 합니다.
`service_role` 키는 프론트엔드에 절대 넣지 마세요.
