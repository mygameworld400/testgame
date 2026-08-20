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

/* 원형 장애물을 사각 박스로 */
const box = (x, y, w, h) => ({ x1: x - w / 2, x2: x + w / 2, y1: y - h / 2, y2: y + h / 2 });

export const ROOMS = {
  /* 🎧 리스닝바 — 가운데 바텐더 + 원형 테이블 + 의자 6개 + 오른쪽 LP */
  cake: {
    id: "cake",
    name: "리스닝바",
    emoji: "🎧",
    floor: "#6b4a5c",
    floorLine: "#7d5a6d",
    wall: "#3d2b3f",
    wallDark: "#2e2031",
    side: "#4a3446",
    accent: "#ff8fb6",
    hint: "가운데는 바, 오른쪽 LP 를 누르면 플레이리스트가 열려요",
    play: PLAY,
    blocks: [box(500, 210, 300, 150), box(500, 60, 420, 90)],
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
    floor: "#2f6f60",
    floorLine: "#3c8474",
    wall: "#1f4a41",
    wallDark: "#17372f",
    side: "#265a4f",
    accent: "#8fe3c9",
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
    floor: "#cfe3ee",
    floorLine: "#b7d3e2",
    wall: "#bfe6ff",
    wallDark: "#9ed3f5",
    side: "#d8eef8",
    accent: "#4aa8e6",
    hint: "물에 들어가면 헤엄쳐요. 첨벙!",
    play: PLAY,
    blocks: [],
    water: { x: 500, y: 260, w: 620, d: 300 },
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },

  /* 🎙️ ASMR 타운 — 가운데 커다란 갈색 낙엽 더미 */
  flower: {
    id: "flower",
    name: "ASMR 타운",
    emoji: "🎙️",
    floor: "#5a4433",
    floorLine: "#6b523e",
    wall: "#3a2b20",
    wallDark: "#2b2018",
    side: "#463426",
    accent: "#c98a4b",
    hint: "가운데 낙엽 더미를 밟으면 소리가 나요",
    play: PLAY,
    blocks: [],
    crunch: { x: 500, y: 270, r: 150 },
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },

  /* 🍜 먹방탭 — 준비중 */
  carousel: {
    id: "carousel",
    name: "먹방탭",
    emoji: "🍜",
    floor: "#4a4258",
    floorLine: "#585070",
    wall: "#332d42",
    wallDark: "#272233",
    side: "#3d3650",
    accent: "#ffd45e",
    hint: "아직 준비중이에요",
    play: PLAY,
    blocks: [],
    soon: true,
    zones: [{ id: "exit", x: 500, y: ROOM.d - 10, r: 110, label: "나가기" }],
  },
};

/* ---------- 방 배경(벽/바닥/가구) ---------- */

export function RoomStage({ room, children, waterPhase }) {
  const R = room;
  const fl = proj(0, 0);
  const fr = proj(ROOM.w, 0);
  const nl = proj(0, ROOM.d);
  const nr = proj(ROOM.w, ROOM.d);

  /* 바닥 격자 */
  const lines = [];
  for (let i = 1; i < 8; i++) {
    const y = (ROOM.d / 8) * i;
    const a = proj(0, y);
    const b = proj(ROOM.w, y);
    lines.push(<line key={"h" + i} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={R.floorLine} strokeWidth="3" />);
  }
  for (let i = 1; i < 10; i++) {
    const x = (ROOM.w / 10) * i;
    const a = proj(x, 0);
    const b = proj(x, ROOM.d);
    lines.push(<line key={"v" + i} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={R.floorLine} strokeWidth="3" />);
  }

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
      {lines}

      {/* 방마다 다른 설치물 */}
      {R.id === "cake" && <BarProps R={R} />}
      {R.id === "candy" && <QuizProps R={R} />}
      {R.id === "post" && <PoolProps R={R} phase={waterPhase} />}
      {R.id === "flower" && <LeafProps R={R} />}
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
      <rect x={p.sx - w / 2} y={p.sy - 16} width={w} height={22} fill="#5b4a63" opacity="0.35" />
      <text x={p.sx} y={p.sy + 4} textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">
        ▼ 나가기
      </text>
    </g>
  );
}

