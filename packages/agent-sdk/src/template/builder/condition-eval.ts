import { isStoredPresence } from "../../graph/graph-spec-v2"
import type { CompareOp, PresenceOp, StoredExpr, StoredLeaf, StoredRef } from "../../graph/graph-spec-v2.types"
import { isParamRef } from "../../node/memory"
import type { JsonValue } from "../../schema/schema.types"
import { canonicalJson } from "../canonical"

/** A calendar date as ISO 8601 writes it (ten characters). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** The time part of an ISO 8601 instant (after the `T`): hours and minutes, optional seconds with a fraction, then `Z` or an offset. */
const ISO_TIME = /^\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/

/** Whether a text has the shape of an ISO 8601 instant (a date, or a date and a time with an offset or `Z`): the only text an order compares. */
const hasIsoInstantShape = (text: string): boolean => {
    if (text.length === 10) return ISO_DATE.test(text)
    return text.charAt(10) === "T" && ISO_DATE.test(text.slice(0, 10)) && ISO_TIME.test(text.slice(11))
}

/** Whether a text is an ISO 8601 instant an order compares (a date, or a date and a time with an offset). */
export const isIsoInstantText = (text: string): boolean => hasIsoInstantShape(text) && !Number.isNaN(Date.parse(text))

/** The number an order compares a value by: itself, or the epoch milliseconds of an ISO instant; null for anything else. */
const orderOf = (value: JsonValue): number | null => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "string" || !isIsoInstantText(value)) return null
    return Date.parse(value)
}

/** Whether a value is present: not null, not empty text, not an empty list. */
export const isPresentValue = (value: JsonValue): boolean =>
    value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)

/** Whether a presence test holds. */
export const presenceHolds = (op: PresenceOp, value: JsonValue): boolean => (op === "present") === isPresentValue(value)

/**
 * The truth of an expression at run time: true, false, or `unknown` for an order comparison whose two sides are not two numbers or two
 * ISO instants (a type mismatch: a save problem, `EXPR_TYPE_MISMATCH`, for a graph that was checked; at run it is never thrown).
 */
export type ExprTruth = true | false | "unknown"

/** Whether a text is exactly one code point. */
const one = (text: string): boolean => [...text].length === 1

/** One code point as the default (locale-free) case mappings fold it, when each step maps it to exactly one code point. */
const foldedPoint = (point: string): string => {
    const upper = point.toUpperCase()
    if (one(upper)) {
        const lower = upper.toLowerCase()
        if (one(lower)) return lower
    }
    const lower = point.toLowerCase()
    return one(lower) ? lower : point
}

/**
 * A text folded for a case-blind comparison, the same in every locale: per code point, the DEFAULT Unicode case mappings of the language
 * (`toUpperCase` then `toLowerCase`, which take no locale), kept only where each maps the point to exactly ONE code point, else its own
 * lower case when that is one point, else the point as it is. This is Unicode simple case folding (status C + S) as the default case
 * mappings give it: `ſ` folds to `s`, final `ς` to `σ`, `ẞ` to `ß`; a point whose only mapping is several points (`İ` → `i̇`) stays
 * itself. No normalisation: the texts are compared as given otherwise.
 */
export const caseFolded = (text: string): string => [...text].map((point) => foldedPoint(point)).join("")

/**
 * The truth of a comparison: `eq` / `ne` by canonical JSON (never unknown), the order operators on two numbers or two ISO instants,
 * `contains` on two texts (an exact substring; folded by `caseFolded` when `caseFold`; unknown when a side is no text).
 */
export const compareTruth = (op: CompareOp, left: JsonValue, right: JsonValue, caseFold = false): ExprTruth => {
    if (op === "eq") return canonicalJson(left) === canonicalJson(right)
    if (op === "ne") return canonicalJson(left) !== canonicalJson(right)
    if (op === "contains") {
        if (typeof left !== "string" || typeof right !== "string") return "unknown"
        return caseFold ? caseFolded(left).includes(caseFolded(right)) : left.includes(right)
    }
    const a = orderOf(left)
    const b = orderOf(right)
    if (a === null || b === null || typeof left !== typeof right) return "unknown"
    switch (op) {
        case "lt":
            return a < b
        case "lte":
            return a <= b
        case "gt":
            return a > b
        case "gte":
            return a >= b
    }
}

/**
 * Whether a comparison holds, exactly: `eq` / `ne` by canonical JSON (so `1` is not `"1"`), the order operators on two numbers or two ISO
 * instants (never text against a number: false).
 */
export const compareHolds = (op: CompareOp, left: JsonValue, right: JsonValue): boolean =>
    compareTruth(op, left, right) === true

/** The truth of one leaf, its refs read by `read`. */
const leafTruth = (leaf: StoredLeaf, read: (ref: StoredRef) => JsonValue): ExprTruth => {
    const left = read(leaf.ref)
    if (isStoredPresence(leaf)) return presenceHolds(leaf.op, left)
    const right = isParamRef(leaf.value) ? read(leaf.value) : leaf.value
    return compareTruth(leaf.op, left, right, leaf.caseFold === true)
}

/** `and` over truths (Kleene): false wins, then unknown. */
const allOf = (truths: ReadonlyArray<ExprTruth>): ExprTruth => {
    let truth: ExprTruth = true
    if (truths.includes("unknown")) truth = "unknown"
    if (truths.includes(false)) truth = false
    return truth
}

/** `or` over truths (Kleene): true wins, then unknown. */
const anyOf = (truths: ReadonlyArray<ExprTruth>): ExprTruth => {
    let truth: ExprTruth = false
    if (truths.includes("unknown")) truth = "unknown"
    if (truths.includes(true)) truth = true
    return truth
}

/**
 * The truth of an expression, its refs read by `read` (the engine resolves each from the run's scope; an absent value reads its `default`,
 * null). Three-valued (Kleene): a mismatched order comparison is `unknown`, `not` keeps it `unknown`, `and` / `or` decide by their other
 * parts when they can.
 */
export const exprTruth = (expr: StoredExpr, read: (ref: StoredRef) => JsonValue): ExprTruth => {
    if ("and" in expr) return allOf(expr.and.map((part) => exprTruth(part, read)))
    if ("or" in expr) return anyOf(expr.or.map((part) => exprTruth(part, read)))
    if ("not" in expr) {
        const inner = exprTruth(expr.not, read)
        return inner === "unknown" ? "unknown" : !inner
    }
    return leafTruth(expr, read)
}

/**
 * THE evaluator of the engine's expression language: whether an expression holds, its refs read by `read`. Pure; never throws. An
 * expression whose truth is `unknown` (a type mismatch at run) does NOT hold: an `if` goes `no`, an `until` loop runs another round.
 */
export const exprHolds = (expr: StoredExpr, read: (ref: StoredRef) => JsonValue): boolean => exprTruth(expr, read) === true

