import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStatus, hasServer, joinRoom, deviceId, rememberHostCode, savedHostCode, setClosed, startNewRound } from "./room.js";
import { CHAT_MS, joinChannel } from "./realtime.js";
import { CAFE_CHAIRS, CAFE_TABLES, CHAIRS, MENU, QUIZ_SKIN, ROOM, ROOMS, RoomStage, SCREEN, SEAT_TALK, SMALL_TALK, depth, keyCount, keyPos, proj } from "./rooms.jsx";
import { blip, boing, crack, crunch, keyclick, splash, swoosh, unlockAudio } from "./sfx.js";
import { ArcadeSheet, BgmSheet, DressSheet, FeedbackSheet, FortuneSheet, GachaSheet, IDEA_BOX, MenuSheet, MovieSheet, MusicSheet, QuizSheet, SkinSheet, SongbookSheet, StarViewSheet, TeamLobby, WISH_BOX, WishSheet } from "./sheets.jsx";
import { findSfx, movieNow, quizPacks, skinList, trackList, trackUrl } from "./content.js";

function youtubeId(url) {
  const u = (url || "").trim();
  const m =
    u.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    u.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/) ||
    u.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
import { BUILDING_SPRITES, CHARACTERS, DECO, DEFAULT_LOOK, charForSlot, cursorUrls, grassTile, lookSprite, pathTile } from "./sprites.js";
import { Pix } from "./pix.jsx";

/* ===========================================================
   메롱 — 구름 위에 떠 있는 픽셀 마을
   방향키(또는 WASD)로 걷고, 건물 앞에서 Space, Enter 로 채팅해요.
   =========================================================== */

const WORLD = { w: 1900, h: 2820 };

/* 걸어다닐 수 있는 구역들 — 윗동네 · 가운데섬 · 아랫섬.
   이 사각형들 밖으로는 못 나갑니다. 섬끼리는 미끄럼틀로만 오갑니다.
   (오른쪽 분홍 미끄럼틀 = 가운데↔아래, 왼쪽 민트 미끄럼틀 = 위↔가운데) */
const AREAS = [
  { x0: 250, y0: 250, x1: 1500, y1: 810 },       // 윗동네
  { x0: 190, y0: 1080, x1: 1520, y1: 1680 },     // 가운데섬
  { x0: 250, y0: 2100, x1: 1450, y1: 2640 },     // 아랫섬
];
const PLAY = { x0: 190, y0: 320, x1: 1520, y1: 2640 };
const inArea = (x, y) => AREAS.some((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1);

const C = {
  sky1: "#bfe6ff",
  sky2: "#ffdcef",
  sky3: "#fff3d4",
  grass: "#bdefd8",
  grassDark: "#96e0c0",
  grassLight: "#dffaee",
  edge: "#6cc9a4",
  soil: "#ffcfe6",
  soilDark: "#f2a8ce",
  path: "#fff2d2",
  pathDark: "#f2ddab",
  pond: "#a9e4ff",
  pondDark: "#6cc4ee",
  ink: "#5b4a63",
  inkSoft: "#9d86a3",
  line: "#5b4a63",
};

const PX = 4; // 캐릭터 확대 배율

const BUILDINGS = [
  { id: "cake", name: "LP바", emoji: "🎧", tag: "음악", x: 430, y: 1280, scale: 10,
    lines: [
      "오늘 밤 첫 곡 나갑니다. 헤드폰 하나 골라서 아무 자리나 앉으세요.",
      "신청곡 받아요. 구름 위에서 듣기 좋은 걸로 부탁드려요.",
      "여기선 아무 말 안 해도 돼요. 다들 각자 음악만 듣다 가거든요.",
    ] },
  { id: "candy", name: "퀴즈상가", emoji: "❓", tag: "퀴즈", x: 830, y: 1210, scale: 10,
    lines: [
      "1번 문제! 구름사탕 마을에 건물이 몇 개 있게요? …너무 쉬웠나요?",
      "정답 맞히면 사탕 하나, 틀리면 사탕 두 개 드려요. 손해 볼 일 없어요.",
      "오답 노트를 여기 다 붙여놨어요. 아무도 안 가져가더라고요.",
    ] },
  { id: "post", name: "수영장", emoji: "🏊", tag: "수영", x: 1270, y: 1290, scale: 10,
    lines: [
      "물 온도 딱 좋아요! 튜브는 안에 넉넉히 있으니 그냥 들어오세요.",
      "구름물이라 짜지 않고 눈도 안 매워요. 마음껏 첨벙거리세요.",
      "발이 안 닿는 곳은 없으니 걱정 마세요. 여긴 전부 얕아요.",
    ] },
  { id: "flower", name: "ASMR 타운", emoji: "🎙️", tag: "ASMR", x: 590, y: 1640, scale: 9,
    lines: [
      "쉿… 지금 빗소리 녹음 중이에요. 발소리만 살살 부탁드려요.",
      "여기 유리온실은 소리가 정말 잘 울려요. 한번 속삭여 보세요.",
      "가장 인기 있는 건 사탕 껍질 부스럭 소리래요. 이해는 안 되지만요.",
    ] },
  /* ---- 윗동네 ---- */
  { id: "jump", name: "방방", emoji: "🤸", tag: "트램폴린", x: 470, y: 420, scale: 8,
    lines: ["신발 벗고 올라오세요!", "높이 뛰면 별에 닿을지도 몰라요."] },
  { id: "sing", name: "구름노래방", emoji: "🎤", tag: "노래", x: 866, y: 420, scale: 8,
    lines: ["오늘 첫 곡 누가 부르실래요?", "탬버린은 저기 있어요."] },
  { id: "arcade", name: "미니게임장", emoji: "🕹️", tag: "게임", x: 1262, y: 420, scale: 8,
    lines: ["동전은 필요 없어요. 그냥 하세요.", "최고 점수 아직 비어 있어요."] },
  { id: "escape", name: "방탈출", emoji: "🔐", tag: "탈출", x: 470, y: 760, scale: 8,
    lines: ["열쇠는 이 방 안 어딘가에.", "겁먹지 마세요. 안 무서워요."] },
  { id: "movie", name: "구름영화관", emoji: "🎬", tag: "영화", x: 866, y: 760, scale: 8,
    lines: ["곧 시작합니다. 자리 잡으세요.", "상영표는 옆 벽에 있어요."] },
  { id: "star", name: "천문대", emoji: "🔭", tag: "별", x: 1262, y: 760, scale: 8,
    lines: ["망원경으로 보면 별이 더 커요.", "바닥에 누워서 봐도 좋아요."] },

  { id: "sign", name: "여기 뭐 만들지..?", emoji: "🪧", tag: "윗동네", x: 1420, y: 640, scale: 5, sheet: "idea",
    lines: [
      "여기 뭘 만들면 좋을까요?",
      "적어주신 걸 보고 채워볼게요.",
    ] },
  { id: "fortune", name: "포춘쿠키", emoji: "🥠", tag: "운세", x: 250, y: 1550, scale: 5.5, sheet: "fortune",
    lines: [
      "오늘의 한마디, 하나 열어보고 가세요.",
      "쿠키를 반으로 쪼개면 안에 쪽지가 들어 있어요.",
      "믿거나 말거나지만, 기분은 좋아질 거예요.",
    ] },
  { id: "cafe", name: "구름카페", emoji: "☕", tag: "카페", x: 640, y: 2440, scale: 9, sprite: "cafe",
    lines: [
      "따끈한 거 한 잔 하고 가세요. 구름 라떼가 잘 나가요.",
      "창가 자리 비었어요. 아래로 마을이 다 내려다보여요.",
      "여긴 아무것도 안 해도 되는 곳이에요. 편하게 앉으세요.",
    ] },
  { id: "dress", name: "구름옷가게", emoji: "👗", tag: "꾸미기", x: 1080, y: 2430, scale: 9,
    lines: [
      "오늘은 뭘 입어볼까요? 거울 앞에 서보세요.",
      "리본은 아무한테나 잘 어울려요. 진짜예요.",
      "여기 옷은 전부 구름실로 짰어요. 가볍죠?",
    ] },
  { id: "carousel", name: "떵개방", emoji: "🍜", tag: "먹방", x: 1160, y: 1660, scale: 10,
    lines: [
      "지금 라이브 켜져 있어요! 뒤에서 손 흔들면 화면에 나와요.",
      "오늘 메뉴는 구름국수예요. 후루룩 소리가 제일 중요하대요.",
      "한 바퀴 돌면서 먹으면 두 배로 맛있다는 게 여기 규칙입니다.",
    ] },
];

/* 뉴비 가이드 — 위에서부터 하나씩 해보는 목록. 순서대로 안내합니다 */
const QUESTS = [
  { id: "walk", icon: "🚶", name: "마을 걸어보기", desc: "방향키나 WASD 로 움직여요. 폰이면 왼쪽 아래 조이스틱." },
  { id: "star", icon: "⭐", name: "별 줍기", desc: "바닥에 떠 있는 별 위로 걸어가면 주워져요." },
  { id: "chat", icon: "💬", name: "채팅하기", desc: "C 를 누르고 아무 말이나 쳐보세요. 머리 위에 떠요." },
  { id: "music", icon: "🎧", name: "LP바에서 음악 듣기", desc: "LP바에 들어가 오른쪽 LP 플레이어 앞에서 SPACE." },
  { id: "sit", icon: "🪑", name: "LP바 테이블에 앉아서 감상하기", desc: "가운데 바를 둘러싼 의자 앞에서 SPACE 를 누르면 앉아요." },
  { id: "quiz", icon: "❓", name: "퀴즈상가에서 퀴즈 풀기", desc: "화면 앞 단상에 올라서면 문제가 시작돼요." },
  { id: "asmr", icon: "🎙️", name: "ASMR 타운 즐기기", desc: "모래밭을 걷고, 왁뿌볼을 밟고, 바닥 키보드도 밟아보세요." },
  { id: "fortune", icon: "🥠", name: "포춘쿠키 뽑아보기", desc: "마을 왼쪽 작은 쿠키 건물에서 하루 한 번." },
  { id: "swim", icon: "🏊", name: "수영장에서 수영하기", desc: "물 안으로 그냥 걸어 들어가면 헤엄쳐요." },
  { id: "gacha", icon: "🍜", name: "떵개방에서 메뉴 추천 받기", desc: "가운데에서 하루 한 번 오늘의 메뉴를 뽑아요." },
  { id: "slide", icon: "💨", name: "미끄럼틀 타기", desc: "마을 오른쪽 끝 발판에 서면 슝 하고 반대편 섬으로 미끄러져요." },
  { id: "buy", icon: "☕", name: "카페 가서 음료 구매해보기", desc: "미끄럼틀로 내려가면 아랫섬에 구름카페가 있어요. 모은 별로 삽니다." },
  { id: "dress", icon: "👗", name: "구름옷가게에서 꾸미기", desc: "카페 옆 옷가게 전신거울 앞에서 얼굴·머리·옷 색을 바꿔보세요." },
  { id: "wish", icon: "💌", name: "우체통에 캐릭터 적어넣기", desc: "옷가게 오른쪽 우체통에 생겼으면 하는 캐릭터를 적어주세요." },
  { id: "feedback", icon: "📮", name: "피드백 남기기", desc: "오른쪽 아래 📮 를 눌러 아무 말이나 남겨주세요. 익명이에요." },
  { id: "idea", icon: "🪧", name: "윗동네 팻말에 적기", desc: "왼쪽 민트 미끄럼틀로 윗동네에 올라가, 가운데 팻말에 뭘 만들지 적어주세요." },
  { id: "up", icon: "🤸", name: "윗동네 새 건물 구경하기", desc: "방방·노래방·미니게임장·방탈출·영화관·천문대 중 아무 데나 들어가 보세요." },
];

/* 윗동네에 새로 생긴 방들 */
const UP_ROOMS = ["jump", "sing", "arcade", "escape", "movie", "star"];

/* 투두를 다 깨면 주는 별 */
const CLEAR_BONUS = 100;

/* 글꼴 — 설정에서 고르면 이 기기에 저장됩니다 */
const FONTS = [
  { id: "coding", name: "나눔고딕코딩 (기본)", css: '"Nanum Gothic Coding","DungGeunMo","Malgun Gothic",monospace' },
  { id: "pixel", name: "둥근모", css: '"DungGeunMo","Galmuri11","Pretendard","Malgun Gothic",system-ui,sans-serif' },
  { id: "jua", name: "주아 Jua", css: '"Jua","DungGeunMo","Malgun Gothic",system-ui,sans-serif' },
  { id: "single", name: "싱글데이 Single Day", css: '"Single Day","DungGeunMo","Malgun Gothic",cursive' },
];
const FONT_DEFAULT = "coding";

function applyFont(id) {
  const f = FONTS.find((x) => x.id === id) || FONTS[0];
  document.documentElement.style.setProperty("--ccFont", f.css);
  document.body.classList.toggle("ccSmoothFont", f.id !== "pixel");
}

/* 🖱 픽셀 커서 — 끄면 원래 커서로 돌아갑니다 */
function applyCursor(on) {
  document.body.classList.toggle("ccPixCursor", !!on);
}

/* ---------- 이어하기 ----------
   별과 꾸민 모습을 이 브라우저에 남깁니다. 0/1 문자열로 접어서 담아
   한 사람당 200바이트 남짓밖에 안 돼요. 서버에는 아무것도 안 보냅니다. */
/* 완주 보상 — 항목이 늘어나면 새로 다 깼을 때 한 번 더 줍니다.
   at 은 '몇 개짜리 목록을 깨고 받았는지'. 목록이 커지면 다시 받을 수 있어요. */
const BONUS_KEY = "ccBonus";
const savedBonus = (() => {
  try {
    const raw = localStorage.getItem(BONUS_KEY);
    if (!raw) return { total: 0, at: 0 };
    if (raw === "1") return { total: CLEAR_BONUS, at: 0 };   // 예전 방식
    const v = JSON.parse(raw);
    return { total: Number(v?.total) || 0, at: Number(v?.at) || 0 };
  } catch {
    return { total: 0, at: 0 };
  }
})();

const SAVE_KEY = "ccSave";
const bits = (list) => list.map((b) => (b ? "1" : "0")).join("");
const unbits = (str, n) => Array.from({ length: n }, (_, i) => str?.[i] === "1");

const loadSave = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};
const SAVED = loadSave();

const savedCursor = (() => {
  try {
    return localStorage.getItem("ccCursor") !== "off";
  } catch {
    return true;
  }
})();
applyCursor(savedCursor);

const savedFont = (() => {
  try {
    const v = localStorage.getItem("ccFont");
    return FONTS.some((f) => f.id === v) ? v : FONT_DEFAULT;
  } catch {
    return FONT_DEFAULT;
  }
})();
applyFont(savedFont);

const STAR_SPOTS = [
  [300, 1480], [560, 1420], [780, 1710], [1000, 1380], [1180, 1480],
  [1440, 1580], [980, 1110], [430, 1130], [1430, 1160], [700, 1620],
  /* 아랫섬 */
  [400, 2400], [1260, 2300], [980, 2200], [520, 2620], [1340, 2520],
  /* 윗동네 */
  [300, 300], [1440, 300], [866, 250], [420, 620], [1310, 620], [866, 640],
];

const CLOUDS = [
  [140, 90, 7], [520, 40, 5], [980, 120, 8], [1380, 60, 6],
  [1620, 190, 6], [300, 240, 4], [1120, 20, 4],
];

const TREES = [
  [250, 1400, "#ff9ec4"], [430, 1710, "#8fe3c9"], [990, 1280, "#ffd45e"],
  [1470, 1420, "#b6a6f0"], [880, 1500, "#ff9ec4"], [1330, 1740, "#8fe3c9"],
  [520, 1200, "#ffd45e"], [1060, 1770, "#b6a6f0"],
  /* 아랫섬 */
  [330, 2210, "#ff9ec4"], [1300, 2200, "#8fe3c9"], [380, 2560, "#ffd45e"],
  [1240, 2580, "#b6a6f0"], [880, 2620, "#ff9ec4"], [1180, 2400, "#ffd45e"],
  /* 윗동네 */
  [268, 380, "#8fe3c9"], [1470, 380, "#ff9ec4"], [268, 700, "#ffd45e"],
  [1470, 700, "#b6a6f0"], [866, 200, "#8fe3c9"],
];

/* 섬 — 계단식 사각형으로 쌓아 픽셀 느낌을 냅니다 */
const ISLAND = [
  { x: 180, y: 980, w: 1340, h: 24 },
  { x: 140, y: 1004, w: 1420, h: 24 },
  { x: 116, y: 1028, w: 1468, h: 640 },
  { x: 140, y: 1668, w: 1420, h: 24 },
  { x: 180, y: 1692, w: 1340, h: 24 },
];
const SOIL = [
  { x: 220, y: 1716, w: 1260, h: 40 },
  { x: 300, y: 1756, w: 1100, h: 36 },
  { x: 430, y: 1792, w: 840, h: 28 },
  { x: 620, y: 1820, w: 460, h: 24 },
];
const PATHS = [
  { x: 380, y: 1332, w: 940, h: 64 },
  { x: 800, y: 1232, w: 64, h: 116 },
  { x: 400, y: 1280, w: 64, h: 64 },
  { x: 1240, y: 1308, w: 64, h: 40 },
  { x: 560, y: 1396, w: 64, h: 216 },
  { x: 1128, y: 1396, w: 64, h: 240 },
  { x: 560, y: 1596, w: 632, h: 48 },
];
/* 아랫섬 */
const ISLAND2 = [
  { x: 300, y: 2080, w: 1100, h: 22 },
  { x: 250, y: 2102, w: 1200, h: 22 },
  { x: 214, y: 2124, w: 1272, h: 520 },
  { x: 250, y: 2644, w: 1200, h: 22 },
  { x: 300, y: 2666, w: 1100, h: 22 },
];
const SOIL2 = [
  { x: 340, y: 2688, w: 1020, h: 38 },
  { x: 430, y: 2726, w: 840, h: 34 },
  { x: 560, y: 2760, w: 580, h: 28 },
  { x: 720, y: 2788, w: 260, h: 22 },
];
const PATHS2 = [
  { x: 420, y: 2280, w: 720, h: 60 },
  { x: 600, y: 2340, w: 64, h: 120 },
  { x: 1040, y: 2340, w: 64, h: 200 },
];

/* 윗동네 — 가운데섬 위에 뜬 작은 섬 */
const ISLAND3 = [
  { x: 310, y: 166, w: 1140, h: 20 },
  { x: 268, y: 186, w: 1224, h: 20 },
  { x: 236, y: 206, w: 1288, h: 604 },
  { x: 268, y: 810, w: 1224, h: 20 },
  { x: 310, y: 830, w: 1140, h: 20 },
];
const SOIL3 = [
  { x: 360, y: 850, w: 1040, h: 34 },
  { x: 460, y: 884, w: 840, h: 30 },
  { x: 580, y: 914, w: 600, h: 24 },
  { x: 720, y: 938, w: 320, h: 20 },
];
const PATHS3 = [
  { x: 280, y: 470, w: 1200, h: 60 },
  { x: 280, y: 770, w: 1200, h: 44 },
  { x: 620, y: 530, w: 56, h: 240 },
  { x: 1080, y: 530, w: 56, h: 240 },
];

const POND = [
  { x: 1360, y: 1560, w: 168, h: 24 },
  { x: 1336, y: 1584, w: 216, h: 64 },
  { x: 1360, y: 1648, w: 168, h: 20 },
];

/* 곡선 미끄럼틀 — 마을 오른쪽 바깥으로 크게 휘어 윗섬과 아랫섬을 잇습니다.
   양쪽 입구에 서면 슝 하고 반대편으로 미끄러져요. */
const SLIDES = [
  {
    id: "down",                       // 가운데섬 ↔ 아랫섬 (오른쪽, 분홍)
    skin: { edge: "#5b4a63", deep: "#ffb9d6", mid: "#ffd9ea", shine: "#fff4fa", leg: "#d9c4f2" },
    ax: 1452, ay: 1480,   // 위 입구 (가운데섬)
    c1x: 1700, c1y: 1720,
    c2x: 1668, c2y: 2038,
    bx: 1388, by: 2162,   // 아래 입구 (아랫섬)
  },
  {
    id: "up",                         // 윗동네 ↔ 가운데섬 (왼쪽, 민트)
    skin: { edge: "#5b4a63", deep: "#8fe3c9", mid: "#c6f2df", shine: "#f0fff9", leg: "#a9e4ff" },
    ax: 320, ay: 780,     // 위 입구 (윗동네)
    c1x: 60, c1y: 900,
    c2x: 50, c2y: 1090,
    bx: 262, by: 1186,    // 아래 입구 (가운데섬)
  },
];
const SLIDE_R = 48;     // 입구 판정 반지름

/* 3차 베지어 위의 한 점 */
function slidePoint(sl, t) {
  const u = 1 - t;
  return {
    x: u * u * u * sl.ax + 3 * u * u * t * sl.c1x + 3 * u * t * t * sl.c2x + t * t * t * sl.bx,
    y: u * u * u * sl.ay + 3 * u * u * t * sl.c1y + 3 * u * t * t * sl.c2y + t * t * t * sl.by,
  };
}

/* 미끄럼틀 입구들 — up 이면 아래에서 위로 갑니다 */
const SLIDE_ENDS = SLIDES.flatMap((sl) => [
  { sl, up: false, x: sl.ax, y: sl.ay },
  { sl, up: true, x: sl.bx, y: sl.by },
]);

