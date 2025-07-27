export const TTSConfig = {
  model: {
    url: "https://huggingface.co/mradermacher/indri-0.1-350m-tts-GGUF/resolve/main/indri-0.1-350m-tts.Q4_K_M.gguf",
    filename: "tts-model.gguf",
  },
  vocoder: {
    url: "",
    filename: "vocoder-model.gguf",
  },
  generateOptions: {
    speaker_id: 0,
  },
};
