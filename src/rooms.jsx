/* ===========================================================
   건물 내부 — 입체(원근) 픽셀 방
   방 좌표는 평면(x: 0~W, y: 0~D)이고, 그릴 때만 원근을 씌웁니다.
   뒤로 갈수록(k 작아짐) 좁아지고 작아져요. 이동/충돌은 평면 기준.
   =========================================================== */

export const ROOM = { w: 1000, d: 520, wall: 300 };
export const SCREEN = { w: ROOM.w, h: ROOM.wall + ROOM.d };

/* 깊이 계수 — 뒤(0) 0.5배 ~ 앞(D) 1.0배 */
export const depth = (y) => 0.5 + 0.5 * (y / ROOM.d);

/* 방 좌표 → 화면 좌표 */
export function proj(x, y) {
  const k = depth(y);
  return { sx: ROOM.w / 2 + (x - ROOM.w / 2) * k, sy: ROOM.wall + y, k };
}

const PLAY = { x0: 90, x1: ROOM.w - 90, y0: 40, y1: ROOM.d - 30 };

/* LP바 의자 6개 — 그리기와 착석 판정이 같은 좌표를 씁니다 */
export const TABLE = { x: 500, y: 250 };
/* 카페 메뉴 — 별(⭐)로 삽니다 */
export const MENU = [
  { id: "latte", name: "구름 라떼", emoji: "☕", price: 2 },
  { id: "berry", name: "딸기 스무디", emoji: "🍓", price: 3 },
  { id: "shake", name: "바닐라 쉐이크", emoji: "🥤", price: 3 },
  { id: "cake", name: "초코 케이크", emoji: "🍰", price: 4 },
  { id: "madel", name: "마들렌", emoji: "🥐", price: 1 },
  { id: "cookie", name: "구름 쿠키", emoji: "🍪", price: 1 },
];

/* 한 테이블에 둘이 앉으면 저절로 오가는 스몰토크 — 네 마디씩 */
export const SMALL_TALK = [
  { a: "날씨 좋다~", b: "그러게요. 구름이 폭신해 보여요.",
    c: "여기 앉으니까 마을이 다 내려다보이네요.", d: "그쵸? 저 이 자리 좋아해요." },
  { a: "여기 처음 오세요?", b: "네, 오늘 처음이에요.",
    c: "천천히 둘러보세요. 다 귀여워요.", d: "안 그래도 그러려고요." },
  { a: "뭐 시키셨어요?", b: "구름 라떼요. 여기 그게 유명하대요.",
    c: "오, 저도 그거 마셔봐야겠다.", d: "추천이요. 진짜 부드러워요." },
  { a: "오늘 뭐 하고 놀았어요?", b: "ASMR 타운에서 왁뿌볼 뿌수고 왔어요.",
    c: "그거 은근 중독되지 않아요?", d: "네… 손이 계속 가요." },
  { a: "미끄럼틀 타봤어요?", b: "아직요. 좀 무서울 것 같아서.",
    c: "생각보다 순해요. 슝 하고 끝나요.", d: "그럼 이따 한번 타볼까." },
  { a: "여긴 조용해서 좋다.", b: "맞아요. 아무 말 안 해도 안 어색하고.",
    c: "그런 데가 잘 없죠.", d: "그니까요." },
];

/* 카운터에 서 있는 직원 */
export const CAFE_STAFF = { x: 500, y: 118 };
/* LP바 바텐더 */
export const BAR_STAFF = { x: 500, y: 126 };

/* 의자에 앉으면 저절로 오가는 이야기 — 이 중 두 마디를 골라 주고받습니다 */
export const SEAT_TALK = {
  cake: [
    { s: "오셨어요? 아무 데나 편한 자리 앉으세요.", m: "네, 여기 앉을게요." },
    { s: "지금 나오는 곡, 오늘 제일 아끼는 거예요.", m: "와… 이거 좋다." },
    { s: "여기선 아무 말 안 해도 돼요.", m: "그 말이 제일 좋네요." },
    { s: "신청곡 생기면 언제든 말씀하세요.", m: "생각나면 말할게요." },
    { s: "구름 위라 그런지 소리가 참 잘 퍼져요.", m: "그러게요, 귀가 편해요." },
  ],
  cafe: [
    { s: "어서 오세요. 창가 자리 비었어요.", m: "여기 앉을게요." },
    { s: "오늘은 구름 라떼가 잘 나가요.", m: "그럼 그걸로 할까…" },
    { s: "여기 앉으면 마을이 다 내려다보여요.", m: "우와, 진짜 다 보이네요." },
    { s: "천천히 드세요. 여긴 시간 안 재요.", m: "고맙습니다." },
    { s: "케이크는 방금 나온 게 있어요.", m: "냄새가 벌써 좋은데요." },
  ],
};

/* 카페 — 2인 테이블 3개 (의자 6개) */
export const CAFE_TABLES = [
  { x: 260, y: 250 }, { x: 500, y: 330 }, { x: 740, y: 250 },
];
export const CAFE_CHAIRS = CAFE_TABLES.flatMap((t, n) => [
  { i: n * 2, x: t.x - 82, y: t.y + 8, t: n },
  { i: n * 2 + 1, x: t.x + 82, y: t.y + 8, t: n },
]);

export const CHAIRS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
  return { i, a, x: TABLE.x + Math.cos(a) * 200, y: TABLE.y + Math.sin(a) * 105 };
});

/* 원형 장애물을 사각 박스로 */
const box = (x, y, w, h) => ({ x1: x - w / 2, x2: x + w / 2, y1: y - h / 2, y2: y + h / 2 });

