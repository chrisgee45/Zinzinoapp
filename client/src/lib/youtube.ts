/**
 * Accepts: full YouTube URL (watch, youtu.be, shorts, embed) OR raw 11-char ID.
 * Returns the 11-character video ID, or null if it can't be parsed.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Raw ID — typical YouTube IDs are 11 chars of [A-Za-z0-9_-]
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // Try URL parsing
  try {
    const url = new URL(trimmed);
    // youtube.com/watch?v=XXX
    const v = url.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    // youtu.be/XXX
    if (url.hostname.endsWith("youtu.be")) {
      const id = url.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/embed/XXX or youtube.com/shorts/XXX
    const pathMatch = url.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1];
  } catch {
    /* not a URL */
  }

  return null;
}
