# ADR-021 — Estratégia de Logs e Degradação do Pino-Pretty

## Status
Approved

## Contexto
Durante a homologação da Sprint 0 do projeto **URL Normalizer**, a inicialização da aplicação dentro do container Docker em ambientes com configurações de desenvolvimento falhou com o erro:
`Error: unable to determine transport target for "pino-pretty"`.

Isso ocorre porque o processo de build do Docker executa `npm prune --production` para reduzir o tamanho da imagem final, o que remove as `devDependencies` (incluindo o pacote `pino-pretty`). Se a aplicação tentar inicializar o transport customizado do `pino-pretty` sob qualquer ambiente que não seja estritamente produtivo, ou se houver incompatibilidades no ambiente, a inicialização falha fatalmente.

## Decisão
Decidiu-se adotar uma estratégia de **degradação graciosa síncrona** no ponto de entrada da aplicação ([server.ts](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20(Gpt)/src/infrastructure/transport/http/server.ts)):

1. **Separação de Comportamento**:
   * **Produção (`NODE_ENV=production`)**: Desativa qualquer transport de formatação. O Pino registrará logs puros em JSON estruturado direto para `stdout`, garantindo baixo consumo de CPU e total compatibilidade com coletores de logs integrados ao Docker/EasyPanel.
   * **Desenvolvimento (`NODE_ENV=development`)**: Tenta usar a formatação humana amigável do `pino-pretty`.
2. **Verificação Dinâmica e Resiliente**:
   * O servidor tenta resolver síncronamente o pacote `pino-pretty` usando o método `require.resolve()` do Node.js.
   * Caso o módulo **não seja encontrado** (ex: imagem Docker com dependências podadas), o erro é capturado e a configuração do logger degrada silenciosamente para logs estruturados JSON normativos (Pino nativo), impedindo a quebra na inicialização da aplicação.
3. **Não-utilização de perfis locais**:
   * O comportamento é puramente baseado em variáveis de ambiente (`NODE_ENV`) e capacidade de resolução local de módulos do Node.js.

## Consequências
* **Vantagens**:
  * **Estabilidade e Robustez**: O container Docker inicia com sucesso em qualquer ambiente (development ou production), mesmo sem dependências de desenvolvimento.
  * **Performance em Produção**: Logs estruturados em JSON são muito mais rápidos e nativamente suportados por coletores de logs centralizados.
  * **Experiência do Desenvolvedor**: Preserva a formatação legível do `pino-pretty` no terminal local sem adicionar complexidade para subir a aplicação.
* **Desvantagens**:
  * Introdução de um pequeno bloco de try/catch síncrono no arquivo de bootstrapping do servidor HTTP.
