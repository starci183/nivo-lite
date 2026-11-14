import type { ZodType } from "zod"
import type { AnyEntityDefinition } from "./entity-any.types"
import { EntityDefinitionError } from "./entity-error"
import { entityLocalProblems } from "./entity-problems"
import type {
    ContactDeleteRule,
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

/** Options of a file field. */
interface FileOptions {
    /** The content types accepted, exact (`image/png`) or a family (`image/*`). */
    readonly accept: readonly [string, ...Array<string>]
    /** The largest object accepted, in bytes. */
    readonly maxBytes: number
}

/** Options of a list file field: the file options and the most files the list holds. */
interface FileListOptions extends FileOptions {
    /** The field holds an ordered list of references. */
    readonly many: true
    /** The most references the list holds. */
    readonly max: number
}

/** The list form of a file field: never null, an empty list when nothing is attached. */
type FileListField = FieldDef<"file", false> & { readonly many: true }

/**
 * A reference to one object of the core's file store (`FileRef`: key, content type, size, name), never its bytes. Always nullable
 * and with no default: the object is uploaded for a record that exists, so a record is created without it and the confirmed
 * reference is written after. With `many: true` and `max` the field holds an ordered list of references (`FileRef[]`, at most `max`,
 * each object once), never null and an empty list by default.
 */
function file(options: FileListOptions): FileListField
function file(options: FileOptions): FieldDef<"file", true>
function file(options: FileOptions | FileListOptions): FieldDef<"file", true> | FileListField {
    if ("many" in options) {
        return {
            kind: "file",
            nullable: false,
            accept: options.accept,
            maxBytes: options.maxBytes,
            many: true,
            max: options.max,
            default: "empty",
        }
    }
    return { kind: "file", nullable: true, accept: options.accept, maxBytes: options.maxBytes }
}

/** Options of a contact field. */
interface ContactOptions<N extends boolean> {
    /** The record may point at no contact. */
    readonly nullable?: N
    /** What deleting the contact does to the record: `erase` it (the default), or `clear` the field (a nullable field only). */
    readonly onContactDelete?: ContactDeleteRule
}

function contact(options: ContactOptions<true> & { readonly nullable: true }): FieldDef<"contact", true>
function contact(options?: ContactOptions<false>): FieldDef<"contact", false>
/**
 * The id of a core contact (`contacts`, never a record): the engine proves on every write that the contact is one of the workspace's
 * (and stores the id it stands for now), erases or clears the record when the contact is deleted, and a filter on it follows a merge
 * (the ids merged into the contact match too). No default: the id is always the caller's.
 */
function contact(options?: ContactOptions<boolean>): FieldDef<"contact", boolean> {
    return {
        kind: "contact",
        nullable: options?.nullable === true,
        ...(options?.onContactDelete === undefined ? {} : { onContactDelete: options.onContactDelete }),
    }
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
    /** A reference to one stored file, with the content types and size it accepts. */
    readonly file: typeof file
    /** The id of a core contact, erased or cleared with the contact. */
    readonly contact: typeof contact
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
    file,
    contact,
}

const freezeAll = (entity: AnyEntityDefinition): void => {
    for (const declared of Object.values(entity.fields)) {
        if (declared.accept !== undefined) Object.freeze(declared.accept)
        Object.freeze(declared)
    }
    Object.freeze(entity.fields)
    for (const list of [entity.indexes, entity.constraints, entity.matchKeys]) {
        if (list !== undefined) Object.freeze(list)
    }
    for (const part of [entity.relations, entity.projection]) {
        if (part !== undefined) Object.freeze(part)
    }
    if (entity.states !== undefined) {
        Object.freeze(entity.states.transitions)
        Object.freeze(entity.states)
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

/**
 * The records frame's name of the record type builder (`<package>.<agent>.<domain>`): the SAME function as `defineEntity`, one
 * implementation. New declarations use `defineRecordType`; existing ones keep `defineEntity` (no churn for a synonym).
 */
export const defineRecordType: typeof defineEntity = defineEntity
