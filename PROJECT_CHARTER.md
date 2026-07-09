# Project Charter - URL Normalizer

## 1. Missão do Projeto
A missão do **URL Normalizer** é construir uma API REST especializada e de alto desempenho responsável exclusivamente por normalizar URLs de produtos de marketplaces (ex. Amazon, Mercado Livre, Shopee, Magalu, Kabum). O sistema atua como o tradutor universal de links no ecossistema, convertendo URLs complexas, poluídas por parâmetros de rastreamento, encurtadas ou com formatos de afiliados em URLs canônicas limpas, estáveis e padronizadas.

---

## 2. Visão de Longo Prazo
O URL Normalizer será a **Única Fonte da Verdade (Single Source of Truth - SSOT)** do ecossistema para a identificação, de-duplicação e normalização de produtos de marketplaces. 

No longo prazo, o sistema evoluirá de forma modular e baseada em plugins para fornecer o enriquecimento polimórfico de metadados dos produtos (como preços, imagens, avaliações, disponibilidade e variações), centralizando toda a inteligência de interação com marketplaces externos e blindando os serviços consumidores (como fluxos de automação n8n) da complexidade operacional de scraping e automação de navegadores.

---

## 3. Objetivos Estratégicos
* **Abstração Operacional**: Isolar completamente as regras de redirecionamento, cookies, sessões e variações estruturais de páginas de marketplaces fora do domínio das aplicações consumidoras.
* **Unicidade e Consistência**: Garantir que um mesmo produto físico, independentemente da URL compartilhada (afiliado, encurtado, parametrizado), seja mapeado para a mesma URL canônica e ID de produto (`product_id`) únicos.
* **Extensibilidade e Desacoplamento**: Adotar uma arquitetura de plugins desacoplada e aderente ao princípio Open/Closed, na qual o suporte a novos marketplaces possa ser implementado de forma independente sem alteração no núcleo do sistema.
* **Eficiência de Infraestrutura**: Maximizar o aproveitamento dos recursos do Browserless remoto através do reuso inteligente de navegadores e contextos, reduzindo o overhead computacional e os tempos de resposta sob concorrência.

---

## 4. Problemas que o Projeto Resolve
* **Redirecionamentos Sucessivos**: URLs encurtadas (ex: `amzn.to/xxxx`) ou de campanhas que exigem múltiplos saltos de redirecionamento HTTP/JS antes de atingir o destino final.
* **Query Parameters de Rastreamento**: Parâmetros de marketing (`utm_*`), códigos de parceiros/afiliados, cupons temporários e identificadores de sessão que poluem as URLs e geram duplicidades de registros.
* **Heterogeneidade de Identificadores**: Diversidade de padrões de identificação de produtos adotados por diferentes marketplaces (ex: ASIN na Amazon, MLB no Mercado Livre, ID de Loja/Item na Shopee), unificando-os em uma extração consistente.
* **Instabilidade de Web Scraping Direto**: Alterações frequentes na estrutura interna dos sites de marketplaces que quebram integrações diretas de scrapers tradicionais.

---

## 5. Problemas que o Projeto NUNCA Resolverá
* **Crawling Genérico**: O sistema não fará varreduras ou descobertas estruturadas de URLs em motores de busca ou listagens arbitrárias da internet.
* **Scraping Arbitrário**: Não será utilizado como coletor genérico de dados de páginas da web que não correspondam aos marketplaces explicitamente suportados por plugins.
* **Comparação de Preços**: O microserviço não implementará lógica de comparação de ofertas ou análise de variação de preços entre diferentes plataformas.
* **Gerenciamento de Afiliados**: Não criará links de afiliação ou controlará comissões de parceiros.
* **Sistema de Vendas ou Promoções**: Não gerenciará carrinhos de compras, fluxos de checkout, cupons promocionais ou inteligência de vendas.

---

## 6. Escopo (v1.0.0)
* **Interface HTTP REST**: Endpoint único e padronizado `POST /api/v1/normalize` para submissão de URLs.
* **Validação de Entrada**: Validação rigorosa do payload de requisição e do formato de URL utilizando schemas do Zod.
* **Resolução de Redirecionamentos**: Seguimento automático de todos os redirects de URL utilizando automação de navegador com Playwright.
* **Orquestração de Navegação Remota**: Conexão resiliente com infraestrutura de Browserless externa utilizando o protocolo CDP (Chrome DevTools Protocol).
* **Resolução Polimórfica de Marketplace**: Identificação dinâmica do plugin responsável pelo processamento com base na URL resolvida (pós-redirecionamentos).
* **Extração de URL Canônica e Product ID**: Lógica dedicada por marketplace (via plugins) para extrair o identificador único do produto e reconstruir a URL canônica limpa.
* **Fallback Genérico**: Processamento básico via `GenericMarketplacePlugin` para URLs que não correspondam a nenhum plugin de marketplace específico.
* **Resposta Padronizada**: Payload de resposta JSON contendo o status de sucesso, identificador do marketplace, URL original, URL final pós-redirecionamentos, URL canônica limpa e o ID do produto.

