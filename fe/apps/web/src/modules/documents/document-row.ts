import type { KnowledgeProgressRowView } from "./live-progress"

/** The retry or other button of a document row, with its word. */
export interface DocumentRowActionView {
    readonly id: string
    readonly label: string
    readonly onPress: () => void
}

/** A small label beside a document row. */
export interface DocumentRowBadgeView {
    readonly label: string
    readonly tone: "neutral" | "warning" | "success" | "danger" | "accent"
}

/** One document as every list of documents draws it, with every word resolved: where it stands, who may read it, how far a worker got. */
export interface DocumentRowView {
    readonly id: string
    readonly title: string
    /** Muted lines under the title. */
    readonly lines: ReadonlyArray<string>
    readonly badges: ReadonlyArray<DocumentRowBadgeView>
    readonly actions: ReadonlyArray<DocumentRowActionView>
    /** The live stage with its count and bar while a worker is on the document; undefined otherwise. */
    readonly progress: KnowledgeProgressRowView | undefined
}
