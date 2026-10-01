import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleKey } from "../modules-shared";
import { buildAgentContext } from "./index";
import type { Audience } from "./shared";

/**
 * The knowledge block to append to an agent's prompt brief (leading blank line included), or "" when there is none.
 * Uses the engine's own db client (so it works from webhooks) and never throws: an agent without knowledge still answers safely.
 * `customer` = a reply the customer will read (public knowledge only); `internal` = Office and owner-facing work.
 */
export const knowledgeBrief = async (c: { db: unknown; ws: string }, module: ModuleKey, query: string, audience: Audience): Promise<string> => {
  try {
    const { system } = await buildAgentContext({ workspaceId: c.ws, module, query, audience, db: c.db as SupabaseClient });
    return system ? `\n\n${system}` : "";
  } catch (e) {
    console.error("knowledgeBrief failed:", e instanceof Error ? e.message : String(e));
    return "";
  }
};
