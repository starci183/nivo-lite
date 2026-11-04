import type { z } from "zod"
import type { DataRight } from "../rights/rights.types"
import type { Namespaced, SpecText } from "../schema/schema.types"

/** What `defineEffect` takes: a change a node may ask of the world, the payload it carries and the rights the agent needs for it. */
export interface EffectConfig<P extends z.ZodType> {
    readonly id: Namespaced
    readonly title: SpecText
    readonly payload: P
    /** The agent's grant must cover these before any node may run the effect for it. */
    readonly rights: ReadonlyArray<DataRight>
    /**
     * The effect that undoes this one, given `{ id }` of the subject this one touched; it must be idempotent. Without one the effect is
     * a pivot: it cannot be undone, so a run that failed after it goes forward or to a person, never back.
     */
    readonly compensation?: Namespaced | undefined
}

/** An effect definition. */
export interface EffectDefinition<P extends z.ZodType = z.ZodType> extends EffectConfig<P> {
    readonly entry: "effect"
}

/**
 * What `defineTool` takes: a NIVO MCP tool a node may call, named by capability (`payment.instruction`), never by provider. The host
 * routes it through the NIVO MCP door to whatever provider the workspace connected.
 */
export interface ToolConfig<A extends z.ZodType, R extends z.ZodType> {
    readonly id: Namespaced
    readonly title: SpecText
    readonly args: A
    readonly result: R
    /** True when a call changes the world; a condition node may only call tools that do not. */
    readonly mutates: boolean
    /** The agent's grant must cover these, besides naming the tool. */
    readonly rights: ReadonlyArray<DataRight>
}

/** A tool definition. */
export interface ToolDefinition<A extends z.ZodType = z.ZodType, R extends z.ZodType = z.ZodType> extends ToolConfig<
    A,
    R
> {
    readonly entry: "tool"
}

/** What `defineDataKind` takes: a kind of record the host's data ports serve, and the fields a right may name. */
export interface DataKindConfig<F extends z.ZodObject> {
    /** Kebab-case, not namespaced: the name rights use (`order`, `sales-lead`). */
    readonly kind: string
    readonly title: SpecText
    readonly fields: F
}

/** A data kind definition. */
export interface DataKindDefinition<F extends z.ZodObject = z.ZodObject> extends DataKindConfig<F> {
    readonly entry: "data-kind"
    /** The names of its fields. */
    readonly fieldNames: ReadonlyArray<string>
}
