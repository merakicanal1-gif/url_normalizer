# ADR-003: InteractiveSessionService como Orquestrador

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

A manipulação física e a orquestração administrativa de sessões interativas (salvar cookies, transicionar status) estavam acopladas ao resolvedor e ao browser manager, violando o princípio de responsabilidade única (SRP).

---

## Decisão

Criamos o serviço orquestrador de aplicação **`InteractiveSessionService`**. Ele centraliza os fluxos de persistência, validações de integridade, bloqueio e liberação de locks de concorrência e coordenação com a máquina de estados.

---

## Consequências

### Positivas:
* Desacoplamento da camada de transport (HTTP/Fastify) e infraestrutura Playwright contra regras de salvamento de sessões.
* Limpeza de código facilitando auditorias de capacidade do runtime.
