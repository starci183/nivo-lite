"use server";

import { revalidatePath } from "next/cache";
import { sendCommand } from "./agent-commands";
import { drainAfter, engineCtx } from "./flow-ctx";
import { requireManager } from "./permissions";
import { isModuleKey } from "./module-registry";
import type { Outcome } from "./types";

/**
 * The two buttons of an Office command card. Only owners and managers may use them (RLS agrees). Confirming claims the candidate first
 * (pending -> sent in one UPDATE, so a double click sends once), then hands the command to the bus as the owner: the receiver's own gate,
 * limit and operating mode still decide what happens next. A refusal puts the card back to pending with the reason.
 */

export type ConfirmResult = { readonly workItemId: string; readonly module: string; readonly created: boolean };

type CandidateRow = { id: string; module: string; command: string; payload: Record<string, unknown>; status: string; work_item_id: string | null; message_id: string };

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

export const confirmOfficeCommand = async (candidateId: string): Promise<Outcome<ConfirmResult>> => {
  try {
    await requireManager();
    const c = await engineCtx();
    const claimed = ((await c.db.from("office_command_candidates").update({ status: "sent", decided_at: new Date().toISOString(), refusal_detail: null })
      .eq("id", candidateId).eq("workspace_id", c.ws).eq("status", "pending").select("id, module, command, payload, status, work_item_id, message_id")).data ?? [])[0] as CandidateRow | undefined;
    if (!claimed) {
      // Already handled (another click, another tab): report where it went instead of sending twice.
      const row = ((await c.db.from("office_command_candidates").select("id, module, command, payload, status, work_item_id, message_id").eq("id", candidateId).eq("workspace_id", c.ws).maybeSingle()).data ?? null) as CandidateRow | null;
      if (row?.status === "sent" && row.work_item_id) return { ok: true, data: { workItemId: row.work_item_id, module: row.module, created: false } };
      throw new Error(row?.status === "cancelled" ? "cancelled" : "not found");
    }
    const release = async (detail: string) => {
      await c.db.from("office_command_candidates").update({ status: "pending", decided_at: null, refusal_detail: detail }).eq("id", claimed.id);
    };
    if (!isModuleKey(claimed.module)) {
      await release(`no agent ${claimed.module}`);
      throw new Error(`no agent ${claimed.module}`);
    }
    // from "owner": the receiver's gate decides. The default dedupe key makes the same command about the same subject one piece of work.
    let result: Awaited<ReturnType<typeof sendCommand>>;
    try {
      result = await sendCommand(c, { from: "owner", to: claimed.module, command: claimed.command, payload: claimed.payload, reason: `office:${claimed.message_id}` });
    } catch (e) {
      await release(e instanceof Error ? e.message : "failed");
      throw e;
    }
    if (!result.ok) {
      await release(result.detail);
      throw new Error(result.detail);
    }
    await c.db.from("office_command_candidates").update({ work_item_id: result.item.id }).eq("id", claimed.id);
    drainAfter(c);
    revalidatePath("/chat");
    return { ok: true, data: { workItemId: result.item.id, module: claimed.module, created: result.created } };
  } catch (e) {
    return fail(e);
  }
};

export const cancelOfficeCommand = async (candidateId: string): Promise<Outcome<null>> => {
  try {
    await requireManager();
    const c = await engineCtx();
    const { error } = await c.db.from("office_command_candidates").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", candidateId).eq("workspace_id", c.ws).eq("status", "pending");
    if (error) throw new Error(error.message);
    revalidatePath("/chat");
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
};
