# Guia de Integração — Tailscale + n8n

Este guia orienta na configuração de comunicação, testes e integração da API **URL Normalizer** utilizando o **Tailscale** para rede privada virtual e o **n8n** como plataforma de automação.

---

## 1. Descobrindo o IP Privado do Servidor na Tailnet

Para que o n8n consiga se comunicar com o seu computador local de forma segura, ambos os nós devem estar conectados à mesma conta do **Tailscale**.

### No Linux/macOS
Execute o comando abaixo no terminal:
```bash
tailscale ip -4
```

### No Windows
Abra o Command Prompt (CMD) ou PowerShell e execute:
```cmd
tailscale ip -4
```

O comando retornará um endereço IP IPv4 na faixa privada da Tailnet (exemplo: `100.85.120.45`). Esse IP será usado em todas as chamadas.

---

## 2. Testando os Endpoints via `curl`

Substitua `100.xxx.xxx.xxx` pelo IP do Tailscale obtido no passo anterior e `sua-chave-secreta-aqui` pela chave configurada na variável `API_KEY` do arquivo `.env`.

### A. Health Check (Liveness e Readiness)
Estes endpoints **não** exigem autenticação por chave de API:
```bash
# Liveness (Fastify operacional)
curl http://100.xxx.xxx.xxx:3007/health/live

# Readiness (Navegador persistente e contextos prontos para uso)
curl http://100.xxx.xxx.xxx:3007/health/ready
```

### B. Status Geral da API e Sessões
Retorna informações detalhadas do runtime Playwright, status dos cookies e IP do Tailscale:
```bash
curl http://100.xxx.xxx.xxx:3007/status
```

### C. Normalização Amazon
```bash
curl -X POST http://100.xxx.xxx.xxx:3007/normalize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-chave-secreta-aqui" \
  -d '{
    "url": "https://amzn.divulguei.app/lU2tys"
  }'
```

### D. Normalização Mercado Livre
```bash
curl -X POST http://100.xxx.xxx.xxx:3007/normalize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sua-chave-secreta-aqui" \
  -d '{
    "url": "https://meli.la/2iwgsWi"
  }'
```

---

## 3. Configurando a Chamada no n8n

Para integrar com um workflow do n8n, utilize o nó **HTTP Request** com as seguintes especificações:

| Campo / Configuração | Valor / Configuração |
| :--- | :--- |
| **Method** | `POST` |
| **URL** | `http://100.xxx.xxx.xxx:3007/normalize` |
| **Authentication** | `None` (usaremos o header customizado) |
| **Headers** | Adicionar dois parâmetros:<br>1. `Content-Type` = `application/json`<br>2. `X-API-Key` = `sua-chave-secreta-aqui` |
| **Specify Body** | `Using JSON` |
| **JSON** | `{ "url": "{{$json.url}}" }` |

### Exemplo do JSON de Configuração do Nó no n8n
Você pode copiar e colar este JSON diretamente na sua área de trabalho do n8n para importar o nó pré-configurado:

```json
{
  "parameters": {
    "method": "POST",
    "url": "http://100.xxx.xxx.xxx:3007/normalize",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/json"
        },
        {
          "name": "X-API-Key",
          "value": "sua-chave-secreta-aqui"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "{\n  \"url\": \"{{$json.url}}\"\n}",
    "options": {}
  },
  "name": "HTTP Request - URL Normalizer",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4,
  "position": [
    240,
    300
  ]
}
```

---

## 4. Gerenciamento do Serviço no Computador Local

A API é configurada como um serviço em segundo plano (daemon). Você não precisa manter nenhum terminal aberto ou logado.

### Visualizar Logs em Tempo Real
Para depurar e monitorar o comportamento do Playwright em segundo plano:
```bash
journalctl -u url-normalizer -n 100 -f
```

### Reiniciar o Servidor
Caso altere alguma configuração no arquivo `.env`:
```bash
sudo systemctl restart url-normalizer
```
