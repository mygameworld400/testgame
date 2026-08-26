/* CloudCandyTown v5 — mobile joystick restored/enlarged + touch movement fix */
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

const WORLD = { w: 3000, h: 3600 };

/* 걸어다닐 수 있는 구역들 — 윗동네 · 가운데섬 · 아랫섬.
   이 사각형들 밖으로는 못 나갑니다. 섬끼리는 미끄럼틀로만 오갑니다.
   (오른쪽 분홍 미끄럼틀 = 가운데↔아래, 왼쪽 민트 미끄럼틀 = 위↔가운데) */
const AREAS = [
  { x0: 250, y0: 250, x1: 1500, y1: 810 },       // 윗동네
  { x0: 190, y0: 1080, x1: 1520, y1: 1680 },     // 가운데섬
  { x0: 250, y0: 2100, x1: 1450, y1: 2640 },     // 아랫섬
  { x0: 1480, y0: 450, x1: 1700, y1: 610 },      // 윗동네 ↔ 오른쪽 섬 연결길
  { x0: 1430, y0: 2290, x1: 1700, y1: 2490 },    // 아랫섬 ↔ 오른쪽 섬 연결길
  { x0: 1600, y0: 250, x1: 2820, y1: 810 },      // 오른쪽 윗섬
  { x0: 1600, y0: 2100, x1: 2820, y1: 2640 },     // 오른쪽 아랫섬
  { x0: 2160, y0: 780, x1: 2340, y1: 2110 },       // 찜질스파 ↔ 솜사탕 2차선 버스 도로
  { x0: 650, y0: 2620, x1: 930, y1: 2980 },        // 아랫섬 ↔ 구름공원 연결 도로
  { x0: 190, y0: 2910, x1: 1520, y1: 3452 },       // 구름공원
];
const PLAY = { x0: 190, y0: 320, x1: 2820, y1: 3490 };
const inArea = (x, y) => AREAS.some((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1);
const BUS_RETURN_DURATION = 1800;
const BUS_ROUTES = {
  // dropoff은 버스가 도로 끝에 선 뒤 승객이 실제 맵으로 내릴 위치입니다.
  // 도로 자체는 보행 불가이므로, 자동 하차 시 도로 밖의 보행 가능 구역으로 내려줍니다.
  cottonSpa: { id: "cottonSpa", label: "솜사탕 → 찜질스파", laneX: 2290, start: { x: 2290, y: 2070 }, end: { x: 2290, y: 820 }, dropoff: { x: 2290, y: 745 }, duration: 5600 },
  spaCotton: { id: "spaCotton", label: "찜질스파 → 솜사탕", laneX: 2210, start: { x: 2210, y: 820 }, end: { x: 2210, y: 2070 }, dropoff: { x: 2210, y: 2140 }, duration: 5600 },
};
const BUS_IDS = Object.keys(BUS_ROUTES);
const busPosition = (route, state, now) => {
  if (!state || state.status === "idle") return { ...route.start };
  const from = state.status === "return" ? route.end : route.start;
  const to = state.status === "return" ? route.start : route.end;
  const elapsed = Math.max(0, now - state.startedAt);
  const t = Math.min(1, elapsed / (state.status === "return" ? BUS_RETURN_DURATION : route.duration));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
};

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

  { id: "spa", name: "구름찜질스파", emoji: "🧖", tag: "찜질스파", x: 2180, y: 520, scale: 11,
    lines: ["1층은 목욕·샤워·사우나, 2층은 온천, 3층은 찜질과 휴식이에요.", "수건 하나 챙기고 천천히 둘러보세요."] },

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

  /* 오른쪽 아랫섬 — 새로 만든 솜사탕 가게 */
  { id: "cotton", name: "구름솜사탕", emoji: "🍭", tag: "솜사탕", x: 2190, y: 2440, scale: 9, sprite: "cotton",
    lines: [
      "솜사탕 하나 말아드릴까요? 구름처럼 폭신하게 만들어드려요.",
      "분홍·하늘·레몬 맛이 있어요. 오늘은 어떤 색으로 드릴까요?",
      "여기 솜사탕은 먹고 나면 입안에서 살짝 구름 맛이 나요.",
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
  { id: "cafeTalk", icon: "🪑", name: "카페 테이블에 앉아 대화 나누기", desc: "구름카페 테이블에 앉아 다른 사람이나 직원과 대화를 나눠보세요." },
  { id: "dress", icon: "👗", name: "구름옷가게에서 꾸미기", desc: "카페 옆 옷가게 전신거울 앞에서 얼굴·머리·옷 색을 바꿔보세요." },
  { id: "feedback", icon: "📮", name: "피드백 남기기", desc: "오른쪽 아래 📮 를 눌러 아무 말이나 남겨주세요. 익명이에요." },
  { id: "up", icon: "🏘️", name: "윗동네 새 건물 구경하기", desc: "윗동네에 새로 생긴 건물들을 하나씩 구경해보세요." },
  { id: "spa", icon: "🧖", name: "찜질스파 둘러보기", desc: "윗동네의 구름찜질스파에 들어가 1·2·3층을 구경해보세요." },
  { id: "jump", icon: "🤸", name: "방방 뛰어보기", desc: "윗동네 방방에 올라가 신나게 뛰어보세요." },
  { id: "movie", icon: "🎬", name: "영화관에서 영화보기", desc: "윗동네 영화관에 들어가 상영 중인 영화를 감상해보세요." },
  { id: "karaoke", icon: "🎤", name: "노래방에서 선곡 후 마이크 잡고 노래하기", desc: "노래방에서 노래를 선곡한 뒤 마이크를 잡아보세요." },
  { id: "arcade", icon: "🕹️", name: "미니게임장에서 게임 참여하기", desc: "윗동네 미니게임장에 들어가 게임에 참여해보세요." },
  { id: "stargaze", icon: "🔭", name: "천문대에서 별멍하기", desc: "천문대에 가서 편하게 누워 별을 바라보세요." },
];

/* 윗동네에 새로 생긴 방들 */
const UP_ROOMS = ["jump", "sing", "arcade", "escape", "movie", "star", "spa1", "spaLobby"];

/* 투두를 다 깨면 주는 별 */
const CLEAR_BONUS = 100;

/* 글꼴 — 설정에서 고르면 이 기기에 저장됩니다 */
const FONTS = [
  { id: "neo", name: "Neo둥근모", css: '"NeoDunggeunmo",system-ui,sans-serif' },
];
const FONT_DEFAULT = "neo";

function applyFont(id) {
  const f = FONTS.find((x) => x.id === id) || FONTS[0];
  document.documentElement.style.setProperty("--ccFont", f.css);
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
  /* 오른쪽 윗섬 */
  [1740, 330], [2050, 680], [2400, 360], [2700, 650],
  /* 오른쪽 아랫섬 */
  [1720, 2250], [1980, 2580], [2420, 2240], [2680, 2560],
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
  /* 오른쪽 윗섬 */
  [1690, 330, "#ff9ec4"], [2060, 270, "#8fe3c9"], [2480, 700, "#ffd45e"], [2760, 380, "#b6a6f0"],
  /* 오른쪽 아랫섬 */
  [1660, 2260, "#8fe3c9"], [1920, 2550, "#ff9ec4"], [2510, 2180, "#ffd45e"], [2760, 2520, "#b6a6f0"],
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

/* 오른쪽 윗섬 */
const ISLAND4 = [
  { x: 1660, y: 166, w: 1140, h: 20 },
  { x: 1618, y: 186, w: 1224, h: 20 },
  { x: 1586, y: 206, w: 1288, h: 604 },
  { x: 1618, y: 810, w: 1224, h: 20 },
  { x: 1660, y: 830, w: 1140, h: 20 },
];
const SOIL4 = [
  { x: 1710, y: 850, w: 1040, h: 34 },
  { x: 1810, y: 884, w: 840, h: 30 },
  { x: 1930, y: 914, w: 600, h: 24 },
  { x: 2070, y: 938, w: 320, h: 20 },
];
const PATHS4 = [
  { x: 1630, y: 470, w: 1190, h: 60 },
  { x: 1760, y: 530, w: 56, h: 240 },
  { x: 2240, y: 530, w: 56, h: 240 },
  { x: 2680, y: 530, w: 56, h: 240 },
];

/* 오른쪽 아랫섬 */
const ISLAND5 = [
  { x: 1660, y: 2080, w: 1140, h: 22 },
  { x: 1618, y: 2102, w: 1224, h: 22 },
  { x: 1586, y: 2124, w: 1288, h: 520 },
  { x: 1618, y: 2644, w: 1224, h: 22 },
  { x: 1660, y: 2666, w: 1140, h: 22 },
];
const SOIL5 = [
  { x: 1710, y: 2688, w: 1040, h: 38 },
  { x: 1810, y: 2726, w: 840, h: 34 },
  { x: 1930, y: 2760, w: 600, h: 28 },
  { x: 2070, y: 2788, w: 320, h: 22 },
];
const PATHS5 = [
  { x: 1630, y: 2280, w: 1190, h: 60 },
  { x: 1860, y: 2340, w: 64, h: 200 },
  { x: 2280, y: 2340, w: 64, h: 200 },
  { x: 2700, y: 2340, w: 64, h: 200 },
];

/* 구름카페 아래 새 공원 맵 — 기존 섬에서 길을 따라 바로 내려갈 수 있습니다. */
const ISLAND6 = [
  { x: 300, y: 2910, w: 1100, h: 24 },
  { x: 250, y: 2934, w: 1200, h: 24 },
  { x: 214, y: 2958, w: 1272, h: 470 },
  { x: 250, y: 3428, w: 1200, h: 24 },
  { x: 300, y: 3452, w: 1100, h: 24 },
];
const SOIL6 = [
  { x: 340, y: 3476, w: 1020, h: 34 },
  { x: 430, y: 3510, w: 840, h: 28 },
];
const PATHS6 = [
  { x: 350, y: 3150, w: 1000, h: 54 },
  { x: 780, y: 2980, w: 58, h: 170 },
  { x: 780, y: 3200, w: 58, h: 170 },
];
const PARK_DECO = [
  {x:420,y:3050,t:'tree'}, {x:600,y:3040,t:'tree'}, {x:1030,y:3045,t:'tree'}, {x:1230,y:3060,t:'tree'},
  {x:400,y:3340,t:'tree'}, {x:1180,y:3350,t:'tree'}, {x:1330,y:3290,t:'tree'},
  {x:520,y:3250,t:'bench'}, {x:1080,y:3260,t:'bench'}, {x:740,y:3070,t:'lamp'}, {x:880,y:3070,t:'lamp'},
];
const PARK_BLOCKS = [
  {x1:690,x2:930,y1:3120,y2:3230},
  {x1:850,x2:1120,y1:3190,y2:3290},
];

/* 건물 이미지 관리에서 함께 바꿀 수 있는 버스/공원 오브제 목록 */
const PARK_IMAGE_TARGETS = [
  { id: "park:sign", label: "구름공원 표지판" },
  { id: "park:pond", label: "공원 연못" },
  { id: "park:gazebo", label: "공원 정자" },
  { id: "park:playground", label: "어린이 놀이터" },
  { id: "park:picnic", label: "피크닉 잔디" },
  { id: "park:fountain", label: "작은 분수" },
  { id: "park:flowers", label: "공원 꽃밭" },
  { id: "park:dogrun", label: "강아지 산책길" },
  { id: "park:tree", label: "공원 나무" },
  { id: "park:bench", label: "공원 벤치" },
  { id: "park:lamp", label: "공원 가로등" },
];
const OBJECT_IMAGE_LABELS = new Map([
  ["bus:spa", "🚌 찜질스파행 버스"],
  ["bus:cotton", "🚌 솜사탕행 버스"],
  ...PARK_IMAGE_TARGETS.map((v) => [v.id, v.label]),
]);
const objectImageLabel = (id) => BUILDINGS.find((b) => b.id === id)?.name || OBJECT_IMAGE_LABELS.get(id) || (id === "spa:item:bill" ? "이용권" : id === "spa:item:key" ? "락커키" : "오브제");

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

const COTTON_ROOM = {
  id: "cotton", name: "구름솜사탕", emoji: "🍭", hint: "기계에서 원하는 색의 솜사탕을 직접 만들어보세요!",
  wallDark: "#fff0f7", play: { x0: 70, x1: 930, y0: 90, y1: 640 },
  blocks: [{x1:40,x2:960,y1:50,y2:78},{x1:40,x2:960,y1:652,y2:680},{x1:40,x2:68,y1:50,y2:680},{x1:932,x2:960,y1:50,y2:680}],
  zones: [{id:"cotton-machine",x:350,y:300,r:150,label:"솜사탕 기계 열기"},{id:"cotton-shelf",x:735,y:330,r:145,label:"진열대 보기"}],
};

/* ============================ 찜질스파 대형 맵 ============================ */
const SPA_W = 1800;
const SPA_H = 1200;
const SPA_ROOMS = ["spa1", "spa2", "spa3"];
const SPA_ENTRY_SCENE = "spaLobby";
const SPA_ROOM = (floor) => ({
  id: `spa${floor}`,
  name: `구름찜질스파 ${floor}F`,
  emoji: "🧖",
  hint: floor === 1 ? "목욕·샤워·사우나를 즐겨보세요." : floor === 2 ? "따뜻한 온천에서 쉬어가세요." : "찜질하고 식혜도 한 잔 해보세요.",
  wallDark: floor === 1 ? "#dce8ec" : floor === 2 ? "#dbeaf0" : "#eadfcf",
  play: { x0: 70, x1: SPA_W - 70, y0: 100, y1: SPA_H - 70 },
  start: floor === 1 ? {x: 160, y: 1050} : floor === 2 ? {x: 160, y: 1050} : {x: 160, y: 1050},
  blocks: [
    {x1:20,x2:SPA_W-20,y1:20,y2:70}, {x1:20,x2:SPA_W-20,y1:SPA_H-45,y2:SPA_H-10},
    {x1:20,x2:70,y1:20,y2:SPA_H-10}, {x1:SPA_W-70,x2:SPA_W-20,y1:20,y2:SPA_H-10},
    ...(floor===1 ? [
      /* 탈의실 → 샤워실: 벽 전체에 작은 출입구 하나 */
      {x1:610,x2:635,y1:120,y2:430}, {x1:610,x2:635,y1:500,y2:510},
      /* 샤워실 → 대욕장: 아래 벽에 한 곳만 통과 가능 */
      {x1:70,x2:1080,y1:510,y2:535}, {x1:1120,x2:1230,y1:510,y2:535},
    ] : []),
  ],
  zones: floor === 1 ? [
    {id:"spa2",x:1700,y:180,r:90,label:"2층으로"},
    {id:"exit",x:120,y:180,r:80,label:"스파 나가기"},
  ] : floor === 2 ? [
    {id:"spa1",x:1700,y:180,r:90,label:"1층으로"},
    {id:"spa3",x:1700,y:360,r:90,label:"3층으로"},
  ] : [
    {id:"spa2",x:1700,y:180,r:90,label:"2층으로"},
    {id:"exit",x:120,y:180,r:80,label:"스파 나가기"},
  ],
});
const SPA_ROOMS_MAP = { spa1: SPA_ROOM(1), spa2: SPA_ROOM(2), spa3: SPA_ROOM(3) };
const SPA_LOBBY_ROOM = { id:"spaLobby", name:"구름찜질스파 로비", emoji:"🧖", hint:"카운터에서 무엇을 하러 왔는지 말해보세요.", play:{x0:40,x1:1560,y0:40,y1:900}, start:{x:780,y:820}, zones:[], blocks:[{x1:20,x2:1580,y1:20,y2:55},{x1:20,x2:55,y1:20,y2:920},{x1:1565,x2:1600,y1:20,y2:920},{x1:20,x2:1565,y1:885,y2:920}] };

const roomFor = (id) => id === "cotton" ? COTTON_ROOM : id === SPA_ENTRY_SCENE ? SPA_LOBBY_ROOM : (SPA_ROOMS_MAP[id] || ROOMS[id]);


const SPA_LOBBY_LAYOUT_STORAGE_KEY = "ccSpaLobbyLayoutV2";
const SPA_LOBBY_DEFAULT_LAYOUT = {
  bubble: { x: 50, y: 22, w: 38 },
  bill: { x: 50, y: 48, s: 0.58 },
  key: { x: 50, y: 63, s: 0.58 },
  inventory: { x: 97, y: 3, s: 0.72 },
};

function readSpaLobbySavedLayout() {
  try {
    const v = JSON.parse(localStorage.getItem(SPA_LOBBY_LAYOUT_STORAGE_KEY) || "null");
    if (v && typeof v === "object") return {
      bubble: { ...SPA_LOBBY_DEFAULT_LAYOUT.bubble, ...(v.bubble || {}) },
      bill: { ...SPA_LOBBY_DEFAULT_LAYOUT.bill, ...(v.bill || {}) },
      key: { ...SPA_LOBBY_DEFAULT_LAYOUT.key, ...(v.key || {}) },
      inventory: { ...SPA_LOBBY_DEFAULT_LAYOUT.inventory, ...(v.inventory || {}) },
    };
    const oldBubble = JSON.parse(localStorage.getItem("ccSpaLobbyBubbleLayout") || "null");
    const oldItems = JSON.parse(localStorage.getItem("ccSpaLobbyItemLayout") || "null");
    return {
      bubble: { ...SPA_LOBBY_DEFAULT_LAYOUT.bubble, ...(oldBubble || {}) },
      bill: { ...SPA_LOBBY_DEFAULT_LAYOUT.bill, ...(oldItems?.bill || {}) },
      key: { ...SPA_LOBBY_DEFAULT_LAYOUT.key, ...(oldItems?.key || {}) },
      inventory: { ...SPA_LOBBY_DEFAULT_LAYOUT.inventory, ...(oldItems?.inventory || {}) },
    };
  } catch {
    return SPA_LOBBY_DEFAULT_LAYOUT;
  }
}

function SpaLobby({ balance = 0, onPay, onFloor, onExit, isHost = false, bubbleLayout, onBubbleLayout, itemLayout = {}, itemImages = {}, onItemLayout, inventoryLayout = null, onInventoryLayout, onSaveLayout, inventory = { bill:false, key:false }, onInventoryChange }) {
  const [step, setStep] = useState("welcome");
  const [message, setMessage] = useState("목욕하러 오셨나요?");
  const [typedMessage, setTypedMessage] = useState("");
  const [showBubbleSettings, setShowBubbleSettings] = useState(false);
  const [showItemSettings, setShowItemSettings] = useState(false);
  const typingRef = useRef(null);
  const [showBill, setShowBill] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [floorPicker, setFloorPicker] = useState(false);

  useEffect(() => {
    window.clearInterval(typingRef.current);
    setTypedMessage("");
    let i = 0;
    typingRef.current = window.setInterval(() => {
      i += 1;
      setTypedMessage(message.slice(0, i));
      if (i >= message.length) window.clearInterval(typingRef.current);
    }, 55);
    return () => window.clearInterval(typingRef.current);
  }, [message]);

  useEffect(() => {
    if (step !== "paid") return undefined;
    setShowBill(false);
    setShowKey(false);
    const billTimer = window.setTimeout(() => setShowBill(true), Math.max(350, message.length * 55 + 250));
    const keyTimer = window.setTimeout(() => setShowKey(true), Math.max(1200, message.length * 55 + 1050));
    return () => { window.clearTimeout(billTimer); window.clearTimeout(keyTimer); };
  }, [step, message]);

  useEffect(() => {
    if (inventory.bill && inventory.key) {
      const t = window.setTimeout(() => setStep("elevator"), 450);
      return () => window.clearTimeout(t);
    }
  }, [inventory.bill, inventory.key]);

  const no = () => { setMessage("안녕히 가세요."); setTimeout(onExit, 650); };
  const yes = () => { setMessage("한 분 맞으신가요?"); setStep("confirm"); };
  const confirm = () => {
    if (balance < 20) { setMessage("별이 부족하시네요."); setTimeout(onExit, 900); return; }
    onPay?.();
    onInventoryChange?.({ bill: false, key: false });
    setStep("paid");
    setMessage("그럼 안내해드리겠습니다.");
  };
  const collectItem = (kind) => {
    onInventoryChange?.({ ...inventory, [kind]: true });
    if (kind === "bill") setShowBill(false);
    if (kind === "key") setShowKey(false);
  };
  const chooseFloor = (id) => { setFloorPicker(false); onFloor?.(id); };
  const layout = bubbleLayout || { x: 50, y: 22, w: 38 };
  const bubbleStyle = { left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.w}%` };
  const setLayout = (key, value) => onBubbleLayout?.({ ...layout, [key]: Number(value) });
  const billLayout = itemLayout.bill || { x: 50, y: 48, s: 0.58 };
  const keyLayout = itemLayout.key || { x: 50, y: 63, s: 0.58 };
  const itemStyle = (kind) => {
    const l = kind === "bill" ? billLayout : keyLayout;
    return { left: `${l.x}%`, top: `${l.y}%`, transform: `translate(-50%,-50%) scale(${l.s})` };
  };

  return <div className="ccSpaLobby">
    <div className="ccLobbyPerspective ccLobbyPhoto" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}spa-lobby.png")` }}>
      {step !== "elevator" && <>
        <div className="ccLobbyBubble" style={bubbleStyle}>
          <div className="ccLobbyBubbleName">직원</div>
          <div className="ccLobbyBubbleText">{typedMessage}<span className="ccTypingCursor">▌</span></div>
          <span className="ccLobbyBubbleTail" />
        </div>

        {step === "paid" && <SpaInventory inventory={inventory} itemImages={itemImages} layout={inventoryLayout} />}

        {showBill && <button className="ccSpaPickupItem ccSpaBillPickup" style={itemStyle("bill")} onClick={() => collectItem("bill")} title="이용권을 인벤토리에 넣기">
          <img src={itemImages.bill || `${import.meta.env.BASE_URL}bill.png`} alt="이용권" />
          <span>이용권</span>
        </button>}
        {showKey && <button className="ccSpaPickupItem ccSpaKeyPickup" style={itemStyle("key")} onClick={() => collectItem("key")} title="락커키를 인벤토리에 넣기">
          <img src={itemImages.key || `${import.meta.env.BASE_URL}key.png`} alt="락커키" />
          <span>락커키</span>
        </button>}

        <div className="ccLobbyActions">
          {step === "welcome" && <div className="ccLobbyYesNo"><button onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{e.preventDefault();e.stopPropagation();yes();}}>네</button><button onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{e.preventDefault();e.stopPropagation();no();}}>아니오</button></div>}
          {step === "confirm" && <div className="ccLobbyYesNo"><button onPointerDown={(e)=>e.stopPropagation()} onClick={(e)=>{e.preventDefault();e.stopPropagation();confirm();}}>네</button></div>}
          {step === "paid" && !(inventory.bill && inventory.key) && <div className="ccSpaCollectHint">이용권과 락커키를 눌러 인벤토리에 넣어주세요.</div>}
        </div>
      </>}

      {isHost && step !== "elevator" && <>
        <button className="ccLobbyBubbleGear" onClick={()=>setShowBubbleSettings(v=>!v)} title="로비 관리">⚙ 관리</button>
        {showBubbleSettings && <div className="ccLobbyBubbleSettings ccLobbyManagePanel">
          <b>찜질스파 로비 관리</b>
          <div className="ccManageSection"><strong>직원 말풍선</strong>
            <label>가로 위치 <input type="range" min="10" max="90" value={layout.x} onChange={e=>setLayout("x",e.target.value)}/><span>{layout.x}%</span></label>
            <label>세로 위치 <input type="range" min="5" max="75" value={layout.y} onChange={e=>setLayout("y",e.target.value)}/><span>{layout.y}%</span></label>
            <label>크기 <input type="range" min="22" max="70" value={layout.w} onChange={e=>setLayout("w",e.target.value)}/><span>{layout.w}%</span></label>
          </div>
          <div className="ccManageSection"><strong>이용권</strong>
            <label>가로 위치 <input type="range" min="10" max="90" value={billLayout.x} onChange={e=>onItemLayout?.({ ...itemLayout, bill:{...billLayout,x:Number(e.target.value)} })}/><span>{billLayout.x}%</span></label>
            <label>세로 위치 <input type="range" min="15" max="85" value={billLayout.y} onChange={e=>onItemLayout?.({ ...itemLayout, bill:{...billLayout,y:Number(e.target.value)} })}/><span>{billLayout.y}%</span></label>
            <label>크기 <input type="range" min="0.25" max="1.1" step="0.01" value={billLayout.s} onChange={e=>onItemLayout?.({ ...itemLayout, bill:{...billLayout,s:Number(e.target.value)} })}/><span>{Math.round(billLayout.s*100)}%</span></label>
          </div>
          <div className="ccManageSection"><strong>락커키</strong>
            <label>가로 위치 <input type="range" min="10" max="90" value={keyLayout.x} onChange={e=>onItemLayout?.({ ...itemLayout, key:{...keyLayout,x:Number(e.target.value)} })}/><span>{keyLayout.x}%</span></label>
            <label>세로 위치 <input type="range" min="15" max="85" value={keyLayout.y} onChange={e=>onItemLayout?.({ ...itemLayout, key:{...keyLayout,y:Number(e.target.value)} })}/><span>{keyLayout.y}%</span></label>
            <label>크기 <input type="range" min="0.25" max="1.1" step="0.01" value={keyLayout.s} onChange={e=>onItemLayout?.({ ...itemLayout, key:{...keyLayout,s:Number(e.target.value)} })}/><span>{Math.round(keyLayout.s*100)}%</span></label>
          </div>
          <div className="ccManageSection"><strong>인벤토리</strong>
            <label>가로 위치 <input type="range" min="55" max="99" value={(inventoryLayout||{x:97}).x} onChange={e=>onInventoryLayout?.({ ...(inventoryLayout||{x:97,y:3,s:.72}), x:Number(e.target.value) })}/><span>{(inventoryLayout||{x:97}).x}%</span></label>
            <label>세로 위치 <input type="range" min="1" max="35" value={(inventoryLayout||{y:3}).y} onChange={e=>onInventoryLayout?.({ ...(inventoryLayout||{x:97,y:3,s:.72}), y:Number(e.target.value) })}/><span>{(inventoryLayout||{y:3}).y}%</span></label>
            <label>크기 <input type="range" min="0.35" max="1.25" step="0.01" value={(inventoryLayout||{s:.72}).s} onChange={e=>onInventoryLayout?.({ ...(inventoryLayout||{x:97,y:3,s:.72}), s:Number(e.target.value) })}/><span>{Math.round((inventoryLayout||{s:.72}).s*100)}%</span></label>
          </div>
          <small>말풍선·이용권·락커키·인벤토리의 위치와 크기는 호스트가 조절하고 저장할 수 있으며 게스트에게도 적용됩니다.</small>
          <button className="ccLobbyManageSave" onClick={()=>onSaveLayout?.()}>💾 위치·크기 저장</button>
        </div>}
      </>}

      {step === "elevator" && <div className="ccLobbyElevatorScene ccElevatorPhotoScene" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}elevator.png")` }}>
        <button className="ccElevatorSwitchHotspot" aria-label="엘리베이터 층 선택" onClick={()=>setFloorPicker(true)} />
        <div className="ccElevatorHint">버튼을 눌러서 이동하세요</div>
      </div>}
      {floorPicker && <div className="ccFloorPickerOverlay" onClick={()=>setFloorPicker(false)}><div className="ccFloorPicker" onClick={e=>e.stopPropagation()}><div className="ccFloorPickerBtns"><button onClick={()=>chooseFloor("spa3")}><strong>3층</strong><small>찜질 · 휴식</small></button><button onClick={()=>chooseFloor("spa2")}><strong>2층</strong><small>온천 · 스파</small></button><button onClick={()=>chooseFloor("spa1")}><strong>1층</strong><small>목욕 · 샤워 · 사우나</small></button></div><button className="ccMini" onClick={()=>setFloorPicker(false)}>닫기</button></div></div>}
      <button className="ccLobbyExit" onClick={onExit}>← 나가기</button>
    </div>
  </div>;
}

