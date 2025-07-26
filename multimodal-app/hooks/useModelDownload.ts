import { useState, useCallback } from "react";
import * as FileSystem from "expo-file-system";
import { useScopedStorage } from "@/utils/storage";
import { checkAndroidVersion } from "@/utils/permissions";

interface DownloadProgress {
  progress: number;
  isDownloading: boolean;
  error: string | null;
}

export const useModelDownload = () => {
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map()
  );

  // ADD: Scoped storage setup
  const getStoragePath = useCallback(
    async (filename: string): Promise<string> => {
      if (await checkAndroidVersion()) {
        try {
          const directories = await useScopedStorage();
          if (directories && directories.models) {
            return `${directories.models}${filename}`;
          }
        } catch (error) {
          console.warn(
            "Scoped storage failed, falling back to DocumentDirectory:",
            error
          );
        }
      }

      // Fallback to RNFS DocumentDirectory for older Android or iOS
      return `${FileSystem.documentDirectory}${filename}`;
    },
    []
  );

  //  ADD: Check Directory Existence
  const ensureDirectoryExists = useCallback(
    async (filePath: string): Promise<void> => {
      const directory = filePath.substring(0, filePath.lastIndexOf("/"));

      try {
        const exists = await FileSystem.getInfoAsync(directory);
        if (!exists) {
          await FileSystem.makeDirectoryAsync(directory, {
            intermediates: true,
          });
          console.log("Created directory:", directory);
        }
      } catch (error) {
        console.warn("Directory creation failed:", error);
      }
    },
    []
  );

  const downloadModel = useCallback(
    async (url: string, filename: string): Promise<string> => {
      try {
        const path = await getStoragePath(filename);

        // Ensure the directory exists
        await ensureDirectoryExists(path);

        // Check if file already exists
        const fileInfo = await FileSystem.getInfoAsync(path);
        if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
          console.log(`Model ${filename} already exists at: ${path}`);

          // Update state to show it's complete
          setDownloads(
            (prev) =>
              new Map(
                prev.set(filename, {
                  progress: 1,
                  isDownloading: false,
                  error: null,
                })
              )
          );

          return path;
        }

        console.log(`Starting download of ${filename} to: ${path}`);

        // Initialize download state
        setDownloads(
          (prev) =>
            new Map(
              prev.set(filename, {
                progress: 0,
                isDownloading: true,
                error: null,
              })
            )
        );

        // Create download resumable for progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
          url,
          path,
          {},
          (downloadProgress) => {
            const progress =
              downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite;
            console.log(
              `Download progress for ${filename}: ${(progress * 100).toFixed(
                1
              )}%`
            );

            setDownloads(
              (prev) =>
                new Map(
                  prev.set(filename, {
                    progress,
                    isDownloading: true,
                    error: null,
                  })
                )
            );
          }
        );

        // Start download
        const result = await downloadResumable.downloadAsync();

        if (result && result.status === 200) {
          // Download Complete
          setDownloads(
            (prev) =>
              new Map(
                prev.set(filename, {
                  progress: 1,
                  isDownloading: false,
                  error: null,
                })
              )
          );

          console.log(`Download completed for ${filename}: ${path}`);
          return path;
        } else {
          throw new Error(`Download failed with status: ${result?.status}`);
        }
      } catch (error) {
        console.error(`Download error for ${filename}:`, error);

        setDownloads(
          (prev) =>
            new Map(
              prev.set(filename, {
                progress: 0,
                isDownloading: false,
                error:
                  typeof error === "object" &&
                  error !== null &&
                  "message" in error
                    ? String((error as { message?: unknown }).message)
                    : String(error),
              })
            )
        );
        throw error;
      }
    },
    [getStoragePath, ensureDirectoryExists]
  );

  // ADD: Get Model Path
  const getModelPath = useCallback(
    async (filename: string): Promise<string | null> => {
      try {
        const path = await getStoragePath(filename);
        const fileInfo = await FileSystem.getInfoAsync(path);
        return fileInfo.exists ? path : null;
      } catch (error) {
        console.error(`Error checking model path for ${filename}:`, error);
        return null;
      }
    },
    [getStoragePath]
  );

  // ADD: Delete Model
  const deleteModel = useCallback(
    async (filename: string): Promise<boolean> => {
      try {
        const path = await getStoragePath(filename);
        const fileInfo = await FileSystem.getInfoAsync(path);

        if (fileInfo.exists) {
          await FileSystem.deleteAsync(path);

          // Clear download state
          setDownloads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(filename);
            return newMap;
          });

          console.log(`Deleted model: ${filename}`);
          return true;
        }

        return false;
      } catch (error) {
        console.error(`Error deleting model ${filename}:`, error);
        return false;
      }
    },
    [getStoragePath]
  );

  // ADD: Clear Download State
  const clearDownload = useCallback((filename: string) => {
    setDownloads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(filename);
      return newMap;
    });
  }, []);

  return {
    downloadModel,
    downloads,
    getModelPath,
    deleteModel,
    clearDownload,
  };
};
