import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStatus, hasServer, joinRoom, deviceId, rememberHostCode, savedHostCode, startNewRound } from "./room.js";
import { CHAT_MS, joinChannel } from "./realtime.js";
import { CHAIRS, ROOM, ROOMS, RoomStage, SCREEN, depth, proj } from "./rooms.jsx";
import { blip, crunch, splash } from "./sfx.js";
import { MusicSheet, QuizSheet } from "./sheets.jsx";
import { findSfx, trackList, trackUrl } from "./content.js";
import { BUILDING_SPRITES, CHARACTERS, DECO, charForSlot, grassTile, pathTile, spriteURL } from "./sprites.js";

/* ===========================================================
   메롱 — 구름 위에 떠 있는 픽셀 마을
   방향키(또는 WASD)로 걷고, 건물 앞에서 Space, Enter 로 채팅해요.
   =========================================================== */

const WORLD = { w: 1700, h: 1080 };
const PLAY = { x0: 190, y0: 300, x1: 1520, y1: 900 };

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
  { id: "cake", name: "LP바", emoji: "🎧", tag: "음악", x: 430, y: 500, scale: 10,
    lines: [
      "오늘 밤 첫 곡 나갑니다. 헤드폰 하나 골라서 아무 자리나 앉으세요.",
      "신청곡 받아요. 구름 위에서 듣기 좋은 걸로 부탁드려요.",
      "여기선 아무 말 안 해도 돼요. 다들 각자 음악만 듣다 가거든요.",
    ] },
  { id: "candy", name: "퀴즈상가", emoji: "❓", tag: "퀴즈", x: 830, y: 430, scale: 10,
    lines: [
      "1번 문제! 구름사탕 마을에 건물이 몇 개 있게요? …너무 쉬웠나요?",
      "정답 맞히면 사탕 하나, 틀리면 사탕 두 개 드려요. 손해 볼 일 없어요.",
      "오답 노트를 여기 다 붙여놨어요. 아무도 안 가져가더라고요.",
    ] },
  { id: "post", name: "토끼 우체국", emoji: "💌", tag: "우편", x: 1270, y: 510, scale: 10,
    lines: [
      "편지 한 통 부치실래요? 토끼가 귀를 펄럭이며 배달해 드려요.",
      "구름 너머 마을까지도 이틀이면 도착해요. 비 오는 날엔 하루 더요.",
      "분홍 봉투에 넣으면 받는 사람이 열 때 반짝이가 쏟아져요. 인기 상품!",
    ] },
  { id: "flower", name: "ASMR 타운", emoji: "🎙️", tag: "ASMR", x: 590, y: 860, scale: 9,
    lines: [
      "쉿… 지금 빗소리 녹음 중이에요. 발소리만 살살 부탁드려요.",
      "여기 유리온실은 소리가 정말 잘 울려요. 한번 속삭여 보세요.",
      "가장 인기 있는 건 사탕 껍질 부스럭 소리래요. 이해는 안 되지만요.",
    ] },
  { id: "carousel", name: "떵개방", emoji: "🍜", tag: "먹방", x: 1160, y: 880, scale: 10,
    lines: [
      "지금 라이브 켜져 있어요! 뒤에서 손 흔들면 화면에 나와요.",
      "오늘 메뉴는 구름국수예요. 후루룩 소리가 제일 중요하대요.",
      "한 바퀴 돌면서 먹으면 두 배로 맛있다는 게 여기 규칙입니다.",
    ] },
];

const STAR_SPOTS = [
  [300, 700], [560, 640], [780, 930], [1000, 600], [1180, 700],
  [1440, 800], [980, 330], [430, 350], [1430, 380], [700, 980],
];

const CLOUDS = [
  [140, 90, 7], [520, 40, 5], [980, 120, 8], [1380, 60, 6],
  [1620, 190, 6], [300, 240, 4], [1120, 20, 4],
];

const TREES = [
  [250, 620, "#ff9ec4"], [340, 900, "#8fe3c9"], [990, 500, "#ffd45e"],
  [1470, 640, "#b6a6f0"], [880, 720, "#ff9ec4"], [1330, 960, "#8fe3c9"],
  [520, 420, "#ffd45e"], [1060, 990, "#b6a6f0"],
];

