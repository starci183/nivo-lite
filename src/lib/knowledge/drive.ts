/** Pure link helpers for the "Add documents" flow (no I/O, safe in client and server code): Google share links -> public export URLs. */

export type LinkTarget =
  | { readonly kind: "web" | "google" | "drive-file"; readonly fetchUrl: string }
  | { readonly kind: "drive-folder" }
  | { readonly kind: "invalid" };

/** Stable error codes. The server prefixes its (Vietnamese) message with one, the client shows its own vi/en copy. */
export const LINK_ERROR = { notPublic: "NOT_PUBLIC", folder: "DRIVE_FOLDER", unsupported: "UNSUPPORTED_TYPE" } as const;
export type LinkErrorCode = (typeof LINK_ERROR)[keyof typeof LINK_ERROR];

export const linkError = (code: LinkErrorCode, message: string): Error => new Error(`${code}: ${message}`);
export const linkErrorCode = (message: string): LinkErrorCode | null =>
  Object.values(LINK_ERROR).find((c) => message.startsWith(`${c}:`)) ?? null;

const ID = /^[\w-]{10,}$/;
const idAfter = (path: string, marker: string): string | null => {
  const m = new RegExp(`/${marker}/([\\w-]+)`).exec(path);
  return m && ID.test(m[1] as string) ? (m[1] as string) : null;
};

/** One pasted link -> what to fetch. Plain pages are returned unchanged. */
export const resolveLink = (raw: string): LinkTarget => {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return { kind: "invalid" }; }
  if (!/^https?:$/.test(url.protocol)) return { kind: "invalid" };
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  if (host === "docs.google.com") {
    const doc = idAfter(path, "document/d");
    if (doc) return { kind: "google", fetchUrl: `https://docs.google.com/document/d/${doc}/export?format=txt` };
    const sheet = idAfter(path, "spreadsheets/d");
    if (sheet) {
      const gid = /[#&?]gid=(\d+)/.exec(url.hash + url.search)?.[1];
      return { kind: "google", fetchUrl: `https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv${gid ? `&gid=${gid}` : ""}` };
    }
    const slides = idAfter(path, "presentation/d");
    if (slides) return { kind: "google", fetchUrl: `https://docs.google.com/presentation/d/${slides}/export/txt` };
    return { kind: "web", fetchUrl: url.toString() };
  }

  if (host === "drive.google.com") {
    if (/\/folders\/|\/drive\/(u\/\d+\/)?(my-drive|shared-with-me)/.test(path)) return { kind: "drive-folder" };
    const id = idAfter(path, "file/d") ?? idAfter(path, "file/u/\\d+/d") ?? (path === "/open" || path === "/uc" ? url.searchParams.get("id") : null);
    if (id && ID.test(id)) return { kind: "drive-file", fetchUrl: `https://drive.google.com/uc?export=download&id=${id}` };
    return { kind: "web", fetchUrl: url.toString() };
  }

  return { kind: "web", fetchUrl: url.toString() };
};

/** Pasted text -> distinct, non-empty links, one per line (blank lines ignored). */
export const parseLinks = (text: string): Array<string> =>
  [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
