import { CactusTTS, initLlama, LlamaContext } from "cactus-react-native";
import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system";

import { TTSConfig } from "@/config/ttsConfig";
import { useModelDownload } from "@/hooks/useModelDownload";
import {
  requestStoragePermission,
  checkAndroidVersion,
} from "@/utils/permissions";
import { useScopedStorage, cleanPath } from "@/utils/storage";
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

        if (await checkAndroidVersion()) {
          // Modern Android - Initialize scoped storage
          console.log("Using modern Android storage approach");
          try {
            const directories = await useScopedStorage();
            if (!directories) {
              setError("Failed to initialize scoped storage.");
              return;
            }
            console.log("Scoped storage initialized:", directories.models);
          } catch (storageError) {
            console.error("Scoped storage setup failed:", storageError);
            setError("Storage setup failed.");
            return;
          }
        } else {
          // Request permissions
          console.log("Using legacy storage approach");
          const hasPermission = await requestStoragePermission();
          if (!hasPermission) {
            setError("Storage permission denied.");
            return;
          }
        }

        // Download models
        console.log("Starting model downloads...");
        const ttsModelPath = await downloadModel(
          TTSConfig.model.url,
          TTSConfig.model.filename
        );

        // ADD: Check if vocoder is needed
        let vocoderPath = undefined;
        if (TTSConfig.vocoder.url) {
          vocoderPath = await downloadModel(
            TTSConfig.vocoder.url,
            TTSConfig.vocoder.filename
          );
        }

        if (!ttsModelPath || (TTSConfig.vocoder.url && !vocoderPath)) {
          setError("Failed to download required models.");
          return;
        }

        console.log("Models downloaded, initializing TTS...");
        console.log("TTS Model Path:", ttsModelPath);
        console.log("Vocoder Path:", vocoderPath);

        // DEBUG: Verify files actually exist at these paths
        try {
          const ttsFileInfo = await FileSystem.getInfoAsync(ttsModelPath);
          const vocoderFileInfo = vocoderPath
            ? await FileSystem.getInfoAsync(vocoderPath)
            : { exists: true, size: 0 };

          console.log("TTS Model exists:", ttsFileInfo.exists);
          console.log("Vocoder exists:", vocoderFileInfo.exists);

          if (ttsFileInfo.exists) {
            console.log("TTS Model size:", ttsFileInfo.size, "bytes");
          }

          if (vocoderFileInfo.exists) {
            console.log("Vocoder size:", vocoderFileInfo.size, "bytes");
          }

          if (!ttsFileInfo.exists || !vocoderFileInfo.exists) {
            setError(
              `Model files not found. TTS: ${ttsFileInfo.exists}, Vocoder: ${vocoderFileInfo.exists}`
            );
            return;
          }
        } catch (fileCheckError) {
          console.error("Error checking file existence:", fileCheckError);
          setError("Failed to verify model files.");
          return;
        }

        // Init LLM
        const context = await initLlama({
          model: cleanPath(ttsModelPath),
        });

        // Init TTS and Speaking
        const tts = await CactusTTS.init(context, vocoderPath || ttsModelPath);
        await tts.generate(message, JSON.stringify(TTSConfig.generateOptions));
        await tts.release();

        setIsReady(true);
        console.log("TTS initialization complete!");
      } catch (e) {
        console.error("TTS error:", e);
        setError(String(e));
      }
    })();
  }, [message]);

  // Get current download progress for models
  const ttsProgress = downloads.get(TTSConfig.model.filename)?.progress || 0;
  const vocoderProgress =
    downloads.get(TTSConfig.vocoder.filename)?.progress || 0;
  const ttsError = downloads.get(TTSConfig.model.filename)?.error;
  const vocoderError = downloads.get(TTSConfig.vocoder.filename)?.error;

  return (
    <View style={{ padding: 20 }}>
      {error && <Text style={{ color: "red" }}>Error: {error}</Text>}

      {ttsError && (
        <Text style={{ color: "red" }}>TTS Model Error: {ttsError}</Text>
      )}
      {vocoderError && (
        <Text style={{ color: "red" }}>Vocoder Error: {vocoderError}</Text>
      )}

      {!isReady && !error && (
        <>
          <Text>TTS Model Download: {(ttsProgress * 100).toFixed(1)}%</Text>
          <Text>Vocoder Download: {(vocoderProgress * 100).toFixed(1)}%</Text>
          <ActivityIndicator size="small" color="#FF69B4" />
        </>
      )}

      {isReady && !error && <Text>TTS is ready and playing your message!</Text>}
    </View>
  );
}
