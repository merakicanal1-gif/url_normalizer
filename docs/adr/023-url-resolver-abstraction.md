# ADR-023 — URL Resolver Abstraction

## Status
Approved

## Contexto
Na arquitetura inicial da Sprint 0/0.1, a responsabilidade de navegar pelas URLs curtas para seguir redirecionamentos e a responsabilidade de extrair metadados e normalizar os dados específicos do marketplace estavam acopladas no mesmo componente central (`NormalizeService` chamava diretamente `page.goto()`). 

Essa abordagem trazia acoplamento temporal e estrutural, pois:
1. Misturava a mecânica de rede/redirecionamentos com a lógica de extração do Domínio e dos Plugins.
2. Dificultava a adoção de estratégias alternativas de resolução de redirecionamentos (por exemplo, seguir redirecionamentos via requisições HTTP rápidas usando verbos `HEAD`/`GET` sem gastar recursos de navegador).
3. Dificultava a classificação granular de erros de segurança (CAPTCHA, WAF, login) de forma independente do plugin do marketplace.

## Decisão
Decidiu-se isolar completamente a responsabilidade de seguir redirecionamentos e descobrir a URL final sob um novo componente abstrato: a porta `IUrlResolver` e a sua implementação inicial `PlaywrightUrlResolver`.

1. **Responsabilidade Única**: O `IUrlResolver` recebe uma URL qualquer, segue os redirecionamentos utilizando sua própria estratégia de resolução (inicialmente com Playwright no Browserless) e retorna o DTO estruturado `ResolvedUrl`.
2. **DTO ResolvedUrl**: Contém metadados ricos coletados durante a navegação, tais como:
   * `originalUrl` e `finalUrl`
   * `statusCode`
   * `pageTitle`
   * `navigationTimeMs`
   * Flags de diagnóstico de bloqueios (`detectedChallenge`, `detectedCaptcha`, `detectedConsent`, `detectedLogin`, `challengeType`).
   * A instância de página do navegador (`page`), permitindo que a camada de orquestração a repasse para os plugins de extração sem re-navegar.
3. **Independência de Domínio**: O `IUrlResolver` não conhece nada sobre marketplaces (Amazon, Mercado Livre, Shopee), plugins de normalização, ASINs ou seletores DOM específicos.
4. **Resiliência e Erros Estruturados**: Se um desafio ou bloqueio de segurança for identificado pelo resolvedor, ele é sinalizado estruturadamente de forma que o `NormalizeService` lance o erro tipado `ChallengeDetectedError`, o qual é traduzido no transporte para códigos de erro HTTP `403 Forbidden` com código `CHALLENGE_*`.

## Fluxo da Aplicação
```
API HTTP (normalize.ts)
   │
   ▼
NormalizeService
   │
   ├── 1. resolve(url) ──► PlaywrightUrlResolver (segue redirects)
   │                           │
   │                           ▼  (retorna ResolvedUrl com page)
   │
   ├── 2. Valida desafio (Se houver, fecha page e lança ChallengeDetectedError)
   │
   ├── 3. resolve(finalUrl) ──► MarketplaceRegistry (retorna Plugin correspondente)
   │
   └── 4. normalize(page, finalUrl) ──► MarketplacePlugin (extrai ASIN, título, imagem)
```

## Consequências
* **Vantagens**:
  * **Desacoplamento Completo**: Separação clara entre a mecânica de rede (descobrir onde o link aponta) e a mecânica de extração (normalizar o produto).
  * **Extensibilidade**: Facilidade de adicionar resolvedores alternativos de URL (ex: um `HttpRedirectResolver` rápido por requisições HTTP que não consome instâncias de navegador para links simples) bastando implementar a interface `IUrlResolver`.
  * **Segurança e Observabilidade**: Logs e erros de firewall de aplicação (AWS WAF, CAPTCHAs, Telas de Login) são detectados, enriquecidos e isolados antes de chegarem à lógica dos plugins.
* **Desvantagens**:
  * Adição de mais uma interface e arquivo de DTO na arquitetura do sistema.
