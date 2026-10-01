import { Image, type ImageSource } from "expo-image";
import { StyleSheet } from "react-native";

type Props = { source: ImageSource | number; width: number; height: number; top: number };

export function Illustration({ source, width, height, top }: Props) {
  return <Image source={source} style={[styles.image, { width, height, marginTop: top }]} contentFit="contain" />;
}

const styles = StyleSheet.create({
  image: { alignSelf: "center" },
});
