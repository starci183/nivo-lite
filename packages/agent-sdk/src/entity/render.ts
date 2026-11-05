import type { PlanOp } from "./catalog.types"
import type { EntityDefinition } from "./entity.types"
import { expectedPolicies, expectedPrivileges } from "./plan-expect"
import { BASE_TABLES, ENGINE_ROLE, partitionNameOf, viewNameOf } from "./plan-names"
import { type DdlPiece, checkPieces, excludePieces, indexPieces, viewPiece } from "./render-ddl"
import { EntityRenderError, type RenderErrorCode } from "./render-error"
import { quoteIdent, quoteLiteral } from "./render-sql"

/** A step the migration could not be written for. */
export interface RenderProblem {
    /** The object of the step, or the stamp. */
    readonly object: string
    /** Why. */
    readonly code: RenderErrorCode | "ENTITY_RENDER_DESTRUCTIVE" | "ENTITY_RENDER_EMPTY" | "ENTITY_RENDER_STAMP_INVALID"
}

/** The migration text and the file it belongs in, or the steps it was refused for. */
export type RenderedMigration =
    | { readonly ok: true; readonly file: string; readonly sql: string }
    | { readonly ok: false; readonly problems: ReadonlyArray<RenderProblem> }

/** How to write a migration: a contract migration may carry the steps that drop or narrow. */
export interface RenderOptions {
    /** Allow non-additive steps; the file is then named `*_contract_*` (R259). */
    readonly contract?: true
}

/** The parts of a step's object id. */
interface Target {
    readonly table: string
    readonly part: string | null
    readonly name: string
}

const TABLE_PREFIX = "public."

const targetOf = (object: string): Target => {
    const [first = "", part = null, name = ""] = object.split(":")
    const table = first.startsWith(TABLE_PREFIX) ? first.slice(TABLE_PREFIX.length) : first
    return part === null ? { table, part: null, name: table } : { table, part, name }
}

const unsupported = (object: string): EntityRenderError => new EntityRenderError("ENTITY_RENDER_OP_UNSUPPORTED", object)

const tableSql = (table: string): string => `public.${quoteIdent(table)}`

/** The piece of an entity's partition with this name, or a refusal. */
const pieceOf = (pieces: ReadonlyArray<DdlPiece>, name: string, object: string): DdlPiece => {
    const found = pieces.find((piece) => piece.name === name)
    if (found === undefined) throw unsupported(object)
    return found
}

const policySql = (table: string, name: string, object: string): ReadonlyArray<string> => {
    const want = expectedPolicies(table).find((policy) => policy.name === name)
    if (want === undefined) throw unsupported(object)
    const predicate = "workspace_id = public.engine_workspace()"
    return [
        `CREATE POLICY ${quoteIdent(name)} ON ${tableSql(table)} FOR ${want.command.toUpperCase()} TO ${ENGINE_ROLE}` +
            (want.qual === null ? "" : ` USING (${predicate})`) +
            (want.check === null ? "" : ` WITH CHECK (${predicate})`),
    ]
}

const grantSql = (table: string): string =>
    `GRANT ${expectedPrivileges.join(", ").toUpperCase()} ON TABLE ${tableSql(table)} TO ${ENGINE_ROLE}`

