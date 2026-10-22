import { grantCoverageOf } from "@modules/domain/member-grants"
import type { DirectoryMember, ApproverRef } from "@modules/domain/member-grants"
import type { ApprovalExclusion, ApproverInput, ApproverSet } from "./approval-requests.contracts"

const refOf = (member: DirectoryMember): ApproverRef => ({
    memberId: member.memberId,
    name: member.name,
    role: member.role,
    roomId: member.roomId,
})

/** True when the member belongs to the group: their role is named, they sit in a room it names, or they are named themselves. */
const inGroup = (member: DirectoryMember, input: ApproverInput): boolean =>
    input.group.roles.includes(member.role) ||
    member.rooms.some((room) => input.group.rooms.includes(room)) ||
    input.group.members.includes(member.memberId)

/**
 * The people of the directory in the order a sequential policy asks them: the members the rule names one by one first, in the order
 * it lists them, then everyone else in directory order (owners, managers, staff).
 */
const askingOrder = (input: ApproverInput): ReadonlyArray<DirectoryMember> => {
    const named = input.group.members.flatMap((id) => input.directory.filter((member) => member.memberId === id))
    const others = input.directory.filter((member) => !input.group.members.includes(member.memberId))
    return [...named, ...others]
}

/**
 * Who may approve a request: the members of the rule's group whose grants cover the amount. A member of the group the grants do not
 * cover (disabled, no grant for the action, an amount over their limit) is not tagged; they are listed as excluded with the reason,
 * so the card can say why. Someone outside the group is neither: they were never asked.
 */
export const resolveApprovers = (input: ApproverInput): ApproverSet => {
    const approvers: Array<ApproverRef> = []
    const excluded: Array<ApprovalExclusion> = []
    for (const member of askingOrder(input).filter((one) => inGroup(one, input))) {
        const coverage = grantCoverageOf(member, input.grants, input.need)
        if (coverage.covered) approvers.push(refOf(member))
        else excluded.push({ memberId: member.memberId, reason: coverage.reason })
    }
    return { approvers, excluded }
}
