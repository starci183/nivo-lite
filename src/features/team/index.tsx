import Link from "next/link"
import { PageContainer, SectionHeader, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { team as dict } from "@/i18n/dict/team"
import { InviteForm } from "./InviteForm"
import { InvitesList } from "./InvitesList"
import { MembersList } from "./MembersList"
import { PAGE_CLASS } from "./classNames"
import type { TeamData } from "./queries"

/** The Team page body (owner | manager): members, pending invitations, invite form. */
export const TeamPage = async ({ data }: { readonly data: TeamData }) => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <MembersList members={data.members} staffNames={data.staffNames} selfId={data.selfId} selfRole={data.selfRole} />
        <InvitesList invites={data.invites} />
        <InviteForm staffChoices={data.staffChoices} />
      </div>
    </PageContainer>
  )
}

/** Friendly 403 for staff who open /team. */
export const TeamForbidden = async () => {
  const t = await getT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        <Text><Link href="/chat" className="underline">{t("forbiddenBack")}</Link></Text>
      </div>
    </PageContainer>
  )
}
