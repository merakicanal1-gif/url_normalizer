# ADR-020 — Logger Desacoplado no Core do Sistema

## Status
Approved

## Contexto
O projeto adota Pino como registrador oficial de logs estruturados (conforme homologado no `PROJECT_CHARTER.md`). No entanto, o Pino possui uma assinatura específica de registro de erros estruturados, na qual o objeto de erro é passado como primeiro argumento e a mensagem de texto como segundo (`logger.error(error, message)`).

Se os componentes do núcleo de aplicação (como o `BrowserManager` ou os `Services`) importarem ou utilizarem assinaturas acopladas especificamente a uma biblioteca de logs externa, violaremos o princípio inegociável de isolamento do Domínio e dependência de infraestrutura da Arquitetura Hexagonal.

## Decisão
Decidiu-se:
1. Declarar uma interface de logger genérica e abstrata, injetada na inicialização das classes de aplicação e infraestrutura (ex: `BrowserManager`).
2. O contrato de log de erros do sistema utilizará uma assinatura independente e de legibilidade limpa para o desenvolvedor: `error(message: string, err?: any)`.
3. Na composição de dependências (Composition Root - [server.ts](file:///home/emerson/Documentos/Meus%20Desenvolvimentos/URL-Normalizer%20(Gpt)/src/infrastructure/transport/http/server.ts)), o adaptador de transporte realiza a adaptação da assinatura ao repassar para o Pino:
   ```typescript
   error: (msg, err) => fastify.log.error(err, msg)
   ```
   Dessa forma, o stack trace e os metadados do erro são passados corretamente na primeira posição para o Pino estruturar o JSON de log.

## Consequências
* **Vantagens**:
  * Desacoplamento total do Domínio contra bibliotecas de terceiros de logging.
  * Código de aplicação limpo e intuitivo para o desenvolvedor.
  * Facilidade em substituir a biblioteca Pino no futuro por Winston, Bunyan ou OpenTelemetry sem alterar as regras de negócio ou lógica dos adaptadores.
* **Desvantagens**:
  * Necessidade de escrever uma pequena função de adaptação de parâmetros no Composition Root.
