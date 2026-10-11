import { after } from "next/server"
import { BrainView } from "@/features/brain"
import type { Lens } from "@/features/brain/shared"
import { getT } from "@/i18n/server"
import { brain as dict } from "@/i18n/dict/brain"
import { drainBrainWork, extractionsOf } from "@/lib/brain/doc-facts"
import { listFacts, maintain } from "@/lib/brain/facts"
import { listLessons } from "@/lib/brain/lessons"
import { listSources } from "@/lib/knowledge/index"
import { reembedStale } from "@/lib/knowledge/reembed"
import { isManagerRole } from "@/lib/members-shared"
import { audienceOf } from "@/lib/module-registry"
import { isModuleKey } from "@/lib/modules-shared"
import { getSession } from "@/lib/session"
import { supabaseAdmin } from "@/lib/supabase/admin"

/** Always fresh: proposals arrive from agents and connectors at any time. */
export const dynamic = "force-dynamic"

/** Bộ não: the business's shared memory and each agent's view of it. Everyone reads; owners and managers decide. */
const Page = async () => {
  const t = await getT(dict)
  try {
    const session = await getSession()
    const ws = session.workspace.id
    const canWrite = isManagerRole(session.member.role)
    const db = supabaseAdmin()
    await maintain(db, ws)
    const [facts, lessons, agents, sources, extractions] = await Promise.all([
      listFacts(db, ws, { status: ["active", "proposed", "scheduled"], limit: 2000 }),
      listLessons(db, ws, ["active", "proposed", "retired"]),
      db.from("agents").select("module, name").eq("workspace_id", ws).eq("status", "active").order("created_at"),
      listSources(),
      extractionsOf(ws),
    ])
    // Waiting background work (re-embedding after a model change, facts of documents still queued) runs AFTER the response, bounded; the page never waits for it.
    if (canWrite) after(async () => { await reembedStale(db, ws); await drainBrainWork(ws) })
    const documents = sources.map((s) => ({ id: s.id, title: s.title, topic: s.topic, status: s.status, chunkCount: s.chunkCount }))
    const lenses: Array<Lens> = ((agents.data ?? []) as Array<{ module: string; name: string }>)
      .filter((a, i, all) => isModuleKey(a.module) && all.findIndex((b) => b.module === a.module) === i)
      .map((a) => ({ module: a.module, name: a.name, audience: isModuleKey(a.module) ? audienceOf(a.module) : "internal" }))
    // Staff read the brain through their own reach: restricted facts stay with owners and managers.
    const visible = canWrite ? facts : facts.filter((f) => f.scope !== "restricted")
    return (
      <BrainView facts={visible} documents={documents} lessons={lessons} lenses={lenses} extractions={extractions} canWrite={canWrite} business={session.workspace.name} />
    )
  } catch (e) {
    console.error("brain page failed:", e instanceof Error ? e.message : e)
    // STATE-8 case-4: let the route's error view keep the trail and heading with one Alert and a retry.
    throw new Error(t("loadFailed"))
  }
}

export default Page
