"use server";

import { revalidatePath } from "next/cache";
import { processorFromSettings, type Processor } from "@/lib/engine-queue";
import { requireManager } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import type { Outcome } from "@/lib/types";

export type EngineStatus = { readonly online: boolean; readonly lastHeartbeat: string | null };

/** Choose who answers this module's customers. Owner or manager only; merges into the installation's settings (jsonb). */
export const setProcessor = async (installationId: string, processor: Processor): Promise<Outcome<{ processor: Processor }>> => {
  try {
    await requireManager();
    if (processor !== "nivo" && processor !== "openclaw") throw new Error("Invalid processor");
    const db = await supabaseServer();
    const { data, error } = await db.from("module_installations").select("settings").eq("id", installationId).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "Not found");
    const settings = { ...((data as { settings: Record<string, unknown> | null }).settings ?? {}), processor };
    const upd = await db.from("module_installations").update({ settings }).eq("id", installationId);
    if (upd.error) throw new Error(upd.error.message);
    revalidatePath("/", "layout");
    return { ok: true, data: { processor: processorFromSettings(settings) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

/** The engine's last heartbeat, through engine_status() (the workers table itself is not readable by clients). */
export const getEngineStatus = async (): Promise<Outcome<EngineStatus>> => {
  try {
    await requireManager();
    const db = await supabaseServer();
    const { data, error } = await db.rpc("engine_status");
    if (error) throw new Error(error.message);
    const row = ((data ?? []) as Array<{ last_heartbeat_at: string | null; online: boolean }>)[0];
    return { ok: true, data: { online: row?.online === true, lastHeartbeat: row?.last_heartbeat_at ?? null } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
