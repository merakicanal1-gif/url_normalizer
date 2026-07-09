# 📝 Changelog

Todas as mudanças importantes deste projeto devem ser registradas neste documento.

Este arquivo segue o padrão **Keep a Changelog**, adaptado para o projeto URL Normalizer.

---

# Como utilizar

- Sempre adicione a versão mais recente no topo.
- Nunca remova versões antigas.
- Nunca altere versões já publicadas, exceto para corrigir erros de documentação.
- Cada versão deve representar um marco importante do projeto.
- Mudanças pequenas do dia a dia devem ser registradas em **08 - Atualizações.md**.
- O Changelog registra apenas mudanças relevantes do projeto.

---

# Estrutura

Cada versão deverá utilizar o seguinte formato.

```text
## vX.Y.Z

Data:

Status:

### Adicionado

### Alterado

### Corrigido

### Removido

### Melhorias Técnicas

### Observações
```

---

# Versionamento

O projeto utilizará Versionamento Semântico (Semantic Versioning).

Formato:

```
MAJOR.MINOR.PATCH
```

Exemplo.

```
1.0.0
```

## MAJOR

Mudanças incompatíveis.

Exemplo:

Nova arquitetura.

Mudança completa da API.

---

## MINOR

Novas funcionalidades.

Exemplo.

Novo marketplace.

Novo endpoint.

Nova funcionalidade.

---

## PATCH

Correções.

Exemplo.

Bug.

Performance.

Segurança.

Pequenos ajustes.

---

# Histórico

## v0.1.0

**Data**

2026-07-06

**Status**

Primeira versão da documentação.

### Adicionado

- Estrutura inicial da Project Knowledge Base.
- Organização da documentação.
- Definição da arquitetura inicial.
- Definição da stack tecnológica.
- Definição da estrutura do projeto.
- Definição do fluxo de desenvolvimento.
- Definição da metodologia de documentação.

### Alterado

Nenhuma alteração.

### Corrigido

Nenhuma correção.

### Removido

Nenhuma remoção.

### Melhorias Técnicas

- Browserless definido como navegador compartilhado.
- Comunicação oficial definida via CDP.
- Browser persistente.
- BrowserContext persistente.
- Uma nova Page por requisição.
- Node.js atualizado para versão 22 LTS.

### Observações

Esta versão representa a criação oficial da documentação e da arquitetura do projeto.
---

## v0.2.0

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.1 / Sprint 0.2)

### Adicionado
- Implementado `BrowserManager` com padrão Lazy Connection reativa.
- Adicionado `BrowserProfile` realista com locale `pt-BR`, timezone, extraHTTPHeaders.
- Logs estruturados Pino integrados na infraestrutura do navegador.
- Degradação graciosa de logs sem dependência obrigatória de pino-pretty em produção.

---

## v0.3.0

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.3)

### Adicionado
- Criada a porta `IUrlResolver` e adaptador `PlaywrightUrlResolver` para desacoplamento de rede.
- Adicionado erro de domínio `ChallengeDetectedError` para interceptação de WAF/CAPTCHAs.
- Rota `normalize` atualizada para retornar HTTP 403 sob barreira de segurança.

---

## v0.3.1

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.3.1 - Hotfix)

### Corrigido
- Corrigida regressão de CAPTCHA falso positivo na Amazon (eliminando a busca genérica por `robot` que casava com scripts de telemetria `robotdetection`).

---

## v0.4.0

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.4 - Affiliate Resolution)

### Adicionado
- Affiliate Link Resolution Engine: Resolvedores leves via HTTP (HEAD/GET manual).
- Implementados resolvedores especializados: `AmazonAffiliateResolver`, `MercadoLivreAffiliateResolver` e `ShopeeAffiliateResolver`.
- Criado `GenericRedirectResolver` para encurtadores genéricos com detecção de loops.
- Centralização de hosts via `MarketplaceHostRegistry`.
- Unificação de métricas e telemetria sob `ResolutionMetadata` no DTO.
- Abertura direta do navegador na URL final resolvida pelo `NormalizeService` (evitando redirects no browser).

