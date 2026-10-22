import type { Coverage, DirectoryMember, GrantNeed, MemberGrant } from "./member-grants.contracts"

/**
 * Whether a member may approve a request. A disabled member never may. The workspace owner always may, whatever the amount. Anyone
 * else needs a grant for the action counted in the unit of the request, and the amount must not pass its limit (a grant with no
 * limit covers any amount; a request with no amount is covered by any grant).
 */
export const grantCoverageOf = (
    member: DirectoryMember,
    grants: ReadonlyArray<MemberGrant>,
    need: GrantNeed,
): Coverage => {
    if (member.status !== "active") return { covered: false, reason: "inactive" }
    if (member.role === "owner") return { covered: true }
    const grant = grants.find((one) => one.member_id === member.memberId && one.unit === need.unit)
    if (grant === undefined) return { covered: false, reason: "no_grant" }
    if (grant.max_amount !== null && need.amount !== null && need.amount > grant.max_amount) {
        return { covered: false, reason: "over_limit" }
    }
    return { covered: true }
}
