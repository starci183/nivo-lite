"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { email as dict } from "@/i18n/dict/email";
import { isEmailAddress } from "./email/send";
import { defaultConfig, n8nTemplateOf } from "./n8n-templates";
import { startPipelineRun } from "./n8n-pipelines";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/** Turn a shared n8n email pipeline on/off for the caller's workspace, save its settings and wording, or start one run now (owner | manager). */
export type PipelineSave = { readonly enabled: boolean; readonly values: Readonly<Record<string, string | number>> };

const fail = (error: string): Outcome<never> => ({ ok: false, error });

export const savePipeline = async (key: string, input: PipelineSave): Promise<Outcome<true>> => {
  const tr = await getT(dict);
  const tpl = n8nTemplateOf(key);
  if (!tpl) return fail(tr("err_none"));
  try {
    const member = await requireManager();
    const config: Record<string, string | number> = defaultConfig(tpl);
    for (const s of tpl.settings) {
      const raw = input.values[s.key];
      if (raw === undefined || raw === "") {
        if (s.required && input.enabled) return fail(tr("err_fields"));
        continue;
      }
      if (s.kind === "time") {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(raw))) return fail(tr("err_generic"));
        config[s.key] = String(raw);
      } else if (s.kind === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) return fail(tr("err_generic"));
        config[s.key] = Math.min(s.max ?? 365, Math.max(s.min ?? 0, Math.round(n)));
      } else if (s.kind === "email") {
        const v = String(raw).trim().toLowerCase();
        if (!isEmailAddress(v)) return fail(tr("err_email"));
        config[s.key] = v;
      } else {
        config[s.key] = String(raw).slice(0, s.kind === "textarea" ? 4000 : 200);
      }
    }
    const { error } = await supabaseAdmin().from("n8n_pipelines").upsert(
      { workspace_id: member.workspaceId, template_key: key, enabled: input.enabled, config, updated_by: member.userId, updated_at: new Date().toISOString() },
      { onConflict: "workspace_id,template_key" },
    );
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return { ok: true, data: true };
  } catch (e) {
    console.error("savePipeline failed", e instanceof Error ? e.message : e);
    return fail(e instanceof Error && e.message.length < 160 ? e.message : tr("err_generic"));
  }
};

/** "Chạy thử ngay": one run of a schedule pipeline now (the engine delivers it to n8n; the result shows in the email history). */
export const runPipelineNow = async (key: string): Promise<Outcome<true>> => {
  const tr = await getT(dict);
  const tpl = n8nTemplateOf(key);
  if (!tpl || tpl.trigger.kind !== "schedule") return fail(tr("err_none"));
  try {
    const member = await requireManager();
    const nowVn = new Date(Date.now() + 7 * 3_600_000);
    const data = key === "email-month-ledger"
      ? { period: new Date(Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth() - 1, 1)).toISOString().slice(0, 7) }
      : { date: nowVn.toISOString().slice(0, 10) };
    const id = await startPipelineRun(member.workspaceId, key, data, `manual:${Date.now()}`, true);
    return id ? { ok: true, data: true } : fail(tr("pipeNotQueued"));
  } catch (e) {
    console.error("runPipelineNow failed", e instanceof Error ? e.message : e);
    return fail(tr("err_generic"));
  }
};
