import { CameraView } from "expo-camera";
import { useState, type Ref } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, layout } from "@/theme";

type Props = {
  ref: Ref<CameraView>;
  ready: boolean;
  busy: boolean;
  onReady: () => void;
  onError: () => void;
  onCapture: () => void;
};

export function ProofCamera({ ref, ready, busy, onReady, onError, onCapture }: Props) {
  const [frameSize, setFrameSize] = useState(0);

  return (
    <View style={styles.wrap}>
      <View style={styles.preview}
        onLayout={({ nativeEvent }) => setFrameSize(Math.min(nativeEvent.layout.width * 0.64, nativeEvent.layout.height * 0.8))}>
        <CameraView
          ref={ref}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={onReady}
          onMountError={onError}
        />
        <View pointerEvents="none" style={styles.framing}>
          {frameSize > 0 ? <View style={{ width: frameSize, height: frameSize }}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View> : null}
        </View>
      </View>
      <View style={styles.controls}>
        <Text style={styles.hint}>{busy ? "Checking location and capturing…" : "Keep the requested proof clear and in frame."}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take proof photo"
          accessibilityState={{ disabled: !ready || busy, busy }}
          disabled={!ready || busy}
          onPress={onCapture}
          style={({ pressed }) => [styles.shutter, (!ready || busy) && styles.disabled, pressed && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={colors.text} /> : <View style={styles.shutterFill} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  preview: { flex: 1, backgroundColor: "#000000", overflow: "hidden" },
  framing: { ...StyleSheet.absoluteFill, justifyContent: "center", alignItems: "center" },
  corner: { position: "absolute", width: 31, height: 31, borderColor: colors.text },
  topLeft: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 18 },
  topRight: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 18 },
  bottomLeft: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 18 },
  bottomRight: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 18 },
  controls: { alignItems: "center", gap: 16, paddingTop: 18, paddingBottom: layout.bottomGap },
  hint: { fontFamily: fonts.regular, fontSize: 14.9, lineHeight: 20, color: colors.textSecondary, textAlign: "center", marginHorizontal: 32 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.text, justifyContent: "center", alignItems: "center" },
  shutterFill: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