export const ROOMS = {
  /* 🎧 LP바 — 가운데 바텐더 + 원형 테이블 + 의자 6개 + 오른쪽 LP */
  cake: {
    id: "cake",
    name: "LP바",
    emoji: "🎧",
    floor: "#ffd9ea",
    floorLine: "#ffd9ea",
    wall: "#fff0f7",
    wallDark: "#ffc8e0",
    side: "#ffe6f2",
    accent: "#ff8fb6",
    hint: "가운데는 바, 오른쪽 LP 를 누르면 플레이리스트가 열려요",
    play: PLAY,
    blocks: [box(TABLE.x, TABLE.y, 290, 130), box(500, 60, 420, 80)],
    chairs: CHAIRS,
    staff: BAR_STAFF,
    staffName: "바텐더",
    stars: [{ x: 150, y: 120 }, { x: 860, y: 130 }, { x: 500, y: 460 }],
    zones: [
      { id: "lp", x: 880, y: 300, r: 90, label: "LP 플레이어" },
      { id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" },
    ],
  },

  /* ❓ 퀴즈상가 — 뒤쪽 큰 화면 + 앞의 정답 버튼대 */
  candy: {
    id: "candy",
    name: "퀴즈상가",
    emoji: "❓",
    floor: "#c9f2e4",
    floorLine: "#c9f2e4",
    wall: "#eafff8",
    wallDark: "#a9e6d3",
    side: "#dcfaf0",
    accent: "#4ec9a6",
    hint: "화면 앞 단상에 올라서면 퀴즈가 시작돼요",
    play: PLAY,
    blocks: [box(500, 70, 520, 110)],
    stars: [{ x: 160, y: 420 }, { x: 850, y: 430 }, { x: 180, y: 130 }],
    zones: [
      { id: "quiz", x: 500, y: 250, r: 110, label: "퀴즈 시작" },
      { id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" },
    ],
  },

  /* 🏊 수영장 — 가운데 큰 물, 들어가면 헤엄 */
  post: {
    id: "post",
    name: "수영장",
    emoji: "🏊",
    floor: "#ffe8d6",
    floorLine: "#ffe8d6",
    wall: "#f2fbff",
    wallDark: "#e8a06a",
    side: "#ffdcc0",
    accent: "#bfe9ff",
    hint: "물에 들어가면 헤엄쳐요. 첨벙!",
    play: PLAY,
    blocks: [],
    water: { x: 500, y: 260, w: 620, d: 300 },
    stars: [{ x: 140, y: 130 }, { x: 880, y: 140 }, { x: 500, y: 470 }],
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },

  /* 🎙️ ASMR 타운 — 가운데 커다란 모래밭 */
  flower: {
    id: "flower",
    name: "ASMR 타운",
    emoji: "🎙️",
    floor: "#ffe9cc",
    floorLine: "#ffe9cc",
    wall: "#fff7ec",
    wallDark: "#f5d3a8",
    side: "#fff0dd",
    accent: "#ffcf95",
    hint: "가운데 모래를 밟으면 사각사각 소리가 나요",
    play: PLAY,
    blocks: [],
    crunch: { x: 500, y: 270, r: 150 },
    /* 왁뿌볼 — 한쪽에 모아둔 무더기, 밟으면 뿌셔집니다 */
    balls: [
      { i: 0, x: 235, y: 300 }, { i: 1, x: 285, y: 285 }, { i: 2, x: 330, y: 305 },
      { i: 3, x: 258, y: 340 }, { i: 4, x: 308, y: 345 }, { i: 5, x: 210, y: 345 },
      { i: 6, x: 283, y: 380 }, { i: 7, x: 350, y: 350 },
    ],
    /* 키보드 — 오른쪽 바닥에 눕힌 3열 × 10줄 (x, y 는 뒤쪽 왼쪽 모서리의 방 좌표) */
    keys: { x: 690, y: 100, cols: 3, rows: 10, w: 64, h: 36, gap: 5 },
    stars: [{ x: 140, y: 150 }, { x: 480, y: 470 }, { x: 600, y: 150 }],
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },

  /* ☕ 구름카페 — 카운터 + 2인 테이블 3개 */
  cafe: {
    id: "cafe",
    name: "구름카페",
    emoji: "☕",
    floor: "#ffe7d6",
    floorLine: "#ffe7d6",
    wall: "#fff4ea",
    wallDark: "#e8bfa0",
    side: "#ffeee2",
    accent: "#e08a5c",
    hint: "의자에 앉으면 음료가 나와요",
    play: PLAY,
    blocks: [box(500, 70, 460, 90), ...CAFE_TABLES.map((t) => box(t.x, t.y, 120, 80))],
    chairs: CAFE_CHAIRS,
    staff: CAFE_STAFF,
    staffName: "직원",
    stars: [{ x: 150, y: 430 }, { x: 870, y: 430 }, { x: 500, y: 470 }],
    zones: [
      { id: "menu", x: 500, y: 160, r: 120, label: "메뉴판 보기" },
      { id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" },
    ],
  },

  /* 👗 구름옷가게 — 전신거울 앞에서 꾸밉니다 */
  dress: {
    id: "dress",
    name: "구름옷가게",
    emoji: "👗",
    floor: "#efe6ff",
    floorLine: "#efe6ff",
    wall: "#faf5ff",
    wallDark: "#cdb9ee",
    side: "#f5eeff",
    accent: "#8b74e0",
    hint: "거울 앞에서 꾸미고, 오른쪽 우체통에 하고 싶은 말을 넣어보세요",
    play: PLAY,
    blocks: [box(500, 120, 220, 150), box(832, 150, 90, 80)],
    stars: [{ x: 150, y: 430 }, { x: 620, y: 460 }, { x: 380, y: 470 }],
    zones: [
      { id: "dress", x: 500, y: 300, r: 130, label: "꾸미기" },
      { id: "wish", x: 832, y: 235, r: 92, label: "우체통" },
      { id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" },
    ],
  },

  /* 🍜 떵개방 — 준비중 */
  carousel: {
    id: "carousel",
    name: "떵개방",
    emoji: "🍜",
    floor: "#e8e2ff",
    floorLine: "#e8e2ff",
    wall: "#f5f1ff",
    wallDark: "#d3c9f7",
    side: "#eee9ff",
    accent: "#8b74e0",
    hint: "가운데 가챠를 눌러 오늘의 메뉴를 뽑아보세요",
    play: PLAY,
    blocks: [box(500, 150, 260, 150)],
    stars: [{ x: 160, y: 420 }, { x: 850, y: 420 }, { x: 500, y: 470 }],
    zones: [
      { id: "gacha", x: 500, y: 290, r: 130, label: "메뉴 가챠" },
      { id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" },
    ],
  },
};

/* ---------- 방 배경(벽/바닥/가구) ---------- */

/* 퀴즈상가 모드별 색 — 개인전 파랑, 팀전 빨강 */
export const QUIZ_SKIN = {
  solo: { floor: "#cfe6ff", floorLine: "#cfe6ff", wall: "#e9f4ff", wallDark: "#a9d2f5", side: "#dcecff", accent: "#3d8fd6" },
  team: { floor: "#ffd6d6", floorLine: "#ffd6d6", wall: "#ffecec", wallDark: "#f5b3b3", side: "#ffe2e2", accent: "#e05b5b" },
};

export function RoomStage({ room, children, waterPhase, seats = [], broken = [], pressed = [], skin }) {
  const R = skin ? { ...room, ...skin } : room;
  const fl = proj(0, 0);
  const fr = proj(ROOM.w, 0);
  const nl = proj(0, ROOM.d);
  const nr = proj(ROOM.w, ROOM.d);

  return (
    <svg className="ccRoomSvg" viewBox={`0 0 ${SCREEN.w} ${SCREEN.h}`} width={SCREEN.w} height={SCREEN.h}>
      {/* 옆벽 */}
      <polygon points={`0,0 ${fl.sx},${fl.sy - ROOM.wall} ${fl.sx},${fl.sy} 0,${SCREEN.h}`} fill={R.side} />
      <polygon
        points={`${SCREEN.w},0 ${fr.sx},${fr.sy - ROOM.wall} ${fr.sx},${fr.sy} ${SCREEN.w},${SCREEN.h}`}
        fill={R.side}
      />
      {/* 뒷벽 */}
      <rect x={fl.sx} y={fl.sy - ROOM.wall} width={fr.sx - fl.sx} height={ROOM.wall} fill={R.wall} />
      <rect x={fl.sx} y={fl.sy - 26} width={fr.sx - fl.sx} height={26} fill={R.wallDark} />
      {/* 바닥 */}
      <polygon points={`${fl.sx},${fl.sy} ${fr.sx},${fr.sy} ${nr.sx},${nr.sy} ${nl.sx},${nl.sy}`} fill={R.floor} />

      {/* 방마다 다른 설치물 */}
      {R.id === "cake" && <BarProps seats={seats} />}
      {R.id === "candy" && <QuizProps R={R} />}
      {R.id === "post" && <PoolProps R={R} phase={waterPhase} />}
      {R.id === "flower" && <SandProps R={R} broken={broken} pressed={pressed} />}
      {R.id === "carousel" && <GachaProps R={R} />}
      {R.id === "cafe" && <CafeProps R={R} seats={seats} />}
      {R.id === "dress" && <DressProps />}

      {/* 문 */}
      <Door />
      {children}
    </svg>
  );
}

function Door() {
  const p = proj(ROOM.w / 2, ROOM.d);
  const w = 130 * p.k;
  return (
    <g>
      <rect x={p.sx - w / 2} y={p.sy - 16} width={w} height={22} fill="#5b4a63" opacity="0.25" />
      <text x={p.sx} y={p.sy + 4} textAnchor="middle" fontSize="17" fontWeight="700" fill="#5b4a63">
        ▼ 나가기
      </text>
    </g>
  );
}

/* LP바 — 바텐더 자리, 원형 테이블, 의자 6개, LP */
function BarProps({ seats = [] }) {
  const bar = proj(500, 60);
  const table = proj(TABLE.x, TABLE.y);
  const chairs = CHAIRS.map((c) => {
    const p = proj(c.x, c.y);
    const taken = seats.includes(c.i);
    return (
      <g key={c.i}>
        <rect
          x={p.sx - 26 * p.k}
          y={p.sy - 34 * p.k}
          width={52 * p.k}
          height={20 * p.k}
          fill={taken ? "#ff9ec4" : "#ffc0dd"}
          stroke="#5b4a63"
          strokeWidth="3"
        />
        <rect x={p.sx - 6 * p.k} y={p.sy - 16 * p.k} width={12 * p.k} height={18 * p.k} fill="#5b4a63" />
      </g>
    );
  });
  return (
    <g>
      {/* 뒷벽 선반 */}
      <rect x={330} y={60} width={340} height={16} fill="#ffc0dd" />
      <rect x={330} y={130} width={340} height={16} fill="#ffc0dd" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={344 + i * 46} y={26} width={18} height={34} fill={i % 2 ? "#ffd45e" : "#ff8fb6"} />
      ))}
      {/* 바 카운터 */}
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 60 * bar.k} width={460 * bar.k} height={70 * bar.k} fill="#ffc0dd" stroke="#5b4a63" strokeWidth="4" />
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 60 * bar.k} width={460 * bar.k} height={14 * bar.k} fill="#ff9ec4" />
      {/* 원형 테이블 */}
      <ellipse cx={table.sx} cy={table.sy} rx={150 * table.k} ry={80 * table.k} fill="#ffc0dd" stroke="#5b4a63" strokeWidth="4" />
      <ellipse cx={table.sx} cy={table.sy - 10 * table.k} rx={150 * table.k} ry={80 * table.k} fill="#fff0f6" stroke="#5b4a63" strokeWidth="4" />
      {chairs}
      {/* 앉은 사람 앞에 주스 한 잔 */}
      {seats.map((i) => {
        const c = CHAIRS[i];
        if (!c) return null;
        const jx = TABLE.x + Math.cos(c.a) * 100;
        const jy = TABLE.y + Math.sin(c.a) * 52;
        const p = proj(jx, jy);
        const k = p.k;
        return (
          <g key={"juice" + i}>
            <ellipse cx={p.sx} cy={p.sy + 2 * k} rx={13 * k} ry={5 * k} fill="#5b4a63" opacity="0.25" />
            <rect x={p.sx - 11 * k} y={p.sy - 34 * k} width={22 * k} height={34 * k} fill="#ffb3cf" stroke="#5b4a63" strokeWidth="3" />
            <rect x={p.sx - 11 * k} y={p.sy - 34 * k} width={22 * k} height={9 * k} fill="#fff0f6" stroke="#5b4a63" strokeWidth="3" />
            <rect x={p.sx + 1 * k} y={p.sy - 50 * k} width={5 * k} height={20 * k} fill="#ffd45e" stroke="#5b4a63" strokeWidth="2" />
          </g>
        );
      })}
      {/* 오른쪽 LP 플레이어 */}
      <LP />
    </g>
  );
}

