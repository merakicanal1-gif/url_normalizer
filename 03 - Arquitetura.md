# 🏛️ Arquitetura

# Objetivo

Este documento descreve toda a arquitetura oficial do projeto **URL Normalizer**.

Todas as implementações devem seguir esta arquitetura.

Caso alguma mudança estrutural seja necessária, este documento deverá ser atualizado antes da implementação.

---

# Objetivo da arquitetura

A arquitetura foi projetada para atender aos seguintes requisitos:

- alta escalabilidade;
- baixo consumo de memória;
- baixo consumo de CPU;
- alta reutilização;
- facilidade de manutenção;
- baixo acoplamento;
- alta coesão;
- fácil evolução.

---

# Arquitetura Geral

```
Cliente

↓

n8n

↓

URL Normalizer API

↓

BrowserManager

↓

Browserless (CDP)

↓

Marketplace
```

---

# Componentes

O sistema é composto pelos seguintes componentes.

## Cliente

Pode ser qualquer aplicação.

Exemplos:

- n8n
- API
- Sistema Web
- Outro microserviço

O cliente nunca acessa diretamente o Browserless.

Toda comunicação passa pela API.

---

## URL Normalizer API

É o núcleo do projeto.

Responsabilidades:

- receber requisições;
- validar dados;
- controlar fluxo;
- chamar os serviços internos;
- retornar respostas padronizadas.

A API não deve conter regras de negócio.

Ela apenas orquestra.

---

## BrowserManager

É o componente mais importante do sistema.

Sua responsabilidade é controlar toda a comunicação com o Browserless.

Ele será responsável por:

- abrir conexão;
- manter conexão;
- reutilizar Browser;
- reutilizar BrowserContext;
- criar novas Pages;
- controlar concorrência;
- controlar tempo de vida;
- recuperar falhas.

Todo acesso ao Browserless deve passar por este componente.

---

## Browserless

O Browserless será compartilhado entre todos os serviços.

Nunca será iniciado um Chromium próprio.

A arquitetura oficial utiliza Browserless remoto.

Comunicação:

Playwright

↓

Chrome DevTools Protocol (CDP)

Nunca utilizar REST quando CDP resolver melhor o problema.

---

## Marketplace

Representa qualquer site externo.

Exemplos:

Amazon

Mercado Livre

Shopee

Magalu

Kabum

AliExpress

etc.

---

# Fluxo completo

Uma requisição seguirá exatamente este fluxo.

```
Cliente

↓

POST /normalize

↓

Fastify

↓

NormalizeService

↓

BrowserManager

↓

Browserless

↓

Marketplace

↓

Browserless

↓

NormalizeService

↓

Fastify

↓

Cliente
```

---

# Browser

A arquitetura utiliza apenas um Browser.

```
Browser

├── Context
│
├── Context
│
└── Context
```

Sempre reutilizado.

Nunca abrir um Browser por requisição.

---

# BrowserContext

Cada Browser possui um BrowserContext persistente.

Este contexto armazena:

- cookies;
- permissões;
- localStorage;
- sessionStorage;
- preferências;
- autenticação.

Ele permanece vivo durante toda a execução do serviço.

---

# Pages

Cada requisição cria apenas uma nova Page.

```
Nova requisição

↓

Nova Page

↓

Processamento

↓

Fecha Page
```

Nunca fechar Browser.

Nunca fechar Context.

---

# Pool de Pages

No futuro será implementado um Pool.

Exemplo.

```
Browser

↓

Context

↓

Page 1

Page 2

Page 3

Page 4

...
```

Permitindo processamento paralelo.

---

# Cache

A arquitetura prevê cache.

Fluxo.

```
Recebe URL

↓

Existe cache?

↓

SIM

↓

Retorna imediatamente.

↓

NÃO

↓

Abre Browser

↓

Resolve URL

↓

Salva cache

↓

Retorna
```

---

# Marketplaces

Cada marketplace será um módulo independente.

Exemplo.

```
marketplaces/

amazon.ts

mercadolivre.ts

shopee.ts

magalu.ts

kabum.ts

generic.ts
```

Cada módulo possui apenas uma responsabilidade.

---

# Estrutura interna

```
src/

browser/

config/

routes/

services/

marketplaces/

utils/

types/
```

---

# Responsabilidades

## Routes

Recebem requisições.

Nunca implementam regras de negócio.

---

## Services

Contêm toda lógica do sistema.

---

## Browser

Toda comunicação com Browserless.

---

## Utils

Funções auxiliares.

---

## Types

Tipos compartilhados.

---

## Config

Variáveis.

Inicialização.

Configuração.

---

# Concorrência

O sistema deverá suportar múltiplas requisições simultaneamente.

Sempre reutilizando:

Browser

Context

Criando apenas novas Pages.

---

# Escalabilidade

A arquitetura foi projetada para crescer.

Novos marketplaces deverão ser adicionados sem alterar os existentes.

Novos serviços deverão ser adicionados sem modificar a API principal.

---

# Segurança

Toda entrada deverá ser validada.

Nunca confiar em dados externos.

Toda exceção deverá ser tratada.

Nenhuma falha poderá derrubar o serviço.

---

# Observabilidade

Todo componente deverá gerar logs.

Logs deverão informar:

- início;
- fim;
- erros;
- duração;
- marketplace;
- URL.

---

# Performance

Sempre priorizar:

- reutilização de Browser;
- reutilização de Context;
- poucas inicializações;
- poucas conexões;
- pouco consumo de memória.

---

# Decisões Arquiteturais

As seguintes decisões são permanentes.

## Browserless compartilhado

Status:

Aprovado

Motivo:

Economia de recursos.

---

## Comunicação via CDP

Status:

Aprovado

Motivo:

Maior controle.

Maior desempenho.

Maior flexibilidade.

---

## Browser persistente

Status:

Aprovado

---

## BrowserContext persistente

Status:

Aprovado

---

## Nova Page por requisição

Status:

Aprovado

---

## API REST própria

Status:

Aprovado

---

# Arquitetura futura

No futuro poderão ser adicionados:

- Redis;
- fila;
- métricas;
- Prometheus;
- cache distribuído;
- múltiplos Browserless;
- balanceamento;
- workers.

Sem alterar a arquitetura principal.

---

# Regra principal

Toda implementação futura deverá respeitar esta arquitetura.

Caso alguma decisão estrutural seja alterada, este documento deverá ser atualizado antes da implementação.
