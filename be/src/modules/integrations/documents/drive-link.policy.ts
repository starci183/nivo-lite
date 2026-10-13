/** Where a pasted link points and what to fetch for it. */
export type LinkTarget =
    | {
          /** A plain page, a Google Docs, Sheets or Slides file, or a Drive file. */
          readonly kind: "web" | "google" | "drive-file"
          /** The address to fetch: the public export address for a Google file. */
          readonly fetchUrl: string
          /** The Drive id of a Google or Drive file, which the Drive API reads when the file is private. */
          readonly driveId?: string
      }
    | {
          /** A Drive folder. */
          readonly kind: "drive-folder"
          /** The folder id, when the address names one. */
          readonly folderId: string | null
      }
    | {
          /** Not an http or https address. */
          readonly kind: "invalid"
      }

/** Files read from one pasted Drive folder. */
export const MAX_FOLDER_FILES = 300

/** Nested levels read below one pasted Drive folder. */
export const MAX_FOLDER_DEPTH = 3

/** The Google-native types of Drive. */
export const DRIVE_MIME = {
    folder: "application/vnd.google-apps.folder",
    shortcut: "application/vnd.google-apps.shortcut",
    doc: "application/vnd.google-apps.document",
    sheet: "application/vnd.google-apps.spreadsheet",
    slides: "application/vnd.google-apps.presentation",
} as const

/** How a Drive file is read: Google-native types are exported, uploaded files are downloaded. */
export type DriveReadMode = "doc" | "sheet" | "slides" | "media"

/** The result of asking how a Drive file is read: a mode, or null when it cannot be read. */
export type DriveReadModeResult = DriveReadMode | null

const ID = /^[\w-]{10,}$/u
const TRACKING = /^(fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|_ga|_gl|ref_src|usp|utm_.*)$/iu
const GOOGLE_HOSTS = /^(drive|docs)\.google\.com$/iu
const OPEN_XML = /\.(pdf|docx|xlsx|pptx|txt|md|markdown|csv)$/iu
const UPLOADED_MIME =
    /^(application\/pdf|text\/(plain|markdown|csv)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))$/u

/** The id after `/marker/` in a path, when it looks like a Drive id. */
const idAfter = (path: string, marker: string): string | null => {
    const match = new RegExp(`/${marker}/([\\w-]+)`, "u").exec(path)
    const id = match?.[1]
    return id !== undefined && ID.test(id) ? id : null
}

/** The URL with tracking params removed and, on Google hosts, the account switch segment (`/u/2/`) dropped. */
const tidy = (url: URL): URL => {
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key)
    if (GOOGLE_HOSTS.test(url.hostname)) url.pathname = url.pathname.replace(/\/u\/\d+(?=\/|$)/u, "")
    return url
}

/** How a Drive file is read; null when its type cannot be read. */
export const driveReadMode = (mimeType: string, name: string): DriveReadModeResult => {
    if (mimeType === DRIVE_MIME.doc) return "doc"
    if (mimeType === DRIVE_MIME.sheet) return "sheet"
    if (mimeType === DRIVE_MIME.slides) return "slides"
    if (mimeType.startsWith("application/vnd.google-apps.")) return null
    if (OPEN_XML.test(name)) return "media"
    return UPLOADED_MIME.test(mimeType) ? "media" : null
}

/** What a Google Docs address points at: the document, the sheet (with its tab), the slides. */
const docsTarget = (url: URL): LinkTarget => {
    const path = url.pathname
    const doc = idAfter(path, "document/d")
    if (doc !== null) {
        return { kind: "google", driveId: doc, fetchUrl: `https://docs.google.com/document/d/${doc}/export?format=txt` }
    }
    const sheet = idAfter(path, "spreadsheets/d")
    if (sheet !== null) {
        const gid = /[#&?]gid=(\d+)/u.exec(url.hash + url.search)?.[1]
        const tab = gid === undefined ? "" : `&gid=${gid}`
        return {
            kind: "google",
            driveId: sheet,
            fetchUrl: `https://docs.google.com/spreadsheets/d/${sheet}/export?format=csv${tab}`,
        }
    }
    const slides = idAfter(path, "presentation/d")
    if (slides !== null) {
        return {
            kind: "google",
            driveId: slides,
            fetchUrl: `https://docs.google.com/presentation/d/${slides}/export/txt`,
        }
    }
    return { kind: "web", fetchUrl: url.toString() }
}

/** What a Google Drive address points at: a folder, a file, or something else. */
const driveTarget = (url: URL): LinkTarget => {
    const path = url.pathname
    if (/\/folders\/|\/drive\/(my-drive|shared-with-me)/u.test(path)) {
        return { kind: "drive-folder", folderId: idAfter(path, "folders") }
    }
    const queried = path === "/open" || path === "/uc" ? url.searchParams.get("id") : null
    const id = idAfter(path, "file/d") ?? (queried !== null && ID.test(queried) ? queried : null)
    if (id !== null) {
        return { kind: "drive-file", driveId: id, fetchUrl: `https://drive.google.com/uc?export=download&id=${id}` }
    }
    return { kind: "web", fetchUrl: url.toString() }
}

/** One pasted link -> what to fetch. Plain pages are returned unchanged (tracking params aside). */
export const resolveLink = (raw: string): LinkTarget => {
    if (!URL.canParse(raw.trim())) return { kind: "invalid" }
    const url = tidy(new URL(raw.trim()))
    if (!/^https?:$/u.test(url.protocol)) return { kind: "invalid" }
    const host = url.hostname.toLowerCase()
    if (host === "docs.google.com") return docsTarget(url)
    if (host === "drive.google.com") return driveTarget(url)
    return { kind: "web", fetchUrl: url.toString() }
}

/** True when a Drive or file id has the shape of a Drive id. */
export const isDriveId = (value: string): boolean => ID.test(value)
