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

🟢 Em desenvolvimento (Sprint 1.0.4 Concluída — Automatic Login Detection)

**Versão atual**

v1.0.1-beta

**Última atualização**

Atualização 031 (Sprint 1.0.4 Concluída)

**Data**

2026-07-06

---

# Situação Atual

A **Sprint 1.0.4 — Automatic Login Detection** foi concluída com sucesso absoluto. Alcançamos o marco de maturidade de arquitetura **v1.0.1-beta**.

Esta sprint implementou a detecção automatizada de login (autenticação) para sessões interativas sem expor o domínio a dependências do Playwright. As principais conquistas foram:
1. **Ports & Adapters**: Introduzidos contratos de domínio neutros (`IPageInspector`, `IAuthenticationDetector` e `IApplicationEventBus`) desacoplando completamente a lógica de infraestrutura.
2. **Event-Driven Architecture**: O `PlaywrightBrowserManager` agora emite eventos do tipo `PageNavigated` ao detectar navegações ou carregamento da página, otimizando a latência de verificação ao evitar loops de polling excessivos.
3. **Detector Registry**: Implementada a verificação isolada da Amazon no `AmazonAuthenticationDetector` integrado em grupos de checagem estruturada (cookies, urls, selectors e texts).
4. **Lifecycle & Monitor**: O `InteractiveAuthenticationMonitor` gerencia o monitoramento e transições da máquina de estados do domínio com resiliência, suportando limites máximos de tentativas e tempos limite configuráveis.
5. **GET /status Enriquecido**: O endpoint de status agora mescla transparentemente metadados dinâmicos e temporários (como confiança e razão) do monitor em memória sem contaminar a entidade persistida.
6. **Suíte de Testes**: Criados testes unitários robustos mockados. A suíte total de testes nativos subiu para **90 testes**, todos com 100% de sucesso.

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

✔ **Gerenciador Playwright CDP**: Desacoplamento reativo com `IRemoteBrowserInfrastructure` e `IClock`.

✔ **InteractiveSessionService**: Persistência criptografada transacional AES-256-GCM.

✔ **Robustez**: Auto-cura de desconexão CDP, locks contra concorrência e Pino redact estendido.

✔ **Testes de Cobertura**: 83 testes planos nativos passando com 100% de sucesso.

---

## Documentação da PKB

✔ [LEIA PRIMEIRO](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/00%20-%20LEIA%20PRIMEIRO.md)

✔ [GPT Instructions](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/01%20-%20GPT%20Instructions.md)

✔ [Projeto](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/02%20-%20Projeto.md)

✔ [Arquitetura](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/03%20-%20Arquitetura.md)

✔ [Desenvolvimento](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/04%20-%20Desenvolvimento.md)

✔ [API](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/05%20-%20API.md)

✔ [Changelog](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/06%20-%20Changelog.md)

✔ [Problemas Conhecidos](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/07%20-%20Problemas%20Conhecidos.md)

✔ [Atualizações](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/08%20-%20Atualiza%C3%A7%C3%B5es.md)

✔ [Contexto Atual](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20%28Gpt%29/09%20-%20CONTEXTO%20ATUAL.md)

---

# Estado Atual da Implementação

A baseline arquitetural com detecção automática está estável e consolidada na versão `v1.0.1-beta`. A detecção automática de login para a Amazon está completa e validadas.

---

# Próxima Tarefa

Apresentar o plano de implementação da **Sprint 1.0.5 — Interface Humana de Autenticação (QR Code, MFA e VNC)**.

---

# Próximas Etapas

Após homologação do design:

1. Desenvolvimento da Sprint 1.0.5 (Interface humana, exibição de QR Code e suporte a VNC no frontend para operadores interagirem com o fluxo de MFA).
2. Evasão automática de CAPTCHAs.

---

# Decisões Arquiteturais Ativas

Neste momento estas decisões são oficiais:

- Uso de Arquitetura Hexagonal (Ports & Adapters) para isolamento do Domínio.
- Desacoplamento de Provedor de Navegador Remoto via interface neutra `IRemoteBrowserInfrastructure`.
- Desacoplamento temporal de relógio via interface `IClock`.
- Resolução dinâmica e polimórfica de plugins de marketplaces via contrato common e registry central.
- **BrowserProfile** carregado do ambiente como a autoridade de configurações de navegação.
- **Lazy Connection** na infraestrutura de navegação, mitigando race conditions de inicialização.
- Fastify + TypeScript + Node.js 22 LTS + Playwright CDP + Zod + Pino.
