import { z } from "zod"
import { portsOf } from "../port/port"
import type { PortMap } from "../port/port.types"
import { isActionId, isNamespaced, isReadId, isToolName } from "../schema/namespaced"
import type { JsonSchema, Namespaced, PropsSchema, SpecText } from "../schema/schema.types"
import type {
    ActionConfig,
    ActionDefinition,
    ActionResult,
    BlockConfig,
    BlockDefinition,
    BlockSlots,
    InputProblem,
    ReadConfig,
    ReadDefinition,
    RunActionConfig,
    RunReadConfig,
} from "./block.types"
import { type DefinitionErrorCode, SdkDefinitionError } from "./definition-error"
import { parseStrict } from "./input"

/** The words of a form field, or of an action, whose value the schema refused: a key of the SDK message catalogue. */
const INVALID: SpecText = { key: "renderer.invalid" }

/** Refuses a malformed id. */
export const assertNamespaced = (id: string): void => {
    if (!isNamespaced(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
}

/** Refuses an id that names no read: neither `<package>.<agent>.api.<domain>.<query>` nor `<module>.<name>`. */
export const assertReadId = (id: string): void => {
    if (!isReadId(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
}

/** Refuses an id that names no action: neither `<package>.<agent>.<action>` nor `<module>.<name>`. */
export const assertActionId = (id: string): void => {
    if (!isActionId(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
}

/** Throws `ID_MALFORMED` unless the id may name a tool: a `nivo.*` id must obey the law of a NIVO tool id (`isToolName`). */
export const assertToolName = (id: string): void => {
    if (!isToolName(id)) throw new SdkDefinitionError("ID_MALFORMED", id)
}

/** The JSON Schema of a zod object, or a refusal naming the owner of the schema. */
const jsonOf = (schema: PropsSchema, code: DefinitionErrorCode, id: Namespaced): JsonSchema => {
    try {
        return z.toJSONSchema(schema)
    } catch (error) {
        throw new SdkDefinitionError(code, id, { cause: error })
    }
}

/** The result of an action whose payload the input schema refused: invalid, with each broken field named. */
const invalidResult = (problems: ReadonlyArray<InputProblem>): ActionResult => ({
    ok: false,
    reason: "invalid",
    message: INVALID,
    fields: Object.fromEntries(problems.map((problem) => [problem.at, INVALID])),
})

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

/**
 * Defines a read a spec may bind. With `operation` it is a host-operation read. With `ports` and `run` it runs in the package:
 * `operation` is the read id (the front end sends the id to the one generic door), and `execute` parses the variables (an unknown
 * key is refused), builds the ports from the provider and calls `run`. Throws `SdkDefinitionError` for an id that names no read
 * (`isReadId`) or variables that do not convert.
 */
export const defineRead = <V extends PropsSchema, P extends PortMap, R>(
    config: ReadConfig<V> | RunReadConfig<V, P, R>,
): ReadDefinition<V> => {
    assertReadId(config.id)
    jsonOf(config.variables, "READ_VARIABLES_UNSERIALIZABLE", config.id)
    if (!("run" in config)) return { ...config, entry: "read" }
    const { run, ...rest } = config
    return {
        ...rest,
        operation: config.id,
        entry: "read",
        execute: async (provider, raw, context) => {
            const parsed = parseStrict(config.variables, raw)
            if (!parsed.ok) return parsed
            return { ok: true, data: await run(portsOf(provider, config.ports), parsed.value, context) }
        },
    }
}

/**
 * Defines an action a spec may bind. With `operation` it is a host-operation action. With `input`, `ports` and `run` it runs in
 * the package: `operation` is the action id, and `execute` parses the payload (an unknown key makes the result `invalid`), builds
 * the ports from the provider and calls `run`. Throws `SdkDefinitionError` for an id that names no action (`isActionId`).
 */
export const defineAction = <I extends PropsSchema, P extends PortMap>(
    config: ActionConfig | RunActionConfig<I, P>,
): ActionDefinition => {
    assertActionId(config.id)
    if (!("run" in config)) return { ...config, entry: "action" }
    const { run, ...rest } = config
    return {
        ...rest,
        operation: config.id,
        entry: "action",
        transactional: config.transactional ?? false,
        optimistic: config.optimistic ?? false,
        execute: async (provider, raw, context) => {
            const parsed = parseStrict(config.input, raw)
            if (!parsed.ok) return invalidResult(parsed.problems)
            const result = await run(portsOf(provider, config.ports), parsed.value, context)
            return result
        },
    }
}