function LP() {
  const p = proj(880, 300);
  const r = 78 * p.k;
  return (
    <g className="ccLp">
      <rect x={p.sx - r - 10} y={p.sy - r - 10} width={(r + 10) * 2} height={(r + 10) * 2} fill="#fff0f6" stroke="#ff8fb6" strokeWidth="4" />
      <circle cx={p.sx} cy={p.sy} r={r} fill="#7a6480" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.62} fill="none" stroke="#c9b8d4" strokeWidth="3" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.34} fill="#ff8fb6" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.08} fill="#7a6480" />
      <text x={p.sx} y={p.sy + r + 34} textAnchor="middle" fontSize="17" fontWeight="700" fill="#5b4a63">
        ♪ 플레이리스트
      </text>
    </g>
  );
}

/* 퀴즈상가 — 뒷벽 대형 화면 + 단상 */
function QuizProps({ R }) {
  const stage = proj(500, 250);
  return (
    <g>
      <rect x={280} y={40} width={440} height={230} fill="#ffffff" stroke={R.accent} strokeWidth="6" />
      <text x={500} y={165} textAnchor="middle" fontSize="46" fontWeight="900" fill={R.accent}>
        Q U I Z
      </text>
      <rect x={stage.sx - 130 * stage.k} y={stage.sy - 26 * stage.k} width={260 * stage.k} height={40 * stage.k} fill={R.accent} stroke="#5b4a63" strokeWidth="4" />
      <text x={stage.sx} y={stage.sy + 4 * stage.k} textAnchor="middle" fontSize={17 * stage.k} fontWeight="700" fill="#fff">
        정답 단상
      </text>
    </g>
  );
}

