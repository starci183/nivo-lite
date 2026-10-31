import { FlowGraph } from "@starci/grammar/common"
import type { AgentGraphCanvasView } from "@/modules/types"

/** The graph of the agent: what it draws and what a click on a card does. */
type AgentGraphCanvasProps = {
    readonly view: AgentGraphCanvasView
    readonly isSkeleton: boolean
    readonly onSelect: (nodeKey: string) => void
}

/**
 * The work map left to right in three bands (trigger, execute, output) that is read and selected, never wired: a decision is a diamond whose edges read the
 * condition, a step a person answers is round, the rest are rectangles. The installed grammar has no dimming and no outline on a
 * selected card, so selection and a traced run paint by tone.
 */
export const AgentGraphCanvas = (props: AgentGraphCanvasProps) => (
    <FlowGraph
        label={props.view.label}
        nodes={props.view.nodes}
        edges={props.view.edges}
        direction="LR"
        layout="manual"
        headers={props.view.headers}
        fit="readable"
        height="lg"
        selectedId={props.view.selectedId === "" ? null : props.view.selectedId}
        emptyLabel={props.view.emptyLabel}
        isLoading={props.isSkeleton}
        onSelect={(id) => props.onSelect(id ?? "")}
    />
)
