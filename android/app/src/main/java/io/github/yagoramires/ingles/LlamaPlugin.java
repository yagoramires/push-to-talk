package io.github.yagoramires.ingles;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Minimal llama.cpp bridge (src/main/cpp/llamajni.cpp); the JS side is src/mobile/llm-native.ts. */
@CapacitorPlugin(name = "Llama")
public class LlamaPlugin extends Plugin {
    static { System.loadLibrary("llamajni"); }

    static native String nativeLoad(String path, int nCtx);
    static native byte[] nativeComplete(String prompt, String grammar, int maxTokens, float temp, int seed);
    static native int nativeLastTokens();
    static native void nativeStop();
    static native void nativeRelease();

    // one worker thread: llama context is not thread safe; stop() runs on the bridge thread
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void load(PluginCall call) {
        String path = call.getString("modelPath", "").replaceFirst("^file://", "");
        int nCtx = call.getInt("nCtx", 2048);
        worker.execute(() -> {
            long t0 = System.nanoTime();
            String err = nativeLoad(path, nCtx);
            if (err != null) { call.reject(err); return; }
            JSObject r = new JSObject();
            r.put("ms", (System.nanoTime() - t0) / 1e6);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void complete(PluginCall call) {
        String prompt = call.getString("prompt", "");
        String grammar = call.getString("grammar", "");
        int maxTokens = call.getInt("maxTokens", 256);
        float temp = call.getFloat("temperature", 0f);
        int seed = call.getInt("seed", 0);
        worker.execute(() -> {
            long t0 = System.nanoTime();
            byte[] out = nativeComplete(prompt, grammar, maxTokens, temp, seed);
            if (out == null) { call.reject("model not loaded, grammar parse failed or prompt decode failed"); return; }
            String text = new String(out, StandardCharsets.UTF_8);
            double ms = (System.nanoTime() - t0) / 1e6;
            int n = nativeLastTokens();
            JSObject r = new JSObject();
            r.put("text", text);
            r.put("tokens", n);
            r.put("ms", ms);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) { nativeStop(); call.resolve(); }

    @PluginMethod
    public void release(PluginCall call) { worker.execute(() -> { nativeRelease(); call.resolve(); }); }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        ((ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(mi);
        JSObject r = new JSObject();
        r.put("totalRam", mi.totalMem);
        r.put("cores", Runtime.getRuntime().availableProcessors());
        r.put("cpuModel", Build.VERSION.SDK_INT >= 31 ? Build.SOC_MODEL : Build.HARDWARE);
        call.resolve(r);
    }
}
