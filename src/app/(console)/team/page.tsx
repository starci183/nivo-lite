import { PageContainer, SectionHeader } from "@starci/grammar/common"
import { TeamForbidden, TeamPage } from "@/features/team"
import { loadTeam } from "@/features/team/queries"
import { team as dict } from "@/i18n/dict/team"
import { getT } from "@/i18n/server"
import { getCurrentMember, isManagerRole } from "@/lib/members"

/** Team ("Đội ngũ"): members, roles and invitations. Owner and manager only; staff see a friendly 403. */
const Page = async () => {
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) return <TeamForbidden />
  try {
    return <TeamPage data={await loadTeam()} />
  } catch {
    const t = await getT(dict)
    return (
      <PageContainer measure="product">
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("loadFailTitle")} description={t("loadFailBody")} />
      </PageContainer>
    )
  }
}

export default Page
