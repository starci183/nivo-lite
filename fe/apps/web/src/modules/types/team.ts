/** The invitation command whose own control displays its pending state. */
export type InviteAction = "resend" | "copy" | "revoke"

/** The row-local link and clipboard acknowledgement. */
export interface InviteLinkView {
    readonly label: string
    readonly value: string
    readonly isCopied: boolean
}

/** Resolved invitation facts shared by its list identity and action detail. */
export interface InviteRowView {
    readonly id: string
    readonly email: string
    readonly expiry: string
    readonly staffNote?: string | undefined
    readonly roleLabel: string
    readonly isExpired: boolean
    readonly isBusy: boolean
    readonly pendingAction: InviteAction | null
    readonly link?: InviteLinkView | undefined
}

import type { DataSlot, SlotLabels } from "./slot"
import type { PaneGridLayout } from "./panes"

/** One row of the team list: a person or an open invitation, already worded for the person's language. */
interface TeamListRowView {
    /** `member:<id>` or `invite:<id>`: the key the list selects by. */
    readonly id: string
    readonly kind: "member" | "invite"
    readonly title: string
    readonly description: string
    readonly isYou: boolean
    /** The state mark at the row's end: a disabled person, a waiting or expired invitation. */
    readonly badge: { readonly label: string; readonly tone: "neutral" | "warning" } | null
}

/** One choice of a role control. */
interface TeamRoleOptionView {
    readonly value: string
    readonly label: string
}

/** The opened person: who they are, their role, their facts and what the viewer may change. */
interface TeamMemberDetailView {
    readonly id: string
    readonly name: string
    readonly email: string
    readonly statusLabel: string
    readonly isActive: boolean
    readonly isYou: boolean
    readonly role: string
    readonly roleOptions: ReadonlyArray<TeamRoleOptionView>
    readonly roleHint: string
    readonly lastSignIn: string
    readonly staffName: string | null
    /** The viewer may change this person's role (an owner's row is for owners). */
    readonly canChangeRole: boolean
    /** The viewer may disable or remove this person (never themselves). */
    readonly canChangeAccess: boolean
}

/** What the team panes draw once the three reads arrived: the rows after the filter, their counts and the opened records. */
interface TeamPanesData {
    readonly rows: ReadonlyArray<TeamListRowView>
    readonly counts: { readonly all: number; readonly members: number; readonly invites: number }
    readonly members: ReadonlyArray<TeamMemberDetailView>
    readonly invites: ReadonlyArray<InviteRowView>
}

/** The words of the opened person's pane. */
interface TeamMemberDetailCopy {
    readonly roleTitle: string
    readonly roleLabel: string
    readonly lastSignInTerm: string
    readonly staffTerm: string
    readonly accessTitle: string
    readonly accessHint: string
    readonly disableLabel: string
    readonly enableLabel: string
    readonly removeLabel: string
    readonly youLabel: string
}

/** The words of the opened invitation's pane. */
interface TeamInviteDetailCopy {
    readonly stateLabel: string
    readonly roleTerm: string
    readonly expiryTerm: string
    readonly staffTerm: string
    readonly resendLabel: string
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly revokeLabel: string
    readonly rotateNote: string
}

/** One choice of the staff select. */
interface TeamStaffChoiceView {
    readonly id: string
    readonly label: string
}

/** The invitation just made, ready to copy. */
interface TeamInviteSentView {
    readonly text: string
    readonly link: string
    readonly linkLabel: string
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly isCopied: boolean
}

/** The words and values of the invite drawer. */
interface TeamInviteDrawerView {
    readonly isOpen: boolean
    /** An individual plan takes no invitations: the drawer says so and points to the Team plan. */
    readonly isIndividual: boolean
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly doneLabel: string
    readonly emailLabel: string
    readonly roleLabel: string
    readonly staffLabel: string
    readonly staffHint: string
    readonly submitLabel: string
    readonly failTitle: string
    readonly roleOptions: ReadonlyArray<TeamRoleOptionView>
    readonly staffOptions: ReadonlyArray<TeamStaffChoiceView>
    readonly email: string
    readonly role: string
    readonly staffId: string
    readonly isPending: boolean
    readonly error?: string | undefined
    readonly sent?: TeamInviteSentView | undefined
    readonly individual: { readonly title: string; readonly body: string; readonly actionLabel: string }
}

/** The words of the team panes, resolved once. */
interface TeamPanesCopy {
    readonly grid: string
    readonly title: string
    readonly description: string
    readonly tabsLabel: string
    readonly membersTab: string
    readonly permissionsTab: string
    readonly inviteAction: string
    readonly listTitle: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly summary: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly filterLabel: string
    readonly filterAll: string
    readonly filterMembers: string
    readonly filterInvites: string
    readonly sectionMembers: string
    readonly sectionInvites: string
    readonly youLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly emptyBody: string
    readonly errorBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly back: string
    readonly forbiddenTitle: string
    readonly forbiddenBody: string
    readonly forbiddenAction: string
    readonly cancelLabel: string
    readonly member: TeamMemberDetailCopy
    readonly invite: TeamInviteDetailCopy
}

/** The question asked before a remove, a disable or a withdrawn invitation. */
interface TeamConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly isPending: boolean
}

/** Copy, data and state the connected team panes supply, and the commands behind them. */
export interface TeamPanesBaseProps {
    readonly props: {
        readonly copy: TeamPanesCopy
        readonly grid: PaneGridLayout
        /** `manager` sees the team; anyone else sees the one notice. */
        readonly access: "manager" | "staff"
        readonly slot: DataSlot<TeamPanesData>
        readonly labels: SlotLabels
        readonly query: string
        readonly filter: string
        readonly selectedId: string | null
        readonly confirm?: TeamConfirmView | undefined
        readonly isMemberPending: boolean
        readonly invite: TeamInviteDrawerView
    }
    readonly on: {
        readonly retry: () => void
        readonly setQuery: (value: string) => void
        readonly setFilter: (value: string) => void
        readonly moreFilters: string
        readonly select: (id: string) => void
        readonly back: () => void
        readonly openInvite: () => void
        readonly closeInvite: () => void
        readonly setInviteEmail: (value: string) => void
        readonly setInviteRole: (value: string) => void
        readonly setInviteStaff: (value: string | null) => void
        readonly submitInvite: () => void
        readonly inviteCopied: () => void
        readonly linkCopied: () => void
        readonly goTeamPlan: () => void
        readonly goOffice: () => void
        readonly setRole: (id: string, role: string) => void
        readonly enable: (id: string) => void
        readonly askDisable: (id: string) => void
        readonly askRemove: (id: string) => void
        readonly resend: (id: string) => void
        readonly copyLink: (id: string) => void
        readonly askRevoke: (id: string) => void
        readonly acceptConfirm: () => void
        readonly cancelConfirm: () => void
    }
}
