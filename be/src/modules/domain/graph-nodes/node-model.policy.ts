import { DEFAULT_MODEL, ENGINE_CORE_MODEL } from "@nivo-lite/agent-sdk/models"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { NodeDeclaredModel, NodeWorkKind, OptionalNodeModelName } from "./graph-nodes.contracts"

/** The weight of a node blocks-core declares nothing for (a shop's own node, an id unknown to the table): a report-like call. */
const UNDECLARED_WEIGHT: NodeDeclaredModel["weight"] = "heavy"

/**
 * The model a node's AI calls are declared with: the model the graph's node names (the shop's choice, `node`), else blocks-core's
 * declaration for the step (`declared`), else the default model (`default`). The weight and the output bound are always blocks-core's:
 * they are properties of the step, not of the shop's choice. The model door checks the id and picks each try's model from this.
 */
export const declaredModelOf = (nodeId: string, named: OptionalNodeModelName): NodeDeclaredModel => {
    const declared = INSTALLED.nodeModelOf(nodeId)
    const weight = declared?.weight ?? UNDECLARED_WEIGHT
    // The output bound is the step's, like the weight: the shop's choice of model never lifts it.
    const cap = declared?.maxOutputTokens === undefined ? {} : { maxOutputTokens: declared.maxOutputTokens }
    if (named !== undefined && named !== "") return { model: named, weight, source: "node", ...cap }
    if (declared !== null) return { model: declared.model, weight, source: "declared", ...cap }
    return { model: DEFAULT_MODEL, weight, source: "default" }
}

/** The work blocks-core declares a step's calls are booked as (`chat_turn`), or undefined for plain node work. */
export const declaredWorkOf = (nodeId: string): NodeWorkKind | undefined => INSTALLED.nodeModelOf(nodeId)?.work

/** The model of the engine's own decision on a step that could not complete (the AI core), as blocks-core declares it. */
export const coreModelOf = (): NodeDeclaredModel => ({
    model: ENGINE_CORE_MODEL.model,
    weight: ENGINE_CORE_MODEL.weight,
    source: "declared",
})
