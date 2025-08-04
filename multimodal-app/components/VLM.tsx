/**
 * VLM.tsx
 *
 * A React Native component that provides real-time computer vision analysis
 * using camera feed. Features include continuous image capture, VLM-powered
 * analysis, chat-like conversation history, and customizable capture intervals.
 *
 * Supports both automatic interval-based capture and on-demand analysis
 * with user-defined prompts. Includes storage management for both modern
 * and legacy Android versions.
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { CactusVLM } from "cactus-react-native";
import { VLMConfig } from "@/config/vlmConfig";
import { useModelDownload } from "@/hooks/useModelDownload";
import { useScopedStorage, cleanPath } from "@/utils/storage";
import { cleanText } from "@/utils/text";
import {
  checkAndroidVersion,
  requestStoragePermission,
} from "@/utils/permissions";
import ParallaxScrollView from "@/components/predefined/ParallaxScrollView";

/**
 * Represents a single analysis result in the conversation history
 */
type AnalysisHistoryItem = {
  /** The VLM's analysis response text */
  text: string;
  /** Timestamp when the analysis was completed */
  timestamp: string;
  /** The user prompt or "Auto" for interval captures */
  prompt: string;
};

/**
 * VisionChat
 *
 * Main camera component that:
 * - Initializes and manages VLM (Vision Language Model)
 * - Handles continuous or on-demand image capture
 * - Provides real-time analysis with chat-like interface
 * - Manages storage permissions and model downloads
 * - Supports customizable capture intervals and prompts
 */
