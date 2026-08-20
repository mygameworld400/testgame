/* ===========================================================
   픽셀 스프라이트
   문자 그림(픽셀맵) + 팔레트로 정의하고, 캔버스로 한 번 구워서
   data URL 로 씁니다. 화면에는 image-rendering:pixelated 로 그려요.
   =========================================================== */

/* ---------- 캐릭터 (14 x 16) ----------
   o 외곽선 · s 몸 · e 귀 안쪽 · p 볼 · k 눈/입 · c 옷 · y 장식 */

const BODY = [
  "....oooooo....",
  "..oossssssoo..",
  ".osssssssssso.",
  ".osssssssssso.",
  ".osskssssksso.",
  ".ospsssssspso.",
  ".ossskkssssso.",
  "..oossssssoo..",
  "...occcccco...",
  "..occccccccoo.",
  "..occccccccoo.",
  ".occcccccccco.",
  ".oooooooooooo.",
  "..............",
];

const withTop = (top) => [...top, ...BODY];

/* 5명의 게스트 + 호스트 — 머리 장식이 전부 다릅니다 */
export const CHARACTERS = [
  {
    id: "host",
    label: "왕관",
    map: withTop(["...oyoyoyoyo..", "...oyyyyyyyo.."]),
    palette: { o: "#5b4a63", s: "#fff6e0", e: "#ffc6dd", p: "#ffb3cf", k: "#5b4a63", c: "#ffd45e", y: "#ffd45e" },
  },
  {
    id: "bunny",
    label: "토끼",
    map: withTop(["...oo..oo.....", "...oeo.oeo...."]),
    palette: { o: "#5b4a63", s: "#ffffff", e: "#ffc6dd", p: "#ffb3cf", k: "#5b4a63", c: "#ff8fb6", y: "#ff8fb6" },
  },
  {
    id: "cat",
    label: "고양이",
    map: withTop(["..oo......oo..", "..oeo....oeo.."]),
    palette: { o: "#5b4a63", s: "#ffe6a8", e: "#ffb0c9", p: "#ff9db8", k: "#5b4a63", c: "#f0a13f", y: "#f0a13f" },
  },
  {
    id: "bear",
    label: "곰",
    map: withTop(["..oo......oo..", "..oso....oso.."]),
    palette: { o: "#5b4a63", s: "#c6f2df", e: "#8fe3c9", p: "#ff9db8", k: "#5b4a63", c: "#4ec9a6", y: "#4ec9a6" },
  },
  {
    id: "star",
    label: "별모자",
    map: withTop(["......oo......", "....ooyyoo...."]),
    palette: { o: "#5b4a63", s: "#eae2ff", e: "#c9b8ff", p: "#ff9db8", k: "#5b4a63", c: "#8b74e0", y: "#ffd45e" },
  },
  {
    id: "drop",
    label: "물방울",
    map: withTop(["....o....o....", "...oyo..oyo..."]),
    palette: { o: "#5b4a63", s: "#d7efff", e: "#a9e4ff", p: "#ff9db8", k: "#5b4a63", c: "#4aa8e6", y: "#7fd2f7" },
  },
];

/* 슬롯 번호 → 캐릭터. 0 은 호스트, 1~5 는 게스트 */
export const charForSlot = (slot) => CHARACTERS[Math.max(0, Math.min(CHARACTERS.length - 1, slot | 0))];

/* ---------- 건물 (24 x 22) ----------
   o 외곽선 · r 지붕 · R 지붕그늘 · b 몸통 · w 유리 · W 크림/흰색
   d 문 · a 강조색 · k 진한 포인트 · g 초록 · y 노랑 */

