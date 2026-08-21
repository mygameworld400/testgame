/* ===========================================================
   효과음 — 오디오 파일 없이 WebAudio 로 그때그때 만들어 냅니다.
   =========================================================== */

let ctx = null;
let unlocked = false;

/* 사파리(맥·아이폰)는 사용자가 화면을 건드리기 전에는 소리를 못 냅니다.
   첫 클릭·터치·키 입력 때 오디오를 깨워두면 그 뒤로는 정상 재생돼요. */
export function unlockAudio() {
  if (unlocked) return;
  const ac = audio();
  if (!ac) return;
  unlocked = true;
  try {
    const b = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = b;
    src.connect(ac.destination);
    src.start(0);
  } catch {
    /* 무시 */
  }
}

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
export function crunch(url) {
  if (playFile(url, 0.7)) return;
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
/* 직접 올린 소리가 있으면 그걸 먼저 씁니다 */
function playFile(url, vol = 0.8) {
  if (!url) return false;
  try {
    const a = new Audio(url);
    a.volume = vol;
    a.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function splash(url) {
  if (playFile(url, 0.75)) return;
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
export function crack(url) {
  if (playFile(url, 0.8)) return;
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

/* 오답 "삐빅" — 낮은 사각파 두 번 */
export function buzz() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  [0, 0.16].forEach((off, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "square";
    osc.frequency.value = i === 0 ? 300 : 220;
    const at = t0 + off;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.14, at + 0.01);
    g.gain.setValueAtTime(0.14, at + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    osc.connect(g).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.15);
  });
}

/* 정답 "딩동" — 밝은 두 음 */
export function ding() {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  [[880, 0], [1320, 0.12]].forEach(([f, off]) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    const at = t0 + off;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
    osc.connect(g).connect(ac.destination);
    osc.start(at);
    osc.stop(at + 0.3);
  });
}

/* 미끄럼틀 "슝~" — 바람 잡음이 한 번 훑고 지나가고, 그 위로 음이 미끄러집니다.
   내려갈 때는 음이 낮아지고, 올라갈 때는 반대로 올라가요. */
export function swoosh(down = true) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const dur = 0.95;

  const n = ac.createBufferSource();
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  n.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.3;
  bp.frequency.setValueAtTime(down ? 1900 : 480, t0);
  bp.frequency.exponentialRampToValueAtTime(down ? 430 : 2100, t0 + dur);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.16, t0 + 0.13);
  ng.gain.setValueAtTime(0.16, t0 + dur - 0.28);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  n.connect(bp).connect(ng).connect(ac.destination);
  n.start(t0);
  n.stop(t0 + dur);

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(down ? 880 : 300, t0);
  osc.frequency.exponentialRampToValueAtTime(down ? 290 : 1080, t0 + dur * 0.92);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

/* 키보드 "톡" — 얇은 클릭 + 아주 짧은 저음 */
export function keyclick(url) {
  if (playFile(url, 0.8)) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;

  const dur = 0.05;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600 + Math.random() * 900;
  bp.Q.value = 1.4;
  const g = ac.createGain();
  g.gain.value = 0.32;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t0);

  const osc = ac.createOscillator();
  const og = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(190, t0);
  osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.05);
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.1, t0 + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
  osc.connect(og).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.09);
}
