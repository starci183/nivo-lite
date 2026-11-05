import type { ZodType } from "zod"
import type { AnyEntityDefinition } from "./entity-any.types"
import { EntityDefinitionError } from "./entity-error"
import { entityLocalProblems } from "./entity-problems"
import type {
    CustomKeyDef,
    EntityConfig,
    EntityDefinition,
    FieldDef,
    FieldDefault,
    FieldKind,
    FieldMap,
} from "./entity.types"
import type { SequenceReset } from "./sequence-format"

/** Options every builder takes. */
interface BaseOptions {
    /** The value the engine writes on insert when none is given. */
    readonly default?: FieldDefault
}

/**
 * The options of a builder: a nullable field must say `nullable: true`; leaving it out (or `false`) is a field that is not nullable.
 * A bare optional `nullable?: true` would let an options object without `nullable` match the nullable overload first.
 */
type Plain<N extends boolean> = BaseOptions &
    (N extends true ? { readonly nullable: true } : { readonly nullable?: false })

/** The field the options describe, with `nullable` made explicit. */
const built = <K extends FieldKind>(
    kind: K,
    options?: BaseOptions & { readonly nullable?: boolean },
): FieldDef<K, boolean> => ({
    ...options,
    kind,
    nullable: options?.nullable === true,
})

function uuid(options: Plain<true>): FieldDef<"uuid", true>
function uuid(options?: Plain<false>): FieldDef<"uuid", false>
function uuid(options?: Plain<boolean>): FieldDef<"uuid", boolean> {
    return built("uuid", options)
}

function int(options: Plain<true>): FieldDef<"int", true>
function int(options?: Plain<false>): FieldDef<"int", false>
function int(options?: Plain<boolean>): FieldDef<"int", boolean> {
    return built("int", options)
}

function bigint(options: Plain<true>): FieldDef<"bigint", true>
function bigint(options?: Plain<false>): FieldDef<"bigint", false>
function bigint(options?: Plain<boolean>): FieldDef<"bigint", boolean> {
    return built("bigint", options)
}

function bool(options: Plain<true>): FieldDef<"bool", true>
function bool(options?: Plain<false>): FieldDef<"bool", false>
function bool(options?: Plain<boolean>): FieldDef<"bool", boolean> {
    return built("bool", options)
}

function timestamptz(options: Plain<true>): FieldDef<"timestamptz", true>
function timestamptz(options?: Plain<false>): FieldDef<"timestamptz", false>
function timestamptz(options?: Plain<boolean>): FieldDef<"timestamptz", boolean> {
    return built("timestamptz", options)
}

function date(options: Plain<true>): FieldDef<"date", true>
function date(options?: Plain<false>): FieldDef<"date", false>
function date(options?: Plain<boolean>): FieldDef<"date", boolean> {
    return built("date", options)
}

function moneyVnd(options: Plain<true>): FieldDef<"money_vnd", true>
function moneyVnd(options?: Plain<false>): FieldDef<"money_vnd", false>
function moneyVnd(options?: Plain<boolean>): FieldDef<"money_vnd", boolean> {
    return built("money_vnd", options)
}

type TextOptions<N extends boolean> = Plain<N> & {
    /** Required: bounds the readers and the partition CHECK (R305). */
    readonly maxLength: number
    readonly searchable?: true
}

function text(options: TextOptions<true>): FieldDef<"text", true>
function text(options: TextOptions<false>): FieldDef<"text", false>
function text(options: TextOptions<boolean>): FieldDef<"text", boolean> {
    return built("text", options)
}

type EnumOptions<N extends boolean> = Plain<N> & { readonly of: readonly [string, ...Array<string>] }

function enumeration(options: EnumOptions<true>): FieldDef<"enum", true>
function enumeration(options: EnumOptions<false>): FieldDef<"enum", false>
function enumeration(options: EnumOptions<boolean>): FieldDef<"enum", boolean> {
    return built("enum", options)
}

