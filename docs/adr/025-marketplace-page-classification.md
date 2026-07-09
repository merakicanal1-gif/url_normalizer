# ADR-025 — Marketplace Page Classification

## Status
Aprovada

## Data
2026-07-06

## Contexto
Durante as auditorias de homologação real (Sprint 0.4 e subsequentes), observou-se que a navegação automatizada (via Browserless/Chromium Headless) pode receber respostas do marketplace que não representam o fluxo feliz (a página do produto final). 

Os cenários mapeados incluem:
1. Páginas de erro interno do marketplace (como *"Hubo un error accediendo a esta pagina..."* no Mercado Livre), que respondem com status HTTP 200/5xx mas representam falhas do próprio marketplace.
2. Telas de CAPTCHA ou desafios de segurança ativa (AWS WAF).
3. Redirecionamentos para páginas de login obrigatórias (como no caso da Shopee e da Amazon).
4. Telas de consentimento de cookies/GDPR.
5. Landing pages de afiliados intermediárias (que exibem botões do tipo *"Ir para o produto"*).

No modelo anterior, falhar ao encontrar o ID de produto (`MLB`, `ASIN`) sob estas páginas genéricas de erro resultava erroneamente no código de erro `UNSUPPORTED_PRODUCT_URL` ou causava exceções não tratadas de DOM. Isso ocultava a causa raiz e impedia que automações externas (ex: n8n) distinguissem entre uma URL inválida de produto e uma indisponibilidade operacional temporária do marketplace.

## Decisão
Decidimos implementar um mecanismo estruturado de classificação de páginas de marketplace (**Marketplace Page Classification**) antes de iniciar a normalização de qualquer produto. 

A classificação ocorre no início da execução de cada `MarketplacePlugin`, avaliando a URL e assinaturas de conteúdo específicas no DOM da página carregada.

### Classificação de Páginas
Definimos os seguintes tipos de páginas estruturadas:
* `PRODUCT_PAGE`: Página real do produto pronta para extração de dados.
* `AFFILIATE_LANDING`: Landing page intermediária de afiliados.
* `LOGIN_PAGE`: Tela de login obrigatório do marketplace.
* `CONSENT_PAGE`: Tela de consentimento ou cookies.
* `ERROR_PAGE`: Página de erro interna/operacional do próprio marketplace.
* `CAPTCHA_PAGE`: Desafio de CAPTCHA ativo.
* `WAF_PAGE`: Bloqueio de WAF/Anti-bot ativo (ex: AWS WAF).
* `UNKNOWN`: Layout não reconhecido.

### Mecanismos e Assinaturas
Cada plugin possui assinaturas de texto/seletor específicas:
1. **Mercado Livre**:
   - `ERROR_PAGE`: Assinaturas *"Hubo un error accediendo a esta pagina"*, *"Ir a la página principal"*.
   - `AFFILIATE_LANDING`: Path contendo `/social/` ou presença do botão *"Ir para produto"*.
2. **Amazon**:
   - `CAPTCHA_PAGE`: Assinaturas *"Robot Check"*, *"/errors/validatecaptcha"*.
   - `WAF_PAGE`: Assinaturas *"AWS WAF"*, *"awswaf"*, *"token.awswaf.com"*.
   - `LOGIN_PAGE`: URLs contendo `/signin` ou `/login`.
3. **Shopee**:
   - `LOGIN_PAGE`: URLs contendo `/login` ou elemento `shopee-login-page`.
   - `ERROR_PAGE`: Título `403 Forbidden` ou texto contendo bloqueio.

### Fluxo de Recuperação e Erros
* Sob classificação `AFFILIATE_LANDING`, o plugin tenta a **recuperação automática de navegação** (clicar no botão *"Ir para produto"*, aguardar navegação CDP e re-classificar a página final).
* Sob classificação `ERROR_PAGE`, o plugin interrompe imediatamente a extração de dados (sem buscar IDs de produto) e lança uma exceção de domínio **`MarketplaceUnavailableError`**.
* O roteador HTTP captura essa exceção e responde com status **`HTTP 503 Service Unavailable`** e o código de erro **`MARKETPLACE_ERROR_PAGE`**.

## Consequências

### Positivas
* **Semântica de Erro Precisa**: Distinção perfeita entre URLs de produtos de fato inválidas (`UNSUPPORTED_PRODUCT_URL` -> `HTTP 422`) e indisponibilidades operacionais do marketplace (`MARKETPLACE_ERROR_PAGE` -> `HTTP 503`).
* **Tratamento de Automações (n8n)**: Automações podem usar retries automáticos sob status 503 e notificar administradores sob status 403 (WAF/CAPTCHA) ou 422 (URL incorreta).
* **Observabilidade**: Logs Pino detalhados registram a classificação da página, a assinatura detectada, screenshots e trechos do HTML.

### Negativas
* **Atraso de Latência**: A classificação executa leituras extras de DOM (como `page.title()` e `page.content()`) no início da normalização, mas o custo é baixo frente à robustez fornecida pelo diagnóstico estruturado.