/** The DDL statements of one plan step (without a trailing semicolon); throws `EntityRenderError` for a step it cannot write. */
export const renderOp = (op: PlanOp, entities: ReadonlyArray<EntityDefinition>): ReadonlyArray<string> => {
    const { table, name } = targetOf(op.object)
    const entity = entities.find(
        (candidate) =>
            partitionNameOf(candidate.name) === table || viewNameOf(partitionNameOf(candidate.name)) === table,
    )
    const own = (): EntityDefinition => {
        if (entity === undefined) throw unsupported(op.object)
        return entity
    }
    const viewOf = (): DdlPiece => {
        const piece = viewPiece(own())
        if (piece === null) throw unsupported(op.object)
        return piece
    }
    const dropConstraint = (): string => `ALTER TABLE ${tableSql(table)} DROP CONSTRAINT ${quoteIdent(name)}`
    switch (op.kind) {
        case "create_extension":
            return [
                `CREATE EXTENSION IF NOT EXISTS ${quoteIdent(op.object.replace("extension:", ""))} WITH SCHEMA extensions`,
            ]
        case "enable_rls":
        case "force_rls":
            if (!BASE_TABLES.includes(table)) throw unsupported(op.object)
            return [
                `ALTER TABLE ${tableSql(table)} ${op.kind === "enable_rls" ? "ENABLE" : "FORCE"} ROW LEVEL SECURITY`,
            ]
        case "create_policy":
            return policySql(table, name, op.object)
        case "alter_policy":
            return [`DROP POLICY ${quoteIdent(name)} ON ${tableSql(table)}`, ...policySql(table, name, op.object)]
        case "grant":
            return [grantSql(table)]
        case "revoke":
            return [`REVOKE ALL ON TABLE ${tableSql(table)} FROM ${ENGINE_ROLE}`, grantSql(table)]
        case "create_partition":
            return [
                `CREATE TABLE ${tableSql(table)} PARTITION OF public.records FOR VALUES IN (${quoteLiteral(own().name)})`,
            ]
        case "add_check":
            return pieceOf(checkPieces(own()), name, op.object).statements
        case "replace_check":
        case "narrow_check":
            return [dropConstraint(), ...pieceOf(checkPieces(own()), name, op.object).statements]
        case "validate_constraint":
            return [`ALTER TABLE ${tableSql(table)} VALIDATE CONSTRAINT ${quoteIdent(name)}`]
        case "add_exclude":
            return pieceOf(excludePieces(own()), name, op.object).statements
        case "create_index":
        case "add_unique":
            return pieceOf(indexPieces(own()), name, op.object).statements
        case "alter_index":
            return [`DROP INDEX public.${quoteIdent(name)}`, ...pieceOf(indexPieces(own()), name, op.object).statements]
        case "drop_constraint":
            return [dropConstraint()]
        case "drop_index":
            return [`DROP INDEX public.${quoteIdent(name)}`]
        case "drop_partition":
            return [`ALTER TABLE public.records DETACH PARTITION ${tableSql(table)}`, `DROP TABLE ${tableSql(table)}`]
        case "create_view":
            return viewOf().statements
        case "alter_view":
            return [`DROP VIEW ${tableSql(table)}`, ...viewOf().statements]
        case "drop_view":
            return [`DROP VIEW ${tableSql(table)}`]
        case "base_missing":
        case "declaration_mismatch":
            throw unsupported(op.object)
    }
}

const STAMP = /^\d{14}$/

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim()

/**
 * The migration file for a plan: header, then one commented block per step; no transaction control (BE-PERSISTENCE-1, R213).
 * A destructive step is refused unless `contract` is set, and then the file is named `*_contract_*` (R259).
 * Identifiers come from validated names only, literals are escaped; a step that cannot be written refuses the whole file.
 */
export const renderMigration = (
    ops: ReadonlyArray<PlanOp>,
    entities: ReadonlyArray<EntityDefinition>,
    stamp: string,
    options: RenderOptions = {},
): RenderedMigration => {
    if (!STAMP.test(stamp)) return { ok: false, problems: [{ object: stamp, code: "ENTITY_RENDER_STAMP_INVALID" }] }
    if (ops.length === 0) return { ok: false, problems: [{ object: "plan", code: "ENTITY_RENDER_EMPTY" }] }
    const blocked = options.contract === true ? [] : ops.filter((op) => !op.additive)
    if (blocked.length > 0) {
        return { ok: false, problems: blocked.map((op) => ({ object: op.object, code: "ENTITY_RENDER_DESTRUCTIVE" })) }
    }
    const problems: Array<RenderProblem> = []
    const blocks: Array<string> = []
    for (const op of ops) {
        try {
            const statements = renderOp(op, entities)
            blocks.push(
                [
                    `-- ${op.kind} ${oneLine(op.object)}: ${oneLine(op.reason)}`,
                    ...statements.map((sql) => `${sql};`),
                ].join("\n"),
            )
        } catch (error) {
            if (!(error instanceof EntityRenderError)) throw error
            problems.push({ object: op.object, code: error.code })
        }
    }
    if (problems.length > 0) return { ok: false, problems }
    const slug = options.contract === true ? "entity-engine-partitions_contract_drop" : "entity-engine-partitions"
    const header = [
        "-- entity-engine partitions: generated by `cli entities plan --write`; forward-only; immutable once on origin/main.",
        "-- Reviewed like a hand-written migration. No transaction control.",
    ]
    return { ok: true, file: `${stamp}_${slug}.sql`, sql: `${[...header, "", ...blocks].join("\n")}\n` }
}
