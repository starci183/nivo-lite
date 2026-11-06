import type { AuthorityProfile } from "@modules/domain/authority"
import type { AuthorityRuleRecord } from "@modules/domain/authority-rules"
import type { AuthoritySheet } from "@modules/domain/decisions"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import type { ListApproversRequest } from "../../application/list-approvers.contracts"
import type { ListMemberGrantsRequest } from "../../application/list-member-grants.contracts"
import type { ReadAuthorityRequest } from "../../application/read-authority.contracts"
import type { SaveMemberGrantsRequest } from "../../application/save-member-grants.contracts"
import type { SaveRuleRequest } from "../../application/save-rule.contracts"
import type { UpdateAuthorityRequest } from "../../application/update-authority.contracts"
import type { ApproverMemberType } from "./dto/approver-member.type"
import type { AuthorityProfileType } from "./dto/authority-profile.type"
import type { AuthorityRuleType } from "./dto/authority-rule.type"
import type { AuthoritySheetType } from "./dto/authority-sheet.type"
import type { MemberGrantType } from "./dto/member-grant.type"
import type { MemberGrantsInput } from "./dto/member-grants.input"
import type { SaveAuthorityRuleInput } from "./dto/save-authority-rule.input"
import type { SaveMemberGrantsInput } from "./dto/save-member-grants.input"
import type { UpdateAuthorityInput } from "./dto/update-authority.input"

/** Maps the workspace of the request to the authority query request. */
export const toReadAuthorityRequest = (workspaceId: string): ReadAuthorityRequest => ({ workspaceId })

/** Maps the authority changes of the GraphQL input, with the workspace, to the command request. */
export const toUpdateAuthorityRequest = (workspaceId: string, input: UpdateAuthorityInput): UpdateAuthorityRequest => ({
    workspaceId,
    ...input,
})

/** Maps the rule of the GraphQL input, with the workspace, to the command request. */
export const toSaveRuleRequest = (workspaceId: string, input: SaveAuthorityRuleInput): SaveRuleRequest => ({
    workspaceId,
    ...input,
})

/** Maps the workspace of the request to the approver directory query request. */
export const toListApproversRequest = (workspaceId: string): ListApproversRequest => ({ workspaceId })

/** Maps the action of the GraphQL input, with the workspace, to the member grants query request. */
export const toListMemberGrantsRequest = (workspaceId: string, input: MemberGrantsInput): ListMemberGrantsRequest => ({
    workspaceId,
    ...input,
})

/** Maps the limits of the GraphQL input, with the workspace, to the command request. */
export const toSaveMemberGrantsRequest = (
    workspaceId: string,
    input: SaveMemberGrantsInput,
): SaveMemberGrantsRequest => ({
    workspaceId,
    action: input.action,
    grants: input.grants.map((grant) => ({ memberId: grant.memberId, maxAmount: grant.maxAmount })),
})

/** Maps the people an approver group can name to the GraphQL type. */
export const toApproverMembersType = (members: ReadonlyArray<DirectoryMember>): Array<ApproverMemberType> =>
    members.map((member) => ({
        memberId: member.memberId,
        name: member.name,
        role: member.role,
        status: member.status,
        rooms: member.rooms,
    }))

/** Maps the approval limits of one action to the GraphQL type. */
export const toMemberGrantsType = (grants: ReadonlyArray<MemberGrant>): Array<MemberGrantType> =>
    grants.map((grant) => ({
        memberId: grant.member_id,
        action: grant.action,
        unit: grant.unit,
        maxAmount: grant.max_amount,
    }))

/** Maps the goals and house rules to the GraphQL type. */
export const toAuthorityProfileType = (profile: AuthorityProfile): AuthorityProfileType => ({ ...profile })

/** Maps one stored rule to the GraphQL type. */
export const toAuthorityRuleType = (rule: AuthorityRuleRecord): AuthorityRuleType => ({ ...rule })

/** Maps the authority sheet to the GraphQL type. */
export const toAuthoritySheetType = (sheet: AuthoritySheet): AuthoritySheetType => ({ ...sheet })
