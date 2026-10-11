import { isManagerRole, listMembers } from "@/lib/members"
import { getSession } from "@/lib/session"
import type { Authority, AuthorityRule, Staff } from "@/lib/flow-types"
import { AuthorityView } from "./view"

/** Props for {@link AuthorityPage}. */
export type AuthorityPageProps = {
  readonly authority: Authority
  readonly rules: ReadonlyArray<AuthorityRule>
  readonly staff: ReadonlyArray<Staff>
}

/** The "Giao quyền" page: reads who may edit and who already has an account, then renders the view. */
export const AuthorityPage = async ({ authority, rules, staff }: AuthorityPageProps) => {
  const { member } = await getSession()
  const canEdit = isManagerRole(member.role)
  // Staff rows that already have an account (the invite link is only for the others).
  const linkedStaffIds = canEdit ? (await listMembers().catch(() => [])).map((m) => m.staffId).filter((id): id is string => id !== null) : []
  return <AuthorityView authority={authority} rules={rules} staff={staff} canEdit={canEdit} linkedStaffIds={linkedStaffIds} />
}
