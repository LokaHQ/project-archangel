import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

/**
 * Custom hook to get a theme-aware color value.
 *
 * Returns the color from props if provided, otherwise falls back to the theme’s default color.
 * Supports both light and dark modes.
 *
 * @param props - Optional override colors for light and dark themes.
 * @param colorName - The key of the color to use from the theme palette.
 * @returns The resolved color string for the current theme.
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? "light";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
