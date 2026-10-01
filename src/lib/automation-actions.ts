"use server";

import { revalidatePath } from "next/cache";
import { provisionOrdersSheet } from "./google";
import { proposeBody } from "./automation-ai";
import { loadAutomations, loadContextFor, loadRuns, type PipelineRow } from "./automation-queries";
import { isTemplateKey, resolveConfig, type AutomationCardView, type AutomationRunView, type PipelineConfig, type ShopContext, type TemplateDef, type TemplateKey } from "./automation-shared";
import { templateOf } from "./automation-templates";
import { logEvidence } from "./core";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/**
 * Server actions of the /automations screen and the module Settings section. Owner and manager only; scoped to the caller's workspace
 * (service role, the check is requireManager). Switching a template on never sends anything by itself: its triggers run through
 * src/lib/automation-engine.ts and every customer-facing send passes the authority gate.
 */
const run = async <T>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

const definition = (key: TemplateKey): TemplateDef => {
  const def = isTemplateKey(key) ? templateOf(key) : null;
  if (!def) throw new Error("Không có mẫu tự động hoá này.");
  return def;
};

const currentPipeline = async (ws: string, key: TemplateKey): Promise<PipelineRow | null> =>
  ((await supabaseAdmin().from("automation_pipelines").select("*").eq("workspace_id", ws).eq("template_key", key).maybeSingle()).data as PipelineRow | null);

/** Create or update the pipeline row of a template. */
const upsertPipeline = async (ws: string, userId: string, def: TemplateDef, patch: Partial<Pick<PipelineRow, "enabled" | "dismissed" | "config" | "body" | "body_version" | "based_on_context" | "approval_streak" | "trust_offered_at" | "auto_send">>): Promise<PipelineRow> => {
  const current = await currentPipeline(ws, def.key);
  const row = {
    workspace_id: ws, template_key: def.key, name: def.name.vi, module_key: def.moduleKey, template_version: def.version, ...(current ? {} : { created_by: userId }),
    ...patch, updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin().from("automation_pipelines").upsert(row, { onConflict: "workspace_id,template_key" }).select().single();
  if (error) throw new Error(error.message);
  return data as PipelineRow;
};

const cardOf = async (ws: string, key: TemplateKey): Promise<AutomationCardView> => {
  const { cards } = await loadAutomations(supabaseAdmin(), ws);
  return cards.find((c) => c.key === key) as AutomationCardView;
};

const evidence = async (ws: string, actor: string, kind: string, summary: string, detail?: string) =>
  logEvidence(supabaseAdmin(), ws, { kind, actor, summary, evidence: detail ?? null }).catch(() => undefined);

/**
 * Propose the shop's own wording for a template from its ACTIVE context (one model call, not saved). The owner reviews or edits it, then saves it with
 * saveAutomation. `generated: false` means the model was unavailable and the frame's default wording is returned.
 */
export const generateAutomationBody = async (key: TemplateKey): Promise<Outcome<{ body: string; generated: boolean; contextVersion: number | null }>> =>
  run(async () => {
    const member = await requireManager();
    const def = definition(key);
    if (!def.defaultBody) throw new Error("Mẫu này không gửi tin cho khách.");
    const ctx = await loadContextFor(supabaseAdmin(), member.workspaceId, def.moduleKey);
    const out = await proposeBody(supabaseAdmin(), member.workspaceId, def, ctx.text);
    return { ...out, contextVersion: ctx.version };
  });

/**
 * Switch a template on or off. Turning on needs an approved message for templates that send one: when the owner has not saved one yet, the frame's default
 * wording is stored (the screen normally offers the generated proposal first). "sheet_orders" needs a Google connection (the card offers "Kết nối Google");
 * the first switch-on creates the spreadsheet.
 */
export const toggleAutomation = async (key: TemplateKey, enabled: boolean): Promise<Outcome<AutomationCardView>> =>
  run(async () => {
    const member = await requireManager();
    const def = definition(key);
    if (def.executor === "definition") throw new Error("Mẫu này sắp có.");
    const ws = member.workspaceId;
    const existing = await currentPipeline(ws, key);
    const patch: Parameters<typeof upsertPipeline>[3] = { enabled };
    if (enabled) {
      patch.dismissed = false;
      let config: PipelineConfig = resolveConfig(def, existing?.config);
      if (def.requires.connections.includes("google") && !config.spreadsheetId) {
        const sheet = await provisionOrdersSheet(ws, member.userId, config);
        config = { ...config, spreadsheetId: sheet.spreadsheetId, sheetUrl: sheet.spreadsheetUrl };
        patch.config = config;
      }
      if (def.defaultBody && !existing?.body) {
        const ctx = await loadContextFor(supabaseAdmin(), ws, def.moduleKey);
        patch.body = def.defaultBody.vi;
        patch.body_version = 1;
        patch.based_on_context = ctx.version;
      }
    }
    await upsertPipeline(ws, member.userId, def, patch);
    await evidence(ws, member.displayName, enabled ? "automation.enabled" : "automation.disabled", `${enabled ? "Bật" : "Tắt"} tự động hoá: ${def.name.vi}`);
    revalidatePath("/automations");
    return cardOf(ws, key);
  });

/** Save the settings (validated and clamped by resolveConfig) and/or the approved message of a template. The body may only use the template's own variables. */
export const saveAutomation = async (key: TemplateKey, input: { readonly values?: Readonly<Record<string, string | number | boolean>>; readonly body?: string }): Promise<Outcome<AutomationCardView>> =>
  run(async () => {
    const member = await requireManager();
    const def = definition(key);
    const ws = member.workspaceId;
    const existing = await currentPipeline(ws, key);
    const patch: Parameters<typeof upsertPipeline>[3] = {};
    if (input.values) {
      const editable = new Set(def.settings.map((f) => f.key));
      const picked = Object.fromEntries(Object.entries(input.values).filter(([k]) => editable.has(k)));
      patch.config = resolveConfig(def, { ...(existing?.config ?? {}), ...picked });
    }
    if (input.body !== undefined) {
      if (!def.defaultBody) throw new Error("Mẫu này không có lời nhắn.");
      const body = input.body.trim().slice(0, 600);
      if (body.length < 10) throw new Error("Lời nhắn quá ngắn.");
      const unknown = [...body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]).filter((v) => !def.variables.includes(v));
      if (unknown.length) throw new Error(`Lời nhắn có chỗ trống không dùng được: {${unknown[0]}}.`);
      const ctx = await loadContextFor(supabaseAdmin(), ws, def.moduleKey);
      patch.body = body;
      patch.body_version = (existing?.body_version ?? 0) + 1;
      patch.based_on_context = ctx.version;
      // A new wording restarts the trust ladder: the owner has not approved messages written from it yet.
      patch.approval_streak = 0;
      patch.trust_offered_at = null;
      patch.auto_send = false;
    }
    await upsertPipeline(ws, member.userId, def, patch);
    if (input.body !== undefined) await evidence(ws, member.displayName, "automation.body_saved", `Duyệt lời nhắn tự động hoá: ${def.name.vi}`, input.body.trim().slice(0, 600));
    revalidatePath("/automations");
    return cardOf(ws, key);
  });