export const BUILDING_SPRITES = {
  /* 🍰 케이크 카페 — 돔지붕 + 흘러내리는 크림 + 체리 */
  cake: {
    map: [
      "........................",
      "...........gg...........",
      "..........okko..........",
      ".........okkkko.........",
      "........orrrrrro........",
      ".......orrrrrrrro.......",
      "......orrrrrrrrrrо......".replace("о", "o"),
      ".....orrrrrrrrrrrrо.....".replace("о", "o"),
      "....orrrrrrrrrrrrrrо....".replace("о", "o"),
      "...orrrrrrrrrrrrrrrrо...".replace("о", "o"),
      "..oWWWWWWWWWWWWWWWWWWo..",
      "..oWWbWWbWWbWWbWWbWWbo..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..obbooooobbbbooooobbo..",
      "..obbowwwobbbbowwwobbo..",
      "..obbowwwobbbbowwwobbo..",
      "..obbooooobbbbooooobbo..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..obbbbbboddddobbbbbbo..",
      "..obbbbbbodddaobbbbbbo..",
      "..obbbbbboddddobbbbbbo..",
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#c05a86", r: "#ffa8cd", R: "#f88bb9", b: "#fff0f6", w: "#bfe9ff",
      W: "#fffaf2", d: "#ffc0dd", a: "#c05a86", k: "#ff5f85", g: "#6cc08a",
    },
  },

  /* 🍭 사탕가게 — 줄무늬 차양 + 막대사탕 간판 */
  candy: {
    map: [
      "........................",
      "..........oooo..........",
      ".........oaaaao.........",
      ".........oaWaao.........",
      ".........oaaaao.........",
      "..........oaao..........",
      "...ooooooooaaooooooooo..",
      "...oRRRRRRRRRRRRRRRRRo..",
      "...orrrrrrrrrrrrrrrrro..",
      "..orWWrrWWrrWWrrWWrrWWo.",
      "..oWWrrWWrrWWrrWWrrWWro.",
      "..obbbbbbbbbbbbbbbbbbbo.",
      "..oboooooooooobbbbbbbbo.",
      "..obowwwwwwwwobbodddobo.",
      "..obowkwwkwwkobbodddobo.",
      "..obowwwwwwwwobbodddobo.",
      "..obowkwwkwwkobbodddobo.",
      "..obowwwwwwwwobbodddobo.",
      "..oboooooooooobbodddobo.",
      "..obbbbbbbbbbbbodddobbo.",
      "..obbbbbbbbbbbbodadobbo.",
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#2f8f74", r: "#8fe3c9", R: "#6fd3b6", b: "#eafff6", w: "#d9fff4",
      W: "#ffffff", d: "#bff3e4", a: "#ff8fb6", k: "#ffd45e", g: "#6cc08a",
    },
  },

  /* 💌 토끼 우체국 — 뾰족지붕 위 토끼 귀 + 하트 창 */
  post: {
    map: [
      "....oo..........oo......",
      "...oWWo........oWWo.....",
      "...oWWo........oWWo.....",
      "....oWo........oWo......",
      ".....oorrrrrrrroo.......",
      "......orrrrrrrro........",
      ".....orrrrrrrrrro.......",
      "....orrrrrrrrrrrro......",
      "...orrrrrrrrrrrrrro.....",
      "..orrrrrrrrrrrrrrrro....",
      ".orrrrrooaaoorrrrrrro...",
      "oooooooakkaooooooooooo..",
      "..obbbboakkaobbbbbbbbo..",
      "..obbbbboaaobbbbbbbbbo..",
      "..obbooobbbboooobbbbbo..",
      "..obowwobbbbowwobbbbbo..",
      "..obowwobbbbowwobbbbbo..",
      "..obboooddddoooobbaabo..",
      "..obbbbbodddobbbbbbaabo.".slice(0, 24),
      "..obbbbbodddobbbbbbaabo.".slice(0, 24),
      "..obbbbbodddobbbbbbaabo.".slice(0, 24),
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#6a56b8", r: "#b6a6f0", R: "#9b88e4", b: "#f3eeff", w: "#dff0ff",
      W: "#ffc6dd", d: "#ded2ff", a: "#ff8fb6", k: "#ff6f9c", g: "#6cc08a",
    },
  },

  /* 🌷 꽃집 — 아치형 온실 + 화단 */
  flower: {
    map: [
      "........................",
      "..........okko..........",
      ".........okaako.........",
      "........oorrrroo........",
      "......oorrrrrrrroo......",
      ".....orrrrrrrrrrrro.....",
      "....orrrrrrrrrrrrrro....",
      "...orrbbbbbbbbbbbbrro...",
      "..orrbbwwbbwwbbwwbbrro..",
      "..obbbwwbbwwbbwwbbbbbo..",
      "..obbowwobwwobwwobbbbo..",
      "..obbowwobwwobwwobbbbo..",
      "..obbooooboooboooobbbo..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..obbwwbbbodddobbwwbbo..",
      "..obbwwbbbodddobbwwbbo..",
      "..obbbbbbbodddobbbbbbo..",
      "..oggobbbbodddobbbbggo..",
      "..oapaobbbodadobbboapao..".slice(0, 24),
      "..ogggobbbodddobbbogggo.".slice(0, 24),
      "..ooooobbbodddobbbooooo.".slice(0, 24),
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#c99123", r: "#ffd98a", R: "#f7c463", b: "#fffbe8", w: "#cdeeff",
      W: "#ffffff", d: "#ffeec2", a: "#ff8fb6", k: "#ff6f9c", g: "#6cc08a",
    },
  },

  /* 🎠 회전목마 — 줄무늬 캐노피 + 기둥 + 목마 */
  carousel: {
    map: [
      "..........oyo...........",
      ".........oyyyo..........",
      "..........oyo...........",
      "...........o............",
      "........oorrroo.........",
      "......oorrWWrrroo.......",
      "....oorrWWrrWWrrroo.....",
      "..oorrWWrrWWrrWWrrrroo..",
      ".orrWWrrWWrrWWrrWWrrrro.",
      "oRRRRRRRRRRRRRRRRRRRRRRo".slice(0, 24),
      ".oooooooooooooooooooooo.",
      "..oaobbbbbbbbbbbbbboao..",
      "..oaobbbooooooobbbboao..",
      "..oaobbowwwwwkobbbboao..",
      "..oaobbowwwwwwobbbboao..",
      "..oaobbbooowwoobbbboao..",
      "..oaobbbbbowobbbbbboao..",
      "..oaobbbbbowobbbbbboao..",
      "..oaobbbbbbbbbbbbbboao..",
      "..oaobbbbbbbbbbbbbboao..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#2f7fb8", r: "#7fc8f5", R: "#5fb4ea", b: "#eaf6ff", w: "#ffffff",
      W: "#ffffff", d: "#cfe9ff", a: "#ff8fb6", k: "#5b4a63", y: "#ffd45e",
    },
  },
};

