import Link from "next/link"
import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { connections as dict } from "@/i18n/dict/connections"
import { getT } from "@/i18n/server"
import { listConnections, publicSiteUrl } from "@/lib/channels"
import { PROVIDER_ORDER } from "@/lib/connection-providers"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { getSession } from "@/lib/session"
import { supabaseServer } from "@/lib/supabase/server"
import { PAGE_CLASS } from "./classNames"
import { PipelinesSection, type EmailLogRow, type PipelineRow } from "./PipelinesSection"
import { ProviderSection } from "./ProviderSection"

/** The Connections page body (owner | manager): every provider with its connections and the add form. Staff see a friendly 403. */
export const ConnectionsPage = async ({ searchParams }: { readonly searchParams?: Promise<Record<string, string | string[] | undefined>> } = {}) => {
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
  const [all, agentRows, pipeRows, mailRows] = await Promise.all([
    listConnections(me.workspaceId),
    db.from("agents").select("id, name, module, status").eq("workspace_id", me.workspaceId),
    db.from("n8n_pipelines").select("template_key, enabled, config").eq("workspace_id", me.workspaceId),
    db.from("email_messages").select("id, to_address, subject, purpose, status, error, created_at").eq("workspace_id", me.workspaceId).order("created_at", { ascending: false }).limit(8),
  ])
  const pipelines: Array<PipelineRow> = ((pipeRows.data ?? []) as Array<{ template_key: string; enabled: boolean; config: Record<string, string | number> }>).map((r) => ({ key: r.template_key, enabled: r.enabled, config: r.config }))
  const mailLog: Array<EmailLogRow> = ((mailRows.data ?? []) as Array<{ id: string; to_address: string; subject: string; purpose: string; status: string; error: string | null; created_at: string }>).map((r) => ({ id: r.id, to: r.to_address, subject: r.subject, purpose: r.purpose, status: r.status, error: r.error, at: r.created_at }))
  const agents = ((agentRows.data ?? []) as Array<{ id: string; name: string; module: string; status: string }>).filter((a) => a.status === "active")
  const agentNames = Object.fromEntries(((agentRows.data ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]))
  const localOnly = publicSiteUrl() === null
  const sp = (await searchParams) ?? {}
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)
  const zaloId = one("id") && all.some((c) => c.id === one("id") && c.provider === "zalo_oa") ? one("id") : undefined
  const ownerEmail = (await getSession()).email
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        {PROVIDER_ORDER.map((p) => (
          <ProviderSection key={p} provider={p} items={all.filter((c) => c.provider === p)} agentNames={agentNames} agents={agents} localOnly={localOnly} resumeId={p === "zalo_oa" ? zaloId : undefined} returned={p === "zalo_oa" ? one("zalo") : undefined} ownerEmail={ownerEmail} />
        ))}
        <PipelinesSection rows={pipelines} log={mailLog} />
      </div>
    </PageContainer>
  )
}
