import type { NodeDefinition } from "./node.types"
import type { NodeIndex } from "./problems"

/**
 * What running a node does to the world, in the saga terms of a run: `read` changes nothing; `compensable` runs only effects that each
 * name the effect that undoes them; `pivot` runs an effect that cannot be undone, or calls a tool that changes the world.
 */
export type NodeSaga = "read" | "compensable" | "pivot"

/** The saga kind of a node under an install. An effect or tool the app did not install counts as one that cannot be undone. */
export const nodeSagaOf = (node: NodeDefinition, index: NodeIndex): NodeSaga => {
    const mutatingTool = (node.tools ?? []).some((tool) => index.tools.get(tool)?.mutates !== false)
    if (mutatingTool) return "pivot"
    if (node.effects.length === 0) return "read"
    const undoable = node.effects.every((effect) => index.effects.get(effect)?.compensation !== undefined)
    return undoable ? "compensable" : "pivot"
}
