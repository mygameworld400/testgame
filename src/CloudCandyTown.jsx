import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasCloud, initCloud, loadCloud, loadLocal, saveCloud, saveLocal } from "./save.js";

/* ===========================================================
   구름사탕 마을 — 구름 위에 떠 있는 파스텔 사탕 마을
   방향키(또는 WASD)로 걷고, 건물 앞에서 Space 로 들어가요.
   =========================================================== */

const WORLD = { w: 1700, h: 1080 };
/* 섬 밖으로 못 나가게 막는 걷기 가능 영역 */
const PLAY = { x0: 150, y0: 230, x1: 1550, y1: 960 };

const C = {
  sky1: "#c9e9ff",
  sky2: "#ffe3f1",
  sky3: "#fff6dc",
  island: "#c6f2df",
  islandDark: "#a3e4cb",
  islandEdge: "#8ad9bd",
  soil: "#ffd9ec",
  soilDark: "#f7b9d8",
  path: "#fff4dc",
  pathEdge: "#f5dfae",
  pond: "#a9e4ff",
  pondDeep: "#7fd2f7",
  ink: "#6b5570",
  inkSoft: "#9d86a3",
  cream: "#fffaf2",
};

const BUILDINGS = [
  {
    id: "cake",
    name: "폭신폭신 케이크 카페",
    emoji: "🍰",
    tag: "카페",
    shape: "dome",
    x: 400,
    y: 470,
    w: 250,
    h: 240,
    body: "#fff0f6",
    roof: "#ffa8cd",
    roofDark: "#f88bb9",
    accent: "#ff7fb0",
    lines: [
      "딸기 생크림 한 조각 드릴까요? 오늘은 유난히 폭신하게 구워졌어요.",
      "창가 자리가 비었어요. 구름이 지나가는 게 제일 잘 보이는 자리랍니다.",
      "설탕을 너무 많이 넣어서 케이크가 살짝 떠올랐어요. 붙잡아 주세요!",
    ],
  },
  {
    id: "candy",
    name: "알록달록 사탕가게",
    emoji: "🍭",
    tag: "상점",
    shape: "awning",
    x: 830,
    y: 400,
    w: 260,
    h: 220,
    body: "#eafff6",
    roof: "#8fe3c9",
    roofDark: "#6fd3b6",
    accent: "#4ec9a6",
    lines: [
      "오늘의 사탕은 '무지개 소용돌이' 맛이에요. 세 번 핥으면 색이 바뀌어요.",
      "막대사탕 나무에서 방금 딴 신선한 사탕이에요!",
      "너무 크게 부풀린 풍선껌은 지붕 위로 날아가 버렸어요… 보이면 알려주세요.",
    ],
  },
  {
    id: "post",
    name: "토끼 우체국",
    emoji: "💌",
    tag: "우편",
    shape: "gable",
    x: 1290,
    y: 490,
    w: 240,
    h: 240,
    body: "#f3eeff",
    roof: "#b6a6f0",
    roofDark: "#9b88e4",
    accent: "#8b74e0",
    lines: [
      "편지 한 통 부치실래요? 토끼가 귀를 펄럭이며 배달해 드려요.",
      "구름 너머 마을까지도 이틀이면 도착해요. 비 오는 날엔 하루 더요.",
      "분홍 봉투에 넣으면 받는 사람이 열 때 반짝이가 쏟아져요. 인기 상품!",
    ],
  },
  {
    id: "flower",
    name: "몽글몽글 꽃집",
    emoji: "🌷",
    tag: "꽃집",
    shape: "green",
    x: 620,
    y: 830,
    w: 250,
    h: 210,
    body: "#fffbe8",
    roof: "#ffd98a",
    roofDark: "#f7c463",
    accent: "#f0b23f",
    lines: [
      "이 화분은 물을 주면 노래를 불러요. 가끔 음이 틀리지만 귀여워요.",
      "구름솜 튤립이 오늘 아침에 활짝 폈어요. 만지면 폭신해요!",
      "꽃다발 하나 만들어 드릴까요? 리본 색은 마음대로 고르세요.",
    ],
  },
  {
    id: "carousel",
    name: "별빛 회전목마",
    emoji: "🎠",
    tag: "놀이터",
    shape: "carousel",
    x: 1150,
    y: 850,
    w: 270,
    h: 260,
    body: "#eaf6ff",
    roof: "#7fc8f5",
    roofDark: "#5fb4ea",
    accent: "#4aa8e6",
    lines: [
      "한 바퀴 돌 때마다 별가루가 조금씩 떨어져요. 눈 감지 말고 보세요!",
      "제일 앞자리 유니콘은 언제나 인기 만점이에요. 지금은 비어 있어요!",
      "해 질 무렵에 타면 목마들이 진짜로 하늘을 달리는 것처럼 보여요.",
    ],
  },
];

/* 반짝이 별 — 주우면 모을 수 있어요 */
const STAR_SPOTS = [
  [260, 700], [560, 620], [780, 900], [1000, 560], [1180, 690],
  [1440, 790], [980, 300], [430, 320], [1420, 350], [700, 950],
];

/* 배경 구름(시차 스크롤) */
const CLOUDS = [
  [120, 120, 1.25], [520, 60, 0.9], [900, 150, 1.5], [1320, 80, 1.0],
  [1600, 200, 1.2], [300, 260, 0.8], [1100, 40, 0.75],
];