---

## 7. Fora do Escopo (v1.0.0)
* **Lógica Ativa de Evasão de Anti-Bot**: O microserviço não conterá lógicas locais de bypass de Cloudflare, resolução de CAPTCHAs, spoofing avançado de TLS ou rotação interna de proxies. *(Decisão ADR-001: delegada ao Browserless remoto)*.
* **Caching de Resultados**: Persistência temporária ou permanente de respostas em memória ou Redis. *(Decisão ADR-002: postergado para versões futuras)*.
* **Extração de Metadados de Produto**: Coleta de título do produto, imagens, descrição, preços ou disponibilidade (reservado para versões futuras).
* **Pool Dinâmico de Páginas**: Pré-inicialização e manutenção de um pool de páginas abertas em standby (adotada a abordagem de criar e fechar uma nova página por requisição).
* **Persistência de Login**: Lógicas de login persistente em contas de marketplaces para fins de bypass de paywalls de produtos.

---

## 8. Stakeholders
* **Equipe de Engenharia de Automação (Consumidores)**: Engenheiros que desenvolvem integrações no n8n e necessitam de uma API de normalização confiável.
* **Equipe de Desenvolvimento e Arquitetura**: Engenheiros de Software e Agentes de IA responsáveis pela manutenção, evolução e governança da base de código.
* **Equipe de Operações (Infraestrutura)**: Responsáveis pela hospedagem da API no EasyPanel utilizando Docker, bem como pelo provisionamento e saúde da instância remota de Browserless.

---

## 9. Definição de Sucesso
O projeto será considerado bem-sucedido quando atingir os seguintes critérios de aceitação:
1. **Precisão Funcional**: 100% das URLs válidas de marketplaces suportados (ex: Amazon, Mercado Livre) submetidas à API retornarem a URL canônica limpa correta e o ID do produto correspondente.
2. **Ciclo de Vida Limpo de Navegação**: Garantia de vazamento zero de recursos (Memory Leaks), garantindo que 100% das Pages Playwright abertas na instância Browserless sejam explicitamente encerradas ao término de cada processamento (incluindo em cenários de erro ou timeout).
3. **Resiliência operacional**: Capacidade de responder consistentemente respeitando o timeout padrão configurado (30 segundos), disparando tratamento elegante e classificação de erro padronizada em caso de falha de conexão ou timeout de carregamento.
4. **Isolamento de Domínio**: Sucesso na compilação e execução de testes unitários de domínio de forma totalmente agnóstica à infraestrutura HTTP (Fastify) e de Navegação (Playwright).

---

## 10. Princípios Inegociáveis (Diretrizes Arquiteturais)
* **Arquitetura Hexagonal (Ports & Adapters)**: Divisão rígida entre o núcleo da aplicação (Domínio e Serviços de Aplicação) e o mundo externo (Transporte HTTP, Automação do Browserless). O Domínio declara suas necessidades via *Ports* (interfaces) e a infraestrutura implementa essas necessidades via *Adapters*.
* **Isolamento Tecnológico do Domínio**: O Domínio nunca importa ou conhece o Playwright, o Browserless, o Fastify ou o Zod. Nenhuma regra de negócio ou contrato pode depender de implementações do framework HTTP ou do navegador.
* **Princípio Open/Closed (OCP)**: A adição de suporte a novos marketplaces deve ocorrer exclusivamente por meio da criação e registro de novos plugins autônomos. **É proibido** o uso de `switch`, `if/else` ou tabelas estáticas de Regex no serviço de orquestração central para seleção de marketplaces.
* **Resolução Polimórfica e Registro**: A escolha do marketplace responsável deve ocorrer polimorficamente. Cada plugin implementa a interface comum do contrato e expõe o método `canHandle(url: URL): boolean`. O `MarketplaceResolver` percorrerá polimorficamente a lista de plugins fornecidos pelo `MarketplaceRegistry` e executará o primeiro compatível.
* **Composição Root**: Toda a montagem e injeção de dependências do sistema deve ocorrer na inicialização do aplicativo (Composition Root), permitindo que novos plugins se registrem dinamicamente no `MarketplaceRegistry`.

---

## 11. Restrições Tecnológicas
O stack tecnológico do projeto é definitivo e aprovado para produção:
* **Linguagem**: TypeScript (configuração `strict` ativa no `tsconfig.json`, sem uso de tipos implícitos ou explicitados como `any`).
* **Runtime**: Node.js 22 LTS.
* **Framework HTTP**: Fastify.
* **Automação de Navegador**: Playwright.
* **Comunicação com Navegador**: Chrome DevTools Protocol (CDP) sobre conexão remota Browserless.
* **Validação de Schemas**: Zod.
* **Logs Estruturados**: Pino.
* **Containerização**: Docker (gerenciado via EasyPanel).
* **Controle de Versão**: Git e GitHub.

