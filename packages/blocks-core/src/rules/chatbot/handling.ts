/** A member of the workspace, as far as handling a conversation cares. */
export interface HandlingMember {
    /** The name the member is shown under; it is also what a held conversation stores as its holder. */
    readonly displayName: string
    /** Whether the member is an owner or a manager. */
    readonly isManager: boolean
}

/** Whether a person holds the conversation: any holder at all (the engine never writes one). */
export const isHeldByPerson = (holder: string | null): boolean => holder !== null

/** Whether the member may act on the conversation: managers may reassign a held one, staff act only when it is free or theirs. */
export const mayHandle = (member: HandlingMember, holder: string | null): boolean =>
    !isHeldByPerson(holder) || holder === member.displayName || member.isManager

/** What taking over or releasing does to the conversation. */
export type HandlingChange = { readonly kind: "none" } | { readonly kind: "set"; readonly handledBy: string | null }

/** The change a take-over or a release makes: nothing when the conversation is already held that way. */
export const handlingChangeOf = (holder: string | null, takeOver: boolean, member: HandlingMember): HandlingChange => {
    const handledBy = takeOver ? member.displayName : null
    return handledBy === holder ? { kind: "none" } : { kind: "set", handledBy }
}

/** A line template with `{name}` filled in with the member's name. */
export const noticeOf = (template: string, name: string): string => template.replaceAll("{name}", name)
