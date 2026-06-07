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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log(
    "[uploads] Supabase Storage not configured. Set SUPABASE_URL + SUPABASE_SERVICE_KEY + create a public bucket to enable photo uploads. Until then partners can paste photo URLs instead.",
  );
}

const router = Router();

router.get("/config", authenticate, (_req, res) => {
  res.json({ uploadsEnabled: Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY) });
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
