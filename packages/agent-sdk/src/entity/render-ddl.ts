import type { EntityDefinition, FieldDef, IndexPart } from "./entity.types"
import { identOf, snakeOf, viewNameOf } from "./plan-names"
import { partitionNameOf } from "./partition-name"
import { EntityRenderError } from "./render-error"
import { exprOf, filterSql, jsonOf, keyExprOf, quoteIdent, quoteLiteral, textOf } from "./render-sql"

/** A named piece of DDL: the statements that create it. */
export interface DdlPiece {
    /** The object name (constraint, index or view). */
    readonly name: string
    /** The statements, each ending without a semicolon. */
    readonly statements: ReadonlyArray<string>
}

const UUID = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
const TIMESTAMP = "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$"
const DATE = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"

const typedCheck = (name: string, field: FieldDef): string => {
    const key = quoteLiteral(name)
    const text = textOf(name)
    const typeIs = (type: string): string => `jsonb_typeof(data->${key}) = ${quoteLiteral(type)}`
    switch (field.kind) {
        case "text":
        case "sequence":
            return field.maxLength === undefined
                ? typeIs("string")
                : `${typeIs("string")} AND char_length(${text}) <= ${field.maxLength}`
        case "int":
            return `${typeIs("number")} AND ${text} ~ '^-?[0-9]{1,10}$'`
        case "bigint":
        case "money_vnd":
            return `${typeIs("number")} AND ${text} ~ '^-?[0-9]{1,19}$'`
        case "bool":
            return typeIs("boolean")
        case "uuid":
            return `${text} ~ ${quoteLiteral(UUID)}`
        case "timestamptz":
            return `${text} ~ ${quoteLiteral(TIMESTAMP)}`
        case "date":
            return `${text} ~ ${quoteLiteral(DATE)}`
        case "jsonb":
            return typeIs("object")
        case "enum":
            if (field.of === undefined) throw new EntityRenderError("ENTITY_RENDER_VALUE_INVALID", name)
            return `${text} IN (${field.of.map((literal) => quoteLiteral(literal)).join(", ")})`
    }
}

/** The CHECK of one field: absent or null only when nullable, otherwise of the declared kind (enum values and text length included). */
export const fieldCheckSql = (name: string, field: FieldDef): string => {
    const text = textOf(name)
    const typed = typedCheck(name, field)
    return field.nullable ? `${text} IS NULL OR (${typed})` : `${text} IS NOT NULL AND (${typed})`
}

const addCheck = (partition: string, name: string, expression: string): ReadonlyArray<string> => [
    `ALTER TABLE public.${quoteIdent(partition)} ADD CONSTRAINT ${quoteIdent(name)} CHECK (${expression}) NOT VALID`,
    `ALTER TABLE public.${quoteIdent(partition)} VALIDATE CONSTRAINT ${quoteIdent(name)}`,
]

/** Every CHECK of an entity's partition: one per field and each declared check, by constraint name. */
export const checkPieces = (entity: EntityDefinition): ReadonlyArray<DdlPiece> => {
    const partition = partitionNameOf(entity.name)
    return [
        ...Object.entries(entity.fields).map(([name, field]) => {
            const constraint = identOf(`${partition}_${snakeOf(name)}_chk`)
            return { name: constraint, statements: addCheck(partition, constraint, fieldCheckSql(name, field)) }
        }),
        ...(entity.constraints ?? []).flatMap((declared) => {
            if (declared.kind !== "check") return []
            const constraint = identOf(`${partition}_${declared.name}`)
            return [{ name: constraint, statements: addCheck(partition, constraint, filterSql(entity, declared.expr)) }]
        }),
    ]
}

/** The EXCLUDE constraints of an entity's partition: equal fields, and no overlapping [from, to] range inside a workspace. */
export const excludePieces = (entity: EntityDefinition): ReadonlyArray<DdlPiece> => {
    const partition = partitionNameOf(entity.name)
    return (entity.constraints ?? []).flatMap((declared) => {
        if (declared.kind !== "noOverlap") return []
        const name = identOf(`${partition}_${declared.name}`)
        const elements = [
            "workspace_id WITH =",
            ...declared.equal.map((field) => `${exprOf(entity, field)} WITH =`),
            `tstzrange(public.engine_ts(${textOf(declared.range[0])}), public.engine_ts(${textOf(declared.range[1])})) WITH &&`,
        ]
        const where = declared.where === undefined ? "" : ` WHERE (${filterSql(entity, declared.where)})`
        return [
            {
                name,
                statements: [
                    `ALTER TABLE public.${quoteIdent(partition)} ADD CONSTRAINT ${quoteIdent(name)} EXCLUDE USING gist (${elements.join(", ")})${where}`,
                ],
            },
        ]
    })
}

