# ADR-000: Contexto Arquitetural

* **Status**: Accepted
* **Data**: 2026-07-06
* **Autor**: Antigravity

---

## Contexto

O projeto **URL Normalizer** tem como finalidade realizar o processamento, redirecionamento leve e resolução pesada de links de marketplaces de e-commerce. A plataforma é projetada para ser altamente robusta, isolada de acoplamentos contra provedores específicos e testável de forma unitária rápida.

---

## Decisão

Adotamos a **Clean Architecture** em conjunto com a **Arquitetura Hexagonal (Ports & Adapters)**. O núcleo (Domínio) define regras puras, entidades e interfaces (Ports), enquanto os adaptadores concretos (Adapters) implementam a comunicação externa.

### Escolhas Tecnológicas Iniciais:
1. **Playwright**: Escolhido pela alta velocidade e suporte nativo ao Chrome DevTools Protocol (CDP) em comparação com Selenium.
2. **Browserless**: Provedor padrão para controle do navegador em containers Docker de produção, permitindo acesso VNC nativo a operadores humanos para logins interativos de MFA.
3. **Fastify**: Framework de roteamento web de alta performance e baixo overhead.

---

## Consequências

### Positivas:
* Desacoplamento completo do domínio contra APIs web ou IO físico de navegadores.
* Facilidade para portar a aplicação para outros provedores (ex: Playwright local, Selenium Grid).
