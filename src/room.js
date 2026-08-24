import { createClient } from "@supabase/supabase-js";

/* ===========================================================
   테스트 입장 관리 — 회차(round)마다 선착순 5명
   자리 검사는 전부 서버 함수(RPC)에서 합니다. 클라이언트를
   고쳐도 6번째 사람은 들어올 수 없어요.
   게임 진행 상황은 저장하지 않습니다.
   =========================================================== */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = URL && KEY ? createClient(URL, KEY) : null;
export const hasServer = !!supabase;

/* 새로고침해도 같은 사람으로 보이게 하는 기기 표식.
   (게임 진행 저장이 아니라, 새로고침 때 자리를 또 차지하지 않게 하는 용도) */
const DEV_KEY = "ccDevice";
export function deviceId() {
  try {
    let d = localStorage.getItem(DEV_KEY);
    if (!d) {
      d = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(DEV_KEY, d);
    }
    return d;
  } catch {
    return "nostorage-" + Math.random().toString(36).slice(2, 12);
  }
}

/* 호스트 코드는 이 기기에만 기억해둡니다 */
const HOST_KEY = "ccHostCode";
export const rememberHostCode = (c) => {
  try {
    if (c) localStorage.setItem(HOST_KEY, c);
  } catch {
    /* 무시 */
  }
};
export const savedHostCode = () => {
  try {
    return localStorage.getItem(HOST_KEY) || "";
  } catch {
    return "";
  }
};

function wrap(error) {
  /* 함수가 아직 없으면(스키마 미적용) 안내용 코드로 바꿔줍니다 */
  const code = error?.code === "PGRST202" ? "no_schema" : "server_error";
  return { ok: false, error: code, message: error?.message || "" };
}

export async function fetchStatus() {
  if (!supabase) return { ok: false, error: "no_server" };
  try {
    const { data, error } = await supabase.rpc("cc_status");
    if (error) return wrap(error);
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: "server_error", message: e?.message || "" };
  }
}

export async function joinRoom(name, hostCode) {
  if (!supabase) return { ok: false, error: "no_server" };
  try {
    const { data, error } = await supabase.rpc("cc_join", {
      p_device: deviceId(),
      p_name: name,
      p_host_code: hostCode || null,
    });
    if (error) return wrap(error);
    return data;
  } catch (e) {
    return { ok: false, error: "server_error", message: e?.message || "" };
  }
}

/* 비공개 모드 켜기·끄기 (호스트만) */
export async function setClosed(hostCode, closed) {
  if (!supabase) return { ok: false, error: "no_server" };
  try {
    const { data, error } = await supabase.rpc("cc_set_closed", {
      p_host_code: hostCode,
      p_closed: closed,
    });
    if (error) return wrap(error);
    return data;
  } catch (e) {
    return { ok: false, error: "server_error", message: e?.message || "" };
  }
}

/* round 를 주면 그 번호로, 안 주면 다음 회차로 넘어갑니다 */
export async function startNewRound(hostCode, round) {
  if (!supabase) return { ok: false, error: "no_server" };
  try {
    const { data, error } = await supabase.rpc("cc_new_round", {
      p_host_code: hostCode,
      p_round: round ?? null,
    });
    if (error) return wrap(error);
    return data;
  } catch (e) {
    return { ok: false, error: "server_error", message: e?.message || "" };
  }
}