---

## 12. Critérios de Qualidade
* **Testabilidade**: A lógica do Domínio e dos plugins de marketplace deve possuir alta cobertura de testes unitários (mínimo de 80%).
* **Robustez no Tratamento de Erros**: Erros operacionais (timeout do Browserless, quedas de rede CDP, marketplaces fora do ar) devem ser interceptados pela camada de adapters de infraestrutura, convertidos em erros ricos de domínio (ex: `NavigationError`, `BrowserlessConnectionError`) e apresentados ao cliente final no formato JSON estruturado.
* **Logs de Produção**: Logs estruturados via Pino devem documentar cada etapa de ciclo de vida da requisição (início, resolução de redirecionamento, detecção de plugin, duração total, sucesso/falha operacional). A utilização de `console.log` é estritamente proibida.

---

## 13. Critérios de Evolução
* **Ciclo de Engenharia por Documentação**: Nenhuma mudança no código de produção ou de contrato será aceita sem passar rigorosamente pela cadeia:
  $$\text{PROJECT\_CHARTER} \rightarrow \text{RFC} \rightarrow \text{Design Document} \rightarrow \text{Specification} \rightarrow \text{ADR} \rightarrow \text{Implementação} \rightarrow \text{Testes}$$
* **Versionamento de Contratos**: Alterações estruturais que quebrem a compatibilidade com a versão atual da API obrigam a introdução de uma nova versão de rotas (ex: `/api/v2/...`), preservando a versão anterior.
* **Atualização de PKB**: Qualquer nova lição aprendida, limitação técnica identificada ou mudança de rumo arquitetural deve ser registrada imediatamente no arquivo `07 - Problemas Conhecidos.md` e refletida no `09 - CONTEXTO ATUAL.md`.

---

## 14. Glossário
* **URL Canônica**: URL limpa e padronizada que serve como endereço primário e definitivo do produto no marketplace, livre de identificadores de campanhas de marketing, cupons, sessões ou afiliados.
* **Browserless**: Serviço que expõe instâncias do Chromium executadas em containers Headless de alto desempenho, permitindo a automação remota de páginas.
* **CDP (Chrome DevTools Protocol)**: Protocolo baseado em WebSocket utilizado pelo Playwright para instrumentação detalhada, escuta de rede e controle direto de instâncias do Chromium.
* **Composition Root**: Ponto de entrada físico da aplicação (ex: `index.ts` ou `server.ts`) onde ocorrem as instanciações das classes de infraestrutura, registro de plugins e injeção de dependências nas classes de domínio/aplicação.
* **Ports**: Interfaces declaradas dentro das camadas internas da aplicação (Domínio/Aplicação) que descrevem ações necessárias de infraestrutura ou interações de entrada, mantendo o núcleo agnóstico às bibliotecas externas.
* **Adapters**: Classes concretas localizadas na camada de infraestrutura ou transporte que implementam as interfaces (Ports) do domínio, fornecendo a ponte de comunicação com tecnologias externas como Fastify ou Playwright.

---

## 15. Riscos Conhecidos
* **Instabilidade de Rede no Browserless Remoto**: Latências ou quedas de comunicação WebSocket (CDP) com a instância do Browserless externo.
  * *Mitigação*: O adapter de infraestrutura `BrowserManager` implementará lógicas robustas de reconexão automática, pooling de saúde de conexões (healthchecks) e timeouts curtos para evitar que a API REST fique travada aguardando.
* **Alteração de Estruturas de Redirecionamento**: Modificação súbita nos fluxos de redirecionamentos de afiliados de marketplaces.
  * *Mitigação*: Lógica de resolução baseada puramente na navegação e aguardo da URL estável final no Playwright, em vez de parsear links no meio do fluxo.
* **Esgotamento de Recursos no Servidor de Navegadores**: Vazamento de memória decorrente de falhas no encerramento de páginas abertas no Chromium sob estresse.
  * *Mitigação*: Implementação de blocos `try/finally` obrigatórios em toda navegação de página do Playwright no Adapter de infraestrutura de navegação, com auditoria estrita do ciclo de vida de cada Page criada.

---

## 16. Premissas do Projeto
* **Infraestrutura Browserless Estável**: Assume-se que há uma instância saudável e externa do Browserless ativa e disponível para conexões CDP sob as credenciais fornecidas no ambiente.
* **Delegação da Proteção Anti-Bot**: Assume-se que a infraestrutura do Browserless gerencia a rotação de IPs e as assinaturas de TLS para evasão de anti-bots, de forma que o microserviço apenas classifique e registre os erros gerados em caso de bloqueio.
* **Conectividade Irrestrita do Servidor**: O microserviço será implantado em ambiente Docker com conectividade de rede ativa e estável, permitindo a comunicação WebSocket com o Browserless remoto e escuta de tráfego HTTP.
