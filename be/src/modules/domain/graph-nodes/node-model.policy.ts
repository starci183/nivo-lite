import { DEFAULT_MODEL, ENGINE_CORE_MODEL, nodeModelOf } from "@nivo-lite/blocks-core"
import type { NodeDeclaredModel } from "./graph-nodes.contracts"

/** The weight of a node blocks-core declares nothing for (a shop's own node, an id unknown to the table): a report-like call. */
const UNDECLARED_WEIGHT: NodeDeclaredModel["weight"] = "heavy"

/**
 * The model a node's AI calls are declared with: the model the graph's node names (the shop's choice, `node`), else blocks-core's
 * declaration for the step (`declared`), else the default model (`default`). The weight is always blocks-core's: it is a property of
 * the step, not of the shop's choice. The model door checks the id and picks each try's model from this.
 */
export const declaredModelOf = (nodeId: string, named: string | undefined): NodeDeclaredModel => {
    const declared = nodeModelOf(nodeId)
    const weight = declared?.weight ?? UNDECLARED_WEIGHT
    if (named !== undefined && named !== "") return { model: named, weight, source: "node" }
    if (declared !== null) return { model: declared.model, weight, source: "declared" }
    return { model: DEFAULT_MODEL, weight, source: "default" }
}

/** The model of the engine's own decision on a step that could not complete (the AI core), as blocks-core declares it. */
export const coreModelOf = (): NodeDeclaredModel => ({
    model: ENGINE_CORE_MODEL.model,
    weight: ENGINE_CORE_MODEL.weight,
    source: "declared",
})
