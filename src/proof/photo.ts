import type { CameraCapturedPicture } from "expo-camera";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { CaptureError } from "@/proof/errors";

const MAX_IMAGE_BYTES = 1_048_576;

export function discardPhoto(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    return;
  }
}

export async function preparePhoto(photo: CameraCapturedPicture): Promise<File> {
  const source = new File(photo.uri);
  try {
    for (const edge of [1600, 1200]) {
      const context = ImageManipulator.manipulate(photo.uri);
      if (Math.max(photo.width, photo.height) > edge) {
        context.resize(photo.width >= photo.height ? { width: edge } : { height: edge });
      }
      const image = await context.renderAsync();
      try {
        const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: edge === 1600 ? 0.7 : 0.5 });
        const file = new File(saved.uri);
        if (file.size > 0 && file.size <= MAX_IMAGE_BYTES) return file;
        discardPhoto(file);
      } finally {
        image.release();
        context.release();
      }
    }
    throw new CaptureError("The photo is too large. Retake the photo.");
  } finally {
    discardPhoto(source);
  }
}
