const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** What a member may do in a workspace. */
export type SeatRole = "owner" | "manager" | "staff"

/** Whether a member can sign in to the workspace. */
export type SeatStatus = "active" | "disabled"

/** One command on a member, already bounded. */
export interface MemberCommand {
    readonly workspaceId: string
    readonly userId: string
}

/** A role change, already bounded. */
export interface RoleCommand extends MemberCommand {
    readonly role: SeatRole
}

/** An enable or disable, already bounded. */
export interface StatusCommand extends MemberCommand {
    readonly status: SeatStatus
}

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value)

const isRole = (value: unknown): value is SeatRole => value === "owner" || value === "manager" || value === "staff"

const memberOf = (input: unknown): MemberCommand | undefined =>
    isRecord(input) && isId(input.workspaceId) && isId(input.userId)
        ? { workspaceId: input.workspaceId, userId: input.userId }
        : undefined

/** Bounds a member command (remove) before it reaches a query. */
export const memberCommandSchema = {
    safeParse: (input: unknown): Parsed<MemberCommand> => {
        const member = memberOf(input)
        return member === undefined ? { success: false } : { success: true, data: member }
    },
}

/** Bounds a role change before it reaches a query. */
export const roleCommandSchema = {
    safeParse: (input: unknown): Parsed<RoleCommand> => {
        const member = memberOf(input)
        if (member === undefined || !isRecord(input) || !isRole(input.role)) return { success: false }
        return { success: true, data: { ...member, role: input.role } }
    },
}

/** Bounds an enable or disable before it reaches a query. */
export const statusCommandSchema = {
    safeParse: (input: unknown): Parsed<StatusCommand> => {
        const member = memberOf(input)
        if (member === undefined || !isRecord(input)) return { success: false }
        const status = input.status
        if (status !== "active" && status !== "disabled") return { success: false }
        return { success: true, data: { ...member, status } }
    },
}

/** The people involved in one command on a member. */
export interface GuardFacts {
    /** The person asking. */
    readonly actorId: string
    readonly actorRole: SeatRole
    /** The member being changed. */
    readonly targetId: string
    readonly targetRole: SeatRole
    /** The role the member would get, for a role change. */
    readonly nextRole?: SeatRole
    /** True for enable, disable and remove, which are never allowed on one's own account. */
    readonly forbidSelf: boolean
}

/** Why a command on a member is refused; the catalog key names the reason. */
export type GuardRefusal = "errNotAllowed" | "errSelf"

/** Whether an owner or manager may do the command: only owners and managers act, never on oneself for access, owners change owners, managers never grant owner. */
export const guardMemberCommand = (facts: GuardFacts): GuardRefusal | undefined => {
    if (facts.actorRole === "staff") return "errNotAllowed"
    if (facts.forbidSelf && facts.actorId === facts.targetId) return "errSelf"
    if (facts.targetRole === "owner" && facts.actorRole !== "owner") return "errNotAllowed"
    if (facts.nextRole === "owner" && facts.actorRole !== "owner") return "errNotAllowed"
    return undefined
}
