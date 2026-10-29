/** Builds rows of one entity: the defaults a spec names once, and the fields one case changes. */
export const entityRowBuilder =
    <Row extends object>(defaults: Row) =>
    (changes: { readonly [Field in keyof Row]?: Row[Field] } = {}): Row => ({ ...defaults, ...changes })

/** The values of one write with every function expression (`() => "now()"`) replaced by the word "function", so a spec can compare them. */
export const stampedValues = (values: unknown): Record<string, unknown> =>
    typeof values === "object" && values !== null
        ? Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, typeof value === "function" ? "function" : value]),
          )
        : {}

/** Widens a value to unknown so a matcher takes any expectation; a spec compares what a double saw without retyping it. */
export const plain = (value: unknown): unknown => value

/**
 * The calls a double saw with each entity class named by its class name, so a spec compares plain values; the argument at `stamped`
 * (the changes of an update, the rows of an upsert) has its function expressions named.
 */
export const namedCalls = (calls: ReadonlyArray<ReadonlyArray<unknown>>, stamped?: number): unknown =>
    calls.map((call) =>
        call.map((argument, index) => {
            if (index === 0 && typeof argument === "function") return argument.name
            return index === stamped ? stampedValues(argument) : argument
        }),
    )
