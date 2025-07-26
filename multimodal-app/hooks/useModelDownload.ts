import { useState, useCallback } from "react";
import RNFS from "react-native-fs";

interface DownloadProgress {
  progress: number;
  isDownloading: boolean;
  error: string | null;
}

export const useModelDownload = () => {
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(
    new Map()
  );

  const downloadModel = useCallback(
    async (url: string, filename: string): Promise<string> => {
      const path = `${RNFS.DocumentDirectoryPath}/${filename}`;

      if (await RNFS.exists(path)) {
        const stats = await RNFS.stat(path);
        if (stats.size > 0) return path;
      }

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

      try {
        await RNFS.downloadFile({
          fromUrl: url,
          toFile: path,
          progress: (res) => {
            const progress = res.bytesWritten / res.contentLength;
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
          },
        }).promise;

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
      } catch (error) {
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
    []
  );

  return { downloadModel, downloads };
};
