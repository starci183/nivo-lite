import Link from "next/link"
import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { ProviderSection } from "@/features/connections/ProviderSection"
import { developers as dict } from "@/i18n/dict/developers"
import { getT } from "@/i18n/server"
import { listApiKeys } from "@/lib/api-keys-actions"
import { listConnections, publicSiteUrl } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { ApiKeysSection } from "./ApiKeysSection"
import { PAGE_CLASS, STACK_CLASS } from "./classNames"
import { QuickStart } from "./QuickStart"

/** The "Nâng cao" page body (owner | manager): outgoing webhooks, API keys, the quick guide. Staff see a friendly 403. */
export const DevelopersPage = async () => {
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
  const [hooks, keys] = await Promise.all([listConnections(me.workspaceId, "webhook"), listApiKeys()])
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <Link href="/automations" className="text-sm underline">{t("backToAutomations")}</Link>

        <div className={STACK_CLASS}>
          <SectionHeader level={2} title={t("eventsTitle")} description={t("eventsBody")} />
          <ProviderSection provider="webhook" items={hooks} agentNames={{}} agents={[]} localOnly={false} />
        </div>

        <ApiKeysSection items={keys.ok ? keys.data : []} loadError={keys.ok ? null : keys.error} />
        <QuickStart base={`${publicSiteUrl() ?? "https://nivo.vn"}/api/v1`} />
      </div>
    </PageContainer>
  )
}
