import type { ZodType } from "zod"
import type { Namespaced } from "../schema/schema.types"
import type { FilterExpr } from "../query/query.types"

/*
 * PINNED v2 by the CORE-BE lead (2026-11-05, plan section 11: one `records` table, no legacy mapping). Copied verbatim into
 * every wave-2 stream; only E1 (and the lead) change it, announced in D:/starci-tmp/claude-20261105/lanes/CORE-BE.log.md first.
 * Every record has the system fields of `SYSTEM_FIELDS` (record columns, never in `data`); declared fields live in `data`.
 */

/** The record columns every entity has; their names are reserved and never declared as fields. */
export type SystemField = "id" | "workspaceId" | "version" | "createdAt" | "updatedAt"

/** The kinds of field an entity declares. `sequence` is a per-workspace counter (plan 9.3); `jsonb` carries a declared shape (plan 10). */
export type FieldKind =
    "uuid" | "text" | "int" | "bigint" | "bool" | "timestamptz" | "date" | "jsonb" | "enum" | "money_vnd" | "sequence"

/** A literal default the engine writes when a value is absent. */
export interface LiteralDefault {
    /** The literal value. */
    readonly literal: string | number | boolean
}

/** A field default: the transaction time, a fresh uuid, an empty value, or a literal. */
export type FieldDefault = "now" | "uuid" | "empty" | LiteralDefault

/** The scalar kind a nested jsonb key is cast to for filtering and sorting (plan 10). */
export type CustomKeyKind = "text" | "int" | "bigint" | "bool" | "timestamptz" | "date" | "money_vnd"

/** One nested key of a jsonb field that a module filters or sorts on: the planner gives it an expression index. */
export interface CustomKeyDef {
    /** The cast applied to the key. */
    readonly kind: CustomKeyKind
    /** Filtered on. */
    readonly filter?: true
    /** Sorted on. */
    readonly sort?: true
}

/** A declared field of an entity, stored under its field name in `records.data`. */
export interface FieldDef<K extends FieldKind = FieldKind, N extends boolean = boolean> {
    /** The kind (the partition CHECK casts `data->>'<name>'` to it). */
    readonly kind: K
    /** Whether the key may be absent or null. */
    readonly nullable: N
    /** text: bounds the readers (R305) and the partition CHECK; required for text. */
    readonly maxLength?: number
    /** enum: the allowed values (a partition CHECK, z.enum in the readers). */
    readonly of?: readonly [string, ...Array<string>]
    /** The default the engine writes on insert. */
    readonly default?: FieldDefault
    /** text: a trigram index on public.knowledge_fold(data->>'<name>'). */
    readonly searchable?: true
    /** sequence: the display format, `{n:<width>}` the counter, `{yyyy}` `{mm}` `{dd}` the creation date (workspace time zone). */
    readonly format?: string
    /** sequence: the counter restarts per `day`, `month` or `year`, or never. */
    readonly resets?: "day" | "month" | "year"
    /** jsonb: the declared shape of the value (required for jsonb). */
    readonly shape?: ZodType<Readonly<Record<string, unknown>>>
    /** jsonb: the nested keys filtered or sorted on, each with its cast. */
    readonly keys?: Readonly<Record<string, CustomKeyDef>>
    /** jsonb: free-key filtering is declared, so the planner adds a GIN index on that key. */
    readonly freeKeys?: true
}

/** The declared fields of an entity, by field name. */
export type FieldMap = Readonly<Record<string, FieldDef>>

/** A relation stored as `record_links` rows with real foreign keys to `records` (plan 11). */
export interface RelationDef {
    /** One target per record, or many. */
    readonly kind: "toOne" | "toMany"
    /** The target entity name. */
    readonly target: Namespaced
    /** toOne: a link must exist on insert. */
    readonly required?: true
    /** What deleting the target does to the link. */
    readonly onDelete?: "restrict" | "cascade"
}

/** A fold index part: public.knowledge_fold of a text field. */
export interface FoldPart {
    /** The text field. */
    readonly fold: string
}

/** A descending index part. */
export interface DescPart {
    /** The field, or a system field. */
    readonly desc: string
}

/** A nested jsonb key index part: `[field, key]`. */
export interface KeyPart {
    /** The jsonb field and its declared nested key. */
    readonly key: readonly [string, string]
}

/** An index part: a field or system field, a fold, a descending field, or a nested jsonb key. */
export type IndexPart = string | FoldPart | DescPart | KeyPart

/** An index of the entity's partition; `workspaceId` is always the leading part and is never written. */
export interface IndexDef {
    /** The index name suffix (the planner prefixes the partition name). */
    readonly name: string
    /** The parts after the workspace. */
    readonly on: ReadonlyArray<IndexPart>
    /** A unique index. */
    readonly unique?: true
    /** A partial index predicate. */
    readonly where?: FilterExpr
    /** The access method. */
    readonly using?: "btree" | "gin" | "gist"
}

/** A unique constraint inside one workspace; a violation answers `taken` with `refusal`. */
export interface UniqueConstraint {
    /** Discriminant. */
    readonly kind: "unique"
    /** The constraint name. */
    readonly name: string
    /** The fields, after the workspace. */
    readonly on: ReadonlyArray<string>
    /** A partial predicate. */
    readonly where?: FilterExpr
    /** The refusal code the action sees. */
    readonly refusal: string
}

