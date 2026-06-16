import { ApiError, getToken } from "./api";

const MAX_DIM = 1024; // Square the long edge to this before upload
const QUALITY = 0.85;

/** Client-side resize via canvas so the server never has to deal with 10MB JPEGs. */
export async function resizeImage(file: File, maxDim: number = MAX_DIM): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't create image canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Convert GIFs to JPEG too — server SDK only animates if we keep them.
        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error("Couldn't encode resized image"));
              return;
            }
            resolve(blob);
          },
          mime,
          QUALITY,
        );
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read the image"));
    };
    img.src = objectUrl;
  });
}

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadPhoto(file: File): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick an image file");
  }
  // Resize before upload — keeps cost + bandwidth + UX snappy.
  const blob = await resizeImage(file);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const filename = file.name.replace(/\.[^.]+$/, "") + "." + ext;

  const formData = new FormData();
  formData.append("file", new File([blob], filename, { type: blob.type }));

  const token = getToken();
  const res = await fetch("/api/uploads/photo", {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : null) ?? "Upload failed";
    throw new ApiError(message, res.status, data);
  }
  return data as UploadResult;
}

export interface UploadConfig {
  uploadsEnabled: boolean;
  reason?: "no-supabase-url" | "no-service-key" | "bucket-missing" | "auth-failed" | "unknown";
  detail?: string;
}

export async function uploadEnabled(): Promise<boolean> {
  const cfg = await uploadConfig();
  return cfg.uploadsEnabled;
}

export async function uploadConfig(): Promise<UploadConfig> {
  try {
    const token = getToken();
    if (!token) return { uploadsEnabled: false };
    const res = await fetch("/api/uploads/config", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { uploadsEnabled: false };
    return (await res.json()) as UploadConfig;
  } catch {
    return { uploadsEnabled: false };
  }
}