function CottonCanvasPlaceholder(){};

function CottonCanvas({ fibers, decorations = [], activeColor, decorateMode = false, selectedDecor = null, onDecor }) {
  const ref = useRef(null), size = 340;
  useEffect(() => {
    const canvas=ref.current; if(!canvas)return;
    const dpr=Math.min(2,window.devicePixelRatio||1); canvas.width=size*dpr;canvas.height=size*dpr;canvas.style.width=size+"px";canvas.style.height=size+"px";
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const cx=size/2,cy=size*.46,n=fibers.length,maxR=n?Math.min(126,12+Math.sqrt(n)*5.5):8;
    if(n){const g=ctx.createRadialGradient(cx,cy,4,cx,cy,maxR*1.08);g.addColorStop(0,"rgba(255,255,255,.96)");g.addColorStop(.55,"rgba(255,255,255,.65)");g.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,maxR*1.08,0,Math.PI*2);ctx.fill();}
    ctx.lineCap="round";ctx.lineJoin="round";ctx.filter="blur(1px)";
    fibers.slice(-720).forEach((f,j)=>{const progress=f.layer!=null?f.layer:Math.min(1,(j+1)/Math.max(1,n)),r=8+(maxR-8)*Math.pow(progress,.82),a=f.angle||0;ctx.strokeStyle=f.color||activeColor||"#ff8fbe";ctx.globalAlpha=.35;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,r,a-.12,a+.12);ctx.stroke();});
    ctx.filter="none";ctx.globalAlpha=1;
    decorations.forEach(d=>{const x=cx+(d.x/100-.5)*maxR*2,y=cy+(d.y/100-.5)*maxR*2;ctx.save();ctx.translate(x,y);ctx.rotate((d.r||0)*Math.PI/180);ctx.fillStyle=d.type==="star"?"#ffd45e":d.type==="bar"?"#ff8fb6":"#ff6f9e";ctx.strokeStyle="#5b4a63";ctx.lineWidth=2;
      if(d.type==="star"){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?8:18;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.stroke();}
      else if(d.type==="bar"){ctx.fillRect(-4,-14,8,28);ctx.strokeRect(-4,-14,8,28);}
      else {ctx.beginPath();ctx.arc(-7,-4,8,0,Math.PI*2);ctx.arc(7,-4,8,0,Math.PI*2);ctx.lineTo(0,14);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.restore();
    });
  },[fibers,decorations,activeColor]);
  const handleClick=e=>{if(!decorateMode||!selectedDecor||!onDecor)return;const r=ref.current.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;onDecor(selectedDecor,clamp(x,6,94),clamp(y,6,94));};
  return <canvas ref={ref} className={decorateMode?"ccCottonCanvas ccCottonCanvasDecor":"ccCottonCanvas"} onClick={handleClick}/>;
}

function SpaInventory({ inventory = { bill:false, key:false }, itemImages = {}, layout = null }) {
  const l = layout || { x: 97, y: 3, s: 0.72 };
  const style = { left: `${l.x}%`, top: `${l.y}%`, right: "auto", transform: `translate(-100%,0) scale(${l.s})`, transformOrigin: "top right" };
  return <div className="ccSpaInventory" style={style} aria-label="찜질스파 인벤토리">
    <div className="ccSpaInventoryTitle">INVENTORY</div>
    <div className="ccSpaInventorySlots">
      <div className={"ccSpaInventorySlot " + (inventory.bill ? "filled" : "")} title={inventory.bill ? "이용권" : "빈 칸"}>
        {inventory.bill && <img className="ccSpaInventoryThumb" src={itemImages.bill || `${import.meta.env.BASE_URL}bill.png`} alt="이용권" />}
      </div>
      <div className={"ccSpaInventorySlot " + (inventory.key ? "filled" : "")} title={inventory.key ? "락커키" : "빈 칸"}>
        {inventory.key && <img className="ccSpaInventoryThumb" src={itemImages.key || `${import.meta.env.BASE_URL}key.png`} alt="락커키" />}
      </div>
      <div className="ccSpaInventorySlot" />
      <div className="ccSpaInventorySlot" />
      <div className="ccSpaInventorySlot" />
      <div className="ccSpaInventorySlot" />
    </div>
  </div>;
}

function SpaFloor({ scene, player, peers, me, onFloor, onExit, onAction, inventory = { bill:false, key:false }, itemImages = {}, inventoryLayout = null }) {
  const floor = Number((scene || "spa1").replace("spa", "")) || 1;
  const hour = new Date().getHours();
  const night = hour >= 19 || hour < 6;
  const camX = clamp(player.x - 480, 0, SPA_W - 960);
  const camY = clamp(player.y - 340, 0, SPA_H - 680);
  const p = (x,y,w,h,cls,onClick,label,children) => (
    <button className={`ccSpaObj ${cls}`} style={{left:x,top:y,width:w,height:h}} onClick={onClick}>
      {children || <><b>{label}</b></>}
    </button>
  );
  const lockerCols = Array.from({length:12});
  const showerCols = Array.from({length:8});
  const hot = floor === 1 ? 41 : floor === 2 ? 40.5 : 38;
  const clouds = floor === 2 ? Array.from({length:10},(_,i)=>({x:400+(i*137)%980,y:330+(i*83)%430})) : [];
  const npcByFloor = floor === 1
    ? [{x:430,y:520,s:0},{x:900,y:470,s:1},{x:1180,y:730,s:2},{x:1470,y:710,s:3}]
    : floor === 2
      ? [{x:420,y:650,s:4},{x:900,y:720,s:1},{x:1320,y:430,s:5},{x:1480,y:780,s:2}]
      : [{x:340,y:610,s:3},{x:620,y:720,s:1},{x:1180,y:690,s:4},{x:1500,y:700,s:0},{x:820,y:470,s:5}];
  return <div className={"ccSpaRoom"+(night?" night":"")}>
    <div className="ccSpaHud">
      <div><b>🧖 구름찜질스파</b><span>{floor}층 · {floor===1?"목욕 / 샤워 / 사우나":floor===2?"온천 / 스파":"찜질 / 휴식 / 매점"}</span></div>
      <SpaInventory inventory={inventory} itemImages={itemImages} layout={inventoryLayout} />
      <div className="ccSpaFloors"><button className={floor===1?"on":""} onClick={()=>onFloor("spa1")}>1F</button><button className={floor===2?"on":""} onClick={()=>onFloor("spa2")}>2F</button><button className={floor===3?"on":""} onClick={()=>onFloor("spa3")}>3F</button><button onClick={onExit}>나가기</button></div>
    </div>
    <div className="ccSpaViewport">
      <div className="ccSpaMap" style={{width:SPA_W,height:SPA_H,transform:`translate(${-camX}px,${-camY}px)`}}>
        <div className="ccSpaCeiling" />
        <div className="ccSpaTitle">CLOUD JIMJIL SPA · {floor}F</div>
        <div className="ccSpaMapLabel ccSpaEntrance">ENTRANCE</div>
        {floor===1 && <>
          <div className="ccSpaArea lockerArea"><h3>👕 탈의실 / 락커</h3><div className="ccLockerGrid">{lockerCols.map((_,i)=><div key={i} className="ccLocker">{String(i+1).padStart(2,"0")}</div>)}</div><div className="ccBench">나무 벤치 · 거울 · 체중계 · 드라이어</div></div>
          <div className="ccSpaArea showerArea"><h3>🚿 샤워실</h3><div className="ccShowerGrid">{showerCols.map((_,i)=><div key={i} className="ccShower"><span>🚿</span><small>샴푸 · 바디워시</small></div>)}</div><div className="ccDrain">배수구　•　•　•　•　•</div></div>
          <div className="ccSpaArea bathArea"><h3>🛁 대욕장</h3><button className="ccBath bigBath" onClick={()=>onAction("♨️ 온탕에 몸을 담갔어요. 물 온도 41°C.")}><div className="ccWater"><span>♨</span><span>♨</span></div><b>{hot}°C 온탕</b></button><button className="ccBath smallBath cold" onClick={()=>onAction("❄ 냉탕은 생각보다 훨씬 차가워요!")}><b>❄ 냉탕<br/>17°C</b></button><button className="ccBath smallBath bubble" onClick={()=>onAction("🫧 거품이 보글보글 올라와요.")}><b>🫧 거품탕<br/>39°C</b></button><div className="ccBath smallBath med"><b>🌿 약탕<br/>40°C</b></div><div className="ccBath smallBath electric"><b>⚡ 전기탕<br/>38°C</b></div><div className="ccTowelRack">수건 · 바가지 · 물 온도계</div></div>
          <div className="ccSpaArea saunaArea"><h3>🔥 사우나 구역</h3><div className="ccSauna dry"><b>건식 사우나</b><span>86°C</span><div className="ccSaunaBench"/></div><div className="ccSauna kiln"><b>🔥 불가마</b><span>90°C</span><div className="ccFire"/></div><div className="ccSauna salt"><b>🧂 소금방</b><span>소금 결정 벽</span></div><div className="ccSauna clay"><b>🟤 황토방</b><span>따뜻한 황토 벽</span></div></div>
          {p(1120,1030,170,90,"ccSpaStairs",()=>onFloor("spa2"),"2층 온천으로")}
        </>}
        {floor===2 && <>
          <div className="ccSpaArea onsenMain" onClick={()=>onAction("♨️ 온천에 들어가니 몸이 따뜻하게 풀리는 느낌이에요.")}><h3>♨️ 대형 온천</h3><div className="ccOnsenWater">{clouds.map((c,i)=><i key={i} style={{left:c.x,top:c.y,animationDelay:`${i*.3}s`}}/>)}<b>40.5°C</b><span>돌계단 · 손잡이 · 온천석</span></div></div>
          <div className="ccSpaArea privateBath"><h3>🪨 개인 온천탕</h3>{[1,2,3].map(i=><div className="ccPrivateTub" key={i}><span>♨</span><small>{39+i/2}°C</small></div>)}</div>
          <div className="ccSpaArea carbonBath"><h3>🫧 탄산탕</h3><div className="ccBubbles">{Array.from({length:24},(_,i)=><i key={i} style={{left:`${5+(i*17)%90}%`,top:`${10+(i*29)%80}%`,animationDelay:`${(i%8)*.25}s`}}/>)}</div></div>
          <div className="ccSpaArea viewBath"><h3>🌙 유리창 온천</h3><div className="ccWindowScene"><span>☾</span><i>🌳</i><i>🌳</i></div><p>밤에는 달빛이 물에 비쳐요.</p></div>
          <div className="ccSpaArea waterStation"><h3>💧 온천수 마시는 곳</h3><div className="ccWaterCup">🥛 🥛 🥛</div><small>종이컵 · 정수기 · 수분 보충</small></div>
          {p(1120,1030,170,90,"ccSpaStairs",()=>onFloor("spa3"),"3층 찜질로")}
        </>}
        {floor===3 && <>
          <div className="ccSpaArea jjimMain"><h3>🧖 공용 찜질 휴게실</h3><div className="ccMatGrid">{Array.from({length:16},(_,i)=><div key={i} className="ccMat">{i%4===0?"🧖":""}</div>)}</div><div className="ccTV">📺　뉴스 / 예능　　🔊</div></div>
          <div className="ccSpaArea rooms3"><h3>🔥 찜질방</h3><div className="ccHeatRooms"><div>🟤<b>황토방</b></div><div>🧂<b>소금방</b></div><div>🧊<b>아이스방<br/>-5°C</b></div><div>⚫<b>숯방</b></div><div>🔥<b>불가마</b></div></div></div>
          <div className="ccSpaArea snackBar"><h3>🍳 매점</h3><div className="ccFoodShelf"><span>🥛 식혜</span><span>🥚 구운 계란</span><span>🍜 컵라면</span><span>🥤 이온음료</span><span>🍦 아이스크림</span><span>☕ 커피</span></div></div>
          <div className="ccSpaArea vending"><h3>🥤 자판기</h3><div className="ccVendingGrid">{["🥤","🧃","💧","☕","🍦","🥛"].map((x,i)=><button key={i} onClick={()=>onAction(`${x} 음료를 하나 골랐어요.`)}>{x}<small>1,500원</small></button>)}</div></div>
          <div className="ccSpaArea sleepArea"><h3>🛏️ 수면실</h3><div className="ccSleepBeds">{Array.from({length:8},(_,i)=><div key={i}>🛏️<small>{i<4?"남자":"여자"}</small></div>)}</div></div>
          <div className="ccSpaArea massage"><h3>💆 마사지 의자</h3><div className="ccMassageChairs">💺 💺 💺</div><button onClick={()=>onAction("마사지 의자에 앉았습니다. 지잉—")}>마사지 받기</button></div>
          <div className="ccSpaArea teaCorner"><h3>🥚 구운 계란 / 식혜</h3><button onClick={()=>onAction("식혜 한 컵과 구운 계란을 챙겼어요.")}>식혜 + 계란 먹기</button></div>
          {p(1120,1030,170,90,"ccSpaStairs",()=>onFloor("spa1"),"1층으로 내려가기")}
        </>}
        <div className="ccSpaInfo">{floor===1?"샤워 → 탕 → 사우나 순서로 천천히 즐겨보세요.":floor===2?"온천석에 앉아 쉬거나 개인탕에서 조용히 쉬어가세요.":"수건 머리에 두르고 식혜 하나 들고 편하게 쉬어보세요."}</div>
        <div className="ccSpaNpcLayer">{npcByFloor.map((n,i)=><div key={i} className="ccSpaNpc" style={{left:n.x,top:n.y}}><span>{["🧖","🧖‍♀️","🥤","😴","🧖","🥚"][n.s]}</span></div>)}</div>
        <div className="ccSpaPlayerLayer"><Avatar name={me.name} slot={me.slot} x={player.x} y={player.y} facing={1} moving={false} me look={me.look} skin={null}/>{peers.map(q=><Avatar key={q.id} name={q.name} slot={q.slot} x={q.x} y={q.y} facing={q.f||1} moving={!!q.m} me={false} look={q.lk} skin={null}/>)}</div>
      </div>
    </div>
  </div>;
}


function CottonShopRoom({step,color,powered,tufts,decor,shelf,nickname,onMachine,onColor,onPower,onStroke,onFinish,onDecor,onDone,confirm,onConfirm,onBack,guideOpen,onCloseGuide}) {
  const draw = useRef(false), ring = useRef(null);
  const lastAngle = useRef(null), travel = useRef(0);
  const [selectedDecor, setSelectedDecor] = useState(null);
  const [shelfIndex, setShelfIndex] = useState(null);
  const colors=[{id:"pink",n:"딸기",c:"#ff8fbe"},{id:"sky",n:"소다",c:"#8fdcff"},{id:"lemon",n:"레몬",c:"#ffe27a"},{id:"mint",n:"민트",c:"#9ce9c8"},{id:"grape",n:"포도",c:"#c4a4f4"}];
  const active=colors.find(x=>x.id===color)||colors[0];
  const pt=e=>{const r=ring.current?.getBoundingClientRect();if(!r)return null;const x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height*.48);return {d:Math.hypot(x,y),a:Math.atan2(y,x)};};
  const addThread=(p)=>{
    if(lastAngle.current!=null){let delta=p.a-lastAngle.current;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;travel.current+=Math.abs(delta);}
    lastAngle.current=p.a;
    const layer=Math.min(1,travel.current/(Math.PI*2*5));
    onStroke({color:active.c,angle:p.a,layer,turn:travel.current/(Math.PI*2),seed:Date.now()+Math.random()});
  };
  const down=e=>{if(!powered||step!=="machine")return;const p=pt(e);if(!p||p.d<95||p.d>155)return;draw.current=true;lastAngle.current=p.a;try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}addThread(p);};
  const move=e=>{if(!draw.current)return;const p=pt(e);if(!p||p.d<82||p.d>165)return;addThread(p);};
  const up=()=>{draw.current=false;lastAngle.current=null;};
  useEffect(()=>{if(step!=="machine"){travel.current=0;lastAngle.current=null;}if(step!=="decorate")setSelectedDecor(null);},[step]);
  return <div className="ccCottonRoom">
    <div className="ccCottonRoomTop"><div><div className="ccCottonRoomTitle">☁️ 구름솜사탕 가게</div><div className="ccCottonRoomSub">{step==="shop"?"기계에서 솜사탕을 만들어보세요":step==="machine"?"색을 고르고 전원을 켠 뒤 스테인리스 원을 따라 천천히 빙글빙글!":"스프링클을 선택한 뒤 솜사탕 위를 클릭해보세요!"}</div></div><button className="ccCottonBack" onClick={onBack}>← 나가기</button></div>
    {step==="shop"&&<div className="ccCottonShopScene ccCottonShop3D"><button className="ccCottonBigObject ccCottonMachineDisplay" onClick={onMachine}><div className="ccObjectShadow"/><div className="ccCottonMachineIcon"><span className="ccMachineBowl"/><span className="ccMachinePole"/></div><b>솜사탕 기계</b><small>눌러서 만들기</small></button><button className="ccCottonShelfObject ccCottonShelfDisplay" onClick={()=>shelf?.length&&setShelfIndex(0)}><div className="ccShelfCanopy">☁️ 솜사탕 진열대</div><div className="ccShelfRows">{[0,1,2].map(r=><div className="ccShelfRow" key={r}>{[0,1,2].map(i=><div className="ccShelfSlot" key={i}>{shelf?.[r*3+i]&&<span className="ccMiniCotton" style={{background:shelf[r*3+i].color}}/>}</div>)}</div>)}</div><small>{shelf?.length?`${shelf.length}개 진열됨 · 눌러서 보기`:"아직 진열된 솜사탕이 없어요"}</small></button></div>}
    {step==="machine"&&<div className="ccCottonMachineStage"><div className="ccCottonColorBar"><b>색상</b>{colors.map(c=><button key={c.id} className={"ccCottonColor"+(color===c.id?" on":"")} style={{background:c.c}} onClick={()=>onColor(c.id)} title={c.n}/>)}<span>설탕실 {tufts.length}회</span></div><div className={"ccCottonMachine"+(powered?" powered":"")}><div className="ccMachineLabel">CLOUD COTTON · {powered ? "설탕실이 회전판에서 날리고 있어요" : "전원을 켜주세요"}</div><div ref={ring} className="ccMachineRingArea" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><div className={"ccSteelRing" + (powered ? " spinning" : "")}><div className="ccSteelHole"/></div><CottonCanvas fibers={tufts} activeColor={active.c}/><div className="ccCottonStick"/></div><div className="ccPowerRow"><button className={"ccPowerBtn"+(powered?" on":"")} onClick={onPower}>{powered?"⏻ 작동 중":"⏻ 전원"}</button><span>{powered?"원형을 따라 천천히 돌리면 중심에서 바깥으로 실이 감겨요":"먼저 전원을 켜주세요"}</span></div></div><button className="ccBtn ccCottonFinish" disabled={tufts.length<8} onClick={onFinish}>솜사탕 완성 → 꾸미기</button></div>}
    {step==="decorate"&&<div className="ccCottonDecorStage"><div className="ccDecorPreview"><div className="ccDecorCottonWrap"><CottonCanvas fibers={tufts} decorations={decor} activeColor={active.c} decorateMode={true} selectedDecor={selectedDecor} onDecor={onDecor}/><div className="ccDecorStick"/><div className="ccCottonOwnerName">{nickname || "손님"}</div></div></div><div className="ccDecorPanel"><h3>✨ 솜사탕 꾸미기</h3><p>{selectedDecor?"선택한 스프링클을 솜사탕 위 원하는 곳에 클릭하세요.":"먼저 스프링클을 하나 선택하세요."}</p><div className="ccDecorButtons"><button className={selectedDecor==="star"?"ccDecorSelected":""} onClick={()=>setSelectedDecor("star")}>★ 별모양 스프링클</button><button className={selectedDecor==="bar"?"ccDecorSelected":""} onClick={()=>setSelectedDecor("bar")}>▮ 길쭉한 네모 스프링클</button><button className={selectedDecor==="heart"?"ccDecorSelected":""} onClick={()=>setSelectedDecor("heart")}>♥ 하트 스프링클</button></div><div className="ccDecorCount">장식 {decor.length}개{selectedDecor?` · ${selectedDecor} 선택됨`:""}</div><button className="ccBtn ccCottonDone" onClick={onDone}>완료</button></div></div>}
    {confirm&&<div className="ccCottonConfirmWrap"><div className="ccCottonConfirm ccPanel"><div className="ccCottonConfirmIcon">🍭</div><h2>진열하시겠습니다?</h2><p>완성한 솜사탕을 가게 진열대에 올릴까요?</p><div className="ccCottonConfirmBtns"><button className="ccBtn" onClick={()=>onConfirm(true)}>예, 진열할게요</button><button className="ccMini" onClick={()=>onConfirm(false)}>아니오, 그냥 나가기</button></div></div></div>}
    {step==="shop"&&shelfIndex!==null&&shelf?.length>0&&<div className="ccShelfViewer" onClick={()=>setShelfIndex(null)}><div className="ccShelfViewerCard" onClick={e=>e.stopPropagation()}><button className="ccShelfClose" onClick={()=>setShelfIndex(null)}>×</button><h2>🍭 진열된 솜사탕</h2><div className="ccShelfViewerStage"><button className="ccShelfArrow" onClick={()=>setShelfIndex(i=>(i-1+shelf.length)%shelf.length)}>‹</button><div className="ccDisplayCottonWrap"><div className="ccDisplayCotton" style={{background:shelf[shelfIndex ?? 0]?.color||"#ff8fbe"}}/><div className="ccDisplayStick"/><div className="ccDisplayName">{shelf[shelfIndex ?? 0]?.name||"손님"}</div></div><button className="ccShelfArrow" onClick={()=>setShelfIndex(i=>(i+1)%shelf.length)}>›</button></div><div className="ccShelfPage">{(shelfIndex??0)+1} / {shelf.length}</div></div></div>}
    {guideOpen&&<div className="ccCottonGuideOverlay"><div className="ccCottonGuide"><div className="ccCottonGuideIcon">🍭</div><h2>솜사탕 만들기</h2><p>흰색 부분을 따라<br/><b>원을 그리며 천천히 움직여보세요!</b></p><div className="ccGuideCircle">↻</div><button className="ccBtn" onClick={onCloseGuide}>알겠어요!</button></div></div>}
  </div>;
}

