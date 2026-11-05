import type { useFormatter, useTranslations } from "next-intl"
import { ROLE_KEYS, canManageMember, roleChoices } from "@/hooks/team"
import type { TeamInviteView, TeamMemberView, TeamRole } from "@/hooks/team"
import type { InviteAction, InviteRowView, TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]
/** Derived from the panes contract. */
type TeamListRowView = TeamPanesData["rows"][number]
/** Derived from the panes contract. */
type TeamMemberDetailView = TeamPanesData["members"][number]

/** The team words, resolved by the connected block. */
export type TeamWords = ReturnType<typeof useTranslations<"team">>

/** The locale's formats, resolved by the connected block. */
export type TeamFormat = ReturnType<typeof useFormatter>

/** The role hint key of each role: what the role may do, in one line. */
const HINT_KEYS = { owner: "roleHintOwner", manager: "roleHintManager", staff: "roleHintStaff" } as const

/** What the viewer is: the role and the id. */
interface Viewer {
    readonly role: TeamRole
    readonly id: string
}

/** The person's pane data: identity, status, the role control the viewer may use and the facts. */
export const memberDetailOf = (
    t: TeamWords,
    format: TeamFormat,
    row: TeamMemberView,
    viewer: Viewer,
): TeamMemberDetailView => ({
    id: row.userId,
    name: row.displayName,
    email: row.email,
    statusLabel: t(row.isActive ? "statusActive" : "statusDisabled"),
    isActive: row.isActive,
    isYou: row.userId === viewer.id,
    role: row.role,
    roleOptions: roleChoices(viewer.role).map((role) => ({ value: role, label: t(ROLE_KEYS[role]) })),
    roleHint: t(HINT_KEYS[row.role]),
    lastSignIn:
        row.lastSignInAt === null
            ? t("neverSignedIn")
            : format.dateTime(new Date(row.lastSignInAt), { dateStyle: "medium", timeStyle: "short" }),
    staffName: row.staffName,
    canChangeRole: canManageMember(viewer.role, row),
    canChangeAccess: row.userId !== viewer.id && canManageMember(viewer.role, row),
})

/** What runs on an invitation right now, so its command shows its pending state. */
export interface InviteBusy {
    readonly id: string | undefined
    readonly action: InviteAction | null
    readonly isPending: boolean
    readonly shown:
        { readonly id: string; readonly email: string; readonly link: string; readonly isCopied: boolean } | undefined
}

/** The invitation's pane data: when it ends, who it is for, the pending command and the link once issued. */
export const inviteDetailOf = (
    t: TeamWords,
    format: TeamFormat,
    invite: TeamInviteView,
    busy: InviteBusy,
): InviteRowView => {
    const isBusy = busy.isPending && busy.id === invite.id
    return {
        id: invite.id,
        email: invite.email,
        expiry: t(invite.isExpired ? "inviteExpired" : "inviteExpires", { date: dayOf(format, invite.expiresAt) }),
        staffNote: invite.staffName === null ? undefined : t("inviteStaffFor", { name: invite.staffName }),
        roleLabel: t(ROLE_KEYS[invite.role]),
        isExpired: invite.isExpired,
        isBusy,
        pendingAction: isBusy ? busy.action : null,
        link:
            busy.shown?.id === invite.id
                ? {
                      label: t("inviteLinkLabel", { email: busy.shown.email }),
                      value: busy.shown.link,
                      isCopied: busy.shown.isCopied,
                  }
                : undefined,
    }
}

/** A day and month, the short form every row of the list uses. */
const dayOf = (format: TeamFormat, iso: string): string =>
    format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })

/** The list rows of the people and of the invitations, in that order. */
export const listRowsOf = (
    t: TeamWords,
    format: TeamFormat,
    members: ReadonlyArray<TeamMemberView>,
    invites: ReadonlyArray<TeamInviteView>,
    viewer: Viewer,
): ReadonlyArray<TeamListRowView> => [
    ...members.map((row): TeamListRowView => ({
        id: `member:${row.userId}`,
        kind: "member",
        title: row.displayName,
        description: `${t(ROLE_KEYS[row.role])} · ${row.email}`,
        isYou: row.userId === viewer.id,
        badge: row.isActive ? null : { label: t("statusDisabled"), tone: "neutral" },
    })),
    ...invites.map((invite): TeamListRowView => ({
        id: `invite:${invite.id}`,
        kind: "invite",
        title: invite.email,
        description: `${t(ROLE_KEYS[invite.role])} · ${t(invite.isExpired ? "inviteExpired" : "inviteExpires", { date: dayOf(format, invite.expiresAt) })}`,
        isYou: false,
        badge: invite.isExpired
            ? { label: t("inviteStateExpired"), tone: "warning" }
            : { label: t("inviteStateWaiting"), tone: "neutral" },
    })),
]

/** Keeps the rows the filter and the search let through. */
export const filteredRowsOf = (
    rows: ReadonlyArray<TeamListRowView>,
    filter: string,
    query: string,
): ReadonlyArray<TeamListRowView> => {
    const needle = query.trim().toLowerCase()
    return rows.filter(
        (row) =>
            (filter === "all" || (filter === "members" ? row.kind === "member" : row.kind === "invite")) &&
            (needle === "" || `${row.title} ${row.description}`.toLowerCase().includes(needle)),
    )
}

/** What the panes draw once the team is read, before the narrowing. */
interface PanesDataInput {
    readonly rows: ReadonlyArray<TeamListRowView>
    readonly filter: string
    readonly query: string
    readonly members: ReadonlyArray<TeamMemberDetailView>
    readonly invites: ReadonlyArray<InviteRowView>
}

/** What the panes draw once the team is read: the rows after the filter, the counts and the opened records. */
export const panesDataOf = (input: PanesDataInput): TeamPanesData => ({
    rows: filteredRowsOf(input.rows, input.filter, input.query),
    counts: {
        all: input.rows.length,
        members: input.members.length,
        invites: input.invites.length,
    },
    members: input.members,
    invites: input.invites,
})
