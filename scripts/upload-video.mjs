/* 영상을 깃허브 릴리스에 올리고 바로 쓸 수 있는 링크를 뽑아줍니다.

   쓰는 법:
     npm run video-up "C:/Users/user/Videos/영상.mp4"

   왜 릴리스인가:
     · 저장소에 커밋하는 게 아니라서 git 히스토리가 안 부풉니다
     · 파일 하나당 2GB 까지, CDN 으로 나갑니다
     · 광고 없음, 가입 없음 (gh 로그인만 돼 있으면 됨)

   주의: 저장소가 공개라서 링크를 아는 사람은 누구나 볼 수 있어요.
        사적인 영상은 게임 안에서 파일 업로드(Supabase)를 쓰세요.        */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const MB = 1024 * 1024;
const TAG = "videos";                 // 영상만 모아두는 릴리스 하나

const src = process.argv[2];
if (!src) {
  console.log('영상 파일 경로를 주세요.  예)  npm run video-up "C:/Users/user/Videos/a.mp4"');
  process.exit(1);
}
if (!existsSync(src)) {
  console.log("그런 파일이 없어요:", src);
  process.exit(1);
}

const run = (args, opts = {}) =>
  spawnSync("gh", args, { encoding: "utf8", ...opts });

if (run(["--version"]).status !== 0) {
  console.log("gh (GitHub CLI) 가 없어요.  winget install GitHub.cli");
  process.exit(1);
}
if (run(["auth", "status"]).status !== 0) {
  console.log("깃허브 로그인이 필요해요.  gh auth login");
  process.exit(1);
}

/* 저장소 이름 알아내기 */
const repoOut = run(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
const repo = (repoOut.stdout || "").trim();
if (!repo) {
  console.log("저장소를 못 찾았어요. 프로젝트 폴더에서 실행해주세요.");
  process.exit(1);
}

/* 릴리스가 없으면 하나 만듭니다 */
if (run(["release", "view", TAG]).status !== 0) {
  console.log(`'${TAG}' 릴리스를 새로 만듭니다…`);
  const mk = run([
    "release", "create", TAG,
    "--title", "영상 보관함",
    "--notes", "메롱 영화관에서 트는 영상들입니다.",
  ]);
  if (mk.status !== 0) {
    console.log(mk.stderr || "릴리스를 만들지 못했어요.");
    process.exit(1);
  }
}

const name = path.basename(src);
const size = statSync(src).size;
console.log(`\n${name}  ${(size / MB).toFixed(1)}MB  올리는 중…`);

const up = run(["release", "upload", TAG, src, "--clobber"], { stdio: ["ignore", "inherit", "inherit"] });
if (up.status !== 0) {
  console.log("\n올리지 못했어요.");
  process.exit(1);
}

const url = `https://github.com/${repo}/releases/download/${TAG}/${encodeURIComponent(name)}`;
console.log(`\n다 됐어요. 이 주소를 영화관 상영표의 '링크로 추가' 에 붙여넣으세요:\n`);
console.log(`  ${url}\n`);
console.log("(저장소가 공개라 링크를 아는 사람은 볼 수 있어요)");
