import { chromium } from 'playwright';

let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) browserPromise = chromium.launch();
  return browserPromise;
}

export async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' }
  });
  await page.close();
  return buf;
}