/* 섬 — 계단식 사각형으로 쌓아 픽셀 느낌을 냅니다 */
const ISLAND = [
  { x: 180, y: 200, w: 1340, h: 24 },
  { x: 140, y: 224, w: 1420, h: 24 },
  { x: 116, y: 248, w: 1468, h: 640 },
  { x: 140, y: 888, w: 1420, h: 24 },
  { x: 180, y: 912, w: 1340, h: 24 },
];
const SOIL = [
  { x: 220, y: 936, w: 1260, h: 40 },
  { x: 300, y: 976, w: 1100, h: 36 },
  { x: 430, y: 1012, w: 840, h: 28 },
  { x: 620, y: 1040, w: 460, h: 24 },
];
const PATHS = [
  { x: 380, y: 552, w: 940, h: 64 },
  { x: 800, y: 452, w: 64, h: 116 },
  { x: 400, y: 500, w: 64, h: 64 },
  { x: 1240, y: 528, w: 64, h: 40 },
  { x: 560, y: 616, w: 64, h: 216 },
  { x: 1128, y: 616, w: 64, h: 240 },
  { x: 560, y: 816, w: 632, h: 48 },
];
const POND = [
  { x: 1360, y: 780, w: 168, h: 24 },
  { x: 1336, y: 804, w: 216, h: 64 },
  { x: 1360, y: 868, w: 168, h: 20 },
];

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

function Pix({ map, palette, scale, cacheKey, className, style, alt = "" }) {
  const url = useMemo(() => spriteURL(map, palette, cacheKey), [map, palette, cacheKey]);
  return (
    <img
      src={url}
      alt={alt}
      draggable={false}
      className={"ccPix " + (className || "")}
      style={{ width: map[0].length * scale, height: map.length * scale, ...style }}
    />
  );
}

/* ============================ 건물 ============================ */

function Building({ b, near }) {
  const sp = BUILDING_SPRITES[b.id];
  const w = 24 * b.scale;
  const h = 22 * b.scale;
  return (
    <div className="ccBuilding" style={{ left: b.x - w / 2, top: b.y - h, width: w }}>
      <Pix map={sp.map} palette={sp.palette} scale={b.scale} cacheKey={"b-" + b.id} className={near ? "ccNear" : ""} />
      <div className="ccSign">
        {b.emoji} {b.name}
      </div>
      {near && <div className="ccPrompt">SPACE 로 들어가기</div>}
    </div>
  );
}

/* ============================ 캐릭터 ============================ */

function Avatar({ name, slot, x, y, facing, moving, me, msg, scale = 1, swim = false }) {
  const ch = charForSlot(slot);
  return (
    <div
      className={"ccAvatar" + (swim ? " ccSwim" : "")}
      style={{
        left: x,
        top: y,
        zIndex: Math.round(y) + 1,
        transform: `translate(-50%,-100%) scale(${scale})`,
      }}
    >
      {msg && <div className="ccBubble">{msg}</div>}
      {swim && <div className="ccTube ccTubeBack" />}
      <div className={"ccTag" + (me ? " ccTagMe" : "")}>{name}</div>
      <Pix
        map={ch.map}
        palette={ch.palette}
        scale={PX}
        cacheKey={"c-" + ch.id}
        className={(moving ? "ccWalk " : "") + (facing < 0 ? "ccFlip" : "")}
      />
      {swim && <div className="ccTube ccTubeFront" />}
    </div>
  );
}


/* ============================ 조이스틱 ============================ */

const STICK_R = 44;     // 손잡이가 움직일 수 있는 반경
const DEADZONE = 0.18;

