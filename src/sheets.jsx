import { useCallback, useEffect, useRef, useState } from "react";
import { blip, buzz, ding } from "./sfx.js";
import { MENU } from "./rooms.jsx";
import { Pix } from "./pix.jsx";
import { FACES, HATS, OUTFITS, lookSprite } from "./sprites.js";

import { DAY, SFX_PREFIX, prepSkin, skinAdd, skinDel, foodAdd, fortuneAdd, fortuneDel, fortuneEdit, fortuneList, foodDel, foodEdit, foodList, isSfx, lastDraw, plRename, quizAdd, saveDraw, quizCheck, quizDel, quizList, quizPacks, shrinkImage, trackDel, trackList, trackUrl, uploadTrack } from "./content.js";

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

const SFX_LABEL = { splash: "물소리", key: "타건음", sand: "모래소리", ball: "왁뿌볼소리" };

const PACK_COLORS = ["#ff9ec4", "#8fe3c9", "#ffd45e", "#b6a6f0", "#7fc8f5"];

/* 보따리 매듭 — 주머니(아래 CSS 도형) 위에 얹습니다 */
function Knot({ color }) {
  return (
    <svg className="ccKnot" viewBox="0 0 46 22" width="46" height="22">
      <path
        d="M23,20 l-9,-11 6,2 3,-8 3,8 6,-2 -9,11 z"
        fill={color}
        stroke="#5b4a63"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ============================ 퀴즈 ============================ */

export function QuizSheet({ hostCode, isHost, onClose, mode = "solo", fixedPack = null, onFinish }) {
  const [packs, setPacks] = useState(null);
  const [pack, setPack] = useState(fixedPack);   // 고른 주제 (없으면 패키지 목록)
  const [newPack, setNewPack] = useState("과자");
  const [list, setList] = useState(null);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState("");
  const [score, setScore] = useState({ ok: 0, done: 0 });
  const [finished, setFinished] = useState(false); // 'o' | 'x'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(null);
  const [answer, setAnswer] = useState("");
  const [alts, setAlts] = useState("");
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
    setScore((v) => ({ ok: v.ok + (r.correct ? 1 : 0), done: v.done + 1 }));
    if (r.correct) ding();
    else buzz();

    const last = i + 1 >= inPack.length;
    setTimeout(
      () => {
        setResult(null);
        setShown("");
        setGuess("");
        if (last) {
          setFinished(true);               // 패키지 끝 — 더 이어지지 않습니다
          onFinish?.({ ok: score.ok + (r.correct ? 1 : 0), done: inPack.length });
        }
        else setI(i + 1);
      },
      r.correct ? 900 : 2100
    );
  };

  /* 패키지를 고르거나 다시 풀 때 초기화 */
  const startPack = (name) => {
    setPack(name);
    setI(0);
    setGuess("");
    setResult(null);
    setShown("");
    setScore({ ok: 0, done: 0 });
    setFinished(false);
    ding();
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
    /* 정답 + 중복 정답을 쉼표로 이어서 보냅니다 */
    const all = [answer.trim(), ...alts.split(",").map((x) => x.trim()).filter(Boolean)].join(",");
    const r = await quizAdd(hostCode, preview, all, newPack.trim() || "과자");
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setPreview(null);
    setAnswer("");
    setAlts("");
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
        <h2 className="ccSheetTitle">{mode === "team" ? "🤝 팀전" : "❓ 퀴즈상가"}</h2>
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
            {(packs || []).map((p, n) => {
              const col = PACK_COLORS[n % PACK_COLORS.length];
              return (
                <button
                  key={p.pack}
                  className="ccPack"
                  style={{ background: col }}
                  onClick={() => startPack(p.pack)}
                >
                  <Knot color={col} />
                  <span className="ccPackName">{p.pack} 퀴즈</span>
                  <span className="ccPackN">{p.n}문제</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {pack && !adding && (
        <div className="ccPackBar">
          {!fixedPack && (
            <button className="ccMini" onClick={() => { setPack(null); setGuess(""); setFinished(false); }}>← 패키지</button>
          )}
          <b>{pack} 퀴즈</b>
        </div>
      )}

      {pack && finished && !adding && (
        <div className="ccScore">
          <div className="ccScoreBig">
            {score.ok} <span>/ {score.done}</span>
          </div>
          <p className="ccScoreMsg">
            {score.ok === score.done
              ? "전부 맞혔어요! 대단해요"
              : score.ok === 0
                ? "아쉬워요… 한 번 더 도전해볼까요?"
                : "수고했어요! 다시 풀면 더 잘할 수 있어요"}
          </p>
          <div className="ccRow">
            <button className="ccBtn ccMiniBtn" onClick={() => startPack(pack)}>다시 풀기</button>
            {!fixedPack && (
              <button className="ccMini" onClick={() => { setPack(null); setFinished(false); }}>다른 패키지</button>
            )}
            {fixedPack && <button className="ccMini" onClick={onClose}>닫기</button>}
          </div>
        </div>
      )}

      {pack && !finished && q && !adding && (
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
            <span className="ccQuizStep">{i + 1} / {inPack.length}</span>
            <span className="ccQuizOk">맞힌 문제 {score.ok}개</span>
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
            value={alts}
            maxLength={60}
            placeholder="중복 정답 (쉼표로 구분, 없으면 비워두세요)"
            onChange={(e) => setAlts(e.target.value)}
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
  const [sfxKind, setSfxKind] = useState("");   // "" = 일반 곡
  const [pl, setPl] = useState("기본");
  const [open, setOpen] = useState({});          // 펼쳐진 플레이리스트
  const [editing, setEditing] = useState(null);  // 이름 수정 중인 플레이리스트
  const [editName, setEditName] = useState("");
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
    const r = await uploadTrack(hostCode, chosen, sfxKind ? SFX_PREFIX + sfxKind : title, pl);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setChosen(null);
    setTitle("");
    setSfxKind("");
    if (file.current) file.current.value = "";
    setAdding(false);
    setErr("");
    load();
  };

  const saveName = async (oldName) => {
    const next = editName.trim();
    if (!next || next === oldName) { setEditing(null); return; }
    setBusy(true);
    const r = await plRename(hostCode, oldName, next);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setEditing(null);
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
              {SFX_LABEL[t.title.replace(SFX_PREFIX, "")] || t.title} 삭제
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
                  {editing === g.name ? (
                    <>
                      <input
                        className="ccInput ccPlEdit"
                        value={editName}
                        maxLength={24}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveName(g.name); }}
                      />
                      <button className="ccMini" onClick={() => saveName(g.name)} disabled={busy}>저장</button>
                      <button className="ccMini" onClick={() => setEditing(null)}>취소</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="ccPlName"
                        onClick={() => setOpen((o) => ({ ...o, [g.name]: !o[g.name] }))}
                      >
                        <span className="ccPlArrow">{isOpen ? "▾" : "▸"}</span>
                        <span className="ccPlTitle">{g.name}</span>
                        <span className="ccPlN">{g.items.length}곡</span>
                      </button>
                      {isHost && (
                        <>
                          <button
                            className="ccPlIcon"
                            title="이름 수정"
                            onClick={() => { setEditing(g.name); setEditName(g.name); }}
                          >
                            ✎
                          </button>
                        </>
                      )}
                      <button
                        className="ccPlPlay"
                        title="전체 재생"
                        onClick={() => onPlay(g.items.map(toTrack), 0, g.name)}
                      >
                        ▶
                      </button>
                    </>
                  )}
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
          {!sfxKind && (
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
          <div className="ccFieldLabel">효과음으로 쓰기 (곡 목록에는 안 보여요)</div>
          <div className="ccRow ccSizes">
            {[
              ["", "일반 곡"],
              ["splash", "수영장 물소리"],
              ["key", "키보드 타건음"],
              ["sand", "모래 밟는 소리"],
              ["ball", "왁뿌볼 소리"],
            ].map(([k, label]) => (
              <button
                key={k || "song"}
                className={"ccMini" + (sfxKind === k ? " ccSizeOn" : "")}
                onClick={() => setSfxKind(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="ccSheetNote">mp3 · m4a · wav — 한 개당 20MB 까지</p>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}
    </div>
  );
}


/* ============================ 팀전 대기실 ============================ */

export function TeamLobby({ me, games, myGid, packs, onCreate, onJoin, onLeave, onStart, onClose, results }) {
  const [adding, setAdding] = useState(false);
  const [size, setSize] = useState(0);          // 0 = 자유
  const [pack, setPack] = useState("");

  const list = [...(games || [])].sort((a, b) => a.at - b.at);
  const mine = list.find((g) => g.gid === myGid);

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">🤝 팀전 대기실</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {!adding && !mine && (
        <div className="ccRow ccHostRow ccHostTop">
          <button
            className="ccBtn ccMiniBtn ccAddBtn"
            onClick={() => { setAdding(true); setPack((packs || [])[0]?.pack || ""); }}
          >
            + 팀전 만들기
          </button>
        </div>
      )}

      {adding && (
        <div className="ccAdd">
          <div className="ccFieldLabel">몇 명이서 할까요?</div>
          <div className="ccRow ccSizes">
            {[0, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={"ccMini" + (size === n ? " ccSizeOn" : "")}
                onClick={() => setSize(n)}
              >
                {n === 0 ? "자유" : `${n}명`}
              </button>
            ))}
          </div>
          <div className="ccFieldLabel">주제</div>
          <div className="ccRow ccSizes">
            {(packs || []).map((p) => (
              <button
                key={p.pack}
                className={"ccMini" + (pack === p.pack ? " ccSizeOn" : "")}
                onClick={() => setPack(p.pack)}
              >
                {p.pack}
              </button>
            ))}
          </div>
          <div className="ccRow">
            <button
              className="ccBtn ccMiniBtn"
              disabled={!pack}
              onClick={() => { onCreate({ size, pack }); setAdding(false); }}
            >
              만들기
            </button>
            <button className="ccMini" onClick={() => setAdding(false)}>취소</button>
          </div>
          {!packs?.length && <p className="ccSheetNote">먼저 퀴즈 문제가 등록되어 있어야 해요.</p>}
        </div>
      )}

      {!adding && list.length === 0 && (
        <p className="ccSheetEmpty">아직 열린 팀전이 없어요. 직접 만들어보세요!</p>
      )}

      {!adding && list.length > 0 && (
        <div className="ccGames">
          {list.map((g) => {
            const joined = g.members.some((m) => m.id === me.id);
            const isHostOf = g.hostId === me.id;
            const full = g.size > 0 && g.members.length >= g.size;
            return (
              <div key={g.gid} className={"ccGame" + (g.state === "play" ? " ccGamePlay" : "")}>
                <div className="ccGameTop">
                  <b>{g.pack} 퀴즈</b>
                  <span className={"ccGameState" + (g.state === "play" ? " ccGameOn" : "")}>
                    {g.state === "play" ? "진행중" : "대기중"}
                  </span>
                </div>
                <div className="ccGameWho">
                  {g.members.map((m) => m.name).join(" · ")}
                  <span className="ccGameN">
                    {g.members.length}
                    {g.size > 0 ? ` / ${g.size}` : ""}명
                  </span>
                </div>
                <div className="ccRow ccGameBtns">
                  {g.state === "wait" && !joined && !full && (
                    <button className="ccBtn ccMiniBtn" onClick={() => onJoin(g.gid)}>참여</button>
                  )}
                  {g.state === "wait" && !joined && full && <span className="ccSheetNote">정원이 찼어요</span>}
                  {joined && !isHostOf && (
                    <button className="ccMini" onClick={() => onLeave(g.gid)}>나가기</button>
                  )}
                  {isHostOf && g.state === "wait" && (
                    <>
                      <button
                        className="ccBtn ccMiniBtn"
                        disabled={g.members.length < 2}
                        onClick={() => onStart(g.gid)}
                      >
                        {g.members.length < 2 ? "2명부터 시작" : "시작"}
                      </button>
                      <button className="ccMini" onClick={() => onLeave(g.gid)}>취소</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {results?.length > 0 && (
        <div className="ccResults">
          <div className="ccFieldLabel">지난 팀전 결과</div>
          {results.map((r, i) => (
            <div key={i} className="ccResultLine">
              <b>{r.name}</b>
              <span>
                {r.ok} / {r.done}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ============================ 떵개방 메뉴 가챠 ============================ */

export function GachaSheet({ hostCode, isHost, onClose, onDraw }) {
  const [foods, setFoods] = useState(null);
  const [step, setStep] = useState("ask");      // ask -> rolling -> done
  const [pick, setPick] = useState(null);
  const [roll, setRoll] = useState("");
  const [err, setErr] = useState("");
  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const prev = useRef(lastDraw("gacha"));

  const load = useCallback(async () => {
    const r = await foodList();
    if (Array.isArray(r)) setFoods(r);
    else { setFoods([]); setErr(msgOf(r)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (prev.current) {
      setPick(prev.current.food);
      setStep("done");
    }
  }, []);

  const start = () => {
    if (!foods?.length) { setErr("메뉴가 하나도 없어요."); return; }
    setStep("rolling");
    blip(900);
    let n = 0;
    const iv = setInterval(() => {
      setRoll(foods[Math.floor(Math.random() * foods.length)].name);
      n += 1;
      if (n > 16) {
        clearInterval(iv);
        const win = foods[Math.floor(Math.random() * foods.length)].name;
        setPick(win);
        saveDraw("gacha", win);
        prev.current = { at: Date.now(), food: win };
        setStep("done");
        ding();
        onDraw?.();
      }
    }, 90);
  };

  const left = () => {
    if (!prev.current) return "";
    const ms = DAY - (Date.now() - prev.current.at);
    if (ms <= 0) return "";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const r = await foodAdd(hostCode, newName.trim());
    setBusy(false);
    if (!r?.ok) { setErr(r?.error === "dup" ? "이미 있는 메뉴예요." : msgOf(r)); return; }
    setNewName("");
    setErr("");
    load();
  };

  const saveEdit = async (id) => {
    setBusy(true);
    const r = await foodEdit(hostCode, id, editName.trim());
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setEditId(null);
    load();
  };

  const del = async (id) => {
    setBusy(true);
    const r = await foodDel(hostCode, id);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    load();
  };

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">🍜 오늘 뭐 먹지?</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {isHost && !manage && (
        <div className="ccRow ccHostRow ccHostTop">
          <button className="ccBtn ccMiniBtn ccAddBtn" onClick={() => setManage(true)}>
            메뉴 관리 ({foods?.length ?? "-"})
          </button>
        </div>
      )}

      {!manage && step === "ask" && (
        <>
          <div className="ccGachaBig">🎰</div>
          <p className="ccGachaAsk">메뉴를 추천해드립니다!</p>
          <div className="ccRow">
            <button className="ccMini" onClick={onClose}>싫어요</button>
            <button className="ccBtn ccMiniBtn" onClick={start}>좋아요</button>
          </div>
        </>
      )}

      {!manage && step === "rolling" && (
        <>
          <div className="ccGachaBig ccGachaSpin">🎰</div>
          <p className="ccGachaRoll">{roll}</p>
        </>
      )}

      {!manage && step === "done" && (
        <>
          <div className="ccGachaBig">🍽</div>
          <p className="ccGachaAsk">오늘의 메뉴는</p>
          <p className="ccGachaPick">{pick}</p>
          <p className="ccSheetNote">
            {left()
              ? `하루에 한 번만 뽑을 수 있어요. ${left()} 뒤에 다시 뽑을 수 있어요.`
              : "이제 다시 뽑을 수 있어요!"}
          </p>
          <div className="ccRow">
            {!left() && <button className="ccBtn ccMiniBtn" onClick={start}>다시 뽑기</button>}
            <button className="ccMini" onClick={onClose}>닫기</button>
          </div>
        </>
      )}

      {manage && (
        <div className="ccAdd">
          <div className="ccRow">
            <input
              className="ccInput"
              value={newName}
              maxLength={20}
              placeholder="메뉴 이름"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>추가</button>
          </div>
          <div className="ccFoods">
            {(foods || []).map((f) => (
              <div key={f.id} className="ccFood">
                {editId === f.id ? (
                  <>
                    <input
                      className="ccInput ccFoodEdit"
                      value={editName}
                      maxLength={20}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(f.id); }}
                    />
                    <button className="ccPlIcon" onClick={() => saveEdit(f.id)}>✔</button>
                    <button className="ccPlIcon" onClick={() => setEditId(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <span className="ccFoodName">{f.name}</span>
                    <button className="ccPlIcon" onClick={() => { setEditId(f.id); setEditName(f.name); }}>✎</button>
                    <button className="ccPlIcon" onClick={() => del(f.id)}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <button className="ccMini" onClick={() => setManage(false)}>← 가챠로</button>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}
    </div>
  );
}


/* ============================ 포춘쿠키 ============================ */

export function FortuneSheet({ hostCode, isHost, onClose, onDraw }) {
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const prev = useRef(lastDraw("fortune"));
  const [opening, setOpening] = useState(false);
  const [manage, setManage] = useState(false);
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fortuneList();
    if (Array.isArray(r)) setItems(r);
    else { setItems([]); setErr(msgOf(r)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (prev.current) setPick(prev.current.food);
  }, []);

  const left = () => {
    if (!prev.current) return "";
    const ms = DAY - (Date.now() - prev.current.at);
    if (ms <= 0) return "";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const draw = () => {
    if (!items?.length) { setErr("아직 등록된 문장이 없어요."); return; }
    if (left()) return;
    setOpening(true);
    blip(880);
    setTimeout(() => {
      const win = items[Math.floor(Math.random() * items.length)].text;
      setPick(win);
      saveDraw("fortune", win);
      prev.current = { at: Date.now(), food: win };
      setOpening(false);
      ding();
      onDraw?.();
    }, 700);
  };

  const add = async () => {
    if (!newText.trim()) return;
    setBusy(true);
    const r = await fortuneAdd(hostCode, newText.trim());
    setBusy(false);
    if (!r?.ok) { setErr(r?.error === "dup" ? "이미 있는 문장이에요." : msgOf(r)); return; }
    setNewText("");
    setErr("");
    load();
  };

  const saveEdit = async (id) => {
    setBusy(true);
    const r = await fortuneEdit(hostCode, id, editText.trim());
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    setEditId(null);
    load();
  };

  const del = async (id) => {
    setBusy(true);
    const r = await fortuneDel(hostCode, id);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    load();
  };

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">🥠 오늘의 포춘쿠키</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {isHost && !manage && (
        <div className="ccRow ccHostRow ccHostTop">
          <button className="ccBtn ccMiniBtn ccAddBtn" onClick={() => setManage(true)}>
            문장 관리 ({items?.length ?? "-"})
          </button>
        </div>
      )}

      {!manage && (
        <>
          <div className={"ccGachaBig" + (opening ? " ccCookieShake" : "")}>🥠</div>
          {!pick && !opening && <p className="ccGachaAsk">쿠키를 열면 오늘의 한마디가 나와요</p>}
          {opening && <p className="ccGachaAsk">쿠키를 여는 중…</p>}
          {pick && !opening && <p className="ccFortuneText">{pick}</p>}
          {left() && (
            <p className="ccSheetNote">하루에 하나씩만 열 수 있어요. {left()} 뒤에 다시 열 수 있어요.</p>
          )}
          <div className="ccRow">
            {!left() && (
              <button className="ccBtn ccMiniBtn" onClick={draw} disabled={opening}>
                {pick ? "다시 뽑기" : "뽑기"}
              </button>
            )}
            <button className="ccMini" onClick={onClose}>닫기</button>
          </div>
        </>
      )}

      {manage && (
        <div className="ccAdd">
          <div className="ccRow">
            <input
              className="ccInput"
              value={newText}
              maxLength={80}
              placeholder="새 문장"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            <button className="ccBtn ccMiniBtn" onClick={add} disabled={busy}>추가</button>
          </div>
          <div className="ccFortunes">
            {(items || []).map((f) => (
              <div key={f.id} className="ccFortuneRow">
                {editId === f.id ? (
                  <>
                    <input
                      className="ccInput ccFortuneEdit"
                      value={editText}
                      maxLength={80}
                      autoFocus
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(f.id); }}
                    />
                    <button className="ccPlIcon" onClick={() => saveEdit(f.id)}>✔</button>
                    <button className="ccPlIcon" onClick={() => setEditId(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <span className="ccFortuneLine">{f.text}</span>
                    <button className="ccPlIcon" onClick={() => { setEditId(f.id); setEditText(f.text); }}>✎</button>
                    <button className="ccPlIcon" onClick={() => del(f.id)}>🗑</button>
                  </>
                )}
              </div>
            ))}
          </div>
          <button className="ccMini" onClick={() => setManage(false)}>← 쿠키로</button>
        </div>
      )}

      {err && <div className="ccErr">{err}</div>}
    </div>
  );
}


/* ============================ 카페 메뉴판 ============================ */

export function MenuSheet({ balance, holding, onBuy, onClose }) {
  const [msg, setMsg] = useState("");

  const buy = (item) => {
    if (balance < item.price) {
      buzz();
      setMsg(`별이 ${item.price - balance}개 더 필요해요.`);
      return;
    }
    onBuy(item);
    ding();
    setMsg(`${item.name} 나왔습니다!`);
  };

  return (
    <div className="ccPanel ccSheet" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">☕ 메뉴판</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      <div className="ccBalance">
        내 별 <b>⭐ {balance}</b>
        {holding && <span className="ccHolding">들고 있음 {holding.emoji} {holding.name}</span>}
      </div>

      <div className="ccMenu">
        {MENU.map((m) => (
          <button
            key={m.id}
            className={"ccMenuItem" + (balance < m.price ? " ccMenuNo" : "")}
            onClick={() => buy(m)}
          >
            <span className="ccMenuEmoji">{m.emoji}</span>
            <span className="ccMenuName">{m.name}</span>
            <span className="ccMenuPrice">⭐ {m.price}</span>
          </button>
        ))}
      </div>

      {msg && <p className="ccSheetNote">{msg}</p>}
      <p className="ccSheetNote">별은 마을을 돌아다니며 주울 수 있어요.</p>
    </div>
  );
}

/* ---------- 👗 꾸미기 ----------
   얼굴은 공짜, 머리와 옷 색은 별로 삽니다. 한 번 사면 계속 갖고 있어요. */

const DRESS_TABS = [
  { id: "face", label: "얼굴" },
  { id: "hat", label: "머리" },
  { id: "outfit", label: "옷 색" },
];

export function DressSheet({ look, owned, balance, skins = [], onApply, onClose }) {
  const [tab, setTab] = useState("face");
  const [err, setErr] = useState("");
  const [pending, setPending] = useState(null);   // 살지 물어보는 중
  const me = lookSprite(look);

  const nextLook = (kind, item) =>
    kind === "f"
      ? { ...look, f: item.i, sk: null }
      : kind === "s"
        ? { ...look, sk: item.id }
        : kind === "h"
          ? { ...look, h: item.id }
          : { ...look, o: item.id };

  const pick = (kind, item) => {
    const key = kind + ":" + item.id;
    const have = item.price === 0 || owned.includes(key);
    if (have) {
      setErr("");
      setPending(null);
      onApply(nextLook(kind, item), 0, key);
      return;
    }
    if (balance < item.price) {
      buzz();
      setPending(null);
      setErr(`별이 ${item.price - balance}개 모자라요.`);
      return;
    }
    /* 실수로 별을 쓰지 않게 한 번 물어봅니다 */
    setErr("");
    setPending({ kind, item, key });
    blip(700);
  };

  const confirm = () => {
    if (!pending) return;
    onApply(nextLook(pending.kind, pending.item), pending.item.price, pending.key);
    setPending(null);
  };

  const cell = (kind, item, on, label, sub) => {
    const key = kind + ":" + item.id;
    const have = item.price === 0 || owned.includes(key);
    return (
      <button
        key={item.id}
        className={
          "ccDressCell" +
          (on ? " ccDressOn" : "") +
          (have ? "" : " ccDressLocked") +
          (pending?.key === key ? " ccDressAsking" : "")
        }
        onClick={() => pick(kind, item)}
      >
        <span className="ccDressLabel">{label}</span>
        {sub}
        {!have && <span className="ccDressPrice">⭐{item.price}</span>}
        {have && item.price > 0 && <span className="ccDressHave">가짐</span>}
      </button>
    );
  };

  return (
    <div className="ccPanel ccModal ccDress" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">👗 꾸미기</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      <div className="ccDressMirror">
        <Pix map={me.map} palette={me.palette} scale={7} cacheKey={me.key} />
      </div>
      <div className="ccDressStars">남은 별 ⭐ {balance}</div>

      <div className="ccDressTabs">
        {DRESS_TABS.map((x) => (
          <button
            key={x.id}
            className={"ccMini" + (tab === x.id ? " ccMiniOn" : "")}
            onClick={() => { setTab(x.id); blip(700); }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="ccDressGrid">
        {tab === "face" && (
          <>
            {FACES.map((f) => cell("f", { ...f, price: 0 }, !look.sk && (look.f || 1) === f.i, f.label, null))}
            {skins.map((s) =>
              cell(
                "s",
                { id: s.id, label: s.name, price: s.price },
                look.sk === s.id,
                s.name,
                <img className="ccDressPic" src={s.image} alt="" draggable={false} />
              )
            )}
          </>
        )}
        {tab === "hat" && HATS.map((h) => cell("h", h, look.h === h.id, h.label, null))}
        {tab === "outfit" &&
          OUTFITS.map((o) =>
            cell(
              "o",
              o,
              look.o === o.id,
              o.label,
              <span className="ccDressChip" style={{ background: o.c || "#ffffff" }} />
            )
          )}
      </div>

      {pending && (
        <div className="ccDressAsk">
          <span>
            <b>{pending.item.label}</b> — ⭐{pending.item.price} 주고 살까요?
          </span>
          <span className="ccDressAskBtns">
            <button className="ccMini ccMiniOn" onClick={confirm}>사기</button>
            <button className="ccMini" onClick={() => setPending(null)}>그만</button>
          </span>
        </div>
      )}
      {err && <div className="ccErr">{err}</div>}
      <p className="ccSheetNote">고른 모습은 이 기기에 저장되고, 같이 있는 사람들에게도 그대로 보여요.</p>
    </div>
  );
}

/* ---------- 🎨 캐릭터 이미지 관리 (호스트) ----------
   올린 사진은 구름옷가게 '얼굴' 칸에 나타나고, 산 사람 캐릭터가 그 사진이 됩니다. */

export function SkinSheet({ hostCode, isHost, skins = [], onChanged, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("3");
  const [img, setImg] = useState(null);
  const [src, setSrc] = useState(null);      // 고른 원본 파일
  const [cut, setCut] = useState(true);      // 배경 지우기
  const [tol, setTol] = useState(42);        // 어디까지 배경으로 볼지
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  /* 원본이나 설정이 바뀌면 다시 손질합니다 */
  useEffect(() => {
    if (!src) return undefined;
    let alive = true;
    prepSkin(src, { max: 240, cut, tol })
      .then((data) => { if (alive) setImg(data); })
      .catch(() => { if (alive) setErr("이미지를 읽지 못했어요."); });
    return () => { alive = false; };
  }, [src, cut, tol]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr("");
    setSrc(f);
    if (!name.trim()) setName(f.name.replace(/\.[^.]+$/, "").slice(0, 16));
  };

  const add = async () => {
    if (!img) { setErr("사진을 먼저 골라주세요."); return; }
    if (!name.trim()) { setErr("이름을 적어주세요."); return; }
    setBusy(true);
    const r = await skinAdd(hostCode, name.trim(), img, Number(price) || 0);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); buzz(); return; }
    setErr("");
    setImg(null);
    setSrc(null);
    setName("");
    ding();
    onChanged?.();
  };

  const del = async (id) => {
    setBusy(true);
    const r = await skinDel(hostCode, id);
    setBusy(false);
    if (!r?.ok) { setErr(msgOf(r)); return; }
    onChanged?.();
  };

  return (
    <div className="ccPanel ccModal ccSkins" onClick={(e) => e.stopPropagation()}>
      <div className="ccSheetHead">
        <h2 className="ccSheetTitle">🎨 캐릭터 이미지</h2>
        <button className="ccX" onClick={onClose}>✕</button>
      </div>

      {isHost && (
        <div className="ccSkinAdd">
          <button className="ccSkinPick" onClick={() => fileRef.current?.click()} title="눌러서 다른 사진">
            {img ? <img src={img} alt="" className="ccSkinPreview" draggable={false} /> : "사진 고르기"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
          <div className="ccSkinFields">
            <input
              className="ccInput ccSkinName"
              value={name}
              maxLength={16}
              placeholder="이름 (예: 우리집 고양이)"
              onChange={(e) => setName(e.target.value)}
            />
            <div className="ccSkinRow">
              <span className="ccSkinPriceLabel">⭐</span>
              <input
                className="ccInput ccSkinPrice"
                value={price}
                inputMode="numeric"
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
              />
              <span className="ccSkinPriceNote">별을 주고 사게 됩니다</span>
            </div>
          </div>
        </div>
      )}

      {isHost && src && (
        <div className="ccCut">
          <label className="ccCutRow">
            <input type="checkbox" checked={cut} onChange={(e) => setCut(e.target.checked)} />
            <span>배경 지우기 (누끼)</span>
          </label>
          {cut && (
            <label className="ccCutRow">
              <span className="ccCutLabel">얼마나</span>
              <input
                className="ccVol ccCutRange"
                type="range"
                min="14"
                max="90"
                step="2"
                value={tol}
                onChange={(e) => setTol(Number(e.target.value))}
              />
              <span className="ccCutNum">{tol}</span>
            </label>
          )}
          <p className="ccCutNote">
            {cut
              ? "가장자리부터 비슷한 색을 지워요. 덜 지워지면 오른쪽으로, 얼굴까지 파이면 왼쪽으로."
              : "배경을 그대로 둡니다."}
          </p>
        </div>
      )}
      {isHost && (
        <button className="ccBtn ccSkinAddBtn" onClick={add} disabled={busy}>
          {busy ? "올리는 중…" : "옷가게에 올리기"}
        </button>
      )}

      {err && <div className="ccErr">{err}</div>}

      <div className="ccSkinList">
        {skins.length === 0 && <p className="ccSheetNote">아직 올린 이미지가 없어요.</p>}
        {skins.map((s) => (
          <div key={s.id} className="ccSkinItem">
            <img src={s.image} alt="" className="ccSkinThumb" draggable={false} />
            <span className="ccSkinItemName">{s.name}</span>
            <span className="ccSkinItemPrice">⭐{s.price}</span>
            {isHost && (
              <button className="ccTrackDel" onClick={() => del(s.id)} disabled={busy}>
                지우기
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="ccSheetNote">
        {isHost
          ? "올린 사진은 구름옷가게 '얼굴' 칸에 바로 나타나요. 사진은 240px 로 줄여서 저장합니다."
          : "구름옷가게에서 별을 주고 살 수 있어요."}
      </p>
    </div>
  );
}
