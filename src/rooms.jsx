import { supabase } from "./room.js";

/* ===========================================================
   Cloud Candy Town — Realtime
   - 다른 플레이어 위치
   - 일반 채팅
   - 카페 자동대화
   - 일반 FX
   - 방 BGM 실시간 동기화
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
      roomBgm: () => false,
      requestRoomBgm: () => false,
    };
  }

  const peers = new Map();

  let dead = false;
  let live = false;

  let retry = 0;
  let retryTimer = null;

  let sendTimer = null;
  let pruneTimer = null;

  const channelName = `cc-round-${round}`;

  const ch = supabase.channel(channelName, {
    config: {
      broadcast: {
        self: false,
      },
    },
  });

  const push = () => {
    onPeers?.([...peers.values()]);
  };

  /* =========================================================
     다른 플레이어 위치
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "pose" },
    ({ payload }) => {
      if (!payload?.id) return;
      if (payload.id === me.id) return;

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
      if (!payload?.id) return;
      if (payload.id === me.id) return;

      const prev =
        peers.get(payload.id) || {
          id: payload.id,
          name: payload.name || "",
          slot: payload.slot ?? -1,
          x: -999,
          y: -999,
        };

      peers.set(payload.id, {
        ...prev,
        msg: payload.text || "",
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
      if (!payload) return;
      if (payload.id === me.id) return;

      onCafeTalk?.(payload);
    }
  );

  /* =========================================================
     일반 FX
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "fx" },
    ({ payload }) => {
      if (!payload) return;
      if (payload.id === me.id) return;

      onFx?.(payload);
    }
  );

  /* =========================================================
     방 BGM
     
     BGM은 FX와 별도로 분리합니다.
     이유:
     - FX는 순간적인 이벤트
     - BGM은 현재 방의 상태
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "room_bgm" },
    ({ payload }) => {
      if (!payload) return;
      if (payload.id === me.id) return;

      /*
       * 호스트가 현재 전체 BGM 상태를 보내는 경우
       */
      if (
        payload.scene === "__ALL__" &&
        payload.bgmMap &&
        typeof payload.bgmMap === "object"
      ) {
        onFx?.({
          id: payload.id,
          t: "roomBgm",
          scene: "__ALL__",
          bgmMap: payload.bgmMap,
        });

        return;
      }

      /*
       * 특정 방 BGM 변경
       */
      if (payload.scene) {
        onFx?.({
          id: payload.id,
          t: "roomBgm",
          scene: payload.scene,
          bgm: payload.bgm || null,
        });
      }
    }
  );

  /* =========================================================
     게스트 → 호스트
     
     "현재 방 BGM 뭐야?" 요청
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "room_bgm_request" },
    ({ payload }) => {
      if (!payload) return;

      /*
       * 호스트만 응답
       */
      if (me.role !== "host") return;

      const pose = getPose?.();

      const bgmMap =
        pose?.bgmMap &&
        typeof pose.bgmMap === "object"
          ? pose.bgmMap
          : {};

      ch.send({
        type: "broadcast",
        event: "room_bgm",
        payload: {
          id: me.id,
          scene: "__ALL__",
          bgmMap,
        },
      });
    }
  );

  /* =========================================================
     퇴장
     ========================================================= */

  ch.on(
    "broadcast",
    { event: "bye" },
    ({ payload }) => {
      if (!payload?.id) return;

      if (peers.delete(payload.id)) {
        push();
      }
    }
  );

  /* =========================================================
     연결 상태
     ========================================================= */

  const setLive = (value) => {
    if (live === value) return;

    live = value;

    onLive?.(value);
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

  /* =========================================================
     SUBSCRIBED
     ========================================================= */

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
       내 위치 / 상태 전송
       ======================================================= */

    let lastSig = "";
    let lastAt = 0;

    const send = () => {
      if (dead || !live) return;

      const pose = getPose?.();

      if (!pose) return;

      const now = Date.now();
      const sig = JSON.stringify(pose);

      /*
       * 움직이지 않았더라도
       * 3초마다 한 번은 상태를 전송합니다.
       *
       * 따라서 새로 들어온 게스트가
       * 현재 호스트의 bgmMap도 받을 수 있습니다.
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
          role: me.role,
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
       오래된 플레이어 / 말풍선 정리
       ======================================================= */

    pruneTimer = setInterval(() => {
      const now = Date.now();

      let changed = false;

      peers.forEach((p, id) => {
        if (
          now - (p.at || 0) >
          STALE_MS
        ) {
          peers.delete(id);
          changed = true;

          return;
        }

        if (
          p.msg &&
          now - (p.msgAt || 0) >
          CHAT_MS
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

    /*
     * 게스트가 연결된 직후 현재 방 BGM 요청
     */
    if (me.role !== "host") {
      setTimeout(() => {
        if (dead || !live) return;

        ch.send({
          type: "broadcast",
          event: "room_bgm_request",
          payload: {
            id: me.id,
          },
        });
      }, 350);
    }
  }

  ch.subscribe(onStatus);

  /* =========================================================
     인터넷 / 탭 복귀
     ========================================================= */

  const wake = () => {
    if (dead || live) return;

    retry = 0;

    rejoin();
  };

  const onVisibility = () => {
    if (!document.hidden) {
      wake();
    }
  };

  document.addEventListener(
    "visibilitychange",
    onVisibility
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
    if (dead) return;

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

  const onPageHide = (event) => {
    if (!event.persisted) {
      bye();
    }
  };

  window.addEventListener(
    "pagehide",
    onPageHide
  );

  /* =========================================================
     외부 API
     ========================================================= */

  return {
    /* -------------------------------------------------------
       일반 채팅
       ------------------------------------------------------- */

    chat(text, room) {
      const t = String(text || "")
        .trim()
        .slice(0, 60);

      if (!t) return false;
      if (dead || !live) return false;

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

    /* -------------------------------------------------------
       카페 자동대화
       ------------------------------------------------------- */

    cafeTalk({
      who,
      text,
      room,
    }) {
      const t = String(text || "")
        .trim()
        .slice(0, 120);

      if (!t || !room) {
        return false;
      }

      if (dead || !live) {
        return false;
      }

      ch.send({
        type: "broadcast",
        event: "cafe_talk",
        payload: {
          id: me.id,

          senderChair:
            getPose?.()?.st ?? -1,

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

    /* -------------------------------------------------------
       일반 FX
       ------------------------------------------------------- */

    fx(data) {
      if (!data) return false;
      if (dead || !live) return false;

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

    /* -------------------------------------------------------
       방 BGM 변경
       ------------------------------------------------------- */

    roomBgm({
      scene,
      bgm,
    }) {
      if (!scene) return false;
      if (dead || !live) return false;

      ch.send({
        type: "broadcast",
        event: "room_bgm",
        payload: {
          id: me.id,
          scene,
          bgm: bgm || null,
        },
      });

      return true;
    },

    /* -------------------------------------------------------
       현재 방 BGM 요청
       ------------------------------------------------------- */

    requestRoomBgm() {
      if (dead || !live) return false;

      ch.send({
        type: "broadcast",
        event: "room_bgm_request",
        payload: {
          id: me.id,
        },
      });

      return true;
    },

    /* -------------------------------------------------------
       연결 여부
       ------------------------------------------------------- */

    live: () => live,

    /* -------------------------------------------------------
       종료
       ------------------------------------------------------- */

    stop() {
      if (dead) return;

      dead = true;

      clearInterval(sendTimer);
      clearInterval(pruneTimer);
      clearTimeout(retryTimer);

      bye();

      window.removeEventListener(
        "pagehide",
        onPageHide
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );

      window.removeEventListener(
        "online",
        wake
      );

      window.removeEventListener(
        "focus",
        wake
      );

      try {
        supabase.removeChannel(ch);
      } catch {
        /* 무시 */
      }
    },
  };
}
