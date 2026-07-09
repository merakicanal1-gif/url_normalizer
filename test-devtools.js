import { chromium } from 'playwright-core';

console.log('========================================');
console.log('TESTE PLAYWRIGHT + BROWSERLESS');
console.log('========================================');

console.log('Conectando ao Browserless...');

const browser = await chromium.connectOverCDP('ws://localhost:3001');

console.log('Conectado.');

const contexts = browser.contexts();

const context = contexts.length > 0
  ? contexts[0]
  : await browser.newContext();

console.log('Criando página...');

const page = await context.newPage();

console.log('Criando conteúdo HTML local...');

await page.setContent(`
<!DOCTYPE html>
<html>
<head>
    <title>Teste Browserless</title>
</head>
<body>
    <h1>Teste Browserless</h1>
    <button id="ok">OK</button>
</body>
</html>
`);

console.log('Conteúdo criado.');

const session = await context.newCDPSession(page);

const { targetInfo } = await session.send('Target.getTargetInfo');

console.log('');
console.log('========================================');
console.log('TARGET ID');
console.log('========================================');
console.log(targetInfo.targetId);

console.log('');
console.log('========================================');
console.log('DEVTOOLS');
console.log('========================================');

console.log(
  `http://localhost:3001/devtools/inspector.html?ws=localhost:3001/devtools/page/${targetInfo.targetId}`
);

console.log('');
console.log('Aguardando 10 minutos...');
console.log('');

await new Promise(resolve => setTimeout(resolve, 600000));
