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
