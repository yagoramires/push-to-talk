# Prova do llama.cpp no Android (Task 1, plano 7)

Data: 2026-10-17. Resultado: **passou, com plugin próprio**. O `llama-cpp-capacitor` não serve.

## Decisão

| | |
|---|---|
| Plugin escolhido | **plugin Capacitor próprio, mínimo** (JNI + Java, ~150 linhas) |
| llama.cpp | `ggml-org/llama.cpp`, tag `v0.5.0`, commit `7fe450e19305b828c199d602c23a8337aaa1f03b` |
| Por que esse commit | é a mesma árvore (tree `fd570ef5…`) que o `node-llama-cpp` 3.22.1 traz em `llama/gitRelease.bundle`, então carrega o mesmo GGUF que o desktop |
| ABI | só `arm64-v8a` |
| NDK / CMake | `ndk;29.0.13113456`, `cmake;3.31.6` |
| Capacitor | 8.5.3 |

### Por que não o `llama-cpp-capacitor`

A versão mais nova (0.2.2, `latest` ainda aponta 0.1.5) traz um llama.cpp de meados de 2025, com prefixo `lm_` próprio.
A lista de arquiteturas em `cpp/llama-arch.cpp` termina em `seed_oss` e não tem `qwen35`; o `.so` pré-compilado
(`libllama-cpp-arm64.so`) também não tem a string. O GGUF declara `general.architecture = qwen35`, então o carregamento
falharia com "unknown model architecture". Trocar o llama.cpp dentro dele não é viável: os arquivos `cap-*` dependem do fork.
(Conclusão por inspeção do pacote; não instalei ele no emulador.)

## Números (emulador)

Emulador: AVD `google_apis` arm64, Android 15 (API 35), 8 GB de RAM, 4 núcleos, num Mac Apple Silicon (16 GB).
O emulador ARM no Mac roda quase na velocidade nativa do M-series, então estes números são **otimistas** para um celular médio.
Contexto 2048, 4 threads, temperatura 0.2, seed 42, gramática GBNF ligada.

| Medida | Valor |
|---|---|
| Carregar o modelo (1,28 GB) | 3,0 s |
| Tokens/s (ponta a ponta, incluindo o prompt de ~70 tokens) | 15,1 / 17,1 / 17,2 |
| Correção típica (75–91 tokens de saída) | **4,4–5,3 s** |
| JSON válido com as três chaves | 3 de 3 |
| `stop()` | interrompeu uma geração de 2000 tokens em 3,0 s (106 tokens) |
| `.so` no APK (`libllamajni.so`, llama.cpp estático) | **5,85 MB** (guardado sem compressão no APK; APK total 9,06 MB) |
| RAM do llama.cpp | ~1,2 GB de pesos (repack para CPU, copia o mmap) + 0,5 GB de buffer de cálculo + 24 MB de KV |

## Contrato da Task 6

```ts
/** src/mobile/llm-native.ts */
export interface NativeLlm {
  load(modelPath: string): Promise<void> // file:// ou caminho absoluto
  complete(o: { prompt: string; grammar: string; maxTokens: number; temperature: number; seed: number }): Promise<string>
  stop(): Promise<void> // interrompe a geração em curso
  release(): Promise<void>
}
```

O plugin da prova expõe exatamente isso (`complete` devolve `{ text, tokens, ms }`), mais `deviceInfo()` → `{ totalRam, cores }`
com `ActivityManager.MemoryInfo.totalMem` (a RAM total que a Task 6 precisa; no emulador, 8 324 567 040 bytes).

### Prompt e gramática testados

```
<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n
```

```gbnf
root ::= "{" ws "\"correct\"" ws ":" ws boolean ws "," ws "\"feedback_pt\"" ws ":" ws string ws "," ws "\"corrected_en\"" ws ":" ws string ws "}"
boolean ::= "true" | "false"
string ::= "\"" ( [^"\\\x7F\x00-\x1F] | "\\" ["\\/bfnrt] )* "\""
ws ::= [ \t\n]{0,2}
```

### Peças do plugin

**CMake** (`android/.../cpp/CMakeLists.txt`): `add_subdirectory` do llama.cpp com `BUILD_SHARED_LIBS=OFF`,
`LLAMA_BUILD_COMMON/TESTS/TOOLS/EXAMPLES/SERVER=OFF`, `LLAMA_CURL=OFF`, `GGML_NATIVE=OFF`, `GGML_OPENMP=OFF`,
`GGML_LLAMAFILE=OFF`, `GGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16`; uma lib `llamajni` ligada a `llama` e `log`.
No `build.gradle`: `ndk { abiFilters "arm64-v8a" }`, `externalNativeBuild { cmake { path ...; version "3.31.6" } }`,
`arguments "-DCMAKE_BUILD_TYPE=Release"`.

**JNI** (`llamajni.cpp`), com a API do `llama.h` desse commit:

- `load`: `llama_backend_init` → `llama_model_load_from_file` → `llama_init_from_model` (n_ctx 2048, n_batch 512,
  threads = min(4, núcleos), `abort_callback` lendo a flag de stop, para cortar até um prompt longo).
- `complete`: `llama_tokenize` (add_special, parse_special) → `llama_memory_clear(llama_get_memory(ctx), true)` →
  cadeia de samplers `llama_sampler_init_grammar(vocab, gbnf, "root")` + `temp` + `dist(seed)` (ou `greedy` com temp 0) →
  `llama_decode(llama_batch_get_one(...))` e laço de `llama_sampler_sample` até EOG, `maxTokens` ou stop.
- `stop`: põe a flag atômica; `release`: `llama_free` + `llama_model_free`.

**Java**: `@CapacitorPlugin(name = "Llama")`, tudo do llama roda num `Executors.newSingleThreadExecutor()`
(o contexto não é thread-safe); `stop` roda direto na thread do bridge. Registrado com `registerPlugin(...)` no `MainActivity`.

## Cuidados para a Task 6

- **Onde fica o modelo:** o app **não** lê o GGUF em `/sdcard/Android/data/<pacote>/files` quando ele foi posto lá por
  `adb push` (Permission denied). Baixar para `context.getFilesDir()` (o `Directory.Data` do `@capacitor/filesystem`)
  funciona e é o caminho certo. Para testes: `adb push` para `/data/local/tmp` e `run-as <pacote> cp` (precisa de build debuggable).
- **CPU fixa:** `armv8.2-a+dotprod+fp16` cobre praticamente todo arm64 desde ~2018. Para celulares mais velhos, trocar por
  `GGML_BACKEND_DL=ON` + `GGML_CPU_ALL_VARIANTS=ON` (como o `examples/llama.android` do llama.cpp) e carregar os backends
  do `nativeLibraryDir`; isso aumenta o APK.
- **Texto de volta:** o JNI devolve com `NewStringUTF` (UTF-8 modificado). Acentos funcionam; emoji ou outro caractere fora do BMP
  quebraria. Devolver `byte[]` e decodificar em Java resolve, se precisar.
- **RAM:** com o repack para CPU, os pesos ficam todos residentes (~1,7 GB no total). Celulares com 4 GB ficam apertados.
- **Qualidade:** a gramática garante o formato, não o acerto. Com o prompt de teste, o modelo marcou `correct: true` em
  "She don't like coffee." mesmo corrigindo a frase. O prompt da correção (e talvez a ordem das chaves, com
  `corrected_en` antes de `correct`) merece atenção na Task 6.
