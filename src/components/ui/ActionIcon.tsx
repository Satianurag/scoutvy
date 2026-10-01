import Svg, { Path, Rect } from "react-native-svg";

import { colors } from "@/theme";

export type ActionIconName = "receive" | "explorer" | "copy" | "close";

type Props = { name: ActionIconName; size?: number; color?: string };

export function ActionIcon({ name, size = 24, color = colors.primary }: Props) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === "receive" ? (
        <>
          <Rect x={3.5} y={3.5} width={6.5} height={6.5} rx={1.6} {...stroke} />
          <Rect x={14} y={3.5} width={6.5} height={6.5} rx={1.6} {...stroke} />
          <Rect x={3.5} y={14} width={6.5} height={6.5} rx={1.6} {...stroke} />
          <Path d="M14 14H16.5V16.5H14Z M18 18H20.5V20.5H18Z M14 18.5V20.5 M18.5 14H20.5" {...stroke} />
        </>
      ) : null}
      {name === "explorer" ? (
        <>
          <Path d="M13.5 4H20V10.5" {...stroke} />
          <Path d="M20 4L11 13" {...stroke} />
          <Path d="M18 14V18.5C18 19.33 17.33 20 16.5 20H5.5C4.67 20 4 19.33 4 18.5V7.5C4 6.67 4.67 6 5.5 6H10" {...stroke} />
        </>
      ) : null}
      {name === "copy" ? (
        <>
          <Rect x={8.5} y={8.5} width={11.5} height={11.5} rx={2.5} {...stroke} />
          <Path d="M15.5 8.5V6.5C15.5 5.12 14.38 4 13 4H6.5C5.12 4 4 5.12 4 6.5V13C4 14.38 5.12 15.5 6.5 15.5H8.5" {...stroke} />
        </>
      ) : null}
      {name === "close" ? <Path d="M6 6L18 18M18 6L6 18" {...stroke} strokeWidth={2} /> : null}
    </Svg>
  );
}
