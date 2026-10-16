# App de inglês com aulas guiadas e estudo solo — design

Data: 2026-10-15

## Por que existe

Um amigo do usuário quer dar aulas de inglês para a **Tati**. Ela faz aula com uma professora paga que ele acha fraca. Ela está entre o nível básico e o intermediário, e a maior dificuldade dela é **falar**. Ele pediu (num áudio de WhatsApp) um roteiro de aulas estruturado, com exercícios de vocabulário, pronúncia e listening, e algo interativo, "como se eu estivesse dando aula para ela". O próprio usuário também quer melhorar o inglês dele estudando sozinho.

Daí o app: um curso completo de inglês, do básico ao avançado, com dois jeitos de usar.

## Quem usa

Três pessoas, num grupo privado. Não é um produto comercial.

- **O amigo**: conduz as aulas guiadas com a Tati. Tem **inglês avançado** (informado pelo usuário), mas não é professor, então o app organiza a aula para ele. Não precisa ensinar inglês a ele.
- **A Tati**: aluna no modo guiado. *Palpite:* também usa o modo solo para praticar entre as aulas.
- **O usuário**: estuda sozinho no modo solo.

## Objetivos

1. **App de desktop com instalador**, para **Windows e Mac**, que já traz tudo dentro (app, curso e IA). Instala e funciona, sem configurar nada.
2. **Grátis e offline.** A IA roda no próprio computador. Não há conta, assinatura nem serviço pago, e nada do que a pessoa fala sai da máquina.
3. **Nivelamento no início** (o usuário chamou de "anamnese de nivelamento"). Cada pessoa faz o seu e é colocada no ponto certo da trilha. Precisa medir **fala e escuta**, não só leitura e gramática, porque um teste só escrito colocaria a Tati num nível acima do real.
4. **Dois modos sobre a mesma trilha:**
   - **Guiado**: professor e aluno **no mesmo lugar, olhando para uma tela só**. Não é preciso sincronizar aparelhos nem fazer chamada de vídeo.
   - **Solo**: a pessoa estuda sozinha e o app corrige.
5. **Curso completo, do básico ao avançado, já na primeira versão.** O usuário pediu isso explicitamente, quando perguntado se aceitaria começar só pelo básico ao intermediário.
6. **Duração da sessão escolhida na hora**: 10, 20, 30, 40, 50 ou 60 minutos.
7. **Foco em conversação**: fala, pronúncia, listening e vocabulário pesam mais que gramática escrita.
8. **Correção da fala.** No solo, o usuário espera "que ele entenda, analise o que eu falei e me corrija". Isso cobre o conteúdo (gramática e jeito natural de dizer) e, até onde der, a pronúncia.

## Como o curso e a IA se dividem (decisão do usuário)

O curso é **escrito inteiro de antemão** (por Claude, durante a construção) e vai junto com o app como conteúdo fixo. A IA local **não cria aulas**. Ela só faz o processamento leve, seguindo as diretrizes escritas no curso:

- transcrever o que a pessoa falou;
- comparar com as respostas aceitas e os erros comuns já mapeados no exercício;
- só nas respostas livres ("conte sobre o seu dia"), usar as diretrizes daquela aula para apontar o erro e explicar.

Cada exercício leva, escritos no conteúdo:
- as **respostas aceitas** (várias formas corretas, não só uma);
- os **erros comuns de brasileiros**, com a explicação em português. Exemplos: "I have 25 years", o "th" virando "f" ou "d", a vogal extra em "espeak";
- o **critério** do que conta como certo.

O usuário disse que não precisa de um modelo topo de linha e que aceita uma correção mais limitada em troca de ser grátis.

## Estrutura do curso (decisões minhas, salvo onde indicado)

