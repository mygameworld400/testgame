import { useCallback, useEffect, useRef, useState } from "react";
import { SFX_PREFIX, isSfx, quizAdd, quizCheck, quizDel, quizList, shrinkImage, trackDel, trackList, trackUrl, uploadTrack } from "./content.js";

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

export function QuizSheet({ hostCode, isHost, onClose }) {
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
    const r = await quizList();
    if (Array.isArray(r)) {
      setList(r);
      setI((v) => Math.min(v, Math.max(0, r.length - 1)));
    } else {
      setList([]);
      setErr(msgOf(r));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = list && list[i];

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
        setI((v) => (list.length ? (v + 1) % list.length : 0));
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
    const r = await quizAdd(hostCode, preview, answer.trim());
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

      {list === null && <p className="ccSheetEmpty">불러오는 중…</p>}

      {list && songs.length === 0 && !adding && (
        <p className="ccSheetEmpty">
          아직 문제가 없어요.
          {isHost ? " 아래에서 문제를 만들어보세요." : " 호스트가 문제를 올리면 풀 수 있어요."}
        </p>
      )}

      {q && !adding && (
        <>
          <div className={"ccQuizImg" + (result === "x" ? " ccShake" : "")}>
            <img src={q.image} alt="퀴즈" />
            {result && <div className={"ccMark " + (result === "o" ? "ccMarkO" : "ccMarkX")}>{result === "o" ? "○" : "✕"}</div>}
          </div>
          <div className="ccQuizNav">
            <button className="ccMini" onClick={() => { setI((v) => (v - 1 + list.length) % list.length); setGuess(""); }}>◀</button>
            <span>{i + 1} / {list.length}</span>
            <button className="ccMini" onClick={() => { setI((v) => (v + 1) % list.length); setGuess(""); }}>▶</button>
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
          <div className="ccRow">
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>{busy ? "올리는 중…" : "문제 추가"}</button>
            <button className="ccMini" onClick={() => { setAdding(false); setPreview(null); }}>취소</button>
          </div>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}

      {isHost && !adding && (
        <div className="ccRow ccHostRow">
          <button className="ccMini" onClick={() => setAdding(true)}>+ 문제 추가</button>
          {q && <button className="ccMini ccDanger" onClick={remove}>이 문제 삭제</button>}
        </div>
      )}
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

      {list === null && <p className="ccSheetEmpty">불러오는 중…</p>}
      {list && songs.length === 0 && !adding && (
        <p className="ccSheetEmpty">
          아직 곡이 없어요.
          {isHost ? " 아래에서 파일을 올려보세요." : " 호스트가 올리면 들을 수 있어요."}
        </p>
      )}

      {songs.length > 0 && (
        <ul className="ccTracks">
          {songs.map((t) => (
            <li key={t.id} className={playingId === t.id ? "ccTrackOn" : ""}>
              <button className="ccTrackBtn" onClick={() => onPlay({ id: t.id, title: t.title, url: trackUrl(t.path) })}>
                {playingId === t.id ? "▶" : "♪"} {t.title}
              </button>
              {isHost && <button className="ccMini ccDanger" onClick={() => remove(t.id)} disabled={busy}>삭제</button>}
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

      {isHost && !adding && (
        <div className="ccRow ccHostRow">
          <button className="ccMini" onClick={() => setAdding(true)}>+ 곡 · 효과음 추가</button>
          {sfx.map((t) => (
            <button key={t.id} className="ccMini ccDanger" onClick={() => remove(t.id)} disabled={busy}>
              {t.title.replace("sfx:", "효과음 ")} 삭제
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
