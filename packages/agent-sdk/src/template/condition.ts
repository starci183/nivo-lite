import type { Condition } from "./graph.types"

/** The terms of a condition, in reading order, groups opened. */
export const leavesOf = (condition: Condition): ReadonlyArray<Condition> => {
    if ("all" in condition) return condition.all.flatMap((part) => leavesOf(part))
    if ("any" in condition) return condition.any.flatMap((part) => leavesOf(part))
    return [condition]
}

/** One walked condition: the rebuilt node and how many numbered terms it held. */
interface WalkedCondition {
    /** The condition after the walk. */
    readonly node: Condition
    /** How many numbered terms the walked condition held. */
    readonly used: number
}

/** The same condition with the value of the nth term (counted as `leavesOf` counts) replaced; a condition with no such number is unchanged. */
export const withLeafValue = (condition: Condition, index: number, value: number): Condition => {
    const walk = (node: Condition, from: number): WalkedCondition => {
        if ("all" in node || "any" in node) {
            const parts = "all" in node ? node.all : node.any
            let used = 0
            const next = parts.map((part) => {
                const done = walk(part, from + used)
                used += done.used
                return done.node
            })
            return { node: "all" in node ? { all: next } : { any: next }, used }
        }
        const hit = from === index && "value" in node && typeof node.value === "number" && node.op !== "in"
        return { node: hit ? { ...node, value } : node, used: 1 }
    }
    return walk(condition, 0).node
}
