# 메롱

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

## 조작

- **PC** — 방향키 · WASD 이동, 건물 앞에서 `Space`, `Enter` 로 채팅
- **모바일** — 가로로 눕히면 왼쪽 아래 조이스틱, 오른쪽 아래 들어가기 · 채팅 버튼.
  세로로 들면 "가로로 돌려주세요" 안내가 뜹니다. 화면이 낮으면 자동으로 축소해 시야를 확보해요.

## 테스트 입장 (Supabase)

회차(round)마다 **게스트 5명까지만** 입장할 수 있습니다. 정원이 차면 6번째 사람은 막힙니다.

- **호스트(나)는 정원에 포함되지 않습니다.** 입장 화면에서 "호스트로 입장하기"를 눌러 호스트 코드를 넣으면 됩니다.
- 호스트 화면 우측 상단 **🛠 테스트 관리 → 새 테스트 시작** 을 누르면 회차가 올라가고 자리 5개가 다시 비어요.
- 같은 기기에서 새로고침하면 자리를 새로 차지하지 않고 원래 자리로 돌아옵니다.
- **게임 진행은 저장되지 않습니다.** 새로고침하면 별과 위치가 초기화돼요.

자리 검사는 전부 Postgres 함수(`cc_join`)에서 하고, 테이블은 RLS 로 직접 접근을 막아뒀습니다.
브라우저 콘솔에서 코드를 고쳐도 6번째로는 못 들어옵니다.

### 새 환경에서 설정하기

1. `.env.example` 를 복사해 `.env.local` 을 만들고 값을 채웁니다.
2. Supabase 대시보드 → SQL Editor 에 `supabase/schema.sql` 을 붙여넣고 Run.
3. 배포용으로 저장소 Secrets 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 등록.

호스트 코드 기본값은 `cloudhost1234` 입니다. 바꾸려면:

```sql
update public.cc_config set host_code = '새코드' where id = 1;
update public.cc_config set capacity  = 8       where id = 1;  -- 정원 변경
```

publishable(anon) key 는 공개돼도 되는 값이지만, 그래서 **RLS 를 반드시 켜야** 합니다.
`service_role` 키는 프론트엔드에 절대 넣지 마세요.
