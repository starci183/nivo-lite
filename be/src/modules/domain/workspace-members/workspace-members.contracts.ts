import type { Outcome } from "@modules/platform/primitives"

/** Workspace roles: owner and manager govern; staff operate. */
export type WorkspaceRole = "owner" | "manager" | "staff"

/** One person's identity inside one workspace; this, never a free-text name, is what authors and decides. */
export interface WorkspaceMember {
    /** The Auth user. */
    readonly userId: string
    /** The workspace the membership belongs to. */
    readonly workspaceId: string
    /** What the person may do in it. */
    readonly role: WorkspaceRole
    /** The staff row this account is, when it is one. */
    readonly staffId: string | null
    /** The name Office and the decision history show. */
    readonly displayName: string
    /** A disabled member keeps the row but loses access. */
    readonly status: MemberStatus
}

/** A member as the team page lists them. */
export interface MemberListing extends WorkspaceMember {
    /** The profile picture visible to workspace members, or null for the generated avatar. */
    readonly avatarUrl: string | null
    /** The account email; blank when the viewer is staff. */
    readonly email: string
    /** The last sign-in, ISO 8601; null when unknown or the viewer is staff. */
    readonly lastSignInAt: string | null
}

/** Whether a member can sign in to the workspace. */
export type MemberStatus = "active" | "disabled"

/** What a change to another member's seat is judged by, besides who asks and who is changed. */
export interface SeatRule {
    /** The role the member would get, for a role change. */
    readonly nextRole?: WorkspaceRole
    /** True for disable and remove, which are never allowed on one's own account. */
    readonly forbidSelf: boolean
}

/** The asker's seat and the seat being changed, both proven. */
export interface SeatPair {
    /** The person asking. */
    readonly actor: WorkspaceMember
    /** The member being changed. */
    readonly target: WorkspaceMember
}

/** A staff row of the workspace. */
export interface StaffOption {
    /** The staff id. */
    readonly id: string
    /** The staff name. */
    readonly name: string
    /** The staff role label. */
    readonly role: string
    /** The contact email, when there is one. */
    readonly email: string | null
    /** Whether the person is active. */
    readonly active: boolean
}

/** What makes a person a member: the workspace, the account and the role it grants. */
export interface JoinEntry {
    /** The workspace to join. */
    readonly workspaceId: string
    /** The Auth user who joins. */
    readonly userId: string
    /** The role the membership grants. */
    readonly role: string
    /** The staff row the account will be, when any. */
    readonly staffId: string | null
    /** The name to show when the staff row gives none. */
    readonly displayName: string
}

/** The part of a work item that decides who may decide it. */
export interface DecisionItem {
    /** `staff`, `agent`, or absent when unassigned. */
    readonly assigneeKind?: string | null
    /** The assigned staff id. */
    readonly assigneeId?: string | null
}

/** The part of an Auth account the workspace pages need. */
export interface DirectoryAccount {
    /** The account email, empty when the account has none. */
    readonly email: string
    /** The last sign-in instant, ISO 8601; null when unknown. */
    readonly lastSignInAt: string | null
    /** The name from the profile, else the email local part. */
    readonly displayName: string
    /** The picture the team sees (the uploaded one, else the sign-in provider's), when the directory knows one. */
    readonly avatarUrl?: string | null
    /** The HTTPS address of the picture the person uploaded, when they uploaded one. */
    readonly uploadedAvatarUrl?: string | null
}

/** Where the capability reads accounts from; the composition root binds it to the identity provider. */
export interface AccountDirectory {
    /** The account of one Auth user, or a refusal when none has that id. */
    accountOf(userId: string): Promise<Outcome<DirectoryAccount, string>>
}

/** One signed-in device of the account. */
export interface DeviceSession {
    /** The Auth session id. */
    readonly id: string
    /** The raw user agent the device signed in with. */
    readonly userAgent: string | null
    /** The address the session came from. */
    readonly ip: string | null
    /** When the session was created, ISO 8601. */
    readonly createdAt: string | null
    /** When it was last active, ISO 8601. */
    readonly lastActiveAt: string | null
    /** True for the session the request runs on. */
    readonly isCurrent: boolean
}

/** Everything the account page draws. */
export interface AccountOverview {
    /** The name from the profile, else the email's local part. */
    readonly name: string
    /** The account email. */
    readonly email: string
    /** The picture the team sees: the uploaded one, else the sign-in provider's, or null for the generated avatar. */
    readonly avatarUrl: string | null
    /** The picture the person uploaded, or null when they have not (the remove action then has nothing to remove). */
    readonly uploadedAvatarUrl: string | null
    /** The identity providers linked to the account (`google`, `email`). */
    readonly providers: ReadonlyArray<string>
    /** The devices signed in, the current one first. */
    readonly sessions: ReadonlyArray<DeviceSession>
}
