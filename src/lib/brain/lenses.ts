import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Audience } from "./shared"
import { audienceOf } from "../module-registry"
import { isModuleKey } from "../modules-shared"

/** One agent the owner can look through: its module, name and audience. */
export type AgentLens = { readonly module: string; readonly name: string; readonly audience: Audience }

/** The agents of a workspace as lenses on the brain: one per module, with the audience its module reads (customer or internal). */
export const agentLenses = async (db: SupabaseClient, ws: string): Promise<Array<AgentLens>> => {
  const { data } = await db.from("agents").select("module, name").eq("workspace_id", ws).eq("status", "active").order("created_at")
  return ((data ?? []) as Array<{ module: string; name: string }>)
    .filter((a, i, all) => isModuleKey(a.module) && all.findIndex((b) => b.module === a.module) === i)
    .map((a) => ({ module: a.module, name: a.name, audience: isModuleKey(a.module) ? audienceOf(a.module) : "internal" }))
}
