import type { z } from "../schema/zod.schema"
import type { DataRight } from "../rights/rights.types"
import type { Namespaced, SpecText } from "../schema/schema.types"

/** What `defineEffect` takes: a change a node may ask of the world, the payload it carries and the rights the agent needs for it. */
export interface EffectConfig<P extends z.ZodType> {
    /** The namespaced id nodes and grants name the effect by. */
    readonly id: Namespaced
    /** The words that name the effect for a person. */
    readonly title: SpecText
    /** The zod schema the effect's payload is parsed against before the host runs it. */
    readonly payload: P
    /** The agent's grant must cover these before any node may run the effect for it. */
    readonly rights: ReadonlyArray<DataRight>
    /**
     * The effect that undoes this one, given `{ id }` of the subject this one touched; it must be idempotent. Without one the effect is
     * a pivot: it cannot be undone, so a run that failed after it goes forward or to a person, never back.
     */
    readonly compensation?: Namespaced | undefined
}

/** A validated effect as `defineEffect` returns it: the config plus the tag a module list reads it by. */
export interface EffectDefinition<P extends z.ZodType = z.ZodType> extends EffectConfig<P> {
    /** The tag that tells an effect definition from a tool or a data kind in a module's list. */
    readonly entry: "effect"
}

/**
 * What `defineTool` takes: a NIVO MCP tool a node may call, named by capability (`payment.instruction`), never by provider. The host
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
    /** The agent's grant must cover these, besides naming the tool. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A validated tool as `defineTool` returns it: the config plus the tag a module list reads it by. */
export interface ToolDefinition<A extends z.ZodType = z.ZodType, R extends z.ZodType = z.ZodType> extends ToolConfig<
    A,
    R
> {
    /** The tag that tells a tool definition from an effect or a data kind in a module's list. */
    readonly entry: "tool"
}

/** What `defineDataKind` takes: a kind of record the host's data ports serve, and the fields a right may name. */
export interface DataKindConfig<F extends z.ZodObject> {
    /** Kebab-case, not namespaced: the name rights use (`order`, `sales-lead`). */
    readonly kind: string
    /** The words that name the kind of record for a person. */
    readonly title: SpecText
    /** The zod object of the record's fields; its keys are the names a right may list. */
    readonly fields: F
}

/** A validated data kind as `defineDataKind` returns it: the config, the tag and the field names rights are checked against. */
export interface DataKindDefinition<F extends z.ZodObject = z.ZodObject> extends DataKindConfig<F> {
    /** The tag that tells a data kind definition from an effect or a tool in a module's list. */
    readonly entry: "data-kind"
    /** The names of its fields. */
    readonly fieldNames: ReadonlyArray<string>
}
