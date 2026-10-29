/** The values of one write with every function expression (`() => "now()"`) run, so a spec compares the SQL each one yields. */
export const evaluatedValues = (values: unknown): Record<string, unknown> =>
    typeof values === "object" && values !== null
        ? Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, typeof value === "function" ? value() : value]),
          )
        : {}

/**
 * The calls a double saw with each entity class named by its class name; the argument at `evaluated` (the changes of an update,
 * the rows of an upsert) has its function expressions run, so the SQL they yield is compared and the expressions are covered.
 */
export const evaluatedCalls = (calls: ReadonlyArray<ReadonlyArray<unknown>>, evaluated?: number): unknown =>
    calls.map((call) =>
        call.map((argument, index) => {
            if (index === 0 && typeof argument === "function") return argument.name
            return index === evaluated ? evaluatedValues(argument) : argument
        }),
    )
