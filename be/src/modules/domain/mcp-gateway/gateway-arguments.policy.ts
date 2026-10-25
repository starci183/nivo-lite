/** Shared budgets of connector arguments, including tools whose shape belongs to a remote server. */
export const GATEWAY_ARGUMENT_LIMITS = {
    string: 8192,
    key: 100,
    items: 100,
    properties: 100,
    depth: 8,
    json: 65_536,
} as const

/** A container still to inspect, with the number of containers above it below the root. */
interface PendingNode {
    /** The value. */
    readonly value: unknown
    /** Its depth: the root is 0, each nested container adds one. */
    readonly depth: number
}

/**
 * Whether an argument tree may be parsed: no container sits more than the depth budget below the root, and no object owns a
 * `__proto__` member. Checked iteratively before Zod descends, because Zod's record parser discards such a member and a deeper tree
 * would recurse without a bound.
 */
export const isAdmissibleArgumentTree = (input: unknown): boolean => {
    const pending: Array<PendingNode> = [{ value: input, depth: 0 }]
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        const { value, depth } = next
        if (typeof value !== "object" || value === null) continue
        if (depth > GATEWAY_ARGUMENT_LIMITS.depth || Object.hasOwn(value, "__proto__")) return false
        for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 })
    }
    return true
}
