import { FlowGraph } from "@starci/grammar/common"
import type { AgentGraphCanvasView } from "@/modules/types"

/** The graph of the agent: what it draws and what a click on a card does. */
type AgentGraphCanvasProps = {
    readonly view: AgentGraphCanvasView
    readonly isSkeleton: boolean
    readonly onSelect: (nodeKey: string) => void
}

/**
 * The work map top to bottom, each step below the ones that lead to it (the trigger, what the agent works out, the condition that
 * picks a branch, what comes out), read and selected, never wired: a decision is a diamond whose edges read the condition, a step
 * a person answers is round, the rest are rectangles. A selected card and the cards of a traced run paint by tone; the others dim.
 */
export const AgentGraphCanvas = (props: AgentGraphCanvasProps) => (
    <FlowGraph
        label={props.view.label}
        nodes={props.view.nodes}
        edges={props.view.edges}
        direction="TB"
        layout="layered"
        headers={props.view.headers}
        fit="readable"
        height="lg"
        selectedId={props.view.selectedId === "" ? null : props.view.selectedId}
        emptyLabel={props.view.emptyLabel}
        isLoading={props.isSkeleton}
        onSelect={(id) => props.onSelect(id ?? "")}
    />
)
