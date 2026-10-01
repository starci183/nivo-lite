import Link from "next/link"
import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { automations as dict } from "@/i18n/dict/automations"
import { getT } from "@/i18n/server"
import { loadAutomations } from "@/lib/automation-queries"
import { getCurrentMember, isManagerRole } from "@/lib/members"
import { getSession } from "@/lib/session"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { AutomationsBoard } from "./AutomationsBoard"
import { CHIP_CLASS, HEAD_CLASS, LINK_CLASS, MUTED_LINK_CLASS, PAGE_CLASS } from "./classNames"

/** The Automations page ("Tự động hoá"): ready-made jobs the owner switches on. Owner and manager only; staff see a friendly 403. */
export const AutomationsPage = async ({ focus }: { readonly focus?: string }) => {
  const t = await getT(dict)
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) {
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        <Link href="/chat" className="text-sm underline">{t("forbiddenBack")}</Link>
      </PageContainer>
    )
  }
  const [session, data] = await Promise.all([getSession(), loadAutomations(supabaseAdmin(), me.workspaceId)])
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader
          level={1}
          title={<span className={HEAD_CLASS}>{t("title")}<span className={CHIP_CLASS}>{session.workspace.name}</span></span>}
          description={<>{t("leadBefore")}<Link href="/authority" className={LINK_CLASS}>{t("leadLink")}</Link>{t("leadAfter")}</>}
        />
        <AutomationsBoard initial={{ cards: data.cards, runs: data.runs, shop: data.shop }} layout="page" focus={focus} />
        <Link href="/developers" className={MUTED_LINK_CLASS}>{t("advanced")}</Link>
      </div>
    </PageContainer>
  )
}
