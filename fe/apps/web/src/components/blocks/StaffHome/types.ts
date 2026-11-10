import type { IconName } from "@/components/leaves/Icon"

/** One row of a card of the staff home: what it says, how it is marked, and where it opens. */
export interface StaffHomeRow {
    readonly id: string
    readonly title: string
    readonly description?: string
    /** The glyph at the start of the row. */
    readonly icon: IconName
    /** A short mark after the words (an unread count, a channel). */
    readonly badge?: { readonly label: string; readonly tone: "accent" | "muted" }
    /** One short fact at the end (a time). */
    readonly meta?: string
    /** The address the row opens. */
    readonly href: string
}

/** One list card of the page: its title, its rows, the words of its empty state and the place that holds the rest. */
export interface StaffHomeList {
    readonly title: string
    /** A short count or fact after the title, or null. */
    readonly fact: string | null
    readonly rows: ReadonlyArray<StaffHomeRow>
    readonly isLoading: boolean
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly emptyIcon: IconName
    /** The command that opens the whole list, or null when the card has none. */
    readonly more: { readonly label: string; readonly href: string } | null
}

/** One key figure. */
export interface StaffHomeFigure {
    readonly id: string
    readonly term: string
    readonly value: number
}

/** What the staff home is told. */
export interface StaffHomeBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly figuresLabel: string
        readonly figures: ReadonlyArray<StaffHomeFigure>
        readonly isFiguresLoading: boolean
        readonly work: StaffHomeList
        readonly chats: StaffHomeList
        readonly leads: StaffHomeList
        readonly shortcuts: StaffHomeList
    }
    readonly on: {
        /** Opens an address of the workspace. */
        readonly open: (href: string) => void
    }
}
