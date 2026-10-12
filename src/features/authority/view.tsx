"use client"

import { Breadcrumbs, PageContainer, SectionHeader, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { authority as dict } from "@/i18n/dict/authority"
import { governance } from "@/i18n/dict/governance"
import type { Authority, AuthorityRule, Staff } from "@/lib/flow-types"
import { Banner } from "./Banner"
import { HEAD_CLASS, PAGE_CLASS } from "./classNames"
import { GoalsSection, PoliciesSection } from "./GoalsPolicies"
import { RulesSections } from "./RulesSections"
import { StaffSection } from "./StaffSection"

/** Props for {@link AuthorityView}. */
export type AuthorityViewProps = {
  /** The stored authority; null while it loads. */
  readonly authority: Authority | null
  readonly rules: ReadonlyArray<AuthorityRule>
  readonly staff: ReadonlyArray<Staff>
  readonly canEdit: boolean
  /** Staff rows that already have an account (the invite link is only for the others). */
  readonly linkedStaffIds: ReadonlyArray<string>
  /** STATE-8: the same page while its data loads - labels stay, values and the staff rows are skeletons. */
  readonly isLoading?: boolean
  /** Departments with several agent instances: their names (the rules are shared by every instance of a type). */
  readonly instanceNames?: Readonly<Record<string, ReadonlyArray<string>>>
}

/** The "Giao quyền" page: motto, four authority sections in the order of the operating flow, then optional staff. */
export const AuthorityView = ({ authority, rules, staff, canEdit, linkedStaffIds, isLoading = false, instanceNames }: AuthorityViewProps) => {
  const t = useT(dict)
  const g = useT(governance)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "authority", label: t("title") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
        <Text weight="medium">{g("motto")}</Text>
        {canEdit ? null : <Banner title={t("readOnlyTitle")} description={t("readOnlyBody")} tone="cautionary" />}
        {/* Staff see the authority but cannot change it (the server refuses too); inert keeps the controls from taking focus. */}
        <div inert={!canEdit || isLoading} className={PAGE_CLASS} data-testid="authority-sections" data-readonly={canEdit ? undefined : "true"}>
          <GoalsSection authority={authority} isLoading={isLoading} />
          <PoliciesSection authority={authority} isLoading={isLoading} />
          <RulesSections authority={authority} rules={rules} isLoading={isLoading} instanceNames={instanceNames} />
          <StaffSection staff={staff} canInvite={canEdit} linkedStaffIds={linkedStaffIds} isLoading={isLoading} />
        </div>
      </div>
    </PageContainer>
  )
}
