import { CactusTTS, initLlama } from "cactus-react-native";
import { useEffect, useState } from "react";
import RNFS from "react-native-fs";

import { TTSConfig } from "@/config/ttsConfig";
import { useModelDownload } from "@/hooks/useModelDownload";
import {
  requestStoragePermission,
  checkAndroidVersion,
} from "@/utils/permissions";
import { useScopedStorage } from "@/utils/storage";
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
          // Modern Android (11+) - Initialize scoped storage
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
          // Legacy Android or iOS - Request permissions
          console.log("Using legacy storage approach");
          const hasPermission = await requestStoragePermission();
          if (!hasPermission) {
            setError("Storage permission denied.");
            return;
          }
        }

        // Download models (paths are now automatically cleaned)
        console.log("Starting model downloads...");
        const ttsModelPath = await downloadModel(
          TTSConfig.model.url,
          TTSConfig.model.filename
        );
        const vocoderPath = await downloadModel(
          TTSConfig.vocoder.url,
          TTSConfig.vocoder.filename
        );

        if (!ttsModelPath || !vocoderPath) {
          setError("Failed to download required models.");
          return;
        }

        console.log("Models downloaded, initializing TTS...");
        console.log("TTS Model Path:", ttsModelPath);
        console.log("Vocoder Path:", vocoderPath);

        // Debug: Verify files actually exist at these paths
        try {
          const ttsExists = await RNFS.exists(ttsModelPath);
          const vocoderExists = await RNFS.exists(vocoderPath);
          
          console.log("TTS Model exists:", ttsExists);
          console.log("Vocoder exists:", vocoderExists);
          
          if (ttsExists) {
            const ttsStats = await RNFS.stat(ttsModelPath);
            console.log("TTS Model size:", ttsStats.size, "bytes");
          }
          
          if (vocoderExists) {
            const vocoderStats = await RNFS.stat(vocoderPath);
            console.log("Vocoder size:", vocoderStats.size, "bytes");
          }
          
          if (!ttsExists || !vocoderExists) {
            setError(`Model files not found. TTS: ${ttsExists}, Vocoder: ${vocoderExists}`);
            return;
          }
        } catch (fileCheckError) {
          console.error("Error checking file existence:", fileCheckError);
          setError("Failed to verify model files.");
          return;
        }

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

      {isReady && !error && (
        <Text>🎉 TTS is ready and playing your message!</Text>
      )}
    </View>
  );
}