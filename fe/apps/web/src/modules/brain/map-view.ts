import type { BubbleMapEdge, BubbleMapNode } from "@starci/grammar/common"
import type { DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"
import type { DossierTone } from "./dossier-desk-view"

/** The nodes and edges the map draws. */
export interface MapContent {
    readonly nodes: ReadonlyArray<BubbleMapNode>
    readonly edges: ReadonlyArray<BubbleMapEdge>
}

/** One row of the selected node's list: a dossier of the category, or a status with its count. */
export interface MapRowView {
    readonly id: string
    readonly label: string
    readonly description: string | null
    /** Where the row leads (the map with that node selected); null where the row is only a figure. */
    readonly href: string | null
    readonly badge: { readonly label: string; readonly tone: DossierTone }
}

/** What the side pane says about the selected node (or about the whole map when nothing is selected). */
export interface MapDetailView {
    readonly title: string
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: DossierTone }>
    readonly lines: ReadonlyArray<string>
    readonly rowsLabel: string
    readonly rows: ReadonlyArray<MapRowView>
    /** The way to the dossier itself; null for a node that is not a dossier. */
    readonly action: { readonly label: string; readonly href: string } | null
}

/** What the map pane draws: the graph, its status filter and the words of its states. */
export interface MapView {
    readonly slot: DataSlot<MapContent>
    readonly placeholder: MapContent
    readonly slotLabels: SlotLabels
    readonly label: string
    readonly emptyLabel: string
    readonly filterLabel: string
    readonly filters: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly filter: string
    readonly selectedId: string | null
    readonly detail: MapDetailView
    readonly isWaiting: boolean
    /** The arrangement of the panes: the list, the map head, the map and its side pane. */
    readonly grid: PaneGridLayout
}
