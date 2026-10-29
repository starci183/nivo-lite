type Fragment = () => unknown

/** Replaces every SQL-fragment callback of a TypeORM values/set object with the text it returns, so a spec can compare it exactly. */
export const resolveFragments = (written: unknown): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(written as Record<string, unknown>).map(([column, value]) => [
            column,
            typeof value === "function" ? (value as Fragment)() : value,
        ]),
    )
