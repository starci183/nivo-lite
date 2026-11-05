import type { DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"

/** The soft tone a chip of the dossiers tab wears. */
export type DossierTone = "success" | "warning" | "accent" | "danger" | "neutral"

/** One dossier as a row of the list: its name, the one line under it and the status chip at its end. */
export interface DossierRowView {
    readonly id: string
    readonly name: string
    readonly note: string | null
    readonly badge: { readonly label: string; readonly tone: DossierTone }
}

/** The dossiers of one category, under the caption that names it. */
export interface DossierSectionView {
    readonly id: string
    readonly title: string
    readonly rows: ReadonlyArray<DossierRowView>
}

/** One cell of the figures strip. */
export interface DossierFigureView {
    readonly id: string
    readonly label: string
    readonly value: string
}

/** The list pane of the tab: the figures of the whole set, the search over the rows and the rows under their categories. */
export interface DossierListView {
    readonly slot: DataSlot<ReadonlyArray<DossierSectionView>>
    readonly slotLabels: SlotLabels
    readonly figures: ReadonlyArray<DossierFigureView>
    readonly query: string
    readonly selectedId: string | null
    /** The search matched nothing although dossiers exist. */
    readonly isFiltered: boolean
}

/** One document filed under the open dossier. */
export interface DossierDocumentView {
    readonly id: string
    readonly title: string
    readonly meta: string
    readonly href: string
}

/** The side pane of the open dossier: what it lacks, the way to bring it, and the documents it holds. */
export interface DossierAsideView {
    readonly title: string
    readonly missing: {
        readonly title: string
        readonly text: string
        readonly upload: { readonly label: string; readonly href: string } | null
    } | null
    /** What the dossier carries besides its papers: who owns it and by when (term and value, already worded). */
    readonly details: ReadonlyArray<{ readonly id: string; readonly term: string; readonly text: string }>
    readonly documentsTitle: string
    readonly documentsEmpty: string
    readonly documents: ReadonlyArray<DossierDocumentView>
}

/** The head band of the open dossier. */
export interface DossierHeadView {
    readonly title: string
    readonly description: string
    readonly badge: { readonly label: string; readonly tone: DossierTone } | null
    /** How many documents it holds, in words. */
    readonly documentCount: string
    /** The path of the dossier on the map. */
    readonly mapHref: string
}

/** What the tab shows: the list, the panes' arrangement and the open dossier. */
export interface DossierDeskView {
    readonly list: DossierListView
    readonly grid: PaneGridLayout
    /** The read settled to a notice (nothing tracked, or it failed): one pane across the page. */
    readonly isWhole: boolean
    readonly head: DossierHeadView | null
    readonly aside: DossierAsideView | null
    /** The first reads have no data yet: every region draws its skeleton at once. */
    readonly isWaiting: boolean
}
