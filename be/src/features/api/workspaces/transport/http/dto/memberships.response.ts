/** One member of a workspace. */
export class MemberResponse {
    /** The Auth user. */
    userId!: string
    /** The workspace the membership belongs to. */
    workspaceId!: string
    /** `owner`, `manager` or `staff`. */
    role!: string
    /** The staff row this account is, when it is one. */
    staffId!: string | null
    /** The name Office and the decision history show. */
    displayName!: string
    /** `active` or `disabled`. */
    status!: string
}

/** One workspace as a member sees it. */
export class WorkspaceResponse {
    /** The workspace id. */
    id!: string
    /** The workspace name. */
    name!: string
    /** `active`, `pending_payment` or `cancelled`. */
    status!: string
    /** The Auth user who owns it. */
    ownerId!: string
    /** When it was created, ISO 8601. */
    createdAt!: string
    /** The business type chosen at onboarding. */
    businessType!: string | null
}

/** A workspace with the caller's membership in it. */
export class MembershipResponse {
    /** The workspace. */
    workspace!: WorkspaceResponse
    /** The caller's membership. */
    member!: MemberResponse
}
