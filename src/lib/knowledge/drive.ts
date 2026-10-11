/** Pure link helpers for the "Add documents" flow (no I/O, safe in client and server code): Google share links -> public export URLs, tracking params stripped. */

export type LinkTarget =
  /** driveId = the Drive file id of a Google Docs / Sheets / Slides / Drive link (what the Drive API reads when the file is private). */
  | { readonly kind: "web" | "google" | "drive-file"; readonly fetchUrl: string; readonly driveId?: string }
  | { readonly kind: "drive-folder"; readonly folderId: string | null }
  | { readonly kind: "invalid" };

/** Stable error codes. The server prefixes its (Vietnamese) message with one, the client shows its own vi/en copy. */
export const LINK_ERROR = {
  notPublic: "NOT_PUBLIC", folder: "DRIVE_FOLDER", unsupported: "UNSUPPORTED_TYPE",
  needGrant: "NEED_DRIVE_GRANT", grantLost: "DRIVE_GRANT_LOST", noAccess: "DRIVE_NO_ACCESS",
} as const;
export type LinkErrorCode = (typeof LINK_ERROR)[keyof typeof LINK_ERROR];

export const linkError = (code: LinkErrorCode, message: string): Error => new Error(`${code}: ${message}`);
export const linkErrorCode = (message: string): LinkErrorCode | null =>
  Object.values(LINK_ERROR).find((c) => message.startsWith(`${c}:`)) ?? null;

const ID = /^[\w-]{10,}$/;
const idAfter = (path: string, marker: string): string | null => {
  const m = new RegExp(`/${marker}/([\\w-]+)`).exec(path);
  return m && ID.test(m[1] as string) ? (m[1] as string) : null;
};

const TRACKING = /^(fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|_ga|_gl|ref_src|usp|utm_.*)$/i;
const GOOGLE_HOSTS = /^(drive|docs)\.google\.com$/i;

/** The URL with tracking params (fbclid, utm_*, usp ...) removed and, on Google hosts, the account switch segment (/u/2/) dropped. */
const tidy = (url: URL): URL => {
  for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
  if (GOOGLE_HOSTS.test(url.hostname)) url.pathname = url.pathname.replace(/\/u\/\d+(?=\/|$)/, "");
  return url;
};

/** One pasted line, cleaned (see tidy). A line that is not an http(s) URL is returned trimmed and unchanged. */
export const cleanLink = (raw: string): string => {
  try {
    const url = new URL(raw.trim());
    return /^https?:$/.test(url.protocol) ? tidy(url).toString() : raw.trim();
  } catch { return raw.trim(); }
};

/** Does this line point at Google Drive / Docs (so a private file or folder may need the Drive grant)? */
export const isGoogleDriveLink = (raw: string): boolean => {
  try { return GOOGLE_HOSTS.test(new URL(raw.trim()).hostname); } catch { return false; }
};

/** Folder import caps (enforced in drive-api.ts, shown by the drawer): files per folder and nested levels below the pasted folder. */
export const MAX_FOLDER_FILES = 300;
export const MAX_FOLDER_DEPTH = 3;

export const DRIVE_MIME = {
  folder: "application/vnd.google-apps.folder", shortcut: "application/vnd.google-apps.shortcut",
  doc: "application/vnd.google-apps.document", sheet: "application/vnd.google-apps.spreadsheet", slides: "application/vnd.google-apps.presentation",
} as const;

/** How a Drive file is read: Google-native types are exported, uploaded pdf/docx/txt/md/csv are downloaded; null = cannot be read. */
export type DriveReadMode = "doc" | "sheet" | "slides" | "media";
export const driveReadMode = (mimeType: string, name: string): DriveReadMode | null => {
  if (mimeType === DRIVE_MIME.doc) return "doc";
  if (mimeType === DRIVE_MIME.sheet) return "sheet";
  if (mimeType === DRIVE_MIME.slides) return "slides";
  if (mimeType.startsWith("application/vnd.google-apps.")) return null;
  if (/\.(pdf|docx|txt|md|markdown|csv)$/i.test(name)) return "media";
  return /^(application\/pdf|text\/(plain|markdown|csv)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(mimeType) ? "media" : null;
};

/** One pasted link -> what to fetch. Plain pages are returned unchanged (tracking params aside). */
export const resolveLink = (raw: string): LinkTarget => {
  let url: URL;
  try { url = tidy(new URL(raw.trim())); } catch { return { kind: "invalid" }; }
  if (!/^https?:$/.test(url.protocol)) return { kind: "invalid" };
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host === "docs.google.com") {
    const doc = idAfter(path, "document/d");
    if (doc) return { kind: "google", driveId: doc, fetchUrl: `https://docs.google.com/document/d/${doc}/export?format=txt` };
    const sheet = idAfter(path, "spreadsheets/d");
    if (sheet) {
      const gid = /[#&?]gid=(\d+)/.exec(url.hash + url.search)?.[1];
      return { kind: "google", driveId: sheet, fetchUrl: `https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv${gid ? `&gid=${gid}` : ""}` };
    }
    const slides = idAfter(path, "presentation/d");
    if (slides) return { kind: "google", driveId: slides, fetchUrl: `https://docs.google.com/presentation/d/${slides}/export/txt` };
    return { kind: "web", fetchUrl: url.toString() };
  }

  if (host === "drive.google.com") {
    if (/\/folders\/|\/drive\/(my-drive|shared-with-me)/.test(path)) return { kind: "drive-folder", folderId: idAfter(path, "folders") };
    const id = idAfter(path, "file/d") ?? (path === "/open" || path === "/uc" ? url.searchParams.get("id") : null);
    if (id && ID.test(id)) return { kind: "drive-file", driveId: id, fetchUrl: `https://drive.google.com/uc?export=download&id=${id}` };
    return { kind: "web", fetchUrl: url.toString() };
  }

  return { kind: "web", fetchUrl: url.toString() };
};

/** Pasted text -> distinct, non-empty links, one per line (blank lines ignored), each cleaned of tracking params and /u/N/. */
export const parseLinks = (text: string): Array<string> =>
  [...new Set(text.split(/\r?\n/).map(cleanLink).filter(Boolean))];
