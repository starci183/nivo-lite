/**
 * Matches any function in a comparison (a `() => ...` SQL expression a spec cannot compare by value). It speaks jest's
 * asymmetric-matcher protocol itself, so a builder needs no test-framework global to hand it out.
 */
export const ANY_FUNCTION: unknown = {
    asymmetricMatch: (value: unknown): boolean => typeof value === "function",
    toString: (): string => "AnyFunction",
}
