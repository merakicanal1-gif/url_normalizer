# Configuração do Navegador (Modo CDP)

Para utilizar a API no modo CDP (`BROWSER_MODE=cdp`), você deve ter um navegador compatível (Google Chrome ou Brave) rodando na máquina com a porta de depuração remota ativada.

## Como iniciar o navegador

### Windows
No prompt de comando (CMD) ou PowerShell:
```bash
# Para Google Chrome
chrome.exe --remote-debugging-port=9222

# Para Brave Browser
brave.exe --remote-debugging-port=9222
```

### Linux
No terminal:
```bash
# Para Google Chrome
google-chrome --remote-debugging-port=9222

# Para Brave Browser
brave-browser --remote-debugging-port=9222
```

### macOS
No terminal:
```bash
# Para Google Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Para Brave Browser
/Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
```

---

## Verificando a Inicialização

Após iniciar o navegador, você pode verificar se a porta de depuração está respondendo abrindo o seguinte endereço no seu navegador ou via curl:
```
http://127.0.0.1:9222/json/version
```

Se retornar um JSON válido com informações do navegador, a API está pronta para se conectar.
