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
    readonly rows: ReadonlyArray<ResponsibilityRowView>
}
