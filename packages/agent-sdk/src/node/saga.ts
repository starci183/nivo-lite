import type { NodeDefinition } from "./node.types"
import type { NodeIndex } from "./problems"

/** What running a node does to the world: `read` changes nothing; `write` runs an effect, or calls a tool that changes the world. */
export type NodeSaga = "read" | "write"

/** The saga kind of a node under an install. An effect or tool the app did not install counts as a write. */
export const nodeSagaOf = (node: NodeDefinition, index: NodeIndex): NodeSaga => {
    const mutatingTool = (node.tools ?? []).some((tool) => index.tools.get(tool)?.mutates !== false)
    return mutatingTool || node.effects.length > 0 ? "write" : "read"
}
