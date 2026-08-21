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

/* 슬롯 → 캐릭터. 0 은 호스트(왕관)이고, 게스트는 캐릭터를 돌려 씁니다.
   인원 제한이 없어서 슬롯이 캐릭터 수보다 커질 수 있거든요. */
export const charForSlot = (slot) => {
  const n = slot | 0;
  if (n <= 0) return CHARACTERS[0];
  const guests = CHARACTERS.length - 1;
  return CHARACTERS[1 + ((n - 1) % guests)];
};

/* ---------- 꾸미기 ----------
   머리는 캐릭터 그림의 맨 위 두 줄을 갈아 끼우는 방식입니다.
   (캐릭터마다 다른 게 원래 그 두 줄이거든요) */

export const FACES = CHARACTERS.slice(1).map((c, i) => ({ i: i + 1, id: c.id, label: c.label }));

export const HATS = [
  { id: "none", label: "그대로", price: 0, top: null },
  { id: "ribbon", label: "리본", price: 2, top: ["..oo......oo..", ".oyyo....oyyo."], y: "#ff8fb6" },
  { id: "flower", label: "꽃", price: 2, top: ["...oyo........", "..oyyyo......."], y: "#ff9ec4" },
  { id: "star", label: "별", price: 3, top: ["......oo......", "....ooyyoo...."], y: "#ffd45e" },
  { id: "horn", label: "뿔", price: 3, top: ["...o......o...", "..oyo....oyo.."], y: "#b6a6f0" },
  { id: "cap", label: "모자", price: 4, top: ["..oooooooooo..", "..oyyyyyyyyo.."], y: "#4aa8e6" },
  { id: "crown", label: "왕관", price: 6, top: ["...oyoyoyoyo..", "...oyyyyyyyo.."], y: "#ffd45e" },
];

export const OUTFITS = [
  { id: "none", label: "그대로", price: 0, c: null },
  { id: "pink", label: "분홍", price: 1, c: "#ff8fb6" },
  { id: "mint", label: "민트", price: 1, c: "#4ec9a6" },
  { id: "sky", label: "하늘", price: 1, c: "#4aa8e6" },
  { id: "lemon", label: "레몬", price: 1, c: "#f0c93f" },
  { id: "grape", label: "포도", price: 2, c: "#8b74e0" },
  { id: "coral", label: "산호", price: 2, c: "#f0764e" },
  { id: "cloud", label: "구름", price: 3, c: "#dfe9ff" },
  { id: "ink", label: "먹색", price: 3, c: "#5b4a63" },
];

export const DEFAULT_LOOK = { f: 1, h: "none", o: "none", sk: null };

