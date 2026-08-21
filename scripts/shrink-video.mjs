/* 영상 용량 줄이기 — 메롱 영화관에 올릴 수 있는 크기로 눌러줍니다.

   쓰는 법:
     npm run video "C:\경로\영상.mp4"
     npm run video "C:\경로\영상.mp4" 30      (30MB 로 맞추기)

   ffmpeg 가 있어야 합니다:
     winget install Gyan.FFmpeg
   설치 뒤 터미널을 새로 열어야 PATH 가 잡혀요.                        */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const MB = 1024 * 1024;

const [, , src, sizeArg] = process.argv;
if (!src) {
  console.log('영상 파일 경로를 주세요.  예)  npm run video "C:/Users/user/Videos/a.mp4"');
  process.exit(1);
}
if (!existsSync(src)) {
  console.log("그런 파일이 없어요:", src);
  process.exit(1);
}

const has = (cmd) => spawnSync(cmd, ["-version"], { encoding: "utf8" }).status === 0;
if (!has("ffmpeg") || !has("ffprobe")) {
  console.log("ffmpeg 가 없습니다. 아래를 실행하고 터미널을 새로 열어주세요:\n");
  console.log("  winget install Gyan.FFmpeg\n");
  process.exit(1);
}

/* 목표 크기 — 게임 업로드 한도(60MB)보다 조금 작게 잡습니다 */
const targetMB = Math.max(3, Math.min(60, Number(sizeArg) || 55));

const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
  { encoding: "utf8" }
);
const secs = Math.round(Number(probe.stdout.trim()) || 0);
if (!secs) {
  console.log("영상 길이를 읽지 못했어요. mp4 인지 확인해주세요.");
  process.exit(1);
}

/* 소리 96kbps 를 빼고 남는 걸 화면에 줍니다. 살짝 여유를 둬요 */
const AUDIO_K = 96;
const totalK = Math.floor((targetMB * 8 * 1024) / secs);
const videoK = Math.max(200, Math.floor((totalK - AUDIO_K) * 0.94));

const before = statSync(src).size;
const out = path.join(
  path.dirname(src),
  path.basename(src, path.extname(src)) + "-작게.mp4"
);

const mm = String(Math.floor(secs / 60)).padStart(2, "0");
const ss = String(secs % 60).padStart(2, "0");
console.log(`\n원본     ${(before / MB).toFixed(1)}MB · ${mm}:${ss}`);
console.log(`목표     ${targetMB}MB  (화면 ${videoK}k + 소리 ${AUDIO_K}k)`);
console.log(`내보낼 곳 ${out}\n`);

/* 2패스로 눌러야 목표 크기에 가깝게 나옵니다. 가로 1280 을 넘으면 줄여요 */
const common = [
  "-y",
  "-i", src,
  "-vf", "scale='min(1280,iw)':-2",
  "-c:v", "libx264",
  "-preset", "slow",
  "-b:v", `${videoK}k`,
  "-maxrate", `${Math.floor(videoK * 1.5)}k`,
  "-bufsize", `${videoK * 2}k`,
  "-pix_fmt", "yuv420p",
];

console.log("1/2 훑는 중…");
const pass1 = spawnSync(
  "ffmpeg",
  [...common, "-pass", "1", "-an", "-f", "mp4", process.platform === "win32" ? "NUL" : "/dev/null"],
  { stdio: ["ignore", "ignore", "inherit"] }
);
if (pass1.status !== 0) {
  console.log("\n1차에서 멈췄어요.");
  process.exit(1);
}

console.log("2/2 누르는 중…");
const pass2 = spawnSync(
  "ffmpeg",
  [...common, "-pass", "2", "-c:a", "aac", "-b:a", `${AUDIO_K}k`, "-movflags", "+faststart", out],
  { stdio: ["ignore", "ignore", "inherit"] }
);
if (pass2.status !== 0) {
  console.log("\n2차에서 멈췄어요.");
  process.exit(1);
}

const after = statSync(out).size;
console.log(`\n다 됐어요.`);
console.log(`  ${(before / MB).toFixed(1)}MB  →  ${(after / MB).toFixed(1)}MB`);
console.log(`  ${out}`);
if (after > 60 * MB) {
  console.log(`\n아직 60MB 를 넘어요. 더 줄이려면:  npm run video "${src}" 40`);
}