/** "Không áp dụng" (and restore): persisted per workspace. A dismissed template is switched off. */
export const dismissAutomation = async (key: TemplateKey, dismissed: boolean): Promise<Outcome<AutomationCardView>> =>
  run(async () => {
    const member = await requireManager();
    const def = definition(key);
    await upsertPipeline(member.workspaceId, member.userId, def, { dismissed, ...(dismissed ? { enabled: false } : {}) });
    revalidatePath("/automations");
    return cardOf(member.workspaceId, key);
  });

/** The owner's answer to "Cho tự gửi" (offered after 20 approvals in a row without edits). Accepting makes this automation send by itself; recorded as evidence. */
export const answerAutoSend = async (key: TemplateKey, accept: boolean): Promise<Outcome<AutomationCardView>> =>
  run(async () => {
    const member = await requireManager();
    const def = definition(key);
    const ws = member.workspaceId;
    const existing = await currentPipeline(ws, key);
    if (!existing?.trust_offered_at) throw new Error("Chưa đến lúc đề xuất tự gửi.");
    await upsertPipeline(ws, member.userId, def, accept ? { auto_send: true } : { trust_offered_at: null, approval_streak: 0 });
    await evidence(ws, member.displayName, accept ? "automation.auto_send_granted" : "automation.auto_send_declined",
      accept ? `Chủ shop cho phép "${def.name.vi}" tự gửi` : `Chủ shop chưa cho "${def.name.vi}" tự gửi`, `${existing.approval_streak} lần duyệt liên tiếp không sửa.`);
    revalidatePath("/automations");
    return cardOf(ws, key);
  });

/** The run history (all templates, or one), newest first. */
export const listAutomationRuns = async (key?: TemplateKey): Promise<Outcome<Array<AutomationRunView>>> =>
  run(async () => {
    const member = await requireManager();
    return loadRuns(supabaseAdmin(), member.workspaceId, { templateKey: key, limit: 40 });
  });

/** Everything the screen shows, for client-side refresh after an action. */
export const refreshAutomations = async (): Promise<Outcome<{ cards: Array<AutomationCardView>; runs: Array<AutomationRunView>; shop: ShopContext }>> =>
  run(async () => {
    const member = await requireManager();
    return loadAutomations(supabaseAdmin(), member.workspaceId);
  });
