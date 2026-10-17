package io.github.yagoramires.ingles;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LlamaPlugin.class); // local plugin: must be registered before super.onCreate
        super.onCreate(savedInstanceState);
    }
}
