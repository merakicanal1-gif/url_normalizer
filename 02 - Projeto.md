# 📖 Projeto

# Nome do Projeto

**URL Normalizer**

---

# Visão

O URL Normalizer é um microserviço desenvolvido para transformar URLs de produtos em URLs canônicas, padronizadas e confiáveis, independentemente do marketplace ou do formato original do link.

Seu objetivo é eliminar completamente a complexidade de trabalhar com links provenientes de diferentes fontes, principalmente links de afiliados, links encurtados, links de campanhas e URLs com parâmetros desnecessários.

O sistema atua como uma camada intermediária entre aplicações consumidoras (como n8n) e os marketplaces, fornecendo uma interface única, consistente e altamente confiável para obtenção de informações dos produtos.

---

# Missão

Construir o melhor serviço possível para normalização de URLs de marketplaces.

O projeto deve ser:

- rápido;
- seguro;
- escalável;
- reutilizável;
- altamente documentado;
- preparado para produção.

O objetivo não é apenas limpar URLs.

O objetivo é criar uma plataforma inteligente para interpretação de produtos em marketplaces.

---

# Problema que o projeto resolve

Atualmente diferentes marketplaces utilizam formatos distintos de URLs.

Além disso existem:

- links de afiliados;
- links encurtados;
- redirecionamentos;
- parâmetros de rastreamento;
- parâmetros de marketing;
- campanhas;
- cupons;
- URLs inválidas;
- URLs parcialmente quebradas.

Isso dificulta:

- identificar corretamente o marketplace;
- descobrir o verdadeiro ID do produto;
- comparar produtos;
- evitar duplicações;
- automatizar processos.

O URL Normalizer existe para resolver completamente esse problema.

---

# Objetivos

Os principais objetivos do projeto são:

- normalizar qualquer URL de marketplace;
- seguir automaticamente redirecionamentos;
- remover parâmetros desnecessários;
- identificar o marketplace;
- gerar uma URL canônica;
- extrair o identificador único do produto;
- fornecer uma API simples para integração;
- servir como base para enriquecimento futuro dos dados.

---

# Objetivos de longo prazo

No futuro o sistema deverá ser capaz de:

- identificar automaticamente o marketplace;
- extrair título;
- extrair imagem;
- extrair preço;
- extrair vendedor;
- extrair avaliações;
- identificar disponibilidade;
- identificar variações do produto;
- identificar promoções;
- identificar cupons.

---

# Público-alvo

Inicialmente o projeto foi desenvolvido para uso interno.

O principal consumidor da API será o n8n.

No futuro o projeto poderá atender:

- APIs externas;
- aplicações web;
- aplicativos móveis;
- sistemas internos;
- outros microserviços.

---

# Escopo inicial

A primeira versão do projeto terá apenas um objetivo.

Receber uma URL.

Retornar uma URL canônica.

Nada além disso.

Posteriormente novas funcionalidades serão adicionadas gradualmente.

---

# Escopo futuro

O projeto deverá evoluir para suportar:

Amazon

Mercado Livre

Shopee

Magalu

Kabum

AliExpress

Casas Bahia

Ponto

Americanas

e outros marketplaces.

---

# Filosofia

O projeto deve sempre priorizar:

simplicidade;

modularidade;

escalabilidade;

performance;

segurança;

baixo acoplamento;

alta reutilização;

documentação completa.

---

# Arquitetura Geral

A arquitetura oficial aprovada é:

n8n

↓

URL Normalizer

↓

Browserless

↓

Marketplace

O Browserless será compartilhado entre múltiplos serviços.

A comunicação será realizada através do protocolo CDP utilizando Playwright.

---

# Tecnologias aprovadas

Node.js 22

TypeScript

Fastify

Playwright

Browserless

Docker

Zod

Pino

---

# Princípios do projeto

Todo o desenvolvimento deverá respeitar os seguintes princípios.

## Código limpo

Todo código deve ser fácil de compreender.

---

## Modularidade

Cada módulo possui apenas uma responsabilidade.

---

## Reutilização

Evitar duplicação.

---

## Escalabilidade

Toda arquitetura deve considerar crescimento futuro.

---

## Segurança

Nunca confiar em entrada externa.

---

## Performance

Sempre buscar o menor consumo possível de recursos.

---

## Observabilidade

Logs devem ser claros.

Erros devem ser rastreáveis.

---

## Documentação

A documentação faz parte do software.

Ela deve evoluir junto com o código.

---

# Estado atual

Neste momento o projeto encontra-se na fase inicial de implementação.

Já foi decidido:

✔ Utilizar Browserless compartilhado.

✔ Utilizar Playwright conectado via CDP.

✔ Browser persistente.

✔ BrowserContext persistente.

✔ Uma nova Page por requisição.

✔ API REST própria.

---

# Visão de longo prazo

O URL Normalizer deverá tornar-se um microserviço independente, reutilizável e altamente escalável.

Sua função será centralizar toda a inteligência relacionada à interpretação de URLs de marketplaces.

Todas as aplicações do ecossistema deverão consumir este serviço ao invés de acessar diretamente os marketplaces.

---

# Definição de sucesso

O projeto será considerado bem-sucedido quando for capaz de:

- normalizar milhares de URLs diariamente;
- reutilizar eficientemente o Browserless;
- suportar múltiplos marketplaces;
- fornecer respostas rápidas;
- manter alta confiabilidade;
- servir como base para futuras funcionalidades de enriquecimento de dados.

---

# Objetivo final

Construir um serviço profissional, modular e escalável que se torne a referência central para tratamento de URLs de marketplaces em todo o ecossistema do projeto.
