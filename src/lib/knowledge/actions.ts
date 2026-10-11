"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentMember } from "../members";
import { drainBrainWork, extractionsOf } from "../brain/doc-facts";
import type { ExtractionInfo } from "../brain/shared";
import { getSession } from "../session";
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
    if (!isModuleKey(module)) throw new Error("Unknown module");
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
