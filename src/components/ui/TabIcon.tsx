import Svg, { Circle, Path, Rect } from "react-native-svg";

const TAB_ICON_NAMES = ["explore", "wallet", "activity", "profile"] as const;

export type TabIconName = (typeof TAB_ICON_NAMES)[number];

export function isTabIconName(name: string): name is TabIconName {
  return TAB_ICON_NAMES.some((n) => n === name);
}

type Props = { name: TabIconName; color: string; focused: boolean };

const STROKE = 2;
const SIZE = 23;

export function TabIcon({ name, color, focused }: Props) {
  const stroke = { stroke: color, strokeWidth: STROKE, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 28 28" fill="none">
      {name === "explore" ? (
        <Path
          d="M5 12.2Q5 11.3 5.7 10.7L12.7 4.6Q14 3.5 15.3 4.6L22.3 10.7Q23 11.3 23 12.2V23Q23 24 22 24H17V13.8H11V24H6Q5 24 5 23Z"
          fill={focused ? color : "none"}
          {...stroke}
        />
      ) : null}
      {name === "wallet" ? (
        <>
          <Rect x={2.35} y={5} width={23.3} height={18} rx={4} {...stroke} />
          <Rect x={16.5} y={9} width={5.7} height={4.7} rx={1} fill={color} />
          <Path d="M6.5 18.5H13.8" {...stroke} />
        </>
      ) : null}
      {name === "activity" ? (
        <>
          <Circle cx={14} cy={14} r={10} {...stroke} />
          <Path d="M14 8.6V14L17.6 16.2" {...stroke} />
        </>
      ) : null}
      {name === "profile" ? (
        <>
          <Circle cx={14} cy={9.2} r={4.8} {...stroke} />
          <Path d="M4.8 24C5.8 19.1 9.4 16.8 14 16.8C18.6 16.8 22.2 19.1 23.2 24" {...stroke} />
        </>
      ) : null}
    </Svg>
  );
}
