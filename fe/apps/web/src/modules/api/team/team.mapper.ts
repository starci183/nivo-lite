import { decodeList, decodeOne, isRecord, isTextOrNull } from "../decode"

/** What a member may do in a workspace. */
export type MemberRole = "owner" | "manager" | "staff"

/** Whether a member can sign in to the workspace. */
export type MemberStatus = "active" | "disabled"

/** How an invitation reached the person: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteDelivery = "invited" | "existing" | "none"

/** One person in the workspace as the team page lists them. */
export interface MemberItem {
    readonly userId: string
    readonly workspaceId: string
    readonly role: MemberRole
    readonly staffId: string | null
    readonly displayName: string
    readonly status: MemberStatus
    /** Blank when the viewer may not see it. */
    readonly email: string
    /** ISO 8601; null when the person never signed in. */
    readonly lastSignInAt: string | null
}

/** One invitation that can still be accepted (or has just expired). */
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

const isRole = (value: unknown): value is MemberRole => value === "owner" || value === "manager" || value === "staff"

const isDelivery = (value: unknown): value is InviteDelivery =>
    value === "invited" || value === "existing" || value === "none"

const isMember = (value: unknown): value is MemberItem =>
    isRecord(value) &&
    typeof value.userId === "string" &&
    typeof value.workspaceId === "string" &&
    isRole(value.role) &&
    isTextOrNull(value.staffId) &&
    typeof value.displayName === "string" &&
    (value.status === "active" || value.status === "disabled") &&
    typeof value.email === "string" &&
    isTextOrNull(value.lastSignInAt)

const isInvite = (value: unknown): value is InviteItem =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    (value.role === "manager" || value.role === "staff") &&
    isTextOrNull(value.staffId) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"

const isInviteResult = (value: unknown): value is InviteResultItem =>
    isRecord(value) && typeof value.email === "string" && typeof value.link === "string" && isDelivery(value.delivery)

/** Reads the answer of list members. */
export const decodeMembers = decodeList(isMember)

/** Reads the answer of list invites. */
export const decodeInvites = decodeList(isInvite)

/** Reads the answer of create, resend and copy-link of an invitation. */
export const decodeInviteResult = decodeOne(isInviteResult)

/** An open invitation with whether it has run out. */
export interface RosterInvite extends InviteItem {
    readonly isExpired: boolean
}

/** The roster the team page draws: everyone in the workspace and the invitations still open. */
export interface TeamRoster {
    readonly members: ReadonlyArray<MemberItem>
    readonly invites: ReadonlyArray<RosterInvite>
}

/** Marks each invitation with whether it has run out at `now` (a number of milliseconds). */
export const withExpiry = (invites: ReadonlyArray<InviteItem>, now: number): ReadonlyArray<RosterInvite> =>
    invites.map((invite) => ({ ...invite, isExpired: new Date(invite.expiresAt).getTime() < now }))
