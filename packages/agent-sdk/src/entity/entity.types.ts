import type { ZodType } from "zod"
import type { Namespaced } from "../schema/schema.types"
import type { FilterExpr } from "../query/query.types"

/**
 * PINNED by the CORE-BE lead (2026-11-05). Copied verbatim into every wave-2 stream; only E1 (and the lead) change it, and a
 * change is announced in D:/starci-tmp/claude-20261105/lanes/CORE-BE.log.md before any stream codes against it.
 */

/** The kinds of field an entity declares. `sequence` is a per-workspace counter (plan section 9.3); `jsonb` carries a declared shape. */
export type FieldKind =
    "uuid" | "text" | "int" | "bigint" | "bool" | "timestamptz" | "date" | "jsonb" | "enum" | "money_vnd" | "sequence"

/** A field default the database applies. */
export type FieldDefault = "now" | "uuid" | "empty" | { readonly literal: string | number | boolean }

/** The scalar kind a custom (jsonb) key is cast to for filtering and sorting (plan section 10). */
export type CustomKeyKind = "text" | "int" | "bigint" | "bool" | "timestamptz" | "date" | "money_vnd"

/** One key of a jsonb field that a module filters or sorts on: the planner gives it an expression index. */
export interface CustomKeyDef {
    readonly kind: CustomKeyKind
    readonly filter?: true
    readonly sort?: true
}

/** A declared field of an entity. */
export interface FieldDef<K extends FieldKind = FieldKind, N extends boolean = boolean> {
    readonly kind: K
    /** The snake_case column name. */
    readonly column: string
    readonly nullable: N
    /** text: bounds the readers (R305); required for text. */
    readonly maxLength?: number
    /** enum: the allowed values (a CHECK in the migration, z.enum in the readers). */
    readonly of?: readonly [string, ...string[]]
    readonly default?: FieldDefault
    /** id / createdAt / updatedAt: set by the database, never written by the engine. */
    readonly generated?: "db"
    /** text: a trigram index on public.knowledge_fold(column). */
    readonly searchable?: true
    /** sequence: the display format, `{n:<width>}` the counter, `{yyyy}` `{mm}` the creation date, e.g. `DH-{yyyy}-{n:5}`. */
    readonly format?: string
    /** jsonb: the keys filtered or sorted on, each with its cast (plan section 10). */
    readonly keys?: Readonly<Record<string, CustomKeyDef>>
    /** jsonb: the declared shape of the value (required for jsonb); readers and writers parse through it. */
    readonly shape?: ZodType<Readonly<Record<string, unknown>>>
    /** jsonb: free-key filtering is declared, so the planner adds a GIN index on the column. */
    readonly freeKeys?: true
}

export type FieldMap = Readonly<Record<string, FieldDef>>

export interface RelationDef {
    readonly kind: "toOne" | "toMany"
    /** The target entity name. */
    readonly target: Namespaced
    /** toOne: the field of this entity holding the target key; toMany: the field of the target holding this key. */
    readonly via: string
    readonly onDelete?: "restrict" | "cascade" | "setNull"
}

/** An index part: a field, the fold of a text field, a descending field, or a custom jsonb key. */
export type IndexPart =
    string | { readonly fold: string } | { readonly desc: string } | { readonly key: readonly [string, string] }

export interface IndexDef {
    readonly name: string
    readonly on: ReadonlyArray<IndexPart>
    readonly unique?: true
    readonly where?: FilterExpr
    readonly using?: "btree" | "gin" | "gist"
}

export type ConstraintDef =
    | {
          readonly kind: "unique"
          readonly name: string
          readonly on: ReadonlyArray<string>
          readonly where?: FilterExpr
          readonly refusal: string
      }
    | { readonly kind: "check"; readonly name: string; readonly expr: FilterExpr; readonly refusal: string }
    | {
          readonly kind: "noOverlap"
          readonly name: string
          readonly equal: ReadonlyArray<string>
          readonly range: readonly [string, string]
          readonly where?: FilterExpr
          readonly refusal: string
      }

/** The declared match key an `ensure` finds by (plan section 9.2). */
export interface MatchKeyDef {
    readonly name: string
    /** Fields compared for equality, in order; nulls never match. */
    readonly on: readonly [string, ...string[]]
}

/** A projection entity is written only by declared jobs and rebuilt by a backfill job (plan section 9.5). */
export interface ProjectionDef {
    /** The entities whose writes feed it. */
    readonly sources: readonly [Namespaced, ...Namespaced[]]
}

export interface EntityConfig<F extends FieldMap> {
    readonly name: Namespaced
    readonly dataKind: string
    readonly table: { readonly schema: "public"; readonly name: string }
    /** The RLS key: the field holding the workspace id. Required. */
    readonly ownership: { readonly workspace: keyof F & string }
    readonly fields: F
    readonly key: keyof F & string
    /** The version token field; default `updatedAt` (Q4). */
    readonly version?: keyof F & string
    readonly relations?: Readonly<Record<string, RelationDef>>
    readonly indexes?: ReadonlyArray<IndexDef>
    readonly constraints?: ReadonlyArray<ConstraintDef>
    readonly matchKeys?: ReadonlyArray<MatchKeyDef>
    readonly projection?: ProjectionDef
    readonly deletable?: true
    /** Mapped onto a table a migration already created: the planner only adds to it. */
    readonly existing?: { readonly since: string }
}

/** A frozen entity declaration. */
export interface EntityDefinition<F extends FieldMap = FieldMap> extends EntityConfig<F> {
    readonly entry: "entity"
    readonly version: keyof F & string
}

type FieldValue<D extends FieldDef> = D["kind"] extends "int" | "money_vnd"
    ? number
    : D["kind"] extends "bool"
      ? boolean
      : D["kind"] extends "jsonb"
        ? D["shape"] extends ZodType<infer T>
            ? T
            : never
        : string

type Nullable<D extends FieldDef, V> = D["nullable"] extends true ? V | null : V

/** The row shape of an entity: field name to its value. `bigint` and `timestamptz` travel as strings (ISO text, Q4). */
export type RowOf<E> =
    E extends EntityDefinition<infer F> ? { readonly [K in keyof F]: Nullable<F[K], FieldValue<F[K]>> } : never

/** The codes `entityProblems` reports. */
export type EntityProblemCode =
    | "ENTITY_WORKSPACE_FIELD_MISSING"
    | "ENTITY_KEY_FIELD_MISSING"
    | "ENTITY_VERSION_FIELD_MISSING"
    | "ENTITY_RELATION_TARGET_UNKNOWN"
    | "ENTITY_RELATION_NOT_WORKSPACE_JOINED"
    | "ENTITY_INDEX_FIELD_UNKNOWN"
    | "ENTITY_COLUMN_DUPLICATE"
    | "ENTITY_TEXT_UNBOUNDED"
    | "ENTITY_ENUM_EMPTY"
    | "ENTITY_SEQUENCE_FORMAT_INVALID"
    | "ENTITY_CUSTOM_KEY_INVALID"
    | "ENTITY_JSONB_SHAPE_MISSING"
    | "ENTITY_MATCH_KEY_FIELD_UNKNOWN"
    | "ENTITY_PROJECTION_SOURCE_UNKNOWN"
    | "ENTITY_CONSTRAINT_FIELD_UNKNOWN"

export interface EntityProblem {
    readonly code: EntityProblemCode
    readonly entity: string
    readonly at: string
}
