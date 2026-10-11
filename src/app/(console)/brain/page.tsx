import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { BrainView } from "@/features/brain"
import type { Lens } from "@/features/brain/shared"
import { getT } from "@/i18n/server"
import { brain as dict } from "@/i18n/dict/brain"
import { listFacts, maintain } from "@/lib/brain/facts"
import { listLessons } from "@/lib/brain/lessons"
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
    const [facts, lessons, agents] = await Promise.all([
      listFacts(db, ws, { status: ["active", "proposed", "scheduled"], limit: 2000 }),
      listLessons(db, ws, ["active", "proposed", "retired"]),
      db.from("agents").select("module, name").eq("workspace_id", ws).eq("status", "active").order("created_at"),
    ])
    const lenses: Array<Lens> = ((agents.data ?? []) as Array<{ module: string; name: string }>)
      .filter((a, i, all) => isModuleKey(a.module) && all.findIndex((b) => b.module === a.module) === i)
      .map((a) => ({ module: a.module, name: a.name, audience: isModuleKey(a.module) ? audienceOf(a.module) : "internal" }))
    // Staff read the brain through their own reach: restricted facts stay with owners and managers.
    const visible = canWrite ? facts : facts.filter((f) => f.scope !== "restricted")
    return (
      <BrainView facts={visible} lessons={lessons} lenses={lenses} canWrite={canWrite} business={session.workspace.name} />
    )
  } catch (e) {
    console.error("brain page failed:", e instanceof Error ? e.message : e)
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} title={t("title")} description={t("mineUnavailable")} />
      </PageContainer>
    )
  }
}

export default Page
