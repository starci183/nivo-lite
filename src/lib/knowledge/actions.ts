"use server";

import { revalidatePath } from "next/cache";
import { requireRole, getCurrentMember } from "../members";
import type { ModuleKey } from "../modules-shared";
import { isModuleKey } from "../modules-shared";
import type { Outcome } from "../types";
import {
  addSource, deleteSource, reindexSource, searchKnowledge, setSuggestionState, updateSource,
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
