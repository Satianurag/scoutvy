import * as Location from "expo-location";

import type { Coordinate } from "@/components/ui/LocationMap";

const coordinates = ({ latitude, longitude }: Coordinate) =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

/** A short human label for a point, falling back to its coordinates when the device can't geocode it. */
export async function describePlace(point: Coordinate): Promise<string> {
  try {
    const [address] = await Location.reverseGeocodeAsync(point);
    if (!address) return coordinates(point);
    const street = address.street ? [address.streetNumber, address.street].filter(Boolean).join(" ") : null;
    const name =
      address.name && address.name !== address.streetNumber && address.name !== street ? address.name : null;
    const parts = [name, street, address.district, address.city ?? address.subregion, address.region];
    const unique = parts.filter(
      (part, index): part is string => Boolean(part) && parts.indexOf(part) === index,
    );
    return unique.slice(0, 3).join(", ") || coordinates(point);
  } catch {
    return coordinates(point);
  }
}