const partSql = (entity: EntityDefinition, part: IndexPart): string => {
    if (typeof part === "string") return exprOf(entity, part)
    if ("fold" in part) return `public.knowledge_fold(${textOf(part.fold)})`
    if ("desc" in part) return `${exprOf(entity, part.desc)} DESC`
    const [field, key] = part.key
    const kind = entity.fields[field]?.keys?.[key]?.kind ?? "text"
    return keyExprOf(field, key, kind)
}

/** What an index statement needs besides its name. */
interface IndexOptions {
    /** A unique index. */
    readonly unique: boolean
    /** The access method. */
    readonly method: string
    /** The index parts, SQL text. */
    readonly parts: ReadonlyArray<string>
    /** The WHERE clause with its leading space, or empty. */
    readonly where: string
}

const indexStatement = (partition: string, name: string, options: IndexOptions): string =>
    `CREATE ${options.unique ? "UNIQUE " : ""}INDEX ${quoteIdent(name)} ON public.${quoteIdent(partition)} USING ${options.method} (${options.parts.join(", ")})${options.where}`

/** Every index of an entity's partition: declared indexes and uniques, trigram, nested-key expression and free-key GIN indexes. */
export const indexPieces = (entity: EntityDefinition): ReadonlyArray<DdlPiece> => {
    const partition = partitionNameOf(entity.name)
    const where = (filter: Parameters<typeof filterSql>[1] | undefined): string =>
        filter === undefined ? "" : ` WHERE ${filterSql(entity, filter)}`
    const piece = (name: string, options: IndexOptions): DdlPiece => ({
        name: identOf(name),
        statements: [indexStatement(partition, identOf(name), options)],
    })
    return [
        ...(entity.indexes ?? []).map((index) =>
            piece(`${partition}_${index.name}`, {
                unique: index.unique === true,
                method: index.using ?? "btree",
                parts: ["workspace_id", ...index.on.map((part) => partSql(entity, part))],
                where: where(index.where),
            }),
        ),
        ...(entity.constraints ?? []).flatMap((declared) =>
            declared.kind === "unique"
                ? [
                      piece(`${partition}_${declared.name}`, {
                          unique: true,
                          method: "btree",
                          parts: ["workspace_id", ...declared.on.map((field) => exprOf(entity, field))],
                          where: where(declared.where),
                      }),
                  ]
                : [],
        ),
        ...Object.entries(entity.fields).flatMap(([name, field]) => [
            ...(field.searchable === true
                ? [
                      piece(`${partition}_${snakeOf(name)}_trgm_idx`, {
                          unique: false,
                          method: "gin",
                          parts: [`public.knowledge_fold(${textOf(name)}) extensions.gin_trgm_ops`],
                          where: "",
                      }),
                  ]
                : []),
            ...Object.entries(field.keys ?? {})
                .filter(([, key]) => key.filter === true || key.sort === true)
                .map(([key, def]) =>
                    piece(`${partition}_${snakeOf(name)}_${snakeOf(key)}_idx`, {
                        unique: false,
                        method: "btree",
                        parts: ["workspace_id", keyExprOf(name, key, def.kind)],
                        where: "",
                    }),
                ),
            ...(field.freeKeys === true
                ? [
                      piece(`${partition}_${snakeOf(name)}_gin_idx`, {
                          unique: false,
                          method: "gin",
                          parts: [jsonOf(name)],
                          where: "",
                      }),
                  ]
                : []),
        ]),
    ]
}

/** A view column keeps the real time types (a view needs no immutable cast). */
const viewExprOf = (entity: EntityDefinition, name: string, field: FieldDef): string => {
    if (field.kind === "timestamptz") return `(${textOf(name)}::timestamptz)`
    if (field.kind === "date") return `(${textOf(name)}::date)`
    return exprOf(entity, name)
}

/** The typed view of an entity: security invoker, reading the parent so row level security applies. */
export const viewPiece = (entity: EntityDefinition): DdlPiece | null => {
    if (entity.view !== true) return null
    const name = viewNameOf(partitionNameOf(entity.name))
    const columns = [
        "id",
        "workspace_id",
        "version",
        "created_at",
        "updated_at",
        ...Object.entries(entity.fields).map(
            ([name, field]) => `${viewExprOf(entity, name, field)} AS ${quoteIdent(snakeOf(name))}`,
        ),
    ]
    return {
        name,
        statements: [
            `CREATE VIEW public.${quoteIdent(name)} WITH (security_invoker = true) AS SELECT ${columns.join(", ")} FROM public.records WHERE entity = ${quoteLiteral(entity.name)}`,
            `GRANT SELECT ON TABLE public.${quoteIdent(name)} TO app_engine`,
        ],
    }
}
