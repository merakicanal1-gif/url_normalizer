# Guia de Depuração Remota via Chrome DevTools Protocol (CDP)

Este documento orienta os desenvolvedores e operadores sobre como inspecionar sessões interativas ativas de navegadores utilizando as primitivas de metadados retornadas pela API (`websocket` e `targetId`).

---

## 1. As Primitivas de Depuração

Ao criar ou inspecionar uma sessão interativa, a API retorna o seguinte objeto de depuração no payload JSON:

```json
{
  "debug": {
    "available": true,
    "provider": "browserless",
    "generatedAt": "2026-07-08T07:52:12.035Z",
    "websocket": "ws://localhost:3001/devtools/page/84F21A89E15FABFB70615824777D7F97",
    "targetId": "84F21A89E15FABFB70615824777D7F97"
  }
}
```

* **`websocket`:** O canal de comunicação de soquete bruto para o Chrome DevTools Protocol (CDP).
* **`targetId`:** O identificador lógico único do alvo (aba) no motor Chromium do servidor.

---

## 2. Depuração Visual no Chrome / Edge / Brave (Recomendado)

Para abrir a interface do Chrome DevTools para depuração interativa manual, siga os passos abaixo para contornar problemas de CORS/Mixed Content associados a frontends hospedados remotamente:

### Passo 1: Configurar a porta do Browserless no seu Navegador
1. Abra uma nova aba no seu navegador desktop (Chrome, Edge, Brave ou outro baseado em Chromium).
2. Navegue para:
   * **Chrome:** `chrome://inspect`
   * **Edge:** `edge://inspect`
3. Na aba **Devices**, clique no botão **Configure...** ao lado de *"Discover network targets"*.
4. Adicione o host e a porta pública onde o Browserless está escutando (ex: `localhost:3001` ou o IP público do servidor).
5. Clique em **Done**.

### Passo 2: Inspecionar o Alvo Remoto
1. Sob a seção **Remote Target**, você verá uma lista de páginas ativas.
2. Localize a página correspondente ao `targetId` da sua sessão.
3. Clique no link **inspect** (ou **inspect fallback** se o seu navegador for ligeiramente mais antigo/mais novo que o do container).
4. Uma janela dedicada do Chrome DevTools se abrirá, permitindo que você inspecione elementos, logs de console, cookies e tráfego de rede da sessão remota de forma totalmente estável.

---

## 3. Depuração Programática

Caso você queira anexar scripts de automação de teste ou monitoramento (utilizando Playwright ou Puppeteer) à sessão interativa existente:

### Usando Playwright (Node.js)
Você pode usar `connectOverCDP` para conectar um script diretamente ao WebSocket retornado pela API:

```javascript
const { chromium } = require('playwright');

(async () => {
  const wsUrl = 'ws://localhost:3001/devtools/page/84F21A89E15FABFB70615824777D7F97';
  
  // Conecta ao target específico via CDP
  const browser = await chromium.connectOverCDP(wsUrl);
  
  // Obtém o contexto e a página ativa
  const contexts = browser.contexts();
  const page = contexts[0].pages()[0];
  
  console.log('URL Atual:', page.url());
  console.log('Título:', await page.title());
  
  // Interaja programaticamente
  // ...
  
  await browser.close();
})();
```

### Usando Puppeteer (Node.js)
Com o Puppeteer, você pode conectar-se usando o método `connect` com o endpoint do WebSocket:

```javascript
const puppeteer = require('puppeteer-core');

(async () => {
  const wsUrl = 'ws://localhost:3001/devtools/page/84F21A89E15FABFB70615824777D7F97';
  
  const browser = await puppeteer.connect({
    browserWSEndpoint: wsUrl
  });
  
  const pages = await browser.pages();
  const page = pages[0];
  
  console.log('URL:', page.url());
  
  await browser.disconnect();
})();
```
