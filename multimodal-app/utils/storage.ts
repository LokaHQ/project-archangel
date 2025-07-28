import * as FileSystem from "expo-file-system";

/**
 * Provides app-specific directories for scoped storage on the device.
 *
 * - Uses directories that do NOT require special permissions.
 * - Ensures a "models" directory exists inside the document directory.
 *
 * @returns {Promise<{documents: string; cache: string; models: string} | null>}
 *   An object with paths for documents, cache, and models directories, or null on error.
 */
export async function useScopedStorage() {
  // Use app-specific directories that don't require permissions
  const directories = {
    documents: FileSystem.documentDirectory,
    cache: FileSystem.cacheDirectory,
    // Create a models directory in documents
    models: FileSystem.documentDirectory + "models/",
  };

  try {
    // Ensure models directory exists
    const modelsDir = await FileSystem.getInfoAsync(directories.models);
    if (!modelsDir.exists) {
      await FileSystem.makeDirectoryAsync(directories.models, {
        intermediates: true,
      });
      console.log("Created models directory at:", directories.models);
    }

    return directories;
  } catch (error) {
    console.error("Error setting up scoped storage:", error);
    return null;
  }
}

/**
 * Cleans a file path by removing the "file://" prefix if present.
 *
 * @param {string} path - The file path to clean.
 * @returns {string} The cleaned file path without the "file://" prefix.
 */
export function cleanPath(path: string): string {
  return path.replace(/^file:\/\//, "");
}

/**
 * Normalizes a file path by cleaning it and converting backslashes to forward slashes.
 *
 * @param {string} path - The file path to normalize.
 * @returns {string} The normalized file path with forward slashes.
 */
export function normalizePath(path: string): string {
  return cleanPath(path).replace(/\\/g, "/");
}
