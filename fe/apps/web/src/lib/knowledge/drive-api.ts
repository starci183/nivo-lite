import "server-only";
import { DRIVE_MIME, driveReadMode, linkError, LINK_ERROR, MAX_FOLDER_DEPTH, MAX_FOLDER_FILES, type DriveReadMode } from "./drive";
import { fileTextKind, sniffTextKind, textFromBytes } from "./extract";
import { MAX_SOURCE_CHARS } from "./shared";

/**
 * Drive REST access for the Second Brain import, with the owner's own token (see drive-grant.ts). Plain fetch, no googleapis package.
 *
 * COMPLIANCE NOTE: drive.readonly is a Google *restricted* scope. While the OAuth app is unverified, users see the "unverified app" screen
 * and the app is limited to 100 users. A public launch needs Google's verification and security assessment (CASA), or a move to the
 * Google Picker with drive.file (the user picks the files, no restricted scope).
 *
 *   listFolder   a folder tree (root + 3 nested levels, paginated, shortcuts followed when their target opens), files only.
 *   fetchFile    the text of one file: Docs/Slides -> text/plain, Sheets -> text/csv (first sheet), pdf/docx/txt/md/csv downloaded and read.
 * Caps: 10 MB per file, 120k characters of text, 300 files per folder. Errors carry `status`; withDriveToken retries a 401 once.
 */
export const MAX_DRIVE_BYTES = 10_000_000;
const MAX_SHORTCUT_LOOKUPS = 40;
const ID = /^[\w-]{10,}$/;

export type DriveFile = { readonly id: string; readonly name: string; readonly mimeType: string; readonly size: number | null; readonly modifiedTime: string | null; readonly path: string };
type Meta = { id?: string; name?: string; mimeType?: string; size?: string; modifiedTime?: string; trashed?: boolean; shortcutDetails?: { targetId?: string; targetMimeType?: string } };
type Env = Readonly<Record<string, string | undefined>>;

const base = (env: Env = process.env): string => (env.GOOGLE_DRIVE_BASE || "https://www.googleapis.com/drive/v3").replace(/\/+$/, "");
const LIVE = "supportsAllDrives=true&includeItemsFromAllDrives=true";

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
const metaOf = (token: string, id: string, env?: Env): Promise<Meta> => getJson<Meta>(token, `${base(env)}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,modifiedTime,trashed&supportsAllDrives=true`);
const asFile = (m: Meta, id: string, path: string): DriveFile => ({ id, name: m.name ?? id, mimeType: m.mimeType ?? "", size: m.size ? Number(m.size) : null, modifiedTime: m.modifiedTime ?? null, path });

/** Every readable-or-not file under a folder (folders themselves are not returned), with the folder's own name. */
export const listFolder = async (token: string, folderId: string, env?: Env): Promise<{ readonly name: string; readonly files: ReadonlyArray<DriveFile>; readonly truncated: boolean }> => {
  if (!ID.test(folderId)) throw new Error("Mã thư mục không hợp lệ.");
  const root = await metaOf(token, folderId, env);
  if (root.mimeType !== DRIVE_MIME.folder) throw linkError(LINK_ERROR.unsupported, "Liên kết này không phải thư mục Google Drive.");
  const files: Array<DriveFile> = [];
  const seenFiles = new Set<string>();
  const seenFolders = new Set<string>([folderId]);
  const queue: Array<{ id: string; path: string; depth: number }> = [{ id: folderId, path: "", depth: 0 }];
  let lookups = 0;
  let truncated = false;
  const join = (path: string, name: string) => (path ? `${path}/${name}` : name);
  const enter = (id: string, path: string, depth: number) => {
    if (depth > MAX_FOLDER_DEPTH) { truncated = true; return; }
    if (!seenFolders.has(id)) { seenFolders.add(id); queue.push({ id, path, depth }); }
  };
  const push = (f: DriveFile) => {
    if (seenFiles.has(f.id)) return;
    if (files.length >= MAX_FOLDER_FILES) { truncated = true; return; }
    seenFiles.add(f.id);
    files.push(f);
  };

  for (let at = 0; at < queue.length && !truncated; at++) {
    const dir = queue[at] as (typeof queue)[number];
    let pageToken = "";
    do {
      const q = encodeURIComponent(`'${dir.id}' in parents and trashed=false`);
      const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime,shortcutDetails(targetId,targetMimeType))");
      const page = await getJson<{ files?: Array<Meta>; nextPageToken?: string }>(token, `${base(env)}/files?q=${q}&fields=${fields}&pageSize=200&orderBy=name&${LIVE}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
      for (const f of page.files ?? []) {
        if (!f.id) continue;
        if (f.mimeType === DRIVE_MIME.folder) { enter(f.id, join(dir.path, f.name ?? f.id), dir.depth + 1); continue; }
        if (f.mimeType === DRIVE_MIME.shortcut) {
          const target = f.shortcutDetails?.targetId;
          if (!target || !ID.test(target) || lookups++ >= MAX_SHORTCUT_LOOKUPS) continue;
          try {
            const m = await metaOf(token, target, env);
            if (m.trashed) continue;
            if (m.mimeType === DRIVE_MIME.folder) enter(target, join(dir.path, f.name ?? m.name ?? target), dir.depth + 1);
            else push(asFile(m, target, dir.path));
          } catch { /* a shortcut whose target does not open is skipped */ }
          continue;
        }
        push(asFile(f, f.id, dir.path));
      }
      pageToken = page.nextPageToken ?? "";
    } while (pageToken && !truncated);
  }
  return { name: root.name ?? folderId, files, truncated };
};

const EXPORT: Record<Exclude<DriveReadMode, "media">, string> = { doc: "text/plain", sheet: "text/csv", slides: "text/plain" };

/** The text of one Drive file the token can open (metadata first, so the type and size are checked before any download). */
export const fetchFile = async (token: string, fileId: string, env?: Env): Promise<{ readonly name: string; readonly text: string }> => {
  if (!ID.test(fileId)) throw new Error("Mã tệp không hợp lệ.");
  const meta = await metaOf(token, fileId, env);
  const name = meta.name ?? fileId;
  if (meta.mimeType === DRIVE_MIME.folder) throw linkError(LINK_ERROR.folder, "Đây là thư mục, hãy dán liên kết thư mục để nhập cả thư mục.");
  const mode = driveReadMode(meta.mimeType ?? "", name);
  if (!mode) throw linkError(LINK_ERROR.unsupported, `Chưa đọc được loại tệp này (${meta.mimeType || "không rõ"}). Hỗ trợ Google Docs, Sheets, Slides, PDF, Word, văn bản và CSV.`);
  if (meta.size && Number(meta.size) > MAX_DRIVE_BYTES) throw new Error("Tệp quá lớn (tối đa 10 MB).");
  const id = encodeURIComponent(fileId);
  const res = await get(token, mode === "media" ? `${base(env)}/files/${id}?alt=media&supportsAllDrives=true` : `${base(env)}/files/${id}/export?mimeType=${encodeURIComponent(EXPORT[mode])}`);
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
