import { isRecord } from "@modules/platform/primitives"

/** What a schema answers when it judges a value without throwing. */
export interface ResultJudge {
    /** Judges the value. */
    readonly safeParse: (value: unknown) => { readonly success: boolean }
}

/**
 * Whether what the books answered is a list of rows, which the close report then reads in its own shape: the port answers only the fields
 * the report asked for.
 */
export const isRowsOf = <T>(rows: unknown): rows is ReadonlyArray<T> => Array.isArray(rows) && rows.every(isRecord)

/** Whether the bank's answer is what the bank tool's own result schema accepts, which the close report then reads in its own shape. */
export const isAnswerOf = <R>(answer: unknown, result: ResultJudge): answer is R => result.safeParse(answer).success
