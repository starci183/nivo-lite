// PORTED from src/lib/knowledge/drive-api.ts (keep in sync by hand): only fetchFile, the part knowledge.index needs (listFolder stays in the web,
// where the Add documents drawer expands a folder into files). Differences: the Drive base URL is passed in instead of read from process.env.
import { DRIVE_MIME, driveReadMode, linkError, LINK_ERROR, type DriveReadMode } from "./drive";
import { fileTextKind, sniffTextKind, textFromBytes } from "./extract";
import { MAX_SOURCE_CHARS } from "./limits";

export const MAX_DRIVE_BYTES = 10_000_000;
const ID = /^[\w-]{10,}$/;

type Meta = { id?: string; name?: string; mimeType?: string; size?: string; modifiedTime?: string; trashed?: boolean };

const get = async (token: string, url: string): Promise<Response> => {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw Object.assign(new Error(`Không kết nối được Google Drive (${e instanceof Error ? e.message : "lỗi mạng"}).`), { status: 0 });
  }
  if (res.ok) return res;
  const body = await res.text().catch(() => "");
  if (res.status === 401) throw Object.assign(new Error("drive_401"), { status: 401 });
  if (res.status === 404 || (res.status === 403 && !/rateLimit|quota|userRateLimit/i.test(body))) {
    throw Object.assign(linkError(LINK_ERROR.noAccess, "Tài khoản Google Drive đã kết nối không mở được mục này. Hãy chia sẻ nó với tài khoản đó."), { status: res.status });
  }
  throw Object.assign(new Error(`Google Drive báo lỗi (${res.status}).`), { status: res.status });
};

const getJson = async <T>(token: string, url: string): Promise<T> => (await (await get(token, url)).json()) as T;
const metaOf = (base: string, token: string, id: string): Promise<Meta> => getJson<Meta>(token, `${base}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,modifiedTime,trashed&supportsAllDrives=true`);

const EXPORT: Record<Exclude<DriveReadMode, "media">, string> = { doc: "text/plain", sheet: "text/csv", slides: "text/plain" };

/** The text of one Drive file the token can open (metadata first, so the type and size are checked before any download). */
export const fetchFile = async (base: string, token: string, fileId: string): Promise<{ readonly name: string; readonly text: string }> => {
  if (!ID.test(fileId)) throw new Error("Mã tệp không hợp lệ.");
  const meta = await metaOf(base, token, fileId);
  const name = meta.name ?? fileId;
  if (meta.mimeType === DRIVE_MIME.folder) throw linkError(LINK_ERROR.folder, "Đây là thư mục, hãy dán liên kết thư mục để nhập cả thư mục.");
  const mode = driveReadMode(meta.mimeType ?? "", name);
  if (!mode) throw linkError(LINK_ERROR.unsupported, `Chưa đọc được loại tệp này (${meta.mimeType || "không rõ"}). Hỗ trợ Google Docs, Sheets, Slides, PDF, Word, văn bản và CSV.`);
  if (meta.size && Number(meta.size) > MAX_DRIVE_BYTES) throw new Error("Tệp quá lớn (tối đa 10 MB).");
  const id = encodeURIComponent(fileId);
  const res = await get(token, mode === "media" ? `${base}/files/${id}?alt=media&supportsAllDrives=true` : `${base}/files/${id}/export?mimeType=${encodeURIComponent(EXPORT[mode])}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_DRIVE_BYTES) throw new Error("Tệp quá lớn (tối đa 10 MB).");
  let text: string;
  if (mode === "media") {
    const kind = fileTextKind(name) ?? sniffTextKind(bytes, res.headers.get("content-type") ?? "");
    if (!kind) throw linkError(LINK_ERROR.unsupported, "Chưa đọc được loại tệp này.");
    text = await textFromBytes(kind, bytes);
  } else {
    text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  }
  return { name, text: text.slice(0, MAX_SOURCE_CHARS) };
};
