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

/* 물장구 "첨벙" — 잡음 + 아래로 훑는 필터 */
export function splash() {
  const ac = audio();
  if (!ac) return;
  const dur = 0.5;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.6);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(5200, ac.currentTime);
  lp.frequency.exponentialRampToValueAtTime(500, ac.currentTime + dur);

  const g = ac.createGain();
  g.gain.setValueAtTime(0.35, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);

  src.connect(lp).connect(g).connect(ac.destination);
  src.start();
}
