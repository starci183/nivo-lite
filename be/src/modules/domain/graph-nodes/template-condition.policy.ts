import {
    EXPR_DEPTH_MAX,
    type CompareOp,
    type PresenceOp,
    type StoredExpr,
    type StoredLeaf,
    type StoredRef,
} from "@nivo-lite/agent-sdk/graph"
import { isParamRef } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds, exprProblems } from "@nivo-lite/agent-sdk/template"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"

/** The comparison operators of a stored condition. */
const COMPARE_OPS: ReadonlyArray<CompareOp> = ["eq", "ne", "lt", "lte", "gt", "gte", "contains"]

/** The presence operators of a stored condition. */
const PRESENCE_OPS: ReadonlyArray<PresenceOp> = ["present", "absent"]

/** The presence operators, read as any value may be asked about. */
const PRESENCE_WORDS: ReadonlyArray<unknown> = PRESENCE_OPS

/** The compare operators, read as any value may be asked about. */
const COMPARE_WORDS: ReadonlyArray<unknown> = COMPARE_OPS

/** The `$ref` a value the engine already resolved is carried under, so the SDK's evaluator reads it back from `default`. */
const RESOLVED_REF = "$resolved"

/** The code of an expression the engine's evaluator cannot read (or the SDK's validator refuses). */
export const GRAPH_EXPR_INVALID = "GRAPH_EXPR_INVALID"

/** One problem of a stored expression: where it is (a dotted path inside the expression) and why. */
export interface ExprProblem {
    /** `GRAPH_EXPR_INVALID`. */
    readonly code: typeof GRAPH_EXPR_INVALID
    /** The path inside the expression (`and.1.ref`), or the SDK's own path. */
    readonly at: string
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A value as JSON: what a resolved binding is (a value the run read, or a fixed one); anything else is refused. */
const isJson = (value: unknown): value is JsonValue => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return true
    if (typeof value === "number") return Number.isFinite(value)
    if (Array.isArray(value)) return value.every(isJson)
    return isRecord(value) && Object.values(value).every(isJson)
}

/** The refusal of a condition the engine cannot read: a bug of the graph (the step freezes), never a branch. */
const unreadable = (at: string): GraphNodesError =>
    new GraphNodesError({ code: GraphNodesErrorCode.NodeUnknown, params: { node: `core.when:${at}` } })

/**
 * THE ONE ADAPTER from the engine to the SDK's evaluator (`exprHolds`, three-valued: an unknown truth does not hold): every condition
 * the engine decides (`ifNode` / `callWorkflows.when` as the step `core.when`, and `loop.until` by data) goes through here.
 */
const holdsBySdk = (expr: StoredExpr, read: (ref: StoredRef) => JsonValue): boolean => exprHolds(expr, read)

/** A resolved value as the ref the evaluator reads back: never mistaken for a ref of its own, whatever its shape. */
const heldRefOf = (value: unknown, at: string): StoredRef => {
    const held = value ?? null
    if (!isJson(held)) throw unreadable(at)
    return { $ref: RESOLVED_REF, default: held }
}

/** What a held ref reads: the value it carries. */
const readHeld = (ref: StoredRef): JsonValue => ref.default ?? null

/** The `caseFold` flag a leaf may carry. */
interface CaseFoldFlag {
    readonly caseFold?: true
}

/** The declared `caseFold` of a `contains` leaf (only there, only `true`); nothing for any other leaf. */
const caseFoldOf = (leaf: Readonly<Record<string, unknown>>, op: CompareOp): CaseFoldFlag =>
    op === "contains" && leaf.caseFold === true ? { caseFold: true } : {}

/** One resolved leaf (its refs already replaced by the values the run holds) as the evaluator's leaf. */
const resolvedLeafOf = (leaf: unknown): StoredLeaf => {
    if (!isRecord(leaf)) throw unreadable("leaf")
    const { op } = leaf
    const ref = heldRefOf(leaf.ref, "ref")
    const presence = PRESENCE_OPS.find((one) => one === op)
    if (presence !== undefined) return { ref, op: presence }
    const compare = COMPARE_OPS.find((one) => one === op)
    if (compare === undefined) throw unreadable("op")
    return { ref, op: compare, value: heldRefOf(leaf.value, "value"), ...caseFoldOf(leaf, compare) }
}