type JsonbOptions<N extends boolean, S extends Readonly<Record<string, unknown>>> = Plain<N> & {
    /** Required: the declared shape readers and writers parse through. */
    readonly shape: ZodType<S>
    readonly keys?: Readonly<Record<string, CustomKeyDef>>
    readonly freeKeys?: true
}

function jsonb<S extends Readonly<Record<string, unknown>>>(
    options: JsonbOptions<true, S>,
): FieldDef<"jsonb", true> & { readonly shape: ZodType<S> }
function jsonb<S extends Readonly<Record<string, unknown>>>(
    options: JsonbOptions<false, S>,
): FieldDef<"jsonb", false> & { readonly shape: ZodType<S> }
function jsonb<S extends Readonly<Record<string, unknown>>>(
    options: JsonbOptions<boolean, S>,
): FieldDef<"jsonb", boolean> & { readonly shape: ZodType<S> } {
    return { ...built("jsonb", options), shape: options.shape }
}

/** Options of a sequence field. */
interface SequenceOptions {
    /** The display format, e.g. `DH-{yyyy}{mm}{dd}-{n:4}`. */
    readonly format: string
    /** The counter restarts per day, month or year; absent: never. */
    readonly resets?: SequenceReset
}

/** A per-workspace counter shown through a format (plan 9.3); the engine mints it, never the caller. */
function sequence(options: SequenceOptions): FieldDef<"sequence", false> {
    return { ...built("sequence"), ...options, nullable: false }
}

/** The field builders `field` exposes. */
interface FieldBuilders {
    /** A uuid value. */
    readonly uuid: typeof uuid
    /** A bounded text (`maxLength` required). */
    readonly text: typeof text
    /** A 32-bit integer. */
    readonly int: typeof int
    /** A 64-bit integer; travels as a decimal string. */
    readonly bigint: typeof bigint
    /** A boolean. */
    readonly bool: typeof bool
    /** A timestamp; travels as ISO text. */
    readonly timestamptz: typeof timestamptz
    /** A calendar date. */
    readonly date: typeof date
    /** A nested object with a declared zod shape and optional nested keys. */
    readonly jsonb: typeof jsonb
    /** A text closed to a list of values. */
    readonly enum: typeof enumeration
    /** A whole-dong amount. */
    readonly moneyVnd: typeof moneyVnd
    /** A per-workspace counter with a display format. */
    readonly sequence: typeof sequence
}

/** The field builders: `field.text({ maxLength: 200 })`; add `nullable: true` for a nullable field. A field has no column: it lives in `data`. */
export const field: FieldBuilders = {
    uuid,
    text,
    int,
    bigint,
    bool,
    timestamptz,
    date,
    jsonb,
    enum: enumeration,
    moneyVnd,
    sequence,
}

const freezeAll = (entity: AnyEntityDefinition): void => {
    for (const declared of Object.values(entity.fields)) Object.freeze(declared)
    Object.freeze(entity.fields)
    for (const list of [entity.indexes, entity.constraints, entity.matchKeys]) {
        if (list !== undefined) Object.freeze(list)
    }
    for (const part of [entity.relations, entity.projection]) {
        if (part !== undefined) Object.freeze(part)
    }
    Object.freeze(entity)
}

/**
 * Defines an entity: a frozen declaration the planner, the compiler and the readers share. Throws `EntityDefinitionError` at module
 * load for a problem that needs no other entity (name, reserved or malformed field names, field kinds, indexes, constraints, match
 * keys); the relation targets, projection sources and partition names are checked against the catalog by `entityProblems`.
 */
export const defineEntity = <F extends FieldMap>(config: EntityConfig<F>): EntityDefinition<F> => {
    const entity: EntityDefinition<F> = { ...config, entry: "entity" }
    const problems = entityLocalProblems(entity)
    const first = problems[0]
    if (first !== undefined) throw new EntityDefinitionError(first.code, `${first.entity}.${first.at}`, problems)
    freezeAll(entity)
    return entity
}
