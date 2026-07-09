# ⚙️ Desenvolvimento

# Objetivo

Este documento define os padrões oficiais de desenvolvimento do projeto **URL Normalizer**.

Todo código produzido deve seguir rigorosamente estas diretrizes.

O objetivo é garantir consistência, qualidade, facilidade de manutenção e escalabilidade.

---

# Filosofia

O projeto deve ser desenvolvido como um software de produção.

Nunca como um conjunto de scripts.

Sempre priorizar:

- simplicidade;
- clareza;
- modularidade;
- reutilização;
- segurança;
- desempenho;
- documentação.

---

# Linguagem oficial

Todo o projeto será desenvolvido utilizando:

- TypeScript

Não utilizar JavaScript.

---

# Runtime

Node.js

Versão mínima:

22 LTS

---

# Framework HTTP

Fastify

Motivos:

- alta performance;
- baixo consumo de memória;
- arquitetura simples;
- excelente suporte ao TypeScript.

---

# Navegação

Playwright

Conectado ao Browserless utilizando CDP.

Nunca iniciar Chromium localmente.

---

# Organização do projeto

Estrutura oficial.

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

# Responsabilidade de cada pasta

## browser/

Toda comunicação com Browserless.

Nunca implementar regras de negócio.

---

## config/

Variáveis de ambiente.

Inicialização.

Configuração.

---

## routes/

Receber requisições.

Validar entrada.

Chamar serviços.

Nunca implementar lógica de negócio.

---

## services/

Toda regra de negócio.

Toda inteligência do sistema.

---

## marketplaces/

Cada marketplace possui sua própria implementação.

Exemplo.

amazon.ts

mercadolivre.ts

shopee.ts

generic.ts

Nunca misturar regras de marketplaces diferentes.

---

## utils/

Funções auxiliares reutilizáveis.

Nunca colocar regra de negócio.

---

## types/

Tipos compartilhados.

Interfaces.

Enums.

---

# Princípios SOLID

Todo código deve respeitar SOLID.

Sempre que possível.

---

# Single Responsibility

Cada classe.

Cada função.

Cada módulo.

Possui apenas uma responsabilidade.

---

# Open/Closed

Sempre permitir extensão.

Nunca depender de alteração constante.

---

# Baixo acoplamento

Os módulos devem conhecer o mínimo possível uns dos outros.

---

# Alta coesão

Cada módulo deve conter apenas responsabilidades relacionadas.

---

# Funções

Toda função deve ser:

- pequena;
- simples;
- previsível.

Evitar funções enormes.

---

# Métodos

Sempre utilizar nomes claros.

Exemplo.

```
normalizeUrl()

extractMarketplace()

extractProductId()

createBrowserPage()

closeBrowserPage()
```

Evitar nomes genéricos.

---

# Variáveis

Sempre utilizar nomes descritivos.

Ruim.

```
x

data

temp
```

Bom.

```
normalizedUrl

marketplace

productId

browserContext
```

---

# Tipagem

Todo código deve ser fortemente tipado.

Nunca utilizar:

```
any
```

Exceto quando realmente inevitável.

---

# Tratamento de erros

Toda exceção deve ser tratada.

Nunca deixar erros silenciosos.

Sempre informar:

- causa;
- contexto;
- operação executada.

---

# Logs

Todos os logs devem utilizar Pino.

Nunca utilizar:

```
console.log
```

Em produção.

Sempre registrar:

- início;
- fim;
- duração;
- erro;
- marketplace;
- URL.

---

# Validação

Toda entrada deve ser validada.

Utilizar:

Zod.

Nunca confiar em dados externos.

---

# Comentários

Evitar comentários desnecessários.

O código deve ser autoexplicativo.

Comentar apenas:

- regras complexas;
- decisões importantes;
- limitações.

---

# Código limpo

Sempre seguir princípios de Clean Code.

Evitar:

- duplicação;
- funções enormes;
- lógica espalhada.

---

# Reutilização

Nunca copiar código.

Sempre extrair responsabilidades.

---

# Estrutura dos serviços

Exemplo.

```
NormalizeService

↓

AmazonService

↓

BrowserManager
```

Cada serviço conhece apenas o necessário.

---

# BrowserManager

Todo acesso ao Browserless passa por ele.

Nunca acessar Browserless diretamente.

---

# BrowserContext

Sempre reutilizado.

Nunca criar BrowserContext por requisição.

---

# Pages

Cada requisição cria apenas uma nova Page.

Após terminar.

Fechar apenas a Page.

---

# Cache

Sempre verificar cache antes de acessar Browserless.

Quando implementado.

---

# Segurança

Sempre validar:

entrada;

saída;

timeout;

erros.

Nunca confiar em URLs externas.

---

# Performance

Sempre buscar:

menos memória;

menos CPU;

menos requisições;

mais cache;

mais reutilização.

---

# Testes

Toda funcionalidade importante deverá possuir testes.

Sempre que possível.

---

# Documentação

Toda mudança relevante deve atualizar:

Arquitetura

API

Problemas conhecidos

Atualizações

Contexto Atual

Quando necessário.

---

# Commits

Sempre utilizar mensagens claras.

Exemplo.

```
feat: implement BrowserManager

fix: resolve amazon redirects

refactor: improve marketplace detection

docs: update architecture
```

---

# Revisão

Antes de considerar uma implementação concluída, verificar:

✔ Código limpo

✔ Tipagem

✔ Performance

✔ Segurança

✔ Documentação

✔ Logs

✔ Tratamento de erros

✔ Escalabilidade

---

# Regra principal

O objetivo deste projeto não é apenas funcionar.

O objetivo é permanecer simples, organizado e fácil de evoluir durante muitos anos.

Toda implementação futura deve seguir este documento.
