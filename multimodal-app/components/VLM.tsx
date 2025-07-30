import React, { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { CactusVLM } from "cactus-react-native";
import { VLMConfig } from "@/config/vlmConfig";
import { useModelDownload } from "@/hooks/useModelDownload";
import { useScopedStorage, cleanPath } from "@/utils/storage";
import {
  checkAndroidVersion,
  requestStoragePermission,
} from "@/utils/permissions";

export default function VisionChat() {
  const { downloadModel, downloads } = useModelDownload();
  const [error, setError] = useState<string | null>(null);
  const [vlm, setVLM] = useState<CactusVLM | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    initializeVLM();
    return () => {
      vlm?.release();
    };
  }, []);

  const initializeVLM = async () => {
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
    try {
      console.log("Starting model downloads...");
      const modelPath = await downloadModel(
        VLMConfig.model.url,
        VLMConfig.model.filename
      );
      const mmprojPath = await downloadModel(
        VLMConfig.mmproj.url,
        VLMConfig.mmproj.filename
      );

      console.log("Model path:", modelPath);
      console.log("MMProj path:", mmprojPath);
      const { vlm: model, error } = await CactusVLM.init({
        model: cleanPath(modelPath),
        mmproj: cleanPath(mmprojPath),
        n_ctx: 2048,
      });

      if (error) throw error;
      setVLM(model);
    } catch (error) {
      console.error("Failed to initialize VLM:", error);
      Alert.alert("Error", "Failed to initialize vision model");
      setError("Failed to initialize vision model");
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = () => {
    launchImageLibrary(
      {
        mediaType: "photo",
        quality: 0.8,
        includeBase64: false,
      },
      async (response) => {
        if (response.assets && response.assets[0]) {
          const rawUri = response.assets[0].uri!;
          console.log("Raw URI from picker:", rawUri);

          try {
            if (!FileSystem.documentDirectory) {
              Alert.alert("Error", "Document directory is not available.");
              return;
            }

            // ADD: Create a directory for images if it doesn't exist
            const imagesDir = FileSystem.documentDirectory + "images/";
            const dirInfo = await FileSystem.getInfoAsync(imagesDir);
            if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(imagesDir, {
                intermediates: true,
              });
              console.log("Created images directory:", imagesDir);
            }

            // ADD: Copy the image to the new path
            const extension = rawUri.split(".").pop() || "jpg";
            const filename = `img_${Date.now()}.${extension}`;
            const destPath = imagesDir + filename;
            await FileSystem.copyAsync({
              from: rawUri,
              to: destPath,
            });

            console.log("Copied image to:", destPath);

            setImagePath(destPath);
            setResponse("");
          } catch (copyError) {
            console.error("Failed to copy image file:", copyError);
            Alert.alert("Error", "Failed to access image file");
          }
        }
      }
    );
  };

  const analyzeImage = async () => {
    if (!vlm || !imagePath) return;
    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    if (!fileInfo.exists) {
      Alert.alert(
        "Error",
        "Image file does not exist anymore. Please pick again."
      );
      setImagePath(null);
      return;
    }
    setIsAnalyzing(true);
    const pathToAnalyze = imagePath.replace("file://", "");
    try {
      console.log("Analyzing image at path:", imagePath);

      const messages = [
        { role: "user", content: "Describe this image in detail" },
      ];

      let analysisResponse = "";
      const result = await vlm.completion(
        messages,
        {
          images: [pathToAnalyze],
          n_predict: 300,
          temperature: 0.3,
        },
        (token) => {
          analysisResponse += token.token;
          setResponse(analysisResponse);
        }
      );

      console.log("Analysis result:", result.text);
      setResponse(analysisResponse || result.text);
    } catch (error) {
      console.error("Analysis failed:", error);
      resetVLMContext();
      Alert.alert("Error", "Failed to analyze image");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ADD: Reset VLM state
  const resetVLMContext = async () => {
    if (!vlm) return;
    try {
      setVLM(null);
      await initializeVLM();
      setResponse("");
    } catch (error) {
      console.error("Failed to rewind VLM context:", error);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading vision model...</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Vision Chat
      </Text>

      {imagePath && (
        <Image
          source={{ uri: imagePath }}
          style={{
            width: "100%",
            height: 200,
            borderRadius: 8,
            marginBottom: 16,
          }}
          resizeMode="contain"
        />
      )}

      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <TouchableOpacity
          onPress={pickImage}
          style={{
            backgroundColor: "#007AFF",
            padding: 12,
            borderRadius: 8,
            marginRight: 8,
            flex: 1,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            Pick Image
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={analyzeImage}
          disabled={!imagePath || isAnalyzing}
          style={{
            backgroundColor: !imagePath || isAnalyzing ? "#cccccc" : "#34C759",
            padding: 12,
            borderRadius: 8,
            flex: 1,
          }}
        >
          <Text
            style={{
              color: "white",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: "#f8f8f8",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <Text style={{ fontSize: 16, lineHeight: 24 }}>
          {response || "Select an image and tap Analyze to get started"}
        </Text>
      </View>
    </View>
  );
}
