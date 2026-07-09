# URL Normalizer

API REST de alta performance desenvolvida em Node.js e TypeScript para resolução, extração de parâmetros canônicos e normalização de URLs de e-commerce e afiliados (Amazon, Mercado Livre, Shopee). 

---

## 🏛️ Visão Geral e Arquitetura

O sistema é estruturado seguindo os princípios de **Clean Architecture** e **Arquitetura Hexagonal (Ports & Adapters)**, garantindo desacoplamento total de frameworks web, motores de automação e I/O físico de rede e de arquivos locais.

Consulte a documentação arquitetural e de design:
* [Visão Geral da Arquitetura](docs/architecture/overview.md)
* [Responsabilidade de Componentes](docs/architecture/components.md)
* [Ciclo de Vida do Runtime](docs/architecture/runtime.md)
* [Máquina de Estados de Login](docs/architecture/state-machine.md)
* [Decisões Arquiteturais (ADRs)](docs/adr/)

---

## 📂 Documentação e Guias

* **Especificação OpenAPI**: [openapi.yaml](openapi.yaml) (Visualizável em qualquer Swagger Editor)
* **Referência da API HTTP**: [docs/api/http.md](docs/api/http.md)
* **Runbook Operacional**: [docs/operations/runbook.md](docs/operations/runbook.md)
* **Troubleshooting**: [docs/operations/troubleshooting.md](docs/operations/troubleshooting.md)

---

## 🚀 Requisitos e Execução Rápida

### Requisitos
* Node.js v22 LTS ou superior.
* Docker (para o provedor de navegador remoto).

### Instalação de Dependências
```bash
npm install
```

### Inicializando o Browserless Local (VNC/CDP)
```bash
docker compose up -d
```

### Configurando o ambiente
Copie `.env.example` para `.env` e configure sua chave secreta:
```bash
cp .env.example .env
```

### Executando em Desenvolvimento
```bash
npm run dev
```

### Executando a Suíte de Testes
```bash
npm run test
```

---

## 🗺️ Roadmap de Evolução

- [x] **Sprint 1.0.1**: Inicialização do projeto, resolvedores leves de redirect e plugins básicos de marketplace.
- [x] **Sprint 1.0.2**: Criptografia AES-256-GCM para cookies salvos.
- [x] **Sprint 1.0.3A**: Integração Playwright CDP com Browserless.
- [x] **Sprint 1.0.3B**: Fluxo de VNC/DevTools e relógio temporal mockado (`IClock`).
- [x] **Sprint 1.0.3C**: Orquestrador `InteractiveSessionService` e ciclo de vida de persistência.
- [x] **Sprint 1.0.3D**: Hardening, bloqueio de concorrência, auto-cura do Browserless e redação de logs sensíveis.
- [x] **Sprint 1.0.3E**: Consolidação da base de arquitetura, OpenAPI e documentação técnica oficial (v1.0.0-beta).
- [ ] **Sprint 1.0.4**: Evasão automatizada de logins e detecção de logins do operador por marketplace.
- [ ] **Sprint 1.0.5**: Evasão automática de CAPTCHAs.
