import { CameraView } from "expo-camera";
import { useState, type Ref } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, layout } from "@/theme";
import { Icon } from "@/components/ui/Icon";

type Props = {
  ref: Ref<CameraView>;
  ready: boolean;
  busy: boolean;
  onReady: () => void;
  onError: () => void;
  onCapture: () => void;
  instructions: string;
  busyLabel: string;
};

export function ProofCamera({
  ref,
  ready,
  busy,
  onReady,
  onError,
  onCapture,
  instructions,
  busyLabel,
}: Props) {
  const [frameSize, setFrameSize] = useState(0);
  const [torch, setTorch] = useState(false);

  return (
    <View style={styles.wrap}>
      <View
        style={styles.preview}
        onLayout={({ nativeEvent }) =>
          setFrameSize(Math.min(nativeEvent.layout.width * 0.64, nativeEvent.layout.height * 0.8))
        }
      >
        <CameraView
          ref={ref}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          enableTorch={torch}
          onCameraReady={onReady}
          onMountError={onError}
        />
        <View style={styles.brief}>
          <Text numberOfLines={3} style={styles.briefText}>
            {instructions}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? "Turn flash off" : "Turn flash on"}
          accessibilityState={{ selected: torch }}
          disabled={busy}
          onPress={() => setTorch((value) => !value)}
          style={styles.flash}
        >
          <Icon
            name={{ ios: "bolt.fill", android: "flash_on", web: "flash_on" }}
            size={23}
            color={torch ? colors.primary : colors.text}
          />
        </Pressable>
        <View pointerEvents="none" style={styles.framing}>
          {frameSize > 0 ? (
            <View style={{ width: frameSize, height: frameSize }}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.controls}>
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {busy ? busyLabel : !ready ? "Opening camera…" : "Keep the requested details clear and in frame."}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take proof photo"
          accessibilityState={{ disabled: !ready || busy, busy }}
          disabled={!ready || busy}
          onPress={onCapture}
          style={({ pressed }) => [
            styles.shutter,
            (!ready || busy) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? <ActivityIndicator color={colors.text} /> : <View style={styles.shutterFill} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  preview: {
    flex: 1,
    backgroundColor: "#000000",
    overflow: "hidden",
    marginHorizontal: 20,
    borderRadius: 24,
  },
  brief: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#111111CC",
  },
  briefText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.text },
  flash: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111111CC",
    alignItems: "center",
    justifyContent: "center",
  },
  framing: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  corner: { position: "absolute", width: 31, height: 31, borderColor: colors.text },
  topLeft: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 18 },
  topRight: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 18 },
  bottomLeft: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 18 },
  bottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 18,
  },
  controls: { alignItems: "center", gap: 16, paddingTop: 18, paddingBottom: layout.bottomGap },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14.9,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginHorizontal: 32,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.text,
    justifyContent: "center",
    alignItems: "center",
  },
  shutterFill: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
