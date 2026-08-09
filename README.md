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
Copie o arquivo de exemplo `.env.example` para `.env`:
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

### Executando em Produção
```bash
npm run build
npm start
```
A API inicializa automaticamente o navegador persistente em modo headless no boot, ficando pronta para uso na porta **3007**.

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
    "connected": true,
    "mode": "persistent",
    "browser": "Chromium",
    "uptime": 360,
    "ready": true
  }
  ```

### 4. Status Geral do Servidor (Produção)
* **Rota**: `GET /status`
* **Resposta (200 OK)**:
  ```json
  {
    "success": true,
    "status": "online",
    "version": "0.1.0",
    "environment": "production",
    "runtime": "persistent",
    "browser": "running",
    "headless": true,
    "host": "0.0.0.0",
    "port": 3007,
    "tailscale_ip": "100.101.57.98",
    "tailscale_url": "http://100.101.57.98:3007",
    "uptime_seconds": 3600,
    "sessions": {
      "amazon": "loaded",
      "mercadolivre": "loaded"
    }
  }
  ```
