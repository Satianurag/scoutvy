import { Image, type ImageSource } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FlowHeader } from "@/components/ui/Flow";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { colors, fonts } from "@/theme";

export function ProofImage({ source, onReady }: { source: ImageSource; onReady?: (ready: boolean) => void }) {
  const [full, setFull] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      <View style={s.frame}>
        <Image
          key={attempt}
          source={source}
          cachePolicy="none"
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          onLoad={() => {
            setState("ready");
            onReady?.(true);
          }}
          onError={() => {
            setState("error");
            onReady?.(false);
          }}
        />
        {state === "loading" ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.caption}>Loading proof photo…</Text>
          </View>
        ) : null}
        {state === "error" ? (
          <View style={s.center}>
            <Icon
              name={{ ios: "photo", android: "broken_image", web: "broken_image" }}
              size={30}
              color={colors.textSecondary}
            />
            <Text style={s.caption}>Couldn’t load this photo</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setState("loading");
                onReady?.(false);
                setAttempt((n) => n + 1);
              }}
              style={s.retry}
            >
              <Text style={s.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {state === "ready" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View proof photo full screen"
            onPress={() => setFull(true)}
            style={s.expand}
          >
            <Icon
              name={{ ios: "arrow.up.left.and.arrow.down.right", android: "fullscreen", web: "fullscreen" }}
              size={20}
            />
            <Text style={s.expandText}>View full photo</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal
        visible={full}
        animationType="fade"
        onRequestClose={() => setFull(false)}
        presentationStyle="fullScreen"
      >
        <Screen background="#000000">
          <FlowHeader title="Proof photo" onBack={() => setFull(false)} />
          <Image source={source} contentFit="contain" style={s.full} />
          <Text style={s.fullCaption}>Submitted photo</Text>
        </Screen>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  frame: {
    height: 280,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    gap: 10,
  },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
  retry: { minHeight: 44, paddingHorizontal: 20, justifyContent: "center" },
  retryText: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.primary },
  expand: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    backgroundColor: "#111111DD",
    borderRadius: 18,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  expandText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  full: { flex: 1 },
  fullCaption: {
    padding: 24,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
