// 开箱即用：若 PDF 导出所需的 Chromium 未安装，则自动下载（一次性）。
// 由 npm run prestart 调用；下载失败仅告警，不阻断主服务启动（HTML/邮件导出仍可用）。
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

let available = false;
try {
  const mod = await import('playwright');
  const chromium = mod.chromium ?? mod.default?.chromium;
  const p = chromium?.executablePath?.();
  if (p && existsSync(p)) available = true;
} catch {
  /* playwright 未就绪，下方会触发下载 */
}

if (available) {
  console.log('[ensure-chromium] PDF 导出所需的 Chromium 已就绪');
  process.exit(0);
}

console.log('[ensure-chromium] 首次启动，正在下载 PDF 导出所需的 Chromium（一次性，约 100MB）…');
try {
  execSync('npx playwright install chromium', { stdio: 'inherit', env: process.env });
  console.log('[ensure-chromium] Chromium 下载完成');
} catch (e) {
  console.warn(
    '[ensure-chromium] 警告：Chromium 下载失败，PDF 导出将不可用；HTML / 邮件导出不受影响。\n' +
    '              可稍后手动运行： npx playwright install chromium'
  );
}
