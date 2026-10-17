// Minimal JNI over llama.cpp: load / complete (GBNF) / stop / release.
#include <jni.h>
#include <android/log.h>
#include <atomic>
#include <string>
#include <vector>
#include <thread>
#include <algorithm>
#include "llama.h"

#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, "llamajni", __VA_ARGS__)

static llama_model *g_model = nullptr;
static llama_context *g_ctx = nullptr;
static std::atomic<bool> g_stop{false};
static int g_last_tokens = 0;

static std::string jstr(JNIEnv *env, jstring s) {
    const char *c = env->GetStringUTFChars(s, nullptr);
    std::string r(c);
    env->ReleaseStringUTFChars(s, c);
    return r;
}

static void log_cb(ggml_log_level, const char *text, void *) { __android_log_write(ANDROID_LOG_INFO, "llama", text); }

static void release_all() {
    if (g_ctx) llama_free(g_ctx);
    if (g_model) llama_model_free(g_model);
    g_ctx = nullptr;
    g_model = nullptr;
}

// UTF-8 bytes, decoded in Java: NewStringUTF (modified UTF-8) breaks characters outside the BMP (emoji).
static jbyteArray bytes(JNIEnv *env, const std::string &s) {
    jbyteArray a = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(a, 0, (jsize) s.size(), (const jbyte *) s.data());
    return a;
}

extern "C" JNIEXPORT jstring JNICALL
Java_io_github_yagoramires_ingles_LlamaPlugin_nativeLoad(JNIEnv *env, jclass, jstring path, jint nCtx) {
    llama_log_set(log_cb, nullptr);
    llama_backend_init();
    release_all(); // a second load must not leak the first model
    g_stop = false;
    auto mp = llama_model_default_params();
    g_model = llama_model_load_from_file(jstr(env, path).c_str(), mp);
    if (!g_model) return env->NewStringUTF("llama_model_load_from_file failed");
    auto cp = llama_context_default_params();
    cp.n_ctx = nCtx;
    cp.n_batch = 512;
    int threads = std::max(1, std::min(4, (int) std::thread::hardware_concurrency()));
    cp.n_threads = threads;
    cp.n_threads_batch = threads;
    // ggml checks this between graph nodes, so stop() also interrupts a long prompt decode
    cp.abort_callback = [](void *) { return g_stop.load(); };
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) return env->NewStringUTF("llama_init_from_model failed");
    return nullptr;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_io_github_yagoramires_ingles_LlamaPlugin_nativeComplete(JNIEnv *env, jclass, jstring jprompt, jstring jgrammar,
                                                jint maxTokens, jfloat temp, jint seed) {
    if (!g_ctx) return nullptr;
    g_stop = false;
    g_last_tokens = 0;
    const llama_vocab *vocab = llama_model_get_vocab(g_model);
    std::string prompt = jstr(env, jprompt), grammar = jstr(env, jgrammar);

    std::vector<llama_token> toks(prompt.size() + 16);
    int n = llama_tokenize(vocab, prompt.c_str(), (int) prompt.size(), toks.data(), (int) toks.size(), true, true);
    toks.resize(std::max(n, 0));

    llama_memory_clear(llama_get_memory(g_ctx), true);
    auto chain = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (!grammar.empty()) {
        auto g = llama_sampler_init_grammar(vocab, grammar.c_str(), "root");
        if (!g) { llama_sampler_free(chain); return nullptr; }
        llama_sampler_chain_add(chain, g);
    }
    if (temp <= 0) llama_sampler_chain_add(chain, llama_sampler_init_greedy());
    else {
        llama_sampler_chain_add(chain, llama_sampler_init_temp(temp));
        llama_sampler_chain_add(chain, llama_sampler_init_dist((uint32_t) seed));
    }

    std::string out;
    if (llama_decode(g_ctx, llama_batch_get_one(toks.data(), (int) toks.size())) == 0) {
        for (int i = 0; i < maxTokens && !g_stop; i++) {
            llama_token t = llama_sampler_sample(chain, g_ctx, -1);
            if (llama_vocab_is_eog(vocab, t)) break;
            char buf[256];
            int len = llama_token_to_piece(vocab, t, buf, sizeof buf, 0, true);
            if (len > 0) out.append(buf, len);
            g_last_tokens++;
            if (llama_decode(g_ctx, llama_batch_get_one(&t, 1)) != 0) break;
        }
    }
    llama_sampler_free(chain);
    return bytes(env, out);
}

extern "C" JNIEXPORT jint JNICALL
Java_io_github_yagoramires_ingles_LlamaPlugin_nativeLastTokens(JNIEnv *, jclass) { return g_last_tokens; }

extern "C" JNIEXPORT void JNICALL
Java_io_github_yagoramires_ingles_LlamaPlugin_nativeStop(JNIEnv *, jclass) { g_stop = true; }

extern "C" JNIEXPORT void JNICALL
Java_io_github_yagoramires_ingles_LlamaPlugin_nativeRelease(JNIEnv *, jclass) { release_all(); }
