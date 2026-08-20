import { supabase } from "./room.js";

/* ===========================================================
   같이 접속한 사람 보이기 — Supabase Realtime 브로드캐스트
   회차마다 채널이 따로 열립니다: cc-round-<회차>
   위치는 초당 8번만 보내고, 8초 넘게 소식 없는 사람은 지웁니다.
   =========================================================== */

const SEND_MS = 125;
const STALE_MS = 8000;

export function joinChannel({ round, me, getPose, onPeers }) {
  if (!supabase) return () => {};

  const peers = new Map();
  const ch = supabase.channel(`cc-round-${round}`, {
    config: { broadcast: { self: false } },
  });

  const push = () => {
    const list = [];
    peers.forEach((p) => list.push(p));
    onPeers(list);
  };

  ch.on("broadcast", { event: "pose" }, ({ payload }) => {
    if (!payload?.id || payload.id === me.id) return;
    peers.set(payload.id, { ...payload, at: Date.now() });
    push();
  });

  ch.on("broadcast", { event: "bye" }, ({ payload }) => {
    if (payload?.id && peers.delete(payload.id)) push();
  });

  let sendTimer = null;
  let pruneTimer = null;

  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    const send = () => {
      const pose = getPose();
      if (!pose) return;
      ch.send({
        type: "broadcast",
        event: "pose",
        payload: { id: me.id, name: me.name, slot: me.slot, ...pose },
      });
    };
    send();
    sendTimer = setInterval(send, SEND_MS);
    pruneTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      peers.forEach((p, id) => {
        if (now - p.at > STALE_MS) {
          peers.delete(id);
          changed = true;
        }
      });
      if (changed) push();
    }, 2000);
  });

  const bye = () => {
    try {
      ch.send({ type: "broadcast", event: "bye", payload: { id: me.id } });
    } catch {
      /* 무시 */
    }
  };
  window.addEventListener("pagehide", bye);

  return () => {
    clearInterval(sendTimer);
    clearInterval(pruneTimer);
    window.removeEventListener("pagehide", bye);
    bye();
    supabase.removeChannel(ch);
  };
}
