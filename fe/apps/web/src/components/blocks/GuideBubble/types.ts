import type { IconName } from "@/components/leaves/Icon"

/** One result row or one thing to do, already in the reader's words. The whole row opens; Grammar ends it with the chevron. */
export interface GuideRowView {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly icon: IconName
    /** What it is, as a word at the row's end. */
    readonly meta?: string
}

/** One result group: a label and its rows. */
export interface GuideGroupView {
    readonly id: string
    readonly title: string
    readonly rows: ReadonlyArray<GuideRowView>
}

/** One button of a guide reply that opens a page. */
export interface GuideBubbleLink {
    readonly id: string
    readonly label: string
}

/** One line of the AI conversation: the member question, or the guide answer with its steps and links. */
export interface GuideBubbleMessage {
    readonly id: number
    readonly isUser: boolean
    readonly text: string
    readonly steps: ReadonlyArray<string>
    readonly links: ReadonlyArray<GuideBubbleLink>
    readonly note: string | null
}