- **Níveis:** escala A1 → C1 do Quadro Europeu (CEFR), que é o padrão que escolas e provas usam. C2 fica de fora. *Minha decisão.*
- **Unidades temáticas** dentro de cada nível, como "se apresentar" ou "pedir comida no restaurante". *Minha sugestão:* em torno de 12 unidades por nível, cerca de 60 no total. O construtor pode ajustar, desde que todos os níveis A1–C1 fiquem completos.
- **Blocos de cada unidade:** aquecimento, vocabulário, pronúncia, listening, conversação e revisão.
- **Sessão com tempo escolhido** (a duração é decisão do usuário; o resto é minha decisão):
  - o tempo decide quanto da unidade cabe na sessão: 10 min é uma revisão mais um bloco, 30 min é mais ou menos uma unidade, 60 min é uma unidade com mais conversação ou uma unidade e meia;
  - toda sessão, até a de 10 min, começa revisando o que a pessoa errou antes e termina com uma conversa curta usando o que acabou de aprender;
  - unidade não terminada continua na sessão seguinte.
- **Explicações em português.** Instruções e feedback ficam em português nos níveis mais baixos e vão migrando para o inglês conforme o nível sobe. *Minha decisão.*
- **Áudio do listening e da pronúncia de exemplo:** gerado com uma voz sintética local e gratuita **durante a construção**, e embutido no app como arquivo de áudio. *Minha decisão.* Assim não depende de serviço pago nem de gerar áudio na máquina do aluno.

## Prova de nível (pedido do usuário)

Ao terminar a última unidade de um nível (A1, A2, B1, B2, C1), a pessoa faz uma **prova final daquele nível** para passar ao seguinte. As regras abaixo são decisões minhas:

- **Bloqueio:** a trilha não avança para o nível seguinte antes da aprovação. A prova do C1 marca a conclusão do curso.
- **Conteúdo:** cobre o nível inteiro e mede as habilidades separadamente, com uma parte de listening, uma de fala, uma de vocabulário e uma de estrutura de frases. Usa os mesmos tipos de exercício do curso, com questões próprias, diferentes das aulas.
- **Duração:** fixa, de 20 a 30 minutos. Não segue a duração escolhida para a sessão.
- **Aprovação:** **70% no total e pelo menos 50% em cada parte**. Isso evita passar só na parte escrita, que é a mesma preocupação do nivelamento.
- **Reprovação:** o app mostra as partes e as unidades mais fracas, e as sessões seguintes priorizam a revisão delas. A prova pode ser refeita quando a pessoa quiser.
- **Modos:** funciona nos dois. No solo, a parte de fala é corrigida pela IA. No guiado, quem ensina marca.
- **Registro:** o resultado (data, nota por parte, aprovado ou não) fica salvo no progresso. O nível do perfil passa a ser o último nível aprovado ou o definido pelo nivelamento.

## Tipos de exercício, intercalados (pedido do usuário; a seleção é minha)

O usuário pediu exercícios intercalados, "tipo múltipla escolha, pronúncia, sentenças", e deixou a escolha comigo:

- **Falados** (usam IA no solo; no guiado quem marca é o professor):
  - **repetir**: ouvir e repetir, para treinar pronúncia;
  - **traduzir falando**: "diga em inglês: …";
  - **ouvir e responder falando**;
  - **conversa livre**: responder a uma pergunta aberta.
- **De clicar ou digitar** (o app confere sem IA):
  - **múltipla escolha**, que também pode ser de listening ("ouça e escolha");
  - **completar a lacuna** de uma frase;
  - **montar a frase** com palavras embaralhadas;
  - **ligar pares** de vocabulário (inglês ↔ português).
- **Cartão de vocabulário**: palavra, significado e exemplo, seguido de repetir em voz alta.

Regras de mistura: cada bloco tem pelo menos dois tipos diferentes, e em cada unidade pelo menos metade dos exercícios é falada, para manter o foco em conversação.

## Modo guiado

