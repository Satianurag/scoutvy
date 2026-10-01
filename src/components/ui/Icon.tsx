import { SymbolView, type SymbolViewProps } from "expo-symbols";

import { colors } from "@/theme";

type Props = {
  name: SymbolViewProps["name"];
  size: number;
  color?: string;
  weight?: SymbolViewProps["weight"];
};

export function Icon({ name, size, color = colors.text, weight }: Props) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      weight={weight}
      style={{ width: size, height: size }}
    />
  );
}