/* ---------- 장식 ---------- */

export const DECO = {
  /* 막대사탕 나무 (12 x 16) */
  tree: {
    map: [
      "...oooooo...",
      "..oaaWWaao..",
      ".oaWWaaWWao.",
      ".oaWaaaaWao.",
      ".oWaaaaaaWo.",
      ".oWaaaaaaWo.",
      ".oaWaaaaWao.",
      ".oaWWaaWWao.",
      "..oaaWWaao..",
      "...oooooo...",
      ".....oo.....",
      ".....oo.....",
      ".....oo.....",
      ".....oo.....",
      "....oooo....",
      "............",
    ],
    palette: { o: "#5b4a63", a: "#ff9ec4", W: "#ffffff" },
  },
  /* 반짝이 별 (10 x 10) */
  star: {
    map: [
      "....oo....",
      "....yy....",
      "...oyyo...",
      "oooyyyyooo",
      "oyyyyyyyyo",
      ".oyyyyyyo.",
      "..oyyyyo..",
      ".oyyooyyo.",
      "oyyo..oyyo",
      ".oo....oo.",
    ],
    palette: { o: "#e0a021", y: "#ffe38a" },
  },
  /* 구름 (20 x 10) */
  cloud: {
    map: [
      ".......oooo.........",
      "....oooWWWWooo......",
      "..ooWWWWWWWWWWoo....",
      ".oWWWWWWWWWWWWWWoo..",
      "oWWWWWWWWWWWWWWWWWo.",
      "oWWWWWWWWWWWWWWWWWWo",
      "oWWWWWWWWWWWWWWWWWWo",
      ".oooooooooooooooooo.",
      "....................",
      "....................",
    ],
    palette: { o: "#dbeefc", W: "#ffffff" },
  },
};

/* ---------- 픽셀맵 → data URL ---------- */

const cache = new Map();

export function spriteURL(map, palette, key) {
  if (key && cache.has(key)) return cache.get(key);
  const h = map.length;
  const w = map[0].length;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (!ch || ch === "." || ch === " ") continue;
      const col = palette[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = cv.toDataURL();
  if (key) cache.set(key, url);
  return url;
}

/* ---------- 바닥 타일 ---------- */

/* 16x16 잔디 타일 — 같은 무늬가 반복돼도 지저분하지 않게 점만 몇 개 */
export function grassTile(base, dark, light) {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 16;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = dark;
  [[2, 3], [11, 5], [6, 10], [14, 13], [9, 1]].forEach(([x, y]) => ctx.fillRect(x, y, 2, 1));
  ctx.fillStyle = light;
  [[5, 6], [13, 8], [1, 12], [8, 14]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));
  return cv.toDataURL();
}

export function pathTile(base, dark) {
  const cv = document.createElement("canvas");
  cv.width = 16;
  cv.height = 16;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = dark;
  [[3, 4], [10, 2], [7, 9], [13, 12], [2, 13]].forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));
  return cv.toDataURL();
}
