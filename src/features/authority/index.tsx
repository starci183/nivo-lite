import { PageContainer, SectionHeader, Text } from "@starci/grammar/common"
import { getT } from "@/i18n/server"
import { authority as dict } from "@/i18n/dict/authority"
import { governance } from "@/i18n/dict/governance"
import type { Authority, AuthorityRule, Staff } from "@/lib/flow-types"
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
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <Text weight="medium">{g("motto")}</Text>
        <GoalsSection authority={authority} />
        <PoliciesSection authority={authority} />
        <RulesSections authority={authority} rules={rules} />
        <StaffSection staff={staff} />
      </div>
    </PageContainer>
  )
}
