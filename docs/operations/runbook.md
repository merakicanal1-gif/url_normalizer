# Runbook Operacional

Este documento detalha os procedimentos recomendados para a inicialização, administração, verificação de logs e monitoramento operacional da API.

---

## 🚀 Inicialização do Ambiente

### 1. Requisitos Prévios
* **Node.js**: v22.x LTS ou superior.
* **Docker & Docker Compose** (para instanciar o container local do Browserless).

### 2. Inicializando o Provedor do Browserless
```bash
docker compose up -d
```
* O container local escutará na porta host `3001` (`ws://localhost:3001`).

### 3. Configurando Variáveis de Ambiente (`.env`)
Copie o arquivo `.env.example` para `.env` e configure:
```env
PORT=3000
BROWSERLESS_URL=ws://localhost:3001
SESSION_SECRET=sua-chave-secreta-de-32-caracteres-aqui
```

### 4. Executando o Servidor HTTP
* **Modo Desenvolvimento**:
  ```bash
  npm run dev
  ```
* **Produção**:
  ```bash
  npm run build && npm run start
  ```

---

## 🛠️ Procedimentos de Administração

### 1. Criar Sessão Interativa (Login Humano)
Disparar a criação para o marketplace e ID de perfil correspondentes:
```bash
curl -i -X POST http://localhost:3000/sessions/amazon/amazon-main/interactive
```
* Guarde o `sessionId` retornado e o link do DevTools/VNC para acesso visual do operador.

### 2. Transicionar Status
Transicione a sessão para `LOGIN_IN_PROGRESS` enquanto o login é efetuado, e depois para `READY_TO_SAVE`:
```bash
curl -i -X PATCH http://localhost:3000/sessions/amazon/amazon-main/interactive \
  -H "Content-Type: application/json" \
  -d '{"transition": "READY_TO_SAVE"}'
```

### 3. Salvar os Cookies da Sessão
Após o login com sucesso, grave em arquivo local criptografado:
```bash
curl -i -X POST http://localhost:3000/sessions/amazon/amazon-main/save
```

---

## 🔍 Leitura de Logs e Health Checks

### Interpretação do Health Check
Consulte a integridade da conexão Browserless:
```bash
curl -i http://localhost:3000/infrastructure/browser/health
```
* Verifique se `"connected": true` e se `"registeredContexts"` e `"registeredPages"` estão zerados pós-salvamento (indicando zero vazamentos de recursos).

### Análise de Logs Estruturados Pino
Os logs JSON são impressos no terminal e podem ser filtrados usando ferramentas como `jq`:
* **Filtrar erros operacionais**:
  ```bash
  tail -f app.log | jq 'select(.level >= 40)'
  ```
* **Acompanhar transições de estado**:
  ```bash
  tail -f app.log | jq 'select(.event == "INTERACTIVE_SESSION_STATE_CHANGED")'
  ```
