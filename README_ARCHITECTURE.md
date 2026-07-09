# Documentação de Arquitetura V2 — URL-Normalizer

Este documento descreve a arquitetura da plataforma após a migração completa da infraestrutura remota baseada em Browserless/CDP para processos locais do Chromium controlados diretamente via Playwright.

---

## 🏗️ Visão Geral da Arquitetura (Clean Architecture)

A aplicação segue rigorosamente os conceitos de **Ports & Adapters (Hexagonal Architecture)** e **Clean Architecture**, dividindo responsabilidades em camadas bem definidas e desacopladas.

```
       [ HTTP Clients ]
              │
              ▼
    [ Transport / Routes ] (Fastify)
              │
              ▼
     [ Application Layer ] (Services: Normalize, Authentication, Profile)
              │
      ┌───────┴────────┐
      ▼                ▼
   [ Ports ] <─── [ Domain Layer ] (Models, Business Rules)
      ▲
      │ (Dependency Injection)
 [ Adapters ] (Infrastructure: Playwright, Filesystem, OTel, Pino)
```

---

## 🧩 Camadas do Sistema

### 1. Domain (Núcleo)
Contém as entidades, erros de negócios e as portas (interfaces de abstração). A camada de domínio **não possui nenhuma dependência** de frameworks HTTP, bibliotecas do Playwright ou pacotes de observabilidade.
* **Ports:**
  * `IProfileManager`: Abstração de gerenciamento de perfis.
  * `IProfileRepository`: Abstração para persistência de dados físicos no disco/banco.
  * `IBrowserRuntime`: Abstração do ciclo de vida dos navegadores locais do Chromium.
  * `IBrowserSessionFactory`: Abstração para obtenção de páginas ativas em contextos isolados.
  * `IApplicationEventBus`: Barramento de eventos.
  * `ILogger` e `ITracer`: Portas de observabilidade.

### 2. Application (Serviços)
Orquestra as regras de negócio de alto nível.
* **`NormalizeService`**: Responsável por converter links brutos de afiliados em URLs canônicas de produtos, executando a extração via plugins.
* **`AuthenticationService`**: Gerencia o ciclo de vida temporário dos fluxos de login manual.
* **`ProfileManager`**: Encapsula regras de versionamento de perfil e manipulação de estado criptografado.

### 3. Infrastructure (Adaptadores)
Implementações concretas das portas definidas no domínio.
* **`PlaywrightBrowserRuntime`**: Gerencia os processos Singleton do Chromium (Worker e Interactive).
* **`PlaywrightBrowserSessionFactory`**: Factory que gerencia os contextos (`BrowserContext`) e gera páginas (`INavigatorPage`).
* **`LocalFileProfileRepository`**: Grava os dados do perfil em disco, separando as chaves em `metadata.json` (texto simples) e `profile.enc` (criptografia AES).
* **`PinoLogger`** e **`OpenTelemetryTracer`**: Adaptadores concretos para telemetria.

---

## 🔄 Fluxos de Execução

### 1. Boot da Aplicação
```
Application Start
    ↓
PlaywrightBrowserRuntime.start()
    ↓
Lança Worker Browser (headless: true)
Lança Interactive Browser (headless: false)
    ↓
Inicializa EventBus, EventLogger, EventTracer
    ↓
Fastify inicia escuta HTTP
```

### 2. Fluxo de Autenticação (Login Manual)
```
POST /profiles/:marketplace/:profile/authenticate
    ↓
AuthenticationRegistry cria sessão temporária
    ↓
Abre BrowserContext (headful) via Interactive Browser
    ↓
Navega para URL de login do marketplace e retorna authenticationId
    ↓
[Operador realiza login no navegador visível]
    ↓
POST /profiles/:marketplace/:profile/authenticate/:authenticationId/finish
    ↓
Captura storageState -> Salva profile.enc & metadata.json via ProfileManager
    ↓
Fecha BrowserContext via Factory -> Remove do Registry
```

### 3. Fluxo de Normalização
```
POST /normalize
    ↓
NormalizeService identifica o marketplace
    ↓
Carrega dados do perfil e chama PlaywrightBrowserSessionFactory
    ↓
Cria BrowserContext isolado (Worker Browser) com storageState (se disponível)
    ↓
newPage() -> Navega para URL -> Executa Plugin do Marketplace
    ↓
Extrai dados -> Fecha BrowserContext -> Retorna JSON normalizado
```

### 4. Shutdown da Aplicação
```
Fastify onClose
    ↓
AuthenticationRegistry fecha contextos pendentes
    ↓
PlaywrightBrowserRuntime.shutdown() (Fecha processos Chromium)
    ↓
OpenTelemetryRuntime.forceFlush() & shutdown()
```

---

## 📊 Estrutura de Armazenamento do Perfil

Cada perfil do marketplace é armazenado sob o diretório do repositório:
```
data/profiles/
└── <marketplace>/
    └── <profileId>/
        ├── metadata.json  <- Texto plano (createdAt, playwrightVersion, lastAuthentication)
        └── profile.enc    <- Criptografado (cookies e localStorage)
```

---

## 🛠️ Observabilidade e Tracing

* **Barramento Único:** Toda telemetria é reativa baseada no `ApplicationEventBus`.
* **Traces OpenTelemetry:**
  * Spans de `AuthenticationFlow` iniciados e concluídos a partir de IDs de autenticação.
  * Spans de `NormalizationFlow` iniciados e concluídos com base no `requestId` gerado por requisição.
