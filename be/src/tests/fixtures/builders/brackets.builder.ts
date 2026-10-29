import { mock } from "@starci/jest-preset"
import { Brackets } from "typeorm"
import type { WhereExpressionBuilder } from "typeorm"

/** The conditions a `Brackets` group adds, in order, each as the arguments of its `where` or `orWhere` call. */
export const bracketConditions = (brackets: unknown): ReadonlyArray<ReadonlyArray<unknown>> => {
    const conditions: Array<ReadonlyArray<unknown>> = []
    const scope = mock<WhereExpressionBuilder>()
    scope.where.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
    scope.orWhere.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
    if (brackets instanceof Brackets) brackets.whereFactory(scope)
    return conditions
}
