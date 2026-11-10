import { FlowGraph, FlowGraphLegend, Stack } from "@starci/grammar/common"
import type { ReactElement } from "react"
import type { StepsMapView } from "@/modules/types"

/** The card map of the agent: what it draws, how large, and what pressing a step does. */
type AgentGraphCanvasProps = {
    readonly map: StepsMapView
    readonly label: string
    readonly emptyLabel: string
    /** The step whose drawer is open, outlined; null when none is. */
    readonly selectedId: string | null
    readonly isLoading: boolean
    /** `preview`: the map in the card, no zoom controls; `full` (default): the map with its zoom controls. Both at reading size. */
    readonly size?: "preview" | "full"
    /** Opens the settings drawer of a step. */
    readonly onPress: (nodeKey: string) => void
}

/**
 * The work map of the agent as the card map (`layout="steps"`): white step cards on the well with their kind icon tiles, the branch
 * ports of a condition, curved edges and dashed back edges with their pills. Pressing a step opens its settings. The card map is
 * never shrunk to fit: the preview in the setup card is the same map at its reading size without the zoom controls (the card puts
 * the kind legend under it); the full map carries the legend itself.
 */
export const AgentGraphCanvas = (props: AgentGraphCanvasProps): ReactElement => {
    const isPreview = props.size === "preview"
    const graph = (
        <FlowGraph
            label={props.label}
            nodes={props.map.nodes}
            edges={props.map.edges}
            layout="steps"
            statusLabels={props.map.statusLabels}
            emptyLabel={props.emptyLabel}
            isLoading={props.isLoading}
            selectedId={props.selectedId}
            onNodePress={props.onPress}
            showControls={!isPreview}
        />
    )
    if (isPreview) return graph
    return (
        <Stack gap="row">
            {graph}
            <FlowGraphLegend items={props.map.legend} />
        </Stack>
    )
}