- Roda num computador só, com os dois na frente dele.
- Tem um **roteiro para quem ensina**, que diz o que fazer em cada fase, o que perguntar, como puxar a conversa e o que corrigir, e se adapta ao tempo escolhido, mostrando quanto ainda falta.
- **Roteiros enxutos.** Como quem ensina tem inglês avançado, o roteiro não precisa de resposta-modelo completa nem de regra de correção detalhada. Basta trazer o objetivo da fase, as perguntas e as ideias de conversa, os "pontos para prestar atenção" (os erros comuns daquela unidade) e o tempo de cada fase. **Quem dá a palavra final sobre a correção é quem ensina.** A correção automática só ajuda. O modo guiado cobre todos os níveis, A1 a C1.
- Como a Tati está olhando para a mesma tela, as respostas esperadas e as anotações de quem ensina ficam **escondidas por padrão** e só aparecem quando quem ensina pede (algo como uma "cola do professor"). *Minha decisão.*
- **Sem IA no modo guiado** (decisão do usuário: "já que ele vai ser o professor, somente o material serve"). Não há microfone nem transcrição. Nos exercícios falados, quem ensina escuta e marca "certo" ou "errado". Os exercícios de clicar ou digitar (múltipla escolha, completar, montar frase, ligar pares) continuam sendo conferidos pelo app, porque isso não usa IA, e quem ensina pode mudar o resultado. As marcações entram no progresso da mesma forma, então os erros voltam na revisão, inclusive no solo. Efeito colateral bom: o modo guiado não depende do desempenho da IA no notebook deles.

## Modo solo

- A pessoa escolhe o tempo e o app monta a sessão a partir de onde ela parou.
- Exercícios de fala: a pessoa fala, o app transcreve, compara e corrige, mostrando o que estava certo, o que errou, a forma correta e o porquê, em português.
- Pronúncia: ouvir o exemplo, repetir e receber feedback.
- Revisão dos erros anteriores no começo de cada sessão.

## Perfis e progresso

- **Vários perfis por instalação**, porque o amigo e a Tati dividem um computador. Cada perfil tem o próprio nivelamento e o próprio progresso. *Minha decisão.*
- O progresso fica salvo **só no computador**. Não há conta nem sincronização. Se a Tati usar o solo em outro computador, o progresso lá é separado. *Minha decisão: aceito essa limitação para não precisar de servidor.*
- **Uma posição só na trilha por perfil**, e os dois modos avançam essa mesma posição. Se a Tati adiantar um bloco no solo, a aula guiada seguinte começa dali. Quem ensina não perde o fio porque o roteiro aparece na tela na hora, sem preparação prévia. A aula guiada também mostra um resumo do que ela fez sozinha desde a última aula (o que avançou e onde errou). *Minha decisão.*

## IA local (decisão do usuário: rodar no próprio PC, num app com instalador)

Três peças, todas embutidas no instalador:

1. **Transcrição da fala:** Whisper (whisper.cpp).
2. **Análise das respostas livres:** um modelo de texto pequeno (llama.cpp), que recebe a transcrição e as diretrizes da aula.
3. **Pronúncia:** o ideal é um modelo aberto que avalia som por som (como o OpenPronounce, que usa wav2vec2). Se não for viável embutir e rodar isso bem nas duas plataformas, o mínimo aceitável é comparar a palavra que a transcrição entendeu com a esperada, sabendo que isso deixa passar parte dos erros.

Escolha dos modelos e tamanhos fica com o construtor, dentro destes limites:
- **Máquina-alvo mais fraca:** o notebook do amigo e da Tati. O usuário descreveu como um notebook comum, "nada muito forte", com placa de vídeo integrada e provavelmente um Intel i5. Projetar assumindo **Windows 64-bit x86, só CPU (sem GPU dedicada) e 16 GB de RAM** (o usuário disse "16 GB pelo menos").
- Na máquina-alvo, o retorno de um exercício de fala deve sair em **poucos segundos** (*minha meta:* até uns 5 s para uma frase curta), e o app não pode travar enquanto a IA processa. O limite aqui é a velocidade do processador, não a memória. Isso empurra para modelos pequenos: Whisper nas versões menores e um modelo de texto de uns 3 a 4 bilhões de parâmetros, quantizado.
- Tudo carregado junto deve ocupar no máximo uns 6 GB de RAM, deixando folga para o sistema e o navegador.
- Também roda no Mac do usuário (Apple M5, 16 GB), que é a máquina de desenvolvimento.
- O download dos modelos deve ficar razoável. Minha estimativa é de 1 a 3 GB.
- **O app escolhe sozinho o melhor modelo para cada máquina** (pedido do usuário). Na primeira abertura, antes de baixar os modelos, ele verifica o hardware (RAM, processador, se tem GPU ou Apple Silicon) e faz um teste rápido de velocidade. Com isso escolhe um pacote: leve, médio ou forte. O notebook i5 deve cair no leve ou no médio, e o Mac M5 no forte. A escolha aparece nas configurações e a pessoa pode trocar, com o app avisando quando a troca deixar tudo lento. Quantos pacotes existem e o que vai em cada um fica com o construtor. *Minha decisão:* são três pacotes, e a escolha leva em conta o teste de velocidade, não só a quantidade de RAM.
- Se a máquina não der conta de alguma peça (por exemplo, a pronúncia som por som), o app desliga só essa peça e continua funcionando.

