import { Button, PageContainer, SectionHeader } from "@starci/grammar/common"
import { automations as dict } from "@/i18n/dict/automations"
import { getT } from "@/i18n/server"
import { loadAutomations } from "@/lib/automation-queries"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { getSession } from "@/lib/session"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { PAGE_CLASS, LINK_ROW_CLASS } from "./classNames"
import { AutomationsView } from "./view"

/** The Automations page ("Tự động hoá"): ready-made jobs the owner switches on. Owner and manager only; staff see a friendly 403. */
export const AutomationsPage = async ({ focus }: { readonly focus?: string }) => {
  const t = await getT(dict)
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) {
    return (
      <PageContainer measure="product">
        <div className={PAGE_CLASS}>
          <SectionHeader level={1} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
          <div className={LINK_ROW_CLASS}><Button variant="secondary" href="/chat">{t("forbiddenBack")}</Button></div>
        </div>
      </PageContainer>
    )
  }
  const [session, data] = await Promise.all([getSession(), loadAutomations(supabaseAdmin(), me.workspaceId)])
  return <AutomationsView workspaceName={session.workspace.name} data={{ cards: data.cards, runs: data.runs, shop: data.shop }} focus={focus} />
}
