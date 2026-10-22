import type { GrantDraft, PermissionDraft } from "./permissions.model"

/** A person an approver group can name, as the drawer lists them. */
export interface Approver {
    readonly id: string
    readonly name: string
    readonly role: string
    readonly rooms: ReadonlyArray<string>
    readonly isActive: boolean
}

/** The approval limit stored for a member; a null amount is no limit. */
export interface StoredGrant {
    readonly memberId: string
    readonly maxAmount: number | null
}

/** One member the drawer lists with their limit: stored, or as typed over the stored one. */
export interface GrantCandidate extends GrantDraft {
    readonly name: string
}

/** What decides who is listed and with which limits. */
export interface GrantCandidatesInput {
    readonly members: ReadonlyArray<Approver>
    readonly draft: PermissionDraft
    readonly stored: ReadonlyArray<StoredGrant>
    readonly edits: Readonly<Record<string, GrantDraft>>
}

/** True when the rule's group names the member: by role, by room or by name, or they hold a limit already. */
const isNamed = (one: Approver, draft: PermissionDraft, stored: ReadonlyArray<StoredGrant>): boolean => {
    const byRole = Array.from<string>(draft.roles).includes(one.role)
    const byRoom = one.rooms.some((room) => draft.rooms.includes(room))
    return byRole || byRoom || draft.members.includes(one.id) || stored.some((grant) => grant.memberId === one.id)
}

/** The members the owner can give an approval limit to for this rule: the active, non-owner ones the group names. */
export const grantCandidates = (input: GrantCandidatesInput): ReadonlyArray<GrantCandidate> =>
    input.members
        .filter((one) => one.isActive && one.role !== "owner" && isNamed(one, input.draft, input.stored))
        .map((one) => {
            const kept = input.stored.find((grant) => grant.memberId === one.id)
            const typed = input.edits[one.id]
            const base: GrantDraft = {
                memberId: one.id,
                enabled: kept !== undefined,
                max: kept?.maxAmount ?? Number.NaN,
            }
            return { name: one.name, ...(typed ?? base) }
        })