/* 막대사탕 나무 */
const TREES = [
  [230, 560, "#ff9ec4"], [330, 880, "#8fe3c9"], [980, 470, "#ffd98a"],
  [1470, 620, "#b6a6f0"], [860, 700, "#ff9ec4"], [1330, 970, "#8fe3c9"],
  [520, 400, "#ffd98a"], [1050, 990, "#b6a6f0"],
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const SAVE_TEXT = {
  off: "이 기기에만 저장",
  local: "이 기기에만 저장",
  cloud: "서버까지 저장",
};

/* 건물의 발치 충돌 박스 */
function blockBox(b) {
  return {
    x1: b.x - b.w * 0.34,
    x2: b.x + b.w * 0.34,
    y1: b.y - b.h * 0.28,
    y2: b.y + 10,
  };
}

/* ============================ 건물 그림 ============================ */

function Building({ b, near }) {
  const S = 200; // 로컬 좌표계
  return (
    <div
      className={"ccBuilding" + (near ? " ccNear" : "")}
      style={{
        left: b.x - b.w / 2,
        top: b.y - b.h,
        width: b.w,
        height: b.h + 26,
      }}
    >
      <svg viewBox={`0 0 ${S} ${S + 24}`} width="100%" height="100%">
        {/* 바닥 그림자 */}
        <ellipse cx="100" cy={S + 8} rx="78" ry="14" fill="#000" opacity="0.08" />

        {b.shape === "dome" && <CakeShop b={b} />}
        {b.shape === "awning" && <CandyShop b={b} />}
        {b.shape === "gable" && <PostOffice b={b} />}
        {b.shape === "green" && <FlowerShop b={b} />}
        {b.shape === "carousel" && <Carousel b={b} />}
      </svg>

      <div className="ccSign">
        <span className="ccSignEmoji">{b.emoji}</span>
        {b.name}
      </div>

      {near && (
        <div className="ccPrompt">
          <b>Space</b> 로 들어가기 ✨
        </div>
      )}
    </div>
  );
}

/* 공통 부품 */
const Window = ({ x, y, r = 14, fill = "#eaf6ff", stroke }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth="4" />
    <path d={`M${x - r + 3},${y} h${r * 2 - 6}`} stroke={stroke} strokeWidth="3" opacity="0.5" />
    <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.85" />
  </g>
);

const Door = ({ cx, y, w = 34, h = 48, fill, stroke }) => (
  <g>
    <path
      d={`M${cx - w / 2},${y} v${-(h - w / 2)} a${w / 2},${w / 2} 0 0 1 ${w},0 v${h - w / 2} z`}
      fill={fill}
      stroke={stroke}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <circle cx={cx + w / 2 - 9} cy={y - h / 2 + 4} r="3.2" fill={stroke} />
  </g>
);

function CakeShop({ b }) {
  return (
    <g>
      {/* 몸통 — 케이크 시트 */}
      <rect x="26" y="92" width="148" height="108" rx="18" fill={b.body} stroke={b.accent} strokeWidth="4" />
      <rect x="26" y="150" width="148" height="16" fill="#ffe0ee" opacity="0.9" />
      {/* 돔 지붕 */}
      <path d="M18,96 Q100,4 182,96 z" fill={b.roof} stroke={b.roofDark} strokeWidth="4" strokeLinejoin="round" />
      {/* 크림 흘러내림 */}
      <path
        d="M18,94 q12,22 24,2 q12,22 24,2 q12,22 24,2 q12,22 24,2 q12,22 24,2 q12,22 24,2 q9,14 24,-14"
        fill={C.cream}
        stroke="#ffd7e8"
        strokeWidth="2"
      />
      {/* 체리 */}
      <path d="M100,26 q10,-12 16,-16" stroke="#6cc08a" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="30" r="11" fill="#ff7a9c" stroke="#ef5f85" strokeWidth="3" />
      <circle cx="96" cy="26" r="3.4" fill="#fff" opacity="0.9" />
      <Window x="56" y="124" r="15" stroke={b.accent} />
      <Window x="144" y="124" r="15" stroke={b.accent} />
      <Door cx={100} y={200} w={38} h={56} fill="#ffd0e4" stroke={b.accent} />
      <circle cx="100" cy="168" r="6" fill="#fff" opacity="0.7" />
    </g>
  );
}

function CandyShop({ b }) {
  const stripes = [];
  for (let i = 0; i < 7; i++) {
    stripes.push(
      <path
        key={i}
        d={`M${22 + i * 22},74 h22 v22 a11,11 0 0 1 -22,0 z`}
        fill={i % 2 ? "#ffffff" : b.roof}
        stroke={b.roofDark}
        strokeWidth="2.5"
      />
    );
  }
  return (
    <g>
      <rect x="30" y="86" width="140" height="114" rx="16" fill={b.body} stroke={b.accent} strokeWidth="4" />
      {/* 평지붕 + 사탕 줄무늬 차양 */}
      <rect x="18" y="58" width="164" height="20" rx="9" fill={b.roofDark} />
      <rect x="24" y="46" width="152" height="16" rx="8" fill={b.roof} stroke={b.roofDark} strokeWidth="3" />
      {stripes}
      {/* 진열창 */}
      <rect x="44" y="108" width="52" height="44" rx="10" fill="#eafffb" stroke={b.accent} strokeWidth="4" />
      <circle cx="58" cy="126" r="7" fill="#ff9ec4" />
      <circle cx="74" cy="132" r="6" fill="#ffd98a" />
      <circle cx="86" cy="121" r="5" fill="#b6a6f0" />
      <Door cx={140} y={200} w={36} h={54} fill="#d5fbee" stroke={b.accent} />
      {/* 막대사탕 간판 */}
      <g transform="translate(158,104)">
        <path d="M0,0 v26" stroke="#e8dcc8" strokeWidth="5" strokeLinecap="round" />
        <circle cx="0" cy="-8" r="13" fill="#fff" stroke={b.accent} strokeWidth="3" />
        <path d="M-8,-8 a8,8 0 0 1 8,-8 a4,4 0 0 1 0,8 a4,4 0 0 0 0,8 a8,8 0 0 1 -8,-8" fill="#ff9ec4" />
      </g>
    </g>
  );
}

function PostOffice({ b }) {
  return (
    <g>
      <rect x="34" y="98" width="132" height="102" rx="16" fill={b.body} stroke={b.accent} strokeWidth="4" />
      {/* 뾰족지붕 */}
      <path d="M100,16 L182,102 L18,102 z" fill={b.roof} stroke={b.roofDark} strokeWidth="4" strokeLinejoin="round" />
      {/* 토끼 귀 */}
      <ellipse cx="82" cy="26" rx="9" ry="24" fill="#fff" stroke={b.roofDark} strokeWidth="3" transform="rotate(-16 82 26)" />
      <ellipse cx="118" cy="26" rx="9" ry="24" fill="#fff" stroke={b.roofDark} strokeWidth="3" transform="rotate(16 118 26)" />
      <ellipse cx="82" cy="28" rx="4" ry="14" fill="#ffc6dd" transform="rotate(-16 82 28)" />
      <ellipse cx="118" cy="28" rx="4" ry="14" fill="#ffc6dd" transform="rotate(16 118 28)" />
      {/* 하트 편지 창 */}
      <circle cx="100" cy="76" r="16" fill="#fff" stroke={b.roofDark} strokeWidth="3" />
      <path d="M100,84 C88,74 90,62 100,68 C110,62 112,74 100,84 z" fill="#ff8fb6" />
      <Window x="62" y="130" r="14" stroke={b.accent} />
      <Window x="138" y="130" r="14" stroke={b.accent} />
      <Door cx={100} y={200} w={36} h={52} fill="#e2d8ff" stroke={b.accent} />
      {/* 우체통 */}
      <g transform="translate(168,158)">
        <rect x="-11" y="0" width="22" height="34" rx="9" fill="#ff8fb6" stroke="#ef6f9c" strokeWidth="3" />
        <rect x="-7" y="9" width="14" height="4" rx="2" fill="#fff" />
        <path d="M0,34 v10" stroke="#c9a97f" strokeWidth="5" strokeLinecap="round" />
      </g>
    </g>
  );
}

function FlowerShop({ b }) {
  const panes = [];
  for (let i = 1; i < 4; i++) {
    panes.push(<path key={"v" + i} d={`M${40 + i * 30},70 v130`} stroke={b.accent} strokeWidth="3" opacity="0.55" />);
  }
  return (
    <g>
      {/* 온실 아치 */}
      <path
        d="M28,200 v-84 a72,72 0 0 1 144,0 v84 z"
        fill={b.body}
        stroke={b.accent}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M28,116 a72,72 0 0 1 144,0" fill={b.roof} opacity="0.55" />
      {panes}
      <path d="M28,130 h144" stroke={b.accent} strokeWidth="3" opacity="0.55" />
      <path d="M28,168 h144" stroke={b.accent} strokeWidth="3" opacity="0.55" />
      {/* 지붕 리본 */}
      <path d="M100,36 l-16,-14 a10,10 0 0 1 16,-6 a10,10 0 0 1 16,6 z" fill="#ff9ec4" stroke="#ef7fae" strokeWidth="3" strokeLinejoin="round" />
      <Door cx={100} y={200} w={38} h={56} fill="#fff1c9" stroke={b.accent} />
      {/* 화단 */}
      <g>
        <rect x="20" y="182" width="52" height="22" rx="9" fill="#f7c463" stroke="#e0a93f" strokeWidth="3" />
        <circle cx="32" cy="178" r="7" fill="#ff9ec4" />
        <circle cx="46" cy="174" r="7" fill="#b6a6f0" />
        <circle cx="60" cy="178" r="7" fill="#8fe3c9" />
        <rect x="128" y="182" width="52" height="22" rx="9" fill="#f7c463" stroke="#e0a93f" strokeWidth="3" />
        <circle cx="140" cy="178" r="7" fill="#8fe3c9" />
        <circle cx="154" cy="174" r="7" fill="#ff9ec4" />
        <circle cx="168" cy="178" r="7" fill="#ffd98a" />
      </g>
    </g>
  );
}

function Carousel({ b }) {
  const poles = [42, 78, 122, 158];
  const canopy = [];
  for (let i = 0; i < 6; i++) {
    canopy.push(
      <path
        key={i}
        d={`M100,34 L${28 + i * 24},96 L${28 + (i + 1) * 24},96 z`}
        fill={i % 2 ? "#ffffff" : b.roof}
        stroke={b.roofDark}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <g>
      {/* 바닥 단 */}
      <ellipse cx="100" cy="190" rx="84" ry="20" fill="#eaf6ff" stroke={b.accent} strokeWidth="4" />
      <ellipse cx="100" cy="182" rx="84" ry="20" fill={b.body} stroke={b.accent} strokeWidth="4" />
      {/* 기둥 */}
      {poles.map((x, i) => (
        <g key={i}>
          <path d={`M${x},96 v82`} stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
          <path d={`M${x},96 v82`} stroke="#ff9ec4" strokeWidth="3.5" strokeDasharray="9 9" strokeLinecap="round" />
        </g>
      ))}
      {/* 목마 */}
      <g className="ccHorse">
        <ellipse cx="100" cy="146" rx="26" ry="17" fill="#fff" stroke={b.accent} strokeWidth="3" />
        <path d="M118,138 q10,-6 12,-16 q6,4 4,12 q-2,8 -12,10 z" fill="#fff" stroke={b.accent} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="126" cy="130" r="2.6" fill={C.ink} />
        <path d="M86,156 v14 M112,156 v14" stroke={b.accent} strokeWidth="4" strokeLinecap="round" />
        <path d="M78,142 q-10,6 -12,16" stroke="#ff9ec4" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      {/* 캐노피 */}
      {canopy}
      <path d="M26,96 q74,18 148,0 q-6,12 -14,14 q-60,12 -120,0 q-8,-2 -14,-14 z" fill={b.roofDark} opacity="0.9" />
      {/* 꼭대기 별 */}
      <path
        d="M100,4 l6.6,13.6 15,2.2 -10.8,10.6 2.6,15 -13.4,-7.1 -13.4,7.1 2.6,-15 -10.8,-10.6 15,-2.2 z"
        fill="#ffd98a"
        stroke="#f0b23f"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="ccTwinkle"
      />
    </g>
  );
}

/* ============================ 주인공 ============================ */

function Player({ x, y, facing, moving }) {
  return (
    <div className="ccPlayer" style={{ left: x, top: y }}>
      <svg viewBox="0 0 60 66" width="60" height="66" className={moving ? "ccBob" : ""}>
        <ellipse cx="30" cy="61" rx="17" ry="5" fill="#000" opacity="0.12" />
        <g transform={facing < 0 ? "translate(60,0) scale(-1,1)" : undefined}>
          {/* 귀 */}
          <ellipse cx="18" cy="12" rx="7" ry="11" fill="#fff" stroke="#e6cfe0" strokeWidth="2.5" transform="rotate(-14 18 12)" />
          <ellipse cx="42" cy="12" rx="7" ry="11" fill="#fff" stroke="#e6cfe0" strokeWidth="2.5" transform="rotate(14 42 12)" />
          <ellipse cx="18" cy="13" rx="3" ry="6" fill="#ffc6dd" transform="rotate(-14 18 13)" />
          <ellipse cx="42" cy="13" rx="3" ry="6" fill="#ffc6dd" transform="rotate(14 42 13)" />
          {/* 몸 */}
          <path d="M30,20 a20,20 0 0 1 20,20 v6 a20,20 0 0 1 -40,0 v-6 a20,20 0 0 1 20,-20 z" fill="#fff" stroke="#e6cfe0" strokeWidth="2.5" />
          {/* 목도리 */}
          <path d="M13,42 q17,9 34,0 v6 q-17,9 -34,0 z" fill="#ff9ec4" stroke="#ef7fae" strokeWidth="2" strokeLinejoin="round" />
          {/* 얼굴 */}
          <ellipse cx="23" cy="34" rx="2.8" ry="3.6" fill="#5b4a63" />
          <ellipse cx="37" cy="34" rx="2.8" ry="3.6" fill="#5b4a63" />
          <circle cx="17" cy="40" r="4" fill="#ffb3cf" opacity="0.75" />
          <circle cx="43" cy="40" r="4" fill="#ffb3cf" opacity="0.75" />
          <path d="M27,40 q3,3 6,0" stroke="#5b4a63" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/* ============================ 바닥 ============================ */

const GRASS_DOTS = (() => {
  const dots = [];
  const cols = ["#ffffff", "#ffd1e6", "#ffe9a8", "#c9b8ff"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 120; i++) {
    const x = 140 + rnd() * (WORLD.w - 280);
    const y = 210 + rnd() * 700;
    dots.push([x, y, cols[i % cols.length], 3 + rnd() * 4]);
  }
  return dots;
})();

function Ground() {
  return (
    <svg className="ccGround" viewBox={`0 0 ${WORLD.w} ${WORLD.h}`} width={WORLD.w} height={WORLD.h}>
      <defs>
        <linearGradient id="ccGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor={C.islandDark} stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* 떠 있는 섬 아랫부분 */}
      <path
        d="M170,760 q-40,150 120,190 q140,120 300,60 q120,90 260,10 q160,70 300,-40 q200,-30 190,-190 q30,-120 -60,-180 z"
        fill={C.soilDark}
        opacity="0.55"
      />
      <path
        d="M150,700 q-30,120 110,160 q130,110 300,50 q120,80 260,0 q160,60 290,-50 q180,-30 170,-170 z"
        fill={C.soil}
      />
      {/* 잔디 */}
      <rect x="90" y="150" width={WORLD.w - 180} height="640" rx="180" fill={C.islandEdge} />
      <rect x="100" y="158" width={WORLD.w - 200} height="620" rx="172" fill={C.island} />
      <rect x="100" y="158" width={WORLD.w - 200} height="620" rx="172" fill="url(#ccGrad)" opacity="0.5" />

      {/* 길 */}
      <g stroke={C.pathEdge} strokeWidth="66" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
        <path d="M400,500 Q620,560 850,430 Q1080,330 1290,520" />
        <path d="M850,470 Q880,700 620,850" />
        <path d="M850,470 Q1000,720 1150,860" />
      </g>
      <g stroke={C.path} strokeWidth="54" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M400,500 Q620,560 850,430 Q1080,330 1290,520" />
        <path d="M850,470 Q880,700 620,850" />
        <path d="M850,470 Q1000,720 1150,860" />
      </g>

      {/* 연못 */}
      <ellipse cx="1440" cy="880" rx="112" ry="66" fill={C.pondDeep} opacity="0.75" />
      <ellipse cx="1440" cy="872" rx="104" ry="58" fill={C.pond} />
      <ellipse cx="1408" cy="856" rx="26" ry="12" fill="#fff" opacity="0.55" />

      {/* 잔디 무늬 꽃 */}
      {GRASS_DOTS.map(([x, y, c, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={c} opacity="0.75" />
      ))}
    </svg>
  );
}

function LollipopTree({ x, y, color, delay }) {
  return (
    <div className="ccTree" style={{ left: x - 40, top: y - 110, zIndex: Math.round(y), animationDelay: `${delay}s` }}>
      <svg viewBox="0 0 80 120" width="80" height="120">
        <ellipse cx="40" cy="114" rx="20" ry="6" fill="#000" opacity="0.1" />
        <path d="M40,114 v-44" stroke="#e9d9bd" strokeWidth="8" strokeLinecap="round" />
        <circle cx="40" cy="44" r="30" fill="#fff" stroke={color} strokeWidth="4" />
        <path d="M20,44 a20,20 0 0 1 20,-20 a10,10 0 0 1 0,20 a10,10 0 0 0 0,20 a20,20 0 0 1 -20,-20" fill={color} />
        <circle cx="30" cy="32" r="5" fill="#fff" opacity="0.85" />
      </svg>
    </div>
  );
}

/* ============================ 메인 ============================ */

export default function CloudCandyTown() {
  const [pos, setPos] = useState({ x: 850, y: 640 });
  const [facing, setFacing] = useState(1);
  const [moving, setMoving] = useState(false);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [view, setView] = useState({ w: 1000, h: 700 });
  const [nearId, setNearId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [line, setLine] = useState("");
  const [stars, setStars] = useState(() => STAR_SPOTS.map(() => false));
  const [toast, setToast] = useState("");
  /* "off" 서버 없음 · "local" 이 기기에만 · "cloud" 서버까지 저장됨 */
  const [saveState, setSaveState] = useState(hasCloud ? "local" : "off");

  const posRef = useRef(pos);
  const camRef = useRef({ x: 0, y: 0 });
  const keys = useRef({});
  const nearRef = useRef(null);
  const openRef = useRef(null);
  const starsRef = useRef(stars);
  const viewRef = useRef(view);

  /* 게임 루프가 최신 값을 읽을 수 있게 ref 를 렌더 뒤에 맞춰둡니다.
     (pos/near/stars 는 루프 안에서 직접 갱신하고, 여기서는 외부 변경만 반영) */
  useEffect(() => { openRef.current = openId; }, [openId]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { starsRef.current = stars; }, [stars]);

  const collected = stars.filter(Boolean).length;

  const openBuilding = useCallback((id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    setLine(b.lines[Math.floor(Math.random() * b.lines.length)]);
    setOpenId(id);
  }, []);

  /* 화면 크기 */
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* 키 입력 */
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === " ") {
        if (openRef.current) setOpenId(null);
        else if (nearRef.current) openBuilding(nearRef.current);
        return;
      }
      if (k === "escape") {
        setOpenId(null);
        return;
      }
      keys.current[k] = true;
    };
    const up = (e) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    const blur = () => {
      keys.current = {};
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [openBuilding]);

  /* 게임 루프 */
  useEffect(() => {
    let raf;
    let last = performance.now();
    const boxes = BUILDINGS.map(blockBox);
    const R = 15; // 주인공 반경

    const hit = (x, y) =>
      boxes.some((b) => x + R > b.x1 && x - R < b.x2 && y + R > b.y1 && y - R < b.y2);

    const step = (now) => {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      const k = keys.current;

      let dx = 0;
      let dy = 0;
      if (k.arrowleft || k.a) dx -= 1;
      if (k.arrowright || k.d) dx += 1;
      if (k.arrowup || k.w) dy -= 1;
      if (k.arrowdown || k.s) dy += 1;
      if (openRef.current) {
        dx = 0;
        dy = 0;
      }

      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving) {
        const len = Math.hypot(dx, dy) || 1;
        const sp = 3.6 * dt;
        let { x, y } = posRef.current;
        const nx = clamp(x + (dx / len) * sp, PLAY.x0, PLAY.x1);
        if (!hit(nx, y)) x = nx;
        const ny = clamp(y + (dy / len) * sp, PLAY.y0, PLAY.y1);
        if (!hit(x, ny)) y = ny;
        posRef.current = { x, y };
        setPos({ x, y });
        if (dx !== 0) setFacing(dx > 0 ? 1 : -1);
      }
      setMoving(isMoving);

      /* 가까운 건물 */
      const p = posRef.current;
      let best = null;
      let bestD = Infinity;
      for (const b of BUILDINGS) {
        const d = Math.hypot(p.x - b.x, p.y - (b.y - 10));
        const reach = b.w * 0.5 + 56;
        if (d < reach && d < bestD) {
          best = b.id;
          bestD = d;
        }
      }
      if (best !== nearRef.current) {
        nearRef.current = best;
        setNearId(best);
      }

      /* 별 줍기 */
      const cur = starsRef.current;
      let picked = -1;
      STAR_SPOTS.forEach(([sx, sy], i) => {
        if (!cur[i] && Math.hypot(p.x - sx, p.y - sy) < 38) picked = i;
      });
      if (picked >= 0) {
        const next = cur.slice();
        next[picked] = true;
        starsRef.current = next;
        setStars(next);
        const n = next.filter(Boolean).length;
        setToast(
          n === STAR_SPOTS.length
            ? "별을 전부 모았어요! 반짝반짝 ✨"
            : `별을 주웠어요! ${n} / ${STAR_SPOTS.length} ⭐`
        );
      }

      /* 카메라 — 부드럽게 따라가기 */
      const v = viewRef.current;
      const tx = clamp(p.x - v.w / 2, 0, Math.max(0, WORLD.w - v.w));
      const ty = clamp(p.y - v.h / 2 - 40, 0, Math.max(0, WORLD.h - v.h));
      const c = camRef.current;
      const nc = { x: c.x + (tx - c.x) * 0.12, y: c.y + (ty - c.y) * 0.12 };
      camRef.current = nc;
      setCam(nc);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- 세이브 불러오기 ---------- */
  useEffect(() => {
    let alive = true;
    const apply = (d) => {
      if (!alive || !d) return;
      if (Array.isArray(d.stars) && d.stars.length === STAR_SPOTS.length) {
        starsRef.current = d.stars;
        setStars(d.stars);
      }
      if (d.pos && Number.isFinite(d.pos.x) && Number.isFinite(d.pos.y)) {
        const p = {
          x: clamp(d.pos.x, PLAY.x0, PLAY.x1),
          y: clamp(d.pos.y, PLAY.y0, PLAY.y1),
        };
        posRef.current = p;
        setPos(p);
      }
    };

    /* 1) 이 기기 저장분을 먼저 즉시 복원 */
    const local = loadLocal();
    apply(local);

    /* 2) 서버 저장분이 더 최신이면 그걸로 덮어쓰기 */
    (async () => {
      if (!hasCloud) return;
      const id = await initCloud();
      if (!alive) return;
      if (!id) {
        setSaveState("local");
        return;
      }
      const cloud = await loadCloud();
      if (!alive) return;
      if (cloud && (!local || (cloud.at || "") > (local.at || ""))) apply(cloud);
      setSaveState("cloud");
      bootedRef.current = true;
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* ---------- 세이브 저장 ---------- */
  const dirty = useRef(false);
  const bootedRef = useRef(false);

  useEffect(() => {
    dirty.current = true;
  }, [stars]);

  useEffect(() => {
    const flush = async () => {
      if (!dirty.current) return;
      dirty.current = false;
      const snapshot = {
        stars: starsRef.current,
        pos: posRef.current,
        at: new Date().toISOString(),
      };
      saveLocal(snapshot);
      if (!hasCloud || !bootedRef.current) return;
      const ok = await saveCloud(snapshot);
      setSaveState(ok ? "cloud" : "local");
    };

    /* 5초마다, 그리고 창을 닫거나 탭을 벗어날 때 */
    const iv = setInterval(() => {
      dirty.current = true; // 위치는 계속 바뀌므로 주기 저장
      flush();
    }, 5000);
    const onHide = () => {
      dirty.current = true;
      flush();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      onHide();
    };
  }, []);

  /* 토스트 자동 사라짐 */
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const hold = (key, on) => () => {
    keys.current[key] = on;
  };

  const open = openId ? BUILDINGS.find((b) => b.id === openId) : null;

  /* 건물을 y 순으로 그려서 앞뒤가 자연스럽게 겹치도록 */
  const ordered = useMemo(() => [...BUILDINGS].sort((a, b) => a.y - b.y), []);

  return (
    <div className="ccRoot">
      <style>{CSS}</style>

      {/* 하늘 + 배경 구름(시차) */}
      <div className="ccSky" />
      <div
        className="ccClouds"
        style={{ transform: `translate3d(${-cam.x * 0.35}px, ${-cam.y * 0.35}px, 0)` }}
      >
        {CLOUDS.map(([x, y, s], i) => (
          <div
            key={i}
            className="ccCloud"
            style={{ left: x, top: y, transform: `scale(${s})`, animationDelay: `${i * 1.4}s` }}
          >
            <svg viewBox="0 0 160 70" width="160" height="70">
              <path
                d="M28,58 a24,24 0 0 1 4,-46 a28,28 0 0 1 52,-6 a24,24 0 0 1 40,16 a20,20 0 0 1 8,36 z"
                fill="#fff"
                opacity="0.92"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* 월드 */}
      <div
        className="ccWorld"
        style={{
          width: WORLD.w,
          height: WORLD.h,
          transform: `translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
        }}
      >
        <Ground />

        {TREES.map(([x, y, col], i) => (
          <LollipopTree key={i} x={x} y={y} color={col} delay={i * 0.7} />
        ))}

        {STAR_SPOTS.map(([x, y], i) =>
          stars[i] ? null : (
            <div key={i} className="ccStar" style={{ left: x - 17, top: y - 17, animationDelay: `${i * 0.35}s` }}>
              <svg viewBox="0 0 34 34" width="34" height="34">
                <path
                  d="M17,2 l4.6,9.6 10.4,1.5 -7.5,7.4 1.8,10.4 -9.3,-4.9 -9.3,4.9 1.8,-10.4 -7.5,-7.4 10.4,-1.5 z"
                  fill="#ffe38a"
                  stroke="#f0b23f"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )
        )}

        {ordered.map((b) => (
          <div
            key={b.id}
            style={{ position: "absolute", inset: 0, zIndex: Math.round(b.y), pointerEvents: "none" }}
            onClick={() => openBuilding(b.id)}
          >
            <Building b={b} near={nearId === b.id} />
          </div>
        ))}

        <div style={{ position: "absolute", inset: 0, zIndex: Math.round(pos.y) + 1, pointerEvents: "none" }}>
          <Player x={pos.x} y={pos.y} facing={facing} moving={moving} />
        </div>
      </div>

      {/* HUD */}
      <div className="ccHud">
        <div className="ccChip ccTitle">☁️ 구름사탕 마을</div>
        <div className="ccChip">
          ⭐ {collected} / {STAR_SPOTS.length}
        </div>
        <div className={"ccChip ccSave cc-" + saveState} title={SAVE_TEXT[saveState]}>
          💾 {SAVE_TEXT[saveState]}
        </div>
      </div>
      <div className="ccHelp ccChip">
        방향키 · WASD 로 이동 &nbsp;/&nbsp; 건물 앞에서 <b>Space</b>
      </div>

      {toast && <div className="ccToast">{toast}</div>}

      {/* 모바일 방향키 */}
      <div className="ccPad">
        <button className="ccPadBtn ccUp" onPointerDown={hold("arrowup", true)} onPointerUp={hold("arrowup", false)} onPointerLeave={hold("arrowup", false)}>▲</button>
        <button className="ccPadBtn ccLeft" onPointerDown={hold("arrowleft", true)} onPointerUp={hold("arrowleft", false)} onPointerLeave={hold("arrowleft", false)}>◀</button>
        <button className="ccPadBtn ccRight" onPointerDown={hold("arrowright", true)} onPointerUp={hold("arrowright", false)} onPointerLeave={hold("arrowright", false)}>▶</button>
        <button className="ccPadBtn ccDown" onPointerDown={hold("arrowdown", true)} onPointerUp={hold("arrowdown", false)} onPointerLeave={hold("arrowdown", false)}>▼</button>
      </div>

      {/* 건물 안 */}
      {open && (
        <div className="ccModalWrap" onClick={() => setOpenId(null)}>
          <div className="ccModal" onClick={(e) => e.stopPropagation()} style={{ borderColor: open.accent }}>
            <div className="ccModalTop" style={{ background: open.roof }}>
              <div className="ccModalEmoji">{open.emoji}</div>
            </div>
            <div className="ccModalTag" style={{ background: open.body, color: open.accent, borderColor: open.accent }}>
              {open.tag}
            </div>
            <h2 className="ccModalName">{open.name}</h2>
            <p className="ccModalLine">{line}</p>
            <button className="ccBtn" style={{ background: open.accent }} onClick={() => setOpenId(null)}>
              밖으로 나가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ 스타일 ============================ */

const CSS = `
*{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.ccRoot{position:fixed;inset:0;overflow:hidden;user-select:none;touch-action:none;color:${C.ink}}
.ccSky{position:absolute;inset:0;background:linear-gradient(180deg,${C.sky1} 0%,${C.sky2} 58%,${C.sky3} 100%)}
.ccClouds{position:absolute;inset:0;pointer-events:none}
.ccCloud{position:absolute;animation:ccFloat 9s ease-in-out infinite}
@keyframes ccFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.ccWorld{position:absolute;left:0;top:0;will-change:transform}
.ccGround{position:absolute;left:0;top:0;pointer-events:none}

.ccBuilding{position:absolute;cursor:pointer;pointer-events:auto;transition:transform .18s ease}
.ccBuilding:hover{transform:translateY(-4px)}
.ccBuilding.ccNear{transform:translateY(-6px)}
.ccSign{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;
  background:rgba(255,255,255,.92);border:2.5px solid #fff;border-radius:999px;padding:5px 13px;font-size:13px;font-weight:800;
  box-shadow:0 4px 12px rgba(107,85,112,.16);display:flex;align-items:center;gap:5px}
.ccSignEmoji{font-size:15px}
.ccPrompt{position:absolute;left:50%;bottom:calc(100% - 6px);transform:translateX(-50%);white-space:nowrap;
  background:#fff;border:3px solid #ffb3cf;border-radius:16px;padding:6px 13px;font-size:13px;font-weight:800;color:${C.ink};
  box-shadow:0 6px 16px rgba(107,85,112,.2);animation:ccPop .28s cubic-bezier(.34,1.56,.64,1)}
.ccPrompt:after{content:"";position:absolute;left:50%;top:100%;transform:translateX(-50%);border:8px solid transparent;border-top-color:#ffb3cf}
@keyframes ccPop{from{transform:translateX(-50%) scale(.6);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}

.ccPlayer{position:absolute;transform:translate(-50%,-100%);pointer-events:none}
.ccBob{animation:ccBob .42s ease-in-out infinite}
@keyframes ccBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-5px) rotate(2deg)}}

.ccTree{position:absolute;animation:ccSway 4.5s ease-in-out infinite;transform-origin:50% 95%}
@keyframes ccSway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.ccStar{position:absolute;z-index:5;animation:ccStarF 2.4s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(255,215,120,.9))}
@keyframes ccStarF{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-10px) rotate(8deg)}}
.ccTwinkle{animation:ccTw 1.8s ease-in-out infinite}
@keyframes ccTw{0%,100%{opacity:1}50%{opacity:.55}}
.ccHorse{animation:ccHorseB 1.6s ease-in-out infinite;transform-origin:50% 60%}
@keyframes ccHorseB{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

.ccHud{position:absolute;left:16px;top:16px;display:flex;gap:8px;flex-wrap:wrap}
.ccChip{background:rgba(255,255,255,.93);border:3px solid #fff;border-radius:999px;padding:8px 16px;font-weight:800;font-size:14px;
  box-shadow:0 6px 18px rgba(107,85,112,.16);color:${C.ink}}
.ccTitle{background:linear-gradient(135deg,#fff,#ffe9f4)}
.ccSave{font-size:12px;padding:8px 14px}
.ccSave.cc-cloud{color:#2e9e78;border-color:#c8f0e0}
.ccSave.cc-local,.ccSave.cc-off{color:#d08a2a;border-color:#ffe6bd}
.ccHelp{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-size:13px;font-weight:700;color:${C.inkSoft};white-space:nowrap}
.ccHelp b{color:${C.ink}}
.ccToast{position:absolute;left:50%;top:78px;transform:translateX(-50%);background:#fff;border:3px solid #ffd98a;border-radius:999px;
  padding:10px 20px;font-weight:800;font-size:14px;box-shadow:0 8px 22px rgba(107,85,112,.2);animation:ccPop .3s cubic-bezier(.34,1.56,.64,1)}

.ccPad{position:absolute;right:20px;bottom:20px;width:150px;height:150px;display:none}
.ccPadBtn{position:absolute;width:48px;height:48px;border-radius:16px;border:3px solid #fff;background:rgba(255,255,255,.85);
  font-size:16px;color:${C.ink};box-shadow:0 4px 12px rgba(107,85,112,.18);touch-action:none}
.ccPadBtn:active{background:#ffe1ef}
.ccUp{left:51px;top:0}.ccDown{left:51px;bottom:0}.ccLeft{left:0;top:51px}.ccRight{right:0;top:51px}
@media (hover:none) and (pointer:coarse){.ccPad{display:block}.ccHelp{display:none}}

.ccModalWrap{position:absolute;inset:0;background:rgba(107,85,112,.35);backdrop-filter:blur(3px);
  display:flex;align-items:center;justify-content:center;padding:20px;animation:ccFade .2s ease}
@keyframes ccFade{from{opacity:0}to{opacity:1}}
.ccModal{position:relative;width:min(420px,92vw);background:#fff;border:4px solid;border-radius:28px;padding:0 26px 26px;
  text-align:center;box-shadow:0 24px 60px rgba(107,85,112,.3);animation:ccUp .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes ccUp{from{transform:translateY(24px) scale(.94);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}
.ccModalTop{height:96px;margin:0 -22px;border-radius:24px 24px 60% 60%/24px 24px 30px 30px;display:flex;align-items:center;justify-content:center}
.ccModalEmoji{font-size:52px;animation:ccBob 1.6s ease-in-out infinite}
.ccModalTag{display:inline-block;margin-top:14px;border:2px solid;border-radius:999px;padding:4px 14px;font-size:12px;font-weight:800}
.ccModalName{margin:10px 0 8px;font-size:22px;font-weight:900;color:${C.ink}}
.ccModalLine{margin:0 0 20px;font-size:15px;line-height:1.65;color:${C.inkSoft};font-weight:600}
.ccBtn{border:none;color:#fff;font-weight:900;font-size:15px;padding:13px 26px;border-radius:999px;cursor:pointer;
  box-shadow:0 8px 20px rgba(107,85,112,.24);transition:transform .15s ease}
.ccBtn:hover{transform:translateY(-2px)}
.ccBtn:active{transform:translateY(1px)}
`;
