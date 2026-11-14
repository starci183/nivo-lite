import type { useQueryMyPendingInvitesSwr, useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { WorkspacesTableData } from "@/modules/types"

/** One membership as the back end answers it. */
type Membership = NonNullable<ReturnType<typeof useQueryMyWorkspacesSwr>["data"]>[number]

/** One pending invitation as the back end answers it. */
type PendingInvite = NonNullable<ReturnType<typeof useQueryMyPendingInvitesSwr>["data"]>[number]

/** How a workspace stands for the person: usable, waiting for payment, switched off for them, just joined, or deleted by them. */
type LobbyState = "active" | "pending" | "disabled" | "new" | "deleted"

/** Who switched the person's seat off, when and why: only what the back end recorded. */
interface LobbySwitchOff {
    /** ISO 8601, or null when not recorded. */
    readonly at: string | null
    readonly byName: string | null
    readonly byRole: LobbyRole | null
    readonly note: string | null
}

/** A role a member holds. */
type LobbyRole = "owner" | "manager" | "staff"

/** One workspace of the person, as the lobby draws it (plain data; the container words it). */
export interface LobbyWorkspace {
    readonly id: string
    readonly name: string
    readonly role: LobbyRole
    readonly state: LobbyState
    /** The plan name in the reader's language, or null before the first payment. */
    readonly planName: string | null
    readonly memberCount: number
    /** The seats the workspace may fill, or null when there is no plan. */
    readonly seatLimit: number | null
    /** When the person last opened it, ISO 8601; null when never. */
    readonly lastOpenedAt: string | null
    /** The row that carries the lobby's red (see `lobbyPrimaryRowOf`): false while a create action is on screen. */
    readonly isPrimary: boolean
    /** Owner or manager: may rename and copy an invitation link. */
    readonly canManage: boolean
    /** The only active owner: leaving is refused, so the lobby offers the hand-over or the deletion instead. */
    readonly isSoleOwner: boolean
    /** Until when its owner may restore it, ISO 8601; null while it lives. */
    readonly restoreBefore: string | null
    /** Why the person's seat is off, when a person switched it off. */
    readonly switchOff: LobbySwitchOff
}

/** One invitation addressed to the person, as the lobby draws it (plain data). */
export interface LobbyInvite {
    readonly id: string
    readonly workspaceId: string
    readonly workspaceName: string
    readonly role: "manager" | "staff"
    readonly inviterName: string | null
    /** Whole days until the link stops working, at least 0. */
    readonly expiresInDays: number
}

const DAY_MS = 86_400_000

/** The role of the back end role text. */
const roleOf = (role: string): LobbyRole => (role === "owner" || role === "manager" ? role : "staff")

/** The state of a membership: a disabled seat first, then the workspace's payment, then whether it was just joined. */
const stateOf = (membership: Membership, joinedId: string | undefined): LobbyState => {
    if (membership.lobby.deletedAt != null) return "deleted"
    if (membership.member.status !== "active") return "disabled"
    if (membership.workspace.status === "pending_payment" || membership.workspace.status === "cancelled")
        return "pending"
    return membership.workspace.id === joinedId ? "new" : "active"
}

/** The plan name in the reader's language. */
const planNameOf = (membership: Membership, locale: string): string | null =>
    locale === "en" ? membership.lobby.planNameEn : membership.lobby.planNameVi

/** The id of the usable workspace opened last, the one just joined first; undefined when none was ever opened. */
const primaryIdOf = (memberships: ReadonlyArray<Membership>, joinedId: string | undefined): string | undefined => {
    const usable = memberships.filter(
        (membership) => membership.member.status === "active" && membership.workspace.status !== "pending_payment",
    )
    if (joinedId !== undefined && usable.some((membership) => membership.workspace.id === joinedId)) return joinedId
    const opened = usable.filter((membership) => membership.lobby.lastOpenedAt !== null)
    const latest = opened.reduce<Membership | undefined>(
        (best, membership) =>
            best === undefined || (membership.lobby.lastOpenedAt ?? "") > (best.lobby.lastOpenedAt ?? "")
                ? membership
                : best,
        undefined,
    )
    return latest?.workspace.id
}

/**
 * The lobby's one red (red budget): the single "create workspace" action whenever one is on screen; only when none is does the enter
 * of the most recently opened row take it. Every other lobby action (invitation accept, join by link, the other rows) is neutral, so
 * two reds can never render together. Returns the id of the row that carries the red, or undefined when the create action does.
 */
export const lobbyPrimaryRowOf = (isCreateOnScreen: boolean, recentRowId: string | undefined): string | undefined =>
    isCreateOnScreen ? undefined : recentRowId

/** The lobby rows of the memberships: the one just joined on top, then the order the back end answers. */
export const lobbyWorkspacesOf = (
    memberships: ReadonlyArray<Membership>,
    locale: string,
    joinedId: string | undefined,
    isCreateOnScreen: boolean,
): ReadonlyArray<LobbyWorkspace> => {
    const primaryId = lobbyPrimaryRowOf(isCreateOnScreen, primaryIdOf(memberships, joinedId))
    const rows = memberships.map((membership): LobbyWorkspace => {
        const role = roleOf(membership.member.role)
        return {
            id: membership.workspace.id,
            name: membership.workspace.name,
            role,
            state: stateOf(membership, joinedId),
            planName: planNameOf(membership, locale),
            memberCount: membership.lobby.memberCount,
            seatLimit: membership.lobby.seatLimit ?? null,
            lastOpenedAt: membership.lobby.lastOpenedAt ?? null,
            isPrimary: membership.workspace.id === primaryId,
            canManage: role !== "staff" && membership.member.status === "active" && membership.lobby.deletedAt == null,
            isSoleOwner: role === "owner" && membership.lobby.ownerCount <= 1,
            restoreBefore: membership.lobby.restoreBefore ?? null,
            switchOff: {
                at: membership.lobby.disabledAt ?? null,
                byName: membership.lobby.disabledByName ?? null,
                byRole: membership.lobby.disabledByRole == null ? null : roleOf(membership.lobby.disabledByRole),
                note: membership.lobby.disabledNote ?? null,
            },
        }
    })
    return [...rows.filter((row) => row.id === joinedId), ...rows.filter((row) => row.id !== joinedId)]
}

/** Whole days from `now` until `expiresAt`, never below 0. */
export const daysUntil = (expiresAt: string, now: number): number =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS))