---

## v0.4.1

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.4.1 - HTTP Resolver Success Fix)

### Corrigido
- Ajustado critério de sucesso do `HttpResolverHelper` para retornar `resolvedSuccess = true` apenas se ocorreu de fato um redirecionamento, a URL final é diferente da inicial e o status final é 2xx (corrigindo a interrupção precoce de fallback de links bloqueados por CloudFront em `meli.la`).
- Configurados cabeçalhos realistas de navegador para requisições leves de rede bypassarem bloqueios de API simples.

---

## v0.4.2

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.4.2 - MercadoLivrePlugin Landing Page Support)

### Adicionado
- Criado o `MercadoLivrePlugin` com suporte a clicks e navegação transparente em landing pages de afiliados (contendo `/social/` ou o botão "Ir para produto").
- Adicionados testes de canHandle, produto direto e simulação de clique no plugin.

---

## v0.4.3

**Data**

2026-07-06

**Status**

Concluído (Sprint 0.4.3 - Marketplace Page Classification)

### Adicionado
- Criado o tipo `MarketplacePageType` para classificação estruturada de páginas (`PRODUCT_PAGE`, `AFFILIATE_LANDING`, `LOGIN_PAGE`, `CONSENT_PAGE`, `ERROR_PAGE`, `CAPTCHA_PAGE`, `WAF_PAGE`, `UNKNOWN`).
- Implementado mapeamento e assinaturas de erro específicas nos plugins da Amazon, Mercado Livre e Shopee.
- Criada a exceção de domínio `MarketplaceUnavailableError` com retorno de HTTP 503 (`MARKETPLACE_ERROR_PAGE`) para erros operacionais externos.
- Criado o `ShopeePlugin` contemplando extração de ID do produto e tratamento de barreiras de login e erro.
- Registrada a **ADR-025** sobre a arquitetura de classificação de páginas.
- Adicionados testes unitários robustos mockando interações e erros para os três plugins.

---

## v0.4.4

**Data**

2026-07-06

**Status**

Concluído (Sprint 1.0.3B — Interactive Login via Browserless)

### Adicionado
- Criada a interface port `IRemoteBrowserInfrastructure` para desacoplar a API do Browserless.
- Adicionado `BrowserInfrastructureFactory` para resolução dinâmica do provedor de navegador remoto.
- Injetada a abstração `IClock` e `SystemClock` permitindo mock de passagem de tempo determinístico via `FakeClock` sem sleeps nos testes unitários.
- Rota segura `/debug` isolando as URLs sensíveis de depuração (VNC/Inspector) de listagens públicas.
- Logs Pino estruturados gravando latências específicas de bootstrap do browser por sub-etapa.

---

## v0.4.5

**Data**

2026-07-06

**Status**

Concluído (Sprint 1.0.3C — Interactive Session Persistence)

### Adicionado
- Mapeamento e máquina de estados de domínio `InteractiveSessionStateMachine` migrados para regras de domínio puras.
- Encapsulado `InteractiveSessionRuntime` vinculando recursos de infraestrutura do Playwright de forma isolada.
- Criado o `InteractiveSessionService` centralizando a persistência e ciclo de vida das sessões.
- Persistência segura, transacional e idempotente (evita descarte de recursos se gravação física falhar).
- Retorno de metadados em `/save` contendo `profileVersion` e `persistedAt` sem I/O extra.
- Novo endpoint `PATCH /sessions/:marketplace/:profileId/interactive` aceitando a propriedade `transition` para controle de transições.

---

## v0.4.6

**Data**

2026-07-06

**Status**

Concluído (Sprint 1.0.3D — Hardening & Reliability)

