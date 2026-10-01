import Link from "next/link"
import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { connections as dict } from "@/i18n/dict/connections"
import { getT } from "@/i18n/server"
import { listConnections, publicSiteUrl } from "@/lib/channels"
import { PROVIDER_ORDER } from "@/lib/connection-providers"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { supabaseServer } from "@/lib/supabase/server"
import { PAGE_CLASS } from "./classNames"
import { ProviderSection } from "./ProviderSection"

/** The Connections page body (owner | manager): every provider with its connections and the add form. Staff see a friendly 403. */
export const ConnectionsPage = async () => {
  const t = await getT(dict)
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) {
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        <Link href="/chat" className="text-sm underline">{t("forbiddenBack")}</Link>
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
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        {PROVIDER_ORDER.map((p) => (
          <ProviderSection key={p} provider={p} items={all.filter((c) => c.provider === p)} agentNames={agentNames} agents={agents} localOnly={localOnly} />
        ))}
      </div>
    </PageContainer>
  )
}
