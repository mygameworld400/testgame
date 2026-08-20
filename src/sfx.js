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

/* 모래 밟는 "사각사각" — 낙엽처럼 파삭 터지는 소리가 아니라
   잔알갱이가 쓸리는 소리라, 고음쪽 잡음을 부드럽게 밀었다 뺍니다. */
export function crunch() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const dur = 0.34;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    /* 가운데가 가장 크고 앞뒤로 잦아드는 모양 — 발이 쓸리는 느낌 */
    const env = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.6;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;

  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2200;          // 낮은 '퍽' 소리를 걷어냅니다

  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.5;
  bp.frequency.setValueAtTime(4200, t0);
  bp.frequency.linearRampToValueAtTime(6800, t0 + dur * 0.6);
  bp.frequency.linearRampToValueAtTime(3600, t0 + dur);

  const g = ac.createGain();
  g.gain.value = 0.3;

  src.connect(hp).connect(bp).connect(g).connect(ac.destination);
  src.start(t0);
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

  /* 물방울 소리만 — 음이 빠르게 올라가는 짧은 사인파를 여러 개 흩뿌립니다.
     (넓은 잡음과 저음 울림은 북소리처럼 들려서 뺐어요)                */
  const drops = 7 + Math.floor(Math.random() * 5);
  for (let i = 0; i < drops; i++) {
    const at = t0 + Math.random() * 0.4;
    const f0 = 420 + Math.random() * 620;
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(f0 * (2.4 + Math.random() * 1.2), at + 0.06 + Math.random() * 0.04);

    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(0.09 + Math.random() * 0.06, at + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.11 + Math.random() * 0.06);

    osc.connect(og).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.2);
  }
}


/* 왁뿌볼 밟는 "빠각" — 딱 터지는 순간 + 잘게 부서지는 잔소리 */
export function crack() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;

  /* (1) 껍질이 터지는 순간 — 아주 짧고 센 잡음 */
  const dur = 0.12;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / d.length;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 5);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(1800, t0);
  bp.frequency.exponentialRampToValueAtTime(900, t0 + dur);
  const g = ac.createGain();
  g.gain.value = 0.55;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0);

  /* (2) 조각들이 흩어지며 나는 잔소리 — 짧은 딱딱 소리 여러 개 */
  const bits = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < bits; i++) {
    const at = t0 + 0.03 + Math.random() * 0.22;
    const len = 0.03;
    const b2 = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
    const d2 = b2.getChannelData(0);
    for (let k = 0; k < d2.length; k++) {
      d2[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d2.length, 3);
    }
    const s2 = ac.createBufferSource();
    s2.buffer = b2;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2400 + Math.random() * 2600;
    const g2 = ac.createGain();
    g2.gain.value = 0.14 + Math.random() * 0.12;
    s2.connect(hp).connect(g2).connect(ac.destination);
    s2.start(at);
  }
}
