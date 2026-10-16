# Roteiro de teste no Windows

Para quem vai testar o app no notebook Windows (i5, vídeo integrado, 16 GB de memória). Siga os passos na ordem. Em cada um há o resultado esperado e um espaço "O que aconteceu" para você anotar. Se algo não sair como o esperado, anote, tire um print e siga para o próximo passo quando der.

Antes de começar, anote o nome do seu usuário do Windows (aparece em `C:\Users\<nome>`), principalmente se tiver acento ou espaço: ______________________

---

## 1. Baixar o instalador

Baixe o arquivo `Ingles-<versão>-setup.exe` pelo link que você recebeu.

**Esperado:** o arquivo aparece na pasta Downloads.

**O que aconteceu:**

## 2. Passar pelo aviso do Windows (SmartScreen)

Dê dois cliques no `.exe`. Como o app não tem assinatura digital, o Windows mostra a tela azul "O Windows protegeu o computador". Clique em **"Mais informações"** e depois em **"Executar assim mesmo"**.

**Esperado:** o instalador abre.

**O que aconteceu:**

## 3. Instalar e abrir

Siga o instalador (pode deixar as opções como estão). No fim, feche o instalador e abra o app pelo atalho **"Inglês"** da área de trabalho.

**Esperado:** o app abre na tela "Preparar a IA".

**O que aconteceu:**

## 4. Preparar a IA

Na tela "Preparar a IA", anote o pacote recomendado e o hardware que o app mostra. Depois toque em **"Baixar e preparar"** e marque quanto tempo leva até terminar.

**Esperado:** o download termina sem erro e o app segue para a tela de perfis.

**Pacote recomendado:**

**Hardware mostrado:**

**Tempo para baixar e preparar:**

**O que aconteceu:**

## 5. Criar um perfil e fazer uma sessão solo de 10 minutos

Crie um perfil com o seu nome. O app oferece **"Fazer o nivelamento (10 a 15 min)"** ou **"Escolher nível manualmente"**. Faça o nivelamento se tiver tempo (anote o nível que ele deu); se não, escolha o nível manualmente.

Depois comece uma sessão solo de uns 10 minutos. Num exercício de repetir a frase ("repeat"), grave a sua voz. O Windows pode pedir permissão para usar o microfone: aceite e anote se pediu.

**Esperado:** a nota de pronúncia aparece depois da gravação.

**Fez o nivelamento? Qual nível deu (ou qual você escolheu)?**

**O Windows pediu o microfone?**

**A nota de pronúncia apareceu?**

**Quantos segundos a correção demorou:**

**O que aconteceu:**

## 6. Responder um exercício de fala livre

Num exercício em que você responde com as suas palavras, grave a resposta.

**Esperado:** aparece "Analisando sua resposta…" e depois um feedback em português.

**Quanto tempo ficou em "Analisando sua resposta…":**

**O feedback veio em português?**

**O que aconteceu:**

## 7. Fazer uma sessão guiada curta

Volte ao início e faça uma sessão guiada (com professor) curta, de poucos exercícios.

**Esperado:** nada da IA aparece (sem nota de pronúncia, sem "Analisando sua resposta…").

**O que aconteceu:**

## 8. Fechar e abrir de novo

Feche o app e abra de novo pelo atalho.

**Esperado:** o seu perfil e o progresso continuam lá, e a IA não baixa de novo.

**O que aconteceu:**

## 9. Sem internet

Desligue o Wi-Fi e abra o app.

**Esperado:** tudo funciona, inclusive a nota de pronúncia e o feedback da fala livre.

**O que aconteceu:**

---

## Se algo der errado

1. **Tire um print** da tela com o problema.
2. **Pegue os arquivos de log.** Abra o app, vá em **"Configurações da IA"** (ou fique na tela "Preparar a IA") e clique em **"Abrir pasta de logs"**. Se o app não abrir, cole `%APPDATA%\Inglês\logs` na barra de endereço do Explorador de Arquivos e aperte Enter. Mande os arquivos `main.log` e `main.old.log` (o `main.old.log` é da vez anterior em que o app abriu).
3. **Mande de volta**: os prints, os dois arquivos de log, o nome do seu usuário do Windows e os tempos que você anotou.

A pasta de dados do app (perfis, progresso e modelos de IA) fica em `%APPDATA%\Inglês`.

### Verificação do app (self-check)

Se pedirem, rode a verificação do app instalado:

1. Clique com o botão direito no atalho "Inglês" da área de trabalho → **"Abrir local do arquivo"**. Anote o caminho da pasta (normalmente `C:\Users\<nome>\AppData\Local\Programs\Ingles` ou, se instalou para todos os usuários, `C:\Program Files\Ingles`).
2. Abra o **PowerShell** (menu Iniciar → digite "PowerShell").
3. Rode o comando abaixo, trocando o caminho pelo que você anotou, e mande um print do resultado:

```powershell
& "C:\Users\<nome>\AppData\Local\Programs\Ingles\Ingles.exe" --self-check | Out-Host
```
