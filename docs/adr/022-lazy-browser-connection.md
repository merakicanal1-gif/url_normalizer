# ADR-022 — Lazy Browser Connection

## Status
Approved

## Contexto
Durante a inicialização dos containers via Docker Compose, as aplicações iniciam quase que simultaneamente. Embora o `depends_on` garanta que o container do `browserless` seja iniciado antes do `url-normalizer`, isso não garante que o serviço interno do Chromium (dentro do container Browserless) esteja totalmente pronto para aceitar conexões CDP sobre WebSocket.

Na arquitetura anterior, o `BrowserManager` tentava estabelecer a conexão CDP imediatamente durante o bootstrap da aplicação (`onReady` hook do Fastify). Se o Browserless ainda não estivesse pronto, ocorria um erro de conexão (`ECONNREFUSED` / `Connection refused`), quebrando a inicialização da API do URL Normalizer (condição de corrida).

## Decisão
Decidiu-se adotar o padrão **Lazy Connection** (Conexão Preguiçosa) para gerenciar o acoplamento temporal com a infraestrutura de navegador:

1. **Bootstrap Não-Bloqueante**: A inicialização da API HTTP do URL Normalizer não tentará se conectar ao Browserless durante o carregamento. O bootstrap do servidor Fastify será instantâneo e independente.
2. **Conectividade Sob Demanda**:
   * O `BrowserManager` estabelecerá a conexão CDP WebSocket com o Browserless somente quando for solicitado o processamento de uma página (`newPage()`) ou a verificação ativa de saúde do sistema.
   * O endpoint `/health` tentará conectar-se ativamente ao Browserless antes de retornar seu status final, apenas se já não estiver conectado. Em caso de falha de conexão no `/health`, o erro será silenciado e a API responderá com status `503 Service Unavailable / degraded` em formato JSON padronizado, sem derrubar a API HTTP.
3. **Sem Polling ou Loops**: Não haverá tentativas contínuas em segundo plano, loops de retry infinito ou timers periódicos para forçar reconexão. O ciclo de reconexão será sempre reativo e disparado sob demanda pelas requisições externas recebidas.

## Consequências
* **Vantagens**:
  * **Resolução da Condição de Corrida**: Elimina completamente falhas de inicialização cruzadas no Docker Compose.
  * **Independência Operacional**: A API do URL Normalizer inicia com sucesso mesmo se a infraestrutura do Browserless estiver indisponível ou offline.
  * **Recuperação de Falha**: O sistema é capaz de se recuperar dinamicamente no momento em que o Browserless se torna disponível, sem necessidade de reinicializar o container da API.
* **Desvantagens**:
  * A primeira requisição de normalização de URL ou a primeira chamada do `/health` terá um pequeno overhead de latência para realizar o handshake CDP inicial com o Browserless.
