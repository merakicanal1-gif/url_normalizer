# ADR-007: Observabilidade Baseada em Pino

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

A depuração distribuída e o rastreamento em tempo real de latências de rede e de carregamento de páginas Playwright são complexos. Logs textuais tradicionais de strings brutas impedem auditorias estruturadas eficientes.

---

## Decisão

Adotamos a utilização da biblioteca **Pino** para geração de logs estruturados em formato JSON, integrada com ganchos do Fastify e métricas operacionais estruturadas por transação de caso de uso.

---

## Consequências

### Positivas:
* Compatibilidade nativa com agregadores de logs modernos (Datadog, Kibana, Grafana Loki).
* Rastreamento exato de tempos de carregamento de páginas e gargalos de rede.