/** A row check; a violation answers `invalid`. */
export interface CheckConstraint {
    /** Discriminant. */
    readonly kind: "check"
    /** The constraint name. */
    readonly name: string
    /** The predicate every row holds. */
    readonly expr: FilterExpr
    /** The refusal code the action sees. */
    readonly refusal: string
}

/** No two rows of one workspace overlap in time (btree_gist EXCLUDE); a violation answers `taken`. */
export interface NoOverlapConstraint {
    /** Discriminant. */
    readonly kind: "noOverlap"
    /** The constraint name. */
    readonly name: string
    /** Fields that must be equal for a clash, after the workspace. */
    readonly equal: ReadonlyArray<string>
    /** The [from, to] timestamptz fields. */
    readonly range: readonly [string, string]
    /** A partial predicate. */
    readonly where?: FilterExpr
    /** The refusal code the action sees. */
    readonly refusal: string
}

/** A declared constraint of an entity's partition. */
export type ConstraintDef = UniqueConstraint | CheckConstraint | NoOverlapConstraint

/** The declared match key an `ensure` finds by (plan 9.2). */
export interface MatchKeyDef {
    /** The match key name. */
    readonly name: string
    /** Fields compared for equality, in order; nulls never match. */
    readonly on: readonly [string, ...Array<string>]
}

/** A projection entity is written only by declared jobs and rebuilt by a backfill job (plan 9.5). */
export interface ProjectionDef {
    /** The entities whose writes feed it. */
    readonly sources: readonly [Namespaced, ...Array<Namespaced>]
}

/** What a module declares for one entity. */
export interface EntityConfig<F extends FieldMap> {
    /** `<module>.<thing>`; also the `records.entity` value and the partition name source. */
    readonly name: Namespaced
    /** The graph node data kind (rights grants are per kind). */
    readonly dataKind: string
    /** The declared fields, stored in `data`. */
    readonly fields: F
    /** Relations, as record_links. */
    readonly relations?: Readonly<Record<string, RelationDef>>
    /** Partition indexes. */
    readonly indexes?: ReadonlyArray<IndexDef>
    /** Partition constraints. */
    readonly constraints?: ReadonlyArray<ConstraintDef>
    /** Match keys for `ensure`. */
    readonly matchKeys?: ReadonlyArray<MatchKeyDef>
    /** Set for a projection entity. */
    readonly projection?: ProjectionDef
    /** Rows may be deleted. */
    readonly deletable?: true
    /** Generate a typed read-only view `v_<partition>` (reporting and hand queries). */
    readonly view?: true
}

/** A frozen entity declaration. */
export interface EntityDefinition<F extends FieldMap = FieldMap> extends EntityConfig<F> {
    /** Discriminant. */
    readonly entry: "entity"
}

/** The value a declared field carries in a row. */
type FieldValue<D extends FieldDef> = D["kind"] extends "int" | "money_vnd"
    ? number
    : D["kind"] extends "bool"
      ? boolean
      : D["kind"] extends "jsonb"
        ? D["shape"] extends ZodType<infer T>
            ? T
            : never
        : string

/** A value or null when the field is nullable. */
type Nullable<D extends FieldDef, V> = D["nullable"] extends true ? V | null : V

/** The system fields of every row: `version` travels as decimal text (bigint), times as ISO text. */
export interface SystemRow {
    /** The record id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspaceId: string
    /** The version token (plan 11: bumped by every write). */
    readonly version: string
    /** Creation time. */
    readonly createdAt: string
    /** Last write time. */
    readonly updatedAt: string
}

/** The row shape of an entity: the system fields plus each declared field. */
export type RowOf<E> =
    E extends EntityDefinition<infer F>
        ? SystemRow & { readonly [K in keyof F]: Nullable<F[K], FieldValue<F[K]>> }
        : never

/** The codes `entityProblems` reports. */
export type EntityProblemCode =
    | "ENTITY_NAME_INVALID"
    | "ENTITY_FIELD_RESERVED"
    | "ENTITY_FIELD_NAME_INVALID"
    | "ENTITY_RELATION_TARGET_UNKNOWN"
    | "ENTITY_INDEX_FIELD_UNKNOWN"
    | "ENTITY_TEXT_UNBOUNDED"
    | "ENTITY_ENUM_EMPTY"
    | "ENTITY_SEQUENCE_FORMAT_INVALID"
    | "ENTITY_CUSTOM_KEY_INVALID"
    | "ENTITY_JSONB_SHAPE_MISSING"
    | "ENTITY_MATCH_KEY_FIELD_UNKNOWN"
    | "ENTITY_PROJECTION_SOURCE_UNKNOWN"
    | "ENTITY_CONSTRAINT_FIELD_UNKNOWN"
    | "ENTITY_PARTITION_NAME_TAKEN"

/** One problem of a declaration. */
export interface EntityProblem {
    /** The code. */
    readonly code: EntityProblemCode
    /** The entity name. */
    readonly entity: string
    /** The path inside the declaration. */
    readonly at: string
}