/* 꾸민 모습 하나를 그림으로 만들어 줍니다 */
export function lookSprite(look) {
  const lk = look || DEFAULT_LOOK;
  const base = charForSlot(lk.f || 1);
  const hat = HATS.find((h) => h.id === lk.h) || HATS[0];
  const out = OUTFITS.find((o) => o.id === lk.o) || OUTFITS[0];
  const palette = { ...base.palette };
  if (hat.y) palette.y = hat.y;
  if (out.c) palette.c = out.c;
  return {
    id: base.id,
    label: base.label,
    map: [...(hat.top || base.map.slice(0, 2)), ...base.map.slice(2)],
    palette,
    key: `lk-${base.id}-${hat.id}-${out.id}`,
  };
}

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
      "......orrrrrrrrrro......",
      ".....orrrrrrrrrrrro.....",
      "....orrrrrrrrrrrrrro....",
      "...orrrrrrrrrrrrrrrro...",
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
      "..oooooooooaaooooooooo..",
      "..oRRRRRRRRRRRRRRRRRRo..",
      "..orrrrrrrrrrrrrrrrrro..",
      "..oWWrrWWrrWWrrWWrrWWo..",
      "..orrWWrrWWrrWWrrWWrro..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..oboooooooooboooooobo..",
      "..obowwwwwwwoboddddobo..",
      "..obowkwwkwwoboddddobo..",
      "..obowwwwwwwoboddddobo..",
      "..oboooooooooboddddobo..",
      "..obbbbbbbbbbboddddobo..",
      "..obbbbbbbbbbboddddobo..",
      "..obbbbbbbbbbboddddobo..",
      "..obbbbbbbbbbbbbbbbbbo..",
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
      "........oo....oo........",
      ".......oWWo..oWWo.......",
      ".......oWWo..oWWo.......",
      "........oWo..oWo........",
      "........oorrrroo........",
      ".......oorrrrrroo.......",
      "......oorrrrrrrroo......",
      ".....oorrrrrrrrrroo.....",
      "....oorrrrrrrrrrrroo....",
      "...oorrrrrrrrrrrrrroo...",
      "..oorrrrrrrrrrrrrrrroo..",
      ".oooooooooooooooooooooo.",
      "..obbbbbbboaaobbbbbbbo..",
      "..obbbbbbbakkabbbbbbbo..",
      "..obbbbbbboaaobbbbbbbo..",
      "..oooooobooooooboooooo..",
      "..oowwwoboddddobowwwoo..",
      "..oowwwoboddddobowwwoo..",
      "..ooooooboddddoboooooo..",
      "..obbbbbboddddobbbbbbo..",
      "..obbbbbboddddobbbaabo..",
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
      "..obbwwbbbodddobwwbbbo..",
      "..obbwwbbbodddobwwbbbo..",
      "..obbbbbbbodddobbbbbbo..",
      "..oggbbbbbodddobbbbggo..",
      "..oapbbbbbodddobbbbpao..",
      "..oggbbbbbodddobbbbggo..",
      "..ooobbbbbodddobbbbooo..",
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
      "oRRRRRRRRRRRRRRRRRRRRRRo",
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

  /* 🥠 포춘쿠키 — 가운데가 접힌 쿠키에 쪽지가 끼어 있어요 */
  fortune: {
    map: [
      "........................",
      "......oooo.....oooo.....",
      "....ooccccoo.ooccccoo...",
      "..oocccccccCoccccccccoo.",
      ".occcccccccCCcccccccccco",
      ".occcccccccCCcccccccccco",
      "occccccccooooooccccccccc",
      "occccccccoppppoccccccccc",
      "occccccccoppppoccccccccc",
      "occccccccoppppoccccccccc",
      "occccccccooooooccccccccc",
      ".occcccccccCCcccccccccco",
      ".ocoooooooooooooooooocco",
      "..oobbbbbbbbbbbbbbbbooo.",
      "...oooooobbbbbboooooo...",
      "...oowwwoooooooowwwoo...",
      "...oowwwooddddoowwwoo...",
      "...oowwwooddddoowwwoo...",
      "...oooooooddddooooooo...",
      "...obbbbboddddobbbbbo...",
      "...obbbbboddddobbbbbo...",
      "...oooooooooooooooooo...",
    ],
    palette: {
      o: "#a9762f", c: "#ffdf9e", C: "#e8b767", b: "#fff3dc", w: "#cdeeff",
      d: "#ffcf8a", p: "#ffffff", a: "#e8874a", k: "#a9762f",
    },
  },

  /* ☕ 카페 — 줄무늬 차양 + 지붕 위 커피컵 간판 */
  cafe: {
    map: [
      ".........oooooo.........",
      "........oppppppo........",
      "........oppppppooo......",
      "........oppppppo.o......",
      "........oppppppoo.......",
      ".........oooooo.........",
      "..oooooooooooooooooooo..",
      "..WWrrWWrrWWrrWWrrWWrr..",
      "..WWrrWWrrWWrrWWrrWWrr..",
      "..oooooooooooooooooooo..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..oooooooooobbbbbbbbbo..",
      "..oowwwowwwobooooooobo..",
      "..oowwwowwwobodddddobo..",
      "..oowwwowwwobodddddobo..",
      "..oowwwowwwobodddddobo..",
      "..oowwwowwwoboddddoobo..",
      "..oooooooooobodddddobo..",
      ".gobbbbbbbbbbodddddogo..",
      ".gobbbbbbbbbbodddddogo..",
      "..obbbbbbbbbbodddddobo..",
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#8a5a3c", r: "#ffb9a8", W: "#fff4ec", b: "#fff8f0", w: "#cdeeff",
      d: "#ffd9c0", p: "#ffffff", g: "#8fd8a8", a: "#e08a5c",
    },
  },

  /* 👗 구름옷가게 — 리본 간판 + 줄무늬 차양 + 진열창 두 개 */
  dress: {
    map: [
      ".........oooooo.........",
      "........oaa..aao........",
      "........oaaooaao........",
      "........o.aaaa.o........",
      "........oa.aa.ao........",
      ".........oooooo.........",
      "..oooooooooooooooooooo..",
      "..WWrrWWrrWWrrWWrrWWrr..",
      "..WWrrWWrrWWrrWWrrWWrr..",
      "..oooooooooooooooooooo..",
      "..obbbbbbbbbbbbbbbbbbo..",
      "..oooooooboooobooooooo..",
      "..oowwwwoboddobowwwwoo..",
      "..oowaawoboddobowaawoo..",
      "..oowaawoboddobowaawoo..",
      "..ooaaaaoboddoboaaaaoo..",
      "..ooaaaaoboddoboaaaaoo..",
      "..oowwwwoboddobowwwwoo..",
      "..oooooooboddobooooooo..",
      "..obbbbbbboddobbbbbbbo..",
      "..obbbbbbboddobbbbbbbo..",
      "..oooooooooooooooooooo..",
    ],
    palette: {
      o: "#7a5a8c", r: "#b6a6f0", W: "#fff0ff", b: "#fdf4ff", w: "#e9dcff",
      d: "#d9c4f2", a: "#ff8fb6", g: "#8fd8a8", k: "#7a5a8c",
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
