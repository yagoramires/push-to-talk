# Roteiro de teste no Android

Para quem vai testar o app num celular Android de verdade. Siga os passos na ordem. Em cada um há o resultado esperado e um espaço "O que aconteceu" para você anotar. Se algo não sair como o esperado, anote, tire um print e siga para o próximo passo quando der.

Antes de começar, anote o modelo do celular e quanto de memória (RAM) ele tem: ______________________

Use Wi-Fi e deixe o celular carregando: o primeiro uso baixa cerca de 1,7 GB.

---

## 1. Baixar o APK

O APK vem do GitHub, de um destes dois lugares:

- **Actions:** o artifact `installer-Android`, gerado a cada push na `main`.
- **Releases:** o arquivo `Push-to-Talk-<versão>-android.apk`.

**Esperado:** o arquivo `.apk` aparece em Downloads no celular.

**O que aconteceu:**

## 2. Instalar o APK

Toque no `.apk`. O Android pede para permitir **"instalar apps de fontes desconhecidas"** para o navegador ou gerenciador de arquivos que você usou: permita e volte para a instalação.

**Esperado:** o app "Push to Talk" é instalado e aparece na lista de apps.

**O que aconteceu:**

## 3. Abrir e conceder o microfone

Abra o app. Quando o Android pedir permissão para gravar áudio, toque em **"Permitir"**.

**Esperado:** o app abre na tela "Preparar a IA".

**O Android pediu o microfone?**

**O que aconteceu:**

## 4. Preparar a IA

Conecte ao Wi-Fi. Na tela "Preparar a IA", anote o pacote recomendado e o hardware mostrado. Toque em **"Baixar e preparar"** e marque quanto tempo leva até terminar. **Mantenha o app aberto durante todo o download**: se ele fechar, o download dos modelos recomeça do zero.

Os modelos que podem ser baixados (cerca de 1,7 GB no total):

- Whisper base, 77 MB (sempre).
- Pronúncia, 318 MB (se o celular for rápido o bastante).
- Qwen, 1,3 GB (só se o celular tiver 6 GB de RAM ou mais **e** o teste de velocidade der rtf menor ou igual a 1,5).

**Esperado:** o download termina sem erro e o app segue para a tela de perfis.

**Pacote recomendado:**

**Hardware mostrado:**

**Tempo para baixar e preparar:**

**O que aconteceu:**

## 5. Criar um perfil e fazer o nivelamento

Crie um perfil com o seu nome. Escolha **"Fazer o nivelamento (10 a 15 min)"** e anote o nível que ele deu. Se não tiver tempo, escolha o nível manualmente.

**Esperado:** o nivelamento termina e mostra o seu nível.

**Qual nível deu (ou qual você escolheu)?**

**O que aconteceu:**

## 6. Fazer uma aula inteira

Comece uma aula e vá até o fim. Num exercício de repetir a frase ("repeat"), grave a sua voz. Num exercício de fala livre, responda com as suas palavras.

**Esperado:** a nota de pronúncia aparece depois da gravação; na fala livre aparece "Analisando sua resposta…" e depois um feedback em português.

**A nota de pronúncia apareceu?**

**Quantos segundos a correção da fala livre demorou:**

**O feedback veio em português?**

**O que aconteceu:**

## 7. Botão "voltar" no meio da aula

No meio de uma aula, aperte o botão (ou gesto) de **voltar** do Android.

**Esperado:** aparece "Sair do app? O que não foi salvo se perde." Escolha ficar: a aula continua. Repita e escolha sair: o app fecha.

**O que aconteceu:**

## 8. Negar o microfone

Em **Configurações do Android → Apps → Push to Talk → Permissões → Microfone**, escolha **"Não permitir"**. Abra o app e tente gravar num exercício.

**Esperado:** o app avisa que precisa do microfone, sem travar. Depois volte a permitir o microfone.

**O que aconteceu:**

## 9. Fechar o app no meio do download

Para este passo, desinstale o app e instale de novo (ou limpe os dados em Configurações do Android → Apps → Push to Talk → Armazenamento). Na tela "Preparar a IA", toque em **"Baixar e preparar"**, espere uns 30 segundos e feche o app à força (deslize para fechar nos apps recentes). Abra de novo.

**Esperado:** o app volta à tela "Preparar a IA" e o download recomeça do zero, sem travar nem dar erro.

**O que aconteceu:**

## 10. Modo avião

Com a IA já preparada, ligue o **modo avião** e abra o app.

**Esperado:** tudo continua funcionando, inclusive a nota de pronúncia e o feedback da fala livre.

**O que aconteceu:**

## 11. Fechar e abrir de novo

Feche o app e abra de novo.

**Esperado:** o seu perfil e o progresso continuam lá, e a IA não baixa de novo.

**O que aconteceu:**

## 12. Atualizar o APK por cima

Baixe o APK de uma versão mais nova (mesmo caminho do passo 1) e instale por cima do app já instalado, sem desinstalar. Isso só mantém os dados se os dois APKs forem assinados com a mesma chave de release (os APKs do CI do GitHub são).

**Esperado:** o Android oferece "Atualizar", e depois o perfil e o progresso continuam lá, sem baixar a IA de novo.

**O que aconteceu:**

---

## Se algo der errado

1. **Tire um print** da tela com o problema.
2. **Pegue o log.** Abra o app, vá em **"Configurações da IA"** e toque em **"Enviar logs"**. O menu de compartilhar do Android abre com o arquivo `main.log`: mande para quem pediu (por exemplo, por WhatsApp ou e-mail).
3. **Procure estas linhas no `main.log`** e anote os valores:
   - `setupAi decision rtf=… ram=…GB cores=… pronunciation=… llm=…` (a decisão do app sobre quais modelos baixar).
   - `worker benchmark runs (s) …` (os tempos do teste de velocidade).
   - `llm loaded … ms` (quanto levou para carregar o Qwen).
   - `llm complete … tokens … ms` (quanto levou uma correção).
4. **Mande de volta**: os prints, o `main.log`, o modelo do celular, a RAM e os tempos que você anotou.

**RAM (de `ram=…GB`):**

**rtf:**

**Decisão `llm`:**

**Tempo de uma correção (`llm complete`):**
