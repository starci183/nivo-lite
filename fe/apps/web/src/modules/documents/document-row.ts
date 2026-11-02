import type { KnowledgeRowView, RowActionView } from "@/modules/types"

/** A small label beside a document row. */
export type DocumentRowBadgeView = NonNullable<KnowledgeRowView["badges"]>[number]

/** One document as every list of documents draws it, with every word resolved: where it stands, who may read it, how far a worker got. */
export interface DocumentRowView extends KnowledgeRowView {
    /** Muted lines under the title. */
    readonly lines: ReadonlyArray<string>
    readonly badges: ReadonlyArray<DocumentRowBadgeView>
    readonly actions: ReadonlyArray<RowActionView>
    /** The live stage with its count and bar while a worker is on the document; undefined otherwise. */
    readonly progress: KnowledgeRowView["progress"] | undefined
}
