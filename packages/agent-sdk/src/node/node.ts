import type { z } from "zod"
import { assertNamespaced } from "../block/block"
import type { NodeConfig, NodeDefinition } from "./node.types"

/** Defines an executable step. Throws `SdkDefinitionError` (`ID_MALFORMED`) at module load. */
export const defineNode = <I extends z.ZodType, O extends z.ZodType>(
    config: NodeConfig<I, O>,
): NodeDefinition<I, O> => {
    assertNamespaced(config.id)
    for (const effect of config.effects) assertNamespaced(effect)
    return { ...config, entry: "node" }
}
