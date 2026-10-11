"use client";

/**
 * Re-encode an image in the browser before upload. Drawing to a canvas and
 * exporting drops EXIF metadata (including GPS position) and caps the size.
 */
export async function reencodeImage(file: File, maxDimension = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85)
  );
}

export interface UploadedEvidence {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Upload via the existing /api/evidence/upload route. */
export async function uploadEvidence(blob: Blob): Promise<UploadedEvidence> {
  const body = new FormData();
  body.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }));
  const res = await fetch("/api/evidence/upload", { method: "POST", body });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || "Photo upload failed");
  return json.data;
}
