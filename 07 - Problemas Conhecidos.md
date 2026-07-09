# 🚧 Problemas Conhecidos

# Objetivo

Este documento registra todos os problemas, limitações, armadilhas, decisões descartadas e aprendizados obtidos durante o desenvolvimento do projeto.

Seu principal objetivo é evitar que os mesmos erros sejam repetidos futuramente.

Este documento funciona como uma base de conhecimento técnica permanente.

Sempre consulte este documento antes de propor mudanças importantes na arquitetura ou na implementação.

---

# Como utilizar

Sempre que um problema relevante for encontrado, registre:

- o problema;
- o contexto;
- a causa;
- a solução adotada;
- a decisão final;
- observações importantes.

Nunca apagar problemas antigos.

Caso um problema deixe de existir, marque-o como resolvido.

---

# Estrutura

Cada problema deverá utilizar o seguinte formato.

```text
## PROBLEMA-XXX

Status

Categoria

Descrição

Contexto

Causa

Solução

Decisão

Observações
```

---

# Problemas Registrados

## PROBLEMA-001

**Status**

Resolvido

**Categoria**

Arquitetura

### Título

Utilização do endpoint `/chromium/function`.

### Descrição

Inicialmente foi tentado utilizar o endpoint `/chromium/function` do Browserless diretamente a partir do n8n para executar código JavaScript responsável pela navegação.

Durante os testes surgiram diferentes erros relacionados ao formato da função enviada e à forma como o Browserless interpretava o código.

### Contexto

Foram realizados diversos testes utilizando diferentes formatos de código.

Ocorreram erros como:

- Authorization failed
- Unexpected token
- module is not defined
- code is not a function

### Causa

A abordagem baseada em execução dinâmica via endpoint REST tornou o fluxo mais complexo e mais difícil de manter.

Além disso, limitava futuras evoluções do projeto.

### Solução

Abandonar completamente esta arquitetura.

Criar um microserviço próprio utilizando Playwright conectado via CDP.

### Decisão

Nunca utilizar `/chromium/function` neste projeto.

Toda navegação deverá ocorrer através do BrowserManager.

---

## PROBLEMA-002

**Status**

Resolvido

**Categoria**

Arquitetura

### Título

Comunicação com Browserless.

### Descrição

Foi avaliada a utilização da API REST do Browserless.

### Solução

Utilizar exclusivamente CDP (Chrome DevTools Protocol).

### Decisão

Playwright conectado via CDP passa a ser a arquitetura oficial.

---

## PROBLEMA-003

**Status**

Resolvido

**Categoria**

Ambiente

### Título

Versão do Node.js.

### Descrição

O projeto foi iniciado utilizando Node.js 18.

Algumas dependências apresentaram incompatibilidade.

### Solução

Atualização para Node.js 22 LTS.

### Decisão

A versão mínima do projeto passa a ser:

Node.js 22.

---

# Limitações conhecidas

Neste momento o projeto possui as seguintes limitações.

- Apenas arquitetura definida.
- API ainda não implementada.
- BrowserManager ainda não implementado.
- Cache ainda não implementado.
- Pool de páginas ainda não implementado.
- Login persistente ainda não implementado.

Estas limitações serão removidas gradualmente durante o desenvolvimento.

---

# Lições Aprendidas

Durante o desenvolvimento algumas lições importantes foram registradas.

## Browserless

A utilização via CDP oferece maior controle, maior flexibilidade e melhor integração com Playwright.

---

## Arquitetura

Separar responsabilidades desde o início reduz significativamente a complexidade futura.

---

## Documentação

A documentação deve evoluir junto com o código.

Nunca deixar documentação para depois.

---

## Contexto

Perda de contexto entre conversas gera retrabalho.

A Project Knowledge Base elimina esse problema.

---

# Regras Permanentes

As seguintes decisões passam a ser consideradas permanentes.

## Browserless

Utilizar Browserless compartilhado.

---

## Comunicação

Utilizar Playwright via CDP.

---

## Browser

Sempre persistente.

---

## BrowserContext

Sempre persistente.

---

## Page

Uma nova Page por requisição.

---

## Node.js

Versão mínima:

22 LTS.

---

## Documentação

Toda decisão importante deve ser documentada.

---

# Como registrar um novo problema

Sempre utilizar este modelo.

```text
## PROBLEMA-XXX

Status:

Categoria:

Título:

Descrição:

Contexto:

Causa:

Solução:

Decisão:

Observações:
```

---

# Objetivo Final

Este documento deve se tornar a memória técnica permanente do projeto.

Sempre que surgir um novo problema, uma nova limitação, uma nova descoberta ou uma decisão importante, ela deverá ser registrada aqui para evitar repetição de erros e preservar o conhecimento acumulado ao longo do desenvolvimento.
