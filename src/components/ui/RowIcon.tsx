import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/theme";

type Props = { name: "info" };

export function RowIcon({ name }: Props) {
  const stroke = {
    stroke: colors.primary,
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;

  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      {name === "info" ? (
        <>
          <Circle cx={8} cy={8} r={7} {...stroke} />
          <Path d="M8 7.2V11.4" {...stroke} />
          <Circle cx={8} cy={4.8} r={0.4} fill={colors.primary} {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
