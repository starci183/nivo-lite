import { EXPR_DEPTH_MAX, EXPR_LEAVES_MAX, isStoredPresence } from "../../graph/graph-spec-v2"
import type { StoredExpr, StoredLeaf, StoredRef } from "../../graph/graph-spec-v2.types"
import { isParamRef } from "../../node/memory"
import type { JsonValue } from "../../schema/schema.types"
import { isIsoInstantText } from "./condition-eval"
import type { TemplateProblem } from "./template-problems"

/**
 * The kind of value one side of a comparison holds, as the save can tell it: `date` is an ISO 8601 instant (a fixed text of that form,
 * or a source member declared as a date-time / date string); `unknown` when the source says nothing (judged at run only); `missing` when
 * the ref reads nothing the graph has (a malformed ref, a member the source lacks).
 */
export type ExprValueKind = "number" | "date" | "string" | "boolean" | "object" | "array" | "null" | "unknown" | "missing"

/** What an expression is judged against: where it sits, and the kind each of its refs reads. */
export interface ExprContext {
    /** The path of the expression in its document (`nodes.<key>.params.when`); the problems' `at` starts with it. */
    readonly at: string
    /** The kind of value a ref reads. */
    readonly kindOf: (ref: StoredRef) => ExprValueKind
}

/** One leaf of an expression and the path to it below the expression. */
interface PlacedLeaf {
    readonly leaf: StoredLeaf
    readonly path: string
}

/** The depth of an expression and its leaves in reading order. */
interface ExprShape {
    readonly depth: number
    readonly leaves: ReadonlyArray<PlacedLeaf>
}

/** The depth of an expression (a leaf is 1) and its leaves in reading order. */
export const exprShapeOf = (expr: StoredExpr, path = ""): ExprShape => {
    const groupOf = (parts: ReadonlyArray<StoredExpr>, member: string): ExprShape => {
        const shapes = parts.map((part, index) => exprShapeOf(part, `${path}.${member}.${index}`))
        return {
            depth: 1 + Math.max(0, ...shapes.map((shape) => shape.depth)),
            leaves: shapes.flatMap((shape) => shape.leaves),
        }
    }
    if ("and" in expr) return groupOf(expr.and, "and")
    if ("or" in expr) return groupOf(expr.or, "or")
    if ("not" in expr) {
        const inner = exprShapeOf(expr.not, `${path}.not`)
        return { depth: inner.depth + 1, leaves: inner.leaves }
    }
    return { depth: 1, leaves: [{ leaf: expr, path }] }
}

/** The refs of an expression, leaves in order (the compared value too when it is a ref). */
export const exprRefsOf = (expr: StoredExpr): ReadonlyArray<StoredRef> =>
    exprShapeOf(expr).leaves.flatMap(({ leaf }) => [
        leaf.ref,
        ...(!isStoredPresence(leaf) && isParamRef(leaf.value) ? [leaf.value] : []),
    ])

/** The kind of a fixed value. */
export const kindOfValue = (value: JsonValue): ExprValueKind => {
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    if (typeof value === "number") return "number"
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "string") return isIsoInstantText(value) ? "date" : "string"
    return "object"
}

/** The family a kind compares in by equality: a date is text. */
const familyOf = (kind: ExprValueKind): string => (kind === "date" ? "string" : kind)

/** Whether a kind is decided (not unknown, not missing). */
const known = (kind: ExprValueKind): boolean => kind !== "unknown" && kind !== "missing"

/**
 * Whether the two sides of a leaf may be compared: an order operator only between two numbers or two ISO instants; `eq` / `ne` not
 * between two decided kinds of different families (a number never equals a text), null always comparable (an absent value reads null).
 */
const leafSound = (op: StoredLeaf["op"], left: ExprValueKind, right: ExprValueKind): boolean => {
    if (!known(left) || !known(right)) return true
    if (op === "contains") return familyOf(left) === "string" && familyOf(right) === "string"
    if (op === "eq" || op === "ne") return left === "null" || right === "null" || familyOf(left) === familyOf(right)
    return (left === "number" && right === "number") || (left === "date" && right === "date")
}

/** The kind the right side of a leaf holds: none for a presence test, a ref's kind, or a fixed value's kind. */
const rightKindOf = (leaf: StoredLeaf, context: ExprContext): ExprValueKind => {
    if (isStoredPresence(leaf)) return "unknown"
    return isParamRef(leaf.value) ? context.kindOf(leaf.value) : kindOfValue(leaf.value)
}

/**
 * THE validator of the engine's expression language, pure: the bounds (`EXPR_TOO_DEEP` past depth `EXPR_DEPTH_MAX` = 4, a leaf being 1;
 * `EXPR_TOO_LARGE` past `EXPR_LEAVES_MAX` = 16 leaves), a ref that reads nothing the graph has (`GRAPH_REF_TYPE`), and a type mismatch
 * (`EXPR_TYPE_MISMATCH`: an order comparison not between two numbers or two ISO instants; an equality between kinds that never meet;
 * a `contains` whose two sides are not both texts).
 * Whether each ref is upstream of its site is the graph's (`templateGraphProblems`, which calls this for every `if` and `until`).
 */
export const exprProblems = (expr: StoredExpr, context: ExprContext): ReadonlyArray<TemplateProblem> => {
    const shape = exprShapeOf(expr)
    const bounds: ReadonlyArray<TemplateProblem> = [
        ...(shape.depth > EXPR_DEPTH_MAX ? [{ code: "EXPR_TOO_DEEP" as const, at: context.at }] : []),
        ...(shape.leaves.length > EXPR_LEAVES_MAX ? [{ code: "EXPR_TOO_LARGE" as const, at: context.at }] : []),
    ]
    const leaves = shape.leaves.flatMap(({ leaf, path }): ReadonlyArray<TemplateProblem> => {
        const at = `${context.at}${path}`
        const left = context.kindOf(leaf.ref)
        const right = rightKindOf(leaf, context)
        const missing = [
            ...(left === "missing" ? [{ code: "GRAPH_REF_TYPE" as const, at: `${at}.ref<-${leaf.ref.$ref}` }] : []),
            ...(right === "missing" && !isStoredPresence(leaf) && isParamRef(leaf.value)
                ? [{ code: "GRAPH_REF_TYPE" as const, at: `${at}.value<-${leaf.value.$ref}` }]
                : []),
        ]
        return [
            ...missing,
            ...(isStoredPresence(leaf) || leafSound(leaf.op, left, right)
                ? []
                : [{ code: "EXPR_TYPE_MISMATCH" as const, at }]),
        ]
    })
    return [...bounds, ...leaves]
}