/* 벽화 위 반짝임 위치 — 매번 같은 자리에 나오도록 고정값으로 둡니다 */
const STARS = [
  { x: 0.08, y: 0.14, s: 9, d: 0 }, { x: 0.2, y: 0.3, s: 7, d: 0.7 },
  { x: 0.32, y: 0.1, s: 8, d: 1.4 }, { x: 0.46, y: 0.22, s: 6, d: 0.35 },
  { x: 0.6, y: 0.12, s: 9, d: 1.1 }, { x: 0.72, y: 0.28, s: 7, d: 1.8 },
  { x: 0.86, y: 0.16, s: 8, d: 0.5 }, { x: 0.94, y: 0.34, s: 6, d: 1.6 },
  { x: 0.14, y: 0.44, s: 6, d: 2.1 }, { x: 0.8, y: 0.46, s: 6, d: 0.9 },
];
const SHIMMER = [
  { x: 0.12, y: 0.18, w: 26, d: 0, t: 3.2 }, { x: 0.3, y: 0.42, w: 34, d: 0.8, t: 4 },
  { x: 0.52, y: 0.28, w: 22, d: 1.5, t: 3.6 }, { x: 0.66, y: 0.58, w: 30, d: 0.4, t: 4.4 },
  { x: 0.82, y: 0.36, w: 26, d: 2.2, t: 3.4 }, { x: 0.2, y: 0.72, w: 38, d: 1.1, t: 4.8 },
  { x: 0.58, y: 0.8, w: 30, d: 2.6, t: 4.2 },
];

