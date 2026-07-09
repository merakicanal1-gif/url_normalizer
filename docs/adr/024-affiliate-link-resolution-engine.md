# ADR-024 — Affiliate Link Resolution Engine

## Status
Aprovada

## Data
2026-07-06

## Contexto
O principal caso de uso do **URL Normalizer** em ambientes reais consiste no processamento de links curtos de afiliados (ex: `amzn.to`, `link.amazon`, `meli.la`, `s.shopee.com.br`) gerados em canais do Telegram, bots de chat e automações. 

A abordagem anterior dependia do Playwright para seguir todos os redirecionamentos de rede, o que trazia sobrecarga de processamento, desperdício de memória e alta latência devido ao uso de um navegador CDP. 

## Decisão
Decidimos implementar um mecanismo especializado de resolução de redirecionamentos HTTP leves baseado nos padrões **Strategy** e **Chain of Responsibility**, orquestrado pelo `CompositeUrlResolver`.

### Diretrizes de Design
1. **Centralização de Hostnames (`MarketplaceHostRegistry`)**: Todos os hostnames e encurtadores conhecidos são centralizados neste registro de domínio. Nenhum resolvedor possui strings de host soltas no código.
2. **Resolvedores Especializados**:
   - `AmazonAffiliateResolver` (processa `amzn.to` e `link.amazon`)
   - `MercadoLivreAffiliateResolver` (processa `meli.la`)
   - `ShopeeAffiliateResolver` (processa `s.shopee.com.br`)
   - `GenericRedirectResolver` (encurtadores genéricos que não pertencem ao registry)
   - `PlaywrightUrlResolver` (último fallback)
3. **Desacoplamento e Independência**: Nenhum resolvedor conhece outro resolvedor ou gerencia fallbacks. A decisão de avançar na cadeia (via resultado `outcome: 'CONTINUE'`) ou abortar (via `outcome: 'STOP'`) é exclusivamente do `CompositeUrlResolver`.
4. **Metadados de Resolução (`ResolutionMetadata`)**: A telemetria foi unificada no DTO `ResolvedUrl` contendo estatísticas de redirects, estratégia usada, tempo e uso de browser.
5. **Navegação Direta no Core (`NormalizeService`)**: Se a URL for resolvida via HTTP (sem navegador), o `NormalizeService` abre a página do Playwright **diretamente** na URL final resolvida para que o plugin execute a extração do DOM, evitando navegar na cadeia de redirecionamentos no browser.

## Diagrama da Arquitetura de Resolução

```
                         [ URL Original ]
                                │
                                ▼
                       [ NormalizeService ]
                                │
                     1. resolve()
                                ▼
         ┌──────────────────────────────────────────────┐
         │             CompositeUrlResolver             │
         │ - Varre a lista ordenada de resolvedores     │
         │ - Executa canResolve() -> true               │
         └──────────────────────┬───────────────────────┘
                                │
                                ├─► [ AmazonAffiliateResolver ]       ─┐
                                │                                      │
                                ├─► [ MercadoLivreAffiliateResolver ]  ├─► Tenta HTTP leve (HEAD/GET)
                                │                                      │   Retorna CONTINUE se falhar.
                                ├─► [ ShopeeAffiliateResolver ]        ─┘
                                │
                                ├─► [ GenericRedirectResolver ]  ──► HTTP para hosts externos
                                │
                                └─► [ PlaywrightUrlResolver ]    ──► Fallback de Navegador (CDP)
                                
```

## Consequências

### Positivas
* **Performance e Latência**: Redução drástica do uso de CPU e memória, pois mais de 90% dos links de afiliados são resolvidos por requisições HTTP leves que levam milissegundos.
* **Escalabilidade**: Novas estratégias de resolução (como APIs de resolvedores móveis ou de terceiros) podem ser acopladas no array do `CompositeUrlResolver` sem alterar o `NormalizeService` ou os plugins.
* **Isolamento de Erros**: O resolvedor HTTP não crasha a API e falha graciosamente passando o fluxo de volta para o orquestrador.

### Negativas
* **Duplo Fetch em Casos Felizes**: Para extrair metadados do DOM, o navegador é aberto na URL final, resultando em uma requisição HTTP inicial para resolução + uma carga do DOM no Playwright. No entanto, este custo é amortizado pela economia de CPU ao evitar redirects no browser.
