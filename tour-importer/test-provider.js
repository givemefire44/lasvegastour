import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.goto('https://www.getyourguide.com/rome-l33/colosseum-roman-forum-palatine-hill-skip-the-line-tour-t212497/', {waitUntil: 'domcontentloaded'});
  await new Promise(r => setTimeout(r, 5000));
  
  const result = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.toLowerCase().includes('provid'));
    return lines.slice(0, 10);
  });
  
  console.log('Lines with provider:', result);
  await browser.close();
})();
