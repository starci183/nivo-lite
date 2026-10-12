"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentMember } from "../members";
import { drainBrainWork, extractionsOf } from "../brain/doc-facts";
import type { ExtractionInfo } from "../brain/shared";
import { getSession } from "../session";
import { googleConfigured } from "../google";
import { safeReturnTo } from "../google-sheets-core";
import { linkError, LINK_ERROR, resolveLink } from "./drive";
import { fetchFile, listFolder, type DriveFile } from "./drive-api";
import { disconnectDrive, driveAuthUrl, driveGrantOf, withDriveToken, type DriveGrant } from "./drive-grant";
import { fileTextKind, textFromBytes } from "./extract";
import type { ModuleKey } from "../modules-shared";
import { isModuleKey } from "../modules-shared";
import type { Outcome } from "../types";
import {
  addSource, afterResponse, deleteSource, reindexSource, searchKnowledge, setSuggestionState, updateSource,
  type AddSourceInput, type Audience, type KnowledgeSource, type Passage, type SuggestionState,
} from "./index";

const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
const refresh = () => revalidatePath("/knowledge", "layout");
const managers = () => requireRole(["owner", "manager"]);

/** Add a source (text, FAQ, file contents or a link) and index it. Owner and manager only. */
export const addKnowledge = async (input: AddSourceInput): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const source = await addSource(input);
    refresh();
    return source;
  });

const MAX_UPLOAD_BYTES = 10_000_000;

/**
 * Batch flow, one file per call: read the text of a .txt / .md / .csv / .pdf / .docx upload, then create and index the source
 * through the same path as addKnowledge. FormData: file, visibility, module, topic, tags (comma separated).
 */
export const addKnowledgeFile = async (form: FormData): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Thiếu tệp.");
    const kind = fileTextKind(file.name);
    if (!kind) throw new Error("Chỉ nhận .txt, .md, .csv, .pdf hoặc .docx.");
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Tệp quá lớn (tối đa 10 MB).");
    const content = await textFromBytes(kind, new Uint8Array(await file.arrayBuffer()));
    const mod = String(form.get("module") ?? "");
    const source = await addSource({
      kind: "file", title: file.name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, ""), content,
      topic: String(form.get("topic") ?? "") || null,
      tags: String(form.get("tags") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      module: isModuleKey(mod) ? mod : null, visibility: form.get("visibility") === "public" ? "public" : "internal",
    });
    refresh();
    return source;
  });

/** Batch flow, one link per call: Google Docs/Sheets/Slides/Drive share links become public export URLs, then it is indexed like any link. */
export const addKnowledgeLink = async (url: string, meta: Omit<AddSourceInput, "kind" | "title" | "content">): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const source = await addSource({ ...meta, kind: "url", title: "", content: url });
    refresh();
    return source;
  });

export const deleteKnowledge = async (id: string): Promise<Outcome<null>> =>
  run(async () => {
    await managers();
    await deleteSource(id);
    refresh();
    return null;
  });

/** Re-chunk and re-embed a source; pass `content` to replace its text first. */
export const reindexKnowledge = async (id: string, content?: string): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const source = await reindexSource(id, content);
    refresh();
    return source;
  });

export const updateKnowledge = async (id: string, patch: Partial<Pick<AddSourceInput, "title" | "topic" | "tags" | "module" | "visibility">>): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const source = await updateSource(id, patch);
    refresh();
    return source;
  });

/** "Thử hỏi": what the agents would retrieve for a question. Any member may try; `customer` shows only public passages. */
export const askKnowledge = async (question: string, module: ModuleKey, audience: Audience): Promise<Outcome<Array<Passage>>> =>
  run(async () => {
    await getCurrentMember();
    if (!isModuleKey(module)) throw new Error("Unknown agent");
    const q = question.trim().slice(0, 500);
    if (!q) return [];
    return searchKnowledge(module, q, 8, audience === "customer" ? "customer" : "internal");
  });

/** Mark a "Nên bổ sung" suggestion not applicable or dismissed (null brings it back). */
export const decideSuggestion = async (key: string, state: SuggestionState | null): Promise<Outcome<null>> =>
  run(async () => {
    await managers();
    await setSuggestionState(key, state);
    refresh();
    revalidatePath("/", "layout");
    return null;
  });

/**
 * Progress of reading facts out of documents, for the Add documents drawer ("Đang đọc sự thật…" / "Đã đề xuất N sự thật"). Asking also gives
 * work that is still waiting a push: it runs after this response, bounded, and never blocks the poll.
 */
export const pollExtractions = async (sourceIds: Array<string>): Promise<Outcome<Array<ExtractionInfo>>> =>
  run(async () => {
    await managers();
    const ws = (await getSession()).workspace.id;
    const list = await extractionsOf(ws, sourceIds.slice(0, 50));
    if (list.some((x) => x.status === "queued" || x.status === "running")) afterResponse(() => drainBrainWork(ws));
    return list;
  });

/* ------------------------------------------------------------------ Google Drive grant (private files and folders) */

