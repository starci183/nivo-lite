/** The name that opens the SWR key of every read of the live data port: `[name, workspaceId, operation, variables]`. */
export const WORKBENCH_READ_KEY = "WORKBENCH_READ_SWR"

/** The position of the operation in a workbench read key. */
const OPERATION_AT = 2

/** Whether a cache key is the key of a workbench read whose operation an action refreshes; the test `mutate` takes. */
export const isRefreshedKey = (key: unknown, refreshes: ReadonlyArray<string>): boolean => {
    if (!Array.isArray(key) || key[0] !== WORKBENCH_READ_KEY) return false
    const operation: unknown = key[OPERATION_AT]
    return typeof operation === "string" && refreshes.includes(operation)
}
