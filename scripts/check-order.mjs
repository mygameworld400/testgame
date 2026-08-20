/* 렌더 중 "선언보다 먼저 쓰이는 값"을 찾습니다.
   이런 코드는 빌드는 통과하지만 실행하면 흰 화면이 됩니다
   (Cannot access 'x' before initialization). */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
let bad = 0;

for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  const decl = {};
  lines.forEach((l, i) => {
    const m = l.match(/^\s{2}const \{?\s*(\w+)/);        // 컴포넌트 본문 선언
    if (m && decl[m[1]] === undefined) decl[m[1]] = i + 1;
  });
  lines.forEach((l, i) => {
    const d = l.match(/^\s*\}, \[([^\]]*)\]\);/);          // 훅 의존성 배열
    if (!d) return;
    d[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((n) => {
        if (decl[n] && decl[n] > i + 1) {
          console.log(`${f}:${i + 1}  '${n}' 을 ${decl[n]}줄 선언보다 먼저 사용`);
          bad++;
        }
      });
  });
}

console.log(bad ? `실패 — ${bad}건` : "선언 순서 이상 없음");
process.exit(bad ? 1 : 0);
