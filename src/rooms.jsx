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
    floor: "#eaf6ff",
    floorLine: "#eaf6ff",
    wall: "#f2fbff",
    wallDark: "#cfe9fb",
    side: "#ddf2ff",
    accent: "#bfe9ff",
    hint: "물에 들어가면 헤엄쳐요. 첨벙!",
    play: PLAY,
    blocks: [],
    water: { x: 500, y: 260, w: 620, d: 300 },
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
    /* 왁뿌볼 — 밟으면 뿌셔집니다 */
    balls: [
      { i: 0, x: 220, y: 120 }, { i: 1, x: 780, y: 130 }, { i: 2, x: 160, y: 330 },
      { i: 3, x: 840, y: 340 }, { i: 4, x: 330, y: 450 }, { i: 5, x: 670, y: 460 },
      { i: 6, x: 500, y: 90 },  { i: 7, x: 500, y: 470 },
    ],
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
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
    hint: "아직 준비중이에요",
    play: PLAY,
    blocks: [],
    soon: true,
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },
};

/* ---------- 방 배경(벽/바닥/가구) ---------- */

export function RoomStage({ room, children, waterPhase, seats = [], broken = [] }) {
  const R = room;
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
      {R.id === "flower" && <SandProps R={R} broken={broken} />}
      {R.id === "carousel" && <SoonProps R={R} />}

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
      <rect x={280} y={40} width={440} height={230} fill="#eafff8" stroke={R.accent} strokeWidth="6" />
      <text x={500} y={165} textAnchor="middle" fontSize="46" fontWeight="900" fill="#2f8f74">
        Q U I Z
      </text>
      <rect x={stage.sx - 130 * stage.k} y={stage.sy - 26 * stage.k} width={260 * stage.k} height={40 * stage.k} fill="#8fe3c9" stroke="#5b4a63" strokeWidth="4" />
      <text x={stage.sx} y={stage.sy + 4 * stage.k} textAnchor="middle" fontSize={17 * stage.k} fontWeight="700" fill="#5b4a63">
        정답 단상
      </text>
    </g>
  );
}

/* 수영장 — 물 + 물결 + 레인 */
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

/* ASMR — 커다란 모래밭 */
function SandProps({ R, broken = [] }) {
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

function SoonProps({ R }) {
  return (
    <g>
      <rect x={300} y={70} width={400} height={150} fill="#f5f1ff" stroke={R.accent} strokeWidth="6" />
      <text x={500} y={140} textAnchor="middle" fontSize="42" fontWeight="900" fill="#6a56b8">
        준비중
      </text>
      <text x={500} y={185} textAnchor="middle" fontSize="20" fontWeight="700" fill="#5b4a63">
        곧 문 열어요
      </text>
    </g>
  );
}
