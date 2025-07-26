import { CactusTTS, initLlama } from "cactus-react-native";
import { useEffect } from "react";

interface TTSComponentProps {
  message: string;
}

export default function TTSComponent({ message }: TTSComponentProps) {
  useEffect(() => {
    (async () => {
      // Initialize a LLM for TTS
      const context = await initLlama({
        model: "/path/to/tts-model.gguf", // path to TTS model file
        n_ctx: 1024,
      });
      const tts = await CactusTTS.init(context, "/path/to/vocoder.gguf");
      const audio = await tts.generate(message, '{"speaker_id": 0}');
      await tts.release();
    })();
  }, [message]);

  return null;
}
