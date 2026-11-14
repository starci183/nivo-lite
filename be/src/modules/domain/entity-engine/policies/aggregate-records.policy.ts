import { returnedRows } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { AggregateRow, MeasureValue } from "@nivo-lite/agent-sdk/entity/port"
import type { Aggregate, MeasureKind } from "@nivo-lite/agent-sdk/query"
import { RecordEntity } from "../persistence/entities"
import { entityOf } from "./catalog-access.policy"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog } from "./compiler.contracts"
import { fieldExpression } from "./field-access.policy"
import { filterFragment, type FilterScope } from "./filter.policy"
import { paramBag } from "./param-bag.policy"
import { confinedAgentOf } from "./agent-scope.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** The SQL function of each measure kind. */
const MEASURE_FUNCTIONS: Readonly<Record<MeasureKind, string>> = {
    count: "COUNT",
    sum: "SUM",
    min: "MIN",
    max: "MAX",
    avg: "AVG",
}

/** The measure kinds whose answer is a number whatever the database type (bigint and numeric arrive as text). */
const NUMERIC_MEASURES: ReadonlySet<MeasureKind> = new Set<MeasureKind>(["count", "sum", "avg"])

const invalidColumn = (column: string): EntityEngineError =>
    new EntityEngineError({ code: EntityEngineErrorCode.ValueInvalid, params: { column } })

/** A returned column as text: dates become ISO text, numbers and booleans their text; null stays null; anything else is refused. */
const textColumn = (column: string, value: unknown): string | null => {
    if (value === null) return null
    if (value instanceof Date) return value.toISOString()
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    throw invalidColumn(column)
}

/** A count, sum or average: the database sends bigint and numeric as text, the answer is a number. */
const numberColumn = (column: string, value: unknown): number | null => {
    const text = textColumn(column, value)
    if (text === null) return null
    const number = Number(text)
    if (!Number.isFinite(number)) throw invalidColumn(column)
    return number
}

const measureValue = (column: string, kind: MeasureKind, value: unknown): MeasureValue =>
    NUMERIC_MEASURES.has(kind) ? numberColumn(column, value) : textColumn(column, value)

/**
 * An aggregate in one statement: GROUP BY the grouped fields and the time bucket (`date_trunc`), the measures as aggregate
 * functions with `FILTER (WHERE ...)` for a per-case count, ordered by the groups and limited. The group expressions are select
 * aliases the GROUP BY and ORDER BY name, so each is computed once.
 */
export const aggregateRecords = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    aggregate: Aggregate,
): Promise<Array<AggregateRow>> => {
    const entity = entityOf(catalog, aggregate.from)
    const params = paramBag("p")
    const builder = tx.manager.createQueryBuilder(RecordEntity, "r").select([])
    const scope: FilterScope = { catalog, entity, alias: "r", params, builder, depth: 0 }
    builder.where("r.entity = :entity AND r.workspaceId = :ws", { entity: entity.name, ws: tx.workspaceId })
    const agent = confinedAgentOf(tx)
    if (agent !== null) builder.andWhere("r.agentId = :agent", { agent })
    if (aggregate.where !== undefined) builder.andWhere(filterFragment(aggregate.where, scope))
    const bucket = aggregate.bucket
    const groups = [
        ...(aggregate.groupBy ?? []).map((field) => ({
            name: field,
            expression: fieldExpression(entity, field, "r", params),
        })),
        ...(bucket === undefined
            ? []
            : [
                  {
                      name: bucket.field,
                      expression: `date_trunc(CAST(:${params.bind(bucket.unit)} AS text), ${fieldExpression(entity, bucket.field, "r", params)})`,
                  },
              ]),
    ]
    groups.forEach(({ expression }, index) => {
        const alias = `g${String(index)}`
        builder.addSelect(expression, alias).addGroupBy(alias).addOrderBy(alias, "ASC")
    })
    const measures = Object.entries(aggregate.measures)
    measures.forEach(([, measure], index) => {
        const argument = measure.field === undefined ? "*" : fieldExpression(entity, measure.field, "r", params)
        const filter = measure.where === undefined ? "" : ` FILTER (WHERE ${filterFragment(measure.where, scope)})`
        builder.addSelect(`${MEASURE_FUNCTIONS[measure.kind]}(${argument})${filter}`, `m${String(index)}`)
    })
    builder.setParameters(params.values()).limit(aggregate.limit)
    return returnedRows(await builder.getRawMany(), isRecord).map((raw) => ({
        groups: Object.fromEntries(
            groups.map(({ name }, index) => {
                const column = `g${String(index)}`
                return [name, textColumn(column, raw[column])]
            }),
        ),
        measures: Object.fromEntries(
            measures.map(([name, measure], index) => [
                name,
                measureValue(`m${String(index)}`, measure.kind, raw[`m${String(index)}`]),
            ]),
        ),
    }))
}
