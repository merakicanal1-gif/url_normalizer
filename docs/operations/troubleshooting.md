# Guia de Resolução de Problemas (Troubleshooting)

Este documento auxilia a equipe de suporte a identificar e solucionar anomalias comuns observadas no URL Normalizer.

---

## 🚨 Problemas Comuns e Soluções

### 1. Conexão Browserless Indisponível
* **Sintoma**: Retorno de erro `BrowserlessUnavailableError` ou HTTP 503 com `"connected": false` no health check.
* **Causa**: O container do Browserless caiu ou o host configurado em `BROWSERLESS_URL` está incorreto ou inacessível.
* **Solução**:
  1. Verifique se o container está rodando localmente: `docker ps`.
  2. Teste a conectividade websocket do host: `nc -zv localhost 3001`.
  3. Confirme se `BROWSERLESS_URL` aponta para a porta correta (padrão local host: `3001` exposta no `docker-compose.yml`).

### 2. Erro 409 Conflict (`SESSION_BUSY`)
* **Sintoma**: A requisição falha com status 409 e o código `"SESSION_BUSY"`.
* **Causa**: Duas chamadas administrativas concorrentes (como salvar sessão e transicionar status simultaneamente) foram disparadas sobre o mesmo perfil.
* **Solução**:
  1. Aguarde a operação concorrente ser concluída (normalmente finalizada em menos de 2 segundos).
  2. Implemente tratamento de retry com backoff exponencial no client integrador da API.

### 3. Erro 410 Gone
* **Sintoma**: Status HTTP 410 retornado em requisições de salvamento.
* **Causa**: A sessão interativa expirou (atingiu o limite de TTL de 15 minutos sem novas interações) ou foi fechada pelo operador.
* **Solução**: Inicialize uma nova sessão interativa (`POST /interactive`) e refaça o processo de login.

### 4. Falha na Persistência (`SessionPersistenceError`)
* **Sintoma**: Erro HTTP 500 com mensagem contendo falha na escrita do storageState.
* **Causa**: Permissões de escrita inválidas ou falta de espaço em disco no diretório configurado em `SESSION_STORAGE_DIR`.
* **Solução**:
  1. Garanta que o usuário do processo Node.js possui permissão de leitura e escrita no diretório das sessões (padrão: `./data/sessions/`).
  2. Verifique o espaço em disco do servidor.
