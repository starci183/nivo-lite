import { PageContainer, SectionHeader, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { isManagerRole, listMembers } from "@/lib/members"
import { getSession } from "@/lib/session"
import { authority as dict } from "@/i18n/dict/authority"
import { governance } from "@/i18n/dict/governance"
import type { Authority, AuthorityRule, Staff } from "@/lib/flow-types"
import { Banner } from "./Banner"
import { PAGE_CLASS } from "./classNames"
import { GoalsSection, PoliciesSection } from "./GoalsPolicies"
import { RulesSections } from "./RulesSections"
import { StaffSection } from "./StaffSection"

/** Props for {@link AuthorityPage}. */
export type AuthorityPageProps = {
  readonly authority: Authority
  readonly rules: ReadonlyArray<AuthorityRule>
  readonly staff: ReadonlyArray<Staff>
}

/** The "Giao quyền" page: motto, four authority sections in the order of the operating flow, then optional staff. */
export const AuthorityPage = async ({ authority, rules, staff }: AuthorityPageProps) => {
  const t = await getT(dict)
  const g = await getT(governance)
  const { member } = await getSession()
  const canEdit = isManagerRole(member.role)
  // Staff rows that already have an account (the invite link is only for the others).
  const linkedStaffIds = canEdit ? (await listMembers().catch(() => [])).map((m) => m.staffId).filter((id): id is string => id !== null) : []
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <Text weight="medium">{g("motto")}</Text>
        {canEdit ? null : <Banner title={t("readOnlyTitle")} description={t("readOnlyBody")} tone="cautionary" />}
        {/* Staff see the authority but cannot change it (the server refuses too); inert keeps the controls from taking focus. */}
        <div inert={!canEdit} className={PAGE_CLASS} data-testid="authority-sections" data-readonly={canEdit ? undefined : "true"}>
          <GoalsSection authority={authority} />
          <PoliciesSection authority={authority} />
          <RulesSections authority={authority} rules={rules} />
          <StaffSection staff={staff} canInvite={canEdit} linkedStaffIds={linkedStaffIds} />
        </div>
      </div>
    </PageContainer>
  )
}
