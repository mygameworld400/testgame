import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchStatus, hasServer, joinRoom, deviceId, rememberHostCode, savedHostCode, startNewRound } from "./room.js";
import { joinChannel } from "./realtime.js";
import { BUILDING_SPRITES, CHARACTERS, DECO, charForSlot, grassTile, pathTile, spriteURL } from "./sprites.js";

/* ===========================================================
   구름사탕 마을 — 구름 위에 떠 있는 픽셀 사탕 마을
   방향키(또는 WASD)로 걷고, 건물 앞에서 Space 로 들어가요.
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
  { id: "cake", name: "폭신폭신 케이크 카페", emoji: "🍰", tag: "카페", x: 430, y: 500, scale: 10,
    lines: [
      "딸기 생크림 한 조각 드릴까요? 오늘은 유난히 폭신하게 구워졌어요.",
      "창가 자리가 비었어요. 구름이 지나가는 게 제일 잘 보이는 자리랍니다.",
      "설탕을 너무 많이 넣어서 케이크가 살짝 떠올랐어요. 붙잡아 주세요!",
    ] },
  { id: "candy", name: "알록달록 사탕가게", emoji: "🍭", tag: "상점", x: 830, y: 430, scale: 10,
    lines: [
      "오늘의 사탕은 '무지개 소용돌이' 맛이에요. 세 번 핥으면 색이 바뀌어요.",
      "막대사탕 나무에서 방금 딴 신선한 사탕이에요!",
      "너무 크게 부풀린 풍선껌은 지붕 위로 날아가 버렸어요… 보이면 알려주세요.",
    ] },
  { id: "post", name: "토끼 우체국", emoji: "💌", tag: "우편", x: 1270, y: 510, scale: 10,
    lines: [
      "편지 한 통 부치실래요? 토끼가 귀를 펄럭이며 배달해 드려요.",
      "구름 너머 마을까지도 이틀이면 도착해요. 비 오는 날엔 하루 더요.",
      "분홍 봉투에 넣으면 받는 사람이 열 때 반짝이가 쏟아져요. 인기 상품!",
    ] },
  { id: "flower", name: "몽글몽글 꽃집", emoji: "🌷", tag: "꽃집", x: 590, y: 860, scale: 9,
    lines: [
      "이 화분은 물을 주면 노래를 불러요. 가끔 음이 틀리지만 귀여워요.",
      "구름솜 튤립이 오늘 아침에 활짝 폈어요. 만지면 폭신해요!",
      "꽃다발 하나 만들어 드릴까요? 리본 색은 마음대로 고르세요.",
    ] },
  { id: "carousel", name: "별빛 회전목마", emoji: "🎠", tag: "놀이터", x: 1160, y: 880, scale: 10,
    lines: [
      "한 바퀴 돌 때마다 별가루가 조금씩 떨어져요. 눈 감지 말고 보세요!",
      "제일 앞자리 유니콘은 언제나 인기 만점이에요. 지금은 비어 있어요!",
      "해 질 무렵에 타면 목마들이 진짜로 하늘을 달리는 것처럼 보여요.",
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

function Avatar({ name, slot, x, y, facing, moving, me }) {
  const ch = charForSlot(slot);
  return (
    <div className="ccAvatar" style={{ left: x, top: y, zIndex: Math.round(y) + 1 }}>
      <div className={"ccTag" + (me ? " ccTagMe" : "")}>{name}</div>
      <Pix
        map={ch.map}
        palette={ch.palette}
        scale={PX}
        cacheKey={"c-" + ch.id}
        className={(moving ? "ccWalk " : "") + (facing < 0 ? "ccFlip" : "")}
      />
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

function JoinGate({ onJoined }) {
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
        <h1 className="ccGateTitle">구름사탕 마을</h1>
        <p className="ccGateSub">
          {hasServer ? `${status?.round ?? "-"}번 테스트` : "서버 없이 둘러보기"}
        </p>

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
  if (!me) {
    return (
      <>
        <style>{CSS}</style>
        <JoinGate onJoined={setMe} />
      </>
    );
  }
  return <Town me={me} />;
}

function Town({ me }) {
  const [pos, setPos] = useState({ x: 850, y: 660 });
  const [facing, setFacing] = useState(1);
  const [moving, setMoving] = useState(false);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const [view, setView] = useState({ w: 1000, h: 700 });
  const [nearId, setNearId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [line, setLine] = useState("");
  const [stars, setStars] = useState(() => STAR_SPOTS.map(() => false));
  const [toast, setToast] = useState("");
  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState([]);
  const [panel, setPanel] = useState(false);
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

  useEffect(() => { openRef.current = openId; }, [openId]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { starsRef.current = stars; }, [stars]);

  const collected = stars.filter(Boolean).length;
  const online = me.role === "solo" ? 1 : peers.length + 1;

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
      if (e.target instanceof HTMLInputElement) return;
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
  }, [openBuilding]);

  /* 게임 루프 */
  useEffect(() => {
    let raf;
    let last = performance.now();
    const boxes = BUILDINGS.map(blockBox);
    const R = 14;
    const hit = (x, y) => boxes.some((b) => x + R > b.x1 && x - R < b.x2 && y + R > b.y1 && y - R < b.y2);

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
      if (openRef.current) { dx = 0; dy = 0; }

      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving) {
        const len = Math.hypot(dx, dy) || 1;
        const sp = 3.4 * dt;
        let { x, y } = posRef.current;
        const nx = clamp(x + (dx / len) * sp, PLAY.x0, PLAY.x1);
        if (!hit(nx, y)) x = nx;
        const ny = clamp(y + (dy / len) * sp, PLAY.y0, PLAY.y1);
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
      const tx = clamp(p.x - v.w / 2, 0, Math.max(0, WORLD.w - v.w));
      const ty = clamp(p.y - v.h / 2 - 40, 0, Math.max(0, WORLD.h - v.h));
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
    return joinChannel({
      round: me.round,
      me: { id: deviceId(), name: me.name, slot: me.slot },
      getPose: () => ({
        x: Math.round(posRef.current.x),
        y: Math.round(posRef.current.y),
        f: facingRef.current,
        m: movingRef.current ? 1 : 0,
      }),
      onPeers: setPeers,
    });
  }, [me]);

  /* 참가자 현황 */
  useEffect(() => {
    if (!hasServer || me.role === "solo") return undefined;
    let alive = true;
    const tick = async () => {
      const s = await fetchStatus();
      if (!alive) return;
      setRoom(s?.ok ? s : null);
      if (s?.ok && me.round && s.round !== me.round) {
        setToast(`${s.round}번 테스트가 시작됐어요! 새로고침해서 다시 입장해주세요`);
      }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [me]);

  /* 회차 지정 (호스트 전용) */
  const doRound = useCallback(async (n) => {
    if (resetting) return;
    setResetting(true);
    const r = await startNewRound(me.hostCode, n);
    setResetting(false);
    if (r?.ok) {
      setRoom({ ok: true, round: r.round, capacity: r.capacity, taken: 0, players: [] });
      setToast(`${r.round}번 테스트를 시작했어요. 자리 ${r.capacity}개가 비었습니다`);
    } else {
      setToast(JOIN_ERROR[r?.error] || JOIN_ERROR.server_error);
    }
  }, [me, resetting]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const hold = (key, on) => () => { keys.current[key] = on; };
  const open = openId ? BUILDINGS.find((b) => b.id === openId) : null;
  const ordered = useMemo(() => [...BUILDINGS].sort((a, b) => a.y - b.y), []);
  const roundNo = room?.round ?? me.round;

  return (
    <div className="ccRoot">
      <style>{CSS}</style>
      <div className="ccSky" />

      <div className="ccClouds" style={{ transform: `translate3d(${-cam.x * 0.35}px, ${-cam.y * 0.35}px, 0)` }}>
        {CLOUDS.map(([x, y, s], i) => (
          <div key={i} className="ccCloud" style={{ left: x, top: y, animationDelay: `${i * 1.3}s` }}>
            <Pix map={DECO.cloud.map} palette={DECO.cloud.palette} scale={s} cacheKey="cloud" />
          </div>
        ))}
      </div>

      <div
        className="ccWorld"
        style={{ width: WORLD.w, height: WORLD.h, transform: `translate3d(${-cam.x}px, ${-cam.y}px, 0)` }}
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

        {peers.map((p) => (
          <Avatar key={p.id} name={p.name} slot={p.slot} x={p.x} y={p.y} facing={p.f} moving={!!p.m} />
        ))}

        <Avatar name={me.name} slot={me.slot} x={pos.x} y={pos.y} facing={facing} moving={moving} me />
      </div>

      {/* 좌측 상단 */}
      <div className="ccHud">
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

      <div className="ccHelp">방향키 · WASD 이동 / 건물 앞에서 SPACE</div>

      {toast && <div className="ccToast">{toast}</div>}

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

      <div className="ccPad">
        <button className="ccPadBtn ccUp" onPointerDown={hold("arrowup", true)} onPointerUp={hold("arrowup", false)} onPointerLeave={hold("arrowup", false)}>▲</button>
        <button className="ccPadBtn ccLeft" onPointerDown={hold("arrowleft", true)} onPointerUp={hold("arrowleft", false)} onPointerLeave={hold("arrowleft", false)}>◀</button>
        <button className="ccPadBtn ccRight" onPointerDown={hold("arrowright", true)} onPointerUp={hold("arrowright", false)} onPointerLeave={hold("arrowright", false)}>▶</button>
        <button className="ccPadBtn ccDown" onPointerDown={hold("arrowdown", true)} onPointerUp={hold("arrowdown", false)} onPointerLeave={hold("arrowdown", false)}>▼</button>
      </div>

      {open && (
        <div className="ccModalWrap" onClick={() => setOpenId(null)}>
          <div className="ccPanel ccModal" onClick={(e) => e.stopPropagation()}>
            <div className="ccModalEmoji">{open.emoji}</div>
            <div className="ccModalTag">{open.tag}</div>
            <h2 className="ccModalName">{open.name}</h2>
            <p className="ccModalLine">{line}</p>
            <button className="ccBtn" onClick={() => setOpenId(null)}>밖으로 나가기</button>
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
body{font-family:"DungGeunMo","Galmuri11","Pretendard","Malgun Gothic",system-ui,sans-serif;
  -webkit-font-smoothing:none;letter-spacing:.02em}
.ccRoot{position:fixed;inset:0;overflow:hidden;user-select:none;touch-action:none;color:${C.ink}}
.ccPix{display:block;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none}

.ccSky{position:absolute;inset:0;background:linear-gradient(180deg,${C.sky1} 0%,${C.sky2} 60%,${C.sky3} 100%)}
.ccClouds{position:absolute;inset:0;pointer-events:none}
.ccCloud{position:absolute;animation:ccFloat 8s steps(4,end) infinite}
@keyframes ccFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}

.ccWorld{position:absolute;left:0;top:0;will-change:transform}
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
.ccTag{white-space:nowrap;text-align:center;font-size:11px;font-weight:700;margin-bottom:3px;
  background:#fff;border:2px solid ${C.line};padding:1px 6px;box-shadow:2px 2px 0 rgba(91,74,99,.25)}
.ccTagMe{background:#ffe9a8}

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

.ccPad{position:absolute;right:16px;bottom:16px;width:150px;height:150px;display:none}
.ccPadBtn{position:absolute;width:46px;height:46px;border:3px solid ${C.line};background:#fff;
  font-size:14px;color:${C.ink};box-shadow:3px 3px 0 rgba(91,74,99,.25);touch-action:none;font-family:inherit}
.ccPadBtn:active{background:#ffe9a8;transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(91,74,99,.25)}
.ccUp{left:52px;top:0}.ccDown{left:52px;bottom:0}.ccLeft{left:0;top:52px}.ccRight{right:0;top:52px}
@media (hover:none) and (pointer:coarse){.ccPad{display:block}.ccHelp{display:none}}

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
