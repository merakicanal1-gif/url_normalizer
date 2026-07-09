# Documentação da API HTTP

Esta é a referência completa da API pública do **URL Normalizer**.

---

## 🧭 Resumo dos Endpoints

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| **`POST`** | `/normalize` | Normaliza uma URL de produto/afiliado. |
| **`GET`** | `/sessions` | Lista perfis de armazenamento salvos. |
| **`POST`** | `/sessions/import` | Importa manualmente cookies criptografados. |
| **`POST`** | `/sessions/:marketplace/:profileId/interactive` | Inicializa sessão interativa. |
| **`PATCH`** | `/sessions/:marketplace/:profileId/interactive` | Transiciona estado da sessão. |
| **`POST`** | `/sessions/:marketplace/:profileId/save` | Salva os cookies da sessão. |
| **`DELETE`** | `/sessions/:marketplace/:profileId/interactive` | Encerra a sessão interativa. |
| **`GET`** | `/sessions/:marketplace/:profileId/debug` | Retorna URLs de VNC/Debug. |
| **`GET`** | `/sessions/interactive` | Lista sessões interativas em memória. |
| **`GET`** | `/infrastructure/browser/health` | Status de saúde do Browserless. |
| **`GET`** | `/infrastructure/runtime` | Snapshot detalhado do runtime do navegador. |

---

## 📌 Detalhe dos Endpoints

### 1. `POST /normalize`
* **Finalidade**: Resolver redirects, classificar e extrair o código canônico de produtos em URLs dos marketplaces homologados.
* **Headers**:
  * `x-profile-id`: ID de perfil preferencial (opcional).
* **Corpo da Requisição**:
  ```json
  {
    "url": "https://amzn.to/3XJ9abc"
  }
  ```
* **Respostas de Sucesso**:
  * **HTTP 200 OK**:
    ```json
    {
      "success": true,
      "marketplace": "amazon",
      "url_final": "https://www.amazon.com.br/dp/B078GZM49M",
      "id_produto": "B078GZM49M",
      "titulo": "Kindle 11ª Geração",
      "imagem": "https://...",
      "execution": {
        "duration_ms": 1240
      }
    }
    ```
* **Respostas de Erro**:
  * **HTTP 422 Unprocessable Entity**: URL inválida ou ASIN não encontrado.
  * **HTTP 403 Forbidden**: Bloqueio de WAF/CAPTCHA detectado e sem sessão alternativa ativa.
* **Logs Emitidos**:
  * `SESSION_LOADED` e `SESSION_USED` (se o perfil de sessão for carregado).

---

### 2. `POST /sessions/:marketplace/:profileId/interactive`
* **Finalidade**: Inicializar um contexto interativo e isolado (Page e BrowserContext) no Browserless.
* **Respostas de Sucesso**:
  * **HTTP 201 Created**:
    ```json
    {
      "success": true,
      "data": {
        "sessionId": "int_uuid123",
        "marketplace": "amazon",
        "profileId": "amazon-main",
        "status": "WAITING_LOGIN",
        "createdAt": "2026-07-06T12:00:00.000Z",
        "expiresAt": "2026-07-06T12:15:00.000Z"
      }
    }
    ```
* **Logs Emitidos**:
  * `SESSION_RUNTIME_CREATED`

---

### 3. `PATCH /sessions/:marketplace/:profileId/interactive`
* **Finalidade**: Alterar o status da sessão para coordenar o fluxo humano de login interativo.
* **Corpo da Requisição**:
  ```json
  {
    "transition": "LOGIN_IN_PROGRESS"
  }
  ```
* **Respostas de Sucesso**:
  * **HTTP 200 OK**:
    ```json
    {
      "success": true
    }
    ```
* **Respostas de Erro**:
  * **HTTP 409 Conflict**:
    ```json
    {
      "success": false,
      "code": "SESSION_BUSY",
      "error": "Session is busy with another operation."
    }
    ```
* **Logs Emitidos**:
  * `INTERACTIVE_SESSION_STATE_CHANGED`

---

### 4. `POST /sessions/:marketplace/:profileId/save`
* **Finalidade**: Salvar cookies de login da sessão autenticada em arquivo criptografado.
* **Respostas de Sucesso**:
  * **HTTP 200 OK**:
    ```json
    {
      "success": true,
      "status": "SAVED",
      "persistedAt": "2026-07-06T12:02:15.000Z",
      "profileVersion": 2
    }
    ```
* **Respostas de Erro**:
  * **HTTP 409 Conflict (SESSION_BUSY)**: Sessão sob salvamento concorrente.
* **Logs Emitidos**:
  * `SESSION_IMPORTED`, `INTERACTIVE_SESSION_STORAGE_ENCRYPTED`, `SESSION_RUNTIME_DESTROYED`.

---

### 5. `GET /infrastructure/runtime`
* **Finalidade**: Retornar o diagnóstico instantâneo e contagens de recursos do Playwright (Snapshot Leak Detector).
* **Respostas de Sucesso**:
  * **HTTP 200 OK**:
    ```json
    {
      "success": true,
      "runtime": {
        "activeContexts": 2,
        "activePages": 3,
        "interactiveSessions": 1,
        "expiredSessions": 0,
        "browserConnected": true
      }
    }
    ```