/** The members of a combinator, refused when they are not a non-empty list: the SDK's tuple of at least one. */
const membersOf = (value: unknown, at: string, member: (one: unknown) => StoredExpr): readonly [StoredExpr, ...Array<StoredExpr>] => {
    if (!Array.isArray(value)) throw unreadable(at)
    const [first, ...rest] = value.map((one: unknown) => member(one))
    if (first === undefined) throw unreadable(at)
    return [first, ...rest]
}

/**
 * A resolved expression as the evaluator's, checked member by member (a leaf is depth 1; deeper than `EXPR_DEPTH_MAX` is refused). The
 * one-level `all` / `any` of graphs stored before the expression language read as `and` / `or`, as the SDK's schema reads them.
 */
const resolvedExprOf = (expr: unknown, depth: number): StoredExpr => {
    if (depth > EXPR_DEPTH_MAX) throw unreadable("depth")
    const deeper = (one: unknown): StoredExpr => resolvedExprOf(one, depth + 1)
    if (isRecord(expr) && "and" in expr) return { and: membersOf(expr.and, "and", deeper) }
    if (isRecord(expr) && "or" in expr) return { or: membersOf(expr.or, "or", deeper) }
    if (isRecord(expr) && "not" in expr) return { not: deeper(expr.not) }
    if (isRecord(expr) && "all" in expr) return { and: membersOf(expr.all, "all", resolvedLeafOf) }
    if (isRecord(expr) && "any" in expr) return { or: membersOf(expr.any, "any", resolvedLeafOf) }
    return resolvedLeafOf(expr)
}

/**
 * Whether a condition holds, over the condition AFTER the engine resolved its refs (every `{ $ref, default }` replaced by the value the
 * run holds, null when absent): a leaf, `and` / `or` / `not` of expressions, or the old one level of `all` / `any`. Decided by the SDK's
 * `exprHolds`: equality by canonical JSON, the order operators on two numbers or two ISO instants only, an unknown truth does not hold.
 * An expression the engine cannot read throws (the step freezes).
 */
export const resolvedConditionHolds = (when: unknown): boolean => holdsBySdk(resolvedExprOf(when, 1), readHeld)

/** The branch an `if` step answers. */
export interface ConditionBranch {
    /** The route the run takes: `yes` or `no`. */
    readonly branch: "yes" | "no"
}

/** The branch the engine's `if` step answers: `yes` when the condition holds, `no` otherwise (a `no` with no route ends the run). */
export const conditionBranchOf = (params: unknown): ConditionBranch => {
    const when: unknown = isRecord(params) ? params.when : undefined
    if (when === undefined) throw unreadable("when")
    return { branch: resolvedConditionHolds(when) ? "yes" : "no" }
}

/** The problems of one stored leaf's shape. */
const storedLeafProblems = (leaf: unknown, at: string): ReadonlyArray<ExprProblem> => {
    const invalid = (where: string): ExprProblem => ({
        code: GRAPH_EXPR_INVALID,
        at: [at, where].filter((part) => part !== "").join("."),
    })
    if (!isRecord(leaf)) return [invalid("")]
    const { op } = leaf
    const ref = isParamRef(leaf.ref) && leaf.ref.$ref !== "" ? [] : [invalid("ref")]
    if (PRESENCE_WORDS.includes(op)) return ref
    if (!COMPARE_WORDS.includes(op)) return [...ref, invalid("op")]
    const value: unknown = leaf.value
    const valueOk = value !== undefined && (isParamRef(value) || isJson(value))
    return [...ref, ...(valueOk ? [] : [invalid("value")])]
}

