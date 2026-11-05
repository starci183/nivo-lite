import type { FieldKind } from "./entity.types"

/** The role the entity engine runs as (plan section 2.7). */
export const ENGINE_ROLE = "app_engine"

/** Postgres cuts identifiers at 63 bytes; a longer generated name would never be found again in the catalog. */
export const IDENT_MAX = 63

/** The base tables of the records model. */
export const BASE_TABLES: ReadonlyArray<string> = ["records", "record_links", "entity_sequences"]

/** Cut a generated identifier at the 63 bytes postgres keeps. */
export const identOf = (text: string): string => text.slice(0, IDENT_MAX)

/** Snake case of a name: `sales.lead` is `sales_lead`, `updatedAt` is `updated_at`. */
export const snakeOf = (text: string): string =>
    text
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toLowerCase()

/**
 * The partition table of an entity: `records_<snake>`, cut at 63 bytes.
 * Mirrors E1's `partitionNameOf` until it lands on the entity branch; switch the import then.
 */
export const partitionNameOf = (entity: string): string => identOf(`records_${snakeOf(entity)}`)

/** The typed view of a partition: `v_<partition>`. */
export const viewNameOf = (partition: string): string => identOf(`v_${partition}`)

/** The four commands an engine policy covers. */
export type EngineCommand = "select" | "insert" | "update" | "delete"

export const POLICY_COMMANDS: ReadonlyArray<EngineCommand> = ["select", "insert", "update", "delete"]

/** The name of the engine policy of a base table for one command. */
export const policyNameOf = (table: string, command: EngineCommand): string => identOf(`${table}_app_engine_${command}`)

/** The object ids a `PlanOp` carries. */
export const tableId = (table: string): string => `public.${table}`

/** The object id of an index, constraint, policy or grant of a table. */
export const partId = (table: string, part: "index" | "constraint" | "policy" | "grant", name: string): string =>
    `public.${table}:${part}:${name}`

/** The pg type each field kind is cast to (and a view column has). */
export const PG_TYPE: Readonly<Record<FieldKind, string>> = {
    uuid: "uuid",
    text: "text",
    int: "integer",
    bigint: "bigint",
    bool: "boolean",
    timestamptz: "timestamp with time zone",
    date: "date",
    jsonb: "jsonb",
    enum: "text",
    money_vnd: "bigint",
    sequence: "text",
}

/** The type name of a `format_type` text without its modifier; `character varying` reads as `text`. */
export const baseTypeOf = (type: string): string =>
    type.toLowerCase().split("(", 1).join("").trim().replace("character varying", "text")

/** Whether a catalog `format_type` text is the type a field kind is cast to (`character varying(80)` is a text). */
export const typeMatches = (kind: FieldKind, type: string): boolean => {
    return baseTypeOf(type) === PG_TYPE[kind]
}

const CAST = /::[a-z_][a-z0-9_]*/g
const CAST_WORDS = /\s(?:varying|with time zone|without time zone)/g
const OPCLASS = /\s(?:gin_trgm_ops|gist_trgm_ops|jsonb_path_ops|jsonb_ops|text_pattern_ops)/g

/** Lower-case SQL text without schema prefix, casts, operator classes, quoting, parentheses and blanks, so two spellings of one expression compare equal. */
export const normalizeSql = (text: string): string =>
    text
        .toLowerCase()
        .replace(/(?:public|extensions)\./g, "")
        .replace(CAST, "")
        .replace(CAST_WORDS, "")
        .replace(/\[\]/g, "")
        .replace(OPCLASS, "")
        .replace(/["()\s]/g, "")

/** The quoted literals of a CHECK definition: the values an enum field may take. */
export const literalsOf = (definition: string): ReadonlyArray<string> =>
    (definition.match(/'(?:[^']|'')*'/g) ?? []).map((quoted) => quoted.slice(1, -1).replace(/''/g, "'"))

/** The `<= n` bound of a CHECK definition (a text length), or null. */
export const limitOf = (definition: string): number | null => {
    const found = /<=\s*(\d+)/.exec(definition)
    return found?.[1] === undefined ? null : Number(found[1])
}