/** The lobby invitations of the back end answer. */
export const lobbyInvitesOf = (invites: ReadonlyArray<PendingInvite>, now: number): ReadonlyArray<LobbyInvite> =>
    invites.map((invite) => ({
        id: invite.id,
        workspaceId: invite.workspaceId,
        workspaceName: invite.workspaceName,
        role: invite.role === "manager" ? "manager" : "staff",
        inviterName: invite.invitedByName ?? null,
        expiresInDays: daysUntil(invite.expiresAt, now),
    }))

/** The team page of a workspace, where the owner hands the ownership on. */
export const lobbyTeamHref = (workspaceId: string): string => workspaceHref(workspaceId, CONSOLE_ROUTES.team)

/** The rows the lobby list draws as skeleton while its first read is on its way: three plain rows with a closed menu. */
export const LOBBY_PLACEHOLDER: WorkspacesTableData = {
    rows: ["a", "b", "c"].map((id) => ({
        id,
        name: id,
        status: "active",
        meta: id,
        lastOpened: id,
        isPrimary: false,
        isBusy: false,
        identity: id,
        menu: {
            menuLabel: id,
            openLabel: id,
            billingLabel: id,
            renameLabel: id,
            copyLinkLabel: id,
            leaveLabel: id,
            deleteLabel: id,
            deleteNote: id,
            canRename: false,
            canInvite: false,
            canLeave: false,
            canDelete: false,
        },
    })),
}
