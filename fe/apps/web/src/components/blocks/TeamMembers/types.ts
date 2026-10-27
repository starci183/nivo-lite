import type { DataTableRow, DropdownMenuEntry } from "@starci/grammar/common"

/** One member, already worded for the person's language. */
export interface MemberRowView extends DataTableRow {
    readonly name: string
    readonly email: string
    readonly isYou: boolean
    readonly staffNote?: string | undefined
    readonly roleLabel: string
    readonly isActive: boolean
    readonly lastSignIn: string
    readonly menuLabel: string
    /** The actions the person may take on this member; none draws no menu. */
    readonly entries: ReadonlyArray<DropdownMenuEntry>
}

/** The question asked before a remove or a disable, for one member. */
export interface Asking {
    readonly userId: string
    readonly kind: "remove" | "disable"
}
