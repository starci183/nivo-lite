/** A member of a workspace as the capabilities that name owners see them. */
export interface NamedMember {
    /** The membership id. */
    readonly id: string
    /** The name the member shows. */
    readonly displayName: string
}

/** An owner or manager of a workspace: the person (user) behind the seat and the name shown. */
export interface OwnerMemberRef {
    /** The user id. */
    readonly userId: string
    /** The name the member shows. */
    readonly displayName: string
}

/** A named member, or null when the lookup finds none. */
export type OptionalNamedMember = NamedMember | null