/* 뒷벽 전체를 채우는 해변 노을 벽화 — 픽셀 느낌으로 가로 띠를 쌓습니다 */
function SunsetMural() {
  const x0 = proj(0, 0).sx;          // 뒷벽 왼쪽 끝
  const x1 = proj(ROOM.w, 0).sx;     // 뒷벽 오른쪽 끝
  const w = x1 - x0;
  const H = ROOM.wall;               // 벽 높이
  const sea = H * 0.62;              // 수평선 위치

  /* 하늘 — 위에서 아래로 보라 → 분홍 → 주황 */
  const sky = ["#4a3070", "#633a7c", "#8a4879", "#b25873", "#d1686a", "#e87f63", "#f79a5f", "#ffb673", "#ffd08a"];
  const bandH = sea / sky.length;
  /* 바다 — 아래로 갈수록 짙게 */
  const water = ["#f0a06a", "#d98a72", "#a97490", "#7a5f96", "#5b4e8c", "#463c74"];
  const wH = (H - sea) / water.length;

  const rays = [];
  for (let i = 0; i < 7; i++) {
    const yy = sea + i * wH * 0.95;
    const ww = 26 - i * 2.4;
    rays.push(
      <rect key={"ray" + i} x={x0 + w / 2 - ww / 2} y={yy} width={ww} height={Math.max(3, wH * 0.45)} fill="#ffe6a8" opacity={0.8 - i * 0.09} />
    );
  }

  return (
    <g>
      <defs>
        <clipPath id="ccWallClip">
          <rect x={x0} y={0} width={w} height={H} />
        </clipPath>
      </defs>
      <g clipPath="url(#ccWallClip)">
        {sky.map((c, i) => (
          <rect key={"s" + i} x={x0} y={i * bandH} width={w} height={bandH + 1} fill={c} />
        ))}
        {/* 반짝이는 별 — 하늘 위쪽에 흩뿌립니다 */}
        {STARS.map((st, i) => (
          <g key={"star" + i} className="ccMuralStar" style={{ animationDelay: `${st.d}s` }}>
            <rect x={x0 + w * st.x - st.s / 2} y={sea * st.y - 1} width={st.s} height="2.5" fill="#fff7d6" />
            <rect x={x0 + w * st.x - 1.2} y={sea * st.y - st.s / 2} width="2.5" height={st.s} fill="#fff7d6" />
          </g>
        ))}
        {/* 해 — 은은하게 커졌다 작아집니다 */}
        <circle cx={x0 + w / 2} cy={sea - 26} r="34" fill="#ffdf9a" opacity="0.55" className="ccMuralGlow" />
        <circle cx={x0 + w / 2} cy={sea - 26} r="30" fill="#fff0b8" />
        <circle cx={x0 + w / 2} cy={sea - 26} r="22" fill="#fffbe0" />
        {/* 구름 띠 */}
        <rect x={x0 + w * 0.1} y={sea * 0.42} width={w * 0.26} height="7" fill="#ffd9a8" opacity="0.75" />
        <rect x={x0 + w * 0.58} y={sea * 0.3} width={w * 0.3} height="6" fill="#ffc9a0" opacity="0.7" />
        <rect x={x0 + w * 0.66} y={sea * 0.52} width={w * 0.2} height="6" fill="#ffe0bb" opacity="0.7" />
        {/* 바다 */}
        {water.map((c, i) => (
          <rect key={"w" + i} x={x0} y={sea + i * wH} width={w} height={wH + 1} fill={c} />
        ))}
        {rays}
        {/* 물빛 반짝임 — 좌우로 흐르며 깜빡입니다 */}
        {SHIMMER.map((sh, i) => (
          <rect
            key={"sh" + i}
            className="ccMuralShimmer"
            x={x0 + w * sh.x}
            y={sea + (H - sea) * sh.y}
            width={sh.w}
            height="3"
            fill="#fff3c4"
            style={{ animationDelay: `${sh.d}s`, animationDuration: `${sh.t}s` }}
          />
        ))}
        {/* 야자수 실루엣 */}
        {[x0 + 34, x1 - 40].map((px, i) => (
          <g key={"palm" + i} fill="#2e2140">
            <rect x={px - 4} y={sea - 96} width="8" height="96" />
            <rect x={px - 34} y={sea - 104} width="30" height="7" />
            <rect x={px + 4} y={sea - 104} width="30" height="7" />
            <rect x={px - 28} y={sea - 116} width="22" height="7" />
            <rect x={px + 6} y={sea - 116} width="22" height="7" />
            <rect x={px - 12} y={sea - 124} width="24" height="8" />
          </g>
        ))}
      </g>
      {/* 벽화 테두리 */}
      <rect x={x0} y={0} width={w} height={H} fill="none" stroke="#5b4a63" strokeWidth="4" />
    </g>
  );
}

/* 수영장 — 벽화 + 물 + 물결 */
function PoolProps({ R, phase }) {
  const w = R.water;
  const back = proj(w.x - w.w / 2, w.y - w.d / 2);
  const back2 = proj(w.x + w.w / 2, w.y - w.d / 2);
  const front = proj(w.x - w.w / 2, w.y + w.d / 2);
  const front2 = proj(w.x + w.w / 2, w.y + w.d / 2);
  const waves = [];
  for (let i = 1; i < 6; i++) {
    const y = w.y - w.d / 2 + (w.d / 6) * i;
    const a = proj(w.x - w.w / 2 + 20, y);
    const b = proj(w.x + w.w / 2 - 20, y);
    const off = Math.sin(phase + i) * 8;
    waves.push(
      <line key={i} x1={a.sx + off} y1={a.sy} x2={b.sx + off} y2={b.sy} stroke="#ffffff" strokeWidth="4" opacity="0.35" />
    );
  }
  return (
    <g>
      <SunsetMural />
      <polygon
        points={`${back.sx},${back.sy} ${back2.sx},${back2.sy} ${front2.sx},${front2.sy} ${front.sx},${front.sy}`}
        fill="#bfe9ff"
        stroke="#7fc8f5"
        strokeWidth="6"
      />
      <polygon
        points={`${back.sx},${back.sy} ${back2.sx},${back2.sy} ${front2.sx},${front2.sy} ${front.sx},${front.sy}`}
        fill="#e6f7ff"
        opacity="0.55"
      />
      {waves}
    </g>
  );
}

/* 키 하나의 방 좌표 (가운데) — 바닥에 눕혀 있어서 이동/충돌과 같은 평면을 씁니다 */
export function keyPos(k, i) {
  const c = i % k.cols;
  const r = Math.floor(i / k.cols);
  return { x: k.x + c * k.w + k.w / 2, y: k.y + r * k.h + k.h / 2 };
}
export const keyCount = (k) => k.cols * k.rows;

