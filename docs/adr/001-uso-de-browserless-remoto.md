# ADR-001: Uso de Browserless Remoto

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

Precisamos de uma infraestrutura escalável, isolada e segura para executar instâncias do Playwright Chromium, reduzindo o consumo de memória RAM na API local e permitindo compartilhamento de recursos em produção.

---

## Decisão

Adotamos a utilização da API remota do **Browserless** via conexão WebSocket por CDP (`ws://...`). O `PlaywrightBrowserManager` conecta-se de forma preguiçosa (Lazy Connection) a essa infraestrutura remota.

---

## Consequências

### Positivas:
* Redução de custos de CPU/RAM na aplicação principal.
* Possibilidade de deploy em ambientes serverless ou Kubernetes.
* Suporte nativo ao espelhamento de sessões interativas (VNC).

### Negativas:
* Dependência de conectividade de rede estável entre a API e o pool do Browserless.
