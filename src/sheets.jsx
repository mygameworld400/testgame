import { useCallback, useEffect, useRef, useState } from "react";
import { buzz, ding } from "./sfx.js";

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

const PACK_COLORS = ["#ff9ec4", "#8fe3c9", "#ffd45e", "#b6a6f0", "#7fc8f5"];

/* 보따리 — 매듭 묶인 천 주머니 */
function Bundle({ color }) {
  return (
    <svg className="ccBundle" viewBox="0 0 44 44" width="40" height="40">
      {/* 매듭 */}
      <path d="M17,12 l-6,-7 8,3 3,-4 3,4 8,-3 -6,7 z" fill={color} stroke="#5b4a63" strokeWidth="2.5" strokeLinejoin="round" />
      {/* 주머니 */}
      <path d="M22,12 c11,0 17,9 17,17 c0,7 -8,11 -17,11 c-9,0 -17,-4 -17,-11 c0,-8 6,-17 17,-17 z"
        fill={color} stroke="#5b4a63" strokeWidth="2.5" strokeLinejoin="round" />
      {/* 무늬 */}
      <circle cx="14" cy="26" r="2.6" fill="#fff" opacity="0.85" />
      <circle cx="24" cy="31" r="3" fill="#fff" opacity="0.85" />
      <circle cx="32" cy="24" r="2.2" fill="#fff" opacity="0.85" />
      {/* 묶인 선 */}
      <path d="M11,17 c7,4 15,4 22,0" stroke="#5b4a63" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/* ============================ 퀴즈 ============================ */

export function QuizSheet({ hostCode, isHost, onClose, mode = "solo" }) {
  const [packs, setPacks] = useState(null);
  const [pack, setPack] = useState(null);        // 고른 주제 (없으면 패키지 목록)
  const [newPack, setNewPack] = useState("과자");
  const [list, setList] = useState(null);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState(""); // 'o' | 'x'
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
    setShown(r.answer || "");
    if (r.correct) ding();
    else buzz();
    setTimeout(
      () => {
        setResult(null);
        setShown("");
        setGuess("");
        setI((v) => (inPack.length ? (v + 1) % inPack.length : 0));
      },
      r.correct ? 900 : 1900
    );
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
            {(packs || []).map((p, n) => (
              <button key={p.pack} className="ccPack" onClick={() => { setPack(p.pack); setI(0); ding(); }}>
                <Bundle color={PACK_COLORS[n % PACK_COLORS.length]} />
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

      {pack && q && !adding && (
        <>
          <div className={"ccQuizImg" + (result === "x" ? " ccShake" : "")}>
            <img src={q.image} alt="퀴즈" />
            {result && (
              <div className={"ccMark " + (result === "o" ? "ccMarkO" : "ccMarkX")}>
                <span className="ccMarkSign">{result === "o" ? "○" : "✕"}</span>
                {result === "x" && shown && <span className="ccRedPen">정답 : {shown}</span>}
              </div>
            )}
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
  const [pl, setPl] = useState("기본");
  const [open, setOpen] = useState({});          // 펼쳐진 플레이리스트
  const file = useRef(null);

  const load = useCallback(async () => {
    const r = await trackList();
    if (Array.isArray(r)) setList(r);
    else { setList([]); setErr(msgOf(r)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const songs = (list || []).filter((t) => !isSfx(t));
  const sfx = (list || []).filter(isSfx);

  /* 플레이리스트별로 묶기 */
  const groups = [];
  songs.forEach((t) => {
    const key = t.pl || "기본";
    let g = groups.find((x) => x.name === key);
    if (!g) { g = { name: key, items: [] }; groups.push(g); }
    g.items.push(t);
  });

  const toTrack = (t) => ({ id: t.id, title: t.title, url: trackUrl(t.path) });

  const add = async () => {
    if (!chosen) { setErr("파일을 골라주세요."); return; }
    setBusy(true);
    const r = await uploadTrack(hostCode, chosen, asSfx ? SFX_PREFIX + "splash" : title, pl);
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
      {list && groups.length === 0 && !adding && (
        <p className="ccSheetEmpty">
          아직 곡이 없어요.
          {isHost ? " 위에서 파일을 올려보세요." : " 호스트가 올리면 들을 수 있어요."}
        </p>
      )}

      {groups.length > 0 && !adding && (
        <div className="ccPls">
          {groups.map((g) => {
            const isOpen = !!open[g.name];
            return (
              <div key={g.name} className="ccPl">
                <div className="ccPlHead">
                  <button
                    className="ccPlName"
                    onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}
                  >
                    <span className="ccPlArrow">{isOpen ? "▾" : "▸"}</span>
                    {g.name}
                    <span className="ccPlN">{g.items.length}곡</span>
                  </button>
                  <button
                    className="ccPlPlay"
                    title="전체 재생"
                    onClick={() => onPlay(g.items.map(toTrack), 0, g.name)}
                  >
                    ▶
                  </button>
                </div>
                {isOpen && (
                  <ul className="ccTracks">
                    {g.items.map((t, n) => (
                      <li key={t.id} className={playingId === t.id ? "ccTrackOn" : ""}>
                        <button className="ccTrackBtn" onClick={() => onPlay(g.items.map(toTrack), n, g.name)}>
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
              </div>
            );
          })}
        </div>
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
          {!asSfx && (
            <>
              <input
                className="ccInput"
                value={pl}
                maxLength={24}
                placeholder="플레이리스트 이름"
                list="ccPlList"
                onChange={(e) => setPl(e.target.value)}
              />
              <datalist id="ccPlList">
                {groups.map((g) => (
                  <option key={g.name} value={g.name} />
                ))}
              </datalist>
              {groups.length > 0 && (
                <div className="ccRow ccPlPick">
                  {groups.map((g) => (
                    <button key={g.name} className="ccMini" onClick={() => setPl(g.name)}>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="ccRow">
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>{busy ? "올리는 중…" : "올리기"}</button>
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
