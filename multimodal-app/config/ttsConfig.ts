export const TTSConfig = {
  model: {
    url: "https://huggingface.co/Cactus-Compute/OuteTTS-0.2-500M-GGUF/resolve/main/model.gguf",
    filename: "tts-model.gguf",
  },
  vocoder: {
    url: "https://huggingface.co/Cactus-Compute/OuteTTS-0.2-500M-GGUF/resolve/main/vocoder.gguf",
    filename: "vocoder.gguf",
  },
  llamaOptions: {
    n_ctx: 1024,
  },
  generateOptions: {
    speaker_id: 0,
  },
};
