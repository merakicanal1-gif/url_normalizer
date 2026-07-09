# 🌐 API

# Objetivo

Este documento define o contrato oficial da API do projeto **URL Normalizer**.

Toda aplicação que consumir este serviço deverá seguir exatamente as especificações descritas neste documento.

A API foi projetada para ser:

- simples;
- consistente;
- previsível;
- escalável;
- independente da implementação interna.

---

# Filosofia

A API nunca deve expor detalhes internos do sistema.

Ela deve fornecer uma interface limpa e estável.

Toda resposta deve seguir o mesmo padrão.

---

# URL Base

Durante desenvolvimento

```
http://localhost:3000
```

Produção

```
https://url-normalizer.seudominio.com
```

---

# Versionamento

A API deverá ser versionada.

Exemplo.

```
/api/v1
```

No futuro.

```
/api/v2
```

---

# Content-Type

Todas as requisições deverão utilizar

```
application/json
```

---

# Formato padrão de resposta

Toda resposta da API deverá seguir esta estrutura.

## Sucesso

```json
{
    "success": true,
    "data": {}
}
```

---

## Erro

```json
{
    "success": false,
    "error": {
        "code": "INVALID_URL",
        "message": "URL inválida."
    }
}
```

Nunca retornar erros em formatos diferentes.

---

# Códigos HTTP

## 200

Sucesso.

---

## 400

Requisição inválida.

---

## 404

Recurso não encontrado.

---

## 422

Erro de validação.

---

## 429

Limite de requisições.

---

## 500

Erro interno.

---

# Endpoint

## POST /api/v1/normalize

Responsável por normalizar qualquer URL de marketplace.

---

## Entrada

```json
{
    "url": "https://amzn.to/xxxxx"
}
```

---

## Fluxo interno

Recebe URL

↓

Valida

↓

Abre Page

↓

Segue redirects

↓

Identifica marketplace

↓

Extrai ID

↓

Gera URL canônica

↓

Retorna resposta

---

# Resposta

```json
{
    "success": true,
    "data": {
        "marketplace": "amazon",
        "url_original": "https://amzn.to/abc123",
        "url_final": "https://www.amazon.com.br/dp/B0XXXXXXX",
        "url_canonica": "https://www.amazon.com.br/dp/B0XXXXXXX",
        "product_id": "B0XXXXXXX"
    }
}
```

---

# Campos

## marketplace

Marketplace identificado.

Exemplos.

```
amazon

mercadolivre

shopee

magalu

kabum

generic
```

---

## url_original

URL recebida pela API.

---

## url_final

Última URL após todos os redirecionamentos.

---

## url_canonica

URL padronizada.

Sem parâmetros desnecessários.

---

## product_id

Identificador único do produto.

Exemplo.

Amazon

```
B0XXXXXXX
```

Mercado Livre

```
MLB123456789
```

Shopee

```
shopid/itemid
```

---

# Validação

Toda entrada será validada utilizando Zod.

Exemplo.

URL obrigatória.

URL válida.

URL absoluta.

---

# Timeouts

A API deverá utilizar timeout.

Exemplo.

```
30 segundos
```

Caso exceda.

Retornar erro.

---

# Tratamento de erros

Todos os erros deverão possuir.

Código.

Mensagem.

Contexto.

---

# Erros conhecidos

## INVALID_URL

A URL enviada é inválida.

---

## UNSUPPORTED_MARKETPLACE

Marketplace não suportado.

---

## TIMEOUT

Tempo máximo excedido.

---

## BROWSER_ERROR

Erro ao acessar Browserless.

---

## NAVIGATION_ERROR

Erro durante navegação.

---

## PRODUCT_NOT_FOUND

Produto não encontrado.

---

# Logs

Toda requisição deverá registrar.

- URL original
- marketplace
- tempo total
- sucesso
- erro
- duração

---

# Performance

A API deverá reutilizar.

Browser

BrowserContext

Criando apenas novas Pages.

---

# Segurança

Nunca confiar na URL recebida.

Sempre validar.

Sempre tratar exceções.

Nunca retornar detalhes internos da aplicação.

---

# Autenticação

Inicialmente a API será utilizada apenas internamente.

No futuro poderá ser adicionada autenticação via:

- API Key
- JWT
- OAuth

Sem alterar os contratos existentes.

---

# Compatibilidade

A API deverá manter compatibilidade entre versões.

Mudanças incompatíveis deverão gerar uma nova versão da API.

---

# Roadmap da API

Versão 1

- Normalize

Versão 2

- Metadata

Versão 3

- Screenshot

Versão 4

- Price

Versão 5

- Reviews

Versão 6

- Availability

---

# Objetivo final

A API deverá se tornar uma interface única e padronizada para acesso inteligente a URLs de marketplaces, abstraindo completamente a complexidade de navegação, redirecionamentos e identificação de produtos.