/* ============================ 건물 이미지 관리 팝업 ============================ */
function ObjectImageSheet({ objectImages = {}, target, setTarget, onApply, onReset, onClose, isHost }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(objectImages[target] || null);
  useEffect(() => { setPreview(objectImages[target] || null); }, [target, objectImages]);
  const pick = async (file) => {
    if (!file || !isHost) return;
    setBusy(true);
    try {
      const data = await removePhotoBackground(file);
      setPreview(data);
      await onApply(target, data);
    } catch { /* handled by caller */ }
    finally { setBusy(false); }
  };
  return (
    <div className="ccPanel ccObjectSheet" onClick={e=>e.stopPropagation()}>
      <div className="ccObjectSheetHead">
        <div><b>🏠 건물 · 🚌 버스 · 🌳 공원 이미지 관리</b><small>호스트만 변경할 수 있어요</small></div>
        <button className="ccMini" onClick={onClose}>×</button>
      </div>
      <select className="ccObjectSheetSelect" value={target} onChange={e=>setTarget(e.target.value)}>
        <optgroup label="건물">
          {BUILDINGS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </optgroup>
        <optgroup label="버스">
          <option value="bus:spa">🚌 찜질스파행</option>
          <option value="bus:cotton">🚌 솜사탕행</option>
        </optgroup>
        <optgroup label="찜질스파 아이템">
          <option value="spa:item:bill">🎫 이용권</option>
          <option value="spa:item:key">🔑 락커키</option>
        </optgroup>
        <optgroup label="구름공원">
          {PARK_IMAGE_TARGETS.map(v=><option key={v.id} value={v.id}>🌳 {v.label}</option>)}
        </optgroup>
      </select>
      <div className="ccObjectSheetPreview">
        {preview ? <img src={preview} alt="미리보기"/> : <div className="ccObjectSheetEmpty">현재 기본 이미지 사용 중</div>}
      </div>
      <label className="ccObjectSheetUpload">
        {busy ? "누끼 따는 중…" : "📷 사진 올리기 · 자동 누끼"}
        <input type="file" accept="image/*" disabled={!isHost || busy} onChange={e=>{const f=e.target.files?.[0]; e.target.value=""; pick(f);}} />
      </label>
      {objectImages[target] && <button className="ccObjectSheetReset" onClick={()=>{onReset(target);setPreview(null);}}>기본 이미지로 되돌리기</button>}
      <p className="ccObjectSheetHint">사진의 바깥 배경을 자동으로 투명하게 만든 뒤 건물에 적용합니다. 적용 결과는 접속 중인 게스트에게도 보여요.</p>
    </div>
  );
}

/* 사진 가장자리의 배경색을 기준으로 연결된 배경을 투명하게 만드는 간단한 자동 누끼 */
function removePhotoBackground(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 520;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
        const im=ctx.getImageData(0,0,w,h), d=im.data;
        const samples=[];
        for(const [x,y] of [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1]]){
          const i=(y*w+x)*4; samples.push([d[i],d[i+1],d[i+2]]);
        }
        const bg=samples.reduce((a,v)=>[a[0]+v[0],a[1]+v[1],a[2]+v[2]],[0,0,0]).map(v=>v/samples.length);
        const dist=(i)=>Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);
        const seen=new Uint8Array(w*h), q=[];
        const push=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const n=y*w+x;if(seen[n])return; if(dist(n*4)>58)return; seen[n]=1;q.push(n);};
        for(let x=0;x<w;x++){push(x,0);push(x,h-1)}
        for(let y=0;y<h;y++){push(0,y);push(w-1,y)}
        let head=0;
        while(head<q.length){const n=q[head++],x=n%w,y=(n/w)|0; for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])push(x+dx,y+dy)}
        for(const n of q)d[n*4+3]=0;
        ctx.putImageData(im,0,0);
        resolve(c.toDataURL('image/webp',0.78));
      };
      img.onerror=reject; img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ============================ 건물 ============================ */

function Building({ b, near, objectImages = {} }) {
  const sp = BUILDING_SPRITES[b.sprite || b.id];
  const w = 24 * b.scale;
  const h = 22 * b.scale;
  return (
    <div className="ccBuilding" style={{ left: b.x - w / 2, top: b.y - h, width: w }}>
      {objectImages[b.id] ? (
        <img src={objectImages[b.id]} alt="" className="ccBuildingCustomImage" />
      ) : b.id === "cotton" ? (
        <div className={"ccCottonShop" + (near ? " ccNear" : "")}>
          <div className="ccCottonRoof">🍭</div>
          <div className="ccCottonAwning"><i /><i /><i /><i /><i /></div>
          <div className="ccCottonBody">
            <div className="ccCottonWindow" />
            <div className="ccCottonDoor" />
          </div>
        </div>
      ) : b.id === "spa" ? (
        <div className={"ccSpaExterior" + (near ? " ccNear" : "")}>
          <div className="ccSpaExtRoof">🧖 구름찜질스파</div>
          <div className="ccSpaExtWindows"><i/><i/><i/><i/></div>
          <div className="ccSpaExtDoor">자동문</div>
          <div className="ccSpaExtSign">24H · 1F 목욕 · 2F 온천 · 3F 찜질</div>
        </div>
      ) : (
        <Pix map={sp.map} palette={sp.palette} scale={b.scale} cacheKey={"b-" + (b.sprite || b.id)} className={near ? "ccNear" : ""} />
      )}
      <div className="ccSign">
        {b.emoji} {b.name}
      </div>
      {near && <div className="ccPrompt">SPACE 로 들어가기</div>}
    </div>
  );
}

/* ============================ 캐릭터 ============================ */

function Avatar({ name, slot, x, y, facing, moving, me, msg, scale = 1, swim = false, waiting = false, hold = null, slide = false, look = null, skin = null, lie = false, bounce = false, mic = false, singing = false }) {
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
      {msg && <div className={"ccBubble" + (singing ? " ccBubbleSinging" : "")}>{msg}</div>}
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
      {mic && <div className="ccHeldMic" aria-hidden="true"><span className="ccHeldMicCloud" /><span className="ccHeldMicStem" /></div>}
    </div>
  );
}


/* ============================ 조이스틱 ============================ */

const STICK_R = 58;     // 손잡이가 움직일 수 있는 반경 (v5 확대)
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


function AsphaltConnector(){
  return <div className="ccAsphaltConnector" aria-hidden="true"><div className="ccRoadCenter"/><div className="ccRoadEdge left"/><div className="ccRoadEdge right"/></div>;
}

