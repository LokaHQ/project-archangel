import { CactusTTS, initLlama } from "cactus-react-native";
import { useEffect, useState } from "react";

import { TTSConfig } from "@/config/ttsConfig";
import { useModelDownload } from "@/hooks/useModelDownload";
import { requestStoragePermission } from "@/utils/permissions";
import { View, Text, ActivityIndicator } from "react-native";

export default function TTSComponent({ message }: { message: string }) {
  const { downloadModel, downloads } = useModelDownload();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsReady(false);
        setError(null);

        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          setError("Storage permission denied.");
          return;
        }

        // Download models
        const ttsModelPath = await downloadModel(
          TTSConfig.model.url,
          TTSConfig.model.filename
        );
        const vocoderPath = await downloadModel(
          TTSConfig.vocoder.url,
          TTSConfig.vocoder.filename
        );

        // Init LLM
        const context = await initLlama({
          model: ttsModelPath,
          ...TTSConfig.llamaOptions,
        });

        // Init TTS and Speaking
        const tts = await CactusTTS.init(context, vocoderPath);
        await tts.generate(message, JSON.stringify(TTSConfig.generateOptions));
        await tts.release();

        setIsReady(true);
      } catch (e) {
        console.error("TTS error:", e);
        setError(String(e));
      }
    })();
  }, [message]);

  // Get current download progress for models
  const ttsProgress = downloads.get(TTSConfig.model.filename)?.progress || 0;
  const vocoderProgress = downloads.get(TTSConfig.vocoder.filename)?.progress || 0;
  const ttsError = downloads.get(TTSConfig.model.filename)?.error;
  const vocoderError = downloads.get(TTSConfig.vocoder.filename)?.error;

  return (
    <View style={{ padding: 20 }}>
      {error && <Text style={{ color: "red" }}>Error: {error}</Text>}

      {ttsError && <Text style={{ color: "red" }}>TTS Model Error: {ttsError}</Text>}
      {vocoderError && <Text style={{ color: "red" }}>Vocoder Error: {vocoderError}</Text>}

      {!isReady && (
        <>
          <Text>TTS Model Download: {(ttsProgress * 100).toFixed(1)}%</Text>
          <Text>Vocoder Download: {(vocoderProgress * 100).toFixed(1)}%</Text>
          <ActivityIndicator size="small" color="#FF69B4" />
        </>
      )}

      {isReady && !error && <Text> TTS is ready and playing your message!</Text>}
    </View>
  );
}
