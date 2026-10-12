import { PageContainer, SectionHeader, TextAction } from "@starci/grammar/common"
import { connections as dict } from "@/i18n/dict/connections"
import { getT } from "@/i18n/server"
import { listConnections, publicSiteUrl } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"
import { PAGE_CLASS } from "./classNames"
import { ConnectionsView } from "./ConnectionsView"

/** The Connections page body (owner | manager): the grouped connections board. Staff see a friendly 403. */
export const ConnectionsPage = async ({ searchParams }: { readonly searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) => {
  const t = await getT(dict)
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) {
    return (
      <PageContainer measure="product">
        <div className={PAGE_CLASS}>
          <SectionHeader level={1} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
          <TextAction href="/chat">{t("forbiddenBack")}</TextAction>
        </div>
      </PageContainer>
    )
  }
  const db = await supabaseServer()
  const [all, agentRows] = await Promise.all([
    listConnections(me.workspaceId),
    db.from("agents").select("id, name, module, status").eq("workspace_id", me.workspaceId),
  ])
  const agents = ((agentRows.data ?? []) as Array<{ id: string; name: string; module: string; status: string }>).filter((a) => a.status === "active")
  const agentNames = Object.fromEntries(((agentRows.data ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]))
  const localOnly = publicSiteUrl() === null
  const sp = (await searchParams) ?? {}
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)
  const zaloId = one("id") && all.some((c) => c.id === one("id") && c.provider === "zalo_oa") ? one("id") : undefined
  const metaId = one("id") && all.some((c) => c.id === one("id") && c.provider === "meta") ? one("id") : undefined
  const ownerEmail = (await getSession()).email
  return (
    <ConnectionsView
      items={all} agentNames={agentNames} agents={agents} localOnly={localOnly} ownerEmail={ownerEmail} canManage={me.role === "owner"}
      {...(zaloId ? { zaloResumeId: zaloId } : {})} {...(one("zalo") ? { zaloReturned: one("zalo") } : {})}
      {...(metaId ? { metaResumeId: metaId } : {})} {...(one("meta") ? { metaReturned: one("meta") } : {})}
    />
  )
}
