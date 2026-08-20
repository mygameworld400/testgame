import { supabase } from "./room.js";

/* ===========================================================
   같이 접속한 사람 보이기 + 채팅 — Supabase Realtime 브로드캐스트
   회차마다 채널이 따로 열립니다: cc-round-<회차>
   위치는 초당 8번, 채팅은 보낼 때만. 말풍선은 3초 뒤 사라져요.
   =========================================================== */

const SEND_MS = 125;
const STALE_MS = 8000;
export const CHAT_MS = 3000;

export function joinChannel({ round, me, getPose, onPeers, onChat }) {
  if (!supabase) return { stop: () => {}, chat: () => false };

  const peers = new Map();
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

  ch.on("broadcast", { event: "bye" }, ({ payload }) => {
    if (payload?.id && peers.delete(payload.id)) push();
  });

  let sendTimer = null;
  let pruneTimer = null;

  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
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
  });

  const bye = () => {
    try {
      ch.send({ type: "broadcast", event: "bye", payload: { id: me.id } });
    } catch {
      /* 무시 */
    }
  };
  window.addEventListener("pagehide", bye);

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
    stop() {
      clearInterval(sendTimer);
      clearInterval(pruneTimer);
      window.removeEventListener("pagehide", bye);
      bye();
      supabase.removeChannel(ch);
    },
  };
}
