import { z } from "../schema/zod-entry"
import { assertNamespaced } from "../block/block"
import { SdkDefinitionError } from "../block/definition-error"
import type { NodeConfig, NodeDefinition } from "./node.types"

/** The output member a condition answers with, which the graph routes on. */
export const BRANCH_FIELD = "branch"

/** Whether an output schema is an object that holds `branch`. */
const holdsBranch = (output: z.ZodType): boolean => output instanceof z.ZodObject && BRANCH_FIELD in output.shape

/**
 * Defines an executable step. Throws `SdkDefinitionError` at module load: `ID_MALFORMED` for a bad node, effect or tool id,
 * `NODE_CONDITION_BRANCH` for a condition whose output holds no `branch`, `NODE_CONDITION_EFFECTS` for a condition that declares effects:
 * a condition is pure, so a graph can re-run its branching at no cost.
 */
export const defineNode = <I extends z.ZodType, O extends z.ZodType, P extends z.ZodType>(
    config: NodeConfig<I, O, P>,
): NodeDefinition<I, O, P> => {
    assertNamespaced(config.id)
    for (const name of [...config.effects, ...(config.tools ?? [])]) assertNamespaced(name)
    for (const name of config.requires ?? []) {
        if (![...config.effects, ...(config.tools ?? [])].includes(name)) {
            throw new SdkDefinitionError("REQUIRES_UNDECLARED", name)
        }
    }
    if (config.role === "condition" && !holdsBranch(config.output)) {
        throw new SdkDefinitionError("NODE_CONDITION_BRANCH", config.id)
    }
    if (config.role === "condition" && config.effects.length > 0) {
        throw new SdkDefinitionError("NODE_CONDITION_EFFECTS", config.id)
    }
    return { ...config, entry: "node" }
}
