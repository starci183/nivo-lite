import type { BubbleMapEdge, BubbleMapNode } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { FactMapPaneView } from "./fact-map-pane"

/** The nodes and edges the map draws. */
export interface MapContent {
    readonly nodes: ReadonlyArray<BubbleMapNode>
    readonly edges: ReadonlyArray<BubbleMapEdge>
}

/** The two ways the facts card draws the same facts. */
export type FactMode = "list" | "map"

/** One entry of the legend under the map: a status dot and its words. */
export interface FactMapLegendDot {
    readonly id: string
    readonly label: string
    readonly tone: "success" | "warning" | "danger"
}

/** The words of the card around the facts: its name, its switch and the empty side pane. */
export interface FactCardWords {
    readonly title: string
    readonly modeLabel: string
    readonly modeList: string
    readonly modeMap: string
}

/** What the map of the facts draws: the graph, the audience views, the side pane for the selected node and the legend. */
export interface FactMapView {
    readonly slot: DataSlot<MapContent>
    readonly placeholder: MapContent
    readonly slotLabels: SlotLabels
    readonly label: string
    readonly emptyLabel: string
    readonly selectedId: string | null
    readonly viewLabel: string
    readonly views: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly viewId: string
    /** The side pane for the selected node; null while nothing is selected. */
    readonly pane: FactMapPaneView | null
    readonly paneLabel: string
    readonly paneEmptyTitle: string
    readonly paneEmptyBody: string
    readonly readersNone: string
    readonly legend: ReadonlyArray<FactMapLegendDot>
    readonly documentLegend: string
    readonly isWaiting: boolean
}
