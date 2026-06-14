// מייצר תמונת שיתוף (Open Graph) 1200x630 לתצוגה מקדימה בוואטסאפ/פייסבוק/טוויטר.
// הרצה: node scripts/make-og.mjs  → public/og.png
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, '..', 'public', 'og.png')

const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@500;700;800&family=Frank+Ruhl+Libre:wght@500;700&display=swap');
  * { margin:0; box-sizing:border-box; }
  body { width:1200px; height:630px; font-family:'Assistant',sans-serif;
    background:#070b14; color:#fff; overflow:hidden; position:relative; }
  .glow1 { position:absolute; top:-180px; right:-120px; width:560px; height:560px;
    border-radius:50%; background:rgba(49,130,206,.30); filter:blur(150px); }
  .glow2 { position:absolute; bottom:-160px; left:120px; width:440px; height:440px;
    border-radius:50%; background:rgba(52,211,153,.16); filter:blur(150px); }
  .wrap { position:relative; height:100%; padding:80px; display:flex;
    flex-direction:column; justify-content:center; }
  .brand { display:flex; align-items:center; gap:16px; margin-bottom:40px; }
  .logo { width:64px; height:64px; border-radius:16px; background:rgba(99,179,237,.15);
    display:flex; align-items:center; justify-content:center; }
  .brand span { font-size:42px; font-weight:800; letter-spacing:-1px; }
  .kicker { color:#63b3ed; font-weight:700; font-size:24px; letter-spacing:3px; margin-bottom:18px; }
  h1 { font-size:84px; font-weight:800; line-height:1.02; letter-spacing:-2px; }
  h1 .serif { font-family:'Frank Ruhl Libre',serif; font-weight:500;
    background:linear-gradient(90deg,#63b3ed,#7dd3fc); -webkit-background-clip:text;
    -webkit-text-fill-color:transparent; }
  p { margin-top:32px; font-size:30px; color:#94a3b8; max-width:880px; line-height:1.4; }
  .url { position:absolute; bottom:64px; right:80px; font-size:26px;
    font-weight:700; color:#63b3ed; }
</style></head><body>
  <div class="glow1"></div><div class="glow2"></div>
  <div class="wrap">
    <div class="brand">
      <div class="logo">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17l5-5 4 4 8-8"/><path d="M16 8h4v4"/>
        </svg>
      </div>
      <span>NewFin</span>
    </div>
    <div class="kicker">— מודיעין שוק ההון הישראלי</div>
    <h1>אלפי מקורות.<br><span class="serif">תובנה אחת.</span></h1>
    <p>מאיה, העיתונות הכלכלית והשווקים — במקום אחד. כל ידיעה מדורגת לפי מהותיות ומזוקקת לשורה תחתונה.</p>
    <div class="url">newfinil.pages.dev</div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(600) // לתת לפונטים להיטען
await page.screenshot({ path: out })
await browser.close()
console.log('wrote', out)