/* 바닥에 누운 사각형 → 화면 폴리곤. h 만큼 띄우면 그만큼 위로 올라갑니다 */
function slab(x1, y1, x2, y2, h = 0) {
  const a = proj(x1, y1), b = proj(x2, y1), c = proj(x2, y2), d = proj(x1, y2);
  return `${a.sx},${a.sy - h * a.k} ${b.sx},${b.sy - h * b.k} ${c.sx},${c.sy - h * c.k} ${d.sx},${d.sy - h * d.k}`;
}
/* 두 점을 잇는 수직 옆면 (hTop ~ hBot 사이) */
function wallFace(ax, ay, bx, by, hTop, hBot = 0) {
  const a = proj(ax, ay), b = proj(bx, by);
  return `${a.sx},${a.sy - hTop * a.k} ${b.sx},${b.sy - hTop * b.k} ${b.sx},${b.sy - hBot * b.k} ${a.sx},${a.sy - hBot * a.k}`;
}

/* 3열 × 10줄 키보드 — 바닥에 눕혀서 방 원근 그대로 그립니다 */
function Keyboard({ keys, pressed }) {
  const pad = 12;    // 판 여백(방 좌표)
  const plate = 7;   // 판 두께
  const lift = 12;   // 키가 올라온 높이
  const drop = 4;    // 밟혔을 때 남는 높이

  const bx1 = keys.x - pad;
  const bx2 = keys.x + keys.cols * keys.w + pad;
  const by1 = keys.y - pad;
  const by2 = keys.y + keys.rows * keys.h + pad;

  /* 뒷줄부터 그려야 앞줄 키가 위로 덮입니다 */
  const cells = [];
  for (let i = 0; i < keyCount(keys); i++) {
    const c = i % keys.cols;
    const r = Math.floor(i / keys.cols);
    const g = keys.gap / 2;
    const x1 = keys.x + c * keys.w + g;
    const x2 = keys.x + (c + 1) * keys.w - g;
    const y1 = keys.y + r * keys.h + g;
    const y2 = keys.y + (r + 1) * keys.h - g;
    const down = pressed.includes(i);
    const top = plate + (down ? drop : lift);
    cells.push(
      <g key={i}>
        {/* 키 옆면 — 앞/좌/우 */}
        <polygon points={wallFace(x1, y1, x1, y2, top, plate)} fill="#8d8271" stroke="#5b4a63" strokeWidth="2" />
        <polygon points={wallFace(x2, y1, x2, y2, top, plate)} fill="#8d8271" stroke="#5b4a63" strokeWidth="2" />
        <polygon points={wallFace(x1, y2, x2, y2, top, plate)} fill="#9a8f7d" stroke="#5b4a63" strokeWidth="2" />
        {/* 키 윗면 */}
        <polygon points={slab(x1, y1, x2, y2, top)} fill={down ? "#ded3c0" : "#fffaf0"} stroke="#5b4a63" strokeWidth="2" />
        {!down && (
          <polygon points={slab(x1 + 4, y1 + 3, x2 - 4, y1 + 8, top)} fill="#fff" opacity="0.85" />
        )}
      </g>
    );
  }

  return (
    <g>
      {/* 바닥 그림자 */}
      <polygon points={slab(bx1 + 6, by1 + 5, bx2 + 6, by2 + 5)} fill="#5b4a63" opacity="0.18" />
      {/* 키보드 판 — 옆면 먼저, 그 위에 윗면 */}
      <polygon points={wallFace(bx1, by1, bx1, by2, plate)} fill="#6b6155" stroke="#5b4a63" strokeWidth="3" />
      <polygon points={wallFace(bx2, by1, bx2, by2, plate)} fill="#6b6155" stroke="#5b4a63" strokeWidth="3" />
      <polygon points={wallFace(bx1, by2, bx2, by2, plate)} fill="#7c7061" stroke="#5b4a63" strokeWidth="3" />
      <polygon points={slab(bx1, by1, bx2, by2, plate)} fill="#8d8171" stroke="#5b4a63" strokeWidth="3" />
      {cells}
    </g>
  );
}

