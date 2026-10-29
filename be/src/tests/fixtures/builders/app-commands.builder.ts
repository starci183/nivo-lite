import { ANY_FUNCTION } from "./any-function.builder"

/** The columns a failed command settles with; `finishedAt` stands for the database's `now()` expression. */
export const failedSettlement = (errorCode: string): Record<string, unknown> => ({
    state: "failed",
    errorCode,
    finishedAt: ANY_FUNCTION,
})
