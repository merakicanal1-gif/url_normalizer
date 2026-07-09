# ADR-005: Registry em Memória para Runtimes

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

As sessões interativas ativas requerem referências em tempo de execução aos objetos do Playwright (`Page`, `BrowserContext`), que não são serializáveis e, portanto, não podem ser persistidos em disco ou bancos relacionais comuns.

---

## Decisão

Adotamos a implementação de um registro em memória (**`InteractiveSessionRegistry`**). Ele mapeia de forma O(1) os IDs de sessões interativas às suas referências ativas de runtime e fornece facilidades de varredura para expiração de TTL.

---

## Consequências

### Positivas:
* Acesso extremamente rápido a páginas e contextos ativos durante o login.
* Fácil geranciamento de expirações de tempo de vida.

### Negativas:
* O estado das sessões interativas ativas é volátil (se o processo reiniciar, os contextos em andamento são perdidos, mas os cookies salvos em disco persistem).
