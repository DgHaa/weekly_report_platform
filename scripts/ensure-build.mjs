// 开箱即用：若前端未构建（client/dist 不存在），则自动构建。
// 由 npm run prestart 调用，保证 clone 后 `npm start` 即可看到完整界面。
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const distIndex = new URL('../client/dist/index.html', import.meta.url);

if (existsSync(distIndex)) {
  console.log('[ensure-build] client/dist 已存在，跳过前端构建');
  process.exit(0);
}

console.log('[ensure-build] 首次启动，正在构建前端（约 10-30 秒）…');
try {
  execSync('npm --prefix client run build', { stdio: 'inherit', env: process.env });
  console.log('[ensure-build] 前端构建完成');
} catch (e) {
  console.error('[ensure-build] 前端构建失败：请先运行 npm install 安装前端依赖后重试。');
  process.exit(1);
}
