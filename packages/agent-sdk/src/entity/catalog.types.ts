/**
 * What `public.engine_catalog()` reads from pg_catalog, as one jsonb document (plan sections 2.8 and 11): the three base
 * tables of the records model, the partitions of `public.records`, and the typed views `v_*`.
 * The planner diffs entity declarations against it; it holds no SQL text the engine would run.
 */

export interface CatalogIndex {
    /** The index name. */
    readonly name: string
    /** One normalized entry per index column or expression, in order, e.g. `workspace_id`, `data->>'phone'`, `updated_at desc`. */
    readonly columns: ReadonlyArray<string>
    /** A unique index. */
    readonly unique: boolean
    /** The access method: `btree`, `gin`, `gist`. */
    readonly method: string
    /** The WHERE text of a partial index, or null. */
    readonly predicate: string | null
}

/** The kinds of constraint a partition can hold. */
export type CatalogConstraintKind = "primary" | "unique" | "check" | "foreign" | "exclude"

/** A constraint of a partition. */
export interface CatalogConstraint {
    /** The constraint name. */
    readonly name: string
    /** The kind of constraint. */
    readonly kind: CatalogConstraintKind
    /** `pg_get_constraintdef` text. */
    readonly definition: string
    /** False for a CHECK added NOT VALID and not yet validated. */
    readonly validated: boolean
}

/** The command a row level security policy covers. */
export type CatalogPolicyCommand = "select" | "insert" | "update" | "delete" | "all"

/** A row level security policy of a base table. */
export interface CatalogPolicy {
    /** The policy name. */
    readonly name: string
    /** The roles it applies to. */
    readonly roles: ReadonlyArray<string>
    /** The command it covers. */
    readonly command: CatalogPolicyCommand
    /** Permissive (true) or restrictive. */
    readonly permissive: boolean
    /** The USING text, or null. */
    readonly qual: string | null
    /** The WITH CHECK text, or null. */
    readonly check: string | null
}

/** The table privileges one role holds. */
export interface CatalogGrant {
    /** The grantee role. */
    readonly role: string
    /** Table privileges, e.g. `select`, `insert`, `update`, `delete`. */
    readonly privileges: ReadonlyArray<string>
}

/** One of the base tables `records`, `record_links`, `entity_sequences`: listed only when it exists. */
export interface CatalogBase {
    /** The table name. */
    readonly name: string
    /** Row level security is enabled. */
    readonly rlsEnabled: boolean
    /** Row level security is forced for the owner. */
    readonly rlsForced: boolean
    /** Its policies. */
    readonly policies: ReadonlyArray<CatalogPolicy>
    /** Its table grants. */
    readonly grants: ReadonlyArray<CatalogGrant>
}

/** A partition of `public.records`. */
export interface CatalogPartition {
    /** The partition table name, `records_<snake>`. */
    readonly name: string
    /** The `FOR VALUES IN` value: the entity name. */
    readonly bound: string
    /** Its constraints. */
    readonly constraints: ReadonlyArray<CatalogConstraint>
    /** Its indexes (expression and partial ones included). */
    readonly indexes: ReadonlyArray<CatalogIndex>
}

/** One column of a typed view. */
export interface CatalogViewColumn {
    /** The view column name. */
    readonly name: string
    /** `format_type` text. */
    readonly type: string
}

/** A typed view `v_*`. */
export interface CatalogView {
    /** The view name. */
    readonly name: string
    /** Its columns, in order. */
    readonly columns: ReadonlyArray<CatalogViewColumn>
}

/** The live catalog the planner diffs against: base tables, partitions, views, extensions. */
export interface CatalogSnapshot {
    /** Installed extension names, e.g. `pg_trgm`, `btree_gist`. */
    readonly extensions: ReadonlyArray<string>
    /** The base tables that exist. */
    readonly bases: ReadonlyArray<CatalogBase>
    /** Every partition of records. */
    readonly partitions: ReadonlyArray<CatalogPartition>
    /** Every view named `v_*`. */
    readonly views: ReadonlyArray<CatalogView>
}

/** What a plan step does. */
export type PlanOpKind =
    | "create_extension"
    | "base_missing"
    | "enable_rls"
    | "force_rls"
    | "create_policy"
    | "alter_policy"
    | "grant"
    | "revoke"
    | "create_partition"
    | "add_check"
    | "replace_check"
    | "narrow_check"
    | "validate_constraint"
    | "add_unique"
    | "add_exclude"
    | "drop_constraint"
    | "create_index"
    | "alter_index"
    | "drop_index"
    | "drop_partition"
    | "create_view"
    | "alter_view"
    | "drop_view"
    | "declaration_mismatch"

/**
 * One step of a plan. `object` names what it touches: `public.<table>`, `public.<table>:index:<name>` (also
 * `constraint`, `policy`, `grant`), `public.<view>`, `extension:<name>`.
 */
export interface PlanOp {
    /** What the step does. */
    readonly kind: PlanOpKind
    /** What it touches. */
    readonly object: string
    /** False for dropping or narrowing a partition object, or a declaration the database contradicts. */
    readonly additive: boolean
    /** Why, in words. */
    readonly reason: string
}