/* 들어온 시각 — 방금 온 사람은 "방금", 아니면 몇 분 전 · 시:분 */
function joinedAgo(at) {
  if (!at) return "";
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return "";
  const min = Math.floor((Date.now() - t.getTime()) / 60000);
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  if (min < 1) return `방금 · ${hh}:${mm}`;
  if (min < 60) return `${min}분 전 · ${hh}:${mm}`;
  return `${Math.floor(min / 60)}시간 전 · ${hh}:${mm}`;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const JOIN_ERROR = {
  no_name: "이름을 적어주세요.",
  name_taken: "이미 같은 이름이 있어요. 다른 이름으로 해주세요.",
  full: "이번 테스트 정원이 찼어요. 다음 회차를 기다려주세요.",
  no_server: "서버 설정이 없어요. 혼자 둘러보기로 들어갑니다.",
  no_schema: "서버에 입장 관리 함수가 아직 없어요. supabase/schema.sql 을 먼저 실행해주세요.",
  server_error: "서버와 통신하지 못했어요. 잠시 뒤 다시 시도해주세요.",
  bad_code: "호스트 코드가 맞지 않아요.",
  bad_round: "회차 번호는 1 이상이어야 해요.",
  closed: "베타테스트 시간이 아닙니다. 다음에 다시 와주세요.",
};

/* 방의 물 영역 안에 있는지 */
function inWater(room, x, y) {
  const w = room?.water;
  if (!w) return false;
  return Math.abs(x - w.x) < w.w / 2 && Math.abs(y - w.y) < w.d / 2;
}

/* 막힌 곳에 서지 않도록, 의자에서 일어날 자리를 찾아줍니다 */
function freeSpot(room, cx, cy) {
  const R = 15;
  const blocked = (x, y) =>
    (room.blocks || []).some((b) => x + R > b.x1 && x - R < b.x2 && y + R > b.y1 && y - R < b.y2);
  const tries = [
    [0, 62], [0, -62], [70, 0], [-70, 0],
    [56, 48], [-56, 48], [56, -48], [-56, -48], [0, 110],
  ];
  for (const [dx, dy] of tries) {
    const x = clamp(cx + dx, room.play.x0, room.play.x1);
    const y = clamp(cy + dy, room.play.y0, room.play.y1);
    if (!blocked(x, y)) return { x, y };
  }
  return { x: ROOM.w / 2, y: ROOM.d - 60 };   // 최후에는 문 앞으로
}

function blockBox(b) {
  const w = 24 * b.scale;
  const h = 22 * b.scale;
  return { x1: b.x - w * 0.34, x2: b.x + w * 0.34, y1: b.y - h * 0.3, y2: b.y + 8 };
}

/* ============================ 픽셀 그리기 ============================ */

/* ============================ 건물 ============================ */

function Building({ b, near }) {
  const sp = BUILDING_SPRITES[b.sprite || b.id];
  const w = 24 * b.scale;
  const h = 22 * b.scale;
  return (
    <div className="ccBuilding" style={{ left: b.x - w / 2, top: b.y - h, width: w }}>
      <Pix map={sp.map} palette={sp.palette} scale={b.scale} cacheKey={"b-" + (b.sprite || b.id)} className={near ? "ccNear" : ""} />
      <div className="ccSign">
        {b.emoji} {b.name}
      </div>
      {near && <div className="ccPrompt">SPACE 로 들어가기</div>}
    </div>
  );
}

/* ============================ 캐릭터 ============================ */

function Avatar({ name, slot, x, y, facing, moving, me, msg, scale = 1, swim = false, waiting = false, hold = null, slide = false, look = null, skin = null, lie = false, bounce = false }) {
  const ch = look ? lookSprite(look) : charForSlot(slot);
  return (
    <div
      className={"ccAvatar" + (swim ? " ccSwim" : "") + (slide ? " ccSliding" : "") + (lie ? " ccLying" : "") + (bounce ? " ccBouncing" : "")}
      style={{
        left: x,
        top: y,
        zIndex: Math.round(y) + 1,
        transform: `translate(-50%,-100%) scale(${scale})`,
      }}
    >
      {msg && <div className="ccBubble">{msg}</div>}
      {!msg && waiting && <div className="ccWaitTag">팀전 대기중…</div>}
      {swim && <div className="ccTube ccTubeBack" />}
      <div className={"ccTag" + (me ? " ccTagMe" : "")}>
        {hold && <span className="ccHold">{hold}</span>}
        {name}
      </div>
      {skin ? (
        <div
          className={"ccSkinPic " + (moving ? "ccWalk " : "") + (facing < 0 ? "ccFlip" : "")}
          style={{ backgroundImage: `url(${skin})` }}
        />
      ) : (
        <Pix
          map={ch.map}
          palette={ch.palette}
          scale={PX}
          cacheKey={ch.key || "c-" + ch.id}
          className={(moving ? "ccWalk " : "") + (facing < 0 ? "ccFlip" : "")}
        />
      )}
      {swim && <div className="ccTube ccTubeFront" />}
    </div>
  );
}


/* ============================ 조이스틱 ============================ */

const STICK_R = 46;     // 손잡이가 움직일 수 있는 반경
const DEADZONE = 0.16;

/* 포인터 이벤트를 지원하는지 — 카카오톡·인스타 같은 인앱 브라우저에서는
   포인터 이벤트가 제대로 안 오는 경우가 있어 터치 이벤트로 넘어갑니다. */
const HAS_POINTER = typeof window !== "undefined" && "onpointerdown" in window;

/* 왼쪽 아래 아무 데나 눌러도 그 자리에 조이스틱이 생깁니다 */
function Stick({ onMove }) {
  const origin = useRef(null);
  const active = useRef(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [base, setBase] = useState(null);   // 지금 잡고 있는 위치

  const begin = (x, y) => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur();
    active.current = true;
    origin.current = { x, y };
    setBase({ x, y });
    setKnob({ x: 0, y: 0 });
  };

  const move = (x, y) => {
    if (!active.current || !origin.current) return;
    let dx = x - origin.current.x;
    let dy = y - origin.current.y;
    const d = Math.hypot(dx, dy) || 1;
    const cap = Math.min(1, d / STICK_R);
    dx = (dx / d) * STICK_R * cap;
    dy = (dy / d) * STICK_R * cap;
    setKnob({ x: dx, y: dy });
    const nx = dx / STICK_R;
    const ny = dy / STICK_R;
    onMove(Math.hypot(nx, ny) < DEADZONE ? { x: 0, y: 0 } : { x: nx, y: ny });
  };

  const end = () => {
    active.current = false;
    origin.current = null;
    setBase(null);
    setKnob({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  /* 포인터가 되면 포인터로, 안 되면 터치로 — 둘 다 달면 두 번 처리됩니다 */
  const handlers = HAS_POINTER
    ? {
        onPointerDown: (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ } begin(e.clientX, e.clientY); },
        onPointerMove: (e) => move(e.clientX, e.clientY),
        onPointerUp: end,
        onPointerCancel: end,
        onPointerLeave: end,
      }
    : {
        onTouchStart: (e) => { const t = e.changedTouches[0]; begin(t.clientX, t.clientY); },
        onTouchMove: (e) => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); },
        onTouchEnd: end,
        onTouchCancel: end,
      };

  return (
    <div className="ccStickZone" {...handlers}>
      <div
        className={"ccStick" + (base ? " ccStickOn" : "")}
        style={base ? { left: base.x, top: base.y, bottom: "auto", transform: "translate(-50%,-50%)" } : undefined}
      >
        <div className="ccStickKnob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  );
}

/* ============================ 바닥 ============================ */


function Ground() {
  const grass = useMemo(() => grassTile(C.grass, C.grassDark, C.grassLight), []);
  const road = useMemo(() => pathTile(C.path, C.pathDark), []);
  const slab = (r, i, extra) => (
    <div key={i} className="ccSlab" style={{ left: r.x, top: r.y, width: r.w, height: r.h, ...extra }} />
  );
  return (
    <div className="ccGround">
      {SOIL.map((r, i) => slab(r, "s" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND.map((r, i) => slab(r, "i" + i, { background: C.edge }))}
      {ISLAND.map((r, i) =>
        slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g" + i, {
          backgroundImage: `url(${grass})`,
          backgroundSize: "48px 48px",
        })
      )}
      {PATHS.map((r, i) =>
        slab(r, "p" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" })
      )}

      {/* 윗동네 */}
      {SOIL3.map((r, i) => slab(r, "s3" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND3.map((r, i) => slab(r, "i3" + i, { background: C.edge }))}
      {ISLAND3.map((r, i) =>
        slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g3" + i, {
          backgroundImage: `url(${grass})`,
          backgroundSize: "48px 48px",
        })
      )}
      {PATHS3.map((r, i) =>
        slab(r, "p3" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" })
      )}

      {/* 아랫섬 */}
      {SOIL2.map((r, i) => slab(r, "s2" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND2.map((r, i) => slab(r, "i2" + i, { background: C.edge }))}
      {ISLAND2.map((r, i) =>
        slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g2" + i, {
          backgroundImage: `url(${grass})`,
          backgroundSize: "48px 48px",
        })
      )}
      {PATHS2.map((r, i) =>
        slab(r, "p2" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" })
      )}
      {POND.map((r, i) => slab(r, "w" + i, { background: i === 1 ? C.pond : C.pondDark }))}
      <div className="ccSlab" style={{ left: 1372, top: 816, width: 48, height: 12, background: "#ffffff", opacity: 0.7 }} />
    </div>
  );
}

/* 곡선 미끄럼틀 — 섬과 섬을 잇는 구름 미끄럼틀 */
function OneSlide({ sl }) {
  const N = 44;
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(slidePoint(sl, i / N));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const legs = [0.24, 0.5, 0.76].map((t) => slidePoint(sl, t));
  const k = sl.skin;

  const pad = (p, up) => (
    <g>
      <rect x={p.x - 46} y={p.y - 12} width={92} height={40} fill={k.edge} />
      <rect x={p.x - 42} y={p.y - 8} width={84} height={32} fill="#ffe9a8" />
      <rect x={p.x - 42} y={p.y - 8} width={84} height={8} fill="#fff6dc" />
      <text x={p.x} y={p.y + 16} textAnchor="middle" fontSize="17" fontWeight="900" fill={k.edge} fontFamily="inherit">
        {up ? "▲" : "▼"}
      </text>
    </g>
  );

  return (
    <g>
      {legs.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 11} y={p.y} width={22} height={104} fill={k.edge} />
          <rect x={p.x - 7} y={p.y + 4} width={14} height={96} fill={k.leg} />
          <rect x={p.x - 7} y={p.y + 4} width={5} height={96} fill="#ffffff" opacity="0.5" />
        </g>
      ))}
      <path d={d} fill="none" stroke={k.edge} strokeWidth="62" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={k.deep} strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={k.mid} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={k.shine} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      {pad({ x: sl.ax, y: sl.ay }, false)}
      {pad({ x: sl.bx, y: sl.by }, true)}
    </g>
  );
}

function Slide() {
  return (
    <svg className="ccSlide" width={WORLD.w} height={WORLD.h} viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}>
      {SLIDES.map((sl) => (
        <OneSlide key={sl.id} sl={sl} />
      ))}
    </svg>
  );
}

/* ============================ 입장 화면 ============================ */

function JoinGate({ onJoined, notice }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(savedHostCode());
  const [showCode, setShowCode] = useState(!!savedHostCode());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [solo, setSolo] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const s = await fetchStatus();
      if (alive) setStatus(s);
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const submit = async (e) => {
    e?.preventDefault();
    if (busy) return;
    setErr("");

    if (!hasServer) {
      onJoined({ name: name.trim() || "손님", role: "solo", slot: 1 });
      return;
    }
    if (!name.trim()) {
      setErr(JOIN_ERROR.no_name);
      return;
    }
    setBusy(true);
    const r = await joinRoom(name.trim(), showCode ? code.trim() : "");
    setBusy(false);

    if (!r?.ok) {
      setErr(JOIN_ERROR[r?.error] || JOIN_ERROR.server_error);
      setSolo(r?.error === "no_schema" || r?.error === "no_server" || r?.error === "server_error");
      if (r?.taken != null) setStatus((s) => ({ ...(s || {}), ...r, ok: true }));
      return;
    }
    if (r.role === "host") rememberHostCode(code.trim());
    onJoined({ name: r.name, role: r.role, slot: r.slot ?? 1, round: r.round, hostCode: code.trim() });
  };

  const here = status?.ok ? status.players || [] : [];
  const closed = status?.ok && status.closed && !showCode;
  /* 아직 아무도 없으면 흐린 캐릭터 셋으로 자리를 지킵니다 */
  const row = here.length
    ? here.slice(0, 14).map((p, i) => ({ key: "p" + i, ch: charForSlot(p.slot), on: true }))
    : CHARACTERS.slice(1, 4).map((c, i) => ({ key: "e" + i, ch: c, on: false }));

  return (
    <div className="ccGate">
      <div className="ccGateSky" />
      <form className="ccPanel ccGateCard" onSubmit={submit}>
        <div className="ccGateChars">
          {row.map((r) => (
            <Pix
              key={r.key}
              map={r.ch.map}
              palette={r.ch.palette}
              scale={3}
              cacheKey={"c-" + r.ch.id}
              className={r.on ? "ccGateCharOn" : "ccGateCharOff"}
            />
          ))}
          {here.length > 14 && <span className="ccGateMore">+{here.length - 14}</span>}
        </div>
        <h1 className="ccGateTitle">메롱</h1>
        <p className="ccGateSub">
          {hasServer ? `${status?.round ?? "-"}번 테스트` : "서버 없이 둘러보기"}
        </p>

        {notice && <div className="ccNotice">{notice}</div>}

        {closed && (
          <div className="ccClosed">
            베타테스트 시간이 아닙니다.
            <br />
            다음에 다시 와주세요.
          </div>
        )}

        {hasServer && !closed && (
          <div className="ccSeatCount">
            {here.length ? `지금 ${here.length}명 있어요` : "아직 아무도 없어요"}
          </div>
        )}

        {!closed && (
          <input
            className="ccInput"
            value={name}
            maxLength={12}
            placeholder="이름을 정해주세요"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        )}

        {showCode ? (
          <input
            className="ccInput ccInputCode"
            value={code}
            placeholder="호스트 코드"
            onChange={(e) => setCode(e.target.value)}
          />
        ) : (
          <button type="button" className="ccLinkBtn" onClick={() => setShowCode(true)}>
            호스트로 입장하기
          </button>
        )}

        {err && <div className="ccErr">{err}</div>}

        {!closed && (
          <button className="ccBtn ccGateBtn" type="submit" disabled={busy}>
            {busy ? "입장하는 중…" : "마을로 들어가기"}
          </button>
        )}

        {solo && (
          <button
            type="button"
            className="ccLinkBtn ccSoloBtn"
            onClick={() => onJoined({ name: name.trim() || "손님", role: "solo", slot: 1 })}
          >
            서버 없이 혼자 둘러보기 →
          </button>
        )}

        {hasServer && !closed && (
          <p className="ccGateNote">
            진행 상황은 저장되지 않아요. 새로고침하면 별과 위치가 처음으로 돌아갑니다.
          </p>
        )}
      </form>
    </div>
  );
}

/* ============================ 메인 ============================ */

export default function CloudCandyTown() {
  const [me, setMe] = useState(null);
  const [notice, setNotice] = useState("");

  /* 회차가 바뀌면 이전 회차 사람들은 전부 입장 화면으로 나옵니다 */
  const kick = useCallback((msg) => {
    setMe(null);
    setNotice(msg || "");
  }, []);

  if (!me) {
    return (
      <>
        <style>{CSS}</style>
        <JoinGate notice={notice} onJoined={(v) => { setNotice(""); setMe(v); }} />
      </>
    );
  }
  return <Town me={me} setMe={setMe} onKick={kick} />;
}

function Town({ me, setMe, onKick }) {
  const [pos, setPos] = useState({ x: 850, y: 1440 });
  const [facing, setFacing] = useState(1);
  const [moving, setMoving] = useState(false);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [view, setView] = useState({ w: 1000, h: 700 });
  const [zoom, setZoom] = useState(1);
  const [nearId, setNearId] = useState(null);
  const [stars, setStars] = useState(() => unbits(SAVED?.stars, STAR_SPOTS.length));
  const [toast, setToast] = useState("");
  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState([]);
  const [peerView, setPeerView] = useState([]);   // 화면에 그릴 위치(보간됨)
  const [panel, setPanel] = useState(false);
  const [hostSection, setHostSection] = useState("");
  const [chatText, setChatText] = useState("");
  const [scene, setScene] = useState(null);      // null = 마을, 아니면 건물 id
  const [zoneId, setZoneId] = useState(null);    // 방 안에서 가까이 있는 설치물
  const [sheet, setSheet] = useState(null);      // 'lp' | 'quiz' | 'dress' …
  const [wave, setWave] = useState(0);
  const [chatLog, setChatLog] = useState([]);
  const [history, setHistory] = useState([]);   // 이번 회차 대화 기록
  const [logOpen, setLogOpen] = useState(false);
  const [queue, setQueue] = useState([]);    // 재생 목록
  const [qi, setQi] = useState(0);           // 그중 몇 번째
  const [plName, setPlName] = useState("");
  const [sit, setSit] = useState(null);      // 앉아 있는 의자 번호
  const [spent, setSpent] = useState(() => Math.max(0, Number(SAVED?.spent) || 0));
  const [roomStars, setRoomStars] = useState(() => {
    const out = {};
    Object.entries(SAVED?.rooms || {}).forEach(([id, str]) => {
      const n = (ROOMS[id]?.stars || []).length;
      if (n) out[id] = unbits(str, n);
    });
    return out;
  });
  const [holding, setHolding] = useState(null);   // 들고 있는 메뉴
  const [broken, setBroken] = useState([]);  // 뿌셔진 왁뿌볼
  const [pressed, setPressed] = useState([]); // 눌린 키보드 키
  const [quizMode, setQuizMode] = useState("solo");   // 퀴즈상가 개인전 / 팀전
  const [touch, setTouch] = useState(
    () => typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
  );
  const [games, setGames] = useState([]);            // 팀전 목록
  const [myGid, setMyGid] = useState(null);          // 내가 들어간 팀전
  const [teamPack, setTeamPack] = useState(null);    // 팀전으로 시작한 주제
  const [packs, setPacks] = useState([]);
  const [results, setResults] = useState([]);
  const [vol, setVol] = useState(() => {
    const v = Number(localStorage.getItem("ccVol"));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.7;
  });
  const [muted, setMuted] = useState(false);
  const [myMsg, setMyMsg] = useState(null);
  const [roundInput, setRoundInput] = useState(String((me.round ?? 1) + 1));
  const [resetting, setResetting] = useState(false);
  /* 뉴비 가이드 — 해본 항목은 기기에 남습니다 */
  const [quests, setQuests] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ccQuests"));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const [guideOpen, setGuideOpen] = useState(() => {
    const v = localStorage.getItem("ccGuide");
    if (v === "off") return false;
    if (v === "on") return true;
    return !(typeof navigator !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in window));
  });
  const [justDone, setJustDone] = useState(null);   // 방금 체크된 항목 (반짝임)
  const [bonus, setBonus] = useState(savedBonus.total);
  const [welcome, setWelcome] = useState(() => {
    try {
      return localStorage.getItem("ccWelcome") !== "seen";
    } catch {
      return true;
    }
  });
  const [setOpen, setSetOpen] = useState(false);   // 설정 패널
  const [riding, setRiding] = useState(false);     // 미끄럼틀 타는 중
  const [lying, setLying] = useState(false);       // 천문대에서 눕기
  const [bouncing, setBouncing] = useState(false); // 방방 위에서 통통
  const [talk, setTalk] = useState(null);          // 앉았을 때 오가는 말 { who, text }
  const [staffPos, setStaffPos] = useState(null);  // 직원이 걸어다니는 자리
  const [staffWalk, setStaffWalk] = useState(false);
  const [skins, setSkins] = useState([]);          // 호스트가 올린 캐릭터 이미지
  const [live, setLive] = useState(true);          // 실시간 연결 상태
  const [movie, setMovie] = useState(null);        // 지금 상영 중인 것
  const [muted2, setMuted2] = useState(true);
  const [karaoke, setKaraoke] = useState(null);   // 모두에게 보이는 YouTube 노래방      // 영화 소리 (자동재생 때문에 처음엔 꺼둠)
  const [roomBgmMap, setRoomBgmMap] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ccRoomBgm") || "{}");
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  });
  const [hostBgmMap, setHostBgmMap] = useState({});
  const [bgmOpen, setBgmOpen] = useState(false);

  const [starPop, setStarPop] = useState(false);   // 별 개수가 바뀌면 통 튑니다
  /* 꾸미기 — 고른 모습과 사둔 것들 */
  const [look, setLook] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ccLook"));
      if (v && typeof v === "object") return { ...DEFAULT_LOOK, ...v };
    } catch {
      /* 무시 */
    }
    return { ...DEFAULT_LOOK, f: me.slot || 1, h: me.role === "host" ? "crown" : "none" };
  });
  const [owned, setOwned] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("ccOwned"));
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const [font, setFont] = useState(savedFont);
  const [pixCursor, setPixCursor] = useState(savedCursor);
  const [wipeAsk, setWipeAsk] = useState(false);

  const track = queue[qi] || null;    // 지금 듣는 곡

  const posRef = useRef(pos);
  const facingRef = useRef(1);
  const movingRef = useRef(false);
  const camRef = useRef({ x: 0, y: 0 });
  const keys = useRef({});
  const nearRef = useRef(null);
  const openRef = useRef(null);
  const starsRef = useRef(stars);
  const viewRef = useRef(view);
  const chanRef = useRef(null);
  const stick = useRef({ x: 0, y: 0 });
  const sceneRef = useRef(null);
  const zoneRef = useRef(null);
  const worldPos = useRef({ x: 850, y: 660 });
  const sfxAt = useRef(0);
  const swimRef = useRef(false);
  const sheetRef = useRef(null);
  const sitRef = useRef(null);
  const holdRef = useRef(-1);
  const roomStarsRef = useRef({});
  const gamesRef = useRef([]);
  const myGidRef = useRef(null);
  const waitRef = useRef(0);
  const peersRef = useRef([]);
  const smooth = useRef(new Map());
  const brokenRef = useRef([]);
  const pressedRef = useRef([]);
  const sfxUrl = useRef({});
  const chairRef = useRef(null);
  const audio = useRef(null);
  const bgmAudio = useRef(null);
  const roomBgmRef = useRef(roomBgmMap);
  const chatBox = useRef(null);
  const histBox = useRef(null);
  const questRef = useRef(quests);
  const walkRef = useRef(0);      // 마을에서 걸은 거리
  const bonusRef = useRef(savedBonus.total);
  const bonusAt = useRef(savedBonus.at);   // 몇 개짜리 목록을 깨고 받았는지
  const doQuestRef = useRef(null);        // enterRoom 이 doQuest 보다 먼저 선언돼서
  const welcomeRef = useRef(true);
  const rideRef = useRef(null);     // { at, ms, up }
  const rideLock = useRef(false);   // 도착하자마자 다시 타지 않도록
  const lyingRef = useRef(false);
  const bounceRef = useRef(false);
  const bounceAt = useRef(0);
  const talkTimers = useRef([]);
  const talking = useRef(false);
  const pairRef = useRef(null);       // 지금 같이 앉아 있는 사람의 의자 번호
  const staffRef = useRef(null);      // 직원의 지금 자리
  const staffTo = useRef(null);       // 직원이 가려는 자리
  const staffFace = useRef(1);
  const staffWalkRef = useRef(false);
  const skinsAt = useRef(0);
  const vidRef = useRef(null);
  const lookRef = useRef(look);
  const myMsgTimer = useRef(null);

  useEffect(() => { openRef.current = !!sheet; sheetRef.current = sheet; }, [sheet]);
  useEffect(() => { viewRef.current = { ...view, z: zoom }; }, [view, zoom]);
  useEffect(() => { starsRef.current = stars; }, [stars]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { brokenRef.current = broken; }, [broken]);
  useEffect(() => { pressedRef.current = pressed; }, [pressed]);
  useEffect(() => { welcomeRef.current = welcome; }, [welcome]);
  useEffect(() => { lookRef.current = look; }, [look]);
  useEffect(() => {
    roomBgmRef.current = roomBgmMap;
    try { localStorage.setItem("ccRoomBgm", JSON.stringify(roomBgmMap)); } catch { /* 무시 */ }
  }, [roomBgmMap]);

  /* 직원 걸음 — 목표가 정해지면 한 걸음씩 다가갑니다 */
  useEffect(() => {
    const iv = setInterval(() => {
      const to = staffTo.current;
      const cur = staffRef.current;
      if (!to || !cur) return;
      const dx = to.x - cur.x;
      const dy = to.y - cur.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        if (staffWalkRef.current) { staffWalkRef.current = false; setStaffWalk(false); }
        return;
      }
      if (!staffWalkRef.current) { staffWalkRef.current = true; setStaffWalk(true); }
      if (Math.abs(dx) > 2) staffFace.current = dx > 0 ? 1 : -1;
      const step = Math.min(d, 7);
      const next = { x: cur.x + (dx / d) * step, y: cur.y + (dy / d) * step };
      staffRef.current = next;
      setStaffPos(next);
    }, 40);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => () => talkTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    applyFont(font);
    try {
      localStorage.setItem("ccFont", font);
    } catch {
      /* 무시 */
    }
  }, [font]);
  useEffect(() => {
    applyCursor(pixCursor);
    try {
      localStorage.setItem("ccCursor", pixCursor ? "on" : "off");
    } catch {
      /* 무시 */
    }
  }, [pixCursor]);
  useEffect(() => { roomStarsRef.current = roomStars; }, [roomStars]);
  useEffect(() => { gamesRef.current = games; }, [games]);
  useEffect(() => {
    myGidRef.current = myGid;
    const g = games.find((x) => x.gid === myGid);
    waitRef.current = g && g.state === "wait" ? 1 : 0;
  }, [myGid, games]);

  const roomTaken = Object.values(roomStars).reduce((n, list) => n + list.filter(Boolean).length, 0);
  /* 호스트는 옷가게 물건을 마음껏 시험해볼 수 있게 별을 넉넉히 들고 시작합니다 */
  const hostStars = me.role === "host" ? 300 : 0;
  const collected = stars.filter(Boolean).length + roomTaken + hostStars + bonus;
  const balance = Math.max(0, collected - spent);
  const online = me.role === "solo" ? 1 : peers.length + 1;

  /* 지금 뭘 트는지 — 영화관에 있을 때만 확인합니다 */
  const loadMovie = useCallback(async () => {
    if (!hasServer) return;
    const r = await movieNow();
    if (!r?.ok) return;
    setMovie(r.playing ? { ...r, got: Date.now() } : null);
  }, []);

  useEffect(() => {
    if (scene !== "movie") return undefined;
    loadMovie();
    const iv = setInterval(loadMovie, 4000);
    return () => clearInterval(iv);
  }, [scene, loadMovie]);

  /* 남이 틀면 바로 알아채게 */
  useEffect(() => {
    if (!movie) return undefined;
    const left = Math.max(0, movie.secs - movie.at) * 1000 + 800;
    const t = setTimeout(loadMovie, left);
    return () => clearTimeout(t);
  }, [movie, loadMovie]);

  /* 올라온 캐릭터 이미지 가져오기 */
  const loadSkins = useCallback(async () => {
    if (!hasServer) return;
    skinsAt.current = Date.now();
    const r = await skinList();
    if (Array.isArray(r)) setSkins(r);
  }, []);

  useEffect(() => { loadSkins(); }, [loadSkins]);

  /* 남이 내가 모르는 이미지를 입고 있으면 한 번 더 받아옵니다 */
  useEffect(() => {
    const unknown = peerView.some((q) => q.lk?.sk && !skins.some((s) => s.id === q.lk.sk));
    if (unknown && Date.now() - skinsAt.current > 15000) loadSkins();
  }, [peerView, skins, loadSkins]);

  const skinImg = useCallback(
    (lk) => (lk?.sk ? skins.find((s) => s.id === lk.sk)?.image || null : null),
    [skins]
  );

  /* 꾸미기 — 안 산 건 별을 내고 삽니다 */
  const applyLook = useCallback((next, cost, key) => {
    if (cost > 0) {
      if (balance < cost) return;
      setSpent((v) => v + cost);
      setOwned((v) => {
        const list = v.includes(key) ? v : [...v, key];
        try {
          localStorage.setItem("ccOwned", JSON.stringify(list));
        } catch {
          /* 무시 */
        }
        return list;
      });
      setToast(`별 ${cost}개로 샀어요`);
    }
    setLook(next);
    lookRef.current = next;
    try {
      localStorage.setItem("ccLook", JSON.stringify(next));
    } catch {
      /* 무시 */
    }
    blip(880);
  }, [balance]);

  /* 앉으면 오가는 이야기 — 두 마디씩 주고받고 끝납니다 */
  const clearSeatTalk = useCallback(() => {
    talkTimers.current.forEach(clearTimeout);
    talkTimers.current = [];
    talking.current = false;
    setTalk(null);
  }, []);

  /* 대사를 차례로 띄웁니다. 끝나면 done 을 부릅니다 */
  const runTalk = useCallback((script, delay, done) => {
    talkTimers.current.forEach(clearTimeout);
    talkTimers.current = [];
    if (!script.length) return;
    talking.current = true;
    const gap = 2300;
    script.forEach((line, i) => {
      talkTimers.current.push(setTimeout(() => setTalk(line), delay + i * gap));
    });
    talkTimers.current.push(
      setTimeout(() => {
        talking.current = false;
        talkTimers.current = [];
        setTalk(null);
        done?.();
      }, delay + script.length * gap)
    );
  }, []);

  /* 앉으면 직원이 말을 겁니다. 카페에서는 테이블까지 걸어와요 */
  const startSeatTalk = useCallback((roomId, chair) => {
    const pool = SEAT_TALK[roomId];
    if (!pool?.length) return;
    const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
    const script = pick.flatMap((t) => [{ who: "s", text: t.s }, { who: "m", text: t.m }]);

    let delay = 700;
    const home = ROOMS[roomId]?.staff;
    if (roomId === "cafe" && chair != null) {
      const c = CAFE_CHAIRS.find((x) => x.i === chair);
      const tb = c && CAFE_TABLES[c.t];
      if (tb) {
        staffTo.current = { x: c.x < tb.x ? tb.x + 74 : tb.x - 74, y: tb.y + 4 };
        delay = 1500;   // 걸어오는 동안 기다립니다
      }
    }
    runTalk(script, delay, () => {
      if (home) staffTo.current = { ...home };   // 끝나면 자리로 돌아가요
    });
  }, [runTalk]);

  /* 한 테이블에 둘이 앉으면 저희끼리 스몰토크 */
  const startPairTalk = useCallback((myChair, mateChair) => {
    if (talking.current) return;
    /* 직원은 자리로 돌려보내고 둘이 이야기합니다 */
    const home = ROOMS.cafe?.staff;
    if (home) staffTo.current = { ...home };
    /* 두 사람 화면이 같은 대사를 고르도록 의자 번호로만 정합니다 */
    const lo = Math.min(myChair, mateChair);
    const t = SMALL_TALK[(myChair + mateChair * 3 + lo) % SMALL_TALK.length];
    const first = lo === myChair ? "m" : mateChair;
    const second = lo === myChair ? mateChair : "m";
    runTalk(
      [
        { who: first, text: t.a },
        { who: second, text: t.b },
        { who: first, text: t.c },
        { who: second, text: t.d },
      ],
      900
    );
  }, [runTalk]);

  /* 미끄럼틀 타기 — up 이면 아랫섬에서 윗섬으로 */
  const startRide = useCallback((sl, up) => {
    if (rideRef.current) return;
    rideRef.current = { at: performance.now(), ms: 1150, up, sl };
    setRiding(true);
    swoosh(!up);
    setToast(up ? "슝 — 위로!" : "슝 — 아래로!");
  }, []);

  /* 환영 팝업 닫기 */
  const closeWelcome = useCallback(() => {
    setWelcome(false);
    welcomeRef.current = false;
    blip(880);
    try {
      localStorage.setItem("ccWelcome", "seen");
    } catch {
      /* 무시 */
    }
  }, []);

  /* 가이드 한 줄 체크 */
  const doQuest = useCallback((id) => {
    if (questRef.current.includes(id)) return;
    questRef.current = [...questRef.current, id];
    setQuests(questRef.current);
    try {
      localStorage.setItem("ccQuests", JSON.stringify(questRef.current));
    } catch {
      /* 무시 */
    }
    const q = QUESTS.find((x) => x.id === id);
    setJustDone(id);
    blip(880);
    setTimeout(() => blip(1170), 110);

    if (questRef.current.length >= QUESTS.length && bonusAt.current < QUESTS.length) {
      /* 다 깼습니다 — 별 100개. 항목이 늘어나면 다시 다 깰 때 또 받아요 */
      const again = bonusAt.current > 0;
      bonusAt.current = QUESTS.length;
      bonusRef.current += CLEAR_BONUS;
      setBonus(bonusRef.current);
      setToast(
        again
          ? `🎉 새로 생긴 것까지 다 깼어요! 별 ${CLEAR_BONUS}개 더 받았습니다`
          : `🎉 다 해내셨어요! 별 ${CLEAR_BONUS}개를 받았습니다`
      );
      try {
        localStorage.setItem(BONUS_KEY, JSON.stringify({ total: bonusRef.current, at: bonusAt.current }));
      } catch {
        /* 무시 */
      }
      [0, 160, 320, 520].forEach((ms, i) => setTimeout(() => blip([880, 1050, 1320, 1760][i]), ms + 200));
      return;
    }
    setToast(`✅ ${q ? q.name : ""} — 해봤어요!`);
  }, []);

  useEffect(() => { doQuestRef.current = doQuest; }, [doQuest]);

  const resetQuests = useCallback(() => {
    questRef.current = [];
    walkRef.current = 0;
    setQuests([]);
    setJustDone(null);
    setBonus(0);
    bonusRef.current = 0;
    bonusAt.current = 0;
    setWelcome(true);
    welcomeRef.current = true;
    try {
      localStorage.removeItem("ccQuests");
      localStorage.removeItem("ccWelcome");
      localStorage.removeItem(BONUS_KEY);
    } catch {
      /* 무시 */
    }
  }, []);

  /* 건물 안으로 */
  const enterRoom = useCallback((id) => {
    if (id === "escape") {
      setToast("🔐 방탈출은 준비중이에요!");
      return;
    }
    if (!ROOMS[id]) return;
    worldPos.current = { ...posRef.current };
    sceneRef.current = id;
    const st = ROOMS[id].staff ? { ...ROOMS[id].staff } : null;
    staffRef.current = st;
    staffTo.current = st;
    setStaffPos(st);
    const start = { x: ROOM.w / 2, y: ROOM.d - 60 };
    posRef.current = start;
    setPos(start);
    setScene(id);
    setSheet(null);
    setToast(`${ROOMS[id].emoji} ${ROOMS[id].name} — ${ROOMS[id].hint}`);
    if (UP_ROOMS.includes(id)) doQuestRef.current?.("up");
  }, []);

  /* 마을로 */
  const exitRoom = useCallback(() => {
    sceneRef.current = null;
    zoneRef.current = null;
    sitRef.current = null;
    setSit(null);
    lyingRef.current = false;
    setLying(false);
    bounceRef.current = false;
    setBouncing(false);
    clearSeatTalk();
    pairRef.current = null;
    staffRef.current = null;
    staffTo.current = null;
    setStaffPos(null);
    setZoneId(null);
    setSheet(null);
    const back = worldPos.current;
    posRef.current = { ...back };
    setPos({ ...back });
    setScene(null);
  }, [clearSeatTalk]);

  /* 방 안에서 설치물 사용 */
  const activateZone = useCallback((id) => {
    /* 앉아 있으면 무엇을 누르든 먼저 일어납니다 */
    if (sitRef.current != null) {
      const room0 = ROOMS[sceneRef.current];
      const c = (room0?.chairs || CHAIRS).find((x) => x.i === sitRef.current);
      if (!c) { sitRef.current = null; setSit(null); return; }
      sitRef.current = null;
      setSit(null);
      clearSeatTalk();
      pairRef.current = null;
      const back0 = ROOMS[sceneRef.current]?.staff;
      if (back0) staffTo.current = { ...back0 };
      const room = ROOMS[sceneRef.current];
      const back = room ? freeSpot(room, c.x, c.y) : { x: c.x, y: c.y + 60 };
      posRef.current = back;
      setPos(back);
      return;
    }
    if (!id) return;
    if (id === "exit") { exitRoom(); return; }
    if (id === "dress") loadSkins();
    if (id === "arcade" || id === "starview" || id === "showtime" || id === "songs") { setSheet(id); return; }
    if (id === "lie") {
      /* 지금 선 자리에 그대로 눕습니다. 한 번 더 누르면 일어나요 */
      const on = !lyingRef.current;
      lyingRef.current = on;
      setLying(on);
      blip(on ? 620 : 780);
      return;
    }
    if (id === "soon") {
      setToast("아직 만드는 중이에요. 우체통에 아이디어 주시면 반영할게요!");
      blip(520);
      return;
    }
    if (id === "chair") {
      const i = chairRef.current;
      const room1 = ROOMS[sceneRef.current];
      const c = (room1?.chairs || CHAIRS).find((x) => x.i === i);
      if (!c) return;
      sitRef.current = i;
      setSit(i);
      posRef.current = { x: c.x, y: c.y };
      setPos({ x: c.x, y: c.y });
      blip(760);
      startSeatTalk(sceneRef.current, i);
      if (sceneRef.current === "cake") doQuest("sit");
      return;
    }
    setSheet(id);
  }, [exitRoom, doQuest, startSeatTalk, clearSeatTalk, loadSkins]);

  /* 같은 테이블에 둘이 앉으면 스몰토크를 시작합니다 */
  useEffect(() => {
    if (scene !== "cafe" || sit == null) {
      pairRef.current = null;
      return;
    }
    const mine = CAFE_CHAIRS.find((c) => c.i === sit);
    const mate = peerView.find((q) => {
      if ((q.r || "") !== "cafe" || !(q.st >= 0)) return false;
      const c = CAFE_CHAIRS.find((x) => x.i === q.st);
      return c && mine && c.t === mine.t && c.i !== sit;
    });
    const key = mate ? mate.st : null;
    if (key == null) {
      pairRef.current = null;
      return;
    }
    if (pairRef.current === key) return;   // 이 사람과는 이미 했어요
    if (talking.current) return;           // 직원이 말하는 중 — 끝나면 다시 옵니다
    pairRef.current = key;
    startPairTalk(sit, key);
  }, [scene, sit, peerView, startPairTalk]);

  const openBuilding = useCallback((id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    if (b.sheet) { setSheet(b.sheet); return; }   /* 방이 없는 건물은 바로 창을 엽니다 */
    enterRoom(id);
  }, [enterRoom]);

  /* 터치가 한 번이라도 들어오면 조작 UI 를 켭니다.
     기기에 따라 CSS 판정(pointer:coarse)이 어긋나 조이스틱이 안 보이는 경우가 있어요. */
  useEffect(() => {
    if (touch) return undefined;
    const onTouch = () => setTouch(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, [touch]);

  /* 첫 입력 때 오디오를 깨웁니다 (사파리 대응) */
  useEffect(() => {
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("touchstart", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  /* 화면 크기 */
  useEffect(() => {
    const vv = window.visualViewport;
    const onKeyboard = () => {
      /* 키보드 높이만큼 조이스틱·채팅바를 올려줍니다 */
      const gap = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      document.documentElement.style.setProperty("--kb", `${Math.round(gap)}px`);
    };
    onKeyboard();
    vv?.addEventListener("resize", onKeyboard);
    vv?.addEventListener("scroll", onKeyboard);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setView({ w, h });
      /* 폰 가로화면처럼 낮은 화면에서는 살짝 줌아웃해서 시야를 확보합니다 */
      setZoom(clamp(Math.min(h / 720, w / 1100), 0.55, 1));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      vv?.removeEventListener("resize", onKeyboard);
      vv?.removeEventListener("scroll", onKeyboard);
    };
  }, []);

  /* 키 입력 */
  useEffect(() => {
    const down = (e) => {
      const k = e.key.toLowerCase();
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
      if (welcomeRef.current) {
        if (k === " " || k === "enter" || k === "escape") { e.preventDefault(); closeWelcome(); }
        return;
      }
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === " ") {
        if (sheetRef.current) { setSheet(null); return; }
        if (sceneRef.current) activateZone(zoneRef.current);
        else if (nearRef.current) openBuilding(nearRef.current);
        return;
      }
      if (k === "enter" || k === "c" || k === "ㅊ") {
        e.preventDefault();
        chatBox.current?.focus();
        return;
      }
      if (k === "escape") {
        setSheet(null);
        return;
      }
      keys.current[k] = true;
    };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; };
    const blur = () => { keys.current = {}; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [openBuilding, activateZone, closeWelcome]);

  /* 키보드 — 밟으면 쑥 들어갔다가 1.5초 뒤에 올라옵니다 */
  const pressKey = useCallback((i, mine) => {
    if (pressedRef.current.includes(i)) return;
    pressedRef.current = [...pressedRef.current, i];
    setPressed(pressedRef.current);
    keyclick(sfxUrl.current.key);
    if (mine) { chanRef.current?.fx({ t: "key", i }); doQuest("asmr"); }
    setTimeout(() => {
      pressedRef.current = pressedRef.current.filter((n) => n !== i);
      setPressed(pressedRef.current);
    }, 1500);
  }, [doQuest]);

  /* 메뉴 사기 — 별을 쓰고 손에 듭니다 */
  const buyMenu = useCallback((item) => {
    setSpent((v) => v + item.price);
    setHolding(item);
    holdRef.current = MENU.findIndex((m) => m.id === item.id);
    setToast(`${item.emoji} ${item.name} 를 샀어요`);
    doQuest("buy");
  }, [doQuest]);

  /* 왁뿌볼 — 밟으면 뿌셔지고 12초 뒤 다시 생깁니다 */
  const popBall = useCallback((i, mine) => {
    if (brokenRef.current.includes(i)) return;
    brokenRef.current = [...brokenRef.current, i];
    setBroken(brokenRef.current);
    crack(sfxUrl.current.ball);
    if (mine) { chanRef.current?.fx({ t: "ball", i, r: "flower" }); doQuest("asmr"); }
    setTimeout(() => {
      brokenRef.current = brokenRef.current.filter((n) => n !== i);
      setBroken(brokenRef.current);
    }, 12000);
  }, [doQuest]);

  /* ---------- 팀전 ----------
     방을 만든 사람이 그 방의 주인이고, 자기 방 상태를 주기적으로 알립니다.
     참여·나가기·시작 요청은 방 주인에게 보내고, 주인이 정리해서 다시 알려요. */
  const putGame = useCallback((g) => {
    setGames((list) => {
      const rest = list.filter((x) => x.gid !== g.gid);
      return g.gone ? rest : [...rest, { ...g, at: g.at || Date.now(), heard: Date.now() }];
    });
  }, []);

  const myGame = useCallback(() => gamesRef.current.find((g) => g.hostId === deviceId()), []);

  const announce = useCallback((g) => {
    chanRef.current?.fx({ t: "game", g: { ...g, heard: undefined } });
  }, []);

  const createGame = useCallback(({ size, pack }) => {
    const g = {
      gid: deviceId() + "-" + Date.now().toString(36),
      hostId: deviceId(),
      hostName: me.name,
      pack,
      size,
      state: "wait",
      members: [{ id: deviceId(), name: me.name }],
      at: Date.now(),
    };
    putGame(g);
    setMyGid(g.gid);
    announce(g);
    blip(820);
  }, [me, putGame, announce]);

  const joinGame = useCallback((gid) => {
    chanRef.current?.fx({ t: "join", gid, who: { id: deviceId(), name: me.name } });
    setMyGid(gid);
    blip(700);
  }, [me]);

  const leaveGame = useCallback((gid) => {
    const g = gamesRef.current.find((x) => x.gid === gid);
    if (g && g.hostId === deviceId()) {
      putGame({ gid, gone: true });
      chanRef.current?.fx({ t: "gameEnd", gid });
    } else {
      chanRef.current?.fx({ t: "leave", gid, who: { id: deviceId() } });
    }
    setMyGid(null);
  }, [putGame]);

  const startGame = useCallback((gid) => {
    const g = gamesRef.current.find((x) => x.gid === gid);
    if (!g || g.members.length < 2) return;
    const next = { ...g, state: "play" };
    putGame(next);
    announce(next);
    chanRef.current?.fx({ t: "start", gid, pack: g.pack });
    setTeamPack(g.pack);
    setSheet("quiz");
  }, [putGame, announce]);

  /* 내가 연 방은 2.5초마다 살아 있다고 알립니다 */
  useEffect(() => {
    const iv = setInterval(() => {
      const g = myGame();
      if (g) announce(g);
      /* 오래 소식 없는 방은 목록에서 지웁니다 */
      setGames((list) => list.filter((x) => x.hostId === deviceId() || Date.now() - (x.heard || 0) < 9000));
    }, 2500);
    return () => clearInterval(iv);
  }, [announce, myGame]);

  /* 퀴즈 주제 목록 (팀전 만들 때 고르려고) */
  useEffect(() => {
    if (!hasServer) return;
    (async () => {
      const p = await quizPacks();
      if (Array.isArray(p)) setPacks(p);
    })();
  }, [sheet]);

  /* 게임 루프 — 마을과 방 안 모두 여기서 돕니다 */
  useEffect(() => {
    let raf;
    let last = performance.now();
    const worldBoxes = BUILDINGS.map(blockBox);
    const R = 14;

    const step = (now) => {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      const k = keys.current;
      const roomId = sceneRef.current;
      const room = roomId ? ROOMS[roomId] : null;

      let dx = 0;
      let dy = 0;
      if (k.arrowleft || k.a) dx -= 1;
      if (k.arrowright || k.d) dx += 1;
      if (k.arrowup || k.w) dy -= 1;
      if (k.arrowdown || k.s) dy += 1;
      const st = stick.current;
      if (st.x || st.y) { dx = st.x; dy = st.y; }
      if (openRef.current || sitRef.current != null || rideRef.current || lyingRef.current) { dx = 0; dy = 0; }

      const bounds = room
        ? { x0: room.play.x0, x1: room.play.x1, y0: room.play.y0, y1: room.play.y1 }
        : PLAY;
      const boxes = room ? room.blocks : worldBoxes;
      const hit = (x, y) => boxes.some((b) => x + R > b.x1 && x - R < b.x2 && y + R > b.y1 && y - R < b.y2);

      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving) {
        const len = Math.hypot(dx, dy) || 1;
        const speed = room ? 3.0 : 3.4;
        const sp = speed * dt * Math.min(1, len);
        let { x, y } = posRef.current;
        const nx = clamp(x + (dx / len) * sp, bounds.x0, bounds.x1);
        if (!hit(nx, y) && (room || inArea(nx, y))) x = nx;
        const ny = clamp(y + (dy / len) * sp, bounds.y0, bounds.y1);
        if (!hit(x, ny) && (room || inArea(x, ny))) y = ny;
        posRef.current = { x, y };
        setPos({ x, y });
        if (!room) walkRef.current += sp;
        if (dx !== 0) {
          facingRef.current = dx > 0 ? 1 : -1;
          setFacing(facingRef.current);
        }
      }
      if (isMoving !== movingRef.current) {
        movingRef.current = isMoving;
        setMoving(isMoving);
      }

      /* 다른 사람 위치 부드럽게 — 초당 8번 오는 좌표 사이를 채워줍니다 */
      const targets = peersRef.current;
      if (targets.length || smooth.current.size) {
        const out = [];
        const alive = new Set();
        for (const t of targets) {
          alive.add(t.id);
          let v = smooth.current.get(t.id);
          if (!v) v = { x: t.x, y: t.y, r: t.r };
          const far = Math.hypot(t.x - v.x, t.y - v.y) > 320;
          if (far || v.r !== t.r) {          // 방을 옮겼거나 너무 멀면 바로 붙입니다
            v.x = t.x;
            v.y = t.y;
          } else {
            const f = Math.min(1, 0.22 * dt);
            v.x += (t.x - v.x) * f;
            v.y += (t.y - v.y) * f;
          }
          v.r = t.r;
          smooth.current.set(t.id, v);
          out.push({ ...t, x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 });
        }
        smooth.current.forEach((_, id) => { if (!alive.has(id)) smooth.current.delete(id); });
        setPeerView(out);
      }

      const p = posRef.current;

      if (room) {
        /* --- 방 안 --- */
        let z = null;
        let zd = Infinity;
        for (const zone of room.zones) {
          const d = Math.hypot(p.x - zone.x, p.y - zone.y);
          if (d < zone.r && d < zd) { z = zone.id; zd = d; }
        }
        /* 의자 — 가까이 가면 앉을 수 있어요 */
        if (room.chairs && sitRef.current == null) {
          for (const c of room.chairs) {
            const d = Math.hypot(p.x - c.x, (p.y - c.y) * 1.4);
            if (d < 78 && d < zd) { z = "chair"; zd = d; chairRef.current = c.i; }
          }
        }
        if (sitRef.current != null) z = "chair";
        /* 천문대는 아무 데나 누울 수 있어요. 다른 게 없으면 눕기 */
        if (!z && room.lieAnywhere) z = "lie";
        if (lyingRef.current) z = "lie";
        if (z !== zoneRef.current) { zoneRef.current = z; setZoneId(z); }

        /* 방방 위에 올라서면 저절로 통통 튑니다 */
        if (room.tramps) {
          const on = room.tramps.some(
            (t) => Math.hypot(p.x - t.x, (p.y - t.y) * 2.1) < t.r * 0.92
          );
          if (on !== bounceRef.current) {
            bounceRef.current = on;
            setBouncing(on);
          }
          if (on && now - bounceAt.current > 520) {
            bounceAt.current = now;
            boing(Math.random() > 0.5);
          }
        } else if (bounceRef.current) {
          bounceRef.current = false;
          setBouncing(false);
        }

        /* 낙엽 밟는 소리 */
        if (room.crunch && isMoving) {
          const d = Math.hypot(p.x - room.crunch.x, (p.y - room.crunch.y) * 1.6);
          if (d < room.crunch.r && now - sfxAt.current > 380) {
            sfxAt.current = now;
            crunch(sfxUrl.current.sand);
            doQuest("asmr");
          }
        }

        /* 방 안에 있는 별 줍기 */
        if (room.stars) {
          const got = roomStarsRef.current[room.id] || room.stars.map(() => false);
          let idx = -1;
          room.stars.forEach((st, i) => {
            if (!got[i] && Math.hypot(p.x - st.x, (p.y - st.y) * 1.4) < 40) idx = i;
          });
          if (idx >= 0) {
            const next = got.slice();
            next[idx] = true;
            roomStarsRef.current = { ...roomStarsRef.current, [room.id]: next };
            setRoomStars(roomStarsRef.current);
            setToast("별을 주웠어요");
            doQuest("star");
          }
        }

        /* 왁뿌볼 밟기 */
        if (room.balls) {
          for (const b of room.balls) {
            if (brokenRef.current.includes(b.i)) continue;
            if (Math.hypot(p.x - b.x, (p.y - b.y) * 1.5) < 34) {
              popBall(b.i, true);
              break;
            }
          }
        }

        /* 키보드 밟기 — 키보드가 바닥에 누워 있어서 방 좌표 그대로 판정합니다 */
        if (room.keys) {
          const K = room.keys;
          for (let i = 0; i < keyCount(K); i++) {
            if (pressedRef.current.includes(i)) continue;
            const c = keyPos(K, i);
            if (Math.abs(p.x - c.x) < K.w / 2 && Math.abs(p.y - c.y) < K.h / 2) {
              pressKey(i, true);
              break;
            }
          }
        }

        /* 수영 */
        if (room.water) {
          const w = room.water;
          const inWater =
            Math.abs(p.x - w.x) < w.w / 2 && Math.abs(p.y - w.y) < w.d / 2;
          if (inWater !== swimRef.current) {
            swimRef.current = inWater;
            if (inWater) { splash(sfxUrl.current.splash); sfxAt.current = now; doQuest("swim"); }
          } else if (inWater && isMoving && now - sfxAt.current > 700) {
            sfxAt.current = now;
            splash(sfxUrl.current.splash);
          }
          setWave(now / 260);
        }

        camRef.current = { x: 0, y: 0 };
        raf = requestAnimationFrame(step);
        return;
      }

      /* --- 마을 --- */
      /* 미끄럼틀 — 타는 동안은 길을 따라 옮겨주고, 조작은 받지 않습니다 */
      const rd = rideRef.current;
      if (rd) {
        const k = Math.min(1, (now - rd.at) / rd.ms);
        /* 내려갈 땐 점점 빨라지고, 올라갈 땐 끝에서 살짝 느려져요 */
        const pr = rd.up ? 1 - Math.pow(1 - k, 1.6) : Math.pow(k, 1.6);
        const at = slidePoint(rd.sl, rd.up ? 1 - pr : pr);
        posRef.current = at;
        setPos(at);
        if (k >= 1) {
          rideRef.current = null;
          setRiding(false);
        }
      } else {
        const end = SLIDE_ENDS.find((e) => Math.hypot(p.x - e.x, p.y - e.y) < SLIDE_R);
        if (!end) rideLock.current = false;
        else if (!rideLock.current) {
          rideLock.current = true;
          /* 체크를 먼저 — 토스트는 "슝" 쪽이 남게 */
          doQuest("slide");
          startRide(end.sl, end.up);
        }
      }

      let best = null;
      let bestD = Infinity;
      for (const b of BUILDINGS) {
        const d = Math.hypot(p.x - b.x, p.y - (b.y - 20));
        const reach = 12 * b.scale + 40;
        if (d < reach && d < bestD) { best = b.id; bestD = d; }
      }
      if (best !== nearRef.current) { nearRef.current = best; setNearId(best); }

      const cur = starsRef.current;
      let picked = -1;
      STAR_SPOTS.forEach(([sx, sy], i) => {
        if (!cur[i] && Math.hypot(p.x - sx, p.y - sy) < 36) picked = i;
      });
      if (picked >= 0) {
        const next = cur.slice();
        next[picked] = true;
        starsRef.current = next;
        setStars(next);
        const n = next.filter(Boolean).length;
        setToast(n === STAR_SPOTS.length ? "별을 전부 모았어요!" : `별을 주웠어요  ${n} / ${STAR_SPOTS.length}`);
        doQuest("star");
      }

      /* 가이드 — 조금 걸어보면 체크 */
      if (walkRef.current > 700) doQuest("walk");

      const v = viewRef.current;
      const z = v.z || 1;
      const vw = v.w / z;
      const vh = v.h / z;
      const tx = clamp(p.x - vw / 2, 0, Math.max(0, WORLD.w - vw));
      const ty = clamp(p.y - vh / 2 - 40 / z, 0, Math.max(0, WORLD.h - vh));
      const c = camRef.current;
      const nc = { x: c.x + (tx - c.x) * 0.14, y: c.y + (ty - c.y) * 0.14 };
      camRef.current = nc;
      setCam(nc);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [popBall, pressKey, doQuest, startRide]);

  /* 같이 접속한 사람 */
  useEffect(() => {
    if (!hasServer || me.role === "solo" || !me.round) return undefined;
    const chan = joinChannel({
      round: me.round,
      me: { id: deviceId(), name: me.name, slot: me.slot },
      getPose: () => ({
        x: Math.round(posRef.current.x),
        y: Math.round(posRef.current.y),
        f: facingRef.current,
        m: movingRef.current ? 1 : 0,
        r: sceneRef.current || "",
        st: sitRef.current == null ? -1 : sitRef.current,
        w: waitRef.current,
        hd: holdRef.current,
        lk: lookRef.current,
        role: me.role,
        bgmMap: me.role === "host" ? roomBgmRef.current : undefined,
      }),
      onPeers: (list) => {
        setPeers(list);
        const host = list.find((p) => p.role === "host");
        if (host?.bgmMap && typeof host.bgmMap === "object") setHostBgmMap(host.bgmMap);
      },
      onLive: setLive,
      /* 다른 방에 있는 사람의 채팅은 말풍선 대신 목록으로 */
      onFx: (e) => {
        if (!e) return;
        if (e.t === "ball") {
          if (sceneRef.current === "flower") popBall(e.i, false);
          return;
        }
        if (e.t === "karaoke") {
          if (e.url && youtubeId(e.url)) {
            setKaraoke({ title: e.title || "노래방", url: e.url, by: e.by || "손님" });
          }
          return;
        }
        if (e.t === "karaokeStop") { setKaraoke(null); return; }
        if (e.t === "movie") { loadMovie(); return; }
        if (e.t === "key") {
          if (sceneRef.current === "flower") pressKey(e.i, false);
          return;
        }
        if (e.t === "game") { putGame(e.g); return; }
        if (e.t === "gameEnd") { putGame({ gid: e.gid, gone: true }); return; }
        if (e.t === "join" || e.t === "leave") {
          /* 방 주인만 명단을 고칩니다 */
          const g = gamesRef.current.find((x) => x.gid === e.gid && x.hostId === deviceId());
          if (!g) return;
          const members =
            e.t === "join"
              ? g.members.some((m) => m.id === e.who.id) || (g.size > 0 && g.members.length >= g.size)
                ? g.members
                : [...g.members, e.who]
              : g.members.filter((m) => m.id !== e.who.id);
          const next = { ...g, members };
          putGame(next);
          announce(next);
          return;
        }
        if (e.t === "start") {
          if (myGidRef.current !== e.gid) return;
          setTeamPack(e.pack);
          setSheet("quiz");
          setToast("팀전이 시작됐어요!");
          return;
        }
        if (e.t === "score") {
          setResults((r) => [...r.filter((x) => x.id !== e.id), { id: e.id, name: e.name, ok: e.ok, done: e.done }]);
        }
      },
      onChat: (msg) => {
        const at = Date.now();
        setHistory((h) => [...h.slice(-199), { ...msg, at }]);
        if ((msg.r || "") === (sceneRef.current || "")) return;
        setChatLog((l) => [...l.slice(-3), { ...msg, at }]);
      },
    });
    chanRef.current = chan;
    return () => {
      chanRef.current = null;
      chan.stop();
    };
  }, [me]);

  /* 채팅 보내기 — 내 머리 위에도 3초간 띄웁니다 */
  const sendChat = useCallback(() => {
    const t = chatText.trim().slice(0, 60);
    setChatText("");
    chatBox.current?.blur();          // 폰에서 키보드가 조이스틱을 가리지 않게
    if (!t) return;
    chanRef.current?.chat(t, sceneRef.current || "");
    setHistory((h) => [
      ...h.slice(-199),
      { id: "me", name: me.name, text: t, r: sceneRef.current || "", at: Date.now(), mine: true },
    ]);
    setMyMsg(t);
    clearTimeout(myMsgTimer.current);
    myMsgTimer.current = setTimeout(() => setMyMsg(null), CHAT_MS);
    doQuest("chat");
  }, [chatText, me, doQuest]);

  /* 기록을 열거나 새 말이 오면 맨 아래로 내려줍니다 */
  useEffect(() => {
    if (logOpen && histBox.current) histBox.current.scrollTop = histBox.current.scrollHeight;
  }, [logOpen, history]);

  /* 방 BGM — 호스트가 정한 곡을 방에 있는 모든 사람에게 재생합니다.
     호스트의 bgmMap은 Realtime pose에 같이 실려서 늦게 들어온 사람도 받을 수 있습니다. */
  const currentBgm = scene
    ? (me.role === "host" ? roomBgmMap[scene] : hostBgmMap[scene]) || null
    : null;

  useEffect(() => {
    const a = bgmAudio.current;
    if (!a) return;
    const url = currentBgm?.url || "";
    if (!url) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      return;
    }
    if (a.src !== url) {
      a.src = url;
      a.loop = true;
      a.volume = muted ? 0 : vol;
      const p = a.play();
      if (p?.catch) p.catch(() => {});
    } else if (a.paused) {
      const p = a.play();
      if (p?.catch) p.catch(() => {});
    }
  }, [currentBgm, scene]);

  useEffect(() => {
    if (bgmAudio.current) bgmAudio.current.volume = muted ? 0 : vol;
  }, [vol, muted]);

  /* 모바일은 원격에서 시작한 소리를 막을 수 있어서, 사용자가 게임을 한 번 터치하면
     현재 방 BGM을 다시 재생해 줍니다. */
  useEffect(() => {
    if (!currentBgm) return undefined;
    const wakeBgm = () => {
      const a = bgmAudio.current;
      if (!a || !a.paused) return;
      const p = a.play();
      if (p?.catch) p.catch(() => {});
    };
    window.addEventListener("pointerdown", wakeBgm);
    window.addEventListener("touchstart", wakeBgm, { passive: true });
    window.addEventListener("keydown", wakeBgm);
    return () => {
      window.removeEventListener("pointerdown", wakeBgm);
      window.removeEventListener("touchstart", wakeBgm);
      window.removeEventListener("keydown", wakeBgm);
    };
  }, [currentBgm]);

  /* 음량 — 슬라이더를 움직이면 바로 반영하고 기기에 기억해둡니다 */
  useEffect(() => {
    if (audio.current) audio.current.volume = muted ? 0 : vol;
    try {
      localStorage.setItem("ccVol", String(vol));
    } catch {
      /* 무시 */
    }
  }, [vol, muted, track]);

  /* 올려둔 물소리가 있으면 가져옵니다 */
  useEffect(() => {
    if (!hasServer) return;
    (async () => {
      const list = await trackList();
      if (!Array.isArray(list)) return;
      const map = {};
      ["splash", "key", "sand", "ball"].forEach((k) => {
        const hit = findSfx(list, k);
        if (hit) map[k] = trackUrl(hit.path);
      });
      sfxUrl.current = map;
    })();
  }, [sheet]);

  /* 참가자 현황 */
  useEffect(() => {
    if (!hasServer || me.role === "solo") return undefined;
    let alive = true;
    const tick = async () => {
      const s = await fetchStatus();
      if (!alive) return;
      setRoom(s?.ok ? s : null);
      if (s?.ok && me.round && s.round !== me.round) {
        onKick(`${s.round}번 테스트가 시작됐어요. 다시 입장해주세요.`);
      } else if (s?.ok && s.closed && me.role !== "host") {
        onKick("베타테스트가 끝났어요. 다음에 다시 와주세요.");
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [me, onKick]);

  /* 비공개 모드 (호스트 전용) */
  const toggleClosed = useCallback(async () => {
    const next = !room?.closed;
    const r = await setClosed(me.hostCode, next);
    if (r?.ok) {
      setRoom((v) => ({ ...(v || {}), closed: next }));
      setToast(next ? "비공개 모드 — 호스트만 들어올 수 있어요" : "다시 공개됐어요");
    } else {
      setToast(JOIN_ERROR[r?.error] || JOIN_ERROR.server_error);
    }
  }, [me, room]);

  /* 회차 지정 (호스트 전용) */
  const doRound = useCallback(async (n) => {
    if (resetting) return;
    setResetting(true);
    const r = await startNewRound(me.hostCode, n);
    setResetting(false);
    if (r?.ok) {
      setRoom({ ok: true, round: r.round, taken: 0, players: [] });
      setToast(`${r.round}번 테스트를 시작했어요. 참가자 목록이 비었습니다`);
      /* 호스트는 새 회차에 다시 등록해서 그대로 남습니다 (게스트만 나가요) */
      setHistory([]);
      setChatLog([]);
      const again = await joinRoom(me.name, me.hostCode);
      setMe({ ...me, round: r.round, role: again?.role || "host", slot: again?.slot ?? 0 });
    } else {
      setToast(JOIN_ERROR[r?.error] || JOIN_ERROR.server_error);
    }
  }, [me, resetting, setMe]);

  useEffect(() => {
    if (!chatLog.length) return undefined;
    const iv = setInterval(() => {
      const now = Date.now();
      setChatLog((l) => (l.some((m) => now - m.at > CHAT_MS) ? l.filter((m) => now - m.at <= CHAT_MS) : l));
    }, 500);
    return () => clearInterval(iv);
  }, [chatLog.length]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /* 별을 줍거나 쓸 때마다 이 브라우저에 적어둡니다 */
  useEffect(() => {
    const rooms = {};
    Object.entries(roomStars).forEach(([id, list]) => {
      if (list?.some(Boolean)) rooms[id] = bits(list);
    });
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, stars: bits(stars), rooms, spent }));
    } catch {
      /* 무시 */
    }
  }, [stars, roomStars, spent]);

  useEffect(() => {
    if (!collected) return undefined;
    setStarPop(true);
    const t = setTimeout(() => setStarPop(false), 420);
    return () => clearTimeout(t);
  }, [collected]);

  useEffect(() => {
    if (!justDone) return undefined;
    const t = setTimeout(() => setJustDone(null), 1800);
    return () => clearTimeout(t);
  }, [justDone]);

  const ordered = useMemo(() => [...BUILDINGS].sort((a, b) => a.y - b.y), []);
  const questDone = QUESTS.filter((q) => quests.includes(q.id)).length;
  const nextQuest = QUESTS.find((q) => !quests.includes(q.id));
  const roundNo = room?.round ?? me.round;
  const R = scene ? ROOMS[scene] : null;
  const here = scene || "";
  const roomPeers = peerView.filter((p) => (p.r || "") === here);
  const seats = R?.chairs
    ? [...roomPeers.filter((q) => q.st >= 0).map((q) => q.st), ...(sit == null ? [] : [sit])]
    : [];
  const roomZoom = R
    ? Math.min(view.w / (SCREEN.w + 40), (view.h - 90) / (SCREEN.h + 20), 1.15)
    : 1;

  return (
    <div className={"ccRoot" + (touch ? " ccIsTouch" : "")}>
      <style>{CSS}</style>
      {scene ? (
        <div className="ccRoomBg" style={{ background: R.wallDark }}>
          <div
            className="ccRoomWrap"
            style={{ width: SCREEN.w, height: SCREEN.h, transform: `translate(-50%,-50%) scale(${roomZoom})` }}
          >
            <RoomStage
              room={R}
              waterPhase={wave}
              seats={seats}
              broken={broken}
              pressed={pressed}
              skin={scene === "candy" ? QUIZ_SKIN[quizMode] : null}
            />
            {me.role === "host" && (
              <button
                className="ccRoomBgmBtn"
                onClick={(e) => { e.stopPropagation(); setBgmOpen(true); }}
              >
                🎵 BGM 설정
              </button>
            )}
            {currentBgm && (
              <div className="ccRoomBgmNow">🎵 {currentBgm.title}</div>
            )}
            <div className="ccRoomLayer">
              {scene === "sing" && karaoke && youtubeId(karaoke.url) && (
                <div className="ccKaraokeRoomScreen">
                  <div className="ccKaraokeRoomFrame">
                    <div className="ccKaraokeRoomTop">
                      <span>🎤 구름노래방</span>
                      <b>{karaoke.title}</b>
                    </div>
                    <div className="ccKaraokeRoomVideo">
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeId(karaoke.url)}?autoplay=1&playsinline=1&rel=0`}
                        title={karaoke.title}
                        allow="autoplay; encrypted-media; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                    <div className="ccKaraokeRoomWho">🎤 {karaoke.by}님이 선곡했어요</div>
                  </div>
                </div>
              )}

              {scene === "sing" && (
                <div className="ccKaraokeCushions" aria-hidden="true">
                  <span className="ccKaraokeCushion c1" />
                  <span className="ccKaraokeCushion c2" />
                  <span className="ccKaraokeCushion c3" />
                  <span className="ccKaraokeCushion c4" />
                </div>
              )}
              {scene === "sing" && (
                <div
                  className="ccKaraokeRemote"
                  role="button"
                  tabIndex={0}
                  aria-label="노래방 선곡표 열기"
                  onClick={(e) => { e.stopPropagation(); setSheet("songs"); blip(760); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSheet("songs"); blip(760); } }}
                >
                  <div className="ccKaraokeRemoteHead">
                    <span className="ccKaraokeRemoteLogo">KY KARAOKE</span>
                    <span className="ccKaraokeRemoteLed" />
                  </div>
                  <div className="ccKaraokeRemoteMiniRow">
                    <span className="ccKaraokeRemoteMini">한국곡</span>
                    <span className="ccKaraokeRemoteMini">아이돌</span>
                    <span className="ccKaraokeRemoteMini">여자</span>
                  </div>
                  <div className="ccKaraokeRemoteMiniRow">
                    <span className="ccKaraokeRemoteMini">남자</span>
                    <span className="ccKaraokeRemoteMini">인기곡</span>
                    <span className="ccKaraokeRemoteMini">장르</span>
                  </div>
                  <div className="ccKaraokeRemoteMiniRow">
                    <span className="ccKaraokeRemoteMini ccKaraokeRemoteYellow">신곡</span>
                    <span className="ccKaraokeRemoteMini ccKaraokeRemoteYellow">검색</span>
                  </div>
                  <div className="ccKaraokeRemoteMain">
                    {['1','2','3','4','5','6','7','8','9'].map((n) => <span key={n} className="ccKaraokeRemoteNum">{n}</span>)}
                    <span className="ccKaraokeRemoteNum ccKaraokeRemoteBlue">취소</span>
                    <span className="ccKaraokeRemoteNum">0</span>
                    <span className="ccKaraokeRemoteNum ccKaraokeRemoteBlue">시작</span>
                  </div>
                  <div className="ccKaraokeRemoteNav">
                    <i className="l">◀</i><i className="r">▶</i><i className="d">▼</i>
                  </div>
                  <div className="ccKaraokeRemoteHint">선곡표</div>
                </div>
              )}

              {scene === "movie" && movie && (
                <div className="ccScreenWrap" style={{ width: 520, height: 300 }}>
                  <video
                    ref={vidRef}
                    className="ccScreenVid"
                    src={trackUrl(movie.path)}
                    autoPlay
                    playsInline
                    muted={muted2}
                    onLoadedMetadata={(e) => {
                      /* 늦게 들어와도 같은 지점부터 */
                      const at = movie.at + (Date.now() - movie.got) / 1000;
                      if (at > 0 && at < movie.secs) e.currentTarget.currentTime = at;
                    }}
                    onTimeUpdate={(e) => {
                      const want = movie.at + (Date.now() - movie.got) / 1000;
                      if (want < movie.secs && Math.abs(e.currentTarget.currentTime - want) > 1.6) {
                        e.currentTarget.currentTime = want;
                      }
                    }}
                  />
                  <div className="ccScreenBar">
                    <span className="ccScreenTitle">{movie.title}</span>
                    <button className="ccScreenSnd" onClick={() => setMuted2((v) => !v)}>
                      {muted2 ? "🔇 소리 켜기" : "🔊"}
                    </button>
                  </div>
                </div>
              )}
              {(R.stars || []).map((st, i) => {
                if ((roomStars[R.id] || [])[i]) return null;
                const pr = proj(st.x, st.y);
                return (
                  <div
                    key={"rs" + i}
                    className="ccStar ccRoomStar"
                    style={{
                      left: pr.sx - 20 * pr.k,
                      top: pr.sy - 46 * pr.k,
                      animationDelay: `${i * 0.4}s`,
                      transform: `scale(${pr.k})`,
                    }}
                  >
                    <Pix map={DECO.star.map} palette={DECO.star.palette} scale={4} cacheKey="star" />
                  </div>
                );
              })}
              {R.staff && (
                <Avatar
                  name={R.staffName || "직원"}
                  slot={R.id === "cake" ? 3 : 2}
                  msg={talk?.who === "s" ? talk.text : null}
                  x={proj((staffPos || R.staff).x, (staffPos || R.staff).y).sx}
                  y={proj((staffPos || R.staff).x, (staffPos || R.staff).y).sy}
                  facing={staffFace.current}
                  moving={staffWalk}
                  scale={depth((staffPos || R.staff).y)}
                />
              )}
              {roomPeers.map((q) => {
                const pr = proj(q.x, q.y);
                return (
                  <Avatar
                    key={q.id}
                    name={q.name}
                    slot={q.slot}
                    x={pr.sx}
                    y={pr.sy}
                    facing={q.f}
                    moving={!!q.m}
                    msg={q.msg || (talk?.who === q.st ? talk.text : null)}
                    scale={pr.k}
                    swim={inWater(R, q.x, q.y)}
                    waiting={!!q.w}
                    hold={q.hd >= 0 ? MENU[q.hd]?.emoji : null}
                    look={q.lk}
                    skin={skinImg(q.lk)}
                  />
                );
              })}
              <Avatar
                name={me.name}
                slot={me.slot}
                x={proj(pos.x, pos.y).sx}
                y={proj(pos.x, pos.y).sy}
                facing={facing}
                moving={moving}
                me
                msg={myMsg || (talk?.who === "m" ? talk.text : null)}
                scale={depth(pos.y)}
                swim={inWater(R, pos.x, pos.y)}
                waiting={!!waitRef.current && !!myGid}
                hold={holding?.emoji || null}
                look={look}
                skin={skinImg(look)}
                lie={lying}
                bounce={bouncing}
              />
            </div>
          </div>
          {scene === "candy" && (
            <div className="ccModes">
              <button
                className={"ccMode ccModeSolo" + (quizMode === "solo" ? " ccModeOn" : "")}
                onClick={() => { setQuizMode("solo"); blip(720); }}
              >
                개인전
              </button>
              <button
                className={"ccMode ccModeTeam" + (quizMode === "team" ? " ccModeOn" : "")}
                onClick={() => { setQuizMode("team"); blip(520); }}
              >
                팀전
              </button>
            </div>
          )}

          {scene === "candy" && quizMode === "team" && (
            <button className="ccLobbyBtn" onClick={() => setSheet("lobby")}>
              🤝 팀전 대기실
              {games.length > 0 && <span className="ccLobbyN">{games.length}</span>}
            </button>
          )}

          {zoneId && (
            <button className="ccZoneHint" onClick={() => activateZone(zoneId)}>
              SPACE —{" "}
              {zoneId === "chair"
                ? sit == null ? "앉기" : "일어나기"
                : zoneId === "lie"
                  ? lying ? "일어나기" : "여기 눕기"
                  : R.zones.find((z) => z.id === zoneId)?.label}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ccSky" />

          <div
            className="ccClouds"
            style={{ transform: `scale(${zoom}) translate3d(${-cam.x * 0.35}px, ${-cam.y * 0.35}px, 0)` }}
          >
            {CLOUDS.map(([x, y, s], i) => (
              <div key={i} className="ccCloud" style={{ left: x, top: y, animationDelay: `${i * 1.3}s` }}>
                <Pix map={DECO.cloud.map} palette={DECO.cloud.palette} scale={s} cacheKey="cloud" />
              </div>
            ))}
          </div>

          <div
            className="ccWorld"
            style={{
              width: WORLD.w,
              height: WORLD.h,
              transform: `scale(${zoom}) translate3d(${-cam.x}px, ${-cam.y}px, 0)`,
            }}
          >
            <Ground />
            <Slide />

            {TREES.map(([x, y, col], i) => (
              <div key={i} className="ccTree" style={{ left: x - 30, top: y - 80, zIndex: Math.round(y) }}>
                <Pix map={DECO.tree.map} palette={{ ...DECO.tree.palette, a: col }} scale={5} cacheKey={"tree-" + col} />
              </div>
            ))}

            {STAR_SPOTS.map(([x, y], i) =>
              stars[i] ? null : (
                <div key={i} className="ccStar" style={{ left: x - 20, top: y - 20, animationDelay: `${i * 0.3}s` }}>
                  <Pix map={DECO.star.map} palette={DECO.star.palette} scale={4} cacheKey="star" />
                </div>
              )
            )}

            {ordered.map((b) => (
              <div key={b.id} className="ccBWrap" style={{ zIndex: Math.round(b.y) }} onClick={() => openBuilding(b.id)}>
                <Building b={b} near={nearId === b.id} />
              </div>
            ))}

            {roomPeers.map((p) => (
              <Avatar
            key={p.id}
            name={p.name}
            slot={p.slot}
            x={p.x}
            y={p.y}
            facing={p.f}
            moving={!!p.m}
            msg={p.msg}
            waiting={!!p.w}
            hold={p.hd >= 0 ? MENU[p.hd]?.emoji : null}
            look={p.lk}
            skin={skinImg(p.lk)}
          />
            ))}

            <Avatar
          name={me.name}
          slot={me.slot}
          x={pos.x}
          y={pos.y}
          facing={facing}
          moving={moving}
          me
          msg={myMsg}
          waiting={!!waitRef.current && !!myGid}
          hold={holding?.emoji || null}
          slide={riding}
          look={look}
          skin={skinImg(look)}
        />
          </div>
        </>
      )}

      {/* 좌측 상단 */}
      <div className="ccHud">
        {scene && (
          <button className="ccChip ccExitChip" onClick={exitRoom}>
            ← {R.emoji} {R.name} 나가기
          </button>
        )}
        <div className="ccChip">{lookSprite(look).label} · {me.name}</div>
        <div
          className={"ccChip ccStarChip" + (starPop ? " ccStarPop" : "")}
          title={spent > 0 ? `모은 별 ${collected}개 · 쓴 별 ${spent}개` : "주운 별"}
        >
          <Pix map={DECO.star.map} palette={DECO.star.palette} scale={2} cacheKey="star" className="ccChipStar" />
          <b className="ccStarNum">{balance}</b>
          {spent > 0 && <span className="ccStarSub">/ {collected}</span>}
        </div>
        {me.role !== "solo" && (
          <div className="ccChip" title={roomPeers.map((p) => p.name).join(", ")}>
            {scene ? `이 방 ${roomPeers.length + 1}명` : `접속 ${online}명`}
          </div>
        )}
        {me.role !== "solo" && !live && (
          <div className="ccChip ccOffline" title="연결이 끊겨서 다른 사람이 안 보여요">
            ⚠ 연결 끊김 · 다시 붙는 중…
          </div>
        )}
      </div>

      {/* 우측 상단 — 회차 */}
      {roundNo != null && (
        <div className="ccRound">
          <span className="ccRoundNum">{roundNo}</span>번 테스트
          {room?.ok && <span className="ccRoundSub">{room.taken}명</span>}
          {room?.closed && <span className="ccClosedTag">비공개</span>}
        </div>
      )}

      {me.role === "solo" ? (
        <div className="ccHelp">방향키 · WASD 이동 / SPACE 상호작용 / C 채팅</div>
      ) : (
        <>
        {logOpen && (
          <div className="ccPanel ccHistory">
            <div className="ccSheetHead">
              <h2 className="ccSheetTitle">대화 기록</h2>
              <button className="ccX" onClick={() => setLogOpen(false)}>✕</button>
            </div>
            <div className="ccHistoryBody" ref={histBox}>
              {history.length === 0 && <p className="ccSheetNote">아직 대화가 없어요.</p>}
              {history.map((m, i) => (
                <div key={m.at + "-" + i} className={"ccHistLine" + (m.mine ? " ccHistMine" : "")}>
                  <span className="ccHistWho">{m.name}</span>
                  <span className="ccLogRoom">{m.r ? ROOMS[m.r]?.name : "마을"}</span>
                  <span className="ccHistText">{m.text}</span>
                </div>
              ))}
            </div>
            <p className="ccSheetNote">테스트 회차가 바뀌면 기록은 지워집니다.</p>
          </div>
        )}
        {!logOpen && history.length > 0 && (
          <div className="ccFeed" onClick={() => setLogOpen(true)} title="눌러서 전체 기록 보기">
            {history.slice(-5).map((m, i) => (
              <div key={m.at + "-" + i} className={"ccFeedLine" + (m.mine ? " ccFeedMine" : "")}>
                <b>{m.name}</b>
                {(m.r || "") !== (scene || "") && (
                  <span className="ccLogRoom">{m.r ? ROOMS[m.r]?.name : "마을"}</span>
                )}
                {m.text}
              </div>
            ))}
          </div>
        )}
        <form
          className="ccChatBar"
          onSubmit={(e) => {
            e.preventDefault();
            sendChat();
          }}
        >
          <input
            ref={chatBox}
            className="ccChatInput"
            value={chatText}
            maxLength={60}
            placeholder="C 를 눌러 채팅…"
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <button className="ccChatBtn" type="submit">보내기</button>
        </form>
        </>
      )}

      {toast && <div className="ccToast">{toast}</div>}

      {/* 우측 세로 스택 — 호스트 도구 + 뉴비 가이드 */}
      <div className="ccSide">
      {me.role === "host" && (
        <>
          <button className="ccChip ccHostBtn" onClick={() => setPanel((v) => !v)}>
            테스트 관리
          </button>
          {panel && (
            <div className="ccPanel ccHostPanel">
              <div className="ccHostTitle">{roundNo}번 테스트</div>

              <button className="ccHostToggle" onClick={() => setHostSection((v) => v === "players" ? "" : "players")}>
                <span>👥 테스트 접속자</span><span>{hostSection === "players" ? "▲" : "▼"}</span>
              </button>
              {hostSection === "players" && (
                <div className="ccHostToggleBody">
                  <div className="ccHostCount">게스트 {room?.taken ?? 0}명 · 최근 순</div>
                  <ul className="ccHostList">
                    {[...(room?.players || [])]
                      .sort((a, b) => new Date(b.joined || 0) - new Date(a.joined || 0))
                      .map((p, i) => (
                        <li key={i}>
                          <span className="ccHostWho">{p.role === "host" ? "왕관" : charForSlot(p.slot).label} · {p.name}</span>
                          <span className="ccHostWhen">{joinedAgo(p.joined)}</span>
                        </li>
                      ))}
                    {!room?.players?.length && <li className="ccHostEmpty">아직 아무도 안 왔어요</li>}
                  </ul>
                </div>
              )}

              <button className="ccHostToggle" onClick={() => setHostSection((v) => v === "locations" ? "" : "locations")}>
                <span>📍 현재 접속자 위치</span><span>{hostSection === "locations" ? "▲" : "▼"}</span>
              </button>
              {hostSection === "locations" && (
                <div className="ccHostToggleBody">
                  {(() => {
                    const counts = {};
                    (peerView || []).forEach((p) => {
                      const id = p.r || "";
                      const name = id ? (ROOMS[id]?.name || id) : "마을";
                      counts[name] = (counts[name] || 0) + 1;
                    });
                    const mine = scene ? (ROOMS[scene]?.name || scene) : "마을";
                    counts[mine] = (counts[mine] || 0) + 1;
                    const rows = Object.entries(counts).filter(([, n]) => n > 0);
                    return rows.length ? rows.map(([name, n]) => (
                      <div className="ccHostLocationRow" key={name}>
                        <span>{name}</span><b>{n}명</b>
                      </div>
                    )) : <div className="ccHostEmpty">현재 접속자가 없어요.</div>;
                  })()}
                </div>
              )}

              <div className="ccRoundRow">
                <input className="ccInput ccRoundInput" value={roundInput} inputMode="numeric" onChange={(e) => setRoundInput(e.target.value.replace(/[^0-9]/g, ""))} />
                <button className="ccBtn ccRoundBtn" onClick={() => doRound(Number(roundInput) || null)} disabled={resetting}>
                  {resetting ? "…" : "이 번호로 시작"}
                </button>
              </div>
              <button className="ccBtn ccHostReset" onClick={() => doRound(null)} disabled={resetting}>다음 회차로 넘기기</button>
              <button className={"ccBtn ccHostReset" + (room?.closed ? " ccClosedOn" : "")} onClick={toggleClosed}>
                {room?.closed ? "비공개 해제하기" : "비공개 모드 켜기"}
              </button>
              <p className="ccHostNote">시작하면 그 회차 참가자 기록이 지워져요. 이미 들어와 있던 사람은 새로고침해야 합니다.</p>
            </div>
          )}
        </>
      )}

      <button className="ccChip ccSetBtn" onClick={() => { setSetOpen((v) => !v); blip(700); }}>
        ⚙ 설정
      </button>
      {setOpen && (
        <div className="ccPanel ccSetPanel">
          <div className="ccSetTitle">글꼴</div>
          <div className="ccSetFonts">
            {FONTS.map((f) => (
              <button
                key={f.id}
                className={"ccSetFont" + (font === f.id ? " ccSetOn" : "")}
                style={{ fontFamily: f.css }}
                onClick={() => { setFont(f.id); blip(760); }}
              >
                {f.name}
              </button>
            ))}
          </div>
          <label className="ccCutRow ccSetCursor">
            <input
              type="checkbox"
              checked={pixCursor}
              onChange={(e) => { setPixCursor(e.target.checked); blip(720); }}
            />
            <span>픽셀 커서 쓰기</span>
          </label>
          {scene && me.role === "host" && (
            <button
              className="ccSetFont ccSetSkinBtn"
              onClick={() => { setBgmOpen(true); setSetOpen(false); blip(760); }}
            >
              🎵 이 방 BGM 설정
            </button>
          )}
          <button
            className="ccSetFont ccSetSkinBtn"
            onClick={() => { setSheet("skins"); setSetOpen(false); loadSkins(); blip(760); }}
          >
            🎨 캐릭터 이미지 {me.role === "host" ? "관리" : "보기"}
          </button>
          <button
            className="ccSetFont ccSetWipe"
            onClick={() => {
              if (wipeAsk) {
                ["ccSave", "ccQuests", "ccBonus", "ccLook", "ccOwned", "ccWelcome"].forEach((k) => {
                  try {
                    localStorage.removeItem(k);
                  } catch {
                    /* 무시 */
                  }
                });
                window.location.reload();
                return;
              }
              setWipeAsk(true);
              blip(520);
              setTimeout(() => setWipeAsk(false), 4000);
            }}
          >
            {wipeAsk ? "정말 지울까요? (한 번 더)" : "이 브라우저 기록 지우기"}
          </button>
          <p className="ccSetNote">
            별·꾸민 모습·투두는 이 브라우저에만 저장돼요. 서버로는 안 갑니다.
          </p>
        </div>
      )}

      <div className={"ccQuest" + (guideOpen ? "" : " ccQuestMin")}>
        <span className="ccQuestPin ccQuestPinA" />
        <span className="ccQuestPin ccQuestPinB" />
        <span className="ccQuestPin ccQuestPinC" />
        <span className="ccQuestPin ccQuestPinD" />
        <button
          className="ccQuestHead"
          onClick={() => {
            const next = !guideOpen;
            setGuideOpen(next);
            blip(next ? 760 : 520);
            try {
              localStorage.setItem("ccGuide", next ? "on" : "off");
            } catch {
              /* 무시 */
            }
          }}
        >
          <Pix map={DECO.star.map} palette={DECO.star.palette} scale={2} cacheKey="star" className="ccQuestStar" />
          <span className="ccQuestTitle">처음 오셨나요?</span>
          <span className="ccQuestNum">{questDone}/{QUESTS.length}</span>
          <span className="ccQuestArrow">{guideOpen ? "▾" : "▸"}</span>
        </button>
        {guideOpen && (
          <>
            <div className="ccQuestBar">
              {QUESTS.map((q, i) => (
                <span key={q.id} className={"ccQuestCell" + (i < questDone ? " ccQuestCellOn" : "")} />
              ))}
            </div>
            <ul className="ccQuestList">
              {QUESTS.map((q) => {
                const ok = quests.includes(q.id);
                const now = !ok && nextQuest?.id === q.id;
                return (
                  <li
                    key={q.id}
                    className={
                      "ccQ" +
                      (ok ? " ccQOk" : "") +
                      (now ? " ccQNow" : "") +
                      (justDone === q.id ? " ccQFlash" : "")
                    }
                  >
                    <span className="ccQBox">{ok ? "✔" : ""}</span>
                    <span className="ccQBody">
                      <b>{q.icon} {q.name}</b>
                      {now && <em>{q.desc}</em>}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="ccQuestFoot">
              {nextQuest
                ? questDone > 0 && bonus > 0
                  ? `새로 생긴 것까지 다 깨면 별 ${CLEAR_BONUS}개를 또 드려요.`
                  : `위에서부터 하나씩 해보세요. 다 깨면 별 ${CLEAR_BONUS}개!`
                : "다 해보셨어요! 이제 마음대로 놀아도 됩니다 🎉"}
            </p>
            {questDone > 0 && (
              <button className="ccQuestReset" onClick={resetQuests}>
                처음부터 다시
              </button>
            )}
          </>
        )}
      </div>

      <button
        className="ccFbBtn"
        title="피드백 보내기 (익명)"
        onClick={() => { setSheet("feedback"); blip(760); }}
      >
        <span className="ccFbIcon">📮</span>
        <span className="ccFbWord">피드백</span>
      </button>
      </div>

      {/* 모바일 조작 — 왼쪽 조이스틱, 오른쪽 액션 */}
      <div className="ccTouch">
        <Stick onMove={(v) => { stick.current = v; }} />
        <div className="ccActs">
          <button
            className="ccAct ccActMain"
            onPointerDown={() => {
              if (sheet) { setSheet(null); return; }
              if (sceneRef.current) { activateZone(zoneRef.current || "exit"); return; }
              if (nearRef.current) openBuilding(nearRef.current);
            }}
          >
            {sheet
              ? "닫기"
              : scene
                ? zoneId === "chair"
                  ? sit == null ? "앉기" : "일어나기"
                  : zoneId === "exit" || !zoneId
                    ? "나가기"
                    : "열기"
                : "들어가기"}
          </button>
          {me.role !== "solo" && (
            <button className="ccAct" onPointerDown={() => chatBox.current?.focus()}>
              💬
            </button>
          )}
        </div>
      </div>

      {/* 세로로 들고 있으면 가로 안내 */}
      <div className="ccRotate">
        <div className="ccRotateIcon">📱</div>
        <div className="ccRotateText">가로로 돌려주세요</div>
      </div>


      {bgmOpen && me.role === "host" && (
        <div className="ccModalWrap" onClick={() => setBgmOpen(false)}>
          <BgmSheet
            roomName={ROOMS[scene]?.name || "방"}
            current={scene ? roomBgmMap[scene] || null : null}
            onSelect={(next) => {
              if (!scene) return;
              setRoomBgmMap((m) => ({ ...m, [scene]: next }));
              setBgmOpen(false);
              blip(next ? 820 : 520);
            }}
            onClose={() => setBgmOpen(false)}
          />
        </div>
      )}

      {sheet && (
        <div className="ccModalWrap" onClick={() => setSheet(null)}>
          {sheet === "lp" && (
            <MusicSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              playingId={track?.id}
              onPlay={(items, index, name) => {
                setQueue(items);
                setQi(index || 0);
                setPlName(name || "");
                doQuest("music");
              }}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "quiz" && (
            <QuizSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              mode={teamPack ? "team" : quizMode}
              fixedPack={teamPack}
              onFinish={(sc) => {
                chanRef.current?.fx({ t: "score", id: deviceId(), name: me.name, ok: sc.ok, done: sc.done });
                doQuest("quiz");
              }}
              onClose={() => { setSheet(null); setTeamPack(null); }}
            />
          )}
          {sheet === "menu" && (
            <MenuSheet
              balance={balance}
              holding={holding}
              onBuy={buyMenu}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "dress" && (
            <DressSheet
              look={look}
              owned={owned}
              balance={balance}
              skins={skins}
              onApply={(next, cost, key) => { applyLook(next, cost, key); doQuest("dress"); }}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "wish" && (
            <WishSheet
              box={WISH_BOX}
              round={roundNo}
              name={me.name}
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              off={!hasServer || me.role === "solo"}
              onSent={() => doQuest("wish")}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "idea" && (
            <WishSheet
              box={IDEA_BOX}
              round={roundNo}
              name={me.name}
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              off={!hasServer || me.role === "solo"}
              onSent={() => doQuest("idea")}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "feedback" && (
            <FeedbackSheet
              round={roundNo}
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              off={!hasServer || me.role === "solo"}
              onSent={() => doQuest("feedback")}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "arcade" && (
            <ArcadeSheet
              me={me}
              off={!hasServer || me.role === "solo"}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "songs" && (
            <SongbookSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              off={!hasServer || me.role === "solo"}
              playingId={track?.id}
              onPlay={(items, index, name) => {
                const selected = items?.[index || 0];
                setQueue(items || []);
                setQi(index || 0);
                setPlName(name || "");
                const url = selected?.url || selected?.path || "";
                const id = youtubeId(url);
                if (id) {
                  const data = { title: selected?.title || "노래방", url, by: me.name };
                  setKaraoke(data);
                  chanRef.current?.fx({ t: "karaoke", ...data });
                  setSheet(null);
                }
              }}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "showtime" && (
            <MovieSheet
              me={me}
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              off={!hasServer || me.role === "solo"}
              now={movie}
              onPlay={() => { loadMovie(); chanRef.current?.fx({ t: "movie" }); }}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "skins" && (
            <SkinSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              skins={skins}
              onChanged={loadSkins}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "fortune" && (
            <FortuneSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              onDraw={() => doQuest("fortune")}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "gacha" && (
            <GachaSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              onDraw={() => doQuest("gacha")}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "lobby" && (
            <TeamLobby
              me={{ id: deviceId(), name: me.name }}
              games={games}
              myGid={myGid}
              packs={packs}
              results={results}
              onCreate={createGame}
              onJoin={joinGame}
              onLeave={leaveGame}
              onStart={startGame}
              onClose={() => setSheet(null)}
            />
          )}
        </div>
      )}

      {sheet === "starview" && <StarViewSheet onClose={() => setSheet(null)} />}

      {welcome && (
        <div className="ccWelWrap" onClick={closeWelcome}>
          <div className="ccWelCard" onClick={(e) => e.stopPropagation()}>
            <span className="ccWelPin ccWelPinA" />
            <span className="ccWelPin ccWelPinB" />
            <span className="ccWelPin ccWelPinC" />
            <span className="ccWelPin ccWelPinD" />
            <div className="ccWelChars">
              {CHARACTERS.slice(1, 5).map((c) => (
                <Pix key={c.id} map={c.map} palette={c.palette} scale={3} cacheKey={"w-" + c.id} className="ccWelChar" />
              ))}
            </div>
            <div className="ccWelTag">BETA</div>
            <h2 className="ccWelTitle">베타테스트에<br />오신 걸 환영합니다</h2>
            <p className="ccWelText">
              오른쪽 <b className="ccWelHi">투두리스트</b>를 따라<br />게임을 즐겨보세요!
            </p>
            <p className="ccWelBonus">다 깨면 별 <b>{CLEAR_BONUS}</b>개 드려요 ⭐</p>
            <button className="ccBtn ccWelBtn" onClick={closeWelcome}>놀러 가기</button>
          </div>
        </div>
      )}

      {/* 재생바 — 방을 옮겨도 계속 나옵니다 */}
      {track && (
        <div className="ccPlayBar">
          <span className="ccPlayDisc">◉</span>
          <span className="ccPlayTitle">
            {track.title}
            {queue.length > 1 && (
              <span className="ccPlayOf"> {qi + 1}/{queue.length}{plName ? ` · ${plName}` : ""}</span>
            )}
          </span>
          <button
            className="ccPlayBtn"
            title="재생 / 일시정지"
            onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play(); else a.pause(); }}
          >
            ⏯
          </button>
          <button
            className="ccPlayBtn"
            title="다음 곡"
            onClick={() => setQi((v) => (queue.length ? (v + 1) % queue.length : 0))}
          >
            ⏭
          </button>
          <button className="ccPlayBtn" title="음소거" onClick={() => setMuted((v) => !v)}>
            {muted || vol === 0 ? "🔇" : vol < 0.4 ? "🔈" : "🔊"}
          </button>
          <input
            className="ccVol"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : vol}
            onChange={(e) => { setMuted(false); setVol(Number(e.target.value)); }}
          />
          <button className="ccPlayBtn" title="끄기" onClick={() => { setQueue([]); setQi(0); }}>✕</button>
        </div>
      )}
      {track && (
        <audio
          ref={audio}
          src={track.url}
          autoPlay
          onEnded={() => {
            if (qi + 1 < queue.length) setQi(qi + 1);
            else if (queue.length > 1) setQi(0);      /* 목록이 여러 곡이면 처음부터 다시 */
            else audio.current?.play();               /* 한 곡이면 반복 */
          }}
          onError={() => setToast("곡을 재생하지 못했어요")}
        />
      )}
      <audio ref={bgmAudio} loop preload="auto" />

      {/* 모바일 조작 — 왼쪽 조이스틱, 오른쪽 액션 */}
      <div className="ccTouch">
        <Stick onMove={(v) => { stick.current = v; }} />
        <div className="ccActs">
          <button
            className="ccAct ccActMain"
            onPointerDown={() => {
              if (sheet) { setSheet(null); return; }
              if (sceneRef.current) { activateZone(zoneRef.current || "exit"); return; }
              if (nearRef.current) openBuilding(nearRef.current);
            }}
          >
            {sheet
              ? "닫기"
              : scene
                ? zoneId === "chair"
                  ? sit == null ? "앉기" : "일어나기"
                  : zoneId === "exit" || !zoneId
                    ? "나가기"
                    : "열기"
                : "들어가기"}
          </button>
          {me.role !== "solo" && (
            <button className="ccAct" onPointerDown={() => chatBox.current?.focus()}>
              💬
            </button>
          )}
        </div>
      </div>

      {/* 세로로 들고 있으면 가로 안내 */}
      <div className="ccRotate">
        <div className="ccRotateIcon">📱</div>
        <div className="ccRotateText">가로로 돌려주세요</div>
      </div>



    </div>
  );
}

/* ============================ 스타일 ============================ */

const CUR = cursorUrls();

const CSS = `
*{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{font-family:var(--ccFont,"DungGeunMo","Galmuri11","Pretendard","Malgun Gothic",system-ui,sans-serif);
  -webkit-font-smoothing:none;letter-spacing:.02em}
/* 픽셀 글꼴이 아니면 계단현상을 끕니다 */
body.ccSmoothFont{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;letter-spacing:0}

/* 🖱 픽셀 커서 */
body.ccPixCursor{cursor:url(${CUR.arrow}) 0 0,auto}
body.ccPixCursor button,
body.ccPixCursor label,
body.ccPixCursor a,
body.ccPixCursor .ccBuilding,
body.ccPixCursor .ccFeed,
body.ccPixCursor input[type="range"],
body.ccPixCursor input[type="checkbox"],
body.ccPixCursor input[type="file"]{cursor:url(${CUR.star}) 13 8,pointer}
body.ccPixCursor input:not([type="range"]):not([type="checkbox"]):not([type="file"]),
body.ccPixCursor textarea{cursor:text}
body.ccPixCursor button:disabled{cursor:url(${CUR.arrow}) 0 0,not-allowed}
.ccSetCursor{border-top:3px solid #efe7f2;margin-top:8px;padding-top:9px}
.ccRoot{position:fixed;inset:0;overflow:hidden;user-select:none;touch-action:none;color:${C.ink}}
.ccPix{display:block;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none}

.ccSky{position:absolute;inset:0;background:linear-gradient(180deg,${C.sky1} 0%,${C.sky2} 60%,${C.sky3} 100%)}
.ccClouds{position:absolute;inset:0;pointer-events:none;transform-origin:0 0}
.ccCloud{position:absolute;animation:ccFloat 8s steps(4,end) infinite}
@keyframes ccFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}

.ccWorld{position:absolute;left:0;top:0;will-change:transform;transform-origin:0 0}
.ccGround{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.ccSlab{position:absolute;image-rendering:pixelated}

.ccBWrap{position:absolute;inset:0;pointer-events:none}
.ccBuilding{position:absolute;pointer-events:auto;cursor:pointer}
.ccBuilding .ccPix{transition:transform .1s steps(2,end)}
.ccBuilding .ccNear{transform:translateY(-6px)}
.ccSign{margin-top:4px;text-align:center;white-space:nowrap;font-size:12px;font-weight:700;
  background:#fff;border:3px solid ${C.line};padding:3px 8px;display:inline-block;
  position:relative;left:50%;transform:translateX(-50%);box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccPrompt{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);white-space:nowrap;margin-bottom:6px;
  background:#fff;border:3px solid ${C.line};padding:4px 9px;font-size:12px;font-weight:700;
  box-shadow:3px 3px 0 rgba(91,74,99,.25);animation:ccBlink 1s steps(2,end) infinite}
@keyframes ccBlink{0%,60%{opacity:1}61%,100%{opacity:.45}}

.ccAvatar{position:absolute;transform:translate(-50%,-100%);pointer-events:none}
.ccAvatar .ccPix{margin:0 auto}
.ccFlip{transform:scaleX(-1)}
.ccWalk{animation:ccWalk .3s steps(2,end) infinite}
@keyframes ccWalk{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.ccWalk.ccFlip{animation:ccWalkF .3s steps(2,end) infinite}
@keyframes ccWalkF{0%,100%{transform:scaleX(-1) translateY(0)}50%{transform:scaleX(-1) translateY(-4px)}}
.ccTag{white-space:nowrap;text-align:center;font-size:11px;font-weight:800;margin-bottom:2px;color:${C.ink};
  text-shadow:-2px 0 #fff,2px 0 #fff,0 -2px #fff,0 2px #fff,-2px -2px #fff,2px -2px #fff,-2px 2px #fff,2px 2px #fff}
.ccTagMe{color:#c05a86}
.ccBubble{position:relative;max-width:170px;margin:0 auto 14px;white-space:pre-wrap;word-break:break-all;
  text-align:center;font-size:12px;font-weight:700;line-height:1.4;background:#fff;border:3px solid ${C.line};
  padding:9px 15px;border-radius:999px;box-shadow:3px 3px 0 rgba(91,74,99,.2);animation:ccPop .12s steps(2,end)}
/* 캐릭터를 가리키는 뾰족한 꼬리 — 진한 삼각형 위에 흰 삼각형을 덮어 테두리를 만듭니다 */
.ccBubble:after{content:"";position:absolute;left:50%;top:100%;margin-left:-8px;z-index:0;
  width:0;height:0;border-style:solid;border-width:17px 8px 0 8px;
  border-color:${C.line} transparent transparent transparent}
.ccBubble:before{content:"";position:absolute;left:50%;top:calc(100% - 3px);margin-left:-5px;z-index:1;
  width:0;height:0;border-style:solid;border-width:14px 5px 0 5px;
  border-color:#fff transparent transparent transparent}
@keyframes ccPop{from{transform:translateY(6px)}to{transform:translateY(0)}}

.ccChatBar{position:absolute;left:16px;bottom:calc(16px + var(--kb, 0px));display:flex;gap:6px;
  width:min(380px,52vw);z-index:19}
.ccChatInput{flex:1;border:3px solid ${C.line};background:rgba(255,255,255,.95);padding:9px 11px;
  font-size:13px;font-weight:700;color:${C.ink};font-family:inherit;outline:none;
  box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccChatInput:focus{background:#fffbe8}
.ccChatBtn{border:3px solid ${C.line};background:#ffd45e;color:${C.ink};font-weight:700;font-size:12px;
  padding:9px 12px;cursor:pointer;font-family:inherit;box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccChatBtn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(91,74,99,.25)}

/* 곡선 미끄럼틀 */
.ccSlide{position:absolute;left:0;top:0;pointer-events:none}
.ccSliding .ccPix{animation:ccSlideWob .16s steps(2,end) infinite}
@keyframes ccSlideWob{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-5px) rotate(6deg)}}

.ccTree{position:absolute;animation:ccSway 3s steps(3,end) infinite}
@keyframes ccSway{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
.ccTramp{animation:ccTrampB 1.1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
/* 미러볼 */
.ccBeam{animation:ccBeamT 6s linear infinite;transform-box:fill-box;transform-origin:0 0}
@keyframes ccBeamT{0%{opacity:.06}50%{opacity:.2}100%{opacity:.06}}
.ccBallShine{animation:ccBallS 2.2s ease-in-out infinite}
@keyframes ccBallS{0%,100%{opacity:.85}50%{opacity:.35}}
/* 방방 위에서 저절로 통통 */
.ccBouncing .ccPix,.ccBouncing .ccSkinPic{animation:ccBoing .52s ease-in-out infinite}
@keyframes ccBoing{0%,100%{transform:translateY(0) scaleY(1)}20%{transform:translateY(-4px) scaleY(.9)}55%{transform:translateY(-34px) scaleY(1.06)}}
/* 천문대에서 눕기 */
.ccLying .ccPix,.ccLying .ccSkinPic{transform:rotate(-84deg) translateY(6px)}
.ccLying .ccTag{opacity:.7}
@keyframes ccTrampB{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.86)}}
.ccRoomStar{transform-origin:50% 100%}
.ccStar{position:absolute;z-index:5;animation:ccStarF 1.6s steps(3,end) infinite}
@keyframes ccStarF{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

/* 공통 패널 — 픽셀 테두리 */
.ccPanel{background:#fff;border:4px solid ${C.line};box-shadow:6px 6px 0 rgba(91,74,99,.3)}
.ccChip{background:#fff;border:3px solid ${C.line};padding:6px 11px;font-weight:700;font-size:12px;
  box-shadow:3px 3px 0 rgba(91,74,99,.25);color:${C.ink};font-family:inherit}
.ccHud{position:absolute;left:14px;top:14px;display:flex;gap:8px;flex-wrap:wrap;max-width:52vw}
.ccStarChip{display:flex;align-items:center;gap:6px;padding:4px 11px}
.ccChipStar{flex:none}
.ccStarNum{font-size:15px;font-weight:900;line-height:1}
.ccStarSub{font-size:10.5px;font-weight:700;color:${C.inkSoft}}
.ccOffline{background:#ffe2e2;color:#b8474b;animation:ccBlink 1.2s steps(2,end) infinite}
.ccStarPop{animation:ccStarPop .42s steps(3,end)}

/* 🕹️ 미니게임 */
.ccArcade{width:min(400px,94vw);padding:18px}
.ccArcTabs{display:flex;gap:6px;margin-bottom:12px}
.ccArcTab{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;border:3px solid ${C.line};
  background:#fff;color:${C.ink};font-family:inherit;font-size:11px;font-weight:800;padding:8px 2px;cursor:pointer;
  box-shadow:2px 2px 0 rgba(91,74,99,.18)}
.ccArcTab:active{transform:translate(2px,2px);box-shadow:none}
.ccArcOn{background:#ffe9a8;box-shadow:inset 0 0 0 3px #ffd45e,2px 2px 0 rgba(91,74,99,.18)}
.ccArcIcon{font-size:22px;line-height:1}
.ccGame{display:flex;flex-direction:column;gap:10px;align-items:stretch}
.ccGameAsk{margin:0;font-size:12.5px;font-weight:800;line-height:1.6;color:${C.ink}}
.ccGameBig{width:100%;padding:15px;font-size:15px;background:#ffd45e;color:${C.ink}}
.ccGameHold{background:#ff8fb6;color:#fff}
.ccGameOut{margin:0;font-size:12px;font-weight:800;color:#c05a86;min-height:17px}
.ccGameRow{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:${C.inkSoft}}
.ccGameRow b{color:${C.ink};font-size:14px;margin-left:4px}
.ccHit{color:#c05a86 !important}
.ccGauge{position:relative;height:26px;border:4px solid ${C.line};background:#efe7f2;overflow:hidden}
.ccGauge i{display:block;height:100%;transition:width .06s linear}
.ccGaugeNum{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:900;color:${C.ink}}
.ccTypeWord{border:4px solid ${C.line};background:#fff6dc;padding:14px;font-size:22px;font-weight:900;
  letter-spacing:.04em;color:${C.ink}}
.ccTypeIn{width:100%;padding:11px;font-size:15px;text-align:center}
.ccSpeedPad{border:4px solid ${C.line};background:#efe7f2;color:${C.ink};font-family:inherit;
  font-size:17px;font-weight:900;height:150px;cursor:pointer;width:100%}
.ccSpeedwait{background:#ffd9ea}
.ccSpeedgo{background:#8fe3c9}
.ccSpeedearly{background:#ffd7d7;color:#b8474b}
.ccSpeeddone{background:#ffe9a8}

/* 🏆 랭킹 */
.ccRankBar{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.ccRankMine{flex:1;font-size:11.5px;font-weight:700;color:${C.inkSoft};text-align:left}
.ccRankBtn{flex:none;background:#ffe9a8;font-weight:800}
.ccRank{display:flex;flex-direction:column;gap:8px}
.ccRankHead{font-size:12px;font-weight:800;color:${C.inkSoft}}
.ccRankList{display:flex;flex-direction:column;gap:4px;max-height:46vh;overflow:auto}
.ccRankRow{display:flex;align-items:center;gap:9px;border:3px solid ${C.line};background:#fff;
  padding:8px 10px;font-size:12.5px;font-weight:700}
.ccRankTop{background:#fff6dc}
.ccRankNo{flex:none;width:26px;text-align:center;font-weight:900;color:${C.inkSoft}}
.ccRankName{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccRankScore{flex:none;font-weight:900;color:#c05a86}

/* 🔭 별 보기 */
.ccStarView{position:absolute;inset:0;z-index:45;background:#0b1024;cursor:pointer;overflow:hidden}
.ccStarSky{position:absolute;inset:0}
.ccStarDot{position:absolute;background:#fff;border-radius:50%;animation:ccTw 3s ease-in-out infinite}
@keyframes ccTw{0%,100%{opacity:.25}50%{opacity:1}}
.ccShoot{position:absolute;left:-10%;top:18%;width:120px;height:3px;background:linear-gradient(90deg,transparent,#fff);
  animation:ccShoot 7s linear infinite}
@keyframes ccShoot{0%{transform:translate(0,0) rotate(18deg);opacity:0}6%{opacity:1}18%{transform:translate(1200px,320px) rotate(18deg);opacity:0}100%{opacity:0}}
.ccStarWord{position:absolute;left:0;right:0;bottom:12%;text-align:center;color:#dfe6ff;
  font-size:15px;font-weight:800;line-height:2}
.ccStarWord b{color:#ffd45e;font-size:13px}

/* 🎬 스크린 위 영상 */
.ccScreenWrap{position:absolute;left:168px;top:38px;width:664px;height:228px;pointer-events:auto;
  background:#000;overflow:hidden}
.ccScreenVid{width:100%;height:100%;object-fit:contain;display:block;background:#000}
.ccScreenBar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;
  padding:6px 9px;background:rgba(14,12,24,.72)}
.ccScreenTitle{flex:1;font-size:13px;font-weight:800;color:#ffe9a8;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ccScreenSnd{flex:none;border:3px solid #ffd45e;background:#2f2b45;color:#ffd45e;font-family:inherit;
  font-size:11px;font-weight:800;padding:4px 8px;cursor:pointer}
.ccNowPlay{display:flex;flex-direction:column;gap:3px;align-items:center;border:3px solid ${C.line};
  background:#fff6dc;padding:10px;margin-bottom:10px;font-size:12px;font-weight:700}
.ccNowPlay b{color:#c05a86;font-size:11px}
.ccNowTitle{font-size:14px;font-weight:900;color:${C.ink}}
.ccNowBy{font-size:10.5px;color:${C.inkSoft}}
.ccNowStop{margin-top:5px}
.ccMoviePlay{flex:none;background:#ffd45e;font-weight:800}
.ccVidAdd{display:flex;flex-direction:column;gap:6px;border-top:3px solid #efe7f2;margin-top:10px;padding-top:10px}
.ccVidPick{width:100%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccVidName{width:100%;padding:9px 10px;font-size:12.5px;text-align:left}
.ccVidUp{width:100%;font-size:12.5px;padding:10px;background:#ffd45e;color:${C.ink}}
.ccVidTabs{display:flex;gap:6px}
.ccVidTabs .ccMini{flex:1}
.ccVidTip{margin:2px 0 0;line-height:1.6}
.ccVidTip b{color:${C.ink}}

/* 🎤 선곡표 */
.ccBook{width:min(380px,94vw);padding:18px}
.ccBookNum{display:flex;gap:6px;margin-bottom:10px}
.ccBookIn{flex:1;padding:11px;font-size:17px;text-align:center;font-weight:900;letter-spacing:.1em}
.ccBookGo{flex:none;font-size:13px;padding:11px 20px;background:#ff8fb6;color:#fff}
.ccBookList{display:flex;flex-direction:column;gap:4px;max-height:44vh;overflow:auto;margin-bottom:4px}
.ccBookRow{display:flex;align-items:center;gap:8px;border:3px solid ${C.line};background:#fff;padding:2px 8px}
.ccBookOn{background:#fff6dc;box-shadow:inset 0 0 0 3px #ffd45e}
.ccBookNo{flex:none;font-size:12px;font-weight:900;color:#c05a86;letter-spacing:.04em}
.ccBookName{flex:1;border:none;background:none;font-family:inherit;font-size:12.5px;font-weight:700;
  color:${C.ink};text-align:left;padding:9px 2px;cursor:pointer;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ccBookName:hover{color:#c05a86}

/* 🎬 상영표 */
.ccMovie{width:min(380px,94vw);padding:18px}
.ccMovieList{display:flex;flex-direction:column;gap:6px;margin:6px 0 4px}
.ccMovieRow{display:flex;align-items:center;gap:9px;border:3px solid ${C.line};background:#fff;
  padding:9px 11px;font-size:12.5px;font-weight:700;text-align:left}
.ccMovieWhen{flex:none;font-weight:900;color:#c05a86}
.ccMovieName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccMovieTag{flex:none;font-size:10px;background:#ffe9a8;border:2px solid ${C.line};padding:1px 5px}
@keyframes ccStarPop{0%{transform:scale(1)}40%{transform:scale(1.16)}100%{transform:scale(1)}}

.ccRound{position:absolute;right:14px;top:14px;background:#ffe9a8;border:4px solid ${C.line};
  padding:8px 14px;font-weight:700;font-size:14px;box-shadow:4px 4px 0 rgba(91,74,99,.3);
  display:flex;align-items:baseline;gap:6px}
.ccRoundNum{font-size:22px;font-weight:900}
.ccRoundSub{font-size:11px;color:${C.inkSoft};margin-left:4px}

.ccHelp{position:absolute;left:16px;bottom:16px;font-size:11px;font-weight:700;
  color:${C.ink};background:rgba(255,255,255,.9);border:2px solid ${C.line};padding:5px 10px;white-space:nowrap}
.ccToast{position:absolute;left:50%;top:74px;transform:translateX(-50%);background:#fff;border:4px solid ${C.line};
  padding:9px 16px;font-weight:700;font-size:13px;box-shadow:4px 4px 0 rgba(91,74,99,.3);white-space:nowrap}

.ccHostBtn{cursor:pointer;align-self:flex-end}
.ccHostPanel{width:100%;padding:14px}
.ccHostToggle{width:100%;display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:9px 10px;border:0;border-radius:9px;background:rgba(0,0,0,.08);color:inherit;font:inherit;font-weight:800;cursor:pointer;text-align:left}
.ccHostToggleBody{padding:4px 2px}
.ccHostLocationRow{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;font-size:12px;font-weight:700}
.ccHostLocationRow b{font-weight:900}
.ccKaraokeRoomScreen{position:absolute;left:100px;top:18px;width:800px;height:360px;z-index:30;pointer-events:auto}
.ccKaraokeRoomFrame{width:100%;height:100%;box-sizing:border-box;background:#171327;border:8px solid #ff9fc9;border-radius:14px;box-shadow:0 8px 0 #5b4a63,0 12px 22px rgba(0,0,0,.28);overflow:hidden}
.ccKaraokeRoomTop{height:38px;box-sizing:border-box;padding:5px 10px;display:flex;align-items:center;gap:12px;background:#302454;color:#ffe8a9;font-size:12px;font-weight:900;border-bottom:3px solid #5b4a63}
.ccKaraokeRoomTop span{font-size:14px;white-space:nowrap}
.ccKaraokeRoomTop b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff}
.ccKaraokeRoomVideo{width:100%;height:calc(100% - 66px);background:#000}
.ccKaraokeRoomVideo iframe{display:block;width:100%;height:100%;border:0}
.ccKaraokeRoomWho{height:28px;box-sizing:border-box;padding:4px 8px;text-align:center;background:#201a35;color:#ffe9a8;font-size:11px;font-weight:800}
.ccKaraokeCushions{position:absolute;left:80px;right:80px;bottom:78px;height:110px;z-index:18;pointer-events:none}
.ccKaraokeCushion{position:absolute;width:105px;height:42px;border-radius:22px 22px 16px 16px;background:#ffb5d4;border:4px solid #5b4a63;box-shadow:inset 0 -8px 0 rgba(91,74,99,.22),0 5px 0 rgba(0,0,0,.16)}
.ccKaraokeCushion::after{content:"";position:absolute;left:14px;right:14px;top:8px;height:5px;border-radius:8px;background:rgba(255,255,255,.35)}
.ccKaraokeCushion.c1{left:0;top:42px;transform:rotate(-3deg)}
.ccKaraokeCushion.c2{left:175px;top:50px;background:#b9a9f2;transform:rotate(2deg)}
.ccKaraokeCushion.c3{right:175px;top:50px;background:#a9e6d2;transform:rotate(-2deg)}
.ccKaraokeCushion.c4{right:0;top:42px;background:#ffd77d;transform:rotate(3deg)}

/* 🎛️ 노래방 선곡 리모컨 — 기존 선곡표 아이콘을 실제 리모컨처럼 보이게 */
.ccKaraokeRemote{
  position:absolute;left:50%;top:66%;transform:translate(-50%,-50%);
  width:128px;height:194px;z-index:24;pointer-events:auto;cursor:pointer;
  border:4px solid #342b43;border-radius:12px 12px 16px 16px;
  background:linear-gradient(135deg,#ffffff 0%,#f5f4f8 58%,#dedde5 100%);
  box-shadow:5px 6px 0 rgba(35,27,48,.45),inset -5px -7px 0 rgba(91,74,99,.12),inset 3px 3px 0 rgba(255,255,255,.95);
  padding:10px 8px 8px;box-sizing:border-box;
  image-rendering:auto;
}
.ccKaraokeRemote:active{transform:translate(calc(-50% + 3px),calc(-50% + 3px));box-shadow:2px 3px 0 rgba(35,27,48,.4),inset -4px -5px 0 rgba(91,74,99,.12)}
.ccKaraokeRemoteHead{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}
.ccKaraokeRemoteLogo{font-size:7px;font-weight:900;color:#6b6470;letter-spacing:-.04em}
.ccKaraokeRemoteLed{width:8px;height:5px;border-radius:3px;background:#ffdb57;border:2px solid #554c5d;box-sizing:border-box}
.ccKaraokeRemoteMiniRow{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px}
.ccKaraokeRemoteMini{height:13px;border:2px solid #6b6470;border-radius:4px;background:#fff;font-size:6px;font-weight:900;color:#5b4a63;display:flex;align-items:center;justify-content:center;line-height:1}
.ccKaraokeRemoteYellow{background:#ffe76f;border-color:#675c3d}
.ccKaraokeRemoteMain{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px}
.ccKaraokeRemoteNum{height:20px;border:2px solid #5d5862;border-radius:5px;background:#f8f8fb;box-shadow:inset 0 -2px 0 #d8d6df;font-size:10px;font-weight:900;color:#3e3945;display:flex;align-items:center;justify-content:center}
.ccKaraokeRemoteBlue{background:#a9dcff;color:#3b5970}
.ccKaraokeRemoteNav{position:absolute;left:10px;bottom:35px;width:43px;height:43px;border:3px solid #5b5562;border-radius:50%;background:#55505c;box-shadow:inset 0 0 0 4px #dddde4}
.ccKaraokeRemoteNav::before{content:'▲';position:absolute;left:50%;top:2px;transform:translateX(-50%);font-size:8px;color:#fff}
.ccKaraokeRemoteNav::after{display:none}
.ccKaraokeRemoteNav i{position:absolute;font-style:normal;font-size:8px;color:#fff}
.ccKaraokeRemoteNav .l{left:4px;top:16px}.ccKaraokeRemoteNav .r{right:4px;top:16px}.ccKaraokeRemoteNav .d{left:17px;bottom:2px}
.ccKaraokeRemoteAction{position:absolute;right:9px;bottom:38px;display:grid;grid-template-columns:1fr 1fr;gap:4px;width:52px}
.ccKaraokeRemoteAction span{height:20px;border:2px solid #6b6470;border-radius:5px;background:#fff;font-size:7px;font-weight:900;display:flex;align-items:center;justify-content:center;color:#4b4650}
.ccKaraokeRemoteAction .start{background:#8ed9f5}.ccKaraokeRemoteAction .cancel{background:#9bd9f4}
.ccKaraokeRemoteHint{position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:900;color:#fff6dc;text-shadow:2px 2px 0 #5b4a63;opacity:.9}
.ccYoutubeAdd{display:grid;grid-template-columns:1fr 1fr auto;gap:7px;align-items:center;margin:8px 0}
@media (max-width:700px){.ccYoutubeAdd{grid-template-columns:1fr}.ccYoutubeAdd .ccBtn{width:100%}}

/* 우측 세로 스택 — 회차 배지 아래로 호스트 도구와 가이드가 쌓입니다 */
.ccSide{position:absolute;right:30px;top:98px;width:238px;display:flex;flex-direction:column;
  align-items:stretch;gap:8px;z-index:17}

/* 뉴비 가이드 — 하나씩 해보는 투두 */
.ccQuest{position:relative;background:#fff;border:4px solid ${C.line};box-shadow:5px 5px 0 rgba(91,74,99,.3)}
/* 네 모서리 색깔 징 */
.ccQuestPin{position:absolute;width:9px;height:9px;background:#ff8fb6;border:3px solid ${C.line};z-index:2}
.ccQuestPinA{left:-9px;top:-9px}
.ccQuestPinB{right:-9px;top:-9px;background:#ffd45e}
.ccQuestPinC{left:-9px;bottom:-9px;background:#8fe3c9}
.ccQuestPinD{right:-9px;bottom:-9px;background:#b6a6f0}
/* 사탕 줄무늬 머리띠 */
.ccQuestHead{width:100%;display:flex;align-items:center;gap:7px;border:none;
  background:repeating-linear-gradient(135deg,#ffe6a0 0 7px,#ffd97a 7px 14px);
  border-bottom:4px solid ${C.line};font-family:inherit;font-weight:800;font-size:12.5px;color:${C.ink};
  padding:8px 9px;cursor:pointer;text-align:left}
.ccQuestMin .ccQuestHead{border-bottom:none}
.ccQuestStar{flex:none;animation:ccStarF 1.6s steps(3,end) infinite}
.ccQuestTitle{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ccQuestNum{font-size:10.5px;font-weight:900;color:#c05a86;white-space:nowrap;background:#fff;
  border:3px solid ${C.line};padding:2px 6px;line-height:1.2}
.ccQuestArrow{font-size:10px;color:${C.ink};animation:ccQArrow 1.2s steps(2,end) infinite}
@keyframes ccQArrow{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
/* 진행바 — 칸을 하나씩 채웁니다 */
.ccQuestBar{display:flex;gap:2px;padding:5px 6px;background:#fff6dc;border-bottom:3px solid ${C.line}}
.ccQuestCell{flex:1;height:9px;background:#efe7f2;box-shadow:inset 0 0 0 2px rgba(91,74,99,.22)}
.ccQuestCellOn{background:#8fe3c9;box-shadow:inset 0 0 0 2px ${C.line}}
.ccQuestList{list-style:none;margin:0;padding:7px;max-height:min(54vh,430px);overflow:auto;
  display:flex;flex-direction:column;gap:2px;text-align:left}
.ccQ{display:flex;gap:7px;align-items:flex-start;padding:5px;font-size:11.5px;font-weight:700;
  line-height:1.35;color:${C.inkSoft}}
.ccQBox{flex:none;width:16px;height:16px;border:3px solid ${C.line};background:#fff;margin-top:1px;
  font-size:10px;line-height:10px;text-align:center;color:${C.ink}}
.ccQBody{display:flex;flex-direction:column;gap:3px;min-width:0;word-break:keep-all}
.ccQBody b{font-weight:800}
.ccQBody em{font-style:normal;font-size:10.5px;font-weight:700;color:${C.inkSoft};line-height:1.5}
.ccQOk .ccQBox{background:#8fe3c9}
.ccQOk .ccQBody b{opacity:.5;text-decoration:line-through}
.ccQNow{color:${C.ink};background:#fff6dc;box-shadow:inset 0 0 0 3px #ffd45e}
.ccQFlash{animation:ccQFlash .32s steps(2,end) 4}
@keyframes ccQFlash{0%,100%{background:#fff}50%{background:#a9f0d2}}
.ccQuestFoot{margin:0;padding:0 10px 9px;font-size:10px;font-weight:700;line-height:1.55;
  color:${C.inkSoft};text-align:left}
.ccQuestReset{display:block;width:calc(100% - 20px);margin:0 10px 10px;border:3px solid ${C.line};
  background:#fff;font-family:inherit;font-size:10.5px;font-weight:700;color:${C.inkSoft};
  padding:6px;cursor:pointer}
.ccQuestReset:active{transform:translate(2px,2px)}

.ccBgmSheet{width:min(430px,94vw);padding:16px;max-height:82vh;overflow:auto}
.ccBgmList{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.ccBgmItem{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;border:3px solid ${C.line};background:#fff;color:${C.ink};padding:10px 12px;font-family:inherit;font-size:12px;font-weight:800;text-align:left;cursor:pointer;box-shadow:2px 2px 0 rgba(91,74,99,.18)}
.ccBgmItem:active{transform:translate(2px,2px);box-shadow:none}
.ccBgmItem.ccBgmOn{background:#fff6dc;box-shadow:inset 0 0 0 3px #ffd45e,2px 2px 0 rgba(91,74,99,.18)}
.ccBgmItem b{font-size:10px;background:#8fe3c9;border:2px solid ${C.line};padding:2px 5px;white-space:nowrap}

/* 설정 */
.ccSetBtn{cursor:pointer;align-self:flex-end;background:#fff}
.ccSetPanel{width:100%;padding:12px}
.ccSetTitle{font-size:12px;font-weight:900;margin-bottom:8px;text-align:left}
.ccSetFonts{display:flex;flex-direction:column;gap:5px}
.ccSetFont{border:3px solid ${C.line};background:#fff;color:${C.ink};font-size:13px;font-weight:700;
  padding:9px 10px;cursor:pointer;text-align:left;box-shadow:2px 2px 0 rgba(91,74,99,.18)}
.ccSetFont:active{transform:translate(2px,2px);box-shadow:none}
.ccSetOn{background:#ffe9a8;box-shadow:inset 0 0 0 3px #ffd45e,2px 2px 0 rgba(91,74,99,.18)}
.ccSetNote{margin:9px 0 0;font-size:10px;font-weight:700;color:${C.inkSoft};text-align:left;line-height:1.55}

/* 처음 온 사람 환영 팝업 — 픽셀 액자 */
.ccWelWrap{position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;
  padding:28px;background:rgba(91,74,99,.45);animation:ccWelIn .18s steps(2,end)}
@keyframes ccWelIn{from{opacity:0}to{opacity:1}}
.ccWelCard{position:relative;width:min(330px,88vw);padding:24px 22px 20px;text-align:center;
  background:#fff;color:${C.ink};border:5px solid ${C.line};
  box-shadow:0 0 0 5px #fff,0 0 0 10px ${C.line},10px 10px 0 rgba(91,74,99,.3);
  animation:ccWelPop .22s steps(3,end)}
@keyframes ccWelPop{from{transform:translateY(12px) scale(.94)}to{transform:none}}
.ccWelPin{position:absolute;width:16px;height:16px;background:#ff8fb6;border:4px solid ${C.line};z-index:1;
  animation:ccWelPin 1.4s steps(2,end) infinite}
.ccWelPinA{left:-21px;top:-21px}
.ccWelPinB{right:-21px;top:-21px;background:#ffd45e;animation-delay:.35s}
.ccWelPinC{left:-21px;bottom:-21px;background:#8fe3c9;animation-delay:.7s}
.ccWelPinD{right:-21px;bottom:-21px;background:#b6a6f0;animation-delay:1.05s}
@keyframes ccWelPin{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
.ccWelChars{display:flex;justify-content:center;gap:6px;margin-bottom:10px}
.ccWelChar{animation:ccWalk .5s steps(2,end) infinite}
.ccWelChar:nth-child(2){animation-delay:.12s}
.ccWelChar:nth-child(3){animation-delay:.24s}
.ccWelChar:nth-child(4){animation-delay:.36s}
.ccWelTag{display:inline-block;background:#ffd45e;border:3px solid ${C.line};padding:2px 11px;
  font-size:11px;font-weight:900;letter-spacing:.14em;box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccWelTitle{margin:11px 0 9px;font-size:19px;font-weight:900;line-height:1.55}
.ccWelText{margin:0;font-size:12.5px;font-weight:700;line-height:1.8;color:${C.inkSoft}}
.ccWelHi{color:#c05a86}
.ccWelBtn{width:100%;margin-top:17px}
.ccHostTitle{font-weight:900;font-size:15px}
.ccHostCount{font-size:12px;font-weight:700;color:${C.inkSoft};margin-top:3px}
.ccHostList{list-style:none;margin:9px 0;padding:0;max-height:180px;overflow:auto;font-size:12px;font-weight:700}
.ccHostList li{display:flex;align-items:baseline;gap:6px;padding:3px 0;border-bottom:2px solid #f3eef5}
.ccHostList li:last-child{border-bottom:none}
.ccHostWho{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccHostWhen{flex:none;font-size:10px;font-weight:700;color:${C.inkSoft};white-space:nowrap}
.ccHostEmpty{color:${C.inkSoft}}
.ccRoundRow{display:flex;gap:6px;margin-top:6px}
.ccRoundInput{width:64px;padding:8px;font-size:14px;text-align:center}
.ccRoundBtn{flex:1;font-size:11px;padding:8px 6px;background:#ffd45e;color:${C.ink}}
.ccHostReset{width:100%;margin-top:6px;font-size:11px;padding:8px;background:#fff;color:${C.ink}}
.ccHostNote{margin:9px 0 0;font-size:10.5px;line-height:1.6;color:${C.inkSoft};font-weight:700}

.ccExitChip{cursor:pointer;background:#ffe9a8}
.ccFeed{position:absolute;left:16px;bottom:calc(62px + var(--kb, 0px));
  width:min(380px,52vw);display:flex;flex-direction:column;gap:4px;cursor:pointer;z-index:18}
.ccFeedLine{background:rgba(255,255,255,.95);border:3px solid ${C.line};padding:5px 9px;font-size:12px;
  font-weight:700;line-height:1.45;box-shadow:2px 2px 0 rgba(91,74,99,.18);
  animation:ccFeedFade .6s 3s forwards;word-break:break-all}
.ccFeedLine b{margin-right:6px;color:${C.inkSoft}}
.ccFeedMine b{color:#c05a86}
@keyframes ccFeedFade{to{opacity:.32}}
.ccFeed:hover .ccFeedLine{opacity:1;animation:none}

.ccHistory{position:absolute;left:16px;bottom:calc(62px + var(--kb, 0px));
  width:min(400px,58vw);max-height:52vh;display:flex;flex-direction:column;padding:14px 16px;z-index:22}
.ccHistoryBody{flex:1;overflow:auto;text-align:left;display:flex;flex-direction:column;gap:7px;margin-bottom:8px}
.ccHistLine{font-size:12px;font-weight:700;line-height:1.5;color:${C.ink}}
.ccHistWho{margin-right:6px;color:${C.inkSoft}}
.ccHistMine .ccHistWho{color:#c05a86}
.ccHistText{margin-left:2px}
.ccLogBtn{background:#fff}
.ccLog{position:absolute;left:14px;bottom:150px;display:flex;flex-direction:column;gap:5px;max-width:min(340px,60vw)}
.ccLogLine{background:rgba(255,255,255,.94);border:3px solid ${C.line};padding:5px 9px;font-size:11.5px;
  font-weight:700;box-shadow:3px 3px 0 rgba(91,74,99,.2)}
.ccLogLine b{margin-right:5px}
.ccLogRoom{background:#ffe9a8;border:2px solid ${C.line};padding:0 5px;margin-right:6px;font-size:10px}
.ccSheet{width:min(420px,92vw);max-height:86vh;overflow:auto;padding:18px;text-align:center}
.ccSheetTitle{margin:0 0 12px;font-size:19px;font-weight:900}
.ccSheetEmpty{margin:0 0 8px;font-size:14px;font-weight:700;color:${C.ink}}
.ccSheetNote{margin:0 0 18px;font-size:11.5px;line-height:1.6;font-weight:700;color:${C.inkSoft}}

/* 퀴즈상가 모드 버튼 — 고른 쪽은 눌린 것처럼 들어갑니다 */
.ccModes{position:absolute;left:16px;top:64px;display:flex;flex-direction:column;gap:8px;z-index:12}
.ccMode{border:4px solid ${C.line};font-family:inherit;font-weight:800;font-size:13px;padding:10px 16px;
  cursor:pointer;color:#fff;box-shadow:5px 5px 0 rgba(91,74,99,.35);transition:none}
.ccModeSolo{background:#4aa3e0}
.ccModeTeam{background:#e05b5b}
.ccMode.ccModeOn{transform:translate(4px,4px);box-shadow:0 0 0 rgba(0,0,0,0);filter:saturate(1.3)}
.ccMode:not(.ccModeOn){opacity:.72}

.ccHold{margin-right:4px}
.ccBalance{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;
  font-weight:800;background:#fff8ec;border:3px solid ${C.line};padding:8px 12px;margin-bottom:10px}
.ccHolding{font-size:11px;font-weight:700;color:${C.inkSoft}}
.ccMenu{display:flex;flex-direction:column;gap:6px;max-height:44vh;overflow:auto;margin-bottom:8px}
.ccMenuItem{display:flex;align-items:center;gap:10px;border:3px solid ${C.line};background:#fff;
  font-family:inherit;font-weight:800;font-size:13px;color:${C.ink};padding:10px 12px;cursor:pointer;
  box-shadow:3px 3px 0 rgba(91,74,99,.18);text-align:left}
.ccMenuItem:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(91,74,99,.18)}
.ccMenuNo{opacity:.45}
.ccMenuEmoji{font-size:20px}
.ccMenuName{flex:1}
.ccMenuPrice{font-size:12px;color:#c08a2a}
.ccFortuneText{margin:10px 4px 16px;font-size:16px;font-weight:800;line-height:1.6;color:${C.ink};
  background:#fffbe8;border:3px solid ${C.line};padding:14px 12px}
.ccCookieShake{animation:ccShake .18s steps(2,end) infinite}
.ccFortunes{display:flex;flex-direction:column;gap:5px;max-height:40vh;overflow:auto;margin:4px 0 10px}
.ccFortuneRow{display:flex;align-items:center;gap:2px;border-bottom:2px solid #efe7f2;padding:5px 2px}
.ccFortuneLine{flex:1;font-size:12px;font-weight:700;text-align:left;line-height:1.45}
.ccFortuneEdit{flex:1;font-size:12px;padding:6px 8px;text-align:left}

/* 떵개방 가챠 */
.ccGachaBall{animation:ccGachaBall 1.8s ease-in-out infinite}
@keyframes ccGachaBall{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.ccGachaBig{font-size:64px;line-height:1;margin:6px 0 4px}
.ccGachaSpin{animation:ccSpin .5s linear infinite}
.ccGachaAsk{margin:6px 0 14px;font-size:15px;font-weight:800}
.ccGachaRoll{margin:10px 0 16px;font-size:26px;font-weight:900;color:${C.inkSoft}}
.ccGachaPick{margin:2px 0 12px;font-size:34px;font-weight:900;color:#e05b5b}
.ccFoods{display:flex;flex-wrap:wrap;gap:6px;max-height:38vh;overflow:auto;margin:4px 0 10px}
.ccFood{display:flex;align-items:center;gap:2px;border:3px solid ${C.line};padding:5px 6px 5px 10px;
  font-size:12px;font-weight:700;background:#fff}
.ccFoodName{margin-right:4px}
.ccFoodEdit{width:110px;font-size:12px;padding:5px 7px}

/* 팀전 */
.ccLobbyBtn{position:absolute;left:16px;top:172px;border:4px solid ${C.line};background:#ffd8d8;
  font-family:inherit;font-weight:800;font-size:13px;color:${C.ink};padding:10px 14px;cursor:pointer;
  box-shadow:5px 5px 0 rgba(91,74,99,.3);display:flex;align-items:center;gap:7px;z-index:12}
.ccLobbyBtn:active{transform:translate(3px,3px);box-shadow:2px 2px 0 rgba(91,74,99,.3)}
.ccLobbyN{background:#e05b5b;color:#fff;font-size:11px;padding:1px 6px;border:2px solid ${C.line}}
.ccWaitTag{white-space:nowrap;text-align:center;font-size:10.5px;font-weight:800;margin-bottom:3px;
  background:#ffd8d8;border:3px solid ${C.line};padding:2px 7px;color:#b03a3a;
  box-shadow:2px 2px 0 rgba(91,74,99,.2);animation:ccBlink 1.4s steps(2,end) infinite}
.ccFieldLabel{font-size:11.5px;font-weight:800;color:${C.inkSoft};text-align:left;margin-top:4px}
.ccSizes{flex-wrap:wrap;justify-content:flex-start}
.ccSizeOn{background:#ffd45e}
.ccGames{display:flex;flex-direction:column;gap:9px;margin:6px 0;max-height:44vh;overflow:auto}
.ccGame{border:3px solid ${C.line};padding:11px 12px;text-align:left;background:#fff;
  box-shadow:3px 3px 0 rgba(91,74,99,.18)}
.ccGamePlay{background:#fff6f6}
.ccGameTop{display:flex;align-items:center;justify-content:space-between;font-size:13px}
.ccGameState{font-size:10.5px;font-weight:800;background:#eee;padding:2px 7px;border:2px solid ${C.line}}
.ccGameOn{background:#ffd8d8;color:#b03a3a}
.ccGameWho{font-size:11.5px;font-weight:700;color:${C.inkSoft};margin:5px 0 8px;display:flex;
  justify-content:space-between;gap:8px}
.ccGameN{flex:none;color:${C.ink}}
.ccGameBtns{justify-content:flex-start}
.ccResults{margin-top:10px;border-top:2px solid #efe7f2;padding-top:8px}
.ccResultLine{display:flex;justify-content:space-between;font-size:12px;font-weight:700;padding:3px 0}

/* 시트(퀴즈·플레이리스트) */
.ccSheetHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ccX{border:3px solid ${C.line};background:#fff;font-family:inherit;font-weight:700;cursor:pointer;
  width:30px;height:30px;font-size:13px;box-shadow:2px 2px 0 rgba(91,74,99,.25)}
.ccRow{display:flex;gap:6px;align-items:center;justify-content:center}
.ccHostRow{margin-top:12px;flex-wrap:wrap}
.ccHostTop{margin:0 0 12px}
.ccAddBtn{background:#ffd45e;color:${C.line}}
.ccMini{border:3px solid ${C.line};background:#fff;color:${C.ink};font-family:inherit;font-weight:700;
  font-size:11.5px;padding:7px 10px;cursor:pointer;box-shadow:2px 2px 0 rgba(91,74,99,.25)}
.ccMini:active{transform:translate(2px,2px);box-shadow:0 0 0}
.ccDanger{background:#ffe0e0}
.ccMiniBtn{font-size:12px;padding:9px 14px}
.ccPacks{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:22px 12px;margin:22px 2px 10px}
.ccPack{position:relative;border:4px solid ${C.line};font-family:inherit;color:${C.ink};
  padding:26px 12px 20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;
  border-radius:46% 46% 44% 44% / 54% 54% 46% 46%;
  box-shadow:4px 5px 0 rgba(91,74,99,.28);
  background-image:
    radial-gradient(circle at 24% 66%, rgba(255,255,255,.9) 0 4px, transparent 4px),
    radial-gradient(circle at 72% 74%, rgba(255,255,255,.9) 0 5px, transparent 5px),
    radial-gradient(circle at 78% 44%, rgba(255,255,255,.85) 0 3px, transparent 3px)}
.ccPack:active{transform:translate(2px,3px);box-shadow:2px 2px 0 rgba(91,74,99,.28)}
.ccKnot{position:absolute;top:-15px;left:50%;transform:translateX(-50%);overflow:visible}
.ccPackName{font-weight:900;font-size:14px;line-height:1.25;text-align:center;word-break:keep-all;
  text-shadow:1px 1px 0 rgba(255,255,255,.6)}
.ccPackN{font-size:11px;font-weight:800;color:rgba(91,74,99,.75)}
.ccPackBar{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px}
.ccQuizImg{position:relative;border:4px solid ${C.line};background:#f4eef6;margin-bottom:10px}
.ccQuizImg img{display:block;width:100%;max-height:38vh;object-fit:contain}
.ccMark{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;background:rgba(255,255,255,.35);z-index:3}
.ccMarkSign{font-size:76px;font-weight:900;line-height:1;text-shadow:2px 2px 0 #fff,-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff}
.ccRedPen{font-size:19px;font-weight:900;color:#e23b3b;background:#fff;
  border:4px solid #e23b3b;padding:7px 18px;transform:rotate(-5deg);box-shadow:3px 3px 0 rgba(226,59,59,.3)}
.ccQuizStep{font-weight:800}
.ccQuizOk{color:${C.inkSoft};font-size:11.5px}
.ccScore{padding:18px 6px 8px}
.ccScoreBig{font-size:52px;font-weight:900;color:#2e9e78;line-height:1}
.ccScoreBig span{font-size:24px;color:${C.inkSoft}}
.ccScoreMsg{margin:10px 0 16px;font-size:13px;font-weight:700;color:${C.ink}}
.ccMarkO{color:#2e9e78}
.ccMarkX{color:#e0685f}
.ccShake{animation:ccShake .3s steps(2,end) 2}
@keyframes ccShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ccQuizNav{display:flex;align-items:center;justify-content:center;gap:12px;font-size:12px;font-weight:700;margin-bottom:10px}
.ccAdd{display:flex;flex-direction:column;gap:8px;align-items:stretch}
.ccCheck{display:flex;gap:7px;align-items:center;font-size:11.5px;font-weight:700;color:${C.inkSoft};text-align:left}
.ccFile{font-family:inherit;font-size:11.5px;border:3px dashed ${C.line};padding:9px;background:#fffbe8}
.ccPreview{width:100%;max-height:30vh;object-fit:contain;border:3px solid ${C.line}}
.ccTracks{list-style:none;margin:2px 0 6px;padding:0;max-height:42vh;overflow:auto;text-align:left}
.ccTracks li{display:flex;align-items:center;gap:4px;border-bottom:2px solid #efe7f2}
.ccTracks li:last-child{border-bottom:none}
.ccTrackBtn{flex:1;display:flex;align-items:center;gap:10px;text-align:left;border:none;background:none;
  font-family:inherit;font-weight:700;font-size:13px;color:${C.ink};padding:11px 4px;cursor:pointer}
.ccTrackNo{font-size:11px;color:${C.inkSoft};min-width:18px}
.ccTrackName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccTrackOn .ccTrackBtn{color:#c05a86}
.ccTrackOn .ccTrackNo{color:#c05a86}
.ccTrackDel{border:none;background:none;font-family:inherit;font-size:12px;color:${C.inkSoft};
  padding:8px;cursor:pointer}
.ccTrackDel:hover{color:#e0685f}
.ccPlayBar{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;
  background:#fff;border:4px solid ${C.line};padding:7px 11px;box-shadow:4px 4px 0 rgba(91,74,99,.3);
  max-width:min(360px,70vw);z-index:20}
.ccPlayOf{font-size:10px;color:${C.inkSoft};margin-left:6px;font-weight:700}
.ccPls{display:flex;flex-direction:column;gap:6px;margin:4px 0 8px;max-height:44vh;overflow:auto}
.ccPl{border-bottom:2px solid #efe7f2}
.ccPl:last-child{border-bottom:none}
.ccPlHead{display:flex;align-items:center;gap:6px}
.ccPlName{flex:1;display:flex;align-items:center;gap:8px;border:none;background:none;font-family:inherit;
  font-weight:800;font-size:13px;color:${C.ink};padding:11px 2px;cursor:pointer;text-align:left}
.ccPlTitle{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccPlEdit{flex:1;font-size:12.5px;padding:8px 10px;text-align:left}
.ccPlIcon{border:none;background:none;font-family:inherit;font-size:14px;color:${C.inkSoft};
  padding:6px 4px;cursor:pointer;display:flex;align-items:center;line-height:1}
.ccPlIcon:hover{color:${C.ink}}
.ccPlArrow{font-size:11px;color:${C.inkSoft};width:12px}
.ccPlN{font-size:10.5px;color:${C.inkSoft};font-weight:700}
.ccPlPlay{border:3px solid ${C.line};background:#ffd45e;font-family:inherit;font-size:12px;
  width:30px;height:30px;cursor:pointer;box-shadow:2px 2px 0 rgba(91,74,99,.22)}
.ccPlPlay:active{transform:translate(2px,2px);box-shadow:none}
.ccPlPick{flex-wrap:wrap;justify-content:flex-start}
.ccPlayTitle{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ccPlayDisc{animation:ccSpin 2.4s linear infinite;font-size:15px}
.ccPlayBtn{border:none;background:none;font-family:inherit;font-size:14px;cursor:pointer;padding:2px 3px;line-height:1}
.ccVol{-webkit-appearance:none;appearance:none;width:76px;height:12px;background:#efe7f2;
  border:3px solid ${C.line};padding:0;cursor:pointer}
.ccVol::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#ff8fb6;
  border:3px solid ${C.line};cursor:pointer}
.ccVol::-moz-range-thumb{width:12px;height:12px;background:#ff8fb6;border:3px solid ${C.line};
  border-radius:0;cursor:pointer}
@keyframes ccSpin{to{transform:rotate(360deg)}}

/* 수영장 노을 벽화 반짝임 */
.ccMuralStar{animation:ccMuralTw 2.6s steps(3,end) infinite;transform-origin:center}
@keyframes ccMuralTw{0%,100%{opacity:.15}45%{opacity:1}60%{opacity:.5}}
.ccMuralGlow{animation:ccMuralGlow 3.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ccMuralGlow{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.12)}}
.ccMuralShimmer{animation-name:ccMuralSh;animation-timing-function:ease-in-out;animation-iteration-count:infinite;opacity:0}
@keyframes ccMuralSh{0%,100%{opacity:0;transform:translateX(-10px)}45%{opacity:.9;transform:translateX(6px)}70%{opacity:.25;transform:translateX(12px)}}

/* 방 내부 */
.ccRoomBg{position:absolute;inset:0;overflow:hidden}
.ccRoomWrap{position:absolute;left:50%;top:50%;transform-origin:50% 50%}
.ccRoomSvg{position:absolute;left:0;top:0;image-rendering:auto}
.ccRoomLayer{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.ccRoomBgmBtn{position:absolute;right:14px;top:14px;z-index:12;border:3px solid ${C.line};background:#fff6dc;color:${C.ink};padding:7px 10px;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:3px 3px 0 rgba(91,74,99,.28)}
.ccRoomBgmBtn:active{transform:translate(2px,2px);box-shadow:none}
.ccRoomBgmNow{position:absolute;left:14px;top:14px;z-index:11;background:rgba(255,255,255,.92);border:3px solid ${C.line};padding:6px 9px;font-size:10.5px;font-weight:800;color:${C.ink};max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 건물 안은 원근 때문에 아바타가 작아져서, 글씨를 키워 균형을 맞춥니다 */
.ccRoomLayer .ccTag{font-size:15px;margin-bottom:3px}
.ccRoomLayer .ccBubble{font-size:16px;line-height:1.45;max-width:230px;padding:11px 18px;margin-bottom:16px}
.ccRoomLayer .ccWaitTag{font-size:13px}
.ccRoomLayer .ccHold{font-size:16px}
.ccZoneHint{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);background:#fff;
  border:4px solid ${C.line};padding:11px 20px;font-size:16px;font-weight:700;color:${C.ink};
  font-family:inherit;cursor:pointer;box-shadow:4px 4px 0 rgba(91,74,99,.3);animation:ccBlink 1s steps(2,end) infinite}
.ccAvatar .ccPix{position:relative;z-index:2}
/* 튜브 — 뒤쪽 반은 캐릭터 뒤, 앞쪽 반만 앞에 그려서 실제로 끼고 있는 것처럼 보이게 */
.ccTube{position:absolute;left:50%;bottom:1px;width:80px;height:26px;margin-left:-40px;border-radius:50%;
  border:6px solid #ff8fb6;box-shadow:0 0 0 3px ${C.line},inset 0 0 0 3px ${C.line};
  animation:ccSwim .5s steps(2,end) infinite;pointer-events:none}
.ccTubeBack{z-index:1}
.ccTubeFront{z-index:3;clip-path:inset(52% -14px -14px -14px)}
.ccSwim .ccPix{animation:ccSwim .5s steps(2,end) infinite}
@keyframes ccSwim{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}

/* 모바일 조작 */
.ccTouch{display:none}
.ccStickZone{position:absolute;left:0;bottom:0;width:52%;height:74%;touch-action:none;z-index:6}
.ccStick{position:absolute;left:20px;bottom:calc(24px + var(--kb, 0px));width:124px;height:124px;border-radius:50%;
  border:4px solid ${C.line};background:rgba(255,255,255,.6);touch-action:none;opacity:.75;
  box-shadow:4px 4px 0 rgba(91,74,99,.25);display:flex;align-items:center;justify-content:center}
.ccStickOn{opacity:1;background:rgba(255,255,255,.85)}
.ccStickKnob{width:52px;height:52px;border-radius:50%;border:4px solid ${C.line};background:#ffd45e;
  box-shadow:3px 3px 0 rgba(91,74,99,.25);pointer-events:none;transition:transform .04s linear}
.ccActs{position:absolute;right:20px;bottom:calc(22px + var(--kb, 0px));display:flex;align-items:flex-end;gap:10px}
.ccAct{border:4px solid ${C.line};background:#fff;color:${C.ink};font-family:inherit;font-weight:700;
  font-size:13px;padding:0 14px;height:56px;min-width:56px;box-shadow:4px 4px 0 rgba(91,74,99,.25);
  touch-action:none;cursor:pointer}
.ccAct:active{transform:translate(2px,2px);box-shadow:2px 2px 0 rgba(91,74,99,.25)}
.ccActMain{background:#ff8fb6;color:#fff;height:64px;min-width:96px;font-size:14px}

/* 세로 화면 안내 */
.ccRotate{display:none;position:fixed;inset:0;z-index:99;background:${C.sky2};
  flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px}
.ccRotateIcon{font-size:56px;animation:ccRot 1.6s steps(4,end) infinite}
@keyframes ccRot{0%,45%{transform:rotate(0)}55%,100%{transform:rotate(-90deg)}}
.ccRotateText{font-size:16px;font-weight:900;color:${C.ink}}

/* 터치가 감지되면 미디어쿼리와 무관하게 조작 UI 를 띄웁니다 */
.ccIsTouch .ccTouch{display:block}
.ccIsTouch .ccHelp{display:none}
.ccIsTouch .ccChatBar{left:158px;width:min(300px,42vw)}
.ccIsTouch .ccFeed{left:158px;width:min(300px,42vw)}
.ccIsTouch .ccHistory{left:158px;width:min(340px,50vw);max-height:44vh}
.ccIsTouch .ccSide{width:200px;right:20px;top:84px}
.ccIsTouch .ccQuestList{max-height:min(34vh,220px)}

@media (hover:none) and (pointer:coarse){
  .ccTouch{display:block}
  .ccHelp{display:none}
  /* 채팅바·피드·기록을 같은 자리에 세로로 쌓습니다 (조이스틱 오른쪽) */
  .ccChatBar{left:158px;width:min(300px,42vw);bottom:calc(16px + var(--kb, 0px))}
  .ccFeed{left:158px;width:min(300px,42vw);bottom:calc(62px + var(--kb, 0px))}
  .ccHistory{left:158px;width:min(340px,50vw);max-height:44vh;bottom:calc(62px + var(--kb, 0px))}
  .ccHud{max-width:44vw}
  .ccHud .ccChip{font-size:11px;padding:5px 9px}
  .ccSide{width:200px;right:20px;top:84px}
  .ccQuestList{max-height:min(34vh,220px)}
}
@media (hover:none) and (pointer:coarse) and (orientation:portrait){
  .ccRotate{display:flex}
}
  .ccChatBar{left:14px;transform:none;width:min(320px,56vw);bottom:calc(16px + var(--kb, 0px))}}

.ccBtn{border:3px solid ${C.line};background:#ff8fb6;color:#fff;font-weight:700;font-size:13px;
  padding:11px 18px;cursor:pointer;font-family:inherit;box-shadow:4px 4px 0 rgba(91,74,99,.3)}
.ccBtn:active{transform:translate(2px,2px);box-shadow:2px 2px 0 rgba(91,74,99,.3)}
.ccBtn:disabled{background:#ded6de;cursor:not-allowed}

.ccModalWrap{position:absolute;inset:0;background:rgba(91,74,99,.45);display:flex;align-items:center;
  justify-content:center;padding:20px}
.ccModal{width:min(400px,92vw);padding:22px;text-align:center}

/* 👗 꾸미기 */
.ccDress{width:min(380px,94vw);padding:18px;max-height:88vh;overflow:auto}
.ccDressMirror{display:flex;align-items:flex-end;justify-content:center;height:132px;margin:4px 0 8px;
  background:repeating-linear-gradient(180deg,#f3ecff 0 8px,#ede4ff 8px 16px);
  border:4px solid ${C.line};box-shadow:inset 0 0 0 4px #fbf6ff}
.ccDressStars{font-size:12px;font-weight:800;color:${C.inkSoft};margin-bottom:10px}
.ccDressTabs{display:flex;gap:6px;justify-content:center;margin-bottom:10px}
.ccMiniOn{background:#ffd45e;font-weight:800}
.ccDressGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:4px}
.ccDressCell{position:relative;border:3px solid ${C.line};background:#fff;color:${C.ink};
  font-family:inherit;font-size:12px;font-weight:700;padding:11px 4px 15px;cursor:pointer;
  box-shadow:2px 2px 0 rgba(91,74,99,.2);display:flex;flex-direction:column;align-items:center;gap:5px}
.ccDressCell:active{transform:translate(2px,2px);box-shadow:none}
.ccDressOn{background:#fff6dc;box-shadow:inset 0 0 0 3px #ffd45e,2px 2px 0 rgba(91,74,99,.2)}
.ccDressLocked{color:${C.inkSoft}}
.ccDressLabel{line-height:1.2}
.ccDressChip{width:26px;height:14px;border:3px solid ${C.line}}
.ccDressPrice{position:absolute;left:0;right:0;bottom:-1px;font-size:10px;font-weight:800;
  background:#ffe9a8;border-top:3px solid ${C.line};padding:1px 0}
.ccDressHave{position:absolute;left:0;right:0;bottom:-1px;font-size:9.5px;font-weight:700;
  color:${C.inkSoft};background:#f4eff6;border-top:3px solid ${C.line};padding:1px 0}
.ccDressAsking{box-shadow:inset 0 0 0 3px #ff8fb6,2px 2px 0 rgba(91,74,99,.2)}
.ccDressAsk{display:flex;flex-direction:column;gap:8px;align-items:center;margin-top:10px;
  border:3px solid ${C.line};background:#fff6dc;padding:10px;font-size:12px;font-weight:700}
.ccDressAskBtns{display:flex;gap:8px}
.ccDressPic{width:40px;height:40px;object-fit:contain;object-position:center bottom;display:block;
  background:none;border:none}

/* 올린 사진으로 갈아입은 캐릭터 */
.ccSkinPic{width:64px;height:64px;background-size:contain;background-repeat:no-repeat;
  background-position:center bottom;position:relative;z-index:2;margin:0 auto}

/* 🎨 캐릭터 이미지 관리 */
.ccSetSkinBtn{margin-top:8px;width:100%;text-align:center}
.ccSetWipe{margin-top:6px;width:100%;text-align:center;font-size:11.5px;color:${C.inkSoft}}
.ccSkins{width:min(400px,94vw);padding:18px;max-height:88vh;overflow:auto}
.ccSkinAdd{display:flex;gap:10px;align-items:stretch;margin-bottom:10px}
.ccSkinPick{flex:none;width:92px;height:92px;border:3px solid ${C.line};background:#f7f2fa;
  font-family:inherit;font-size:11px;font-weight:700;color:${C.inkSoft};cursor:pointer;padding:0;
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.ccSkinPreview{width:100%;height:100%;object-fit:cover;display:block}
.ccSkinFields{flex:1;display:flex;flex-direction:column;gap:6px;justify-content:center}
.ccSkinName{width:100%;padding:9px 10px;font-size:12.5px;text-align:left}
.ccSkinRow{display:flex;gap:6px;align-items:center}
.ccSkinPriceLabel{font-size:13px}
.ccSkinPrice{width:52px;padding:9px 6px;font-size:13px;text-align:center}
.ccSkinAddBtn{width:100%;font-size:12.5px;padding:10px;background:#ffd45e;color:${C.ink};
  white-space:nowrap;margin-bottom:8px}
.ccSkinPriceNote{font-size:10.5px;font-weight:700;color:${C.inkSoft};white-space:nowrap}
.ccSkinList{display:flex;flex-direction:column;gap:6px;margin:6px 0 4px;max-height:38vh;overflow:auto}
.ccSkinItem{display:flex;align-items:center;gap:9px;border:3px solid ${C.line};background:#fff;padding:6px 9px}
.ccSkinThumb{width:40px;height:40px;object-fit:contain;object-position:center bottom;flex:none;display:block}
.ccSkinItemName{flex:1;font-size:12.5px;font-weight:800;text-align:left;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ccSkinItemPrice{font-size:11.5px;font-weight:800;color:#c05a86}
/* 배경 지우기 — 투명한 데가 보이도록 체크무늬를 깝니다 */
.ccSkinPick{background-color:#fff;background-image:
  linear-gradient(45deg,#e7dfea 25%,transparent 25%),linear-gradient(-45deg,#e7dfea 25%,transparent 25%),
  linear-gradient(45deg,transparent 75%,#e7dfea 75%),linear-gradient(-45deg,transparent 75%,#e7dfea 75%);
  background-size:14px 14px;background-position:0 0,0 7px,7px -7px,-7px 0}
.ccSkinPreview{object-fit:contain}
.ccCut{border:3px solid ${C.line};background:#f9f5fb;padding:9px 11px;margin-bottom:9px;text-align:left}
.ccCutRow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;
  color:${C.ink};cursor:pointer;padding:2px 0}
.ccCutLabel{font-size:11.5px;color:${C.inkSoft}}
.ccCutRange{flex:1;min-width:90px}
.ccCutNum{font-size:11.5px;font-weight:800;color:#c05a86;width:24px;text-align:right}
.ccCutNote{margin:6px 0 0;font-size:10.5px;font-weight:700;line-height:1.5;color:${C.inkSoft}}

/* 📮 우체통 */
.ccWish{width:min(400px,94vw);padding:18px;max-height:88vh;overflow:auto}
.ccWishAsk{margin:2px 0 12px;font-size:15px;font-weight:900;line-height:1.6;color:${C.ink};white-space:pre-line}
.ccWishRow{display:flex;gap:6px}
.ccWishInput{flex:1;padding:10px 11px;font-size:12.5px;text-align:left}
.ccWishSend{flex:none;font-size:12.5px;padding:10px 16px;background:#ffd45e;color:${C.ink}}
.ccWishDone{margin-top:9px;border:3px solid ${C.line};background:#e8fbf1;padding:8px;
  font-size:12px;font-weight:800;color:#2f8f68}
.ccWishHead{display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin:14px 0 6px;font-size:12px;font-weight:800;color:${C.inkSoft};text-align:left}
.ccWishN{color:#c05a86}
.ccWishList{display:flex;flex-direction:column;gap:5px;max-height:38vh;overflow:auto;text-align:left}
.ccWishItem{display:flex;align-items:baseline;gap:7px;border:3px solid ${C.line};background:#fff;
  padding:7px 9px;font-size:12px;font-weight:700;line-height:1.45}
.ccWishRound{flex:none;font-size:10px;font-weight:800;color:#c05a86;background:#ffe9a8;
  border:2px solid ${C.line};padding:1px 4px}
.ccWishWho{flex:none;font-size:11px;color:${C.inkSoft}}
.ccWishBody{flex:1;word-break:keep-all}
.ccWishOff{margin-top:12px;line-height:1.7}

/* 투두 아래 우체통 아이콘 — 네모 없이 아이콘만 */
.ccFbBtn{align-self:flex-end;display:flex;flex-direction:column;align-items:center;gap:1px;
  background:none;border:none;padding:4px 6px;cursor:pointer;font-family:inherit;
  filter:drop-shadow(2px 2px 0 rgba(91,74,99,.35))}
.ccFbBtn:active{transform:translate(1px,1px)}
.ccFbIcon{font-size:30px;line-height:1;animation:ccFbNudge 2.6s steps(2,end) infinite}
@keyframes ccFbNudge{0%,88%,100%{transform:translateY(0)}94%{transform:translateY(-4px)}}
.ccFbWord{font-size:10.5px;font-weight:800;color:${C.ink};
  text-shadow:-2px 0 #fff,2px 0 #fff,0 -2px #fff,0 2px #fff,-2px -2px #fff,2px -2px #fff,-2px 2px #fff,2px 2px #fff}

/* 📮 피드백 창 */
.ccFb{width:min(400px,94vw);padding:18px;max-height:88vh;overflow:auto}
.ccFbAsk{margin:2px 0 11px;font-size:14px;font-weight:800;line-height:1.65;color:${C.ink}}
.ccFbText{width:100%;padding:11px;font-size:12.5px;text-align:left;line-height:1.6;resize:vertical}
.ccFbBar{display:flex;align-items:center;gap:8px;margin-top:8px}
.ccFbAnon{flex:1;font-size:10.5px;font-weight:700;color:${C.inkSoft};text-align:left;line-height:1.4}
.ccFbSend{flex:none;font-size:12.5px;padding:10px 18px;background:#ffd45e;color:${C.ink}}
.ccFbBtns{display:flex;gap:5px}
.ccFbItem{align-items:flex-start}

/* 환영 팝업 — 보상 한 줄 */
.ccWelBonus{margin:10px 0 0;font-size:12px;font-weight:800;color:${C.ink};
  background:#fff6dc;border:3px solid ${C.line};padding:6px 10px;display:inline-block}
.ccWelBonus b{color:#c05a86;font-size:14px}
.ccModalEmoji{font-size:42px;line-height:1}
.ccModalTag{display:inline-block;margin-top:10px;border:2px solid ${C.line};padding:2px 10px;font-size:11px;font-weight:700;background:#ffe9a8}
.ccModalName{margin:9px 0 8px;font-size:19px;font-weight:900}
.ccModalLine{margin:0 0 18px;font-size:13.5px;line-height:1.75;color:${C.inkSoft};font-weight:700}

/* 입장 화면 */
.ccGate{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.ccGateSky{position:absolute;inset:0;background:linear-gradient(180deg,${C.sky1} 0%,${C.sky2} 60%,${C.sky3} 100%)}
.ccGateCard{position:relative;width:min(340px,92vw);padding:22px;text-align:center}
.ccGateChars{display:flex;justify-content:center;align-items:flex-end;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.ccGateMore{font-size:12px;font-weight:800;color:${C.inkSoft};align-self:center}
.ccGateCharOn{animation:ccWalk .5s steps(2,end) infinite}
.ccGateCharOff{filter:grayscale(1);opacity:.35}
.ccGateTitle{margin:4px 0 2px;font-size:22px;font-weight:900}
.ccGateSub{margin:0 0 12px;font-size:12px;font-weight:700;color:${C.inkSoft}}
.ccSeatCount{margin:0 0 12px;font-size:13px;font-weight:900;color:#2e9e78}
.ccSeatFull{color:#e0685f}
.ccClosed{margin:14px 0 6px;background:#fff0f0;border:4px solid #e0685f;padding:16px 12px;
  font-size:14px;font-weight:800;line-height:1.7;color:#c9524a}
.ccClosedOn{background:#ffd8d8;color:${C.ink}}
.ccClosedTag{background:#e0685f;color:#fff;font-size:10px;padding:2px 6px;border:2px solid ${C.line};margin-left:6px}
.ccNotice{margin:0 0 12px;background:#fff6e0;border:3px solid #f0b23f;padding:9px 11px;font-size:12px;
  font-weight:700;line-height:1.5;color:${C.ink}}
.ccInput{width:100%;border:3px solid ${C.line};padding:11px 12px;font-size:14px;font-weight:700;
  color:${C.ink};outline:none;text-align:center;font-family:inherit;background:#fff}
.ccInput:focus{background:#fffbe8}
.ccInputCode{margin-top:7px;font-size:12px}
.ccLinkBtn{margin-top:9px;background:none;border:none;font-size:11px;font-weight:700;color:${C.inkSoft};
  text-decoration:underline;cursor:pointer;font-family:inherit}
.ccSoloBtn{display:block;margin:10px auto 0}
.ccErr{margin-top:10px;background:#fff0f0;border:3px solid #e0685f;padding:8px 10px;font-size:11.5px;
  font-weight:700;line-height:1.55;color:#c9524a}
.ccGateBtn{width:100%;margin-top:12px}
.ccGateNote{margin:11px 0 0;font-size:10.5px;line-height:1.6;color:${C.inkSoft};font-weight:700}
`;
