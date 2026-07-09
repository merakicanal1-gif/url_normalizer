# ADR-002: Persistência Criptografada do StorageState

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

Os dados de sessões persistidas do Playwright (`storageState`) contêm cookies de login, tokens de autenticação e dados do localStorage. Salvar esses dados em texto puro viola regras de segurança cibernética básicas.

---

## Decisão

Adotamos a persistência de arquivos locais do `SessionStorage` de forma criptografada usando algoritmo **AES-256-GCM** com envelope seguro. A chave de criptografia é gerada a partir de uma variável de ambiente (`SESSION_SECRET`).

---

## Consequências

### Positivas:
* Conformidade com LGPD e GDPR contra vazamentos de cookies de sessão de terceiros.
* Proteção contra acessos diretos não autorizados no volume de disco.

### Negativas:
* Pequeno overhead de processamento de CPU para criptografia/descriptografia de I/O em disco.
