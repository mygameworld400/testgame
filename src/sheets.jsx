import { useCallback, useEffect, useRef, useState } from "react";

import { SFX_PREFIX, isSfx, quizAdd, quizCheck, quizDel, quizList, quizPacks, shrinkImage, trackDel, trackList, trackUrl, uploadTrack } from "./content.js";

const ERR = {
  bad_code: "호스트 코드가 맞지 않아요.",
  empty: "빈 칸이 있어요.",
  too_big: "파일이 너무 커요.",
  no_schema: "서버에 함수가 아직 없어요. supabase/schema.sql 을 실행해주세요.",
  no_bucket: "music 보관함이 없어요. supabase/schema.sql 을 실행해주세요.",
  upload_failed: "업로드에 실패했어요.",
  no_server: "서버 설정이 없어요.",
  server_error: "서버와 통신하지 못했어요.",
};
const msgOf = (r) => ERR[r?.error] || ERR.server_error;

/* ============================ 퀴즈 ============================ */

export function QuizSheet({ hostCode, isHost, onClose, mode = "solo" }) {
  const [packs, setPacks] = useState(null);
  const [pack, setPack] = useState(null);        // 고른 주제 (없으면 패키지 목록)
  const [newPack, setNewPack] = useState("과자");
  const [list, setList] = useState(null);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null); // 'o' | 'x'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(null);
  const [answer, setAnswer] = useState("");
  const file = useRef(null);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([quizList(), quizPacks()]);
    if (Array.isArray(r)) {
      setList(r);
      setI(0);
    } else {
      setList([]);
      setErr(msgOf(r));
    }
    setPacks(Array.isArray(p) ? p : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* 고른 주제의 문제만 풉니다 */
  const inPack = (list || []).filter((x) => !pack || (x.pack || "과자") === pack);
  const q = inPack[i];

  const submit = async (e) => {
    e?.preventDefault();
    if (!q || busy) return;
    setBusy(true);
    const r = await quizCheck(q.id, guess);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setResult(r.correct ? "o" : "x");
    if (r.correct) {
      setTimeout(() => {
        setResult(null);
        setGuess("");
        setI((v) => (inPack.length ? (v + 1) % inPack.length : 0));
      }, 900);
    } else {
      setTimeout(() => setResult(null), 700);
    }
  };

  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setPreview(await shrinkImage(f));
      setErr("");
    } catch {
      setErr("이미지를 읽지 못했어요.");
    }
  };

  const add = async () => {
    if (!preview || !answer.trim()) { setErr(ERR.empty); return; }
    setBusy(true);
    const r = await quizAdd(hostCode, preview, answer.trim(), newPack.trim() || "과자");
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setPreview(null);
    setAnswer("");
    if (file.current) file.current.value = "";
    setAdding(false);
    setErr("");
    load();
  };

  const remove = async () => {
    if (!q) return;
    setBusy(true);
    const r = await quizDel(hostCode, q.id);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    load();
  };

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">❓ 퀴즈상가</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {isHost && !adding && (
        <div className="ccRow ccHostRow ccHostTop">
          <button className="ccBtn ccMiniBtn ccAddBtn" onClick={() => setAdding(true)}>+ 문제 추가</button>
          {q && <button className="ccMini ccDanger" onClick={remove}>이 문제 삭제</button>}
        </div>
      )}

      {list === null && <p className="ccSheetEmpty">불러오는 중…</p>}

      {/* 주제(패키지) 고르기 */}
      {list && !adding && !pack && (
        <>
          <p className="ccSheetNote">
            {mode === "team" ? "팀전" : "개인전"} · 풀고 싶은 퀴즈 패키지를 골라주세요
          </p>
          {(packs || []).length === 0 && (
            <p className="ccSheetEmpty">
              아직 문제가 없어요.
              {isHost ? " 위에서 문제를 만들어보세요." : " 호스트가 올리면 풀 수 있어요."}
            </p>
          )}
          <div className="ccPacks">
            {(packs || []).map((p) => (
              <button key={p.pack} className="ccPack" onClick={() => { setPack(p.pack); setI(0); }}>
                <span className="ccPackName">{p.pack} 퀴즈</span>
                <span className="ccPackN">{p.n}문제</span>
              </button>
            ))}
          </div>
        </>
      )}

      {pack && !adding && (
        <div className="ccPackBar">
          <button className="ccMini" onClick={() => { setPack(null); setGuess(""); }}>← 패키지</button>
          <b>{pack} 퀴즈</b>
        </div>
      )}

      {q && !adding && (
        <>
          <div className={"ccQuizImg" + (result === "x" ? " ccShake" : "")}>
            <img src={q.image} alt="퀴즈" />
            {result && <div className={"ccMark " + (result === "o" ? "ccMarkO" : "ccMarkX")}>{result === "o" ? "○" : "✕"}</div>}
          </div>
          <div className="ccQuizNav">
            <button className="ccMini" onClick={() => { setI((v) => (v - 1 + inPack.length) % inPack.length); setGuess(""); }}>◀</button>
            <span>{i + 1} / {inPack.length}</span>
            <button className="ccMini" onClick={() => { setI((v) => (v + 1) % inPack.length); setGuess(""); }}>▶</button>
          </div>
          <form onSubmit={submit} className="ccRow">
            <input
              className="ccInput"
              value={guess}
              maxLength={30}
              placeholder="정답을 적어주세요"
              onChange={(e) => setGuess(e.target.value)}
              autoFocus
            />
            <button className="ccBtn ccMiniBtn" type="submit" disabled={busy}>확인</button>
          </form>
        </>
      )}

      {isHost && adding && (
        <div className="ccAdd">
          <input ref={file} className="ccFile" type="file" accept="image/*" onChange={pick} />
          {preview && <img className="ccPreview" src={preview} alt="미리보기" />}
          <input
            className="ccInput"
            value={answer}
            maxLength={30}
            placeholder="정답"
            onChange={(e) => setAnswer(e.target.value)}
          />
          <input
            className="ccInput"
            value={newPack}
            maxLength={20}
            placeholder="주제 (예: 과자)"
            onChange={(e) => setNewPack(e.target.value)}
          />
          <div className="ccRow">
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>{busy ? "올리는 중…" : "문제 추가"}</button>
            <button className="ccMini" onClick={() => { setAdding(false); setPreview(null); }}>취소</button>
          </div>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}

    </div>
  );
}

