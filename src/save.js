import { createClient } from "@supabase/supabase-js";

/* ===========================================================
   세이브 — 이 기기(localStorage) + 서버(Supabase) 이중 저장
   서버가 없거나 실패해도 게임은 그대로 돌아갑니다.
   =========================================================== */

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = URL && KEY ? createClient(URL, KEY) : null;
export const hasCloud = !!supabase;

const LS_KEY = "ccTownSave.v1";
const TABLE = "cc_saves";

/* ---------- 이 기기 저장 ---------- */

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocal(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/* ---------- 서버 저장 ---------- */

let uid = null;

/* 익명 로그인 — 브라우저마다 계정이 하나 생기고, 그 계정 것만 읽고 쓸 수 있어요 */
export async function initCloud() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      uid = data.session.user.id;
      return uid;
    }
    const { data: signed, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn("[save] 익명 로그인 실패:", error.message);
      return null;
    }
    uid = signed?.user?.id || null;
    return uid;
  } catch (e) {
    console.warn("[save] 서버 연결 실패:", e?.message || e);
    return null;
  }
}

export async function loadCloud() {
  if (!supabase || !uid) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("data, updated_at")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      console.warn("[save] 서버 읽기 실패:", error.message);
      return null;
    }
    return data?.data || null;
  } catch {
    return null;
  }
}

export async function saveCloud(data) {
  if (!supabase || !uid) return false;
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: uid, data, updated_at: new Date().toISOString() });
    if (error) {
      console.warn("[save] 서버 저장 실패:", error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
