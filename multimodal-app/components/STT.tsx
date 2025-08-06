/**
 * STT.tsx
 *
 * A React Native component that provides real-time speech recognition
 * using the @ascendtis/react-native-voice-to-text library.
 */
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ScrollView,
} from "react-native";
import * as VoiceToText from "@ascendtis/react-native-voice-to-text";
import { useEffect, useRef, useState } from "react";

/**
 * Interface defining the structure of speech history items
 */
type SpeechHistoryItem = {
  text: string;
  timestamp: string;
  confidence?: number;
  language: string;
  duration?: number;
};

/**
 * STTComponent
 *
 * Main component that:
 * - Manages speech recognition state
 * - Handles microphone permissions
 * - Displays real-time transcription results
 * - Maintains a history of transcriptions
 * - Provides start/stop listening controls
 */
export default function STTComponent() {
  const [isListening, setIsListening] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState("");
  const [partialResults, setPartialResults] = useState("");
  const [speechHistory, setSpeechHistory] = useState<SpeechHistoryItem[]>([]);
  const [selectedLanguage] = useState("en-US");

  const speechStartTimeRef = useRef<Date | null>(null);

  /**
   * Effect: Sets up all speech recognition event listeners
   *
   * Listeners include:
   * - onSpeechStart: Tracks when speech begins
   * - onSpeechEnd: Handles speech completion
   * - onSpeechResults: Processes final transcription results
   * - onSpeechPartialResults: Handles real-time partial results
   * - onSpeechError: Manages errors during recognition
   */
  useEffect(() => {
    const startListener = VoiceToText.addEventListener("onSpeechStart", () => {
      speechStartTimeRef.current = new Date();
    });

    const endListener = VoiceToText.addEventListener("onSpeechEnd", () => {
      setIsListening(false);
      setPartialResults("");
    });

    const resultsListener = VoiceToText.addEventListener(
      "onSpeechResults",
      onSpeechResults
    );

    const partialListener = VoiceToText.addEventListener(
      "onSpeechPartialResults",
      onSpeechPartialResults
    );

    const errorListener = VoiceToText.addEventListener("onSpeechError", (e) => {
      console.error("Speech error", e);
      Alert.alert("Error", e?.message || "Something went wrong!");
      setIsListening(false);
      setPartialResults("");
    });

    return () => {
      startListener.remove();
      endListener.remove();
      resultsListener.remove();
      partialListener.remove();
      errorListener.remove();
      VoiceToText.destroy?.();
    };
  }, []);

  /**
   * Requests microphone permission on Android
   *
   * @returns Promise<boolean> - Whether permission was granted
   */
  const requestMicPermission = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "Mic Permission",
          message: "We need access to your microphone to transcribe speech.",
          buttonPositive: "Allow",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // ADD: Handling speech results
  /**
   * Handles final speech recognition results
   *
   * Processes the completed transcription and adds it to the history
   * with metadata including timestamp and duration.
   *
   * @param resultObj - The result object from the speech recognition engine
   */
  const onSpeechResults = (resultObj: any) => {
    console.log("Speech Results:", resultObj);
    const recognizedText =
      resultObj?.value ||
      resultObj?.results?.transcriptions?.[0]?.transcript ||
      "";

    if (recognizedText) {
      const duration = speechStartTimeRef.current
        ? (new Date().getTime() - speechStartTimeRef.current.getTime()) / 1000
        : 0;

      setCurrentTranscription(recognizedText);
      const historyItem: SpeechHistoryItem = {
        text: recognizedText,
        timestamp: new Date().toLocaleTimeString(),
        language: selectedLanguage,
        duration,
      };
      setSpeechHistory((prev) => [historyItem, ...prev]);
    }
  };

  // ADD: Handling partial results
  /**
   * Handles partial/intermediate speech recognition results
   *
   * Updates the UI with real-time transcription as the user speaks,
   * providing immediate feedback before final results are available.
   *
   * @param resultObj - The partial result object from the speech recognition engine
   */
  const onSpeechPartialResults = (resultObj: any) => {
    const partialText =
      resultObj?.value ||
      resultObj?.results?.transcriptions?.[0]?.transcript ||
      "";
    if (partialText) {
      setPartialResults(partialText);
    }
  };

  /**
   * Starts speech recognition
   *
   * Checks for microphone permission and begins listening for speech.
   * Updates UI state to reflect listening status.
   */
  const startListening = async () => {
    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      Alert.alert("No Mic Access", "Please enable microphone permissions!");
      return;
    }

    try {
      setIsListening(true);
      await VoiceToText.startListening();
    } catch (err) {
      console.error("Start error", err);
      Alert.alert("Failed to start listening");
    }
  };

  /**
   * Stops speech recognition
   *
   * Gracefully stops the speech recognition process and updates UI state.
   */
  const stopListening = async () => {
    try {
      await VoiceToText.stopListening();
      setIsListening(false);
    } catch (err) {
      console.error("Stop error", err);
    }
  };

  /**
   * Stops speech recognition
   *
   * Gracefully stops the speech recognition process and updates UI state.
   */
  const toggleListening = () => {
    isListening ? stopListening() : startListening();
  };

  return (
    <View style={styles.container}>
      {/* Main control button - toggles listening state */}
      <TouchableOpacity
        style={styles.button}
        onPress={toggleListening}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {isListening ? "Stop Listening" : "Start Listening"}
        </Text>
      </TouchableOpacity>

      {/* Real-time transcription display - shows partial results or final text */}
      <Text style={styles.transcriptionText}>
        {partialResults ||
          currentTranscription ||
          "Press start to see your speech transcribed!"}
      </Text>

      {/* History section header */}
      <Text style={styles.historyHeader}>Transcription History</Text>
      <ScrollView
        style={{ maxHeight: 300, width: "100%" }}
        contentContainerStyle={{ paddingHorizontal: 10 }}
      >
        {speechHistory.map((item, index) => (
          <View key={index} style={styles.historyItem}>
            {/* Transcribed text */}
            <Text style={styles.historyText}>{item.text}</Text>
            {/* Duration metadata */}
            <Text style={styles.meta}>{item.duration?.toFixed(1)}s</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#ff69b4",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: "#ff69b4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  transcriptionText: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  historyHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
    color: "#333",
    alignSelf: "flex-start",
  },
  historyItem: {
    backgroundColor: "#fce4ec",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  historyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#444",
  },
  meta: {
    fontSize: 12,
    color: "#777",
    marginTop: 5,
  },
});