/** The problems of a list of members (`and`, `or`, `all`, `any`): a non-empty list, each member judged by `member`. */
const membersProblems = (
    value: unknown,
    at: string,
    member: (one: unknown, where: string) => ReadonlyArray<ExprProblem>,
): ReadonlyArray<ExprProblem> =>
    Array.isArray(value) && value.length > 0
        ? value.flatMap((one: unknown, index) => member(one, `${at}.${String(index)}`))
        : [{ code: GRAPH_EXPR_INVALID, at }]

/** The problems of the SHAPE of a stored expression (what the evaluator could not read at all), a leaf being depth 1. */
const exprShapeProblems = (expr: unknown, at: string, depth: number): ReadonlyArray<ExprProblem> => {
    if (depth > EXPR_DEPTH_MAX) return [{ code: GRAPH_EXPR_INVALID, at }]
    const deeper = (one: unknown, where: string): ReadonlyArray<ExprProblem> => exprShapeProblems(one, where, depth + 1)
    const path = (member: string): string => (at === "" ? member : `${at}.${member}`)
    if (isRecord(expr) && "and" in expr) return membersProblems(expr.and, path("and"), deeper)
    if (isRecord(expr) && "or" in expr) return membersProblems(expr.or, path("or"), deeper)
    if (isRecord(expr) && "not" in expr) return deeper(expr.not, path("not"))
    if (isRecord(expr) && "all" in expr) return membersProblems(expr.all, path("all"), storedLeafProblems)
    if (isRecord(expr) && "any" in expr) return membersProblems(expr.any, path("any"), storedLeafProblems)
    return storedLeafProblems(expr, at)
}

/** A stored leaf whose shape `storedLeafProblems` found sound, as the SDK's type. */
const storedLeafOf = (leaf: unknown): StoredLeaf => {
    if (!isRecord(leaf) || !isParamRef(leaf.ref)) throw unreadable("leaf")
    const ref: StoredRef = leaf.ref
    const presence = PRESENCE_OPS.find((one) => one === leaf.op)
    if (presence !== undefined) return { ref, op: presence }
    const compare = COMPARE_OPS.find((one) => one === leaf.op)
    const value: unknown = leaf.value
    if (compare === undefined || !(isParamRef(value) || isJson(value))) throw unreadable("leaf")
    return { ref, op: compare, value, ...caseFoldOf(leaf, compare) }
}

/** A stored expression whose shape `exprShapeProblems` found sound, as the SDK's type (the old `all` / `any` read as `and` / `or`). */
const storedExprOf = (expr: unknown): StoredExpr => {
    if (isRecord(expr) && "and" in expr) return { and: membersOf(expr.and, "and", storedExprOf) }
    if (isRecord(expr) && "or" in expr) return { or: membersOf(expr.or, "or", storedExprOf) }
    if (isRecord(expr) && "not" in expr) return { not: storedExprOf(expr.not) }
    if (isRecord(expr) && "all" in expr) return { and: membersOf(expr.all, "all", storedLeafOf) }
    if (isRecord(expr) && "any" in expr) return { or: membersOf(expr.any, "any", storedLeafOf) }
    return storedLeafOf(expr)
}

/**
 * The problems of an expression as a graph STORES it (refs not resolved): what the engine re-validates on every save of a stored or
 * UI-edited graph. First its shape, read the way the evaluator reads it at run (a leaf with a ref and a known operator, a comparison also
 * with a value: JSON or a ref; `and` / `or` over a non-empty list; `not` over one expression; the old `all` / `any` over leaves; at most
 * `EXPR_DEPTH_MAX` deep); then the SDK's validator `exprProblems` (its bounds, and the type mismatches it can tell from fixed values:
 * the engine hands it no ref types, so every ref reads `unknown` here and the typed checks stay the SDK's `templateGraphProblems`'s).
 * Empty for an expression the evaluator reads.
 */
export const storedExprProblems = (expr: unknown, at = ""): ReadonlyArray<ExprProblem> => {
    const shape = exprShapeProblems(expr, at, 1)
    if (shape.length > 0) return shape
    return exprProblems(storedExprOf(expr), { at, kindOf: () => "unknown" }).map(
        (one): ExprProblem => ({ code: GRAPH_EXPR_INVALID, at: one.at }),
    )
}
