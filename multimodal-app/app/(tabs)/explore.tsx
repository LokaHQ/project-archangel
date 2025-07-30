import { Image } from "expo-image";
import { Platform, StyleSheet } from "react-native";
import ParallaxScrollView from "@/components/predefined/ParallaxScrollView";
import { ThemedText } from "@/components/predefined/ThemedText";
import { ThemedView } from "@/components/predefined/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import VisionChat from "@/components/VLM";

export default function TabTwoScreen() {
  return (
    // <ParallaxScrollView
    //   headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
    //   headerImage={
    //     <IconSymbol
    //       size={310}
    //       color="#808080"
    //       name="chevron.left.forwardslash.chevron.right"
    //       style={styles.headerImage}
    //     />
    //   }
    // >
    // </ParallaxScrollView>
    <VisionChat></VisionChat>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
  },
});
