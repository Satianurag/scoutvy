import { StyleSheet, Text, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { colors, fonts } from "@/theme";

export type SummaryItem = { label: string; value: string; stacked?: boolean };

export function SummaryCard({ items }: { items: SummaryItem[] }) {
  return (
    <ListGroup>
      {items.map((item) =>
        item.stacked ? (
          <View key={item.label} style={[styles.row, styles.stacked]}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.stackedValue}>{item.value}</Text>
          </View>
        ) : (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <Text numberOfLines={2} style={styles.value}>
              {item.value}
            </Text>
          </View>
        ),
      )}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: 17,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    gap: 16,
  },
  stacked: { flexDirection: "column", alignItems: "stretch", gap: 6 },
  label: { fontFamily: fonts.regular, fontSize: 16.5, lineHeight: 22, color: colors.textSecondary },
  value: { flex: 1, textAlign: "right", fontFamily: fonts.semiBold, fontSize: 16.5, lineHeight: 22, color: colors.text },
  stackedValue: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.text },
});
