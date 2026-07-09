# ADR-006: Recuperação Automática do Browserless

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

Instabilidades físicas de rede temporárias no container ou serviço do Browserless podem desconectar a API principal, interrompendo as resoluções de forma permanente até o reinício completo do servidor HTTP.

---

## Decisão

Adotamos a auto-recuperação resiliente direta no `PlaywrightBrowserManager` por meio do monitoramento do evento `disconnected` do Playwright. A conexão local interna é anulada e re-estabelecida de forma limpa na próxima requisição do usuário.

---

## Consequências

### Positivas:
* API resiliente a quedas físicas transitórias de containers em produção.
* Auto-cura sem necessidade de reinicialização ou intervenção humana.
