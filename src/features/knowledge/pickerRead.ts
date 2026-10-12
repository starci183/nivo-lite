import { driveReadMode, LINK_ERROR, type DriveReadMode } from "@/lib/knowledge/drive"
import { mimeFromName } from "@/lib/knowledge/zip"

/**
 * Reads the bytes of a file chosen in the Google Picker (drive.file). The Picker token is short-lived and held only in the drawer, so the
 * browser fetches the bytes itself and hands them to storage; the workers never see the token. Browser only.
 * Google-native files are exported (Docs and Slides to text, Sheets to CSV); uploaded files are downloaded as they are.
 */
const MAX_BYTES = 10_000_000
const BASE = "https://www.googleapis.com/drive/v3/files"
const EXPORT: Record<Exclude<DriveReadMode, "media">, { readonly mime: string; readonly ext: string }> = {
  doc: { mime: "text/plain", ext: "txt" }, sheet: { mime: "text/csv", ext: "csv" }, slides: { mime: "text/plain", ext: "txt" },
}
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md", "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}
const READABLE = /\.(txt|md|markdown|csv|pdf|docx|xlsx|pptx)$/i

/** Error text the drawer turns into "pick again" (expired token) or a plain reason. */
const expired = `${LINK_ERROR.tokenExpired}: `

export const readPickedFile = async (token: string, id: string, mimeType: string, name: string): Promise<File> => {
  const mode = driveReadMode(mimeType, name)
  if (!mode) throw new Error("errDriveType")
  const url = mode === "media"
    ? `${BASE}/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`
    : `${BASE}/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(EXPORT[mode].mime)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new Error(expired)
  if (!res.ok) throw new Error(`Google Drive ${res.status}`)
  const blob = await res.blob()
  if (blob.size > MAX_BYTES) throw new Error("errTooBig")
  const base = name.replace(/^.*[\\/]/, "")
  let fileName = base
  if (mode !== "media") fileName = `${base.replace(/\.[^.]+$/, "")}.${EXPORT[mode].ext}`
  else if (!READABLE.test(base)) fileName = `${base}.${EXT_BY_MIME[mimeType] ?? "txt"}`
  return new File([blob], fileName, { type: mimeFromName(fileName) || blob.type })
}