export default function VisionChat() {
  const { downloadModel } = useModelDownload();
  const [permission, requestPermission] = useCameraPermissions();
  const [vlm, setVLM] = useState<CactusVLM | null>(null);
  const [isVLMLoading, setIsVLMLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(3000);
  const [facing, setFacing] = useState<CameraType>("back");

  // Refs for camera and processing management
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<number | null>(null);
  const analysisQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  // ADD: Modle toggle state
  const [captureMode, setCaptureMode] = useState<"interval" | "onDemand">(
    "interval"
  );
  const [userPrompt, setUserPrompt] = useState("Describe what's ahead of me.");
  const [showIntervalControls, setShowIntervalControls] = useState(false);

  // ADD: History state
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>(
    []
  );

  /**
   * Effect: Initialize VLM on component mount and cleanup on unmount
   */
  useEffect(() => {
    initializeVLM();
    return () => {
      vlm?.release();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  /**
   * Effect: Manage continuous capture based on active state and permissions
   */
  useEffect(() => {
    if (captureMode === "interval" && isActive && vlm && permission?.granted) {
      startContinuousCapture();
    } else {
      stopContinuousCapture();
    }

    return () => stopContinuousCapture();
  }, [isActive, vlm, permission?.granted, captureMode]);

  /**
   * Initializes the Vision Language Model with proper storage setup
   * Handles both modern Android scoped storage and legacy permission-based storage
   */
  const initializeVLM = async () => {
    try {
      if (await checkAndroidVersion()) {
        console.log("Using modern Android storage approach");
        const directories = await useScopedStorage();
        if (!directories) {
          Alert.alert("Error", "Failed to initialize scoped storage.");
          return;
        }
      } else {
        console.log("Using legacy storage approach");
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert("Error", "Storage permission denied.");
          return;
        }
      }

      console.log("Starting model downloads...");
      const modelPath = await downloadModel(
        VLMConfig.model.url,
        VLMConfig.model.filename
      );
      const mmprojPath = await downloadModel(
        VLMConfig.mmproj.url,
        VLMConfig.mmproj.filename
      );

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
    } finally {
      setIsVLMLoading(false);
    }
  };

  //ADD: Camera Capture
  /**
   * Starts continuous image capture at specified intervals
   * Captures first frame immediately, then continues at set interval
   */
  const startContinuousCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      captureAndAnalyze();
    }, captureInterval);

    // Capture first frame immediately
    captureAndAnalyze();
  };

  /**
   * Stops continuous capture by clearing the interval timer
   */
  const stopContinuousCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  //ADD: Analyze frame captured by camera
  /**
   * Captures a photo from the camera and adds it to the analysis queue
   * Uses reduced quality (0.3) for faster processing
   */
  const captureAndAnalyze = async () => {
    if (!cameraRef.current || !vlm || isProcessingRef.current) {
      return;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
      });

      if (photo?.uri) {
        // Add to analysis queue
        analysisQueueRef.current.push(photo.uri);
        processAnalysisQueue();
      }
    } catch (error) {
      console.error("Failed to capture photo:", error);
    }
  };

  // CHANGE: Process analysis queue can take optional prompt
  /**
   * Processes the analysis queue using VLM for image understanding
   * Only processes the latest image to avoid lag from multiple queued images
   *
   * @param prompt - Optional custom prompt for analysis, defaults to generic description
   */
  const processAnalysisQueue = async (prompt?: string) => {
    if (isProcessingRef.current || analysisQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    setIsAnalyzing(true);

    // Lates image only
    const latestImageUri = analysisQueueRef.current.pop();
    analysisQueueRef.current = [];

    if (!latestImageUri || !vlm) {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
      return;
    }

    try {
      //ADD: Create a temporary directory for captured images
      const imagesDir = FileSystem.documentDirectory + "temp_images/";
      const dirInfo = await FileSystem.getInfoAsync(imagesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(imagesDir, {
          intermediates: true,
        });
      }

      const filename = `temp_${Date.now()}.jpg`;
      const destPath = imagesDir + filename;
      await FileSystem.copyAsync({
        from: latestImageUri,
        to: destPath,
      });

      // Analyze image
      const pathToAnalyze = destPath.replace("file://", "");
      const messages = [
        {
          role: "user",
          content: prompt || "Briefly describe what you see in this image",
        },
      ];

      let analysisResponse = "";
      const result = await vlm.completion(
        messages,
        {
          images: [pathToAnalyze],
          n_predict: 100,
          temperature: 0.3,
        },
        (token) => {
          analysisResponse += token.token;
          console.log("Token received:", token.token);
          setCurrentAnalysis(analysisResponse);
        }
      );

      // ADD: Handle final state and history
      const rawText =
        analysisResponse.trim() ||
        result.text?.trim() ||
        "Analysis completed but no text returned";
      const finalText = cleanText(rawText);
      setCurrentAnalysis(finalText);
      setAnalysisHistory((prev) => [
        {
          text: finalText,
          timestamp: new Date().toLocaleTimeString(),
          prompt: prompt || "Auto",
        },
        ...prev,
      ]);

      console.log("Final analysis result:", result.text);
      console.log("Accumulated response:", analysisResponse);

      // Clean up temporary image
      await FileSystem.deleteAsync(destPath, { idempotent: true });
    } catch (error) {
      console.error("Analysis failed:", error);
      // Reset VLM on error
      resetVLMContext();
    } finally {
      isProcessingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  // ADD: User prompt handling
  /**
   * Handles user-initiated analysis with custom prompt
   * Captures a photo and processes it with the user's question
   */
  const handleUserPromptSubmit = async () => {
    if (!cameraRef.current || !vlm || isProcessingRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
      });

      if (photo?.uri) {
        analysisQueueRef.current.push(photo.uri);
        processAnalysisQueue(userPrompt);
      }
    } catch (error) {
      console.error("Failed to take photo:", error);
    }
  };

  /**
   * Resets the VLM context by reinitializing the model
   * Used for error recovery when VLM encounters issues
   */
  const resetVLMContext = async () => {
    if (!vlm) return;
    try {
      setVLM(null);
      await initializeVLM();
      setCurrentAnalysis("");
    } catch (error) {
      console.error("Failed to reset VLM context:", error);
    }
  };

  /**
   * Toggles between front and back camera
   */
  const toggleCamera = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  // Loading state while VLM initializes
  if (isVLMLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading vision model...</Text>
      </View>
    );
  }

  // Permission request state
  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <Text>Requesting camera permissions...</Text>
      </View>
    );
  }

  // Permission denied state
  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

        {/* Overlay with absolute positioning */}
        <View style={styles.overlay}>
          {/* Status indicator */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? "#34C759" : "#FF3B30" },
              ]}
            />
            <Text style={styles.statusText}>
              {isActive ? "ACTIVE" : "STOPPED"}
            </Text>
            {isAnalyzing && (
              <Text style={styles.analyzingText}>Analyzing...</Text>
            )}
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: "#007AFF" }]}
              onPress={() => setIsActive(!isActive)}
            >
              <Text style={styles.buttonText}>
                {isActive ? "Stop" : "Start"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: "#8E8E93" }]}
              onPress={toggleCamera}
            >
              <Text style={styles.buttonText}>Flip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Analysis display with parallax scroll */}
      <ParallaxScrollView
        headerImage={
          <View style={styles.analysisHeader}>
            <Text style={styles.analysisHeaderTitle}>Live Analysis</Text>
            <View style={styles.analysisHeaderStatus}>
              <View
                style={[
                  styles.analysisStatusDot,
                  { backgroundColor: isAnalyzing ? "#FFD60A" : "#34C759" },
                ]}
              />
              <Text style={styles.analysisHeaderText}>
                {isAnalyzing ? "Processing..." : "Ready"}
              </Text>
            </View>
          </View>
        }
        headerBackgroundColor={{ dark: "#1a1a1a", light: "#f0f0f0" }}
      >
        <View style={styles.analysisContent}>
          <Text style={styles.analysisText}>
            {currentAnalysis || "Start camera to see real-time analysis"}
          </Text>

          {/* Current Analysis */}
          {currentAnalysis && (
            <View style={styles.analysisDetails}>
              <Text style={styles.analysisDetailsTitle}>Analysis Details:</Text>
              <Text style={styles.analysisDetailsText}>
                Last updated: {new Date().toLocaleTimeString()}
              </Text>
              <Text style={styles.analysisDetailsText}>
                Capture interval: {captureInterval / 1000}s
              </Text>
              <Text style={styles.analysisDetailsText}>
                Status: {isActive ? "Active" : "Stopped"}
              </Text>
            </View>
          )}

          {/* Analysis History */}
          {analysisHistory.length > 0 && (
            <View style={styles.chatHistoryContainer}>
              <Text style={styles.chatHistoryTitle}>Conversation History</Text>
              {analysisHistory.map((item, index) => (
                <View key={index} style={styles.chatConversation}>
                  {/* User question (right side) */}
                  <View style={styles.userMessageContainer}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userMessageText}>{item.prompt}</Text>
                    </View>
                    <Text style={styles.messageTimestamp}>
                      {item.timestamp}
                    </Text>
                  </View>

                  {/* VLM response (left side) */}
                  <View style={styles.aiMessageContainer}>
                    <View style={styles.aiBubble}>
                      <Text style={styles.aiMessageText}>{item.text}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ParallaxScrollView>

      {/* Interval controls */}
      {showIntervalControls && (
        <View style={styles.intervalContainer}>
          <Text style={styles.intervalTitle}>
            Capture Interval: {captureInterval / 1000}s
          </Text>
          <View style={styles.intervalButtons}>
            {[1000, 2000, 3000, 5000].map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalButton,
                  captureInterval === interval && styles.intervalButtonActive,
                ]}
                onPress={() => setCaptureInterval(interval)}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    captureInterval === interval &&
                      styles.intervalButtonTextActive,
                  ]}
                >
                  {interval / 1000}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Prompt input and button */}
      <View style={styles.promptContainer}>
        <Text style={styles.label}>Question:</Text>
        <TextInput
          style={styles.promptInput}
          placeholder="What do you want to ask the camera?"
          placeholderTextColor="#aaa"
          value={userPrompt}
          onChangeText={setUserPrompt}
        />
        <TouchableOpacity
          style={[styles.promptButton, { marginBottom: 12 }]}
          onPress={handleUserPromptSubmit}
        >
          <Text style={styles.promptButtonText}>Analyze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.promptButton}
          onPress={() => setShowIntervalControls((prev) => !prev)}
        >
          <Text style={styles.buttonText}>
            {showIntervalControls
              ? "Hide Interval Settings"
              : "Set Auto-Capture Interval"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  promptContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
  },

  label: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    color: "#333",
  },

  promptInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: "#000",
    marginBottom: 10,
  },

  promptButton: {
    backgroundColor: "#8e44ad",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  promptButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  cameraContainer: {
    flex: 2,
    position: "relative",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  analyzingText: {
    color: "#FFD60A",
    marginLeft: 16,
    fontSize: 14,
  },
  controlsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 32,
  },
  controlButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  message: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 16,
  },
  analysisHeader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  analysisHeaderTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  analysisHeaderStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  analysisStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  analysisHeaderText: {
    fontSize: 16,
    color: "#666",
  },
  analysisContent: {
    gap: 20,
  },
  analysisText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#333",
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  analysisDetails: {
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  analysisDetailsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  analysisDetailsText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  intervalContainer: {
    backgroundColor: "white",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  intervalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  intervalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  intervalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
  },
  intervalButtonActive: {
    backgroundColor: "#007AFF",
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  intervalButtonTextActive: {
    color: "white",
  },
  // Chat-like history styles
  chatHistoryContainer: {
    marginTop: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },

  chatHistoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },

  chatConversation: {
    marginBottom: 20,
  },

  // User message (right side)
  userMessageContainer: {
    alignItems: "flex-end",
    marginBottom: 8,
  },

  userBubble: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  userMessageText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },

  // AI message (left side)
  aiMessageContainer: {
    alignItems: "flex-start",
    marginBottom: 4,
  },

  aiBubble: {
    backgroundColor: "#e9ecef",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },

  aiMessageText: {
    color: "#333",
    fontSize: 16,
    lineHeight: 22,
  },

  messageTimestamp: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    marginRight: 8,
  },
});
