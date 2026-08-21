import { supabase } from "./room.js";

/* ===========================================================
   게임 안에서 올리는 콘텐츠 — 퀴즈 이미지 / 음악 파일
   추가·삭제는 호스트 코드를 서버에서 대조합니다.
   =========================================================== */

const call = async (fn, args) => {
  if (!supabase) return { ok: false, error: "no_server" };
  try {
    const { data, error } = await supabase.rpc(fn, args || {});
    if (error) {
      return { ok: false, error: error.code === "PGRST202" ? "no_schema" : "server_error", message: error.message };
    }
    return data;
  } catch (e) {
    return { ok: false, error: "server_error", message: e?.message || "" };
  }
};

/* ---------- 퀴즈 ---------- */

export const quizList = () => call("cc_quiz_list");
export const quizCheck = (id, guess) => call("cc_quiz_check", { p_id: id, p_guess: guess });
export const quizPacks = () => call("cc_quiz_packs");
export const quizAdd = (hostCode, image, answer, pack) =>
  call("cc_quiz_add", { p_host_code: hostCode, p_image: image, p_answer: answer, p_pack: pack || "과자" });
export const quizDel = (hostCode, id) => call("cc_quiz_del", { p_host_code: hostCode, p_id: id });

/* 사진을 가로세로 720px 이하 JPEG 로 줄여서 base64 로 만듭니다.
   폰 사진 원본(4MB)도 100KB 안팎으로 줄어들어 DB 에 그대로 담을 수 있어요. */
export function shrinkImage(file, max = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했어요"));
    };
    img.src = url;
  });
}

/* 캐릭터용 사진 손질 — 크기를 줄이고, 원하면 배경을 지웁니다.

   누끼는 네 변에서 시작해 비슷한 색을 따라 안쪽으로 번져 나가며 투명하게
   만드는 방식입니다. 인물 안쪽에 같은 색이 있어도 가장자리와 이어져
   있지 않으면 안 지워져요. 배경이 단색에 가까울수록 잘 됩니다.
   경계는 한 겹만 반투명으로 남겨 톱니를 줄입니다.                        */
export function prepSkin(file, { max = 240, cut = true, tol = 42 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      if (!cut) {
        resolve(cv.toDataURL("image/jpeg", 0.82));
        return;
      }

      const im = ctx.getImageData(0, 0, w, h);
      const d = im.data;

      /* 네 변의 평균색을 배경색으로 봅니다 */
      let br = 0, bg = 0, bb = 0, n = 0;
      const edge = (x, y) => {
        const i = (y * w + x) * 4;
        br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n++;
      };
      for (let x = 0; x < w; x++) { edge(x, 0); edge(x, h - 1); }
      for (let y = 0; y < h; y++) { edge(0, y); edge(w - 1, y); }
      br /= n; bg /= n; bb /= n;

      const seen = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }

      const soft = tol * 1.45;
      while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue;
        seen[p] = 1;
        const i = p * 4;
        const dist = Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb);
        if (dist > soft) continue;
        if (dist > tol) {
          /* 경계 한 겹 — 반투명으로 남기고 더 번지지 않습니다 */
          d[i + 3] = Math.round(255 * ((dist - tol) / (soft - tol)));
          continue;
        }
        d[i + 3] = 0;
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
      ctx.putImageData(im, 0, 0);

      /* 남은 그림에 딱 맞게 잘라냅니다 */
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < x0 || y1 < y0) {
        resolve(cv.toDataURL("image/png"));   // 전부 지워졌으면 그대로
        return;
      }
      const cw = x1 - x0 + 1;
      const ch = y1 - y0 + 1;
      const out = document.createElement("canvas");
      out.width = cw;
      out.height = ch;
      out.getContext("2d").drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
      resolve(out.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했어요"));
    };
    img.src = url;
  });
}

/* ---------- 플레이리스트(이름·커버) ---------- */

export const plList = () => call("cc_pl_list");
export const plCover = (hostCode, name, cover) =>
  call("cc_pl_cover", { p_host_code: hostCode, p_name: name, p_cover: cover });
export const plRename = (hostCode, oldName, newName) =>
  call("cc_pl_rename", { p_host_code: hostCode, p_old: oldName, p_new: newName });

/* ---------- 음악 ---------- */

export const trackList = () => call("cc_track_list");
export const trackAdd = (hostCode, title, path, pl) =>
  call("cc_track_add", { p_host_code: hostCode, p_title: title, p_path: path, p_pl: pl || "기본" });

