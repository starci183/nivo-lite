import { z } from "zod"
import { isNamespaced } from "../schema/namespaced"
import type { JsonSchema, Namespaced, PropsSchema } from "../schema/schema.types"
import type {
    ActionConfig,
    ActionDefinition,
    BlockConfig,
    BlockDefinition,
    BlockSlots,
    ReadConfig,
    ReadDefinition,
} from "./block.types"
import type { DefinitionErrorCode } from "./definition-error"
import { SdkDefinitionError } from "./definition-error"

/** Refuses a malformed id. */
export const assertNamespaced = (id: string): void => {
    if (!isNamespaced(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
}

/** The JSON Schema of a zod object, or a refusal naming the owner of the schema. */
const jsonOf = (schema: PropsSchema, code: DefinitionErrorCode, id: Namespaced): JsonSchema => {
    try {
        return z.toJSONSchema(schema)
    } catch (error) {
        throw new SdkDefinitionError(code, id, { cause: error })
    }
}

/**
 * Defines a block: React-free data and a zod schema of its literal props. Throws `SdkDefinitionError` (`ID_MALFORMED`,
 * `BLOCK_PROPS_UNSERIALIZABLE`) at module load.
 */
export const defineBlock = <P extends PropsSchema, S extends BlockSlots>(
    config: BlockConfig<P, S>,
): BlockDefinition<P, S> => {
    assertNamespaced(config.id)
    return { ...config, entry: "block", propsJson: jsonOf(config.props, "BLOCK_PROPS_UNSERIALIZABLE", config.id) }
}

/** Defines a read a spec may bind. Throws `SdkDefinitionError` for a malformed id or variables that do not convert. */
export const defineRead = <V extends PropsSchema>(config: ReadConfig<V>): ReadDefinition<V> => {
    assertNamespaced(config.id)
    jsonOf(config.variables, "READ_VARIABLES_UNSERIALIZABLE", config.id)
    return { ...config, entry: "read" }
}

/** Defines an action a spec may bind. Throws `SdkDefinitionError` for a malformed id. */
export const defineAction = (config: ActionConfig): ActionDefinition => {
    assertNamespaced(config.id)
    return { ...config, entry: "action" }
}