/* 카페 — 카운터, 2인 테이블, 앉으면 나오는 음료 */
function CafeProps({ R, seats = [] }) {
  const bar = proj(500, 70);
  return (
    <g>
      {/* 뒷벽 선반과 컵들 */}
      <rect x={330} y={70} width={340} height={14} fill="#d9a988" />
      <rect x={330} y={140} width={340} height={14} fill="#d9a988" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={344 + i * 46} y={40} width={18} height={30} rx="3"
          fill={i % 3 === 0 ? "#ffb9a8" : i % 3 === 1 ? "#fff4ec" : "#8fd8a8"} stroke="#8a5a3c" strokeWidth="2" />
      ))}
      {/* 메뉴판 */}
      <rect x={700} y={44} width={150} height={104} fill="#fff8f0" stroke="#8a5a3c" strokeWidth="4" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={716} y={62 + i * 22} width={118 - i * 14} height={7} fill="#e0bfa8" />
      ))}
      {/* 카운터 */}
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 56 * bar.k} width={460 * bar.k} height={66 * bar.k}
        fill="#d9a988" stroke="#8a5a3c" strokeWidth="4" />
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 56 * bar.k} width={460 * bar.k} height={13 * bar.k} fill="#f0cdb4" />
      {/* 커피 머신 */}
      <rect x={bar.sx + 90 * bar.k} y={bar.sy - 96 * bar.k} width={70 * bar.k} height={44 * bar.k}
        fill="#fff4ec" stroke="#8a5a3c" strokeWidth="3" />
      <circle cx={bar.sx + 125 * bar.k} cy={bar.sy - 74 * bar.k} r={9 * bar.k} fill="#e08a5c" />

      {/* 테이블과 의자 */}
      {CAFE_TABLES.map((t, n) => {
        const p = proj(t.x, t.y);
        const k = p.k;
        return (
          <g key={"t" + n}>
            <ellipse cx={p.sx} cy={p.sy} rx={62 * k} ry={34 * k} fill="#d9a988" stroke="#8a5a3c" strokeWidth="4" />
            <ellipse cx={p.sx} cy={p.sy - 9 * k} rx={62 * k} ry={34 * k} fill="#fff4ec" stroke="#8a5a3c" strokeWidth="4" />
          </g>
        );
      })}
      {CAFE_CHAIRS.map((c) => {
        const p = proj(c.x, c.y);
        const k = p.k;
        const taken = seats.includes(c.i);
        return (
          <g key={"c" + c.i}>
            <rect x={p.sx - 22 * k} y={p.sy - 30 * k} width={44 * k} height={18 * k}
              fill={taken ? "#ffb9a8" : "#d9a988"} stroke="#8a5a3c" strokeWidth="3" />
            <rect x={p.sx - 5 * k} y={p.sy - 14 * k} width={10 * k} height={16 * k} fill="#8a5a3c" />
          </g>
        );
      })}
      {/* 앉은 사람 앞에 음료 */}
      {seats.map((i) => {
        const c = CAFE_CHAIRS[i];
        if (!c) return null;
        const t = CAFE_TABLES[c.t];
        const jx = c.x < t.x ? t.x - 34 : t.x + 34;
        const p = proj(jx, t.y - 4);
        const k = p.k;
        return (
          <g key={"cup" + i}>
            <ellipse cx={p.sx} cy={p.sy + 2 * k} rx={12 * k} ry={5 * k} fill="#8a5a3c" opacity="0.3" />
            <rect x={p.sx - 10 * k} y={p.sy - 26 * k} width={20 * k} height={26 * k} rx={3 * k}
              fill="#fff8f0" stroke="#8a5a3c" strokeWidth="3" />
            <rect x={p.sx - 10 * k} y={p.sy - 26 * k} width={20 * k} height={8 * k} fill="#c98a5c" />
            <path d={`M${p.sx + 10 * k},${p.sy - 20 * k} q${8 * k},${3 * k} 0,${10 * k}`}
              stroke="#8a5a3c" strokeWidth="3" fill="none" />
          </g>
        );
      })}
    </g>
  );
}

/* 옷가게 — 전신거울 + 양옆 옷걸이 */
function DressProps() {
  const m = proj(500, 120);
  const k = m.k;
  const rack = (x) => {
    const p = proj(x, 320);
    const s = p.k;
    return (
      <g key={x}>
        <rect x={p.sx - 52 * s} y={p.sy - 140 * s} width={104 * s} height={12 * s}
          fill="#8b74e0" stroke="#5b4a63" strokeWidth="4" />
        <rect x={p.sx - 6 * s} y={p.sy - 132 * s} width={12 * s} height={132 * s}
          fill="#cdb9ee" stroke="#5b4a63" strokeWidth="4" />
        {["#ff8fb6", "#ffd45e", "#8fe3c9", "#4aa8e6"].map((c, i) => (
          <g key={i}>
            <rect x={p.sx + (-40 + i * 26) * s} y={p.sy - 132 * s} width={4 * s} height={14 * s} fill="#5b4a63" />
            <rect x={p.sx + (-48 + i * 26) * s} y={p.sy - 120 * s} width={20 * s} height={58 * s}
              fill={c} stroke="#5b4a63" strokeWidth="4" />
          </g>
        ))}
      </g>
    );
  };
  /* 📮 우체통 — 오른쪽 뒤편 */
  const post = proj(832, 150);
  const pk = post.k;
  return (
    <g>
      {rack(180)}
      {rack(760)}
      <g>
        {/* 기둥 */}
        <rect x={post.sx - 9 * pk} y={post.sy - 72 * pk} width={18 * pk} height={72 * pk}
          fill="#a98a5e" stroke="#5b4a63" strokeWidth="5" />
        {/* 몸통 */}
        <rect x={post.sx - 44 * pk} y={post.sy - 148 * pk} width={88 * pk} height={82 * pk}
          fill="#ff8fb6" stroke="#5b4a63" strokeWidth="5" />
        {/* 지붕 */}
        <rect x={post.sx - 50 * pk} y={post.sy - 162 * pk} width={100 * pk} height={18 * pk}
          fill="#e0688f" stroke="#5b4a63" strokeWidth="5" />
        {/* 넣는 구멍 */}
        <rect x={post.sx - 26 * pk} y={post.sy - 126 * pk} width={52 * pk} height={13 * pk}
          fill="#5b4a63" />
        {/* 하트 */}
        <rect x={post.sx - 13 * pk} y={post.sy - 104 * pk} width={26 * pk} height={16 * pk} fill="#fff0f6" />
        <rect x={post.sx - 18 * pk} y={post.sy - 99 * pk} width={36 * pk} height={7 * pk} fill="#fff0f6" />
        {/* 깃발 */}
        <rect x={post.sx + 44 * pk} y={post.sy - 168 * pk} width={7 * pk} height={44 * pk}
          fill="#5b4a63" />
        <rect x={post.sx + 49 * pk} y={post.sy - 168 * pk} width={26 * pk} height={20 * pk}
          fill="#ffd45e" stroke="#5b4a63" strokeWidth="4" />
      </g>
      {/* 전신거울 */}
      <rect x={m.sx - 130 * k} y={m.sy - 300 * k} width={260 * k} height={310 * k}
        fill="#8b74e0" stroke="#5b4a63" strokeWidth="7" />
      <rect x={m.sx - 108 * k} y={m.sy - 280 * k} width={216 * k} height={272 * k} fill="#e9dcff" />
      <rect x={m.sx - 108 * k} y={m.sy - 280 * k} width={62 * k} height={272 * k} fill="#fbf6ff" opacity="0.9" />
      <rect x={m.sx - 108 * k} y={m.sy - 280 * k} width={216 * k} height={16 * k} fill="#c9b8ff" />
      <rect x={m.sx - 46 * k} y={m.sy + 8 * k} width={92 * k} height={22 * k}
        fill="#8b74e0" stroke="#5b4a63" strokeWidth="5" />
      {/* 발판 */}
      <ellipse cx={proj(500, 300).sx} cy={proj(500, 300).sy} rx={120 * proj(500, 300).k} ry={44 * proj(500, 300).k}
        fill="#e2d3ff" stroke="#8b74e0" strokeWidth="5" />
    </g>
  );
}

