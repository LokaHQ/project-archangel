import * as FileSystem from "expo-file-system";

export async function useScopedStorage() {
  // Use app-specific directories that don't require permissions
  const directories = {
    // App's private directory (no permission required)
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

export function cleanPath(path: string): string {
  return path.replace(/^file:\/\//, "");
}

export function normalizePath(path: string): string {
  return cleanPath(path).replace(/\\/g, "/");
}
