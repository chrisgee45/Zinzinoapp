import { Router, type Request, type Response } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { authenticate } from "../middleware/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const BUCKET = process.env.SUPABASE_PHOTO_BUCKET ?? "partner-photos";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB cap — client-side resize gets it much smaller
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP, or GIF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Boot-time diagnostic: print a clear checklist of which prereqs are met
// so the operator can fix the missing pieces without reading code.
console.log(
  [
    "[uploads] Configuration check:",
    `  ${SUPABASE_URL ? "✓" : "✗"} SUPABASE_URL env var${SUPABASE_URL ? "" : " (set on Railway to https://<project-ref>.supabase.co)"}`,
    `  ${SUPABASE_SERVICE_KEY ? "✓" : "✗"} SUPABASE_SERVICE_KEY env var${SUPABASE_SERVICE_KEY ? "" : " (set on Railway to the service_role key from Supabase API settings, NOT the anon key)"}`,
    `  ? Bucket "${BUCKET}" (probed at request time — must exist and be public in Supabase Storage)`,
  ].join("\n"),
);

const router = Router();

// Diagnostic config endpoint. Returns enough detail for the settings UI to
// render a specific 'here's what to fix' message AND for the operator to
// see in the Railway logs which side is missing. Probes the bucket so we
// catch the 'env vars are set but the bucket doesn't exist or isn't public'
// case (which previously silently said 'uploads available').
type UploadConfigReason =
  | "no-supabase-url"
  | "no-service-key"
  | "bucket-missing"
  | "auth-failed"
  | "unknown";

async function probeBucket(): Promise<{ ok: boolean; reason?: UploadConfigReason; detail?: string }> {
  if (!SUPABASE_URL) return { ok: false, reason: "no-supabase-url", detail: "SUPABASE_URL env var is not set on the server." };
  if (!SUPABASE_SERVICE_KEY) return { ok: false, reason: "no-service-key", detail: "SUPABASE_SERVICE_KEY env var is not set on the server." };
  try {
    // List bucket metadata via the Storage API. Cheaper than uploading a
    // probe object and tells us about existence + auth in one call.
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/bucket/${BUCKET}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) {
      return {
        ok: false,
        reason: "bucket-missing",
        detail: `Bucket "${BUCKET}" doesn't exist in Supabase Storage. Create it: Supabase dashboard → Storage → New bucket → name "${BUCKET}" → Public bucket ON → Create.`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "auth-failed",
        detail: "Supabase rejected the service key. The SUPABASE_SERVICE_KEY env var is set but isn't accepted — likely the wrong key (use service_role, not anon) or it was rotated.",
      };
    }
    const body = await res.text().catch(() => "");
    return { ok: false, reason: "unknown", detail: `Supabase returned ${res.status}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, reason: "unknown", detail: `Probe failed: ${(e as Error).message}` };
  }
}

router.get("/config", authenticate, async (_req, res) => {
  const probe = await probeBucket();
  if (probe.ok) {
    res.json({ uploadsEnabled: true });
    return;
  }
  console.warn(`[uploads] /config probe failed: reason=${probe.reason} detail=${probe.detail}`);
  res.json({ uploadsEnabled: false, reason: probe.reason, detail: probe.detail });
});

router.post("/photo", authenticate, (req: Request, res: Response, next) => {
  uploader.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Photo is too large — keep it under 8MB"
          : err instanceof Error
            ? err.message
            : "Upload failed";
      res.status(400).json({ error: message });
      return;
    }
    void handleUpload(req, res).catch(next);
  });
});

async function handleUpload(req: Request, res: Response): Promise<void> {
  if (!req.partner) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    res.status(503).json({ error: "Photo uploads aren't configured on the server. Paste a URL instead." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const ext = EXT_FOR_MIME[req.file.mimetype] ?? "jpg";
  const path = `${req.partner.id}/${nanoid()}.${ext}`;
  const uploadUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${path}`;

  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      "Content-Type": req.file.mimetype,
      "x-upsert": "true",
      "cache-control": "public, max-age=3600",
    },
    body: req.file.buffer,
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    console.error(`[uploads] Supabase Storage upload failed (${upload.status}):`, detail);
    if (upload.status === 404) {
      res.status(503).json({
        error: `Bucket "${BUCKET}" not found in Supabase Storage. Create it (public) and retry.`,
      });
      return;
    }
    if (upload.status === 401 || upload.status === 403) {
      res.status(503).json({ error: "Supabase rejected the upload. Check SUPABASE_SERVICE_KEY." });
      return;
    }
    res.status(502).json({ error: "Upload failed. Try again." });
    return;
  }

  const publicUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
  res.json({ url: publicUrl, path });
}

export default router;
