"use server";

import { entryById } from "./connector-catalog";
import { requireManager } from "./permissions";
import { supabaseAdmin } from "./supabase/admin";
import type { Outcome } from "./types";

/** "Muốn dùng" on a planned connector (owner | manager): recorded once per workspace. */
export const wantConnector = async (connectorId: string): Promise<Outcome<true>> => {
  try {
    const me = await requireManager();
    const entry = entryById(connectorId);
    if (!entry || entry.status !== "soon") return { ok: false, error: "Không tìm thấy connector này." };
    const { error } = await supabaseAdmin().from("connector_interest").upsert(
      { workspace_id: me.workspaceId, connector_id: entry.id, user_id: me.userId },
      { onConflict: "workspace_id,connector_id", ignoreDuplicates: true },
    );
    return error ? { ok: false, error: error.message } : { ok: true, data: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};
