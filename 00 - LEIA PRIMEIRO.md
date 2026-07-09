
# 📘 LEIA PRIMEIRO

> **IMPORTANTE**
>
> Este diretório representa a **fonte oficial da verdade** (Single Source of Truth) do projeto **URL Normalizer**.
>
> Todas as decisões arquiteturais, técnicas, funcionais e organizacionais devem ser baseadas exclusivamente nesta documentação.
>
> O objetivo desta estrutura é evitar perda de contexto entre conversas, manter a consistência do projeto e permitir que qualquer GPT especializado continue exatamente do ponto onde o desenvolvimento parou.

---

# Objetivo desta documentação

Esta documentação foi criada para servir como uma **Base de Conhecimento Permanente (Project Knowledge Base - PKB)** do projeto.

Ela possui quatro objetivos principais:

- Preservar todo o conhecimento do projeto.
- Evitar que decisões sejam perdidas entre conversas.
- Permitir que um GPT continue exatamente do ponto onde o desenvolvimento parou.
- Centralizar toda a documentação técnica em um único local.

Esta documentação deve ser considerada a principal referência do projeto.

---

# Como utilizar esta documentação

Sempre que um novo chat for iniciado, ou um novo GPT precisar entender o projeto, siga exatamente a ordem abaixo.

Nunca pule etapas.

---

# Ordem obrigatória de leitura

## 1️⃣ 09 - CONTEXTO ATUAL.md

Este é sempre o primeiro arquivo.

Ele informa:

- Estado atual do projeto.
- Em qual etapa o desenvolvimento se encontra.
- Qual foi a última decisão importante.
- Qual a próxima tarefa.
- Qual atualização deve ser considerada.

Este arquivo representa a situação atual do projeto.

Sempre considere este arquivo como a principal referência do estado atual.

---

## 2️⃣ 08 - Atualizações.md

Depois leia apenas a atualização mais recente.

As atualizações estão organizadas da mais recente para a mais antiga.

Sempre considere apenas a primeira atualização como referência principal.

As demais servem apenas como histórico.

Caso seja necessário entender decisões antigas, consulte as atualizações anteriores.

---

## 3️⃣ 03 - Arquitetura.md

Após entender o estado atual, leia a arquitetura.

Este arquivo define:

- arquitetura do sistema;
- componentes;
- responsabilidades;
- fluxo interno;
- decisões estruturais.

Nenhuma implementação deve contradizer este documento.

---

## 4️⃣ 04 - Desenvolvimento.md

Este documento define:

- padrões de código;
- organização do projeto;
- estrutura de pastas;
- convenções;
- boas práticas;
- metodologia de desenvolvimento.

Todo código produzido deve seguir este documento.

---

## 5️⃣ 05 - API.md

Caso a tarefa envolva endpoints, contratos ou integração entre serviços, consulte este documento.

Ele define toda a API do projeto.

---

## 6️⃣ Demais documentos

Os demais documentos são utilizados como referência permanente.

Consulte-os apenas quando forem necessários para a tarefa em execução.

---

# Como interpretar as atualizações

As atualizações representam um histórico completo da evolução do projeto.

Cada atualização registra:

- o que foi discutido;
- quais decisões foram tomadas;
- quais problemas surgiram;
- quais problemas foram resolvidos;
- o estado final daquela conversa.

As atualizações nunca substituem a arquitetura.

Elas apenas registram a evolução do projeto.

---

# Atualização do projeto

Ao final de uma conversa relevante, a documentação deverá ser atualizada.

Sempre identifique quais arquivos precisam ser modificados.

Normalmente apenas estes arquivos precisam ser alterados:

- 08 - Atualizações.md
- 09 - CONTEXTO ATUAL.md

Caso alguma decisão permanente seja alterada, também atualize o documento correspondente.

Por exemplo:

- Arquitetura
- API
- Desenvolvimento
- Problemas Conhecidos
- Changelog

---

# Regras obrigatórias

Durante todo o desenvolvimento, estas regras devem ser respeitadas.

## Nunca

- Reiniciar discussões já encerradas sem justificativa técnica.
- Ignorar decisões arquiteturais aprovadas.
- Criar soluções incompatíveis com a arquitetura existente.
- Alterar tecnologias principais sem justificar tecnicamente.
- Gerar código que contradiga esta documentação.

---

## Sempre

- Preservar o histórico.
- Respeitar a arquitetura.
- Explicar decisões técnicas importantes.
- Propor melhorias quando fizer sentido.
- Pensar como um Arquiteto de Software Sênior.
- Priorizar simplicidade, escalabilidade e manutenção.

---

# Filosofia do projeto

Este projeto não é apenas um conjunto de arquivos.

Ele representa um produto em evolução contínua.

Toda decisão deve considerar:

- manutenção futura;
- desempenho;
- segurança;
- escalabilidade;
- reutilização;
- clareza da documentação;
- facilidade de evolução.

Sempre prefira soluções profissionais, limpas e escaláveis.

---

# Objetivo final

Ao utilizar corretamente esta documentação, qualquer GPT deverá ser capaz de:

- compreender rapidamente o projeto;
- continuar exatamente do ponto onde o desenvolvimento parou;
- preservar todas as decisões anteriores;
- evitar perda de contexto;
- produzir código consistente;
- atuar como Arquiteto Principal do projeto.

Esta documentação deve evoluir continuamente junto com o sistema e sempre representar o estado mais fiel do projeto.
