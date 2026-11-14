import type { z } from "../schema/zod-entry"
import type { Namespaced, SpecText } from "../schema/schema.types"

/** What `defineEffect` takes: a change a node may ask of the world and the payload it carries. */
export interface EffectConfig<P extends z.ZodType> {
    /** The namespaced id nodes and grants name the effect by. */
    readonly id: Namespaced
    /** The words that name the effect for a person. */
    readonly title: SpecText
    /**
     * The zod schema the effect's payload is parsed against before the host runs it, and the only shape a MODEL's call of the effect
     * may take: what an agent is shown, and what the gateway and the agent loop check its call against.
     */
    readonly payload: P
    /**
     * A wider shape that only package CODE may post (a node's own `run`, never a call the model typed): a finished card the step built
     * from its records. Absent: code posts the `payload` shape. A model's call is never checked against this schema, so no amount or
     * record a step built can be typed by a model.
     */
    readonly codePayload?: z.ZodType | undefined
}

/** A validated effect as `defineEffect` returns it: the config plus the tag a module list reads it by. */
export interface EffectDefinition<P extends z.ZodType = z.ZodType> extends EffectConfig<P> {
    /** The tag that tells an effect definition from a tool or a data kind in a module's list. */
    readonly entry: "effect"
}

/**
 * What `defineTool` takes: a NIVO MCP tool a node may call, named by capability (`payment.quote`), never by provider. The host
 * routes it through the NIVO MCP door to whatever provider the workspace connected.
 */
export interface ToolConfig<A extends z.ZodType, R extends z.ZodType> {
    /** The namespaced id nodes and grants name the tool by. */
    readonly id: Namespaced
    /** The words that name the tool for a person. */
    readonly title: SpecText
    /** The zod schema the call's arguments are parsed against before the call. */
    readonly args: A
    /** The zod schema the tool's answer is parsed against before a node sees it. */
    readonly result: R
    /** True when a call changes the world; a condition node may only call tools that do not. */
    readonly mutates: boolean
}

/** A validated tool as `defineTool` returns it: the config plus the tag a module list reads it by. */
export interface ToolDefinition<A extends z.ZodType = z.ZodType, R extends z.ZodType = z.ZodType> extends ToolConfig<
    A,
    R
> {
    /** The tag that tells a tool definition from an effect or a data kind in a module's list. */
    readonly entry: "tool"
}

/** What `defineDataKind` takes: a kind of record the host's data ports serve, and its fields. */
export interface DataKindConfig<F extends z.ZodObject> {
    /** Kebab-case, not namespaced: the name a data port is registered under (`order`, `sales-lead`). */
    readonly kind: string
    /** The words that name the kind of record for a person. */
    readonly title: SpecText
    /** The zod object of the record's fields. */
    readonly fields: F
}

/** A validated data kind as `defineDataKind` returns it: the config and the tag. */
export interface DataKindDefinition<F extends z.ZodObject = z.ZodObject> extends DataKindConfig<F> {
    /** The tag that tells a data kind definition from an effect or a tool in a module's list. */
    readonly entry: "data-kind"
}
