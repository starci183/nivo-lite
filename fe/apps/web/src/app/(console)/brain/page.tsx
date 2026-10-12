import { unstable_rethrow } from "next/navigation"
import { after } from "next/server"
import { BrainView } from "@/features/brain"
import { getT } from "@/i18n/server"
import { brain as dict } from "@/i18n/dict/brain"
import { drainBrainWork, extractionsOf } from "@/lib/brain/doc-facts"
import { listFacts, maintain } from "@/lib/brain/facts"
import { countOpenGaps, listGaps } from "@/lib/brain/gaps"
import { agentLenses } from "@/lib/brain/lenses"
import { listLessons } from "@/lib/brain/lessons"
import { listSources } from "@/lib/knowledge/index"
import { reembedStale } from "@/lib/knowledge/reembed"
import { isManagerRole } from "@/lib/members-shared"
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
    const [facts, lessons, lenses, sources, extractions, gaps, gapsOpen] = await Promise.all([
      listFacts(db, ws, { status: ["active", "proposed", "scheduled"], limit: 2000 }),
      listLessons(db, ws, ["active", "proposed", "retired"]),
      agentLenses(db, ws),
      listSources(),
      extractionsOf(ws),
      // Questions customers asked that the brain could not answer: owners and managers only.
      canWrite ? listGaps(db, ws) : Promise.resolve([]),
      canWrite ? countOpenGaps(db, ws) : Promise.resolve(0),
    ])
    // Waiting background work (re-embedding after a model change, facts of documents still queued) runs AFTER the response, bounded; the page never waits for it.
    if (canWrite) after(async () => { await reembedStale(db, ws); await drainBrainWork(ws) })
    const documents = sources.map((s) => ({ id: s.id, title: s.title, topic: s.topic, status: s.status, chunkCount: s.chunkCount, progress: s.progress }))
    // Staff read the brain through their own reach: restricted facts stay with owners and managers.
    const visible = canWrite ? facts : facts.filter((f) => f.scope !== "restricted")
    return (
      <BrainView facts={visible} documents={documents} lessons={lessons} lenses={lenses} extractions={extractions} gaps={gaps} gapsOpen={gapsOpen} canWrite={canWrite} workspaceId={ws} business={session.workspace.name} />
    )
  } catch (e) {
    unstable_rethrow(e) // Next signals (redirect, notFound, dynamic usage) pass through unlogged
    console.error("brain page failed:", e instanceof Error ? e.message : e)
    // STATE-8 case-4: let the route's error view keep the trail and heading with one Alert and a retry.
    throw new Error(t("loadFailed"))
  }
}

export default Page
