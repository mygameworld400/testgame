import { supabase } from "./room.js";

/* ===========================================================
   같이 접속한 사람 보이기 + 채팅 — Supabase Realtime 브로드캐스트
   회차마다 채널이 따로 열립니다: cc-round-<회차>
   위치는 초당 8번, 일반 채팅은 보낼 때만.
   카페 자동대화는 일반 채팅과 분리된 cafe_talk 이벤트로 보냅니다.
   =========================================================== */

const SEND_MS = 125;
const STALE_MS = 15000;
export const CHAT_MS = 3000;

export function joinChannel({
  round,
  me,
  getPose,
  onPeers,
  onChat,
  onCafeTalk,
  onFx,
  onLive,
}) {
  if (!supabase) {
    return {
      stop: () => {},
      chat: () => false,
      cafeTalk: () => false,
      fx: () => false,
    };
  }

  const peers = new Map();

  let dead = false;
  let live = false;
  let retry = 0;
  let retryTimer = null;

  const ch = supabase.channel(`cc-round-${round}`, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  const push = () => onPeers([...peers.values()]);

  /* =========================================================
     다른 사람 위치
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "pose" },
    ({ payload }) => {
      if (!payload?.id || payload.id === me.id) return;

      const prev = peers.get(payload.id);

      peers.set(payload.id, {
        ...prev,
        ...payload,
        at: Date.now(),
      });

      push();
    }
  );

  /* =========================================================
     일반 채팅
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "chat" },
    ({ payload }) => {
      if (!payload?.id || payload.id === me.id) return;

      const prev =
        peers.get(payload.id) || {
          id: payload.id,
          name: payload.name,
          slot: payload.slot,
          x: -999,
          y: -999,
        };

      peers.set(payload.id, {
        ...prev,
        msg: payload.text,
        msgAt: Date.now(),
        at: Date.now(),
      });

      onChat?.(payload);
      push();
    }
  );

  /* =========================================================
     카페 자동대화
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "cafe_talk" },
    ({ payload }) => {
      if (!payload || payload.id === me.id) return;

      onCafeTalk?.(payload);
    }
  );

  /* =========================================================
     효과
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "fx" },
    ({ payload }) => {
      if (!payload || payload.id === me.id) return;

      onFx?.(payload);
    }
  );

  /* =========================================================
     퇴장
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "bye" },
    ({ payload }) => {
      if (payload?.id && peers.delete(payload.id)) {
        push();
      }
    }
  );

  let sendTimer = null;
  let pruneTimer = null;

  const setLive = (v) => {
    if (live === v) return;

    live = v;
    onLive?.(v);
  };

  /* =========================================================
     재접속
     ========================================================= */

  const rejoin = () => {
    if (dead || live) return;

    clearTimeout(retryTimer);

    const wait = Math.min(
      8000,
      600 * Math.pow(1.6, retry)
    );

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
      setLive(false);

      peers.clear();
      push();

      rejoin();
      return;
    }

    retry = 0;
    setLive(true);

    clearInterval(sendTimer);
    clearInterval(pruneTimer);

    /* =======================================================
       위치 + 방 BGM 상태 전송
       ======================================================= */

    let lastSig = "";
    let lastAt = 0;

    const send = () => {
      const pose = getPose();

      if (!pose) return;

      const sig = JSON.stringify(pose);
      const now = Date.now();

      /*
       * 위치가 바뀌지 않았더라도
       * 최대 3초마다 한 번씩은 전송합니다.
       *
       * 호스트의 bgmMap도 pose 안에 들어가기 때문에
       * 새로 들어온 게스트가 현재 방 BGM을 받을 수 있습니다.
       */

      if (
        sig === lastSig &&
        now - lastAt < 3000
      ) {
        return;
      }

      lastSig = sig;
      lastAt = now;

      ch.send({
        type: "broadcast",
        event: "pose",
        payload: {
          id: me.id,
          name: me.name,
          slot: me.slot,
          ...pose,
        },
      });
    };

    send();

    sendTimer = setInterval(
      send,
      SEND_MS
    );

    /* =======================================================
       오래된 접속자 / 말풍선 정리
       ======================================================= */

    pruneTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      peers.forEach((p, id) => {
        if (now - p.at > STALE_MS) {
          peers.delete(id);
          changed = true;
        } else if (
          p.msg &&
          now - p.msgAt > CHAT_MS
        ) {
          peers.set(id, {
            ...p,
            msg: null,
          });

          changed = true;
        }
      });

      if (changed) {
        push();
      }
    }, 500);
  }

  ch.subscribe(onStatus);

  /* =========================================================
     탭 복귀 / 인터넷 복구
     ========================================================= */

  const wake = () => {
    if (dead || live) return;

    retry = 0;
    rejoin();
  };

  const onVis = () => {
    if (!document.hidden) {
      wake();
    }
  };

  document.addEventListener(
    "visibilitychange",
    onVis
  );

  window.addEventListener(
    "online",
    wake
  );

  window.addEventListener(
    "focus",
    wake
  );

  /* =========================================================
     퇴장 알림
     ========================================================= */

  const bye = () => {
    try {
      ch.send({
        type: "broadcast",
        event: "bye",
        payload: {
          id: me.id,
        },
      });
    } catch {
      /* 무시 */
    }
  };

  const onPageHide = (e) => {
    if (!e.persisted) {
      bye();
    }
  };

  window.addEventListener(
    "pagehide",
    onPageHide
  );

  /* =========================================================
     외부에서 사용할 API
     ========================================================= */

  return {
    /* =======================================================
       일반 채팅
       ======================================================= */

    chat(text, room) {
      const t = (text || "")
        .trim()
        .slice(0, 60);

      if (!t) return false;

      ch.send({
        type: "broadcast",
        event: "chat",
        payload: {
          id: me.id,
          name: me.name,
          slot: me.slot,
          text: t,
          r: room || "",
        },
      });

      return true;
    },

    /* =======================================================
       카페 자동대화
       ======================================================= */

    cafeTalk({ who, text, room }) {
      const t = (text || "")
        .trim()
        .slice(0, 120);

      if (!t || !room) {
        return false;
      }

      ch.send({
        type: "broadcast",
        event: "cafe_talk",
        payload: {
          id: me.id,

          senderChair:
            getPose()?.st ?? -1,

          who:
            who === "s"
              ? "s"
              : "m",

          text: t,

          room,
        },
      });

      return true;
    },

    /* =======================================================
       효과
       ======================================================= */

    fx(data) {
      if (!data || dead || !live) return false;

      ch.send({
        type: "broadcast",
        event: "fx",
        payload: {
          id: me.id,
          ...data,
        },
      });

      return true;
    },

    /* =======================================================
       연결 상태
       ======================================================= */

    live: () => live,

    /* =======================================================
       종료
       ======================================================= */

    stop() {
      dead = true;

      clearInterval(sendTimer);
      clearInterval(pruneTimer);
      clearTimeout(retryTimer);

      window.removeEventListener(
        "pagehide",
        onPageHide
      );

      document.removeEventListener(
        "visibilitychange",
        onVis
      );

      window.removeEventListener(
        "online",
        wake
      );

      window.removeEventListener(
        "focus",
        wake
      );

      bye();

      supabase.removeChannel(ch);
    },
  };
}
