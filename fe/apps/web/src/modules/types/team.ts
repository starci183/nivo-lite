import type { DataTableRow, DropdownMenuEntry } from "@starci/grammar/common"

/** One member of the members table, already worded for the person's language. */
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

/** Server-resolved heading data for the team's two Page roots; the native header is drawn inside its Base. */
export interface TeamPageHeading {
    readonly crumbLabel: string
    readonly crumbHome: string
    readonly title: string
    readonly description: string
    readonly eyebrow?: string
}
