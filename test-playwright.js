import { chromium } from 'playwright-core';

console.log('========================================');
console.log('TESTE PLAYWRIGHT NATIVO');
console.log('========================================');

console.log('Conectando ao Browserless...');

const browser = await chromium.connect(
  'ws://localhost:3001/chromium/playwright'
);

console.log('Conectado.');

const context = await browser.newContext();

const page = await context.newPage();

console.log('Criando conteúdo HTML...');

await page.setContent(`
<!DOCTYPE html>
<html>
<head>
    <title>Teste Playwright</title>
</head>
<body>
    <h1>Playwright OK</h1>
    <button>Clique aqui</button>
</body>
</html>
`);

console.log('Conteúdo criado.');

console.log('Título:', await page.title());

console.log('');
console.log('========================================');
console.log('AGUARDANDO 10 MINUTOS...');
console.log('========================================');

await new Promise(resolve => setTimeout(resolve, 600000));
