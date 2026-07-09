import { chromium } from 'playwright-core';

console.log('Conectando ao Chrome local...');

const browser = await chromium.connectOverCDP('http://localhost:9222');

const context =
  browser.contexts()[0] ?? await browser.newContext();

const page = await context.newPage();

await page.setContent(`
<!DOCTYPE html>
<html>
<head>
  <title>Chrome Local</title>
</head>
<body>
  <h1>Chrome Local</h1>
</body>
</html>
`);

const session = await context.newCDPSession(page);

const { targetInfo } =
  await session.send('Target.getTargetInfo');

console.log('');
console.log('TARGET');
console.log(targetInfo.targetId);

console.log('');
console.log('DEVTOOLS');
console.log(
  `https://chrome-devtools-frontend.appspot.com/serve_rev/@5b586c06e0d27582900f17e2d59c5370d8d6e0bb/inspector.html?ws=localhost:9222/devtools/page/${targetInfo.targetId}`
);

console.log('');
console.log('Aguardando 10 minutos...');

await new Promise(r => setTimeout(r, 600000));