## Plataforma e distribuição

- **Electron + React.** *Minha decisão:* o usuário é dev frontend com React, e o Electron é o caminho mais simples para instalador de Mac e Windows. O peso extra dele não importa perto do tamanho dos modelos.
- **Desenvolvimento no Mac**, com a versão Windows gerada a partir do mesmo código (decisão do usuário). O instalador de Windows sai do **GitHub Actions** (grátis), já que não dá para gerar direto do Mac. *Minha decisão.*
- **Modelos baixados uma vez, no primeiro uso.** O instalador traz o app e o curso. Na primeira abertura, o app baixa os modelos de IA (com barra de progresso) e a partir daí funciona 100% offline. *Minha decisão.* Motivos: um instalador único de 2 a 3 GB esbarra em limites das ferramentas e da hospedagem (arquivos de release do GitHub vão até 2 GB e o instalador NSIS do Windows se complica acima disso; os dois limites precisam ser confirmados). Além disso, correções e conteúdo novo passam a chegar num instalador pequeno, sem baixar os modelos de novo. Isso importa porque o Windows só vai ser testado por eles e devem aparecer ajustes. Como o app não é assinado, não há atualização automática: a pessoa baixa e instala a versão nova.
- **Sem assinatura de código** (Apple/Microsoft). Na primeira abertura aparece o aviso de "desenvolvedor não identificado" e a pessoa clica em "abrir mesmo assim". *Minha decisão: a assinatura custa cerca de US$ 99/ano na Apple e não compensa para três pessoas.*

## Fora do escopo

- Contas, login, nuvem ou sincronização entre computadores.
- Pagamento, loja de apps ou distribuição pública.
- App de celular ou tablet.
- Gerar aulas na hora com IA.
- Serviços de IA pagos ou na nuvem.
- Chamada de vídeo ou aula remota.
- Nível C2.

## O que seria um fracasso, mesmo funcionando

- Depender de serviço pago ou de internet para corrigir.
- O modo guiado exigir que quem ensina saiba inglês como um professor para conseguir dar a aula.
- Um nivelamento que meça só leitura e escrita e coloque a pessoa acima do nível real de fala.
- Um curso pesado em gramática escrita e leve em conversação.
- *Palpite meu:* a correção marcar como erradas respostas que estão certas com frequência. Isso desanima quem está aprendendo. Na dúvida, aceitar é melhor que reprovar.
- As respostas esperadas aparecerem para a aluna no modo guiado antes da hora.

## Restrições e riscos conhecidos

- **Windows não pode ser testado daqui.** O primeiro teste real vai ser feito pelo amigo ou pela Tati. Os pontos mais arriscados são a permissão do microfone e a IA rodando na máquina.
- **O processador do notebook deles é fraco** (i5, vídeo integrado, 16 GB de RAM). O desempenho da IA nele é o maior risco técnico, mas afeta só o modo solo da Tati, porque o guiado não usa IA. Vale fazer cedo um teste de velocidade dos modelos escolhidos numa máquina parecida, ou numa versão Windows de teste que eles rodem.
- **O volume de conteúdo é grande.** Escrever cerca de 60 unidades, com roteiro, respostas aceitas, erros comuns e áudio, é a maior parte do trabalho.

## O que fica com o construtor

- A escolha e o tamanho exatos dos modelos (Whisper, LLM, pronúncia) e da voz sintética.
- O formato dos arquivos do curso e a forma de armazenar o progresso.
- O visual e a navegação das telas.
- Como funciona o nivelamento adaptativo (quantas perguntas, regras de corte, duração; *sugestão:* uns 15 minutos).
- Os limites de pontuação para aceitar uma resposta ou uma pronúncia.
- A quantidade exata de exercícios por bloco.
- A ordem de construção, desde que a primeira versão entregue tudo o que está nos Objetivos.