### Adicionado
- Criada a interface port `IBrowserRuntimeMetrics` isolando as métricas de runtime no domínio.
- Criado o `RuntimeLeakDetector` fornecendo snapshots detalhados do runtime (activeContexts, activePages, registeredSessions, expiredSessions, memoryUsageMB, uptimeSeconds).
- Trava concorrente rápida com liberação robusta em blocos `finally` de `InteractiveSessionService` (HTTP 409 `SESSION_BUSY`).
- Auto-recuperação do Browserless integrada no PlaywrightBrowserManager com tracking de tentativas e datas de desconexão.
- Sanitização de segurança Pino contra exposição de dados sensíveis e credenciais em arquivos de log.
- Novo endpoint `GET /infrastructure/runtime` e health expandido para auditoria remota.

---

## v1.0.1-beta

**Data**

2026-07-06

**Status**

Concluído (Sprint 1.0.4 — Automatic Login Detection)

### Adicionado
- Criada a porta `IPageInspector` desacoplando as operações do Playwright do domínio das regras de negócio.
- Criada a porta `IAuthenticationDetector` estruturando a assinatura comum para detecção em múltiplos marketplaces.
- Criada a porta `IApplicationEventBus` implementando comunicação orientada a eventos para desacoplamento de fluxo.
- Criado o adaptador `ApplicationEventBus` para tráfego tipado do TypeScript com suporte a descarte (`unsubscribe`).
- Criado o adaptador `PlaywrightPageInspector` que implementa as operações na página sem dependência direta do Playwright pelo domínio.
- Criada a configuração estruturada em grupos `AmazonAuthenticationConfig`.
- Criado o `AmazonAuthenticationDetector` para auditoria automática de cookies e status da conta na Amazon.
- Criado o `AuthenticationDetectorRegistry` para registro dinâmico dos resolvedores de marketplace.
- Implementado o `InteractiveAuthenticationMonitor` gerenciando o ciclo de vida completo do monitoramento com timers e eventos assíncronos.
- Rota `GET /sessions/:marketplace/:profileId/status` estendida para mesclar dados dinâmicos de autenticação do monitor de forma transparente.
- Publicação automática de `SessionCreated` e escuta a eventos `PageNavigated` (`framenavigated`, `load`) otimizando latência de verificação.

---

## v1.0.0-beta

**Data**

2026-07-06

**Status**

Concluído (Sprint 1.0.3E — Architecture Baseline & Documentation)

### Adicionado
- Estrutura completa de documentação na pasta `docs/` (architecture, api, operations, adr, diagrams).
- Especificação formal completa OpenAPI 3.0 no arquivo `openapi.yaml`.
- Runbook operacional completo em `docs/operations/runbook.md`.
- Guia de troubleshooting em `docs/operations/troubleshooting.md`.
- ADR-000 detalhando o contexto arquitetural do projeto.
- ADR-001 a ADR-007 documentando as decisões estruturais históricas de auto-cura, criptografia, orquestração de sessões e observabilidade.
- Roadmap de evolução detalhado no README principal do repositório.

### Observações
Esta versão representa o marco de **baseline arquitetural** do projeto URL Normalizer. A partir daqui a fundação de Clean Architecture e Arquitetura Hexagonal está 100% estabilizada e homologada.

---

# Próximas versões

## v1.0.0

Planejado.

- Estratégias e táticas de evasão de WAF/Anti-bot (stealth plugin, proxies residenciais).
- Especificações e mecanismo de Caching (Redis/Memória).
- Suporte a novos marketplaces (RFC-002).

---

# Regras

O Changelog nunca substitui o arquivo de Atualizações.

Diferença:

## Changelog

Registra apenas mudanças relevantes da evolução do projeto.

## Atualizações

Registra todo o histórico das conversas, decisões e contexto.

## CONTEXTO ATUAL

Representa apenas o estado atual do projeto.

---

# Objetivo

Este documento deve permitir compreender rapidamente como o projeto evoluiu ao longo do tempo, registrando apenas mudanças importantes, de forma organizada, clara e cronológica.
