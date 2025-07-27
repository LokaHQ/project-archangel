import { CactusLM } from "cactus-react-native";

/**
 * Creates and manages a collection of loaded CactusLM language models.
 * Ensures each model is initialized only once and provides release utilities.
 *
 * @returns An object containing methods to load and release models.
 */
export function createModelManager() {
  const models = new Map<string, CactusLM>();

  /**
   * Loads a language model if not already loaded.
   *
   * @param name - A unique identifier for the model (e.g., "main-lm").
   * @param modelPath - The file path to the `.gguf` model file.
   * @returns The initialized CactusLM instance.
   * @throws If initialization fails or no model is returned.
   */
  async function loadLM(name: string, modelPath: string): Promise<CactusLM> {
    if (models.has(name)) {
      return models.get(name) as CactusLM;
    }

    const { lm, error } = await CactusLM.init({
      model: modelPath,
      n_ctx: 2048,
    });

    if (error) throw error;
    if (!lm) throw new Error("Failed to initialize CactusLM model.");
    models.set(name, lm);
    return lm;
  }

  /**
   * Releases a specific model by name and removes it from memory.
   *
   * @param name - The model's identifier used during loading.
   */
  async function releaseModel(name: string): Promise<void> {
    const model = models.get(name);
    if (model) {
      await model.release();
      models.delete(name);
    }
  }

  /**
   * Releases all currently loaded models and clears the internal map.
   */
  async function releaseAll(): Promise<void> {
    await Promise.all(
      Array.from(models.values()).map((model) => model.release())
    );
    models.clear();
  }

  return {
    loadLM,
    releaseModel,
    releaseAll,
  };
}
