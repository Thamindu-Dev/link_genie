/**
 * Ultra-Compact & Secure Encoding Utilities for LinkGenie
 *
 * Compresses standard YouTube links from ~250+ characters down to ~28-35 characters:
 * - Channel handle: "@channel" -> compact token
 * - Video ID: 11-char ID -> compact token
 * - Obfuscated with XOR salt + integrity checksum to prevent casual decoding
 * - Fallback for non-standard/custom paths
 */

const SECRET_SALT =
  process.env.NEXT_PUBLIC_LINK_SALT || "LG26";

const MAX_URL_LENGTH = 2048;

export interface ValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  videoId?: string | null;
  channelHandle?: string | null;
  error?: string;
}

export interface LockedPayloadValidation {
  isValid: boolean;
  channelUrl?: string;
  videoUrl?: string;
  videoId?: string | null;
  channelHandle?: string | null;
  error?: string;
}

/**
 * Normalizes input: prepends https:// if user omitted protocol (e.g. youtube.com/watch?v=...)
 */
export function normalizeUserUrlInput(input: string): string {
  let trimmed = input.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Extracts an 11-character YouTube Video ID if the URL is a YouTube video.
 */
export function extractYouTubeId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = urlObj.pathname.slice(1).split("/")[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const vParam = urlObj.searchParams.get("v");
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }
    const pathMatch = urlObj.pathname.match(
      /^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/
    );
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  return null;
}

/**
 * Extracts a YouTube channel handle (e.g., "vercel" from @vercel or /c/vercel)
 */
export function extractChannelIdentifier(urlObj: URL): { type: "handle" | "channelId" | "raw"; value: string } | null {
  const path = urlObj.pathname;
  
  // @handle format
  const handleMatch = path.match(/^\/@([a-zA-Z0-9_.-]+)/);
  if (handleMatch) return { type: "handle", value: handleMatch[1] };

  // /channel/UC... format
  const idMatch = path.match(/^\/channel\/([a-zA-Z0-9_-]+)/);
  if (idMatch) return { type: "channelId", value: idMatch[1] };

  // /c/name or /user/name
  const customMatch = path.match(/^\/(?:c|user)\/([a-zA-Z0-9_.-]+)/);
  if (customMatch) return { type: "handle", value: customMatch[1] };

  return null;
}

/**
 * Strictly validates and sanitizes a user-supplied URL.
 */
export function validateAndSanitizeUrl(
  rawInput: string,
  fieldLabel: "video" | "channel" = "video"
): ValidationResult {
  const labelText = fieldLabel === "channel" ? "channel link" : "video link";

  if (!rawInput || typeof rawInput !== "string") {
    return { isValid: false, error: `Please enter a ${labelText}.` };
  }

  const cleaned = normalizeUserUrlInput(rawInput);

  if (!cleaned || cleaned === "https://") {
    return { isValid: false, error: `Please enter a ${labelText}.` };
  }

  if (cleaned.length > MAX_URL_LENGTH) {
    return {
      isValid: false,
      error: `URL exceeds maximum allowed length (${MAX_URL_LENGTH} characters).`,
    };
  }

  if (/[<>'"`]/.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a clean URL without special characters.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {
      isValid: false,
      error: `Invalid ${labelText}. Please enter a valid URL (e.g. https://youtube.com/...).`,
    };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      isValid: false,
      error: "Only HTTP and HTTPS links are allowed.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: "URLs with embedded credentials are not allowed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isValidHost =
    hostname === "localhost" ||
    (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname) && !hostname.includes(".."));

  if (!isValidHost) {
    return {
      isValid: false,
      error: "Please enter a URL with a valid domain name.",
    };
  }

  const videoId = extractYouTubeId(parsed);
  const chInfo = extractChannelIdentifier(parsed);

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
    videoId,
    channelHandle: chInfo?.value ? `@${chInfo.value}` : null,
  };
}

/**
 * Lightweight 3-char signature hash for tamper detection
 */
function computeShortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).slice(0, 3).padStart(3, "0");
}

/**
 * Encodes Channel + Video URLs into an ultra-short token (typically 28-35 chars).
 * Formats:
 * - "1~<handle>~<videoId>" for standard @channel + 11-char videoId
 * - "2~<channelId>~<videoId>" for /channel/UC... + 11-char videoId
 * - "0~<channelUrl>~<videoUrl>" for non-standard URLs
 */
