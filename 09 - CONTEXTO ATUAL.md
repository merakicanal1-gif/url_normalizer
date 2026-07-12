# 📍 CONTEXTO ATUAL

> **IMPORTANTE**
>
> Este documento representa o estado atual oficial do projeto **URL Normalizer**.
>
> Este arquivo deve ser completamente substituído ao final de cada conversa relevante.
>
> O GPT deve sempre considerar este documento como a principal referência para compreender rapidamente onde o projeto se encontra.
>
> Caso exista alguma divergência entre este documento e qualquer atualização antiga, prevalece sempre o conteúdo deste documento.

---

# Informações Gerais

**Projeto**

URL Normalizer

**Status**

🟢 Em desenvolvimento (Sprint 1.0.4 Concluída / Refatoração MercadoLivrePlugin Concluída)

**Versão atual**

v1.0.1-beta

**Última atualização**

Refatoração Arquitetural do MercadoLivrePlugin baseada em Máquina de Estados

**Data**

2026-07-12

---

# Situação Atual

A **Sprint 1.0.4 — Automatic Login Detection** está concluída. Adicionalmente, realizamos a refatoração completa do `MercadoLivrePlugin` para sanar problemas de classificação prematura de erro (`ERROR_PAGE`) em links de afiliados (`meli.la`). As principais conquistas foram:
1. **Máquina de Estados de Navegação**: Redesenhado o fluxo de interações do Mercado Livre baseado em estados determinísticos (`INITIAL`, `OPEN_URL`, `WAIT_DOM`, `WAIT_NETWORK`, `INSPECT_CURRENT_PAGE`, `DECIDE_NEXT_ACTION`, `CLICK_PRIMARY_ACTION`, `WAIT_NAVIGATION`, `VALIDATE_DESTINATION`, `PRODUCT_PAGE`, `EXTRACT_PRODUCT`, `FINISHED`).
2. **Evidências Estruturais**: A classificação e validação da página foi desacoplada de buscas textuais genéricas no HTML (removido o falso positivo `"ir a la página principal"`), passando a inspecionar elementos estruturais concretos do DOM (título `.ui-pdp-title`, contêiner de ações `.ui-pdp-actions`, links rel=canonical e placeholders específicos de erro).
3. **Promise.race pós-clique**: O plugin agora escuta por múltiplos sinais de progresso após interagir com o botão da landing (navegação do Playwright, mudança na URL contendo MLB, ou elementos estruturais da PDP carregados), tornando-o imune a SPA/client-side routing e atrasos de carregamento.
4. **Resiliência e Screenshots Dinâmicos**: A pasta de screenshots de observabilidade agora é criada e lida dinamicamente via `process.env.ARTIFACTS_DIR` (removendo caminhos absolutos hardcoded antigos tanto no Mercado Livre quanto na Amazon).
5. **Suíte de Testes Expandida**: Criados testes comportamentais completos validando as transições de estados, captchas, WAF, logins e estabilizações. A suíte total de testes nativos subiu para **93 testes**, todos com 100% de sucesso.

---

# O que já foi concluído

## Infraestrutura, Governança & Baseline (v1.0.0-beta)

✔ **PROJECT_CHARTER.md** e **RFC-000 — Engineering Process** elaborados.

✔ **docs/architecture/**: overview, components, runtime e state-machine criados.

✔ **docs/adr/**: ADRs de 000 a 007 salvos consolidando as decisões arquiteturais.

✔ **docs/operations/**: runbook e troubleshooting criados.

✔ **openapi.yaml**: especificação OpenAPI 3.0 completa da API gerada.

---

## Código-Fonte & Testes (Concluídos)

✔ **Resolução de Afiliados**: Resolvedores HTTP leves para Amazon, ML e Shopee.

✔ **Plugins de Classificação**: Classificação robusta de páginas WAF, CAPTCHA, erro e produto.

✔ **Refatoração MercadoLivrePlugin**: Máquina de estados explícita baseada em eventos/estrutura do DOM (Sprint 1.0.4+).

✔ **Gerenciador Playwright CDP**: Desacoplamento reativo com `IRemoteBrowserInfrastructure` e `IClock`.

✔ **InteractiveSessionService**: Persistência criptografada transacional AES-256-GCM.

✔ **Robustez**: Auto-cura de desconexão CDP, locks contra concorrência e Pino redact estendido.

✔ **Testes de Cobertura**: 93 testes planos nativos passando com 100% de sucesso.

---

# Decisões Arquiteturais Ativas

- Uso de Arquitetura Hexagonal (Ports & Adapters) para isolamento do Domínio.
- Desacoplamento de Provedor de Navegador Remoto via interface neutra `IRemoteBrowserInfrastructure`.
- Desacoplamento temporal de relógio via interface `IClock`.
- Resolução dinâmica e polimórfica de plugins de marketplaces via contrato common e registry central.
- **BrowserProfile** carregado do ambiente como a autoridade de configurações de navegação.
- **Lazy Connection** na infraestrutura de navegação, mitigando race conditions de inicialização.
- Fastify + TypeScript + Node.js 22 LTS + Playwright CDP + Zod + Pino.
