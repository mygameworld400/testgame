import { supabase } from "./room.js";

/* ===========================================================
   같이 접속한 사람 보이기 + 채팅 — Supabase Realtime 브로드캐스트
   회차마다 채널이 따로 열립니다: cc-round-<회차>
   위치는 초당 8번, 채팅은 보낼 때만. 말풍선은 3초 뒤 사라져요.
   =========================================================== */

const SEND_MS = 125;
const STALE_MS = 15000;   // 잠깐 끊겨도 바로 지우지 않게 넉넉히
export const CHAT_MS = 3000;

export function joinChannel({ round, me, getPose, onPeers, onChat, onFx, onLive }) {
  if (!supabase) return { stop: () => {}, chat: () => false };

  const peers = new Map();
  let dead = false;          // stop() 이 불렸는지
  let live = false;          // 지금 붙어 있는지
  let retry = 0;             // 다시 붙기 시도 횟수
  let retryTimer = null;
  const ch = supabase.channel(`cc-round-${round}`, {
    config: { broadcast: { self: false } },
  });

  const push = () => onPeers([...peers.values()]);

  ch.on("broadcast", { event: "pose" }, ({ payload }) => {
    if (!payload?.id || payload.id === me.id) return;
    const prev = peers.get(payload.id);
    peers.set(payload.id, { ...prev, ...payload, at: Date.now() });
    push();
  });

  ch.on("broadcast", { event: "chat" }, ({ payload }) => {
    if (!payload?.id || payload.id === me.id) return;
    const prev = peers.get(payload.id) || { id: payload.id, name: payload.name, slot: payload.slot, x: -999, y: -999 };
    peers.set(payload.id, { ...prev, msg: payload.text, msgAt: Date.now(), at: Date.now() });
    onChat?.(payload);
    push();
  });

  /* 공이 깨지는 것처럼 같이 봐야 하는 순간들 */
  ch.on("broadcast", { event: "fx" }, ({ payload }) => {
    if (!payload || payload.id === me.id) return;
    onFx?.(payload);
  });

  ch.on("broadcast", { event: "bye" }, ({ payload }) => {
    if (payload?.id && peers.delete(payload.id)) push();
  });

  let sendTimer = null;
  let pruneTimer = null;

  const setLive = (v) => {
    if (live === v) return;
    live = v;
    onLive?.(v);
  };

  /* 끊기면 다시 붙습니다. 안 그러면 접속자가 나 혼자로 보이고
     아무도 안 나타나요 (새로고침해야 돌아오던 문제) */
  const rejoin = () => {
    if (dead || live) return;
    clearTimeout(retryTimer);
    const wait = Math.min(8000, 600 * Math.pow(1.6, retry));
    retry += 1;
    retryTimer = setTimeout(() => {
      if (dead || live) return;
      try {
        ch.subscribe(onStatus);
      } catch {
        rejoin();
      }
    }, wait);
  };

  function onStatus(status) {
    if (dead) return;
    if (status !== "SUBSCRIBED") {
      /* CHANNEL_ERROR · TIMED_OUT · CLOSED */
      setLive(false);
      peers.clear();
      push();
      rejoin();
      return;
    }
    retry = 0;
    setLive(true);
    /* 다시 붙었을 때 타이머가 겹치지 않게 */
    clearInterval(sendTimer);
    clearInterval(pruneTimer);
    /* 값이 그대로면 보내지 않습니다. 가만히 있을 때는 3초에 한 번만
       살아 있다는 신호를 보내요 — 실시간 메시지 사용량을 크게 줄여줍니다. */
    let lastSig = "";
    let lastAt = 0;
    const send = () => {
      const pose = getPose();
      if (!pose) return;
      const sig = JSON.stringify(pose);
      const now = Date.now();
      if (sig === lastSig && now - lastAt < 3000) return;
      lastSig = sig;
      lastAt = now;
      ch.send({
        type: "broadcast",
        event: "pose",
        payload: { id: me.id, name: me.name, slot: me.slot, ...pose },
      });
    };
    send();
    sendTimer = setInterval(send, SEND_MS);

    /* 오래된 접속자 정리 + 만료된 말풍선 지우기 */
    pruneTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      peers.forEach((p, id) => {
        if (now - p.at > STALE_MS) {
          peers.delete(id);
          changed = true;
        } else if (p.msg && now - p.msgAt > CHAT_MS) {
          peers.set(id, { ...p, msg: null });
          changed = true;
        }
      });
      if (changed) push();
    }, 500);
  }

  ch.subscribe(onStatus);

  /* 탭을 다시 보거나 인터넷이 돌아오면 바로 확인합니다 */
  const wake = () => {
    if (dead || live) return;
    retry = 0;
    rejoin();
  };
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", wake);
  window.addEventListener("focus", wake);

  const bye = () => {
    try {
      ch.send({ type: "broadcast", event: "bye", payload: { id: me.id } });
    } catch {
      /* 무시 */
    }
  };
  /* pagehide 는 탭을 잠깐 감출 때도 불려서, 진짜 떠날 때만 인사합니다 */
  const onPageHide = (e) => { if (!e.persisted) bye(); };
  window.addEventListener("pagehide", onPageHide);

  return {
    chat(text, room) {
      const t = (text || "").trim().slice(0, 60);
      if (!t) return false;
      ch.send({
        type: "broadcast",
        event: "chat",
        payload: { id: me.id, name: me.name, slot: me.slot, text: t, r: room || "" },
      });
      return true;
    },
    fx(data) {
      ch.send({ type: "broadcast", event: "fx", payload: { id: me.id, ...data } });
    },
    live: () => live,
    stop() {
      dead = true;
      clearInterval(sendTimer);
      clearInterval(pruneTimer);
      clearTimeout(retryTimer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      bye();
      supabase.removeChannel(ch);
    },
  };
}
