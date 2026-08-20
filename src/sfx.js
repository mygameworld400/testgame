/* ===========================================================
   효과음 — 오디오 파일 없이 WebAudio 로 그때그때 만들어 냅니다.
   =========================================================== */

let ctx = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/* 낙엽 밟는 "콰삭" — 짧은 잡음 폭발 + 밴드패스 */
export function crunch() {
  const ac = audio();
  if (!ac) return;
  const dur = 0.28;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    /* 앞쪽이 거칠고 뒤로 갈수록 잦아드는 잡음 */
    const env = Math.pow(1 - t, 2.2) * (t < 0.06 ? t / 0.06 : 1);
    const grain = Math.random() < 0.35 ? 1 : 0.35; // 알갱이 느낌
    data[i] = (Math.random() * 2 - 1) * env * grain;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600;
  bp.Q.value = 0.9;

  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;

  const gain = ac.createGain();
  gain.gain.value = 0.5;

  src.connect(bp).connect(hp).connect(gain).connect(ac.destination);
  src.start();
}

/* 가벼운 딸깍 — 버튼/메뉴용 */
export function blip(freq = 660) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.12);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.14);
}

/* 물장구 "첨벙"
   진짜 물소리는 (1) 물이 갈라지는 넓은 잡음 (2) 그 뒤로 남는 물방울 소리
   두 겹으로 들립니다. 잡음만 쓰면 라디오 잡음처럼 들려서, 물방울(짧게
   음이 올라가는 사인파)을 여러 개 겹쳐 뿌려줍니다. */
export function splash(url) {
  /* 직접 올린 물소리가 있으면 그걸 씁니다 */
  if (url) {
    try {
      const a = new Audio(url);
      a.volume = 0.75;
      a.play().catch(() => synthSplash());
      return;
    } catch {
      /* 실패하면 아래 합성음으로 */
    }
  }
  synthSplash();
}

function synthSplash() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;

  /* (1) 물이 갈라지는 소리 — 짧고 넓은 잡음, 위에서 아래로 훑기 */
  const dur = 0.42;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(320, t0);
  bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.06);
  bp.frequency.exponentialRampToValueAtTime(600, t0 + dur);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.42, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0);

  /* (2) 물방울 — 음이 빠르게 올라가는 짧은 사인파를 흩뿌립니다 */
  const drops = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < drops; i++) {
    const at = t0 + 0.03 + Math.random() * 0.34;
    const f0 = 380 + Math.random() * 520;
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(f0 * (2.2 + Math.random()), at + 0.07);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(0.10 + Math.random() * 0.07, at + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    osc.connect(og).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.12);
  }

  /* (3) 몸이 물에 잠기는 낮은 울림 */
  const low = ac.createOscillator();
  const lg = ac.createGain();
  low.type = "sine";
  low.frequency.setValueAtTime(150, t0);
  low.frequency.exponentialRampToValueAtTime(70, t0 + 0.3);
  lg.gain.setValueAtTime(0.0001, t0);
  lg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
  lg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
  low.connect(lg).connect(ac.destination);
  low.start(t0);
  low.stop(t0 + 0.36);
}
