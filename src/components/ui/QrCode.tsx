import QRCode from "qrcode";
import { useMemo } from "react";
import Svg, { Path } from "react-native-svg";

type Props = { value: string; size: number; color?: string };

export function QrCode({ value, size, color = "#000000" }: Props) {
  const { count, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { count: modules.size, path: d };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
      <Path d={path} fill={color} />
    </Svg>
  );
}
