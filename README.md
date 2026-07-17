# URL Normalizer

API REST desenvolvida em Node.js e TypeScript para resolução de links, extração de parâmetros canônicos e normalização de URLs de e-commerce e afiliados (Amazon, Mercado Livre, Shopee). 

A aplicação executa localmente utilizando uma única instância persistente do Chromium (Playwright) para persistência transparente de sessões autenticadas, livre de complexidades de criptografia de perfis e VPS.

Consulte os detalhes técnicos em:
* [Arquitetura de Navegador Persistente Local](docs/ARCHITECTURE.md)

---

## 🚀 Execução Rápida

### Requisitos
* Node.js v22 ou superior.
* Playwright Chromium (instalado automaticamente via playwright).

### Instalação de Dependências
```bash
npm install
```

### Configurando o Ambiente
Copie o arquivo de exemplo `.env.example` para `.env` e ajuste se necessário:
```bash
cp .env.example .env
```

### Executando em Desenvolvimento
```bash
npm run dev
```

### Executando a Suíte de Testes
```bash
npm test
```

---

## 🔌 Endpoints HTTP Principais

### 1. Normalizar URL
Resolve e extrai os parâmetros canônicos do produto.

* **Rota**: `POST /normalize`
* **Headers**:
  * `x-profile-id`: `amazon-profile-1` (Opcional, usado para rastreamento)
* **Corpo (JSON)**:
  ```json
  {
    "url": "https://amzn.to/3XJ1Zpq"
  }
  ```
* **Resposta (200 OK)**:
  ```json
  {
    "success": true,
    "marketplace": "amazon",
    "url_final": "https://www.amazon.com.br/dp/B0CX123456",
    "id_produto": "B0CX123456",
    "titulo": "Real Product Title",
    "imagem": "https://images.amazon.com/product.jpg",
    "execution": {
      "duration_ms": 1240
    }
  }
  ```

### 2. Abertura do Navegador (Login Manual)
Abre uma aba headful no Chromium persistente para login manual ou resolução de desafios.

* **Rota**: `POST /browser/open`
* **Corpo (JSON)**:
  ```json
  {
    "url": "https://www.amazon.com.br/gp/sign-in.html"
  }
  ```
* **Resposta (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Navegador aberto na URL solicitada."
  }
  ```

### 3. Status e Saúde do Browser
* **Rota**: `GET /browser/status`
* **Resposta (200 OK)**:
  ```json
  {
    "running": true,
    "persistent": true,
    "browserVersion": "120.0.0.0",
    "managedPages": 0,
    "manualPages": 1,
    "browserData": "./data/browser",
    "headless": false,
    "uptime": 360,
    "contextOpen": true
  }
  ```
