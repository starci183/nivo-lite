/** The columns a failed command settles with; `finishedAt` stands for the database's `now()` expression. */
export const failedSettlement = (errorCode: string): Record<string, unknown> => ({
    state: "failed",
    errorCode,
    finishedAt: expect.any(Function),
})
