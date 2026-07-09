# ADR-004: Máquina de Estados da Sessão Interativa

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

Precisamos de controle estrito sobre o ciclo de vida das sessões interativas de login para evitar falhas como salvar uma sessão inativa, re-ativar sessões expiradas ou vazamento de contextos de navegação.

---

## Decisão

Adotamos a especificação de uma máquina de estados de domínio formalizada no componente **`InteractiveSessionStateMachine`**. Ela valida e governa todas as transições de status da sessão antes de qualquer persistência física.

---

## Consequências

### Positivas:
* Segurança lógica total no ciclo de vida das sessões de login.
* Erros previsíveis mapeados diretamente para as rotas da API HTTP.
