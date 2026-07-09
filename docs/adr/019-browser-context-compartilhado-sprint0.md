# ADR-019 — BrowserContext Compartilhado na Sprint 0

## Status
Approved

## Contexto
Na Sprint 0 (Prova de Conceito / Vertical Slice), o objetivo é validar o fluxo de ponta a ponta de normalização de URLs de marketplaces (n8n -> Fastify -> Domínio -> Playwright -> Browserless -> Amazon -> Resposta JSON) com a menor complexidade operacional possível. 

No entanto, em ferramentas de automação de navegadores como o Playwright, o ciclo de vida do `BrowserContext` impacta o isolamento de sessões, cookies e armazenamento local. Em ambientes de produção de alta concorrência, o isolamento completo é necessário para evitar vazamento de estado entre requisições de usuários distintos.

## Decisão
Decidiu-se, de forma consciente e para simplificação do MVP/PoC na Sprint 0:
1. Manter uma única instância persistente de `Browser` e um único `BrowserContext` global no `BrowserManager`.
2. Cada requisição criará dinamicamente uma nova `Page` dentro desse contexto e a fechará ao final.
3. Aceitar o risco temporário de compartilhamento de cookies e cache local entre requisições concorrentes durante a homologação.
4. Planejar a evolução desse ciclo de vida para a v1.0.0.

## Consequências
* **Vantagens na Sprint 0**:
  * Redução drástica na complexidade do código de gerenciamento de recursos.
  * Menor tempo de overhead na criação de páginas (evita inicializar o contexto a cada requisição).
  * Redução no consumo de memória na infraestrutura do Browserless.
* **Desvantagens / Riscos**:
  * Falta de isolamento de cookies e sessões (um cookie setado pela Amazon em uma requisição persistirá na requisição concorrente).
  * Em caso de corrupção ou fechamento inesperado do contexto global, todas as páginas ativas nele serão derrubadas.

## Evolução Planejada (v1.0.0)
Na versão v1.0.0, a arquitetura deverá evoluir para isolar contextos de navegação. Cada requisição terá seu próprio ciclo de vida de contexto:
```
Browser (Persistente)
 ├── Context A (Criado por Requisição A) -> Page A -> Fecha Context A
 ├── Context B (Criado por Requisição B) -> Page B -> Fecha Context B
 └── Context C (Criado por Requisição C) -> Page C -> Fecha Context C
```
Isso garante isolamento absoluto de cookies e dados de sessão, em total conformidade com boas práticas de segurança e observabilidade.
