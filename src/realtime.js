import { supabase } from "./room.js";

/* ===========================================================
   Cloud Candy Town — Supabase Realtime

   기능
   1. 플레이어 위치 동기화
   2. 채팅
   3. 카페 자동대화
   4. FX
   5. 방 BGM 실시간 동기화
   6. 늦게 들어온 게스트의 현재 BGM 요청
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
      live: () => false,
    };
  }

  const peers = new Map();

  let dead = false;
  let live = false;

  let retry = 0;
  let retryTimer = null;

  let sendTimer = null;
  let pruneTimer = null;

  const ch = supabase.channel(
    `cc-round-${round}`,
    {
      config: {
        broadcast: {
          self: false,
        },
      },
    }
  );

  const pushPeers = () => {
    onPeers?.([...peers.values()]);
  };

  /* =========================================================
     플레이어 위치
     ========================================================= */

  ch.on(
    "broadcast",
    {
      event: "pose",
    },
    ({ payload }) => {
      if (!payload?.id) return;
      if (payload.id === me.id) return;

      const prev = peers.get(payload.id);

      peers.set(payload.id, {
        ...prev,
        ...payload,
        at: Date.now(),
      });

      pushPeers();
    }
  );

  /* =========================================================
     일반 채팅
     ========================================================= */

  ch.on(
    "broadcast",
    {
      event: "chat",
    },
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

      pushPeers();
    }
  );

  /* =========================================================
     카페 자동대화
     ========================================================= */

  ch.on(
    "broadcast",
    {
      event: "cafe_talk",
    },
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
    {
      event: "fx",
    },
    ({ payload }) => {
      if (!payload) return;
      if (payload.id === me.id) return;

      onFx?.(payload);
    }
  );

  /* =========================================================
     방 BGM 수신

     room_bgm
     ├─ 특정 방 BGM 변경
     └─ __ALL__이면 현재 전체 BGM 상태
     ========================================================= */

  ch.on(
    "broadcast",
    {
      event: "room_bgm",
    },
    ({ payload }) => {
      if (!payload) return;

      /* 자기 자신이 보낸 BGM은 무시 */
      if (payload.id === me.id) return;

      /* -----------------------------------------------
         호스트가 현재 전체 BGM 상태를 보내는 경우
         ----------------------------------------------- */

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

      /* -----------------------------------------------
         특정 방 BGM 변경
         ----------------------------------------------- */

      if (payload.scene) {
        const bgm =
          payload.bgm && typeof payload.bgm === "object"
            ? {
                ...payload.bgm,
                url:
                  payload.bgm.url ||
                  payload.bgm.path ||
                  "",
              }
            : null;

        onFx?.({
          id: payload.id,
          t: "roomBgm",
          scene: payload.scene,
          bgm,
        });
      }
    }
  );

  /* =========================================================
     게스트가 현재 BGM 요청

     게스트:
       "현재 방에서 무슨 BGM 틀고 있어?"

     호스트:
       현재 bgmMap을 전체 전송
     ========================================================= */

  ch.on(
    "broadcast",
    {
      event: "room_bgm_request",
    },
    ({ payload }) => {
      if (!payload) return;

      /* 호스트만 응답 */
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
    {
      event: "bye",
    },
    ({ payload }) => {
      if (!payload?.id) return;

      if (peers.delete(payload.id)) {
        pushPeers();
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
     Realtime 상태
     ========================================================= */

  function onStatus(status) {
    if (dead) return;

    if (status !== "SUBSCRIBED") {
      setLive(false);

      peers.clear();

      pushPeers();

      rejoin();

      return;
    }

    retry = 0;

    setLive(true);

    clearInterval(sendTimer);
    clearInterval(pruneTimer);

    /* =======================================================
       플레이어 위치 전송
       ======================================================= */

    let lastSig = "";
    let lastAt = 0;

    const sendPose = () => {
      if (dead || !live) return;

      const pose = getPose?.();

      if (!pose) return;

      const now = Date.now();

      const sig = JSON.stringify(pose);

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

    sendPose();

    sendTimer = setInterval(
      sendPose,
      SEND_MS
    );

    /* =======================================================
       오래된 플레이어 / 말풍선 제거
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
        pushPeers();
      }
    }, 500);

    /* =======================================================
       게스트가 접속하면 현재 방 BGM 요청

       호스트가 이미 BGM을 틀고 있다면
       현재 상태를 바로 받아옴.
       ======================================================= */

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

  /* =========================================================
     채널 구독 시작
     ========================================================= */

  ch.subscribe(onStatus);

  /* =========================================================
     탭 복귀 / 인터넷 복구
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
     외부에서 사용하는 API
     ========================================================= */

  return {

    /* =======================================================
       일반 채팅
       ======================================================= */

    chat(text, room) {
      const t = String(text || "")
        .trim()
        .slice(0, 60);

      if (!t) return false;

      if (dead || !live) {
        return false;
      }

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

      const pose = getPose?.();

      ch.send({
        type: "broadcast",

        event: "cafe_talk",

        payload: {
          id: me.id,

          senderChair:
            pose?.st ?? -1,

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
       일반 FX
       ======================================================= */

    fx(data) {
      if (!data) return false;

      if (dead || !live) {
        return false;
      }

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
       방 BGM 변경

       CloudCandyTown.jsx에서:

       chanRef.current?.roomBgm({
         scene,
         bgm: next || null
       });

       이렇게 호출하면 됨.
       ======================================================= */

    roomBgm({
      scene,
      bgm,
    }) {
      if (!scene) {
        return false;
      }

      if (dead || !live) {
        return false;
      }

      const normalized =
        bgm && typeof bgm === "object"
          ? {
              ...bgm,
              url:
                bgm.url ||
                bgm.path ||
                "",
            }
          : null;

      ch.send({
        type: "broadcast",

        event: "room_bgm",

        payload: {
          id: me.id,

          scene,

          bgm: normalized,
        },
      });

      return true;
    },

    /* =======================================================
       현재 방 BGM 요청
       ======================================================= */

    requestRoomBgm() {
      if (dead || !live) {
        return false;
      }

      ch.send({
        type: "broadcast",

        event: "room_bgm_request",

        payload: {
          id: me.id,
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
      if (dead) return;

      dead = true;

      clearInterval(sendTimer);
      clearInterval(pruneTimer);
      clearTimeout(retryTimer);

      bye();

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

      window.removeEventListener(
        "pagehide",
        onPageHide
      );

      try {
        supabase.removeChannel(ch);
      } catch {
        /* 무시 */
      }
    },
  };
}