/* 리스닝바 — 바텐더 자리, 원형 테이블, 의자 6개, LP */
function BarProps({ R }) {
  const bar = proj(500, 60);
  const table = proj(500, 210);
  const chairs = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    const cx = 500 + Math.cos(a) * 210;
    const cy = 210 + Math.sin(a) * 120;
    const p = proj(cx, cy);
    chairs.push(
      <g key={i}>
        <rect x={p.sx - 26 * p.k} y={p.sy - 34 * p.k} width={52 * p.k} height={20 * p.k} fill="#8a5f75" stroke="#3d2b3f" strokeWidth="3" />
        <rect x={p.sx - 6 * p.k} y={p.sy - 16 * p.k} width={12 * p.k} height={18 * p.k} fill="#3d2b3f" />
      </g>
    );
  }
  return (
    <g>
      {/* 뒷벽 선반 */}
      <rect x={330} y={60} width={340} height={16} fill="#8a5f75" />
      <rect x={330} y={130} width={340} height={16} fill="#8a5f75" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={344 + i * 46} y={26} width={18} height={34} fill={i % 2 ? "#ffd45e" : "#ff8fb6"} />
      ))}
      {/* 바 카운터 */}
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 60 * bar.k} width={460 * bar.k} height={70 * bar.k} fill="#8a5f75" stroke="#3d2b3f" strokeWidth="4" />
      <rect x={bar.sx - 230 * bar.k} y={bar.sy - 60 * bar.k} width={460 * bar.k} height={14 * bar.k} fill="#c78ea6" />
      {/* 원형 테이블 */}
      <ellipse cx={table.sx} cy={table.sy} rx={150 * table.k} ry={80 * table.k} fill="#8a5f75" stroke="#3d2b3f" strokeWidth="4" />
      <ellipse cx={table.sx} cy={table.sy - 10 * table.k} rx={150 * table.k} ry={80 * table.k} fill="#a9748d" stroke="#3d2b3f" strokeWidth="4" />
      {chairs}
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
      <rect x={p.sx - r - 10} y={p.sy - r - 10} width={(r + 10) * 2} height={(r + 10) * 2} fill="#2e2031" stroke="#ff8fb6" strokeWidth="4" />
      <circle cx={p.sx} cy={p.sy} r={r} fill="#15101a" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.62} fill="none" stroke="#3a2f42" strokeWidth="3" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.34} fill="#ff8fb6" />
      <circle cx={p.sx} cy={p.sy} r={r * 0.08} fill="#15101a" />
      <text x={p.sx} y={p.sy + r + 34} textAnchor="middle" fontSize="17" fontWeight="700" fill="#ffd6e6">
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
      <rect x={280} y={40} width={440} height={230} fill="#0f2b26" stroke={R.accent} strokeWidth="6" />
      <text x={500} y={165} textAnchor="middle" fontSize="46" fontWeight="900" fill={R.accent}>
        Q U I Z
      </text>
      <rect x={stage.sx - 130 * stage.k} y={stage.sy - 26 * stage.k} width={260 * stage.k} height={40 * stage.k} fill="#3c8474" stroke="#17372f" strokeWidth="4" />
      <text x={stage.sx} y={stage.sy + 4 * stage.k} textAnchor="middle" fontSize={17 * stage.k} fontWeight="700" fill="#dffaee">
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
        fill="#4aa8e6"
        stroke="#2f7fb8"
        strokeWidth="6"
      />
      <polygon
        points={`${back.sx},${back.sy} ${back2.sx},${back2.sy} ${front2.sx},${front2.sy} ${front.sx},${front.sy}`}
        fill="#7fd2f7"
        opacity="0.55"
      />
      {waves}
      {/* 튜브 */}
      <ellipse cx={proj(760, 180).sx} cy={proj(760, 180).sy} rx={54 * depth(180)} ry={26 * depth(180)} fill="#ff8fb6" stroke="#ef6f9c" strokeWidth="4" />
      <ellipse cx={proj(760, 180).sx} cy={proj(760, 180).sy} rx={24 * depth(180)} ry={11 * depth(180)} fill="#7fd2f7" />
    </g>
  );
}

/* ASMR — 커다란 갈색 낙엽 더미 */
function LeafProps({ R }) {
  const c = proj(500, 270);
  const k = depth(270);
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rr = 40 + ((i * 37) % 100);
    bits.push(
      <rect
        key={i}
        x={c.sx + Math.cos(a) * rr * k - 9}
        y={c.sy + Math.sin(a) * rr * 0.5 * k - 6}
        width={18}
        height={12}
        fill={i % 3 === 0 ? "#e0a25c" : i % 3 === 1 ? "#c98a4b" : "#a86f39"}
      />
    );
  }
  return (
    <g>
      <ellipse cx={c.sx} cy={c.sy} rx={R.crunch.r * k} ry={R.crunch.r * 0.52 * k} fill="#8a5a2f" stroke="#5f3d1f" strokeWidth="5" />
      <ellipse cx={c.sx} cy={c.sy - 8 * k} rx={R.crunch.r * 0.86 * k} ry={R.crunch.r * 0.44 * k} fill="#a86f39" />
      {bits}
    </g>
  );
}

function SoonProps({ R }) {
  return (
    <g>
      <rect x={300} y={70} width={400} height={150} fill="#272233" stroke={R.accent} strokeWidth="6" />
      <text x={500} y={140} textAnchor="middle" fontSize="42" fontWeight="900" fill={R.accent}>
        준비중
      </text>
      <text x={500} y={185} textAnchor="middle" fontSize="20" fontWeight="700" fill="#cdc6df">
        곧 문 열어요
      </text>
    </g>
  );
}
