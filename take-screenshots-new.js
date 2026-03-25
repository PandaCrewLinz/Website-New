const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const BASE = process.env.SCREENSHOT_BASE || "https://beta.dccx.it";

const URLS = [
  // Main pages
  `${BASE}`,
  `${BASE}/our-services`,
  `${BASE}/app-entwicklung`,
  `${BASE}/bgf`,
  `${BASE}/social-media-marketing`,
  `${BASE}/websites`,
  `${BASE}/ki-beratung`,
  `${BASE}/ki-agent`,
  `${BASE}/ki-assistenz-wissenssysteme`,
  `${BASE}/ki-workshops`,
  `${BASE}/ki-telefonassistenz`,
  `${BASE}/onlineshops`,
  `${BASE}/foto-und-video`,
  `${BASE}/print-grafikdesign`,
  `${BASE}/webanalytik`,
  `${BASE}/microsoft-solutions`,
  `${BASE}/foerderungen`,
  `${BASE}/team`,
  `${BASE}/unsere-marken`,
  `${BASE}/offene-stellen`,
  `${BASE}/merch-2`,
  `${BASE}/blog`,
  `${BASE}/kontakt`,
  `${BASE}/impressum`,
  `${BASE}/datenschutz`,
  // Category pages (matching reference screenshots)
  `${BASE}/clients-category/app-home`,
  `${BASE}/clients-category/clients-page`,
  `${BASE}/clients-category/main-home`,
  `${BASE}/clients-category/split-home`,
  `${BASE}/team-category/main-home`,
  `${BASE}/testimonials-category/black-home`,
  // Sitemaps
  `${BASE}/sitemap.xml`,
];

const OUTPUT_DIR = path.join(__dirname, "source", "screenshots-new");

function urlToFilename(url) {
  const u = new URL(url);
  let name =
    u.pathname === "/" || u.pathname === ""
      ? "home"
      : u.pathname.replace(/^\/|\/$/g, "").replace(/\//g, "--");
  return name;
}

async function autoScrollToBottom(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 1500));
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let cookieDismissed = false;

  for (const url of URLS) {
    const baseName = urlToFilename(url);
    console.log(`\nCapturing: ${url}`);

    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));

      // Dismiss cookie banner on first page
      if (!cookieDismissed) {
        try {
          const acceptBtn = await page.$('[data-action="accept-all"]');
          if (acceptBtn) {
            await acceptBtn.click();
            console.log("  Cookie banner accepted.");
            await new Promise((r) => setTimeout(r, 1000));
            cookieDismissed = true;
          }
        } catch {}
      }

      // Scroll to trigger lazy-loaded content
      await autoScrollToBottom(page);

      // Pause CSS animations for stable screenshot (skip for XML pages)
      await page.evaluate(() => {
        document.querySelectorAll("*").forEach((el) => {
          if (el.style) {
            el.style.animationPlayState = "paused";
          }
        });
      });

      // Full page screenshot
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `${baseName}.png`),
        fullPage: true,
      });
      console.log(`  OK: ${baseName}.png`);
    } catch (err) {
      console.error(`  FAILED: ${url} - ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots saved to ${OUTPUT_DIR}`);
}

main();