function ParkGround({ objectImages = {} }){
  const img = (id, cls) => objectImages[id] ? <img src={objectImages[id]} alt="" className={`ccParkCustomImage ${cls || ""}`} /> : null;
  return <div className="ccParkGround" aria-label="구름공원">
    <div className="ccParkSign">{img("park:sign", "sign") || <><span>🌳 구름공원</span> <small>Cloud Park</small></>}</div>
    <div className="ccParkPond">{img("park:pond", "pond") || <><span>🦆</span><i/><i/><i/></>}</div>
    <div className="ccParkGazebo">{img("park:gazebo", "gazebo") || <><div className="roof">⛺</div><div className="posts">▥　▥　▥</div><b>그늘 정자</b></>}</div>
    <div className="ccParkPlayground">{img("park:playground", "playground") || <><div className="slide">🛝</div><div className="swing">♜</div><b>어린이 놀이터</b></>}</div>
    <div className="ccParkPicnic">{img("park:picnic", "picnic") || <><span>🧺</span><span>🧺</span><b>피크닉 잔디</b></>}</div>
    <div className="ccParkFountain">{img("park:fountain", "fountain") || <>⛲<small>작은 분수</small></>}</div>
    <div className="ccParkFlowers">{img("park:flowers", "flowers") || <>🌷 🌼 🌷 🌼 🌷</>}</div>
    <div className="ccParkDogRun">{img("park:dogrun", "dogrun") || <>🐕　🐕<small>강아지 산책길</small></>}</div>
    {PARK_DECO.map((d,i)=><div key={i} className={`ccParkDeco ${d.t}`} style={{left:d.x,top:d.y}}>{objectImages[`park:${d.t}`] ? <img src={objectImages[`park:${d.t}`]} alt="" className={`ccParkCustomImage deco-${d.t}`} /> : d.t==='tree'?'🌳':d.t==='bench'?'🪑':'💡'}</div>)}
  </div>;
}

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

      {/* 오른쪽 윗섬 */}
      {SOIL4.map((r, i) => slab(r, "s4" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND4.map((r, i) => slab(r, "i4" + i, { background: C.edge }))}
      {ISLAND4.map((r, i) =>
        slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g4" + i, {
          backgroundImage: `url(${grass})`,
          backgroundSize: "48px 48px",
        })
      )}
      {PATHS4.map((r, i) =>
        slab(r, "p4" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" })
      )}

      {/* 오른쪽 아랫섬 */}
      {SOIL5.map((r, i) => slab(r, "s5" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND5.map((r, i) => slab(r, "i5" + i, { background: C.edge }))}
      {ISLAND5.map((r, i) =>
        slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g5" + i, {
          backgroundImage: `url(${grass})`,
          backgroundSize: "48px 48px",
        })
      )}
      {PATHS5.map((r, i) =>
        slab(r, "p5" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" })
      )}

      {/* 구름카페 아래 새 공원 섬 */}
      {SOIL6.map((r, i) => slab(r, "s6" + i, { background: i % 2 ? C.soilDark : C.soil }))}
      {ISLAND6.map((r, i) => slab(r, "i6" + i, { background: C.edge }))}
      {ISLAND6.map((r, i) => slab({ x: r.x, y: r.y, w: r.w, h: Math.max(0, r.h - 8) }, "g6" + i, { backgroundImage: `url(${grass})`, backgroundSize: "48px 48px" }))}
      {PATHS6.map((r, i) => slab(r, "p6" + i, { backgroundImage: `url(${road})`, backgroundSize: "48px 48px" }))}
      <div className="ccParkConnectorRoad" style={{ backgroundImage: `url(${road})`, backgroundSize: "48px 48px" }} />
      <div className="ccSpaCottonRoad" />

      {/* 기존 섬과 오른쪽 새 섬을 잇는 다리 */}
      <div className="ccBridge" style={{ left: 1450, top: 485, width: 190, height: 42 }} />
      <div className="ccBridge" style={{ left: 1400, top: 2310, width: 240, height: 42 }} />

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
  const [nearBusId, setNearBusId] = useState(null);
  const [busState, setBusState] = useState(() => Object.fromEntries(BUS_IDS.map(id => [id, { status: "idle", riderId: null, riderName: "" }])));
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
      const n = (roomFor(id)?.stars || []).length;
      if (n) out[id] = unbits(str, n);
    });
    return out;
  });
  const [holding, setHolding] = useState(null);   // 들고 있는 메뉴
  const [broken, setBroken] = useState([]);  // 뿌셔진 왁뿌볼
  const [pressed, setPressed] = useState([]); // 눌린 키보드 키
  const [quizMode, setQuizMode] = useState("solo");   // 퀴즈상가 개인전 / 팀전
  const [cottonStep, setCottonStep] = useState("shop");
  const [cottonColor, setCottonColor] = useState("pink");
  const [cottonPowered, setCottonPowered] = useState(false);
  const [cottonTufts, setCottonTufts] = useState([]);
  const [cottonDecor, setCottonDecor] = useState([]);
  const [cottonShelf, setCottonShelf] = useState([]);
  const [cottonConfirm, setCottonConfirm] = useState(false);
  const [cottonGuideOpen, setCottonGuideOpen] = useState(false);
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
  const QUEST_PROGRESS_VERSION = 3;
  const [quests, setQuests] = useState(() => {
    try {
      const version = Number(localStorage.getItem("ccQuestsVersion") || 0);
      const v = JSON.parse(localStorage.getItem("ccQuests"));
      const valid = new Set(QUESTS.map((q) => q.id));
      const list = Array.isArray(v) ? v.filter((id) => valid.has(id)) : [];
      /* 이전 버전에서 이 3개는 '입장/착석'만으로 잘못 체크될 수 있었으므로
         실제 행동 판정으로 바꾸면서 해당 체크만 무효화합니다. 나머지 진행도는 유지합니다. */
      if (version !== QUEST_PROGRESS_VERSION) {
        localStorage.setItem("ccQuestsVersion", String(QUEST_PROGRESS_VERSION));
        return list.filter((id) => !["cafeTalk", "movie", "arcade"].includes(id));
      }
      return list;
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
  const [setSection, setSetSection] = useState("font"); // 설정 아코디언
  const [riding, setRiding] = useState(false);     // 미끄럼틀 타는 중
  const [lying, setLying] = useState(false);       // 천문대에서 눕기
  const [bouncing, setBouncing] = useState(false); // 방방 위에서 통통
  const [talk, setTalk] = useState(null);          // 앉았을 때 오가는 말 { who, text }
  const [staffPos, setStaffPos] = useState(null);  // 직원이 걸어다니는 자리
  const [staffWalk, setStaffWalk] = useState(false);
  const [skins, setSkins] = useState([]);
  const [objectImages, setObjectImages] = useState(() => {
    try { const v = JSON.parse(localStorage.getItem("ccObjectImages") || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  });
  const [spaLobbySavedLayout] = useState(() => readSpaLobbySavedLayout());
  const [spaLobbyBubbleLayout, setSpaLobbyBubbleLayout] = useState(() => spaLobbySavedLayout.bubble);
  const [spaLobbyItemLayout, setSpaLobbyItemLayout] = useState(() => ({ bill: spaLobbySavedLayout.bill, key: spaLobbySavedLayout.key }));
  const [spaInventoryLayout, setSpaInventoryLayout] = useState(() => spaLobbySavedLayout.inventory);
  // Realtime getPose는 연결 시점의 클로저를 계속 사용할 수 있으므로
  // 로비 관리값은 ref에도 항상 최신 상태를 보관합니다.
  const spaLobbyBubbleLayoutRef = useRef(spaLobbySavedLayout.bubble);
  const spaLobbyItemLayoutRef = useRef({ bill: spaLobbySavedLayout.bill, key: spaLobbySavedLayout.key });
  const spaInventoryLayoutRef = useRef(spaLobbySavedLayout.inventory);
  const [spaInventory, setSpaInventory] = useState({ bill: false, key: false });
  const [objectImageTarget, setObjectImageTarget] = useState(BUILDINGS[0]?.id || "cake");          // 호스트가 올린 캐릭터 이미지
  const [live, setLive] = useState(true);          // 실시간 연결 상태
  const [movie, setMovie] = useState(null);        // 지금 상영 중인 것
  const [muted2, setMuted2] = useState(true);
  const [karaoke, setKaraoke] = useState(null);   // 모두에게 보이는 YouTube 노래방
  const [karaokeMic, setKaraokeMic] = useState(null); // 내가 잡은 마이크 번호(0/1)
  const [karaokeRemoteLayout, setKaraokeRemoteLayout] = useState({ x: 50, y: 62, w: 128, h: 194 });
  const [karaokeMicLayout, setKaraokeMicLayout] = useState([
    { x: 43, y: 91, s: 1 },
    { x: 57, y: 91, s: 1 },
  ]);
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
  const [bgmStatus, setBgmStatus] = useState("");

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
  // 버스 탑승 중에는 React state 렌더 주기와 무관하게 화면/버스를 매 프레임 직접 갱신합니다.
  const worldDomRef = useRef(null);
  const cloudDomRef = useRef(null);
  const keys = useRef({});
  const nearRef = useRef(null);
  const nearBusRef = useRef(null);
  const busStateRef = useRef(busState);
  const ridingBusRef = useRef(null);
  const busTickAt = useRef(0);
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
  const bgmUnlockedRef = useRef(false);
  const bgmUrlRef = useRef("");
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
  const karaokeMicRef = useRef(null);
  const karaokeRemoteRef = useRef(karaokeRemoteLayout);
  const karaokeMicLayoutRef = useRef(karaokeMicLayout);
  const karaokeLayerRef = useRef(null);
  const karaokeDragRef = useRef(null);
  const karaokeSuppressClickRef = useRef(false);
  const myMsgTimer = useRef(null);

  useEffect(() => { openRef.current = !!sheet; sheetRef.current = sheet; }, [sheet]);
  useEffect(() => { viewRef.current = { ...view, z: zoom }; }, [view, zoom]);
  useEffect(() => { starsRef.current = stars; }, [stars]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { brokenRef.current = broken; }, [broken]);
  useEffect(() => { pressedRef.current = pressed; }, [pressed]);
  useEffect(() => { busStateRef.current = busState; }, [busState]);
  useEffect(() => { welcomeRef.current = welcome; }, [welcome]);
  useEffect(() => { lookRef.current = look; }, [look]);
  useEffect(() => { karaokeMicRef.current = karaokeMic; }, [karaokeMic]);
  useEffect(() => { karaokeRemoteRef.current = karaokeRemoteLayout; }, [karaokeRemoteLayout]);
  useEffect(() => { karaokeMicLayoutRef.current = karaokeMicLayout; }, [karaokeMicLayout]);
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
  const hostStars = me.role === "host" ? 30000 : 0;
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
  const startSeatTalk = useCallback((roomId, chair, done) => {
    const pool = SEAT_TALK[roomId];
    if (!pool?.length) return;
    const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
    const script = pick.flatMap((t) => [{ who: "s", text: t.s }, { who: "m", text: t.m }]);

    let delay = 700;
    const home = roomFor(roomId)?.staff;
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
      done?.();
    });
  }, [runTalk]);

  /* 한 테이블에 둘이 앉으면 저희끼리 스몰토크 */
  const startPairTalk = useCallback((myChair, mateChair, done) => {
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
      900,
      done
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
      localStorage.setItem("ccQuestsVersion", String(QUEST_PROGRESS_VERSION));
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
    if (!roomFor(id)) return;
    worldPos.current = { ...posRef.current };
    sceneRef.current = id;
    const roomDef = roomFor(id);
    const st = roomDef.staff ? { ...roomDef.staff } : null;
    staffRef.current = st;
    staffTo.current = st;
    setStaffPos(st);
    const start = id === "cotton" ? { x: 500, y: 600 } : ((SPA_ROOMS.includes(id) || id === SPA_ENTRY_SCENE) ? roomDef.start : { x: ROOM.w / 2, y: ROOM.d - 60 });
    posRef.current = start;
    setPos(start);
    setScene(id);
    setSheet(null);
    setToast(`${roomDef.emoji} ${roomDef.name} — ${roomDef.hint}`);
    if (UP_ROOMS.includes(id)) doQuestRef.current?.("up");
  }, []);

  const changeSpaFloor = useCallback((id) => {
    if (!SPA_ROOMS.includes(id)) return;
    const roomDef = roomFor(id);
    sceneRef.current = id;
    zoneRef.current = null;
    setZoneId(null);
    posRef.current = { ...roomDef.start };
    setPos({ ...roomDef.start });
    setScene(id);
    setToast(`${roomDef.emoji} ${roomDef.name}에 도착했어요.`);
    if (id === "spa1") doQuestRef.current?.("spa");
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
      const room0 = roomFor(sceneRef.current);
      const c = (room0?.chairs || CHAIRS).find((x) => x.i === sitRef.current);
      if (!c) { sitRef.current = null; setSit(null); return; }
      sitRef.current = null;
      setSit(null);
      clearSeatTalk();
      pairRef.current = null;
      const back0 = roomFor(sceneRef.current)?.staff;
      if (back0) staffTo.current = { ...back0 };
      const room = roomFor(sceneRef.current);
      const back = room ? freeSpot(room, c.x, c.y) : { x: c.x, y: c.y + 60 };
      posRef.current = back;
      setPos(back);
      return;
    }
    if (!id) return;
    if (id === "exit") { exitRoom(); return; }
    if (id === "cotton-machine") { setCottonStep("machine"); setCottonPowered(false); setCottonTufts([]); setCottonDecor([]); blip(760); return; }
    if (id === "cotton-shelf") { setToast(`🍭 진열대에 ${cottonShelf.length}개의 솜사탕이 있어요.`); return; }
    if (id === "spaLobby") { enterRoom(SPA_ENTRY_SCENE); return; }
    if (id === "spa1" || id === "spa2" || id === "spa3") { changeSpaFloor(id); return; }
    if (id === "dress") loadSkins();
    if (id === "arcade" || id === "starview" || id === "showtime" || id === "songs") {
      if (id === "arcade") doQuest("arcade");
      setSheet(id);
      return;
    }
    if (id === "lie") {
      if (sceneRef.current === "star") doQuest("stargaze");
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
      const room1 = roomFor(sceneRef.current);
      const c = (room1?.chairs || CHAIRS).find((x) => x.i === i);
      if (!c) return;
      sitRef.current = i;
      setSit(i);
      posRef.current = { x: c.x, y: c.y };
      setPos({ x: c.x, y: c.y });
      blip(760);
      startSeatTalk(sceneRef.current, i, () => {
        if (sceneRef.current === "cafe") doQuest("cafeTalk");
      });
      if (sceneRef.current === "cake") doQuest("sit");
      return;
    }
    setSheet(id);
  }, [exitRoom, doQuest, startSeatTalk, clearSeatTalk, loadSkins, cottonShelf.length, changeSpaFloor]);

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
    startPairTalk(sit, key, () => doQuest("cafeTalk"));
  }, [scene, sit, peerView, startPairTalk]);

  const openBuilding = useCallback((id) => {
    // 찜질스파 외부 건물은 실제 내부 씬이 spa가 아니라 1층(spa1)으로 시작합니다.
    if (id === "spa") { enterRoom(SPA_ENTRY_SCENE); return; }
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

  const boardBus = useCallback((bid) => {
    if (!bid || sceneRef.current || ridingBusRef.current) return;
    const bs = busStateRef.current[bid];
    const route = BUS_ROUTES[bid];
    if (!route) return;
    if (bs?.status === "idle") {
      const next = { status: "toDest", riderId: deviceId(), riderName: me.name, startedAt: Date.now() };
      busStateRef.current = { ...busStateRef.current, [bid]: next };
      setBusState(busStateRef.current);
      sceneRef.current = null;
      posRef.current = { ...route.start };
      setPos({ ...route.start });
      const vw0 = (viewRef.current.w || 1100) / (viewRef.current.z || 1);
      const vh0 = (viewRef.current.h || 720) / (viewRef.current.z || 1);
      camRef.current = {
        x: clamp(route.start.x - vw0 / 2, 0, Math.max(0, WORLD.w - vw0)),
        y: clamp(route.start.y - vh0 / 2 - 40 / (viewRef.current.z || 1), 0, Math.max(0, WORLD.h - vh0)),
      };
      setCam(camRef.current);
      ridingBusRef.current = bid;
      setRiding(true);
      setToast(`🚌 ${route.label} 버스가 출발합니다! 부우웅~`);
      chanRef.current?.fx({ t: "busBoard", busId: bid, riderId: deviceId(), riderName: me.name, startedAt: next.startedAt });
    } else if (bs?.riderId && bs.riderId !== deviceId()) {
      setToast("🚌 다른 손님이 버스를 이용 중이에요.");
    } else if (bs?.status === "toDest" && bs?.riderId === deviceId()) {
      setToast("🚌 이미 버스에 탑승 중이에요.");
    }
  }, [me.name]);

  /* PC의 SPACE와 모바일 액션 버튼이 완전히 같은 동작을 사용합니다.
     모바일 브라우저/인앱 브라우저에서 pointer 이벤트가 누락되는 경우를 대비해
     터치도 직접 처리하고, 한 번의 터치가 두 번 실행되지 않도록 짧은 가드를 둡니다. */
  const mobileActionLockRef = useRef(false);
  const performPrimaryAction = useCallback(() => {
    if (sheetRef.current) { setSheet(null); return; }
    if (!sceneRef.current && nearBusRef.current) {
      boardBus(nearBusRef.current);
      return;
    }
    if (sceneRef.current) {
      activateZone(zoneRef.current);
      return;
    }
    if (nearRef.current) openBuilding(nearRef.current);
  }, [boardBus, activateZone, openBuilding]);

  const performMobilePrimaryAction = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (mobileActionLockRef.current) return;
    mobileActionLockRef.current = true;
    performPrimaryAction();
    window.setTimeout(() => { mobileActionLockRef.current = false; }, 280);
  }, [performPrimaryAction]);

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
        performPrimaryAction();
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
  }, [performPrimaryAction, closeWelcome]);

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

  /* 게임 루프 — 마을과 방 안 모두 여기서 돕니다. 버스/카메라는 매 프레임 DOM도 직접 갱신합니다. */
  useEffect(() => {
    let raf;
    let last = performance.now();
    const worldBoxes = [...BUILDINGS.map(blockBox), ...PARK_BLOCKS, { x1: 2160, x2: 2340, y1: 780, y2: 2110 }];
    const R = 14;

    const step = (now) => {
      const wallNow = Date.now();
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      const k = keys.current;
      const roomId = sceneRef.current;
      const room = roomId ? roomFor(roomId) : null;

      let dx = 0;
      let dy = 0;
      if (k.arrowleft || k.a) dx -= 1;
      if (k.arrowright || k.d) dx += 1;
      if (k.arrowup || k.w) dy -= 1;
      if (k.arrowdown || k.s) dy += 1;
      const st = stick.current;
      if (st.x || st.y) { dx = st.x; dy = st.y; }
      if (openRef.current || sitRef.current != null || rideRef.current || lyingRef.current || ridingBusRef.current) { dx = 0; dy = 0; }

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
        const roadAttemptX = !room && nx >= 2160 && nx <= 2340 && y >= 780 && y <= 2110;
        if (!hit(nx, y) && (room || inArea(nx, y))) x = nx;
        const ny = clamp(y + (dy / len) * sp, bounds.y0, bounds.y1);
        const roadAttemptY = !room && x >= 2160 && x <= 2340 && ny >= 780 && ny <= 2110;
        if (!hit(x, ny) && (room || inArea(x, ny))) y = ny;
        if ((roadAttemptX || roadAttemptY) && BUS_IDS.some(id => busStateRef.current[id]?.status === "toDest")) {
          if (now - waitRef.current > 900) { waitRef.current = now; setToast("🚌 잠시 버스를 기다려주세요"); }
        }
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
            if (on && room.id === "jump") doQuest("jump");
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
        // 새 찜질스파는 건물 앞 넓은 자동문 구역까지 접근으로 인정합니다.
        const reach = b.id === "spa" ? 150 : 12 * b.scale + 40;
        if (d < reach && d < bestD) { best = b.id; bestD = d; }
      }
      if (best !== nearRef.current) { nearRef.current = best; setNearId(best); }

      let busBest = null;
      let busBestD = 150;
      for (const id of BUS_IDS) {
        const route = BUS_ROUTES[id];
        const bs = busStateRef.current[id];
        const bp = busPosition(route, bs, wallNow);
        const d = Math.hypot(p.x - bp.x, p.y - bp.y);
        if (d < busBestD) { busBest = id; busBestD = d; }
      }
      if (busBest !== nearBusRef.current) { nearBusRef.current = busBest; setNearBusId(busBest); }

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

      // 🚌 통행버스 애니메이션 / 자동 하차 / 자동 복귀
      for (const id of BUS_IDS) {
        const bs = busStateRef.current[id];
        if (!bs || bs.status !== "toDest") continue;
        const route = BUS_ROUTES[id];
        if (wallNow - bs.startedAt >= route.duration) {
          if (bs.riderId === deviceId()) {
            // 도착 정류장에서는 버스 도로 밖의 보행 가능 위치로 자동 하차합니다.
            // 도로 전체가 충돌 박스라 도로 위(route.end)에 그대로 두면 이동이 막히는 문제가 있었습니다.
            const dropoff = route.dropoff || route.end;
            const safeDropoff = route.id === "cottonSpa"
              ? { x: dropoff.x, y: Math.min(dropoff.y, 745) }
              : { x: dropoff.x, y: Math.max(dropoff.y, 2140) };
            posRef.current = { ...safeDropoff };
            setPos({ ...safeDropoff });
            ridingBusRef.current = null;
            setRiding(false);
            rideRef.current = null;
            rideLock.current = false;
            keys.current = {};
            movingRef.current = false;
            setMoving(false);
            setToast("🚌 도착했습니다! 자동으로 하차합니다.");
          }
          const next = { status: "return", riderId: null, riderName: "", startedAt: wallNow };
          busStateRef.current = { ...busStateRef.current, [id]: next };
          setBusState(busStateRef.current);
          chanRef.current?.fx({ t: "busArrive", busId: id, riderId: bs.riderId });
        }
      }
      for (const id of BUS_IDS) {
        const bs = busStateRef.current[id];
        if (bs?.status === "return" && wallNow - bs.startedAt >= BUS_RETURN_DURATION) {
          const next = { status: "idle", riderId: null, riderName: "" };
          busStateRef.current = { ...busStateRef.current, [id]: next };
          setBusState(busStateRef.current);
          chanRef.current?.fx({ t: "busReturn", busId: id });
        }
      }
      if (wallNow - busTickAt.current > 80 && BUS_IDS.some(id => busStateRef.current[id]?.status !== "idle")) {
        busTickAt.current = wallNow;
        setBusState({ ...busStateRef.current });
      }

      // 버스와 카메라는 React의 setState 주기와 분리해서 매 프레임 직접 움직입니다.
      // 기존 구조에서는 busState/cam state가 갱신되는 시점 사이에 DOM이 멈춰 보여
      // 버스가 출발해도 화면이 고정된 것처럼 보일 수 있었습니다.
      for (const id of BUS_IDS) {
        const route = BUS_ROUTES[id];
        const bs = busStateRef.current[id];
        if (!bs) continue;
        const el = document.querySelector(`[data-cc-bus="${id}"]`);
        if (el) {
          const bp = busPosition(route, bs, wallNow);
          el.style.left = `${bp.x}px`;
          el.style.top = `${bp.y}px`;
        }
      }

      const v = viewRef.current;
      const z = v.z || 1;
      const vw = v.w / z;
      const vh = v.h / z;

      // 🚌 버스 탑승 중에는 플레이어 좌표 자체를 버스 좌표와 동기화합니다.
      // 이렇게 하면 카메라가 별도의 목표값을 놓치지 않고 기존 플레이어 추적 방식 그대로 버스를 따라갑니다.
      let cameraTarget = p;
      const ridingBusId = ridingBusRef.current;
      if (ridingBusId && BUS_ROUTES[ridingBusId]) {
        // IMPORTANT: sceneRef가 한 프레임이라도 이전 건물/방 값을 가지고 있어도
        // 탑승 중에는 무조건 버스 좌표를 카메라의 기준으로 사용합니다.
        // 기존 v12의 `!roomId` 조건 때문에 일부 환경에서는 버스 탑승 후에도
        // 플레이어의 마지막 위치를 계속 따라가 버스가 화면에서 움직이지 않는 문제가 있었습니다.
        const r = BUS_ROUTES[ridingBusId];
        const bs = busStateRef.current[ridingBusId];
        if (bs && (bs.status === "toDest" || bs.status === "return")) {
          const bp = busPosition(r, bs, wallNow);
          cameraTarget = bp;
          posRef.current = { x: bp.x, y: bp.y };
          if (Math.abs(p.x - bp.x) > 0.5 || Math.abs(p.y - bp.y) > 0.5) setPos({ x: bp.x, y: bp.y });
        }
      }
      const tx = clamp(cameraTarget.x - vw / 2, 0, Math.max(0, WORLD.w - vw));
      const ty = clamp(cameraTarget.y - vh / 2 - 40 / z, 0, Math.max(0, WORLD.h - vh));
      const c = camRef.current;
      const ridingNow = !!ridingBusRef.current;
      // 버스 탑승 중에는 화면도 버스에 즉시 붙여서 이동감이 확실하게 보이도록 합니다.
      const nc = ridingNow
        ? { x: tx, y: ty }
        : { x: c.x + (tx - c.x) * 0.14, y: c.y + (ty - c.y) * 0.14 };
      camRef.current = nc;

      // 중요: 카메라는 React state가 다시 렌더링될 때까지 기다리지 않습니다.
      // 월드/구름 DOM을 같은 프레임에 직접 이동시켜 버스와 화면 시점을 1:1로 맞춥니다.
      const worldEl = worldDomRef.current;
      const cloudEl = cloudDomRef.current;
      if (worldEl) {
        worldEl.style.transform = `translate3d(${-nc.x * z}px, ${-nc.y * z}px, 0) scale(${z})`;
      }
      if (cloudEl) {
        cloudEl.style.transform = `translate3d(${-nc.x * z * 0.35}px, ${-nc.y * z * 0.35}px, 0) scale(${z})`;
      }
      // 비탑승 상태에서도 기존 React UI/상태와 동기화합니다.
      if (!ridingNow) setCam(nc);

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [popBall, pressKey, doQuest, startRide]);

  const normalizeSpaLobbyBubbleLayout = useCallback((next) => ({
    x: Math.max(10, Math.min(90, Number(next?.x) || 50)),
    y: Math.max(5, Math.min(75, Number(next?.y) || 22)),
    w: Math.max(22, Math.min(70, Number(next?.w) || 38)),
  }), []);

  const normalizeSpaInventoryLayout = useCallback((next) => ({
    x: Math.max(55, Math.min(99, Number(next?.x) || 97)),
    y: Math.max(1, Math.min(35, Number(next?.y) || 3)),
    s: Math.max(.35, Math.min(1.25, Number(next?.s) || .72)),
  }), []);

  const normalizeSpaLobbyItemLayout = useCallback((next) => ({
    bill: { x: Math.max(10, Math.min(90, Number(next?.bill?.x) || 50)), y: Math.max(15, Math.min(85, Number(next?.bill?.y) || 48)), s: Math.max(.25, Math.min(1.1, Number(next?.bill?.s) || .58)) },
    key: { x: Math.max(10, Math.min(90, Number(next?.key?.x) || 50)), y: Math.max(15, Math.min(85, Number(next?.key?.y) || 63)), s: Math.max(.25, Math.min(1.1, Number(next?.key?.s) || .58)) },
  }), []);

  const updateSpaLobbyBubbleLayout = useCallback((next) => {
    if (me.role !== "host") return;
    const safe = normalizeSpaLobbyBubbleLayout(next);
    spaLobbyBubbleLayoutRef.current = safe;
    setSpaLobbyBubbleLayout(safe);
    chanRef.current?.fx({ t: "spaLobbyBubbleLayout", layout: safe });
  }, [me.role, normalizeSpaLobbyBubbleLayout]);

  const updateSpaLobbyItemLayout = useCallback((next) => {
    if (me.role !== "host") return;
    const safe = normalizeSpaLobbyItemLayout(next);
    spaLobbyItemLayoutRef.current = safe;
    setSpaLobbyItemLayout(safe);
    chanRef.current?.fx({ t: "spaLobbyItemLayout", layout: safe });
  }, [me.role, normalizeSpaLobbyItemLayout]);

  const updateSpaInventoryLayout = useCallback((next) => {
    if (me.role !== "host") return;
    const safe = normalizeSpaInventoryLayout(next);
    spaInventoryLayoutRef.current = safe;
    setSpaInventoryLayout(safe);
    chanRef.current?.fx({ t: "spaInventoryLayout", layout: safe });
  }, [me.role, normalizeSpaInventoryLayout]);

  const saveSpaLobbyLayout = useCallback(() => {
    if (me.role !== "host") return;
    const bubble = normalizeSpaLobbyBubbleLayout(spaLobbyBubbleLayout);
    const items = normalizeSpaLobbyItemLayout(spaLobbyItemLayout);
    const inventory = normalizeSpaInventoryLayout(spaInventoryLayout);
    const payload = { bubble, bill: items.bill, key: items.key, inventory, savedAt: Date.now() };
    try {
      localStorage.setItem(SPA_LOBBY_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
      // 구버전 키도 같이 갱신해서 기존 코드/탭과 호환됩니다.
      localStorage.setItem("ccSpaLobbyBubbleLayout", JSON.stringify(bubble));
      localStorage.setItem("ccSpaLobbyItemLayout", JSON.stringify(items));
    } catch {}
    spaLobbyBubbleLayoutRef.current = bubble;
    spaLobbyItemLayoutRef.current = items;
    spaInventoryLayoutRef.current = inventory;
    setSpaLobbyBubbleLayout(bubble);
    setSpaLobbyItemLayout(items);
    setSpaInventoryLayout(inventory);
    chanRef.current?.fx({ t: "spaLobbyBubbleLayout", layout: bubble });
    chanRef.current?.fx({ t: "spaLobbyItemLayout", layout: items });
    chanRef.current?.fx({ t: "spaInventoryLayout", layout: inventory });
    setToast("찜질스파 로비 위치·크기를 저장했어요.");
  }, [me.role, normalizeSpaLobbyBubbleLayout, normalizeSpaLobbyItemLayout, normalizeSpaInventoryLayout, spaLobbyBubbleLayout, spaLobbyItemLayout, spaInventoryLayout, setToast]);

  const applyObjectImage = useCallback(async (id, data) => {
    if (me.role !== "host" || !data) return;
    try {
      const next = { ...objectImages, [id]: data };
      setObjectImages(next);
      try { localStorage.setItem("ccObjectImages", JSON.stringify(next)); } catch {}
      chanRef.current?.fx({ t: "objectImages", images: next });
      setToast(`${objectImageLabel(id)} 이미지가 적용됐어요.`);
    } catch { setToast("이미지를 적용하지 못했어요."); }
  }, [me.role, objectImages]);

  /* 같이 접속한 사람 */
  useEffect(() => {
    if (!hasServer || me.role === "solo" || !me.round) return undefined;
    const chan = joinChannel({
      round: me.round,
      me: { id: deviceId(), name: me.name, slot: me.slot, role: me.role },
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
        km: sceneRef.current === "sing" ? karaokeMicRef.current : null,
        kr: sceneRef.current === "sing" && me.role === "host" ? karaokeRemoteRef.current : undefined,
        kml: sceneRef.current === "sing" && me.role === "host" ? karaokeMicLayoutRef.current : undefined,
        bgmMap: me.role === "host" ? roomBgmRef.current : undefined,
        objImgs: me.role === "host" ? objectImages : undefined,
        spaLobbyBubbleLayout: me.role === "host" ? spaLobbyBubbleLayoutRef.current : undefined,
        spaLobbyItemLayout: me.role === "host" ? spaLobbyItemLayoutRef.current : undefined,
        spaInventoryLayout: me.role === "host" ? spaInventoryLayoutRef.current : undefined,
      }),
      onPeers: (list) => {
        setPeers(list);
        const host = list.find((p) => p.role === "host");
        if (host?.objImgs && typeof host.objImgs === "object") setObjectImages(host.objImgs);
        // 호스트 자신은 stale peer snapshot으로 로컬 설정이 되돌아가지 않도록
        // onPeers에서 레이아웃을 덮어쓰지 않습니다. 게스트만 호스트 값을 적용합니다.
        if (me.role !== "host") {
          if (host?.spaLobbyBubbleLayout && typeof host.spaLobbyBubbleLayout === "object") {
            spaLobbyBubbleLayoutRef.current = host.spaLobbyBubbleLayout;
            setSpaLobbyBubbleLayout(host.spaLobbyBubbleLayout);
          }
          if (host?.spaLobbyItemLayout && typeof host.spaLobbyItemLayout === "object") {
            spaLobbyItemLayoutRef.current = host.spaLobbyItemLayout;
            setSpaLobbyItemLayout(host.spaLobbyItemLayout);
          }
          if (host?.spaInventoryLayout && typeof host.spaInventoryLayout === "object") {
            spaInventoryLayoutRef.current = host.spaInventoryLayout;
            setSpaInventoryLayout(host.spaInventoryLayout);
          }
        }
        if (host?.bgmMap && typeof host.bgmMap === "object") {
          const normalizedMap = Object.fromEntries(
            Object.entries(host.bgmMap).map(([id, bgm]) => [
              id,
              bgm && typeof bgm === "object"
                ? { ...bgm, url: bgm.url || (bgm.path ? trackUrl(bgm.path) : "") }
                : null,
            ])
          );
          setHostBgmMap(normalizedMap);
        }
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
        if (e.t === "karaokeStart") {
          const at = Date.now();
          setHistory((h) => [
            ...h.slice(-199),
            {
              id: e.announcementId || ("karaoke-" + at),
              name: "전체 알림",
              text: `${e.name || "누군가"}님이 노래를 시작합니다 ♬`,
              r: "",
              at,
              system: true,
            },
          ]);
          setChatLog((l) => [
            ...l.slice(-3),
            {
              id: e.announcementId || ("karaoke-" + at),
              name: "전체 알림",
              text: `${e.name || "누군가"}님이 노래를 시작합니다 ♬`,
              r: "",
              at,
              system: true,
            },
          ]);
          return;
        }
        if (e.t === "karaokeStop") { setKaraoke(null); return; }

        if (e.t === "busBoard" && BUS_ROUTES[e.busId]) {
          const next = { status: "toDest", riderId: e.riderId || null, riderName: e.riderName || "", startedAt: Number(e.startedAt) || Date.now() };
          setBusState((m) => { const out = { ...m, [e.busId]: next }; busStateRef.current = out; return out; });
          if (e.riderId === deviceId()) ridingBusRef.current = e.busId;
          return;
        }
        if (e.t === "busArrive" && BUS_ROUTES[e.busId]) {
          const route = BUS_ROUTES[e.busId];
          const riderId = e.riderId || null;
          if (riderId === deviceId()) {
            // 도착 정류장에서는 버스 도로 밖의 보행 가능 위치로 자동 하차합니다.
            // 도로 전체가 충돌 박스라 도로 위(route.end)에 그대로 두면 이동이 막히는 문제가 있었습니다.
            const dropoff = route.dropoff || route.end;
            const safeDropoff = route.id === "cottonSpa"
              ? { x: dropoff.x, y: Math.min(dropoff.y, 745) }
              : { x: dropoff.x, y: Math.max(dropoff.y, 2140) };
            posRef.current = { ...safeDropoff };
            setPos({ ...safeDropoff });
            ridingBusRef.current = null;
            setRiding(false);
            rideRef.current = null;
            rideLock.current = false;
            keys.current = {};
            movingRef.current = false;
            setMoving(false);
            setToast("🚌 도착했습니다! 자동으로 하차합니다.");
          }
          const next = { status: "return", riderId: null, riderName: "", startedAt: Date.now() };
          setBusState((m) => { const out = { ...m, [e.busId]: next }; busStateRef.current = out; return out; });
          return;
        }
        if (e.t === "busReturn" && BUS_ROUTES[e.busId]) {
          const next = { status: "idle", riderId: null, riderName: "" };
          setBusState((m) => { const out = { ...m, [e.busId]: next }; busStateRef.current = out; return out; });
          return;
        }

        if (e.t === "objectImages" && e.images && typeof e.images === "object") {
          setObjectImages(e.images);
          try { localStorage.setItem("ccObjectImages", JSON.stringify(e.images)); } catch {}
          return;
        }

        if (e.t === "spaLobbyBubbleLayout" && e.layout && typeof e.layout === "object") {
          spaLobbyBubbleLayoutRef.current = e.layout;
          setSpaLobbyBubbleLayout(e.layout);
          return;
        }

        if (e.t === "spaLobbyItemLayout" && e.layout && typeof e.layout === "object") {
          spaLobbyItemLayoutRef.current = e.layout;
          setSpaLobbyItemLayout(e.layout);
          return;
        }

        if (e.t === "spaInventoryLayout" && e.layout && typeof e.layout === "object") {
          spaInventoryLayoutRef.current = e.layout;
          setSpaInventoryLayout(e.layout);
          return;
        }

        /* 방 BGM 동기화 */
        if (e.t === "roomBgm") {
          if (e.scene === "__ALL__" && e.bgmMap && typeof e.bgmMap === "object") {
            setHostBgmMap(e.bgmMap);
            return;
          }

          if (e.scene) {
            const bgm = e.bgm && typeof e.bgm === "object"
              ? { ...e.bgm, url: e.bgm.url || (e.bgm.path ? trackUrl(e.bgm.path) : "") }
              : null;

            setHostBgmMap((m) => ({
              ...m,
              [e.scene]: bgm,
            }));
          }
          return;
        }
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

        /* 마이크를 든 사람의 노래 채팅은 전체 기록에 남기지 않습니다.
           대신 Realtime에서 peer 말풍선으로만 보여줍니다. */
        if (msg.singing) return;

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

  /* 채팅 보내기 — 마이크를 들고 있으면 노래 채팅으로 처리합니다. */
  const sendChat = useCallback(() => {
    const raw = chatText.trim().slice(0, 60);
    setChatText("");
    chatBox.current?.blur();
    if (!raw) return;

    const singing = karaokeMic != null && sceneRef.current === "sing";
    const text = singing ? `${raw} ♬` : raw;

    chanRef.current?.chat(
      text,
      sceneRef.current || "",
      { singing }
    );

    /* 노래 채팅은 전체 기록/왼쪽 채팅 피드에 남기지 않습니다. */
    if (!singing) {
      setHistory((h) => [
        ...h.slice(-199),
        { id: "me", name: me.name, text, r: sceneRef.current || "", at: Date.now(), mine: true },
      ]);
    }

    setMyMsg(text);
    clearTimeout(myMsgTimer.current);
    myMsgTimer.current = setTimeout(() => setMyMsg(null), CHAT_MS);

    if (!singing) doQuest("chat");
  }, [chatText, me, doQuest, karaokeMic]);

  /* 노래방 마이크 — 두 자리 중 하나를 잡습니다.
     다른 사람이 이미 잡은 마이크는 빼앗지 않습니다. */
  const toggleKaraokeMic = useCallback((slot) => {
    if (sceneRef.current !== "sing") return;

    if (karaokeMic === slot) {
      setKaraokeMic(null);
      return;
    }

    const owner = peerView.find(
      (p) => p.r === "sing" && p.km === slot
    );

    if (owner) {
      setToast(`${owner.name}님이 이 마이크를 사용 중이에요`);
      return;
    }

    setKaraokeMic(slot);
    if (karaoke) doQuest("karaoke");
  }, [karaokeMic, peerView, karaoke, doQuest]);

  /* 노래방에서 나가면 마이크를 자동으로 내려놓습니다. */
  useEffect(() => {
    if (scene !== "sing" && karaokeMic != null) {
      setKaraokeMic(null);
    }
  }, [scene, karaokeMic]);

  /* 기록을 열거나 새 말이 오면 맨 아래로 내려줍니다 */
  useEffect(() => {
    if (logOpen && histBox.current) histBox.current.scrollTop = histBox.current.scrollHeight;
  }, [logOpen, history]);

  /* 노래방 호스트 전용 배치/크기 조절 */
  const beginKaraokeDrag = useCallback((kind, index, e) => {
    if (me.role !== "host" || sceneRef.current !== "sing") return;
    const layer = karaokeLayerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const current = kind === "remote" ? { ...karaokeRemoteRef.current } : { ...karaokeMicLayoutRef.current[index] };
    karaokeDragRef.current = { kind, index, startX, startY, rect, current, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, [me.role]);

  const beginKaraokeResize = useCallback((kind, index, e) => {
    if (me.role !== "host" || sceneRef.current !== "sing") return;
    const layer = karaokeLayerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const current = kind === "remote" ? { ...karaokeRemoteRef.current } : { ...karaokeMicLayoutRef.current[index] };
    karaokeDragRef.current = { kind: "resize-" + kind, index, startX: e.clientX, startY: e.clientY, rect, current, moved: false };
    e.stopPropagation();
  }, [me.role]);

  useEffect(() => {
    const move = (e) => {
      const d = karaokeDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; karaokeSuppressClickRef.current = true; }
      if (d.kind === "remote") {
        setKaraokeRemoteLayout({
          ...d.current,
          x: clamp(d.current.x + dx / d.rect.width * 100, 5, 95),
          y: clamp(d.current.y + dy / d.rect.height * 100, 8, 92),
        });
      } else if (d.kind === "resize-remote") {
        const w = clamp(d.current.w + dx, 86, 230);
        const h = clamp(d.current.h + dy, 120, 320);
        setKaraokeRemoteLayout({ ...d.current, w, h });
      } else if (d.kind === "mic") {
        setKaraokeMicLayout((arr) => arr.map((m, i) => i === d.index ? { ...d.current, x: clamp(d.current.x + dx / d.rect.width * 100, 5, 95), y: clamp(d.current.y + dy / d.rect.height * 100, 65, 96) } : m));
      } else if (d.kind === "resize-mic") {
        const s = clamp(d.current.s + dx / 90, 0.65, 1.8);
        setKaraokeMicLayout((arr) => arr.map((m, i) => i === d.index ? { ...d.current, s } : m));
      }
    };
    const up = () => { karaokeDragRef.current = null; if (karaokeSuppressClickRef.current) setTimeout(() => { karaokeSuppressClickRef.current = false; }, 0); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  /* =========================================================
     방 BGM
     - 호스트: roomBgmMap
     - 게스트: hostBgmMap
     - URL/path 정규화
     - 첫 사용자 입력에서 오디오를 unlock
     - play() 실패 원인을 상태로 기록
     ========================================================= */
  const currentBgm = scene
    ? (me.role === "host" ? roomBgmMap[scene] : hostBgmMap[scene]) || null
    : null;

  const currentBgmUrl =
    currentBgm?.url ||
    (currentBgm?.path ? trackUrl(currentBgm.path) : "") ||
    "";

  const playRoomBgm = useCallback(async (reason = "state") => {
    const a = bgmAudio.current;
    const url = bgmUrlRef.current || currentBgmUrl;
    if (!a || !url) return false;

    try {
      a.loop = true;
      a.volume = muted ? 0 : vol;
      a.muted = false;

      if (a.src !== url) {
        a.pause();
        a.src = url;
        a.load();
      }

      await a.play();
      bgmUnlockedRef.current = true;
      setBgmStatus("재생 중");
      return true;
    } catch (err) {
      const name = err?.name || "UnknownError";
      const msg = name === "NotAllowedError"
        ? "브라우저 자동재생 차단 — 화면을 한 번 클릭하면 재생됩니다."
        : `BGM 재생 실패: ${name}`;
      setBgmStatus(msg);
      console.warn("[CloudCandyTown BGM]", { reason, url, error: err });
      return false;
    }
  }, [currentBgmUrl, muted, vol]);

  useEffect(() => {
    bgmUrlRef.current = currentBgmUrl;
  }, [currentBgmUrl]);

  /* 방 이동/호스트 변경/새 BGM 수신 시 즉시 교체하고 재생 */
  useEffect(() => {
    const a = bgmAudio.current;
    if (!a) return;

    if (!currentBgmUrl) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      setBgmStatus("");
      return;
    }

    a.loop = true;
    a.volume = muted ? 0 : vol;
    a.muted = false;
    bgmUrlRef.current = currentBgmUrl;

    if (a.src !== currentBgmUrl) {
      a.pause();
      a.src = currentBgmUrl;
      a.load();
    }

    void playRoomBgm("bgm-change");
  }, [currentBgmUrl, scene, muted, vol, playRoomBgm]);

  /*
     게스트가 처음 게임 화면을 클릭/터치/키입력하는 순간을 반드시 잡습니다.
     방에 들어가는 클릭이어도 이 이벤트가 먼저 실행됩니다.
  */
  useEffect(() => {
    const unlockBgm = async () => {
      const a = bgmAudio.current;
      if (!a) return;

      const map = me.role === "host" ? roomBgmMap : hostBgmMap;
      const fallbackBgm = Object.values(map || {}).find((bgm) => bgm && typeof bgm === "object" && (bgm.url || bgm.path));
      const url = bgmUrlRef.current || currentBgmUrl || fallbackBgm?.url || (fallbackBgm?.path ? trackUrl(fallbackBgm.path) : "");
      try {
        a.loop = true;
        a.muted = true;
        a.volume = 0;

        if (url) {
          if (a.src !== url) {
            a.src = url;
            a.load();
          }
          await a.play();
          a.pause();
          a.currentTime = 0;
        } else {
          /* src가 없어도 사용자 제스처를 오디오 요소에 연결 */
          try { await a.play(); } catch { /* src 없음은 무시 */ }
          a.pause();
        }

        a.muted = false;
        a.volume = muted ? 0 : vol;
        bgmUnlockedRef.current = true;
        setBgmStatus("오디오 잠금 해제됨");

        if (url) void playRoomBgm("user-unlock");
      } catch (err) {
        a.muted = false;
        a.volume = muted ? 0 : vol;
        setBgmStatus(`BGM unlock 실패: ${err?.name || "UnknownError"}`);
        console.warn("[CloudCandyTown BGM unlock]", err);
      }
    };

    window.addEventListener("pointerdown", unlockBgm, { passive: true });
    window.addEventListener("touchstart", unlockBgm, { passive: true });
    window.addEventListener("keydown", unlockBgm);
    return () => {
      window.removeEventListener("pointerdown", unlockBgm);
      window.removeEventListener("touchstart", unlockBgm);
      window.removeEventListener("keydown", unlockBgm);
    };
  }, [currentBgmUrl, muted, vol, playRoomBgm, me.role, roomBgmMap, hostBgmMap]);

  useEffect(() => {
    if (bgmAudio.current) {
      bgmAudio.current.volume = muted ? 0 : vol;
      bgmAudio.current.muted = false;
    }
  }, [vol, muted]);

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
      setToast(`${r.round}번 테스트를 시작했어요. 참가자 목록이 비었습니다
/* ===== v28: 찜질스파 이용권/락커키 아이템 + 인벤토리 ===== */
.ccSpaInventory{position:absolute;right:20px;top:20px;z-index:45;width:min(520px,58vw);pointer-events:none}
.ccSpaInventoryTitle{font-size:11px;font-weight:1000;letter-spacing:2px;color:#4f403a;text-align:right;margin-bottom:5px;text-shadow:2px 2px 0 #fff}
.ccSpaInventorySlots{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;background:rgba(255,250,235,.94);border:4px solid #4f403a;padding:6px;box-shadow:5px 5px 0 rgba(63,49,48,.22)}
.ccSpaInventorySlot{height:58px;min-width:0;background:#e7d9bf;border:3px solid #756354;display:flex;align-items:center;justify-content:center;box-shadow:inset 2px 2px 0 rgba(255,255,255,.55)}
.ccSpaInventorySlot.filled{background:#fff3c9}
.ccSpaInventorySlot img{width:82%;height:82%;object-fit:contain;image-rendering:auto;filter:drop-shadow(2px 3px 0 rgba(79,64,58,.22))}
.ccSpaPickupItem{position:absolute;z-index:44;width:120px;min-height:116px;border:0;background:transparent;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;color:#4f403a;font-weight:1000;text-shadow:2px 2px 0 #fff;animation:ccSpaItemGlow 1.1s steps(2,end) infinite,ccSpaItemShake .8s steps(4,end) infinite;filter:drop-shadow(4px 5px 0 rgba(63,49,48,.2))}
.ccSpaPickupItem img{width:82px;height:82px;object-fit:contain;image-rendering:auto}
.ccSpaPickupItem span{margin-top:3px;font-size:11px;white-space:nowrap}
.ccSpaBillPickup{left:37%;top:57%}
.ccSpaKeyPickup{left:55%;top:57%}
.ccSpaPickupItem:hover{transform:scale(1.08);animation:none}
.ccSpaCollectHint{background:rgba(255,253,247,.92);border:3px solid #4f403a;padding:7px 12px;font-size:11px;font-weight:900;box-shadow:3px 3px 0 rgba(63,49,48,.2)}
@keyframes ccSpaItemGlow{0%,100%{opacity:.78;filter:drop-shadow(0 0 0 rgba(255,221,96,0)) drop-shadow(4px 5px 0 rgba(63,49,48,.2))}50%{opacity:1;filter:drop-shadow(0 0 14px rgba(255,221,96,.95)) drop-shadow(4px 5px 0 rgba(63,49,48,.2))}}
@keyframes ccSpaItemShake{0%,100%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(-2px,-2px) rotate(-2deg)}50%{transform:translate(2px,0) rotate(2deg)}75%{transform:translate(-1px,2px) rotate(-1deg)}}
`);
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

  useEffect(() => { if (scene === "cotton") { setCottonStep("shop"); setCottonColor("pink"); setCottonPowered(false); setCottonTufts([]); setCottonDecor([]); setCottonConfirm(false); setCottonGuideOpen(false); } }, [scene]);
  const cottonStartMachine = useCallback(() => { setCottonStep("machine"); setCottonPowered(false); setCottonTufts([]); setCottonDecor([]); setCottonGuideOpen(true); blip(760); }, []);
  const cottonStroke = useCallback((t) => setCottonTufts(list => list.length > 720 ? [...list.slice(-719), t] : [...list, t]), []);
  const cottonDecorate = useCallback((type, x, y) => { setCottonDecor(list => [...list, {x, y, r:Math.round(Math.random()*70-35),type}]); blip(760); }, []);
  const cottonConfirmDone = useCallback((yes) => {
    if (yes) {
      setCottonShelf(list => [...list, {
        fibers: cottonTufts.map(f => ({...f})),
        decorations: cottonDecor.map(d => ({...d})),
        name: me.name,
        at: Date.now(),
      }]);
      setCottonConfirm(false);
      setCottonStep("shop");
      setCottonTufts([]);
      setCottonDecor([]);
      setCottonPowered(false);
      setToast("🍭 진열 완료! 가게를 나갑니다.");
      exitRoom();
    } else {
      setCottonConfirm(false);
      setCottonStep("shop");
      setCottonTufts([]);
      setCottonDecor([]);
      setCottonPowered(false);
      setToast("가게 안에 보관했어요. 진열대에서 다시 볼 수 있어요.");
    }
  }, [cottonTufts, cottonDecor, me.name, exitRoom]);

  const ordered = useMemo(() => [...BUILDINGS].sort((a, b) => a.y - b.y), []);
  const questDone = QUESTS.filter((q) => quests.includes(q.id)).length;
  const nextQuest = QUESTS.find((q) => !quests.includes(q.id));
  const roundNo = room?.round ?? me.round;
  const R = scene ? roomFor(scene) : null;
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
            {scene === SPA_ENTRY_SCENE ? <SpaLobby balance={balance} onPay={()=>setSpent(v=>v+20)} onFloor={changeSpaFloor} onExit={exitRoom} isHost={me.role === "host"} bubbleLayout={spaLobbyBubbleLayout} onBubbleLayout={updateSpaLobbyBubbleLayout} itemLayout={spaLobbyItemLayout} onItemLayout={updateSpaLobbyItemLayout} inventoryLayout={spaInventoryLayout} onInventoryLayout={updateSpaInventoryLayout} onSaveLayout={saveSpaLobbyLayout} itemImages={{ bill: objectImages["spa:item:bill"], key: objectImages["spa:item:key"] }} inventory={spaInventory} onInventoryChange={setSpaInventory} /> : scene && scene.startsWith("spa") ? <SpaFloor
              scene={scene} player={pos} peers={roomPeers} me={me}
              onFloor={changeSpaFloor} onExit={exitRoom} onAction={setToast} inventory={spaInventory} itemImages={{ bill: objectImages["spa:item:bill"], key: objectImages["spa:item:key"] }} inventoryLayout={spaInventoryLayout}
            /> : scene === "cotton" ? <CottonShopRoom
              step={cottonStep} color={cottonColor} powered={cottonPowered} tufts={cottonTufts} decor={cottonDecor} shelf={cottonShelf} nickname={me.name} guideOpen={cottonGuideOpen} onCloseGuide={()=>setCottonGuideOpen(false)}
              onMachine={cottonStartMachine} onColor={setCottonColor}
              onPower={() => { setCottonPowered(v => !v); blip(cottonPowered ? 420 : 860); }}
              onStroke={cottonStroke} onFinish={() => cottonTufts.length >= 8 && setCottonStep("decorate")}
              onDecor={cottonDecorate} onDone={() => setCottonConfirm(true)} confirm={cottonConfirm} onConfirm={cottonConfirmDone} onBack={exitRoom}
            /> : <RoomStage room={R} waterPhase={wave} seats={seats} broken={broken} pressed={pressed} skin={scene === "candy" ? QUIZ_SKIN[quizMode] : null} />}
            {me.role === "host" && (
              <button
                className="ccRoomBgmBtn"
                onClick={(e) => { e.stopPropagation(); setBgmOpen(true); }}
              >
                🎵 BGM 설정
              </button>
            )}
            {currentBgm && (
              <div className="ccRoomBgmNow">
                🎵 {currentBgm.title}
                {bgmStatus ? <span style={{ marginLeft: 8, opacity: 0.72, fontSize: 11 }}>{bgmStatus}</span> : null}
              </div>
            )}
            <div className="ccRoomLayer" ref={karaokeLayerRef}>
              {scene === "sing" && karaoke && youtubeId(karaoke.url) && (
                <div className="ccKaraokeVideoScreen" aria-label={karaoke.title}>
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId(karaoke.url)}?autoplay=1&playsinline=1&rel=0&controls=1`}
                    title={karaoke.title}
                    allow="autoplay; encrypted-media; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              )}

              {scene === "sing" && (() => {
                const host = roomPeers.find((p) => p.role === "host");
                const remote = me.role === "host" ? karaokeRemoteLayout : (host?.kr || karaokeRemoteLayout);
                const micLayout = me.role === "host" ? karaokeMicLayout : (host?.kml || karaokeMicLayout);
                return (
                  <>
                    <div
                      className="ccKaraokeRemote"
                      role="button"
                      tabIndex={0}
                      aria-label="노래방 선곡표 열기"
                      style={{ left: `${remote.x}%`, top: `${remote.y}%`, width: remote.w, height: remote.h }}
                      onPointerDown={(e) => { if (me.role === "host") beginKaraokeDrag("remote", 0, e); }}
                      onClick={(e) => { if (karaokeSuppressClickRef.current) return; e.stopPropagation(); setSheet("songs"); blip(760); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSheet("songs"); blip(760); } }}
                    >
                      <div className="ccKaraokeRemoteHead"><span className="ccKaraokeRemoteLogo">KY KARAOKE</span><span className="ccKaraokeRemoteLed" /></div>
                      <div className="ccKaraokeRemoteMiniRow"><span className="ccKaraokeRemoteMini">한국곡</span><span className="ccKaraokeRemoteMini">아이돌</span><span className="ccKaraokeRemoteMini">여자</span></div>
                      <div className="ccKaraokeRemoteMiniRow"><span className="ccKaraokeRemoteMini">남자</span><span className="ccKaraokeRemoteMini">인기곡</span><span className="ccKaraokeRemoteMini">장르</span></div>
                      <div className="ccKaraokeRemoteMiniRow"><span className="ccKaraokeRemoteMini ccKaraokeRemoteYellow">신곡</span><span className="ccKaraokeRemoteMini ccKaraokeRemoteYellow">검색</span></div>
                      <div className="ccKaraokeRemoteMain">{['1','2','3','4','5','6','7','8','9'].map((n) => <span key={n} className="ccKaraokeRemoteNum">{n}</span>)}<span className="ccKaraokeRemoteNum ccKaraokeRemoteBlue">취소</span><span className="ccKaraokeRemoteNum">0</span><span className="ccKaraokeRemoteNum ccKaraokeRemoteBlue">시작</span></div>
                      <span
                        className="ccKaraokeRemoteStop"
                        role="button"
                        tabIndex={0}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setKaraoke(null);
                          setQueue([]);
                          setQi(0);
                          setPlName("");
                          audio.current?.pause();
                          if (audio.current) audio.current.currentTime = 0;
                          chanRef.current?.fx({ t: "karaokeStop" });
                          blip(420);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                        title="재생 중인 노래와 영상을 종료합니다"
                      >종료</span>
                      {me.role === "host" && <span className="ccKaraokeResizeHandle" onPointerDown={(e) => beginKaraokeResize("remote", 0, e)} />}
                      <div className="ccKaraokeRemoteHint">선곡표</div>
                    </div>

                    <div className="ccKaraokeMics" aria-label="노래방 스탠딩 마이크">
                      {[0, 1].map((slot) => {
                        const mine = karaokeMic === slot;
                        const owner = peerView.find((p) => p.r === "sing" && p.km === slot);
                        const busy = !!owner && !mine;
                        const ml = micLayout[slot] || { x: slot ? 57 : 43, y: 91, s: 1 };
                        return (
                          <div
                            key={slot}
                            className={"ccStandingMic" + (mine ? " on" : "") + (busy ? " busy" : "")}
                            style={{ left: `${ml.x}%`, top: `${ml.y}%`, transform: `translate(-50%,-50%) scale(${ml.s})` }}
                            onPointerDown={(e) => { if (me.role === "host") beginKaraokeDrag("mic", slot, e); }}
                            onClick={(e) => { if (karaokeSuppressClickRef.current) return; e.stopPropagation(); toggleKaraokeMic(slot); }}
                            title={mine ? "마이크 내려놓기" : busy ? `${owner.name}님이 사용 중` : "마이크 들기"}
                          >
                            <span className="ccStandingMicCloud" />
                            <span className="ccStandingMicHead" />
                            <span className="ccStandingMicStem" />
                            <span className="ccStandingMicBase" />
                            {busy && <span className="ccStandingMicName">{owner.name}</span>}
                            {me.role === "host" && <span className="ccMicResizeHandle" onPointerDown={(e) => beginKaraokeResize("mic", slot, e)} />}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {scene === "movie" && movie && (
                <div className="ccScreenWrap">
                  <video
                    ref={vidRef}
                    className="ccScreenVid"
                    src={trackUrl(movie.path)}
                    autoPlay
                    playsInline
                    muted={muted2}
                    onPlay={() => doQuest("movie")}
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
                    mic={scene === "sing" && q.km != null}
                    singing={scene === "sing" && q.km != null && !!q.msg}
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
            ref={cloudDomRef}
            className="ccClouds"
            style={{ transform: `translate3d(${-cam.x * zoom * 0.35}px, ${-cam.y * zoom * 0.35}px, 0) scale(${zoom})` }}
          >
            {CLOUDS.map(([x, y, s], i) => (
              <div key={i} className="ccCloud" style={{ left: x, top: y, animationDelay: `${i * 1.3}s` }}>
                <Pix map={DECO.cloud.map} palette={DECO.cloud.palette} scale={s} cacheKey="cloud" />
              </div>
            ))}
          </div>

          <div
            ref={worldDomRef}
            className="ccWorld"
            style={{
              width: WORLD.w,
              height: WORLD.h,
              transform: `translate3d(${-cam.x * zoom}px, ${-cam.y * zoom}px, 0) scale(${zoom})`,
            }}
          >
            <Ground />
            <ParkGround objectImages={objectImages} />
            <div className="ccAsphaltConnector" aria-hidden="true"><div className="ccRoadCenter"/><div className="ccRoadEdge left"/><div className="ccRoadEdge right"/></div>
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
              <div key={b.id} className={"ccBWrap" + (b.id === "spa" ? " ccSpaClickable" : "")} style={{ zIndex: Math.round(b.y) }} onClick={() => openBuilding(b.id)} onPointerDown={(e) => { if (b.id === "spa") { e.stopPropagation(); openBuilding("spa"); } }}>
                <Building b={b} near={nearId === b.id} objectImages={objectImages} />
              </div>
            ))}

            {BUS_IDS.map((id) => {
              const route = BUS_ROUTES[id];
              const bs = busState[id];
              const bp = busPosition(route, bs, Date.now());
              return <div key={id} data-cc-bus={id} className={"ccBus " + (bs?.status === "toDest" ? "moving" : "") + (bs?.riderId ? "occupied" : "")} style={{ left: bp.x, top: bp.y }} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); boardBus(id); }}
                onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); boardBus(id); }}
                onClick={(e) => { e.stopPropagation(); }}>
                {objectImages[id === "cottonSpa" ? "bus:spa" : "bus:cotton"] ? <img src={objectImages[id === "cottonSpa" ? "bus:spa" : "bus:cotton"]} alt="" className="ccBusCustomImage" /> : <div className="ccBusBody"><span className="ccBusWindow"/><span className="ccBusWindow second"/><span className="ccBusWheel left"/><span className="ccBusWheel right"/><span className="ccBusLight left"/><span className="ccBusLight right"/></div>}
                {bs?.riderId && <div className="ccBusName">{bs.riderName}</div>}
              </div>;
            })}

            {roomPeers.filter(p => !BUS_IDS.some(id => busState[id]?.riderId === p.id)).map((p) => (
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

            {!ridingBusRef.current && <Avatar
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
          mic={scene === "sing" && karaokeMic != null}
          singing={scene === "sing" && karaokeMic != null && !!myMsg}
        />}
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
                <div key={m.at + "-" + i} className={"ccHistLine" + (m.mine ? " ccHistMine" : "") + (m.system ? " ccHistSystem" : "")}>
                  <span className="ccHistWho">{m.name}</span>
                  <span className="ccLogRoom">{m.r ? roomFor(m.r)?.name : "마을"}</span>
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
              <div key={m.at + "-" + i} className={"ccFeedLine" + (m.mine ? " ccFeedMine" : "") + (m.system ? " ccFeedSystem" : "")}>
                <b>{m.name}</b>
                {(m.r || "") !== (scene || "") && (
                  <span className="ccLogRoom">{m.r ? roomFor(m.r)?.name : "마을"}</span>
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
                      const name = id ? (roomFor(id)?.name || id) : "마을";
                      counts[name] = (counts[name] || 0) + 1;
                    });
                    const mine = scene ? (roomFor(scene)?.name || scene) : "마을";
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
          <button className="ccSetToggle" onClick={()=>setSetSection(setSection === "font" ? "" : "font")}>
            <span>🔤 글꼴</span><b>{setSection === "font" ? "⌃" : "⌄"}</b>
          </button>
          {setSection === "font" && <div className="ccSetFonts">
            {FONTS.map((f) => (
              <button key={f.id} className={"ccSetFont" + (font === f.id ? " ccSetOn" : "")} style={{ fontFamily: f.css }} onClick={() => { setFont(f.id); blip(760); }}>
                {f.name}
              </button>
            ))}
          </div>}
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
          {me.role === "host" && (<>
            <button className="ccSetToggle" onClick={()=>setSetSection(setSection === "object" ? "" : "object")}>
              <span>🏠 건물 이미지 관리</span><b>{setSection === "object" ? "⌃" : "⌄"}</b>
            </button>
            {setSection === "object" && <div className="ccSetToggleBody">
              <p>건물뿐 아니라 버스와 구름공원 오브제도 사진을 올려 직접 바꿀 수 있어요.</p>
              <button className="ccSetFont ccSetSkinBtn" onClick={()=>{setSheet("objects");setSetOpen(false);setSetSection("");blip(760);}}>🏠 건물 이미지 관리 열기</button>
            </div>}
          </>)}
          <button className="ccSetToggle" onClick={()=>setSetSection(setSection === "character" ? "" : "character")}>
            <span>🎨 캐릭터 이미지 관리</span><b>{setSection === "character" ? "⌃" : "⌄"}</b>
          </button>
          {setSection === "character" && <div className="ccSetToggleBody">
            <p>{me.role === "host" ? "캐릭터 사진을 관리하고 적용할 수 있어요." : "현재 적용된 캐릭터 이미지를 볼 수 있어요."}</p>
            <button className="ccSetFont ccSetSkinBtn" onClick={() => { setSheet("skins"); setSetOpen(false); loadSkins(); blip(760); }}>팝업 열기</button>
          </div>}
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
            onPointerDown={performMobilePrimaryAction}
            onTouchStart={performMobilePrimaryAction}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
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
@import url("https://cdn.jsdelivr.net/gh/neodgm/neodgm-webfont@1.601/neodgm/style.css");
*{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{font-family:var(--ccFont,"NeoDunggeunmo",system-ui,sans-serif);
  -webkit-font-smoothing:none;letter-spacing:.02em}

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
.ccBridge{position:absolute;border:3px solid ${C.line};background:repeating-linear-gradient(90deg,#ffe9a8 0 18px,#fff4d8 18px 36px);box-shadow:0 4px 0 rgba(91,74,99,.18);z-index:2}
.ccCottonShop{position:relative;width:216px;height:198px;transition:transform .1s steps(2,end)}
.ccCottonShop.ccNear{transform:translateY(-6px)}
.ccCottonRoof{position:absolute;left:46px;top:0;width:124px;height:58px;display:flex;align-items:center;justify-content:center;font-size:42px;background:#ffb9d6;border:5px solid ${C.line};border-radius:58px 58px 12px 12px;box-shadow:0 6px 0 #e996bd}
.ccCottonAwning{position:absolute;left:18px;top:48px;width:180px;height:28px;display:flex;overflow:hidden;border:4px solid ${C.line};background:#fff}
.ccCottonAwning i{flex:1;border-right:2px solid ${C.line};background:#ffd9ea}
.ccCottonAwning i:nth-child(even){background:#bfe8ff}
.ccCottonBody{position:absolute;left:20px;top:70px;width:176px;height:110px;background:#fff7fb;border:5px solid ${C.line};border-radius:10px 10px 4px 4px;box-shadow:6px 6px 0 rgba(91,74,99,.18)}
.ccCottonWindow{position:absolute;left:16px;top:18px;width:82px;height:58px;background:#bfe8ff;border:4px solid ${C.line};border-radius:8px}
.ccCottonWindow:after{content:"🍭";position:absolute;left:23px;top:6px;font-size:25px}
.ccCottonDoor{position:absolute;right:14px;bottom:0;width:50px;height:78px;background:#ffd9ea;border:4px solid ${C.line};border-bottom:0;border-radius:24px 24px 0 0}
.ccCottonCloud{position:absolute;right:4px;top:80px;font-size:27px;filter:drop-shadow(2px 2px 0 rgba(91,74,99,.2))}
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
  padding:9px 15px;border-radius:42% 58% 50% 48% / 55% 45% 55% 45%;box-shadow:3px 3px 0 rgba(91,74,99,.2);animation:ccPop .12s steps(2,end)}
/* 캐릭터를 가리키는 뾰족한 꼬리 — 진한 삼각형 위에 흰 삼각형을 덮어 테두리를 만듭니다 */
.ccBubble:after{content:"";position:absolute;left:50%;top:100%;margin-left:-8px;z-index:0;
  width:0;height:0;border-style:solid;border-width:17px 8px 0 8px;
  border-color:${C.line} transparent transparent transparent}
.ccBubble:before{content:"";position:absolute;left:50%;top:calc(100% - 3px);margin-left:-5px;z-index:1;
  width:0;height:0;border-style:solid;border-width:14px 5px 0 5px;
  border-color:#fff transparent transparent transparent}
.ccBubbleSinging{background:#bfe8ff;border-color:#82b8d6;box-shadow:3px 3px 0 rgba(93,157,190,.22);border-radius:46% 54% 49% 51% / 54% 45% 55% 46%}
.ccBubbleSinging:after{border-color:#82b8d6 transparent transparent transparent}
.ccBubbleSinging:before{border-color:#bfe8ff transparent transparent transparent}
.ccHeldMic{position:absolute;right:-14px;bottom:6px;width:25px;height:38px;z-index:4;pointer-events:none;transform:rotate(-12deg)}
.ccHeldMicCloud{position:absolute;left:2px;top:0;width:21px;height:16px;background:#bfe8ff;border:2px solid #5b4a63;border-radius:55% 45% 50% 50%;box-shadow:inset 3px 2px 0 rgba(255,255,255,.5)}
.ccHeldMicStem{position:absolute;left:10px;top:14px;width:4px;height:20px;background:#5b4a63;border-radius:3px}
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
.ccScreenVid{width:100%;height:100%;object-fit:cover;display:block;background:#000}
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
.ccKaraokeVideoScreen{position:absolute;left:168px;top:38px;width:664px;height:228px;z-index:1;pointer-events:none;background:#000;overflow:hidden}
.ccKaraokeVideoScreen iframe{width:100%;height:100%;border:0;display:block}
.ccKaraokeMics{position:absolute;inset:0;z-index:28;pointer-events:none}
.ccStandingMic{position:absolute;width:72px;height:150px;pointer-events:auto;cursor:pointer;transform-origin:center center}
.ccStandingMicCloud{position:absolute;left:13px;top:4px;width:46px;height:34px;background:#bfe8ff;border:4px solid #5b4a63;border-radius:55% 45% 48% 52% / 60% 42% 58% 40%;box-shadow:inset 6px 4px 0 rgba(255,255,255,.42),4px 4px 0 rgba(91,74,99,.18)}
.ccStandingMicHead{position:absolute;left:24px;top:31px;width:24px;height:25px;background:#d9f3ff;border:4px solid #5b4a63;border-radius:12px}
.ccStandingMicStem{position:absolute;left:33px;top:55px;width:7px;height:72px;background:#6b6470;border:3px solid #5b4a63;border-radius:5px}
.ccStandingMicBase{position:absolute;left:9px;bottom:4px;width:54px;height:13px;background:#b8b1bf;border:4px solid #5b4a63;border-radius:50%;box-shadow:0 4px 0 rgba(91,74,99,.2)}
.ccStandingMic.on .ccStandingMicCloud{
  background:#ff8fcf;
  border-color:#7a496f;
  border-radius:45% 55% 50% 45% / 55% 45% 55% 45%;
  transform:scale(1.08) rotate(-3deg);
  box-shadow:
    inset 6px 4px 0 rgba(255,255,255,.55),
    0 0 0 5px rgba(255,143,207,.25),
    0 0 18px rgba(255,143,207,.65),
    4px 4px 0 rgba(91,74,99,.18);
}
.ccStandingMic.busy{opacity:.72}
.ccStandingMicName{position:absolute;left:50%;top:-23px;transform:translateX(-50%);white-space:nowrap;background:#fff;border:3px solid #5b4a63;padding:3px 7px;font-size:9px;font-weight:900;color:#5b4a63}
.ccMicResizeHandle,.ccKaraokeResizeHandle{position:absolute;width:13px;height:13px;background:#ffd45e;border:3px solid #5b4a63;border-radius:2px;right:-7px;bottom:-7px;cursor:nwse-resize;z-index:10;box-shadow:2px 2px 0 rgba(91,74,99,.2)}
.ccKaraokeRemote{position:absolute;transform:translate(-50%,-50%);z-index:24;pointer-events:auto;cursor:grab;border:4px solid #342b43;border-radius:12px 12px 16px 16px;background:linear-gradient(135deg,#fff 0%,#f5f4f8 58%,#dedde5 100%);box-shadow:5px 6px 0 rgba(35,27,48,.45),inset -5px -7px 0 rgba(91,74,99,.12),inset 3px 3px 0 rgba(255,255,255,.95);padding:10px 8px 8px;box-sizing:border-box;image-rendering:auto}
.ccKaraokeRemote:active{cursor:grabbing}
.ccKaraokeRemoteHead{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px}.ccKaraokeRemoteLogo{font-size:7px;font-weight:900;color:#6b6470;letter-spacing:-.04em}.ccKaraokeRemoteLed{width:8px;height:5px;border-radius:3px;background:#ffdb57;border:2px solid #554c5d;box-sizing:border-box}.ccKaraokeRemoteMiniRow{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:4px}.ccKaraokeRemoteMini{height:13px;border:2px solid #6b6470;border-radius:4px;background:#fff;font-size:6px;font-weight:900;color:#5b4a63;display:flex;align-items:center;justify-content:center;line-height:1}.ccKaraokeRemoteYellow{background:#ffe76f;border-color:#675c3d}.ccKaraokeRemoteMain{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px}
.ccKaraokeRemoteStop{display:block;text-align:center;width:100%;margin-top:5px;padding:5px 0;border:3px solid #ff6f7d;background:#4a2530;color:#ffe8ea;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer;box-shadow:2px 2px 0 rgba(0,0,0,.18)}
.ccKaraokeRemoteStop:hover{filter:brightness(1.08)}.ccKaraokeRemoteNum{height:20px;border:2px solid #5d5862;border-radius:5px;background:#f8f8fb;box-shadow:inset 0 -2px 0 #d8d6df;font-size:10px;font-weight:900;color:#3e3945;display:flex;align-items:center;justify-content:center}.ccKaraokeRemoteBlue{background:#a9dcff;color:#3b5970}.ccKaraokeRemoteHint{position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:900;color:#fff6dc;text-shadow:2px 2px 0 #5b4a63;opacity:.9}
.ccKaraokeRemoteAction{display:none}
.ccKaraokeCushions{display:none}
.ccKaraokeCushion{display:none}
.ccKaraokeRoomScreen,.ccKaraokeRoomFrame,.ccKaraokeRoomTop,.ccKaraokeRoomVideo,.ccKaraokeRoomWho{display:none!important}
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

/* ☁️ 구름솜사탕 가게 */
.ccCottonRoom{position:absolute;inset:0;background:linear-gradient(#fff9fc,#ffeaf4);z-index:30;color:${C.ink};overflow:hidden}.ccCottonRoomTop{height:82px;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#fff;border-bottom:4px solid ${C.line}}.ccCottonRoomTitle{font-size:22px;font-weight:900}.ccCottonRoomSub{font-size:11px;color:${C.inkSoft};font-weight:700}.ccCottonBack,.ccCottonColor,.ccPowerBtn,.ccDecorButtons button{border:3px solid ${C.line};font-family:inherit;font-weight:900;cursor:pointer}.ccCottonBack{background:#fff6dc;padding:7px 11px}.ccCottonShopScene{height:calc(100% - 82px);display:flex;gap:34px;align-items:center;justify-content:center;padding:28px}.ccCottonBigObject,.ccCottonShelfObject{width:38%;min-width:270px;height:390px;border:5px solid ${C.line};background:#fff;box-shadow:8px 8px 0 rgba(91,74,99,.18)}.ccCottonBigObject{cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.ccCottonMachineIcon{position:relative;width:230px;height:230px}.ccMachineBowl{position:absolute;left:20px;top:20px;width:190px;height:190px;border-radius:50%;background:radial-gradient(circle,#fff 0 40%,#a9b2ba 41% 47%,#f7f8f9 48% 66%,#929ca4 67% 72%,#fff 73%);border:5px solid ${C.line};box-shadow:inset 0 0 20px #7775}.ccMachineBowl:after{content:"";position:absolute;left:60px;top:60px;width:60px;height:60px;border-radius:50%;background:#fff7fb;border:5px solid #9da6ad}.ccMachinePole{position:absolute;left:103px;top:175px;width:24px;height:50px;background:#9da6ad;border:4px solid ${C.line};border-top:0}.ccShelfCanopy{font-size:20px;font-weight:900;padding:18px;background:#ffd9ea;border-bottom:4px solid ${C.line};text-align:center}.ccShelfRows{padding:28px 24px}.ccShelfRow{height:82px;border-bottom:5px solid ${C.line};display:flex;gap:12px;align-items:flex-end}.ccShelfSlot{flex:1;height:62px;border:3px solid ${C.line};display:flex;align-items:center;justify-content:center}.ccMiniCotton{width:48px;height:42px;border-radius:50%;filter:blur(1px)}.ccCottonMachineStage{height:calc(100% - 82px);display:flex;flex-direction:column;align-items:center;padding:16px 22px;overflow:auto}.ccCottonColorBar{display:flex;align-items:center;gap:9px;border:4px solid ${C.line};background:#fff;padding:7px 10px}.ccCottonColor{width:30px;height:30px;border-radius:50%;box-shadow:2px 2px 0 #7775}.ccCottonColor.on{transform:scale(1.15);box-shadow:inset 0 0 0 3px #fff}.ccCottonColorBar span{font-size:10px;color:${C.inkSoft}}.ccCottonMachine{width:min(620px,92%);min-height:480px;margin-top:12px;background:linear-gradient(#eef1f4,#adb6be);border:6px solid ${C.line};box-shadow:8px 8px 0 #7774;padding:18px}.ccCottonMachine.powered{animation:ccMachineVibrate .11s steps(2,end) infinite}.ccMachineLabel{text-align:center;font-weight:900;font-size:12px}.ccMachineRingArea{position:relative;width:420px;height:360px;max-width:100%;margin:auto;touch-action:none;cursor:crosshair}.ccSteelRing{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,#eef1f3 0 49%,#929da5 50% 54%,#fff 55% 68%,#89949d 69% 73%,#dce1e5 74%);border:6px solid ${C.line};box-shadow:inset 0 0 22px #7774}.ccSteelRing.spinning{animation:ccRingSpin .72s linear infinite}.ccSteelHole{position:absolute;inset:80px;border-radius:50%;background:#fff0f7;border:5px solid #9da6ad}.ccCottonCloud{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 42% 38%,rgba(255,255,255,.98) 0 14%,rgba(255,255,255,.82) 34%,rgba(255,255,255,.38) 62%,rgba(255,255,255,0) 78%);border:0;overflow:hidden;filter:drop-shadow(0 1px 2px rgba(91,74,99,.12));transition:width .18s,height .18s;z-index:4}.ccCottonCloud i{position:absolute;width:20px;height:20px;border-radius:50%;filter:blur(3px);transform:translate(-50%,-50%);opacity:.9}.ccCottonStick{position:absolute;left:50%;top:70%;width:20px;height:115px;background:#fff;border:4px solid ${C.line};transform:translateX(-50%)}.ccPowerRow{display:flex;align-items:center;justify-content:center;gap:12px;font-size:10px;font-weight:800;color:${C.inkSoft}}.ccPowerBtn{background:#fff;padding:9px 15px}.ccPowerBtn.on{background:#8fe3c9}.ccCottonFinish{margin-top:8px;background:#ff8fb6}.ccCottonFinish:disabled{opacity:.4}@keyframes ccRingSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes ccMachineVibrate{0%,100%{transform:translate(0)}25%{transform:translate(1px,-1px)}50%{transform:translate(-1px,1px)}75%{transform:translate(1px,1px)}}.ccCottonDecorStage{height:calc(100% - 82px);display:flex;gap:30px;align-items:center;justify-content:center;padding:24px}.ccDecorPreview{width:52%;height:78%;min-height:360px;border:5px solid ${C.line};background:#eef8ff;display:flex;align-items:center;justify-content:center}.ccDecorCloud{position:relative;flex:none;cursor:crosshair}.ccDecorReady{cursor:crosshair;filter:drop-shadow(0 0 5px rgba(255,143,190,.35))}.ccDecorButtons .ccDecorSelected{background:#ffd45e;box-shadow:inset 0 0 0 3px #fff,3px 3px 0 rgba(91,74,99,.18)}.ccDecorPanel{width:330px;border:5px solid ${C.line};background:#fff;padding:20px;box-shadow:7px 7px 0 #7774}.ccDecorPanel h3{margin:0 0 8px;font-size:20px}.ccDecorPanel p{font-size:11px;color:${C.inkSoft};font-weight:700}.ccDecorButtons{display:flex;flex-direction:column;gap:8px;margin:16px 0}.ccDecorButtons button{background:#fff6dc;padding:10px;font-size:13px}.ccDecorCount{font-size:11px;font-weight:800;color:${C.inkSoft};margin-bottom:10px}.ccCottonDone{width:100%;background:#8fe3c9}.ccSprinkle{position:absolute;z-index:8}.ccSprinkle-star{width:20px;height:20px;background:#ffd45e;clip-path:polygon(50% 0,61% 36%,98% 36%,68% 58%,79% 96%,50% 73%,21% 96%,32% 58%,2% 36%,39% 36%)}.ccSprinkle-bar{width:9px;height:28px;background:#ff8fb6;border:2px solid ${C.line};border-radius:3px}.ccSprinkle-heart{width:22px;height:20px;background:#ff6f9e;clip-path:polygon(50% 100%,0 35%,12% 8%,35% 8%,50% 28%,65% 8%,88% 8%,100% 35%)}/* v5 솜사탕 진열/입체/닉네임/안내 팝업 */
.ccCottonShop3D{perspective:1100px;position:relative;background:linear-gradient(#fff9fc 0 58%,#f7dce8 58% 100%);align-items:flex-end;padding-bottom:54px}
.ccCottonShop3D:after{content:"";position:absolute;left:6%;right:6%;bottom:18px;height:150px;background:linear-gradient(135deg,#ead0db,#fff1f7);transform:rotateX(62deg);transform-origin:bottom;border:4px solid ${C.line};opacity:.65;pointer-events:none}
.ccCottonMachineDisplay,.ccCottonShelfDisplay{position:relative;z-index:2;transform:rotateX(4deg);transition:.18s}
.ccCottonMachineDisplay:hover,.ccCottonShelfDisplay:hover{transform:translateY(-7px) rotateX(4deg)}
.ccObjectShadow{position:absolute;bottom:30px;width:220px;height:30px;border-radius:50%;background:#6b536055;filter:blur(7px)}
.ccCottonShelfDisplay{cursor:pointer;font-family:inherit}
.ccCottonOwnerName{position:absolute;left:50%;top:calc(100% + 58px);transform:translateX(-50%);font-size:15px;font-weight:900;color:${C.line};background:#fff;border:3px solid ${C.line};padding:4px 10px;white-space:nowrap;z-index:12}
.ccDecorStick{position:absolute;left:50%;top:248px;width:22px;height:150px;background:linear-gradient(90deg,#eee,#fff,#ddd);border:4px solid ${C.line};transform:translateX(-50%);z-index:2;border-radius:4px}
.ccDisplayCottonWrap{position:relative;width:230px;height:390px;display:flex;justify-content:center;align-items:flex-start;padding-top:38px}
.ccDisplayCotton{width:210px;height:230px;border-radius:50% 50% 46% 48%;filter:blur(3px);opacity:.82;box-shadow:0 0 28px rgba(255,255,255,.8),inset 0 0 28px rgba(255,255,255,.7)}
.ccDisplayStick{position:absolute;top:230px;width:22px;height:125px;background:linear-gradient(90deg,#eee,#fff,#ddd);border:4px solid ${C.line};border-radius:4px}
.ccDisplayName{position:absolute;top:360px;font-weight:900;font-size:14px;background:#fff;border:3px solid ${C.line};padding:3px 9px;white-space:nowrap}
.ccShelfViewer{position:absolute;inset:0;background:rgba(51,42,58,.62);display:flex;align-items:center;justify-content:center;z-index:90}
.ccShelfViewerCard{position:relative;width:min(620px,88%);padding:24px;background:#fff7fb;border:5px solid ${C.line};box-shadow:10px 10px 0 rgba(91,74,99,.22);text-align:center}
.ccShelfClose{position:absolute;right:10px;top:8px;border:3px solid ${C.line};background:#fff;font-size:24px;font-weight:900;cursor:pointer}
.ccShelfViewerStage{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:8px}
.ccShelfArrow{width:48px;height:64px;border:4px solid ${C.line};background:#ffe2ee;font-size:40px;font-weight:900;cursor:pointer}
.ccShelfPage{font-weight:900;color:${C.inkSoft};margin-top:4px}
.ccCottonGuideOverlay{position:absolute;inset:0;background:rgba(50,40,60,.55);z-index:100;display:flex;align-items:center;justify-content:center}
.ccCottonGuide{width:min(430px,88%);padding:28px;text-align:center;background:#fffaff;border:5px solid ${C.line};box-shadow:10px 10px 0 rgba(91,74,99,.25)}
.ccCottonGuideIcon{font-size:48px}.ccCottonGuide h2{margin:4px 0 10px;font-size:25px}.ccCottonGuide p{font-size:16px;line-height:1.7}.ccGuideCircle{margin:10px auto 18px;width:92px;height:92px;border:7px dashed #ff8fbe;border-radius:50%;font-size:70px;line-height:82px;color:#ff8fbe;animation:ccGuideSpin 1.5s linear infinite}@keyframes ccGuideSpin{to{transform:rotate(360deg)}}
.ccCottonConfirmWrap{position:absolute;inset:0;background:#5b4a6377;display:flex;align-items:center;justify-content:center;z-index:80}.ccCottonConfirm{width:min(390px,88%);padding:26px;text-align:center}.ccCottonConfirmIcon{font-size:48px}.ccCottonConfirm h2{margin:8px 0}.ccCottonConfirm p{font-size:12px;font-weight:700;color:${C.inkSoft}}.ccCottonConfirmBtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.ccCottonOverlay{z-index:2}

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
.ccTouch{display:none;position:fixed;inset:0;width:100vw;height:100vh;z-index:180;pointer-events:none}
.ccTouch .ccStickZone,.ccTouch .ccActs{pointer-events:auto}
.ccStickZone{position:absolute;left:0;bottom:0;width:58%;height:82%;touch-action:none;z-index:6}
.ccStick{position:absolute;left:28px;bottom:calc(28px + var(--kb, 0px));width:154px;height:154px;border-radius:50%;
  border:4px solid ${C.line};background:rgba(255,255,255,.6);touch-action:none;opacity:.75;
  box-shadow:4px 4px 0 rgba(91,74,99,.25);display:flex;align-items:center;justify-content:center}
.ccStickOn{opacity:1;background:rgba(255,255,255,.9)}
.ccStickZone,.ccStick{overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.ccStickKnob{width:64px;height:64px;border-radius:50%;border:4px solid ${C.line};background:#ffd45e;
  box-shadow:3px 3px 0 rgba(91,74,99,.25);pointer-events:none;transition:transform .04s linear}
.ccActs{position:absolute;right:20px;bottom:calc(22px + var(--kb, 0px));display:flex;align-items:flex-end;gap:10px}
.ccAct{position:relative;z-index:200;border:4px solid ${C.line};background:#fff;color:${C.ink};font-family:inherit;font-weight:700;
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
  .ccSpaLobby .ccLobbyActions{z-index:120;pointer-events:none}
  .ccSpaLobby .ccLobbyActions .ccLobbyYesNo{pointer-events:auto}
  .ccSpaLobby .ccLobbyActions .ccLobbyYesNo button{pointer-events:auto;touch-action:manipulation}
  .ccSpaLobby .ccFloorPickerOverlay{touch-action:manipulation}
  .ccBus{pointer-events:auto}

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
.ccHistSystem{color:#7d5cc6!important;font-weight:900;background:#f3efff!important}
.ccHistSystem .ccHistWho,.ccHistSystem .ccLogRoom,.ccHistSystem .ccHistText{color:#7d5cc6!important}
.ccFeedSystem{color:#7d5cc6!important;font-weight:900;background:rgba(243,239,255,.92)!important}
.ccFeedSystem b{color:#7d5cc6!important}
/* ============================ 찜질스파 대형 맵 ============================ */
.ccSpaRoom{position:absolute;inset:0;background:#d9e5e8;color:#4e4652;overflow:hidden;z-index:30;font-family:inherit}
.ccSpaHud{height:72px;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#fff;border-bottom:4px solid #5b4a63;position:relative;z-index:20;box-shadow:0 4px 0 #7774}
.ccSpaHud b{font-size:18px}.ccSpaHud span{display:block;font-size:10px;color:#8c7b8d;font-weight:800;margin-top:3px}
.ccSpaFloors{display:flex;gap:5px}.ccSpaFloors button{border:3px solid #5b4a63;background:#fff7df;padding:7px 10px;font-family:inherit;font-weight:900;cursor:pointer}.ccSpaFloors button.on{background:#ffd45e}.ccSpaViewport{position:absolute;left:0;right:0;top:72px;bottom:0;overflow:hidden;background:#cbd7d9}
.ccSpaMap{position:absolute;left:0;top:0;background:#f5f1e8;transition:transform .12s linear;image-rendering:auto}
.ccSpaCeiling{position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.42) 1px,transparent 1px),linear-gradient(rgba(120,120,120,.10) 1px,transparent 1px);background-size:60px 60px;pointer-events:none}
.ccSpaTitle{position:absolute;left:90px;top:45px;font-size:17px;font-weight:900;letter-spacing:2px;color:#8a6e7c;opacity:.75}
.ccSpaMapLabel{position:absolute;background:#fff;border:3px solid #5b4a63;padding:5px 10px;font-size:11px;font-weight:900;z-index:5}.ccSpaEntrance{left:90px;top:105px}
.ccSpaArea{position:absolute;border:5px solid #5b4a63;background:#fffdf7;box-shadow:8px 8px 0 rgba(91,74,99,.14);overflow:hidden}.ccSpaArea h3{margin:0;padding:9px 12px;background:#ffe9c6;border-bottom:4px solid #5b4a63;font-size:15px}
.lockerArea{left:90px;top:170px;width:600px;height:330px}.ccLockerGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;padding:16px}.ccLocker{height:60px;background:linear-gradient(90deg,#dca86d,#f1c489,#d49b60);border:3px solid #6e543f;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#5b4a63}.ccBench{margin:0 16px;padding:10px;background:#e5bd7d;border:3px solid #6e543f;text-align:center;font-size:10px;font-weight:900}
.showerArea{left:730px;top:170px;width:500px;height:330px;background:#dfeff2}.ccShowerGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:15px}.ccShower{height:75px;border:3px solid #70838a;background:#f8ffff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}.ccShower span{font-size:25px}.ccShower small{font-size:8px;font-weight:800;color:#71858b}.ccDrain{margin:0 15px;border-top:5px dotted #7f9da4;padding-top:8px;text-align:center;font-size:9px;color:#719098;font-weight:900}
.bathArea{left:90px;top:535px;width:1140px;height:540px;background:#e7eef0}.ccBath{position:absolute;cursor:pointer;font-family:inherit;color:#4e4652;border:7px solid #687c83;border-radius:35px;background:linear-gradient(135deg,#c6f0ff,#73cbed);box-shadow:inset 0 0 0 5px #e8fbff,inset 0 0 30px rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;text-align:center}.bigBath{left:30px;top:80px;width:540px;height:340px}.smallBath{width:210px;height:130px;border-radius:24px}.cold{left:600px;top:85px;background:linear-gradient(#b8e9ff,#69b7ed)}.bubble{left:830px;top:85px}.med{left:600px;top:245px;background:linear-gradient(#cbe7bd,#8ac88d)}.electric{left:830px;top:245px;background:linear-gradient(#c8e8ff,#78bfe7)}.ccWater{display:flex;gap:30px;font-size:32px;animation:ccSpaSteam 2s steps(3,end) infinite}.ccBath b{position:absolute;bottom:20px;font-size:12px}.ccTowelRack{position:absolute;right:25px;bottom:18px;background:#fff;border:3px solid #5b4a63;padding:8px;font-size:9px;font-weight:900}
.saunaArea{left:1260px;top:170px;width:450px;height:905px;background:#e9d7bb}.ccSauna{position:relative;margin:14px;border:4px solid #6b5548;background:#c99461;padding:14px;text-align:center;min-height:150px}.ccSauna b,.ccSauna span{display:block}.ccSauna span{font-size:10px;margin-top:8px}.ccSaunaBench{height:30px;background:#9c673f;border:3px solid #5c3f30;margin-top:35px}.ccSauna.kiln{background:#7d5a4b;color:#fff0dc}.ccFire{width:65px;height:45px;margin:20px auto 0;background:radial-gradient(circle,#ffe77a 0 25%,#ff9d32 26% 55%,#c84729 56%);border-radius:50%;animation:ccFire .55s steps(2,end) infinite}.ccSauna.salt{background:#f6f4ed}.ccSauna.clay{background:#bd8b6a}
.ccSpaStairs{border:4px solid #5b4a63;background:#ffd45e;box-shadow:4px 4px 0 #7775;font-family:inherit;font-weight:900;cursor:pointer}.ccSpaInfo{position:absolute;left:90px;bottom:45px;background:#fff9e8;border:3px solid #5b4a63;padding:8px 12px;font-size:10px;font-weight:900;z-index:7}
.onsenMain{left:90px;top:170px;width:980px;height:700px;background:#e7ece9}.ccOnsenWater{position:absolute;left:30px;top:70px;width:920px;height:570px;border:10px solid #687b82;border-radius:55px;background:linear-gradient(145deg,#d2f5ff,#5ab9dc);overflow:hidden;box-shadow:inset 0 0 40px #fff8}.ccOnsenWater b{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);font-size:28px;color:#fff;text-shadow:3px 3px 0 #628b98}.ccOnsenWater span{position:absolute;left:30px;bottom:18px;background:#fff;border:3px solid #5b4a63;padding:7px;font-size:9px;font-weight:900}.ccOnsenWater i{position:absolute;width:90px;height:32px;border-radius:50%;background:rgba(255,255,255,.65);filter:blur(8px);animation:ccSpaSteam 2.4s ease-in-out infinite}.privateBath{left:1110px;top:170px;width:600px;height:330px;background:#e8dcc8}.ccPrivateTub{display:inline-flex;width:145px;height:190px;margin:15px 8px;border-radius:50%;background:radial-gradient(circle,#b9eaff 0 55%,#7c939b 56% 66%,#d9c6a7 67%);align-items:center;justify-content:center;flex-direction:column;border:5px solid #5b4a63}.carbonBath{left:1110px;top:530px;width:600px;height:340px;background:#dff6fb}.ccBubbles{height:250px;position:relative}.ccBubbles i{position:absolute;width:9px;height:9px;border:2px solid #fff;border-radius:50%;animation:ccBubble 2s linear infinite}.viewBath{left:90px;top:900px;width:650px;height:200px;background:#e9e4d5}.ccWindowScene{height:105px;margin:12px;background:linear-gradient(#203b68 0 55%,#375f47 56%);border:5px solid #5b4a63;position:relative;overflow:hidden}.ccWindowScene span{position:absolute;right:30px;top:12px;font-size:30px;color:#fff}.ccWindowScene i{position:relative;margin-left:60px;top:45px;font-size:25px}.waterStation{left:770px;top:900px;width:300px;height:200px;background:#f9fff9}.ccWaterCup{font-size:35px;text-align:center;padding:28px 0 10px}.waterStation small{display:block;text-align:center;font-size:9px;font-weight:900}
.jjimMain{left:90px;top:170px;width:900px;height:700px;background:#eadfce}.ccMatGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:25px}.ccMat{height:110px;background:#e7b87d;border:4px solid #8a644b;display:flex;align-items:center;justify-content:center;font-size:35px}.ccTV{position:absolute;right:30px;bottom:30px;width:250px;height:100px;background:#24242b;color:#fff;border:8px solid #6a584e;display:flex;align-items:center;justify-content:center;font-size:12px}.rooms3{left:1020px;top:170px;width:690px;height:360px;background:#e9d7bb}.ccHeatRooms{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px}.ccHeatRooms div{height:115px;border:4px solid #6c584d;background:#c98d66;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:28px}.ccHeatRooms b{font-size:10px;margin-top:7px}.ccHeatRooms div:nth-child(2){background:#f2f1e8}.ccHeatRooms div:nth-child(3){background:#cbeaff}.ccHeatRooms div:nth-child(4){background:#333;color:#fff}.ccHeatRooms div:nth-child(5){background:#a95b39;color:#fff}.snackBar{left:1020px;top:565px;width:690px;height:300px;background:#fff5dc}.ccFoodShelf{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:20px}.ccFoodShelf span{background:#fff;border:3px solid #6c584d;padding:12px;text-align:center;font-size:10px;font-weight:900}.vending{left:90px;top:900px;width:430px;height:200px}.ccVendingGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:16px}.ccVendingGrid button{height:90px;border:3px solid #5b4a63;background:#e7f8ff;font-family:inherit;cursor:pointer}.ccVendingGrid small{display:block;font-size:7px;margin-top:8px}.sleepArea{left:550px;top:900px;width:500px;height:200px;background:#ddd2e8}.ccSleepBeds{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:15px}.ccSleepBeds div{height:100px;background:#fff;border:3px solid #69566f;display:flex;align-items:center;justify-content:center;flex-direction:column;font-size:25px}.ccSleepBeds small{font-size:8px}.massage{left:1080px;top:900px;width:300px;height:200px;background:#eee1ce;text-align:center}.ccMassageChairs{font-size:32px;padding:20px 0}.massage button,.teaCorner button{border:3px solid #5b4a63;background:#ffd45e;padding:7px;font-family:inherit;font-weight:900;cursor:pointer}.teaCorner{left:1410px;top:900px;width:300px;height:200px;background:#fff5df;text-align:center}.teaCorner button{margin-top:40px}
.ccSpaObj{position:absolute;z-index:9;border:4px solid #5b4a63;background:#ffd45e;font-family:inherit;font-weight:900;cursor:pointer}.ccSpaObj:hover{transform:translateY(-2px)}.ccSpaPlayerLayer{position:absolute;inset:0;pointer-events:none;z-index:30}.ccSpaPlayerLayer .ccAvatar{pointer-events:none}.ccSpaPlayerLayer .ccAvatar{pointer-events:none}.ccSpaNpcLayer{position:absolute;inset:0;z-index:22;pointer-events:none}.ccSpaNpc{position:absolute;transform:translate(-50%,-100%);font-size:34px;filter:drop-shadow(2px 3px 0 rgba(91,74,99,.18));animation:ccSpaNpcBob 2.8s steps(2,end) infinite}.ccSpaRoom.night .ccSpaMap{background:#eee9df}.ccSpaRoom.night .ccSpaCeiling{background-color:rgba(60,65,90,.14)}.ccSpaRoom.night .ccSpaHud{background:#f5f2ff}.ccSpaRoom.night .ccWindowScene{filter:brightness(.78)}@keyframes ccSpaNpcBob{0%,100%{transform:translate(-50%,-100%)}50%{transform:translate(-50%,calc(-100% - 3px))}}
.ccSpaExterior{position:relative;width:290px;height:245px;background:#f9e7c5;border:6px solid #5b4a63;box-shadow:10px 10px 0 rgba(91,74,99,.22);overflow:hidden}.ccSpaExterior.ccNear{transform:translateY(-5px)}.ccSpaExtRoof{height:58px;background:#d67f6f;color:#fff;padding:12px;text-align:center;font-size:17px;font-weight:900;border-bottom:5px solid #5b4a63}.ccSpaExtWindows{display:flex;gap:10px;padding:24px 15px}.ccSpaExtWindows i{width:48px;height:62px;background:linear-gradient(#9dddf1 0 55%,#6b8c98 56%);border:4px solid #5b4a63}.ccSpaExtDoor{position:absolute;bottom:25px;left:115px;width:60px;height:82px;background:#8cc5d1;border:5px solid #5b4a63;text-align:center;font-size:8px;padding-top:25px}.ccSpaExtSign{position:absolute;bottom:4px;left:10px;right:10px;background:#fff9df;border:3px solid #5b4a63;text-align:center;font-size:8px;font-weight:900;padding:4px}
@keyframes ccSpaSteam{0%,100%{transform:translateY(8px);opacity:.25}50%{transform:translateY(-10px);opacity:.8}}@keyframes ccBubble{0%{transform:translateY(30px);opacity:0}30%{opacity:.9}100%{transform:translateY(-180px);opacity:0}}@keyframes ccFire{0%,100%{transform:scale(.9)}50%{transform:scale(1.08)}}

.ccCottonCanvas{position:absolute;left:50%;top:48%;width:340px;height:340px;transform:translate(-50%,-50%);z-index:5;pointer-events:none;image-rendering:auto}.ccCottonCanvasDecor{position:relative;left:auto;top:auto;transform:none;width:340p
.ccAsphaltConnector{position:absolute;left:2060px;top:560px;width:260px;height:1800px;background:#64676b;border-left:8px solid #4d5053;border-right:8px solid #4d5053;z-index:1;box-shadow:inset 8px 0 0 rgba(255,255,255,.08),inset -8px 0 0 rgba(0,0,0,.12)}
.ccAsphaltConnector:before,.ccAsphaltConnector:after{content:"";position:absolute;top:0;bottom:0;width:5px;background:#eee;opacity:.7}.ccAsphaltConnector:before{left:16px}.ccAsphaltConnector:after{right:16px}.ccRoadCenter{position:absolute;left:50%;top:0;bottom:0;width:8px;transform:translateX(-50%);background:repeating-linear-gradient(to bottom,#f7e58b 0 44px,transparent 44px 88px)}
.ccRoadEdge{position:absolute;top:0;bottom:0;width:12px;background:#777b7f;opacity:.55}.ccRoadEdge.left{left:-28px}.ccRoadEdge.right{right:-28px}
x;height:340px;pointer-events:auto;cursor:crosshair}.ccDecorCottonWrap{width:340px;height:340px;display:flex;align-items:center;justify-content:center}.ccSpaClickable{pointer-events:none}.ccSpaClickable .ccBuilding{pointer-events:auto}


.ccShelfMiniCanvas{position:relative;width:82px;height:72px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center}.ccShelfMiniCanvas .ccCottonCanvas{position:absolute!important;left:50%!important;top:0!important;transform:translateX(-50%) scale(.25)!important;transform-origin:top center!important;pointer-events:none!important}
/* v7 interior scale + photo-inspired tabletop machine */
.ccCottonShop3D{gap:42px!important;padding:34px!important}
.ccCottonBigObject,.ccCottonShelfObject{width:46%!important;min-width:360px!important;height:460px!important}
.ccReferenceMachine{position:relative!important;width:290px!important;height:330px!important}
.ccReferenceMachine .ccShopCanopy{position:absolute;left:50%;top:8px;transform:translateX(-50%);width:245px;height:55px;border:5px solid #5b4a63;border-radius:50% 50% 42% 42%;background:repeating-linear-gradient(90deg,#ff98bf 0 6px,#ffc4da 6px 11px);z-index:6;box-shadow:0 7px 0 rgba(91,74,99,.14)}
.ccReferenceMachine .ccShopCanopy:after{content:"";position:absolute;left:50%;top:8px;transform:translateX(-50%);width:165px;height:26px;border-radius:50%;background:repeating-radial-gradient(ellipse at center,#fff 0 2px,#e886ac 2px 5px);opacity:.7}
.ccReferenceMachine .ccShopGlass{position:absolute;left:50%;top:54px;transform:translateX(-50%);width:255px;height:205px;border-left:4px solid #7b8790;border-right:4px solid #7b8790;background:linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.05),rgba(255,255,255,.35));z-index:2}.ccReferenceMachine .ccShopGlass i{position:absolute;top:65px;width:38px;height:38px;border-radius:50%;border:2px solid rgba(91,74,99,.25);background:rgba(255,172,201,.3)}.ccReferenceMachine .ccShopGlass i:nth-child(1){left:26px}.ccReferenceMachine .ccShopGlass i:nth-child(2){left:105px}.ccReferenceMachine .ccShopGlass i:nth-child(3){right:26px}
.ccReferenceMachine .ccMachineBowl{left:35px;top:166px;width:220px;height:120px;border-radius:50%;background:radial-gradient(ellipse at 50% 25%,#fff 0 26%,#aeb8bf 27% 34%,#f7f8f9 35% 57%,#858f97 58% 66%,#fff 67%);border:5px solid #5b4a63;z-index:5}.ccReferenceMachine .ccMachineBowl:after{left:76px;top:35px;width:60px;height:30px;border-radius:50%;background:#667177;border:4px solid #454d51}
.ccReferenceMachine .ccMachinePole{left:134px;top:160px;width:18px;height:110px;background:#aeb6ba;border:4px solid #5b4a63;z-index:4}
.ccReferenceMachine .ccShopBase{position:absolute;left:32px;bottom:5px;width:226px;height:58px;background:linear-gradient(#ff9fc6,#dd6e9d);border:5px solid #5b4a63;border-radius:22px 22px 10px 10px;z-index:8;display:flex;align-items:center;justify-content:flex-end;gap:13px;padding-right:14px}.ccReferenceMachine .ccShopBase i{width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid #5b4a63}.ccReferenceMachine .ccShopBase b{font-size:18px}
.ccCottonShelfDisplay{overflow:hidden}.ccCottonShelfDisplay .ccShelfRows{padding:34px 30px}.ccCottonShelfDisplay .ccShelfRow{height:94px}.ccCottonShelfDisplay .ccShelfSlot{height:72px}.ccCottonShelfDisplay .ccMiniCotton{width:58px;height:54px}
/* ===== v8: v5 cotton exterior/interior + current exact cotton display ===== */
.ccShelfMiniCanvas{position:relative;width:82px;height:72px;overflow:hidden;display:flex;align-items:flex-start;justify-content:center}.ccShelfMiniCanvas .ccCottonCanvas{position:absolute!important;left:50%!important;top:0!important;transform:translateX(-50%) scale(.25)!important;transform-origin:top center!important;pointer-events:none!important}
.ccDisplayCottonWrap{position:relative;width:340px;height:470px;display:flex;align-items:center;justify-content:center;overflow:visible}.ccDisplayStickBack{position:absolute;left:50%;top:240px;transform:translateX(-50%);width:14px;height:180px;background:linear-gradient(90deg,#fff,#d8d8d8);border:3px solid #5b4a63;z-index:1}.ccDisplayCottonWrap .ccCottonCanvas{position:absolute!important;left:50%!important;top:155px!important;transform:translateX(-50%)!important;z-index:3!important}.ccDisplayStickFront{position:absolute;left:50%;top:310px;transform:translateX(-50%);width:14px;height:115px;background:linear-gradient(90deg,#fff,#d8d8d8);border:3px solid #5b4a63;z-index:4}.ccDisplayName{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:14px;font-weight:1000;color:#5b4a63;white-space:nowrap;z-index:6;background:#fff7e8;padding:3px 9px;border:3px solid #5b4a63;box-shadow:3px 3px 0 rgba(91,74,99,.2)}
.ccSpaCottonRoad{display:none}
.ccParkConnectorRoad{position:absolute;left:690px;top:2670px;width:90px;height:300px;z-index:1;border-left:4px solid #d8c69e;border-right:4px solid #d8c69e;box-sizing:border-box}
.ccAsphaltConnector{position:absolute;left:2160px;top:780px;width:180px;height:1330px;background:#64676b;z-index:2;border-left:7px solid #4d5053;border-right:7px solid #4d5053;box-sizing:border-box;box-shadow:inset 9px 0 0 rgba(255,255,255,.08),inset -9px 0 0 rgba(0,0,0,.12)}
.ccRoadCenter{position:absolute;left:50%;top:0;bottom:0;width:7px;transform:translateX(-50%);background:repeating-linear-gradient(to bottom,#f7e58b 0 44px,transparent 44px 88px)}
.ccRoadEdge{position:absolute;top:0;bottom:0;width:4px;background:#eee;opacity:.72}.ccRoadEdge.left{left:18px}.ccRoadEdge.right{right:18px}
.ccBusCustomImage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:110px;height:150px;object-fit:contain;image-rendering:auto;filter:drop-shadow(4px 5px 0 rgba(91,74,99,.22))}
.ccBus{position:absolute;z-index:18;width:72px;height:118px;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;touch-action:manipulation;filter:drop-shadow(4px 5px 0 rgba(91,74,99,.22))}.ccBusBody{position:absolute;inset:0;background:#ffe37a;border:5px solid #5b4a63;border-radius:12px;box-sizing:border-box}.ccBusWindow{position:absolute;left:11px;top:13px;width:50px;height:27px;background:#a9e4ff;border:4px solid #5b4a63;border-radius:5px}.ccBusWindow.second{top:47px}.ccBusWheel{position:absolute;left:-8px;width:12px;height:24px;background:#3f3944;border:3px solid #5b4a63;border-radius:4px}.ccBusWheel.left{top:20px}.ccBusWheel.right{top:75px}.ccBusLight{position:absolute;bottom:-7px;width:15px;height:9px;background:#ff4f5e;border:3px solid #5b4a63;border-radius:4px;opacity:0}.ccBusLight.left{left:8px}.ccBusLight.right{right:8px}.ccBus.occupied .ccBusLight{opacity:1;box-shadow:0 0 10px #ff4f5e}.ccBusName{position:absolute;left:50%;top:-27px;transform:translateX(-50%);white-space:nowrap;background:#fff;border:3px solid #5b4a63;padding:3px 7px;font-size:10px;font-weight:900;color:#5b4a63}.ccBus.moving .ccBusBody{animation:ccBusBump .18s steps(2,end) infinite}@keyframes ccBusBump{50%{transform:translateY(-1px)}}
.ccParkGround{position:absolute;left:214px;top:2958px;width:1272px;height:470px;z-index:2;pointer-events:none}.ccParkCustomImage{display:block;object-fit:contain;image-rendering:auto;pointer-events:none}.ccParkSign .ccParkCustomImage.sign{width:100%;height:100%;object-fit:contain}.ccParkPond .ccParkCustomImage.pond{width:100%;height:100%;object-fit:contain}.ccParkGazebo .ccParkCustomImage.gazebo{width:100%;height:100%;object-fit:contain}.ccParkPlayground .ccParkCustomImage.playground{width:100%;height:100%;object-fit:contain}.ccParkPicnic .ccParkCustomImage.picnic{width:100%;height:100%;object-fit:contain}.ccParkFountain .ccParkCustomImage.fountain{width:100%;height:100%;object-fit:contain}.ccParkFlowers .ccParkCustomImage.flowers{width:100%;height:100%;object-fit:contain}.ccParkDogRun .ccParkCustomImage.dogrun{width:100%;height:100%;object-fit:contain}.ccParkDeco .ccParkCustomImage{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);width:76px;height:76px}.ccParkDeco .ccParkCustomImage.deco-tree{width:100px;height:120px}.ccParkDeco .ccParkCustomImage.deco-bench{width:88px;height:64px}.ccParkDeco .ccParkCustomImage.deco-lamp{width:70px;height:90px}
.ccParkSign{position:absolute;left:50%;top:20px;transform:translateX(-50%);background:#fff4cf;border:5px solid #5b4a63;padding:9px 18px;font-weight:1000;box-shadow:5px 5px 0 rgba(91,74,99,.18);text-align:center}.ccParkSign small{display:block;font-size:8px;opacity:.65}.ccParkPond{position:absolute;left:110px;top:190px;width:280px;height:130px;border:7px solid #5b4a63;border-radius:48%;background:#72c8e8;box-shadow:inset 0 0 0 7px #aee8f5}.ccParkPond span{position:absolute;left:70px;top:42px;font-size:24px}.ccParkPond i{position:absolute;width:16px;height:8px;border-radius:50%;background:#fff;opacity:.65;animation:parkRipple 2s steps(3,end) infinite}.ccParkPond i:nth-child(2){left:140px;top:38px}.ccParkPond i:nth-child(3){left:190px;top:78px;animation-delay:.6s}.ccParkPond i:nth-child(4){left:90px;top:88px;animation-delay:1.1s}
.ccParkGazebo{position:absolute;left:500px;top:75px;width:260px;height:170px;background:#d9c3a1;border:6px solid #5b4a63;box-shadow:8px 8px 0 rgba(91,74,99,.2);text-align:center}.ccParkGazebo .roof{font-size:54px;height:75px;background:#c88975}.ccParkGazebo .posts{font-size:34px;color:#6f503f;margin-top:12px}.ccParkGazebo b{font-size:10px}.ccParkPlayground{position:absolute;right:70px;top:115px;width:280px;height:170px;background:#e8d1ad;border:6px solid #5b4a63;text-align:center;box-shadow:8px 8px 0 rgba(91,74,99,.2)}.ccParkPlayground .slide,.ccParkPlayground .swing{display:inline-block;font-size:48px;margin:20px 20px 5px}.ccParkPlayground b{display:block;font-size:11px}.ccParkPicnic{position:absolute;left:430px;bottom:38px;width:260px;height:100px;background:#a8d98e;border:5px solid #5b4a63;text-align:center;padding-top:22px}.ccParkPicnic span{font-size:32px;margin:0 20px}.ccParkPicnic b{display:block;font-size:10px}.ccParkFountain{position:absolute;left:790px;bottom:65px;font-size:48px;text-align:center}.ccParkFountain small{display:block;font-size:9px;font-weight:900}.ccParkFlowers{position:absolute;left:80px;bottom:30px;font-size:28px}.ccParkDogRun{position:absolute;right:55px;bottom:20px;width:310px;height:70px;background:#d7c18d;border:5px dashed #5b4a63;text-align:center;padding-top:15px}.ccParkDogRun small{display:block;font-size:9px;font-weight:900}.ccParkDeco{position:absolute;transform:translate(-50%,-100%);font-size:38px;filter:drop-shadow(3px 4px 0 rgba(91,74,99,.18))}.ccParkDeco.bench{font-size:30px}.ccParkDeco.lamp{font-size:24px}

@keyframes parkRipple{0%,100%{transform:scale(.8);opacity:.3}50%{transform:scale(1.25);opacity:.8}}
/* ===== v6: pixel-art spa / lobby ===== */
.ccSpaRoom,.ccSpaLobby{font-family:inherit;image-rendering:pixelated;letter-spacing:.1px}
.ccSpaRoom{background:#d7c9ae!important}
.ccSpaMap{background:#cdbb9d!important;background-image:repeating-linear-gradient(0deg,rgba(90,70,48,.055) 0 2px,transparent 2px 8px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,transparent 2px 12px)!important}
.ccSpaArea{border:5px solid #5b4a63!important;border-radius:2px!important;box-shadow:7px 7px 0 rgba(63,49,48,.22)!important;background:#f1e4cf!important}
.ccSpaArea h3{font-family:inherit;text-shadow:2px 2px 0 #fff;letter-spacing:.5px}
.ccLocker,.ccShower,.ccMat,.ccHeatRooms>div,.ccPrivateTub{border-radius:0!important;box-shadow:inset 3px 3px 0 rgba(255,255,255,.35),3px 3px 0 rgba(63,49,48,.2)!important}
.ccSpaStairs{border-radius:2px!important;background:#8c6a50!important;color:#fff!important;border:4px solid #4e3b37!important;box-shadow:5px 5px 0 #4e3b37!important}
.ccOnsenWater{border-radius:48% 52% 50% 46%!important;border:10px solid #665447!important;background:#86b8ad!important;box-shadow:inset 0 0 0 7px #c7a977,inset 0 0 0 12px #6f9d94,8px 8px 0 rgba(55,45,43,.25)!important}
.ccPrivateTub{background:#8c735e!important;border:5px solid #4f403a!important}
.ccWindowScene{background:linear-gradient(#17344a,#315a68 55%,#244436)!important;border:7px solid #4f403a!important;box-shadow:inset 0 0 0 5px #8b6b4e!important}
.ccSpaNpc span{filter:saturate(.8);font-size:28px}
.ccSpaLobby{position:absolute;inset:0;background:#bcae96;overflow:hidden;z-index:40}
.ccLobbyPerspective{position:absolute;inset:0;overflow:hidden;background:#d9b88d}
.ccLobbyPhoto{background-position:center center;background-repeat:no-repeat;background-size:cover;image-rendering:auto}
.ccLobbyBackWall{position:absolute;left:30%;top:22%;width:40%;height:22%;text-align:center;background:#efe2c8;border:6px solid #5b4a63;box-shadow:8px 8px 0 rgba(63,49,48,.25);padding-top:26px}
.ccLobbyLogo{font-size:28px;font-weight:1000;color:#5b4a63;text-shadow:3px 3px 0 #fff}
.ccLobbySub{margin-top:8px;font-weight:900;color:#8c6f55}
.ccLobbyCounter{position:absolute;left:24%;right:24%;bottom:25%;height:27%;transform:perspective(600px) rotateX(8deg);filter:drop-shadow(9px 10px 0 rgba(50,40,38,.25))}
.ccLobbyCounterTop{height:32%;background:#d9b07a;border:6px solid #4f403a;display:flex;align-items:center;justify-content:space-between;padding:0 28px;color:#4f403a}
.ccLobbyCounterTop span{font-size:12px;font-weight:1000}.ccLobbyCounterTop b{font-size:24px}
.ccLobbyCounterFront{height:68%;background:#8a5c43;border:6px solid #4f403a;border-top:0;display:flex;align-items:center;justify-content:center;gap:70px;color:#ffeac7;font-weight:900}
.ccLobbyPlant{position:absolute;right:10%;bottom:27%;font-size:62px}.ccLobbyShoeRack{position:absolute;left:8%;bottom:22%;font-size:32px;background:#a06f4d;border:5px solid #4f403a;padding:12px 18px;box-shadow:5px 5px 0 #4f403a}.ccLobbyShoeRack small{display:block;font-size:12px;text-align:center;color:#fff}
.ccLobbyDialogue{display:none}
.ccLobbyBubble{position:absolute;z-index:32;min-height:64px;transform:translateX(-50%);box-sizing:border-box;background:#fffdf7;border:4px solid #4f403a;border-radius:18px;padding:13px 17px;box-shadow:5px 6px 0 rgba(63,49,48,.22);font-family:inherit;pointer-events:none}
.ccLobbyBubbleName{font-size:11px;font-weight:1000;color:#b15f72;margin-bottom:4px}.ccLobbyBubbleText{font-size:18px;line-height:1.45;font-weight:900;word-break:keep-all;text-align:center;min-height:27px}.ccLobbyBubbleTail{position:absolute;left:50%;bottom:-16px;width:22px;height:22px;background:#fffdf7;border-right:4px solid #4f403a;border-bottom:4px solid #4f403a;transform:translateX(-50%) rotate(45deg)}
.ccTypingCursor{display:inline-block;margin-left:2px;animation:ccTypingBlink .65s steps(1,end) infinite}@keyframes ccTypingBlink{50%{opacity:0}}
.ccLobbyActions{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);z-index:34;display:flex;flex-direction:column;align-items:center;gap:8px;max-width:90%}.ccLobbyActions .ccLobbyYesNo{margin-top:0;justify-content:center}.ccLobbyActions .ccLobbyYesNo button{min-width:82px;position:relative;z-index:60;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ccLobbyBubbleGear{position:absolute;right:22px;top:20px;z-index:50;border:3px solid #4f403a;background:#fff7e8;padding:7px 10px;font-family:inherit;font-weight:900;cursor:pointer;box-shadow:3px 3px 0 rgba(63,49,48,.25)}
.ccLobbyBubbleSettings{position:absolute;right:22px;top:62px;width:300px;max-height:78vh;overflow:auto;z-index:51;background:#fffdf7;border:4px solid #4f403a;box-shadow:6px 6px 0 rgba(63,49,48,.25);padding:12px}.ccLobbyBubbleSettings>b{display:block;margin-bottom:8px}.ccLobbyBubbleSettings label{display:grid;grid-template-columns:70px 1fr 42px;gap:7px;align-items:center;font-size:10px;font-weight:900;margin:8px 0}.ccLobbyBubbleSettings input{width:100%}.ccLobbyBubbleSettings span{text-align:right}.ccManageSection{border-top:2px dashed #cdbda9;margin-top:9px;padding-top:8px}.ccManageSection strong{display:block;font-size:11px;margin-bottom:4px}.ccLobbyManagePanel>small{display:block;margin-top:8px;line-height:1.4;color:#8c7b8d}
.ccLobbyPortrait{width:82px;height:82px;display:grid;place-items:center;background:#d7b9a0;border:5px solid #4f403a;font-size:46px;flex:none}.ccLobbyText{flex:1}.ccLobbyText>b{font-size:13px;color:#b15f72}.ccLobbyText h2{margin:3px 0 10px;font-size:20px}.ccLobbyChoices,.ccLobbyYesNo{display:flex;gap:8px;flex-wrap:wrap}.ccLobbyChoices button,.ccLobbyYesNo button{border:4px solid #4f403a;background:#f3dfb9;padding:8px 12px;font-family:inherit;font-weight:900;cursor:pointer;box-shadow:3px 3px 0 #4f403a}.ccLobbyChoices button.chosen{background:#f2a86d;transform:translate(2px,2px);box-shadow:1px 1px 0 #4f403a}.ccLobbyYesNo{margin-top:10px}.ccLobbyYesNo button:first-child{background:#8fc9a0}.ccLobbyYesNo button:last-child{background:#e8c4c4}.ccLobbyYesNo button:disabled{opacity:.4;cursor:not-allowed}.ccLobbyExit{position:absolute;right:22px;top:20px;border:4px solid #4f403a;background:#fff7e8;padding:8px 12px;font-weight:900;z-index:3}
.ccSpaBlush{position:absolute;width:8px;height:5px;background:#ef8d91;image-rendering:pixelated;z-index:30}.ccSpaSteam{position:absolute;color:#fff;font-size:34px;font-weight:1000;z-index:30;animation:ccSteamUp 1s steps(3,end) infinite}@keyframes ccSteamUp{50%{transform:translateY(-12px);opacity:.65}100%{transform:translateY(-22px);opacity:0}}
.ccSpaClickable .ccBuilding{image-rendering:pixelated}
.ccLobbyStaff{position:absolute;left:50%;top:29%;width:78px;height:150px;transform:translateX(-50%);z-index:25;image-rendering:pixelated}.ccStaffHair{position:absolute;left:18px;top:0;width:42px;height:34px;background:#5b4038;border:5px solid #4f403a}.ccStaffHead{position:absolute;left:22px;top:25px;width:34px;height:38px;background:#ffd0b5;border:5px solid #4f403a}.ccStaffBody{position:absolute;left:12px;top:60px;width:54px;height:68px;background:#f7f1e8;border:5px solid #4f403a}.ccStaffArm{position:absolute;left:58px;top:76px;width:24px;height:14px;background:#ffd0b5;border:4px solid #4f403a;transform:rotate(-8deg)}.ccLobbyPortrait{position:relative;overflow:hidden}.ccPortraitPixelHead{position:absolute;left:23px;top:10px;width:32px;height:32px;background:#ffd0b5;border:4px solid #4f403a}.ccPortraitPixelBody{position:absolute;left:17px;top:42px;width:44px;height:35px;background:#f7f1e8;border:4px solid #4f403a}.ccLobbySmallLine{font-size:13px;font-weight:900;margin-bottom:8px}.ccSpaTicket{display:flex;flex-direction:column;width:190px;background:#fff;border:3px dashed #777;padding:8px 10px;margin:8px 0;line-height:1.5;font-size:10px}.ccSpaTicket b{font-size:12px;border-bottom:2px dashed #aaa;padding-bottom:3px;margin-bottom:3px}.ccSpaLocker{display:inline-block;background:#f3dfb9;border:4px solid #4f403a;padding:8px 12px;font-size:13px;margin-bottom:7px}.ccLobbyElevatorView{background:linear-gradient(#8d969d 0 20%,#4f555a 20% 100%)!important}.ccElevatorCeiling{position:absolute;left:0;right:0;top:0;height:22%;background:#d9d1c3;border-bottom:6px solid #3f4246;text-align:center;padding-top:16px;font-weight:1000;color:#5b4a63}.ccElevatorFrame{position:absolute;left:18%;right:18%;top:20%;bottom:12%;background:#a9adb0;border:10px solid #3f4246;box-shadow:inset 0 0 0 8px #70767a}.ccElevatorDoor{position:absolute;top:8%;bottom:0;width:47%;background:linear-gradient(90deg,#cfd3d5,#8d9397);border:6px solid #3f4246}.ccElevatorDoor.left{left:0}.ccElevatorDoor.right{right:0}.ccElevatorGap{position:absolute;left:50%;top:8%;bottom:0;width:8px;transform:translateX(-50%);background:#303437;z-index:2}.ccElevatorPanel{position:absolute;right:-74px;top:38%;width:54px;background:#d8d0c3;border:5px solid #3f4246;padding:8px 4px;display:flex;flex-direction:column;gap:8px;align-items:center;z-index:5}.ccElevatorPanel span{font-size:20px;font-weight:1000}.ccElevatorPanel b{font-size:8px}.ccElevatorHint{position:absolute;left:0;right:0;bottom:7%;text-align:center;color:#fff;background:rgba(40,43,45,.7);padding:8px;font-weight:900}.ccElevatorButtons{position:absolute;left:50%;bottom:2%;transform:translateX(-50%);display:flex;gap:8px;z-index:10}.ccElevatorButtons button{border:4px solid #3f4246;background:#f3dfb9;padding:7px 13px;font-family:inherit;font-weight:1000;box-shadow:3px 3px 0 #3f4246;cursor:pointer}.ccElevatorButtons button small{font-size:8px}.ccSpaLobby .ccLobbyYesNo button{background:#8fc9a0}.ccSpaLobby .ccLobbyYesNo button:last-child{background:#e8c4c4}

.ccBuildingCustomImage{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto;filter:drop-shadow(4px 5px 0 rgba(91,74,99,.18))}
.ccSetToggle{width:100%;display:flex;align-items:center;justify-content:space-between;border:3px solid ${C.line};background:#fff;padding:10px 12px;margin:7px 0 0;font-family:inherit;font-weight:900;font-size:12px;cursor:pointer;box-shadow:3px 3px 0 rgba(91,74,99,.16)}
.ccSetToggle b{font-size:14px;color:${C.inkSoft}}.ccSetToggleBody{border:3px solid ${C.line};border-top:0;background:#fffdf7;padding:9px 10px;margin-bottom:2px;text-align:left}.ccSetToggleBody p{margin:0 0 8px;font-size:10.5px;line-height:1.45;color:${C.inkSoft};font-weight:700}.ccSetToggleBody .ccSetSkinBtn{margin-top:0}
.ccModalOverlay{position:fixed;inset:0;z-index:10000;background:rgba(45,34,52,.42);display:flex;align-items:center;justify-content:center;padding:18px}
.ccObjectSheet{width:min(430px,94vw);max-height:90vh;overflow:auto;padding:18px;text-align:center}
.ccObjectSheetHead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;text-align:left}.ccObjectSheetHead b{display:block;font-size:17px}.ccObjectSheetHead small{display:block;margin-top:4px;color:${C.inkSoft};font-size:10px;font-weight:700}
.ccObjectSheetSelect{width:100%;padding:10px;border:3px solid ${C.line};background:#fff;font-family:inherit;font-weight:900;font-size:12px;margin-bottom:10px}
.ccObjectSheetPreview{height:230px;border:3px solid ${C.line};display:flex;align-items:center;justify-content:center;overflow:hidden;background-color:#fff;background-image:linear-gradient(45deg,#e7dfea 25%,transparent 25%),linear-gradient(-45deg,#e7dfea 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e7dfea 75%),linear-gradient(-45deg,transparent 75%,#e7dfea 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0;margin-bottom:10px}.ccObjectSheetPreview img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto}.ccObjectSheetEmpty{font-size:12px;color:${C.inkSoft};font-weight:800}
.ccObjectSheetUpload{display:block;border:3px solid ${C.line};background:#ffe9c6;padding:11px;font-weight:900;cursor:pointer}.ccObjectSheetUpload input{display:none}.ccObjectSheetReset{width:100%;margin-top:7px;border:3px solid ${C.line};background:#f4eff6;padding:9px;font-family:inherit;font-weight:900;cursor:pointer}.ccObjectSheetHint{font-size:10px;line-height:1.5;color:${C.inkSoft};font-weight:700;margin:10px 0 0}
.ccObjectImageSettings{border:3px solid #5b4a63;background:#fffdf7;padding:9px;margin:8px 0;text-align:left}
.ccObjectImageSettings select{width:100%;border:2px solid #5b4a63;padding:6px;font-family:inherit;font-weight:800;background:#fff}
.ccObjectImageUpload{display:block;margin-top:7px;border:3px solid #5b4a63;background:#ffe9c6;padding:7px;text-align:center;font-weight:900;cursor:pointer}
.ccObjectImageUpload input{display:none}
.ccObjectImagePreview{margin-top:7px;display:flex;align-items:center;gap:7px}
.ccObjectImagePreview img{width:58px;height:58px;object-fit:contain;border:2px solid #5b4a63;background:#fff}
.ccObjectImageHint{display:block;margin-top:6px;font-size:9px;color:#8c7b8d;line-height:1.4}
.ccStaffHead{position:relative}
.ccStaffEye{position:absolute;width:5px;height:7px;background:#5b4a63;top:43%;z-index:3}
.ccStaffEye.e1{left:35%}.ccStaffEye.e2{right:35%}
.ccStaffNose{position:absolute;left:47%;top:55%;width:4px;height:5px;background:#d18b72;z-index:3}
.ccStaffMouth{position:absolute;left:43%;top:67%;width:16%;height:4px;border-bottom:3px solid #5b4a63;border-radius:0 0 8px 8px;z-index:3}
.ccLobbyDialogue{left:50%!important;right:auto!important;transform:translateX(-50%);width:min(760px,88%);text-align:center}
.ccLobbyText{align-items:center;text-align:center}
.ccLobbyText h2,.ccLobbySmallLine{text-align:center}
.ccLobbyYesNo{justify-content:center}
.ccLobbyPortrait{flex:none}
.ccFloorPickerOverlay{position:absolute;inset:0;background:rgba(65,54,75,.42);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.ccFloorPicker{width:min(430px,86vw);background:#fff;border:5px solid #5b4a63;box-shadow:8px 8px 0 rgba(91,74,99,.28);padding:16px;text-align:center}
.ccFloorPickerBtns{display:flex;flex-direction:column;gap:9px}
.ccFloorPickerBtns button{width:100%;min-height:82px;border:4px solid #5b4a63;background:#fff6dc;padding:12px 14px;font-family:inherit;font-weight:900;font-size:22px;cursor:pointer;touch-action:manipulation;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ccFloorPickerBtns button:hover,.ccFloorPickerBtns button:active{background:#ffd45e}
.ccFloorPickerBtns button strong{font-size:22px;line-height:1.1}
.ccFloorPickerBtns small{display:block;margin-top:7px;font-size:13px;line-height:1.2;color:#6f6072;font-weight:900}

.ccLobbyElevatorScene{position:absolute;inset:0;background-color:#dbe9ed;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:25;background-position:center;background-size:100% 100%;background-repeat:no-repeat;image-rendering:pixelated}
.ccElevatorPhotoScene{background-position:center center}
.ccElevatorSwitchHotspot{position:absolute;right:16.5%;top:38.2%;width:6.6%;height:18%;z-index:31;display:block;margin:0;padding:0;border:0;background:transparent;cursor:pointer;pointer-events:auto;appearance:none;-webkit-appearance:none;outline:none;box-shadow:none}
.ccElevatorSwitchHotspot:hover,.ccElevatorSwitchHotspot:focus,.ccElevatorSwitchHotspot:active{background:transparent;outline:none;box-shadow:none}
.ccLobbyElevatorScene .ccElevatorCeiling{position:absolute;top:35px;left:50%;transform:translateX(-50%);font-weight:900;letter-spacing:2px;color:#5b4a63}
.ccLobbyElevatorScene .ccElevatorFrame{position:relative;width:min(620px,68vw);height:430px;border:12px solid #5b4a63;background:#d8e1e3;box-shadow:0 12px 0 rgba(91,74,99,.2)}
.ccLobbyElevatorScene .ccElevatorDoor{position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(90deg,#bfcacc,#eef4f4,#b4c2c5);border:4px solid #6b777b}
.ccLobbyElevatorScene .ccElevatorDoor.left{left:0}.ccLobbyElevatorScene .ccElevatorDoor.right{right:0}
.ccLobbyElevatorScene .ccElevatorGap{position:absolute;left:50%;top:0;bottom:0;width:8px;background:#5b4a63;transform:translateX(-50%)}
.ccElevatorSwitch{display:flex;align-items:center;gap:14px;margin-top:20px}
.ccElevatorSwitch button{width:62px;height:62px;border:4px solid #5b4a63;background:#fff6dc;font-size:26px;font-weight:900;cursor:pointer}
.ccElevatorSwitch button:hover{background:#ffd45e}.ccElevatorSwitch span{font-weight:900}

.ccParkConnectorRoad{position:absolute;left:690px;top:2670px;width:90px;height:300px;z-index:1;border-left:4px solid #d8c69e;border-right:4px solid #d8c69e;box-sizing:border-box;background-repeat:repeat}
.ccAsphaltConnector{position:absolute;left:2160px;top:780px;width:180px;height:1330px;background:#64676b;z-index:2;border-left:7px solid #4d5053;border-right:7px solid #4d5053;box-sizing:border-box}

/* v31: 찜질스파 아이템 표시 보정 — CSS는 반드시 CSS 문자열 내부에 있어야 합니다. */
.ccSpaPickupItem{position:absolute!important;z-index:38;transform-origin:center center!important;animation:ccSpaItemGlow 1.15s steps(2,end) infinite;cursor:pointer;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;display:flex;flex-direction:column;align-items:center;pointer-events:auto}
.ccSpaPickupItem img{display:block;width:90px;height:90px;object-fit:contain;filter:drop-shadow(0 0 7px rgba(255,245,160,.9)) drop-shadow(3px 4px 0 rgba(63,49,48,.18))}
.ccSpaPickupItem span{margin-top:4px;background:#fff7df;border:3px solid #4f403a;padding:3px 7px;font-size:10px;font-weight:1000;box-shadow:3px 3px 0 #4f403a}
.ccSpaInventorySlot img{width:70%;height:70%;object-fit:contain}
.ccSpaInventory{z-index:40!important}
@keyframes ccSpaItemGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(255,245,160,.5));}50%{filter:drop-shadow(0 0 12px rgba(255,245,160,1));}}

/* v36: 찜질스파 인벤토리 — 우측 상단 가로형, 이후 층에서도 유지 */
.ccSpaInventory{position:absolute;right:18px;top:14px;z-index:45;width:auto;max-width:min(560px,62vw);pointer-events:none}
.ccSpaInventoryTitle{font-size:12px;font-weight:1000;letter-spacing:2px;color:#4f403a;text-align:right;margin-bottom:5px;text-shadow:2px 2px 0 #fff}
.ccSpaInventorySlots{display:flex;flex-direction:row;align-items:stretch;gap:7px;background:rgba(255,250,235,.95);border:4px solid #4f403a;padding:7px;box-shadow:5px 5px 0 rgba(63,49,48,.22);width:max-content}
.ccSpaInventorySlot{width:72px;height:72px;min-width:72px;background:#e7d9bf;border:3px solid #756354;display:flex;align-items:center;justify-content:center;box-shadow:inset 2px 2px 0 rgba(255,255,255,.55);box-sizing:border-box}
.ccSpaInventorySlot.filled{background:#fff3c9}
.ccSpaInventoryThumb{display:block!important;width:50px!important;height:50px!important;max-width:50px!important;max-height:50px!important;object-fit:contain!important;transform:none!important;filter:drop-shadow(1px 2px 0 rgba(79,64,58,.18))!important}
.ccSpaRoom .ccSpaInventory{position:absolute;top:80px;right:18px}

/* v32: 저장된 로비 아이템은 인벤토리에서 작게만 표시하고, 수령하면 화면에서 즉시 사라집니다. */
.ccSpaInventoryThumb{display:block!important;width:50px!important;height:50px!important;max-width:50px!important;max-height:50px!important;object-fit:contain!important;transform:none!important;filter:drop-shadow(1px 2px 0 rgba(79,64,58,.18))!important}
.ccSpaPickupItem{min-width:0!important;width:auto!important;min-height:0!important}
.ccSpaPickupItem img{width:90px!important;height:90px!important;max-width:90px!important;max-height:90px!important}
.ccSpaPickupItem span{background:#fff7df;border:3px solid #4f403a;padding:3px 7px;font-size:10px;font-weight:1000;box-shadow:3px 3px 0 #4f403a}
.ccLobbyManageSave{width:100%;margin-top:10px;border:4px solid #4f403a;background:#ffd45e;padding:9px 10px;font-family:inherit;font-weight:1000;cursor:pointer;box-shadow:3px 3px 0 #4f403a}
.ccLobbyManageSave:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #4f403a}

`;

