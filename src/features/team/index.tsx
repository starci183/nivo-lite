import { Link, PageContainer, SectionHeader, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { team as dict } from "@/i18n/dict/team"
import { PAGE_CLASS } from "./classNames"
import type { TeamData } from "./queries"
import { TeamView } from "./view"

/** The Team page body (owner | manager): members, pending invitations, invite form. */
export const TeamPage = ({ data }: { readonly data: TeamData }) => <TeamView data={data} />

/** Friendly 403 for staff who open /team. */
export const TeamForbidden = async () => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        <Text><Link href="/chat">{t("forbiddenBack")}</Link></Text>
      </div>
    </PageContainer>
  )
}
