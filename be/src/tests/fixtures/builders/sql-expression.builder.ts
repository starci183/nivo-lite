/** The values of one write with every function expression (`() => "now()"`) called, so a spec compares the SQL each one produces. */
export const expressionValues = (values: unknown): Record<string, unknown> =>
    typeof values === "object" && values !== null
        ? Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, typeof value === "function" ? value() : value]),
          )
        : {}
