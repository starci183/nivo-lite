import type { ApproverDirectoryEntry } from "@modules/domain/agent-pages"
import type { ListApproversRequest } from "../../application/list-approvers.contracts"
import type { ApproverMemberType } from "./dto/approver-member.type"

/** Maps the selected workspace to the approver directory request. */
export const toListApproversRequest = (workspaceId: string): ListApproversRequest => ({ workspaceId })

/** Maps the people an approver group can name to the GraphQL type. */
export const toApproverMembersType = (members: ReadonlyArray<ApproverDirectoryEntry>): Array<ApproverMemberType> =>
    members.map((member) => ({
        memberId: member.memberId,
        name: member.name,
        role: member.role,
        status: member.status,
        rooms: member.rooms,
    }))
