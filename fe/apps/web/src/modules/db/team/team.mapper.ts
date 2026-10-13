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

/** How an invitation reached the person: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteDelivery = "invited" | "existing" | "none"

/** One person in the workspace as the team page lists them. */
export interface MemberItem {
    readonly userId: string
    readonly workspaceId: string
    readonly role: SeatRole
    readonly staffId: string | null
    readonly displayName: string
    readonly status: SeatStatus
    /** Blank when the viewer may not see it. */
    readonly email: string
    /** ISO 8601; null when the person never signed in. */
    readonly lastSignInAt: string | null
}

/** One invitation that can still be accepted. */
export interface InviteItem {
    readonly id: string
    readonly email: string
    readonly role: "manager" | "staff"
    readonly staffId: string | null
    /** ISO 8601. */
    readonly createdAt: string
    /** ISO 8601. */
    readonly expiresAt: string
}

/** What issuing, resending or copying an invitation link answers. */
export interface InviteResultItem {
    readonly email: string
    /** The link to accept; the raw token appears only here. */
    readonly link: string
    readonly delivery: InviteDelivery
}

/** An open invitation with whether it has run out. */
export interface RosterInvite extends InviteItem {
    readonly isExpired: boolean
}

/** The roster the team page draws: everyone in the workspace and the invitations still open. */
export interface TeamRoster {
    readonly members: ReadonlyArray<MemberItem>
    readonly invites: ReadonlyArray<RosterInvite>
}

/** One row of `workspace_members` the roster reads. */
export interface MemberRowShape {
    readonly user_id: string
    readonly workspace_id: string
    readonly role: string
    readonly staff_id: string | null
    readonly display_name: string
    readonly status: string
}

/** One row of `workspace_member_contacts`. */
export interface ContactRowShape {
    readonly user_id: string
    readonly email: string
    readonly last_sign_in_at: string | null
}

/** One row of `workspace_invites` the roster reads. */
export interface InviteRowShape {
    readonly id: string
    readonly email: string
    readonly role: string
    readonly staff_id: string | null
    readonly created_at: string
    readonly expires_at: string
}

const ROLE_ORDER: Readonly<Record<string, number>> = { owner: 0, manager: 1, staff: 2 }

const seatRole = (role: string): SeatRole => (role === "owner" || role === "manager" ? role : "staff")

/** Joins the member rows with the contacts the viewer may see, owners first. */
export const memberItemsOf = (
    rows: ReadonlyArray<MemberRowShape>,
    contacts: ReadonlyArray<ContactRowShape>,
): ReadonlyArray<MemberItem> => {
    const contactOf = new Map(contacts.map((contact) => [contact.user_id, contact]))
    return [...rows]
        .sort((left, right) => (ROLE_ORDER[left.role] ?? 2) - (ROLE_ORDER[right.role] ?? 2))
        .map((row): MemberItem => ({
            userId: row.user_id,
            workspaceId: row.workspace_id,
            role: seatRole(row.role),
            staffId: row.staff_id,
            displayName: row.display_name,
            status: row.status === "active" ? "active" : "disabled",
            email: contactOf.get(row.user_id)?.email ?? "",
            lastSignInAt: contactOf.get(row.user_id)?.last_sign_in_at ?? null,
        }))
}

/** Marks each open invitation with whether it has run out at `now` (a number of milliseconds). */
export const rosterInvitesOf = (rows: ReadonlyArray<InviteRowShape>, now: number): ReadonlyArray<RosterInvite> =>
    rows.map((row): RosterInvite => ({
        id: row.id,
        email: row.email,
        role: row.role === "manager" ? "manager" : "staff",
        staffId: row.staff_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        isExpired: new Date(row.expires_at).getTime() < now,
    }))

/** What a person types to invite someone, already bounded. */
export interface InviteInput {
    readonly workspaceId: string
    readonly email: string
    readonly role: "manager" | "staff"
    readonly staffId: string | null
}

/** Bounds the invitation a person typed before it reaches a function. */
export const inviteInputSchema = {
    safeParse: (workspaceId: unknown, input: unknown): Parsed<InviteInput> => {
        if (!isId(workspaceId) || !isRecord(input) || typeof input.email !== "string") return { success: false }
        const email = input.email.trim()
        if (email === "" || email.length > 254) return { success: false }
        if (input.role !== "manager" && input.role !== "staff") return { success: false }
        if (input.staffId !== null && !isId(input.staffId)) return { success: false }
        return {
            success: true,
            data: { workspaceId, email, role: input.role, staffId: input.staffId },
        }
    },
}

/** Bounds a workspace and an invitation id. */
export const inviteRefSchema = {
    safeParse: (
        workspaceId: unknown,
        inviteId: unknown,
    ): Parsed<{ readonly workspaceId: string; readonly inviteId: string }> =>
        isId(workspaceId) && isId(inviteId) ? { success: true, data: { workspaceId, inviteId } } : { success: false },
}

/** Reads the result of an invitation command; null when it is not the shape the job writes. */
export const inviteResultOf = (value: Readonly<Record<string, unknown>>): InviteResultItem | null => {
    const { email, link, delivery } = value
    if (typeof email !== "string" || typeof link !== "string") return null
    if (delivery !== "invited" && delivery !== "existing" && delivery !== "none") return null
    return { email, link, delivery }
}
