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
}

/** An effect definition. */
export interface EffectDefinition<P extends z.ZodType = z.ZodType> extends EffectConfig<P> {
    readonly entry: "effect"
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