/**
 * drive.readonly is a Google *restricted* scope: the published OAuth app does not ask for it. The read grant stays an internal tool,
 * offered only to the Google accounts listed in NIVO_DRIVE_READ_EMAILS (comma separated); customers use the Picker (drive.file).
 */
const mayGrantDriveRead = async (): Promise<boolean> => {
  const allowed = (process.env.NIVO_DRIVE_READ_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (!allowed.length) return false
  return allowed.includes((await getSession()).email.toLowerCase())
}

/** The workspace's Drive read grant for the Add documents drawer; `configured` = the Google client exists and this person may use it. */
export const driveGrantStatus = async (): Promise<Outcome<DriveGrant & { readonly configured: boolean }>> =>
  run(async () => {
    const member = await managers();
    return { ...(await driveGrantOf(member.workspaceId)), configured: googleConfigured() && (await mayGrantDriveRead()) };
  });

/** Start the Drive consent: the Google URL to go to; the callback brings the browser back to `returnTo` with ?drive=ok|error. */
export const startDriveGrant = async (returnTo: string): Promise<Outcome<{ url: string }>> =>
  run(async () => {
    const member = await managers();
    if (!(await mayGrantDriveRead())) throw new Error("Quyền đọc toàn bộ Google Drive chỉ dành cho tài khoản nội bộ. Dùng \"Chọn từ Google Drive\".");
    const url = googleConfigured() ? driveAuthUrl(member.workspaceId, member.userId, safeReturnTo(returnTo)) : null;
    if (!url) throw new Error("Google chưa được bật cho NIVO.");
    return { url };
  });

export const disconnectDriveGrant = async (): Promise<Outcome<null>> =>
  run(async () => {
    await disconnectDrive((await managers()).workspaceId);
    return null;
  });

/** A pasted Drive folder link -> its files (root + 3 nested levels), read with the grant. The drawer turns each into a queue row. */
export const listDriveFolder = async (url: string): Promise<Outcome<{ name: string; files: ReadonlyArray<DriveFile>; truncated: boolean }>> =>
  run(async () => {
    const member = await managers();
    const target = resolveLink(url);
    if (target.kind !== "drive-folder" || !target.folderId) throw new Error("Đây không phải liên kết thư mục Google Drive.");
    const folderId = target.folderId;
    return withDriveToken(member.workspaceId, (token) => listFolder(token, folderId));
  });

/* ------------------------------------------------------------------ Google Picker (drive.file): items the owner picked, read with a short-lived token */

/**
 * The Picker token is a browser-held drive.file access token (about an hour). It only travels inside these calls to Google and is never
 * stored, logged or returned. A 401 from Google means it expired: the row asks the owner to pick again.
 */
const pickerToken = (v: unknown): string => {
  if (typeof v !== "string" || v.length < 20 || v.length > 4096 || !/^[w.~+/=-]+$/.test(v)) throw linkError(LINK_ERROR.tokenExpired, "Phiên Google Drive đã hết hạn. Hãy chọn lại.");
  return v;
};
const expired = (e: unknown): never => {
  if ((e as { status?: number }).status === 401) throw linkError(LINK_ERROR.tokenExpired, "Phiên Google Drive đã hết hạn. Hãy chọn lại.");
  throw e;
};

/**
 * A folder picked in the Google Picker -> its children. Reports what Google returned: `empty` is true when the listing came back with no
 * files or was refused (403/404), which is what the drawer turns into the "pick the files inside" row. No claim is made about why.
 */
export const listPickedFolder = async (folderId: string, token: string): Promise<Outcome<{ name: string; files: ReadonlyArray<DriveFile>; truncated: boolean; empty: boolean }>> =>
  run(async () => {
    await managers();
    const t = pickerToken(token);
    try {
      const r = await listFolder(t, folderId);
      return { ...r, empty: r.files.length === 0 };
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403 || status === 404) return { name: "", files: [], truncated: false, empty: true };
      return expired(e);
    }
  });

/** One picked Drive file: exported (Docs, Sheets, Slides) or downloaded (alt=media), then indexed like an uploaded file. */
export const addKnowledgePickedFile = async (fileId: string, token: string, meta: Omit<AddSourceInput, "kind" | "title" | "content">): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    await managers();
    const t = pickerToken(token);
    const file = await fetchFile(t, fileId).catch(expired);
    const source = await addSource({ ...meta, kind: "file", title: file.name.replace(/.[^.]+$/, ""), content: file.text });
    refresh();
    return source;
  });

/** One Drive file of an expanded folder: read with the grant, then indexed through the same path as an uploaded file. */
export const addKnowledgeDriveFile = async (fileId: string, meta: Omit<AddSourceInput, "kind" | "title" | "content">): Promise<Outcome<KnowledgeSource>> =>
  run(async () => {
    const member = await managers();
    const file = await withDriveToken(member.workspaceId, (token) => fetchFile(token, fileId));
    const source = await addSource({ ...meta, kind: "file", title: file.name.replace(/\.[^.]+$/, ""), content: file.text });
    refresh();
    return source;
  });