/* ============================ 플레이리스트 ============================ */

export function MusicSheet({ hostCode, isHost, onClose, onPlay, playingId }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState(null);
  const [asSfx, setAsSfx] = useState(false);
  const file = useRef(null);

  const load = useCallback(async () => {
    const r = await trackList();
    if (Array.isArray(r)) setList(r);
    else { setList([]); setErr(msgOf(r)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!chosen) { setErr("파일을 골라주세요."); return; }
    setBusy(true);
    const r = await uploadTrack(hostCode, chosen, asSfx ? SFX_PREFIX + "splash" : title);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setChosen(null);
    setTitle("");
    setAsSfx(false);
    if (file.current) file.current.value = "";
    setAdding(false);
    setErr("");
    load();
  };

  const songs = (list || []).filter((t) => !isSfx(t));
  const sfx = (list || []).filter(isSfx);

  const remove = async (id) => {
    setBusy(true);
    const r = await trackDel(hostCode, id);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    load();
  };

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">♪ 플레이리스트</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {isHost && !adding && (
        <div className="ccRow ccHostRow ccHostTop">
          <button className="ccBtn ccMiniBtn ccAddBtn" onClick={() => setAdding(true)}>+ 곡 · 효과음 추가</button>
          {sfx.map((t) => (
            <button key={t.id} className="ccMini ccDanger" onClick={() => remove(t.id)} disabled={busy}>
              {t.title.replace("sfx:", "효과음 ")} 삭제
            </button>
          ))}
        </div>
      )}

      {list === null && <p className="ccSheetEmpty">불러오는 중…</p>}
      {list && songs.length === 0 && !adding && (
        <p className="ccSheetEmpty">
          아직 곡이 없어요.
          {isHost ? " 아래에서 파일을 올려보세요." : " 호스트가 올리면 들을 수 있어요."}
        </p>
      )}

      {songs.length > 0 && (
        <ul className="ccTracks">
          {songs.map((t, n) => (
            <li key={t.id} className={playingId === t.id ? "ccTrackOn" : ""}>
              <button className="ccTrackBtn" onClick={() => onPlay({ id: t.id, title: t.title, url: trackUrl(t.path) })}>
                <span className="ccTrackNo">{playingId === t.id ? "▶" : String(n + 1).padStart(2, "0")}</span>
                <span className="ccTrackName">{t.title}</span>
              </button>
              {isHost && (
                <button className="ccTrackDel" onClick={() => remove(t.id)} disabled={busy} title="삭제">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isHost && adding && (
        <div className="ccAdd">
          <input
            ref={file}
            className="ccFile"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setChosen(f || null);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 40));
            }}
          />
          <input
            className="ccInput"
            value={title}
            maxLength={40}
            placeholder="곡 제목"
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="ccRow">
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>{busy ? "올리는 중…" : "곡 추가"}</button>
            <button className="ccMini" onClick={() => { setAdding(false); setChosen(null); }}>취소</button>
          </div>
          <label className="ccCheck">
            <input type="checkbox" checked={asSfx} onChange={(e) => setAsSfx(e.target.checked)} />
            수영장 물소리로 쓰기 (곡 목록에는 안 보여요)
          </label>
          <p className="ccSheetNote">mp3 · m4a · wav — 한 개당 20MB 까지</p>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}

    </div>
  );
}
