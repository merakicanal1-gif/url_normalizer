# Documentação de Componentes

Este documento especifica a responsabilidade, as dependências, as portas utilizadas e os eventos emitidos por cada componente principal do sistema.

---

## 🧩 Componentes de Aplicação

### 1. NormalizeService
* **Responsabilidade**: Orquestrar a resolução e normalização de URLs. Tenta primeiro de forma leve via resolvedores HTTP de redirects e afiliados e, em caso de necessidade ou CAPTCHAs, delega ao navegador.
* **Dependências**: `IUrlResolver`, `MarketplaceRegistry`, `IBrowserManager`.
* **Portas Utilizadas**: `IUrlResolver` (para processar redirects), `IBrowserManager` (para controle de páginas).
* **Eventos Emitidos**: Nenhum direto.

### 2. CompositeUrlResolver
* **Responsabilidade**: Compor a cadeia de responsabilidades (Chain of Responsibility) de resolvedores HTTP leves e delegar dinamicamente a resolução ao resolvedor adequado com base no host.
* **Dependências**: Lista de `IUrlResolver`.
* **Portas Utilizadas**: `IUrlResolver`.
* **Eventos Emitidos**:
  * Logs estructurados Pino contendo tempo de resolução por etapa (`HttpResolverHelper`).

### 3. SessionManager
* **Responsabilidade**: Gerenciar os perfis de sessão ativos e persistir cookies descriptografados e criptografados em disco de forma isolada por marketplace.
* **Dependências**: `ISessionStorage`, `ISessionLock`.
* **Portas Utilizadas**: `ISessionStorage` (gravação e leitura física), `ISessionLock` (bloqueios transacionais).
* **Eventos Emitidos**:
  * `SESSION_IMPORTED` (quando novos cookies são importados de sessões interativas).

### 4. InteractiveSessionService
* **Responsabilidade**: Orquestrar o salvamento, as transições de status e o encerramento seguro e transacional das sessões interativas iniciadas pelo operador.
* **Dependências**: `InteractiveSessionRegistry`, `ISessionManager`, `IClock`, `IBrowserRuntimeMetrics`.
* **Portas Utilizadas**: `ISessionManager`, `IClock`, `IBrowserRuntimeMetrics`.
* **Eventos Emitidos**:
  * `INTERACTIVE_SESSION_SAVE_STARTED`
  * `INTERACTIVE_SESSION_STORAGE_EXTRACTED`
  * `INTERACTIVE_SESSION_STORAGE_ENCRYPTED`
  * `INTERACTIVE_SESSION_PERSISTED`
  * `INTERACTIVE_SESSION_SAVE_COMPLETED`
  * `SESSION_RUNTIME_DESTROYED`

---

## 🌐 Adaptadores de Infraestrutura (Browser)

### 5. PlaywrightBrowserManager
* **Responsabilidade**: Gerenciar conexões CDP com o provedor remoto, instanciar contextos de navegador Playwright e realizar auto-recuperação.
* **Dependências**: `IRemoteBrowserInfrastructure`, `IClock`, `InteractiveSessionRegistry`, `BrowserSessionFactory`.
* **Portas Utilizadas**: `IRemoteBrowserInfrastructure`, `IClock`, `IBrowserRuntimeMetrics` (implementa esta porta).
* **Eventos Emitidos**:
  * `INTERACTIVE_BROWSER_RECOVERY_REQUIRED`
  * `INTERACTIVE_BROWSER_RECOVERED`
  * `SESSION_RUNTIME_CREATED`

### 6. InteractiveSessionRegistry
* **Responsabilidade**: Manter em memória as referências de runtimes Playwright (`InteractiveSessionRuntime`) indexadas de forma O(1) e controlar expirações por TTL.
* **Dependências**: `IClock`.
* **Portas Utilizadas**: `IClock`.
* **Eventos Emitidos**:
  * `INTERACTIVE_SESSION_STATE_CHANGED`
  * `INTERACTIVE_BROWSER_EXPIRED`
  * `INTERACTIVE_BROWSER_TIMEOUT`

### 7. RuntimeLeakDetector
* **Responsabilidade**: Coletar diagnósticos completos e compilar snapshots de recursos e capacidade para auditoria.
* **Dependências**: `IBrowserRuntimeMetrics`, `InteractiveSessionRegistry`.
* **Portas Utilizadas**: `IBrowserRuntimeMetrics`.
* **Eventos Emitidos**:
  * `SESSION_RUNTIME_LEAK_CHECK`

### 8. BrowserlessClient
* **Responsabilidade**: Realizar chamadas HTTP REST e WebSocket diretamente à infraestrutura do Browserless, traduzindo URLs internas de depuração para URLs públicas.
* **Dependências**: Nenhuma.
* **Portas Utilizadas**: `IRemoteBrowserInfrastructure` (implementa esta porta).
* **Eventos Emitidos**: Nenhum.

### 9. BrowserInfrastructureFactory
* **Responsabilidade**: Criar instâncias do provedor remoto com base nas variáveis de ambiente (`BROWSER_PROVIDER`).
* **Dependências**: Nenhuma.
* **Portas Utilizadas**: Nenhuma (retorna `IRemoteBrowserInfrastructure`).
* **Eventos Emitidos**: Nenhum.

### 10. BrowserSessionFactory
* **Responsabilidade**: Unificar cabeçalhos e configurações do `BrowserProfile` aos dados persistidos de cookies carregados do `SessionManager`.
* **Dependências**: `SessionManager`.
* **Portas Utilizadas**: Nenhuma (consome `ISessionManager`).
* **Eventos Emitidos**:
  * `SESSION_LOADED`
  * `SESSION_USED`
