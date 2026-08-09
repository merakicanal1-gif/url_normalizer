# Runbook Operacional

Este documento detalha os procedimentos recomendados para a inicialização, administração, verificação de logs e monitoramento operacional da API.

---

## 🚀 Inicialização do Ambiente

### 1. Requisitos Prévios
* **Node.js**: v22.x LTS ou superior.
* **Playwright**: Instalado automaticamente com as dependências do npm.

### 2. Configurando Variáveis de Ambiente (`.env`)
Copie o arquivo `.env.example` para `.env` e configure:
```env
PORT=3007
BROWSER_MODE=persistent
AUTO_START_BROWSER=true
```

### 3. Executando o Servidor HTTP
* **Modo Desenvolvimento**:
  ```bash
  npm run dev
  ```
* **Produção**:
  ```bash
  npm run build
  npm start
  ```
Após inicializar o servidor, o Playwright instanciará os contextos persistentes automaticamente. A API estará operacional na porta 3007.

---

## 🛠️ Procedimentos de Administração

### 1. Criar Sessão Interativa (Login Humano)
Disparar a criação para o marketplace e ID de perfil correspondentes:
```bash
curl -i -X POST http://localhost:3007/sessions/amazon/amazon-main/interactive
```
* Guarde o `sessionId` retornado e o link do DevTools/VNC para acesso visual do operador.

### 2. Transicionar Status
Transicione a sessão para `LOGIN_IN_PROGRESS` enquanto o login é efetuado, e depois para `READY_TO_SAVE`:
```bash
curl -i -X PATCH http://localhost:3007/sessions/amazon/amazon-main/interactive \
  -H "Content-Type: application/json" \
  -d '{"transition": "READY_TO_SAVE"}'
```

### 3. Salvar os Cookies da Sessão
Após o login com sucesso, grave em arquivo local criptografado:
```bash
curl -i -X POST http://localhost:3007/sessions/amazon/amazon-main/save
```

---

## 🔍 Leitura de Logs e Health Checks

### Interpretação do Health Check
Consulte a integridade da conexão Browserless:
```bash
curl -i http://localhost:3007/infrastructure/browser/health
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
