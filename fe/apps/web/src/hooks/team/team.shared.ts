import { mutate } from "swr"
import {
    QUERY_WORKSPACE_INVITES_SWR_KEY,
    QUERY_WORKSPACE_MEMBERS_SWR_KEY,
    QUERY_WORKSPACE_STAFF_SWR_KEY,
} from "@/hooks/swr"

/** One member as the back end lists them. */
interface MemberListing {
    readonly userId: string
    readonly displayName: string
    readonly email: string
    readonly role: string
    readonly status: string
    readonly staffId?: string | null
    readonly lastSignInAt?: string | null
}

/** One open invitation as the back end lists it. */
interface PendingInvite {
    readonly id: string
    readonly email: string
    readonly role: string
    readonly staffId?: string | null
    readonly expiresAt: string
}

/** One staff row as the back end lists it. */
interface StaffOption {
    readonly id: string
    readonly name: string
    readonly role: string
}

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

/** The roles the person may give: an owner any, a manager only manager and staff. */
export const roleChoices = (selfRole: TeamRole): ReadonlyArray<TeamRole> =>
    selfRole === "owner" ? ["owner", "manager", "staff"] : ["manager", "staff"]

/** Whether the person may open the actions menu of a member: an owner row is for owners only. */
export const canManageMember = (selfRole: TeamRole, member: TeamMemberView): boolean =>
    member.role !== "owner" || selfRole === "owner"

/** Whether the role runs the business (owner and manager see the team). */
export const isTeamManager = (role: TeamRole): boolean => role === "owner" || role === "manager"

const roleOf = (role: string): TeamRole => (role === "owner" || role === "manager" ? role : "staff")

const deliveryOf = (delivery: string): InviteSentView["delivery"] =>
    delivery === "invited" || delivery === "existing" ? delivery : "none"

/** The invitation result of the back end. */
interface InviteResultShape {
    readonly email: string
    readonly link: string
    readonly delivery: string
}

/** The invitation result of the back end as the blocks draw it. */
export const inviteSentOf = (result: InviteResultShape): InviteSentView => ({
    email: result.email,
    link: result.link,
    delivery: deliveryOf(result.delivery),
})

/** What the team page draws, built from the members, the open invitations and the staff rows. */
export interface TeamViews {
    readonly members: ReadonlyArray<TeamMemberView>
    readonly invites: ReadonlyArray<TeamInviteView>
    /** Active staff rows nobody is linked to yet (candidates for "this person is"). */
    readonly staffChoices: ReadonlyArray<StaffChoiceView>
}

/** Joins the members with the invitations and the staff rows: linked staff names, and the staff nobody is linked to. */
export const teamViews = (
    members: ReadonlyArray<MemberListing>,
    invites: ReadonlyArray<PendingInvite>,
    staff: ReadonlyArray<StaffOption>,
    now: number,
): TeamViews => {
    const nameOf = new Map(staff.map((row) => [row.id, row.name]))
    const inviteViews = invites.map((invite): TeamInviteView => ({
        id: invite.id,
        email: invite.email,
        role: invite.role === "manager" ? "manager" : "staff",
        staffName:
            invite.staffId === null || invite.staffId === undefined ? null : (nameOf.get(invite.staffId) ?? null),
        expiresAt: invite.expiresAt,
        isExpired: Date.parse(invite.expiresAt) <= now,
    }))
    const live = invites.filter((_invite, index) => !inviteViews[index]?.isExpired)
    const linked = new Set<string>(
        [...members, ...live].flatMap((row) =>
            row.staffId === null || row.staffId === undefined ? [] : [row.staffId],
        ),
    )
    return {
        members: members.map((member): TeamMemberView => ({
            userId: member.userId,
            displayName: member.displayName,
            email: member.email,
            role: roleOf(member.role),
            isActive: member.status === "active",
            staffName:
                member.staffId === null || member.staffId === undefined ? null : (nameOf.get(member.staffId) ?? null),
            lastSignInAt: member.lastSignInAt ?? null,
        })),
        invites: inviteViews,
        staffChoices: staff.filter((row) => !linked.has(row.id)),
    }
}

const TEAM_KEYS: ReadonlySet<string> = new Set([
    QUERY_WORKSPACE_MEMBERS_SWR_KEY,
    QUERY_WORKSPACE_INVITES_SWR_KEY,
    QUERY_WORKSPACE_STAFF_SWR_KEY,
])

/** Revalidates the members, the invitations and the staff rows after a change to the team. */
export const refreshTeam = async (): Promise<void> => {
    await mutate((key) => Array.isArray(key) && typeof key[0] === "string" && TEAM_KEYS.has(key[0]))
}
