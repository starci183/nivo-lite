import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { KeysetOrder, KeysetPosition } from "./compiler.contracts"
import { fieldExpression } from "./field-access.policy"
import type { ParamBag } from "./param-bag.policy"

/** Where a row stands relative to one ordered column's value: the same, or strictly after it. Null sorts last ascending, first descending (the PostgreSQL default). */
interface ColumnTerms {
    readonly equal: string
    readonly after: string
}

const termsOf = (
    expression: string,
    direction: "asc" | "desc",
    value: string | null,
    params: ParamBag,
): ColumnTerms => {
    if (value === null)
        return { equal: `${expression} IS NULL`, after: direction === "asc" ? "FALSE" : `${expression} IS NOT NULL` }
    const bound = `:${params.bind(value)}`
    return {
        equal: `${expression} = ${bound}`,
        after: direction === "asc" ? `(${expression} > ${bound} OR ${expression} IS NULL)` : `${expression} < ${bound}`,
    }
}

/**
 * The predicate that keeps the rows strictly after `position` in `order` (keyset paging): for columns c1..cn it is
 * `(c1 after) OR (c1 = AND c2 after) OR ...`. The position holds the text the database gave for each ordered expression of the last
 * row of the previous page, bound as parameters whose type the database infers from the expression.
 */
export const keysetFragment = (
    entity: EntityDefinition,
    order: KeysetOrder,
    position: KeysetPosition,
    alias: string,
    params: ParamBag,
): string => {
    const columns = order.flatMap(([field, direction], index) => {
        const value = position[index]
        return value === undefined
            ? []
            : [termsOf(fieldExpression(entity, field, alias, params), direction, value, params)]
    })
    if (columns.length !== order.length || position.length > order.length)
        throw new EntityEngineError({
            code: EntityEngineErrorCode.PositionMismatch,
            params: { order: order.length, position: position.length },
        })
    const alternatives = columns.map((column, index) =>
        [...columns.slice(0, index).map((before) => before.equal), column.after].join(" AND "),
    )
    const wrapped = alternatives.map((alternative) => `(${alternative})`)
    return `(${wrapped.join(" OR ")})`
}