function Stick({ onMove }) {
  const base = useRef(null);
  const ptr = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const apply = (e) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const cap = Math.min(1, d / STICK_R);
    dx = (dx / d) * STICK_R * cap;
    dy = (dy / d) * STICK_R * cap;
    setKnob({ x: dx, y: dy });
    const nx = dx / STICK_R;
    const ny = dy / STICK_R;
    onMove(Math.hypot(nx, ny) < DEADZONE ? { x: 0, y: 0 } : { x: nx, y: ny });
  };

  const start = (e) => {
    /* 채팅 입력 중이었다면 키보드를 내려서 조작을 막지 않게 합니다 */
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    ptr.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    apply(e);
  };
  const move = (e) => {
    if (ptr.current !== e.pointerId) return;
    apply(e);
  };
  const end = (e) => {
    if (ptr.current !== e.pointerId) return;
    ptr.current = null;
    setKnob({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  return (
    <div
      className="ccStick"
      ref={base}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="ccStickKnob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
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
      {POND.map((r, i) => slab(r, "w" + i, { background: i === 1 ? C.pond : C.pondDark }))}
      <div className="ccSlab" style={{ left: 1372, top: 816, width: 48, height: 12, background: "#ffffff", opacity: 0.7 }} />
    </div>
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

  const taken = status?.taken ?? 0;
  const cap = status?.capacity ?? 5;
  const full = status?.ok && status.full;

  return (
    <div className="ccGate">
      <div className="ccGateSky" />
      <form className="ccPanel ccGateCard" onSubmit={submit}>
        <div className="ccGateChars">
          {CHARACTERS.slice(1).map((c, i) => (
            <Pix
              key={c.id}
              map={c.map}
              palette={c.palette}
              scale={3}
              cacheKey={"c-" + c.id}
              className={i < taken ? "ccGateCharOn" : "ccGateCharOff"}
            />
          ))}
        </div>
        <h1 className="ccGateTitle">메롱</h1>
        <p className="ccGateSub">
          {hasServer ? `${status?.round ?? "-"}번 테스트` : "서버 없이 둘러보기"}
        </p>

        {notice && <div className="ccNotice">{notice}</div>}

        {hasServer && (
          <div className={"ccSeatCount" + (full ? " ccSeatFull" : "")}>
            {full ? `정원 마감 ${cap} / ${cap}` : `${taken} / ${cap} 명 입장`}
          </div>
        )}

        <input
          className="ccInput"
          value={name}
          maxLength={12}
          placeholder="이름을 정해주세요"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

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

        <button className="ccBtn ccGateBtn" type="submit" disabled={busy || (full && !showCode)}>
          {busy ? "입장하는 중…" : full && !showCode ? "정원이 찼어요" : "마을로 들어가기"}
        </button>

        {solo && (
          <button
            type="button"
            className="ccLinkBtn ccSoloBtn"
            onClick={() => onJoined({ name: name.trim() || "손님", role: "solo", slot: 1 })}
          >
            서버 없이 혼자 둘러보기 →
          </button>
        )}

        {hasServer && (
          <p className="ccGateNote">
            선착순 {cap}명까지 들어올 수 있어요. 진행 상황은 저장되지 않습니다.
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
  const [pos, setPos] = useState({ x: 850, y: 660 });
  const [facing, setFacing] = useState(1);
  const [moving, setMoving] = useState(false);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [view, setView] = useState({ w: 1000, h: 700 });
  const [zoom, setZoom] = useState(1);
  const [nearId, setNearId] = useState(null);
  const [stars, setStars] = useState(() => STAR_SPOTS.map(() => false));
  const [toast, setToast] = useState("");
  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState([]);
  const [panel, setPanel] = useState(false);
  const [chatText, setChatText] = useState("");
  const [scene, setScene] = useState(null);      // null = 마을, 아니면 건물 id
  const [zoneId, setZoneId] = useState(null);    // 방 안에서 가까이 있는 설치물
  const [sheet, setSheet] = useState(null);      // 'lp' | 'quiz'
  const [wave, setWave] = useState(0);
  const [chatLog, setChatLog] = useState([]);
  const [history, setHistory] = useState([]);   // 이번 회차 대화 기록
  const [logOpen, setLogOpen] = useState(false);
  const [track, setTrack] = useState(null);   // 지금 듣는 곡
  const [sit, setSit] = useState(null);      // 앉아 있는 의자 번호
  const [vol, setVol] = useState(() => {
    const v = Number(localStorage.getItem("ccVol"));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.7;
  });
  const [muted, setMuted] = useState(false);
  const [myMsg, setMyMsg] = useState(null);
  const [roundInput, setRoundInput] = useState(String((me.round ?? 1) + 1));
  const [resetting, setResetting] = useState(false);

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
  const splashUrl = useRef(null);
  const chairRef = useRef(null);
  const audio = useRef(null);
  const chatBox = useRef(null);
  const myMsgTimer = useRef(null);

  useEffect(() => { openRef.current = !!sheet; sheetRef.current = sheet; }, [sheet]);
  useEffect(() => { viewRef.current = { ...view, z: zoom }; }, [view, zoom]);
  useEffect(() => { starsRef.current = stars; }, [stars]);

  const collected = stars.filter(Boolean).length;
  const online = me.role === "solo" ? 1 : peers.length + 1;

  /* 건물 안으로 */
  const enterRoom = useCallback((id) => {
    if (!ROOMS[id]) return;
    worldPos.current = { ...posRef.current };
    sceneRef.current = id;
    const start = { x: ROOM.w / 2, y: ROOM.d - 60 };
    posRef.current = start;
    setPos(start);
    setScene(id);
    setSheet(null);
    setToast(`${ROOMS[id].emoji} ${ROOMS[id].name} — ${ROOMS[id].hint}`);
  }, []);

  /* 마을로 */
  const exitRoom = useCallback(() => {
    sceneRef.current = null;
    zoneRef.current = null;
    sitRef.current = null;
    setSit(null);
    setZoneId(null);
    setSheet(null);
    const back = worldPos.current;
    posRef.current = { ...back };
    setPos({ ...back });
    setScene(null);
  }, []);

  /* 방 안에서 설치물 사용 */
  const activateZone = useCallback((id) => {
    /* 앉아 있으면 무엇을 누르든 먼저 일어납니다 */
    if (sitRef.current != null) {
      const c = CHAIRS[sitRef.current];
      sitRef.current = null;
      setSit(null);
      const room = ROOMS[sceneRef.current];
      const back = room ? freeSpot(room, c.x, c.y) : { x: c.x, y: c.y + 60 };
      posRef.current = back;
      setPos(back);
      return;
    }
    if (!id) return;
    if (id === "exit") { exitRoom(); return; }
    if (id === "chair") {
      const i = chairRef.current;
      const c = CHAIRS[i];
      if (!c) return;
      sitRef.current = i;
      setSit(i);
      posRef.current = { x: c.x, y: c.y };
      setPos({ x: c.x, y: c.y });
      blip(760);
      return;
    }
    setSheet(id);
  }, [exitRoom]);

  const openBuilding = useCallback((id) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;

    enterRoom(id);
  }, [enterRoom]);

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
      if (e.target instanceof HTMLInputElement) return;
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === " ") {
        if (sheetRef.current) { setSheet(null); return; }
        if (sceneRef.current) activateZone(zoneRef.current);
        else if (nearRef.current) openBuilding(nearRef.current);
        return;
      }
      if (k === "enter") {
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
  }, [openBuilding, activateZone]);

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
      if (openRef.current || sitRef.current != null) { dx = 0; dy = 0; }

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
        if (!hit(nx, y)) x = nx;
        const ny = clamp(y + (dy / len) * sp, bounds.y0, bounds.y1);
        if (!hit(x, ny)) y = ny;
        posRef.current = { x, y };
        setPos({ x, y });
        if (dx !== 0) {
          facingRef.current = dx > 0 ? 1 : -1;
          setFacing(facingRef.current);
        }
      }
      if (isMoving !== movingRef.current) {
        movingRef.current = isMoving;
        setMoving(isMoving);
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
        if (z !== zoneRef.current) { zoneRef.current = z; setZoneId(z); }

        /* 낙엽 밟는 소리 */
        if (room.crunch && isMoving) {
          const d = Math.hypot(p.x - room.crunch.x, (p.y - room.crunch.y) * 1.6);
          if (d < room.crunch.r && now - sfxAt.current > 380) {
            sfxAt.current = now;
            crunch();
          }
        }

        /* 수영 */
        if (room.water) {
          const w = room.water;
          const inWater =
            Math.abs(p.x - w.x) < w.w / 2 && Math.abs(p.y - w.y) < w.d / 2;
          if (inWater !== swimRef.current) {
            swimRef.current = inWater;
            if (inWater) { splash(splashUrl.current); sfxAt.current = now; }
          } else if (inWater && isMoving && now - sfxAt.current > 700) {
            sfxAt.current = now;
            splash(splashUrl.current);
          }
          setWave(now / 260);
        }

        camRef.current = { x: 0, y: 0 };
        raf = requestAnimationFrame(step);
        return;
      }

      /* --- 마을 --- */
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
      }

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
  }, []);

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
      }),
      onPeers: setPeers,
      /* 다른 방에 있는 사람의 채팅은 말풍선 대신 목록으로 */
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
  }, [chatText, me]);

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
      const s = findSfx(list, "splash");
      splashUrl.current = s ? trackUrl(s.path) : null;
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
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [me, onKick]);

  /* 회차 지정 (호스트 전용) */
  const doRound = useCallback(async (n) => {
    if (resetting) return;
    setResetting(true);
    const r = await startNewRound(me.hostCode, n);
    setResetting(false);
    if (r?.ok) {
      setRoom({ ok: true, round: r.round, capacity: r.capacity, taken: 0, players: [] });
      setToast(`${r.round}번 테스트를 시작했어요. 자리 ${r.capacity}개가 비었습니다`);
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

  const ordered = useMemo(() => [...BUILDINGS].sort((a, b) => a.y - b.y), []);
  const roundNo = room?.round ?? me.round;
  const R = scene ? ROOMS[scene] : null;
  const here = scene || "";
  const roomPeers = peers.filter((p) => (p.r || "") === here);
  const seats = R?.chairs
    ? [...roomPeers.filter((q) => q.st >= 0).map((q) => q.st), ...(sit == null ? [] : [sit])]
    : [];
  const roomZoom = R
    ? Math.min(view.w / (SCREEN.w + 40), (view.h - 90) / (SCREEN.h + 20), 1.15)
    : 1;

  return (
    <div className="ccRoot">
      <style>{CSS}</style>
      {scene ? (
        <div className="ccRoomBg" style={{ background: R.wallDark }}>
          <div
            className="ccRoomWrap"
            style={{ width: SCREEN.w, height: SCREEN.h, transform: `translate(-50%,-50%) scale(${roomZoom})` }}
          >
            <RoomStage room={R} waterPhase={wave} seats={seats} />
            <div className="ccRoomLayer">
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
                    msg={q.msg}
                    scale={pr.k}
                    swim={inWater(R, q.x, q.y)}
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
                msg={myMsg}
                scale={depth(pos.y)}
                swim={inWater(R, pos.x, pos.y)}
              />
            </div>
          </div>
          {zoneId && (
            <button className="ccZoneHint" onClick={() => activateZone(zoneId)}>
              SPACE — {zoneId === "chair" ? (sit == null ? "앉기" : "일어나기") : R.zones.find((z) => z.id === zoneId)?.label}
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
              <Avatar key={p.id} name={p.name} slot={p.slot} x={p.x} y={p.y} facing={p.f} moving={!!p.m} msg={p.msg} />
            ))}

            <Avatar name={me.name} slot={me.slot} x={pos.x} y={pos.y} facing={facing} moving={moving} me msg={myMsg} />
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
        <div className="ccChip">{me.role === "host" ? "왕관" : charForSlot(me.slot).label} · {me.name}</div>
        <div className="ccChip">별 {collected} / {STAR_SPOTS.length}</div>
        {me.role !== "solo" && <div className="ccChip">접속 {online}명</div>}
      </div>

      {/* 우측 상단 — 회차 */}
      {roundNo != null && (
        <div className="ccRound">
          <span className="ccRoundNum">{roundNo}</span>번 테스트
          {room?.ok && <span className="ccRoundSub">{room.taken} / {room.capacity}</span>}
        </div>
      )}

      {me.role === "solo" ? (
        <div className="ccHelp">방향키 · WASD 이동 / 건물 앞에서 SPACE</div>
      ) : (
        <>
        {logOpen && (
          <div className="ccPanel ccHistory">
            <div className="ccSheetHead">
              <h2 className="ccSheetTitle">대화 기록</h2>
              <button className="ccX" onClick={() => setLogOpen(false)}>✕</button>
            </div>
            <div className="ccHistoryBody">
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
            placeholder="Enter 를 눌러 채팅…"
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
          />
          <button className="ccChatBtn" type="submit">보내기</button>
          <button
            className="ccChatBtn ccLogBtn"
            type="button"
            title="대화 기록"
            onClick={() => setLogOpen((v) => !v)}
          >
            기록
          </button>
        </form>
        </>
      )}

      {toast && <div className="ccToast">{toast}</div>}

      {/* 다른 방에서 온 채팅 */}
      {chatLog.length > 0 && (
        <div className="ccLog">
          {chatLog.map((m, i) => (
            <div key={m.at + "-" + i} className="ccLogLine">
              <b>{m.name}</b>
              <span className="ccLogRoom">{m.r ? ROOMS[m.r]?.name : "마을"}</span>
              {m.text}
            </div>
          ))}
        </div>
      )}

      {me.role === "host" && (
        <>
          <button className="ccChip ccHostBtn" onClick={() => setPanel((v) => !v)}>
            테스트 관리
          </button>
          {panel && (
            <div className="ccPanel ccHostPanel">
              <div className="ccHostTitle">{roundNo}번 테스트</div>
              <div className="ccHostCount">게스트 {room?.taken ?? 0} / {room?.capacity ?? 5}</div>
              <ul className="ccHostList">
                {(room?.players || []).map((p, i) => (
                  <li key={i}>
                    {p.role === "host" ? "왕관" : charForSlot(p.slot).label} · {p.name}
                  </li>
                ))}
                {!room?.players?.length && <li className="ccHostEmpty">아직 아무도 안 왔어요</li>}
              </ul>
              <div className="ccRoundRow">
                <input
                  className="ccInput ccRoundInput"
                  value={roundInput}
                  inputMode="numeric"
                  onChange={(e) => setRoundInput(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <button
                  className="ccBtn ccRoundBtn"
                  onClick={() => doRound(Number(roundInput) || null)}
                  disabled={resetting}
                >
                  {resetting ? "…" : "이 번호로 시작"}
                </button>
              </div>
              <button className="ccBtn ccHostReset" onClick={() => doRound(null)} disabled={resetting}>
                다음 회차로 넘기기
              </button>
              <p className="ccHostNote">
                시작하면 그 회차 참가자 기록이 지워지고 자리 {room?.capacity ?? 5}개가 새로 열려요.
                이미 들어와 있던 사람은 새로고침해야 합니다.
              </p>
            </div>
          )}
        </>
      )}

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


      {sheet && (
        <div className="ccModalWrap" onClick={() => setSheet(null)}>
          {sheet === "lp" && (
            <MusicSheet
              hostCode={me.hostCode}
              isHost={me.role === "host"}
              playingId={track?.id}
              onPlay={(t) => setTrack(t)}
              onClose={() => setSheet(null)}
            />
          )}
          {sheet === "quiz" && (
            <QuizSheet hostCode={me.hostCode} isHost={me.role === "host"} onClose={() => setSheet(null)} />
          )}
        </div>
      )}

      {/* 재생바 — 방을 옮겨도 계속 나옵니다 */}
      {track && (
        <div className="ccPlayBar">
          <span className="ccPlayDisc">◉</span>
          <span className="ccPlayTitle">{track.title}</span>
          <button
            className="ccPlayBtn"
            title="재생 / 일시정지"
            onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play(); else a.pause(); }}
          >
            ⏯
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
          <button className="ccPlayBtn" title="끄기" onClick={() => setTrack(null)}>✕</button>
        </div>
      )}
      {track && <audio ref={audio} src={track.url} autoPlay loop onError={() => setToast("곡을 재생하지 못했어요")} />}

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

const CSS = `
*{box-sizing:border-box}
html,body,#root{height:100%;margin:0}
body{font-family:"DungGeunMo","Galmuri11","Pretendard","Malgun Gothic",system-ui,sans-serif;
  -webkit-font-smoothing:none;letter-spacing:.02em}
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
.ccBubble{position:relative;max-width:170px;margin:0 auto 10px;white-space:pre-wrap;word-break:break-all;
  text-align:center;font-size:12px;font-weight:700;line-height:1.4;background:#fff;border:3px solid ${C.line};
  padding:9px 15px;border-radius:999px;box-shadow:3px 3px 0 rgba(91,74,99,.2);animation:ccPop .12s steps(2,end)}
.ccBubble:after{content:"";position:absolute;left:50%;top:100%;margin-left:-9px;margin-top:1px;
  width:9px;height:9px;border-radius:50%;background:#fff;border:3px solid ${C.line}}
.ccBubble:before{content:"";position:absolute;left:50%;top:calc(100% + 12px);margin-left:-3px;
  width:5px;height:5px;border-radius:50%;background:#fff;border:2px solid ${C.line};z-index:1}
@keyframes ccPop{from{transform:translateY(6px)}to{transform:translateY(0)}}

.ccChatBar{position:absolute;left:50%;bottom:calc(14px + var(--kb, 0px));transform:translateX(-50%);display:flex;gap:6px;
  width:min(420px,86vw)}
.ccChatInput{flex:1;border:3px solid ${C.line};background:rgba(255,255,255,.95);padding:9px 11px;
  font-size:13px;font-weight:700;color:${C.ink};font-family:inherit;outline:none;
  box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccChatInput:focus{background:#fffbe8}
.ccChatBtn{border:3px solid ${C.line};background:#ffd45e;color:${C.ink};font-weight:700;font-size:12px;
  padding:9px 12px;cursor:pointer;font-family:inherit;box-shadow:3px 3px 0 rgba(91,74,99,.25)}
.ccChatBtn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(91,74,99,.25)}

.ccTree{position:absolute;animation:ccSway 3s steps(3,end) infinite}
@keyframes ccSway{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
.ccStar{position:absolute;z-index:5;animation:ccStarF 1.6s steps(3,end) infinite}
@keyframes ccStarF{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}

/* 공통 패널 — 픽셀 테두리 */
.ccPanel{background:#fff;border:4px solid ${C.line};box-shadow:6px 6px 0 rgba(91,74,99,.3)}
.ccChip{background:#fff;border:3px solid ${C.line};padding:6px 11px;font-weight:700;font-size:12px;
  box-shadow:3px 3px 0 rgba(91,74,99,.25);color:${C.ink};font-family:inherit}
.ccHud{position:absolute;left:14px;top:14px;display:flex;gap:8px;flex-wrap:wrap;max-width:52vw}

.ccRound{position:absolute;right:14px;top:14px;background:#ffe9a8;border:4px solid ${C.line};
  padding:8px 14px;font-weight:700;font-size:14px;box-shadow:4px 4px 0 rgba(91,74,99,.3);
  display:flex;align-items:baseline;gap:6px}
.ccRoundNum{font-size:22px;font-weight:900}
.ccRoundSub{font-size:11px;color:${C.inkSoft};margin-left:4px}

.ccHelp{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font-size:11px;font-weight:700;
  color:${C.ink};background:rgba(255,255,255,.9);border:2px solid ${C.line};padding:5px 10px;white-space:nowrap}
.ccToast{position:absolute;left:50%;top:74px;transform:translateX(-50%);background:#fff;border:4px solid ${C.line};
  padding:9px 16px;font-weight:700;font-size:13px;box-shadow:4px 4px 0 rgba(91,74,99,.3);white-space:nowrap}

.ccHostBtn{position:absolute;right:14px;top:70px;cursor:pointer}
.ccHostPanel{position:absolute;right:14px;top:110px;width:250px;padding:14px}
.ccHostTitle{font-weight:900;font-size:15px}
.ccHostCount{font-size:12px;font-weight:700;color:${C.inkSoft};margin-top:3px}
.ccHostList{list-style:none;margin:9px 0;padding:0;max-height:150px;overflow:auto;font-size:12px;font-weight:700;line-height:1.85}
.ccHostEmpty{color:${C.inkSoft}}
.ccRoundRow{display:flex;gap:6px;margin-top:6px}
.ccRoundInput{width:64px;padding:8px;font-size:14px;text-align:center}
.ccRoundBtn{flex:1;font-size:11px;padding:8px 6px;background:#ffd45e;color:${C.ink}}
.ccHostReset{width:100%;margin-top:6px;font-size:11px;padding:8px;background:#fff;color:${C.ink}}
.ccHostNote{margin:9px 0 0;font-size:10.5px;line-height:1.6;color:${C.inkSoft};font-weight:700}

.ccExitChip{cursor:pointer;background:#ffe9a8}
.ccHistory{position:absolute;left:50%;bottom:calc(66px + var(--kb, 0px));transform:translateX(-50%);
  width:min(420px,90vw);max-height:52vh;display:flex;flex-direction:column;padding:14px 16px;z-index:22}
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
.ccQuizImg{position:relative;border:4px solid ${C.line};background:#f4eef6;margin-bottom:10px}
.ccQuizImg img{display:block;width:100%;max-height:38vh;object-fit:contain}
.ccMark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:96px;font-weight:900}
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

/* 방 내부 */
.ccRoomBg{position:absolute;inset:0;overflow:hidden}
.ccRoomWrap{position:absolute;left:50%;top:50%;transform-origin:50% 50%}
.ccRoomSvg{position:absolute;left:0;top:0;image-rendering:auto}
.ccRoomLayer{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
.ccZoneHint{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);background:#fff;
  border:4px solid ${C.line};padding:9px 16px;font-size:13px;font-weight:700;color:${C.ink};
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
.ccStick{position:absolute;left:20px;bottom:calc(20px + var(--kb, 0px));width:124px;height:124px;border-radius:50%;
  border:4px solid ${C.line};background:rgba(255,255,255,.72);touch-action:none;
  box-shadow:4px 4px 0 rgba(91,74,99,.25);display:flex;align-items:center;justify-content:center}
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

@media (hover:none) and (pointer:coarse){
  .ccTouch{display:block}
  .ccHelp{display:none}
  .ccChatBar{left:150px;transform:none;width:min(300px,44vw);bottom:16px}
  .ccHud{max-width:44vw}
  .ccHud .ccChip{font-size:11px;padding:5px 9px}
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
.ccModalEmoji{font-size:42px;line-height:1}
.ccModalTag{display:inline-block;margin-top:10px;border:2px solid ${C.line};padding:2px 10px;font-size:11px;font-weight:700;background:#ffe9a8}
.ccModalName{margin:9px 0 8px;font-size:19px;font-weight:900}
.ccModalLine{margin:0 0 18px;font-size:13.5px;line-height:1.75;color:${C.inkSoft};font-weight:700}

/* 입장 화면 */
.ccGate{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto}
.ccGateSky{position:absolute;inset:0;background:linear-gradient(180deg,${C.sky1} 0%,${C.sky2} 60%,${C.sky3} 100%)}
.ccGateCard{position:relative;width:min(340px,92vw);padding:22px;text-align:center}
.ccGateChars{display:flex;justify-content:center;gap:4px;margin-bottom:8px}
.ccGateCharOn{animation:ccWalk .5s steps(2,end) infinite}
.ccGateCharOff{filter:grayscale(1);opacity:.35}
.ccGateTitle{margin:4px 0 2px;font-size:22px;font-weight:900}
.ccGateSub{margin:0 0 12px;font-size:12px;font-weight:700;color:${C.inkSoft}}
.ccSeatCount{margin:0 0 12px;font-size:13px;font-weight:900;color:#2e9e78}
.ccSeatFull{color:#e0685f}
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