export async function trackDel(hostCode, id) {
  const r = await call("cc_track_del", { p_host_code: hostCode, p_id: id });
  if (r?.ok && r.path && supabase) {
    try {
      await supabase.storage.from("music").remove([r.path]);
    } catch {
      /* 목록에서만 사라져도 괜찮습니다 */
    }
  }
  return r;
}

/* 파일을 music 보관함에 올리고, 목록에 등록까지 합니다 */
export async function uploadTrack(hostCode, file, title, pl) {
  if (!supabase) return { ok: false, error: "no_server" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "too_big" };

  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const up = await supabase.storage.from("music").upload(path, file, {
    contentType: file.type || "audio/mpeg",
    upsert: false,
  });
  if (up.error) {
    const msg = up.error.message || "";
    return { ok: false, error: /bucket/i.test(msg) ? "no_bucket" : "upload_failed", message: msg };
  }

  const reg = await trackAdd(hostCode, title || file.name.replace(/\.[^.]+$/, ""), path, pl);
  if (!reg?.ok) {
    try {
      await supabase.storage.from("music").remove([path]);
    } catch {
      /* 무시 */
    }
    return reg;
  }
  return { ok: true, id: reg.id, path };
}

/* 효과음은 목록에 'sfx:이름' 이라는 제목으로 넣어 구분합니다.
   따로 테이블을 만들지 않아도 되고, 플레이리스트에는 안 보이게 걸러냅니다. */
export const SFX_PREFIX = "sfx:";
export const isSfx = (t) => (t?.title || "").startsWith(SFX_PREFIX);
export const findSfx = (list, key) =>
  (list || []).find((t) => t.title === SFX_PREFIX + key) || null;

export function trackUrl(path) {
  if (!supabase || !path) return null;
  return supabase.storage.from("music").getPublicUrl(path).data.publicUrl;
}

/* ---------- 캐릭터 이미지(스킨) ---------- */

export const skinList = () => call("cc_skin_list");
export const skinAdd = (hostCode, name, image, price) =>
  call("cc_skin_add", { p_host_code: hostCode, p_name: name, p_image: image, p_price: price });
export const skinDel = (hostCode, id) => call("cc_skin_del", { p_host_code: hostCode, p_id: id });

/* ---------- 📮 우체통 (생겼으면 하는 캐릭터) ---------- */

export const wishAdd = (round, name, body) =>
  call("cc_wish_add", { p_round: round ?? 0, p_name: name, p_body: body });
export const wishList = (round) => call("cc_wish_list", { p_round: round ?? null });
export const wishDel = (hostCode, id) => call("cc_wish_del", { p_host_code: hostCode, p_id: id });

/* ---------- 📮 피드백 (익명) ---------- */

export const fbAdd = (round, body) => call("cc_fb_add", { p_round: round ?? 0, p_body: body });
export const fbList = (hostCode, round) =>
  call("cc_fb_list", { p_host_code: hostCode, p_round: round ?? null });
export const fbDel = (hostCode, id) => call("cc_fb_del", { p_host_code: hostCode, p_id: id });

/* ---------- 떵개방 메뉴 가챠 ---------- */

export const foodList = () => call("cc_food_list");
export const foodAdd = (hostCode, name) => call("cc_food_add", { p_host_code: hostCode, p_name: name });
export const foodEdit = (hostCode, id, name) =>
  call("cc_food_edit", { p_host_code: hostCode, p_id: id, p_name: name });
export const foodDel = (hostCode, id) => call("cc_food_del", { p_host_code: hostCode, p_id: id });

/* 하루 한 번만 뽑게 — 이 기기에 뽑은 시각을 남깁니다 */
export const DAY = 24 * 60 * 60 * 1000;

/* kind 별로 따로 기록합니다 ("gacha", "fortune" …) */
export function lastDraw(kind = "gacha") {
  try {
    const raw = localStorage.getItem("ccDraw:" + kind);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v?.at || Date.now() - v.at > DAY) return null;   // 24시간 지나면 초기화
    return v;
  } catch {
    return null;
  }
}

export function saveDraw(kind, value) {
  try {
    localStorage.setItem("ccDraw:" + kind, JSON.stringify({ at: Date.now(), food: value }));
  } catch {
    /* 무시 */
  }
}

/* ---------- 포춘쿠키 ---------- */

export const fortuneList = () => call("cc_fortune_list");
export const fortuneAdd = (hostCode, text) => call("cc_fortune_add", { p_host_code: hostCode, p_text: text });
export const fortuneEdit = (hostCode, id, text) =>
  call("cc_fortune_edit", { p_host_code: hostCode, p_id: id, p_text: text });
export const fortuneDel = (hostCode, id) => call("cc_fortune_del", { p_host_code: hostCode, p_id: id });
