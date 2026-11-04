import type { ModuleIconName } from "./module-icon"

/** Where a responsibility stands. */
export type RowStatus = "open" | "waiting_approval" | "done"

/** One responsibility, resolved for display. */
export interface ResponsibilityRowView {
    readonly id: string
    readonly leadId: string
    readonly customer: string
    readonly title: string
    readonly nextAction: string
    readonly dueLabel: string | null
    readonly dueAt: string | null
    readonly createdAt: string
    readonly isOverdue: boolean
    readonly isDueToday: boolean
    readonly isDueThisWeek: boolean
    readonly status: RowStatus
    readonly statusLabel: string
    readonly ownerKey: string
    readonly ownerName: string
    readonly ownerKind: "human" | "agent"
    readonly ownerHandle: string | null
}

/** The owners that hold rows, in display order. */
export interface OwnerGroupView {
    readonly key: string
    readonly name: string
    readonly kind: "human" | "agent"
    readonly handle: string | null
    /** Semantic Icon name of the glyph an agent owner is drawn with. */
    readonly glyph: ModuleIconName
    /** The picture the owner gave an agent owner; null draws the NIVO unicorn mascot. */
    readonly avatarUrl: string | null
    readonly rows: ReadonlyArray<ResponsibilityRowView>
}

/** The words of the responsibility detail. */
interface ResponsibilityDetailCopy {
    readonly title: string
    readonly verified: string
    readonly openLead: string
    readonly openOffice: string
    readonly draftNote: (name: string) => string
    readonly linkCopied: string
    /** "Next: {action}" for the row line and the next step. */
    readonly nextOf: (action: string) => string
    readonly terms: {
        readonly owner: string
        readonly due: string
        readonly next: string
        readonly status: string
    }
}

/** The words of the filters panel. */
interface ResponsibilityFiltersCopy {
    readonly ownerLabel: string
    readonly dueLabel: string
    readonly sortLabel: string
    readonly clear: string
    readonly live: string
}

/** The words of the responsibility board. */
export interface ResponsibilitiesBoardCopy {
    readonly grid: string
    readonly title: string
    readonly pageBody: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly errorBody: string
    readonly emptyBody: string
    readonly clearFilters: string
    readonly back: string
    readonly moreActions: string
    readonly filtersLabel: string
    readonly filtersTitle: string
    readonly count: string
    readonly tabsLabel: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly filterSearch: string
    readonly filterNoMatch: string
    readonly draft: string
    readonly drafting: string
    readonly menuCopy: string
    readonly detail: ResponsibilityDetailCopy
    readonly filters: ResponsibilityFiltersCopy
}

/** The opened responsibility with the words only its owner and due day know. */
export interface ResponsibilityOpenedView {
    readonly row: ResponsibilityRowView
    readonly avatarUrl: string | null
    readonly ownerRole: string
    readonly dueDate: string | null
    /** Whether a follow-up draft can be asked for: the responsibility is open. */
    readonly canDraft: boolean
}
