import { PageContainer, SectionHeader, TextAction } from "@starci/grammar/common"
import { developers as dict } from "@/i18n/dict/developers"
import { getT } from "@/i18n/server"
import { listApiKeys } from "@/lib/api-keys-actions"
import { listConnections, publicSiteUrl } from "@/lib/channels"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { PAGE_CLASS } from "./classNames"
import { DevelopersView } from "./view"

/** The "Nâng cao" page body (owner | manager): outgoing webhooks, API keys, the quick guide. Staff see a friendly 403. */
export const DevelopersPage = async () => {
  const t = await getT(dict)
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) {
    return (
      <PageContainer measure="product">
        <div className={PAGE_CLASS}>
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
          <div><TextAction href="/chat" size="sm">{t("forbiddenBack")}</TextAction></div>
        </div>
      </PageContainer>
    )
  }
  const [hooks, keys] = await Promise.all([listConnections(me.workspaceId, "webhook"), listApiKeys()])
  return <DevelopersView hooks={hooks} keys={keys.ok ? keys.data : []} keysError={keys.ok ? null : keys.error} canManage={me.role === "owner"} base={`${publicSiteUrl() ?? "https://nivo.vn"}/api/v1`} />
}