export function encodeLockedPayload(
  rawChannelUrl: string,
  rawVideoUrl: string
): string {
  const channelValidation = validateAndSanitizeUrl(rawChannelUrl, "channel");
  if (!channelValidation.isValid || !channelValidation.sanitizedUrl) {
    throw new Error(channelValidation.error || "Invalid channel link.");
  }

  const videoValidation = validateAndSanitizeUrl(rawVideoUrl, "video");
  if (!videoValidation.isValid || !videoValidation.sanitizedUrl) {
    throw new Error(videoValidation.error || "Invalid video link.");
  }

  const chUrlObj = new URL(channelValidation.sanitizedUrl);
  const chIdent = extractChannelIdentifier(chUrlObj);
  const vidId = videoValidation.videoId;

  let compactBody: string;

  if (chIdent?.type === "handle" && vidId) {
    compactBody = `1~${chIdent.value}~${vidId}`;
  } else if (chIdent?.type === "channelId" && vidId) {
    compactBody = `2~${chIdent.value}~${vidId}`;
  } else {
    // Fallback for custom domains/non-YouTube links
    compactBody = `0~${encodeURIComponent(channelValidation.sanitizedUrl)}~${encodeURIComponent(videoValidation.sanitizedUrl)}`;
  }

  const sig = computeShortHash(`${compactBody}::${SECRET_SALT}`);
  const rawPayload = `${sig}${compactBody}`;

  const encoder = new TextEncoder();
  const bytes = encoder.encode(rawPayload);
  const saltBytes = encoder.encode(SECRET_SALT);

  // Lightweight XOR obfuscation
  const xored = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    xored[i] = bytes[i] ^ saltBytes[i % saltBytes.length] ^ ((i * 7 + 0x5a) & 0xff);
  }

  let binary = "";
  for (let i = 0; i < xored.length; i++) {
    binary += String.fromCharCode(xored[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes short `?v=` token back into validated URLs
 */
export function decodeLockedPayload(
  encodedToken: string
): LockedPayloadValidation {
  if (
    !encodedToken ||
    typeof encodedToken !== "string" ||
    encodedToken.length > 4096
  ) {
    return {
      isValid: false,
      error: "Missing or invalid link parameter.",
    };
  }

  try {
    let base64 = encodedToken.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const binary = atob(base64);
    const xored = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      xored[i] = binary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(SECRET_SALT);
    const payloadBytes = new Uint8Array(xored.length);

    for (let i = 0; i < xored.length; i++) {
      payloadBytes[i] =
        xored[i] ^ saltBytes[i % saltBytes.length] ^ ((i * 7 + 0x5a) & 0xff);
    }

    const decoder = new TextDecoder("utf-8", { fatal: true });
    const decodedStr = decoder.decode(payloadBytes);

    const sig = decodedStr.slice(0, 3);
    const compactBody = decodedStr.slice(3);
    const expectedSig = computeShortHash(`${compactBody}::${SECRET_SALT}`);

    if (sig !== expectedSig) {
      return {
        isValid: false,
        error: "This link appears to have been modified or corrupted.",
      };
    }

    const parts = compactBody.split("~");
    const mode = parts[0];

    let fullChannelUrl: string;
    let fullVideoUrl: string;
    let handleDisplay: string | null = null;
    let videoId: string | null = null;

    if (mode === "1" && parts.length === 3) {
      const handle = parts[1];
      videoId = parts[2];
      fullChannelUrl = `https://www.youtube.com/@${handle}?sub_confirmation=1`;
      fullVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      handleDisplay = `@${handle}`;
    } else if (mode === "2" && parts.length === 3) {
      const channelId = parts[1];
      videoId = parts[2];
      fullChannelUrl = `https://www.youtube.com/channel/${channelId}?sub_confirmation=1`;
      fullVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      handleDisplay = "Channel";
    } else if (mode === "0" && parts.length === 3) {
      fullChannelUrl = decodeURIComponent(parts[1]);
      fullVideoUrl = decodeURIComponent(parts[2]);
      if (!fullChannelUrl.includes("sub_confirmation=1")) {
        fullChannelUrl += fullChannelUrl.includes("?")
          ? "&sub_confirmation=1"
          : "?sub_confirmation=1";
      }
      const vCheck = validateAndSanitizeUrl(fullVideoUrl, "video");
      videoId = vCheck.videoId || null;
    } else {
      return {
        isValid: false,
        error: "Unrecognized link format.",
      };
    }

    const channelCheck = validateAndSanitizeUrl(fullChannelUrl, "channel");
    const videoCheck = validateAndSanitizeUrl(fullVideoUrl, "video");

    if (!channelCheck.isValid || !channelCheck.sanitizedUrl) {
      return { isValid: false, error: "Invalid channel link." };
    }

    if (!videoCheck.isValid || !videoCheck.sanitizedUrl) {
      return { isValid: false, error: "Invalid video link." };
    }

    return {
      isValid: true,
      channelUrl: channelCheck.sanitizedUrl,
      videoUrl: videoCheck.sanitizedUrl,
      videoId: videoId || videoCheck.videoId,
      channelHandle: handleDisplay || channelCheck.channelHandle,
    };
  } catch {
    return {
      isValid: false,
      error: "Unable to open this link. Please check with the sender.",
    };
  }
}
