import type { Outcome, TeamRoster } from "@/modules/api"

/** What a member may do in a workspace. */
export type TeamRole = "owner" | "manager" | "staff"

/** The catalog key (`team` namespace) that names each role. */
export const ROLE_KEYS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** The value of the staff choice that links no staff row. */
export const NO_STAFF = "none"

/** One person in the workspace, as the team blocks draw them (plain data: the server enforces every rule again). */
export interface TeamMemberView {
    readonly userId: string
    readonly displayName: string
    readonly email: string
    readonly role: TeamRole
    readonly isActive: boolean
    /** The linked staff row's name, when there is one. */
    readonly staffName: string | null
    /** ISO 8601; null when the person never signed in. */
    readonly lastSignInAt: string | null
}

/** One open invitation, as the team blocks draw it. */
export interface TeamInviteView {
    readonly id: string
    readonly email: string
    readonly role: "manager" | "staff"
    readonly staffName: string | null
    /** ISO 8601. */
    readonly expiresAt: string
    readonly isExpired: boolean
}

/** One staff row an invitation can link to. */
export interface StaffChoiceView {
    readonly id: string
    readonly name: string
    readonly role: string
}

/** What issuing, resending or copying an invitation link leaves on screen. */
export interface InviteSentView {
    readonly email: string
    readonly link: string
    readonly delivery: "invited" | "existing" | "none"
}

/** The catalog keys (`team` namespace) of the failure sentences. */
export type TeamErrorKey =
    | "errEmail"
    | "errAlreadyMember"
    | "errStaffTaken"
    | "errLastOwner"
    | "errSelf"
    | "errNotAllowed"
    | "errNotFound"
    | "errGeneric"

const ERROR_KEYS: Readonly<Record<string, TeamErrorKey>> = {
    WORKSPACE_INVITES_EMAIL_INVALID: "errEmail",
    WORKSPACE_INVITES_ALREADY_MEMBER: "errAlreadyMember",
    WORKSPACE_INVITES_STAFF_TAKEN: "errStaffTaken",
    WORKSPACE_INVITES_NOT_FOUND: "errNotFound",
    WORKSPACE_MEMBERS_ROLE_FORBIDDEN: "errNotAllowed",
    last_owner: "errLastOwner",
    errSelf: "errSelf",
    errNotAllowed: "errNotAllowed",
    member: "errNotFound",
    "not-changed": "errNotAllowed",
}

/** The sentence that explains a failure code of the back end api or of a member command. */
export const teamErrorKey = (code: string): TeamErrorKey => ERROR_KEYS[code] ?? "errGeneric"

/** The roles the person may give: an owner any, a manager only manager and staff. */
export const roleChoices = (selfRole: TeamRole): ReadonlyArray<TeamRole> =>
    selfRole === "owner" ? ["owner", "manager", "staff"] : ["manager", "staff"]

/** Whether the person may open the actions menu of a member: an owner row is for owners only. */
export const canManageMember = (selfRole: TeamRole, member: TeamMemberView): boolean =>
    member.role !== "owner" || selfRole === "owner"

/** The sentence that explains a failed call to the back end api. */
export const outcomeErrorKey = (outcome: Exclude<Outcome<unknown>, { readonly kind: "ok" }>): TeamErrorKey =>
    teamErrorKey(outcome.fault.code)

/** What the team page draws, built from the roster and the staff rows. */
export interface TeamViews {
    readonly members: ReadonlyArray<TeamMemberView>
    readonly invites: ReadonlyArray<TeamInviteView>
    /** Active staff rows nobody is linked to yet (candidates for "this person is"). */
    readonly staffChoices: ReadonlyArray<StaffChoiceView>
}

/** Joins the roster with the staff rows: linked staff names, and the staff nobody is linked to. */
export const teamViews = (roster: TeamRoster, staff: ReadonlyArray<StaffChoiceView>): TeamViews => {
    const nameOf = new Map(staff.map((row) => [row.id, row.name]))
    const live = roster.invites.filter((invite) => !invite.isExpired)
    const linked = new Set<string>(
        [...roster.members, ...live].flatMap((row) => (row.staffId === null ? [] : [row.staffId])),
    )
    return {
        members: roster.members.map(
            (member): TeamMemberView => ({
                userId: member.userId,
                displayName: member.displayName,
                email: member.email,
                role: member.role,
                isActive: member.status === "active",
                staffName: member.staffId === null ? null : (nameOf.get(member.staffId) ?? null),
                lastSignInAt: member.lastSignInAt,
            }),
        ),
        invites: roster.invites.map(
            (invite): TeamInviteView => ({
                id: invite.id,
                email: invite.email,
                role: invite.role,
                staffName: invite.staffId === null ? null : (nameOf.get(invite.staffId) ?? null),
                expiresAt: invite.expiresAt,
                isExpired: invite.isExpired,
            }),
        ),
        staffChoices: staff.filter((row) => !linked.has(row.id)),
    }
}

/** What a call to the back end api about an invitation answers. */
export type InviteCall<T> = Outcome<T>
