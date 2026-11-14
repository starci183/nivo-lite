/** A member of the workspace, as far as handling a conversation cares. */
export interface HandlingMember {
    /** The member's seat id: what the engine's route hold names as its holder (ruling R43). */
    readonly memberId: string
    /** The name the member is shown under (the notice line). */
    readonly displayName: string
    /** Whether the member is an owner or a manager. */
    readonly isManager: boolean
}

/** Whether a person holds the conversation: the engine's route hold names a member (`holder` = that member id, null when none). */
export const isHeldByPerson = (holder: string | null): boolean => holder !== null

/** Whether the member may act on the conversation: managers may reassign a held one, staff act only when it is free or theirs. */
export const mayHandle = (member: HandlingMember, holder: string | null): boolean =>
    !isHeldByPerson(holder) || holder === member.memberId || member.isManager

/** What taking over or handing back asks of the engine's route hold: nothing, take it, or hand it back. */
export type HandlingChange = "none" | "take" | "hand-back"

/** The change a take-over or a hand-back makes: nothing when the route is already held that way. */
export const handlingChangeOf = (holder: string | null, takeOver: boolean, member: HandlingMember): HandlingChange => {
    if (takeOver) return holder === member.memberId ? "none" : "take"
    return holder === null ? "none" : "hand-back"
}

/** A line template with `{name}` filled in with the member's name. */
export const noticeOf = (template: string, name: string): string => template.replaceAll("{name}", name)