/* ASMR — 커다란 모래밭 */
function SandProps({ R, broken = [], pressed = [] }) {
  const c = proj(500, 270);
  const k = depth(270);
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rr = 40 + ((i * 37) % 100);
    bits.push(
      <rect
        key={i}
        x={c.sx + Math.cos(a) * rr * k - 4}
        y={c.sy + Math.sin(a) * rr * 0.5 * k - 3}
        width={7}
        height={5}
        fill={i % 3 === 0 ? "#e8c98d" : i % 3 === 1 ? "#f7e3b8" : "#dcb976"}
      />
    );
  }
  return (
    <g>
      <ellipse cx={c.sx} cy={c.sy} rx={R.crunch.r * k} ry={R.crunch.r * 0.52 * k} fill="#e8c98d" stroke="#5b4a63" strokeWidth="5" />
      <ellipse cx={c.sx} cy={c.sy - 8 * k} rx={R.crunch.r * 0.86 * k} ry={R.crunch.r * 0.44 * k} fill="#f7e3b8" />
      {bits}
      {R.keys && <Keyboard keys={R.keys} pressed={pressed} />}
      {(R.balls || []).map((b) => {
        const p = proj(b.x, b.y);
        const k = p.k;
        const gone = broken.includes(b.i);
        if (gone) {
          /* 뿌셔진 자리 — 조각만 남습니다 */
          return (
            <g key={"ball" + b.i} opacity="0.85">
              {[-1, 0, 1].map((o) => (
                <rect
                  key={o}
                  x={p.sx + o * 13 * k - 4}
                  y={p.sy - 3 + Math.abs(o) * 3}
                  width={9 * k}
                  height={6 * k}
                  fill="#e07fa8"
                />
              ))}
            </g>
          );
        }
        return (
          <g key={"ball" + b.i}>
            <ellipse cx={p.sx} cy={p.sy + 3 * k} rx={17 * k} ry={6 * k} fill="#5b4a63" opacity="0.18" />
            <circle cx={p.sx} cy={p.sy - 14 * k} r={17 * k} fill="#ff9ec4" stroke="#5b4a63" strokeWidth="3" />
            <circle cx={p.sx - 6 * k} cy={p.sy - 20 * k} r={5 * k} fill="#ffffff" opacity="0.9" />
            <path
              d={`M${p.sx - 9 * k},${p.sy - 10 * k} l${6 * k},${-5 * k} l${5 * k},${4 * k}`}
              stroke="#e07fa8"
              strokeWidth="3"
              fill="none"
            />
          </g>
        );
      })}
    </g>
  );
}

function GachaProps({ R }) {
  const p = proj(500, 150);
  const k = p.k;
  const W = 300 * k;
  const H = 340 * k;
  const x = p.sx - W / 2;
  const y = p.sy - H + 40 * k;
  const balls = [
    ["#ff9ec4", 0.3, 0.3], ["#ffd45e", 0.52, 0.24], ["#8fe3c9", 0.7, 0.34],
    ["#b6a6f0", 0.36, 0.46], ["#7fc8f5", 0.6, 0.5], ["#ff9ec4", 0.48, 0.38],
    ["#ffd45e", 0.26, 0.55], ["#8fe3c9", 0.72, 0.55],
  ];
  return (
    <g>
      {/* 받침 */}
      <rect x={x} y={y + H * 0.66} width={W} height={H * 0.34} fill="#ffd45e" stroke="#5b4a63" strokeWidth="4" />
      <rect x={x + W * 0.3} y={y + H * 0.78} width={W * 0.4} height={H * 0.16} fill="#5b4a63" opacity="0.25" />
      {/* 손잡이 */}
      <circle cx={p.sx} cy={y + H * 0.74} r={16 * k} fill="#fff" stroke="#5b4a63" strokeWidth="4" />
      <rect x={p.sx - 3 * k} y={y + H * 0.68} width={6 * k} height={12 * k} fill="#5b4a63" />
      {/* 유리통 */}
      <circle cx={p.sx} cy={y + H * 0.34} r={W * 0.46} fill="#eaf6ff" stroke="#5b4a63" strokeWidth="4" />
      {balls.map(([c, bx, by], i) => (
        <circle
          key={i}
          className="ccGachaBall"
          style={{ animationDelay: `${i * 0.35}s` }}
          cx={x + W * bx}
          cy={y + H * by}
          r={17 * k}
          fill={c}
          stroke="#5b4a63"
          strokeWidth="3"
        />
      ))}
      <ellipse cx={p.sx - W * 0.16} cy={y + H * 0.18} rx={W * 0.12} ry={H * 0.07} fill="#fff" opacity="0.65" />
      {/* 간판 */}
      <rect x={x + W * 0.1} y={y - 34 * k} width={W * 0.8} height={34 * k} fill={R.accent} stroke="#5b4a63" strokeWidth="4" />
      <text x={p.sx} y={y - 11 * k} textAnchor="middle" fontSize={20 * k} fontWeight="900" fill="#5b4a63">
        오늘 뭐 먹지?
      </text>
    </g>
  );
}

