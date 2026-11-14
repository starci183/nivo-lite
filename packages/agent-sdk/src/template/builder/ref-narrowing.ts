import { MISSING, UNTYPED, branchesOf, schemaAt, type Json } from "../../graph/graph-ref-schema"
import { isStoredPresence } from "../../graph/graph-spec-v2"
import type { StoredExpr, StoredLeaf, StoredRef } from "../../graph/graph-spec-v2.types"
import { isParamRef, parseRef } from "../../node/memory"
import { isRecord } from "../../schema/is-record"

/**
 * What the save check knows of a value on the way to a step, proven by the road the run took to it (a route of a routing node, a branch
 * of an `if`): the value at `path` below `root` is present (not null, read), is one of `values` (`in`: present too), or is none of them
 * (`notIn`: when it is there at all).
 */
export type FactTest =
    | { readonly kind: "present" }
    | { readonly kind: "in"; readonly values: ReadonlyArray<Literal> }
    | { readonly kind: "notIn"; readonly values: ReadonlyArray<Literal> }

/** A fixed value a test compares with: a text, a number, a boolean (never null: a null test proves nothing of a variant). */
export type Literal = string | number | boolean

/**
 * One fact. `root` names what the ref reads (`steps.<key>` for a step's output, `trigger`, `item`); `path` is below it (below `output`
 * for a step).
 */
export interface RefFact {
    /** What the ref reads: `steps.<key>`, `trigger` or `item`. */
    readonly root: string
    /** The member path below the root. */
    readonly path: ReadonlyArray<string>
    /** What the road proved of the value at the path. */
    readonly test: FactTest
}

/** The root and the path of a ref a fact can be about, or null (a step's error, `lead`, `workflows`, `out`, a malformed ref). */
export const factPlaceOf = (ref: StoredRef): { readonly root: string; readonly path: ReadonlyArray<string> } | null => {
    const parsed = parseRef(ref.$ref)
    if (parsed === null) return null
    switch (parsed.root) {
        case "steps":
            return parsed.part === "output" && parsed.nodeKey !== null
                ? { root: `steps.${parsed.nodeKey}`, path: parsed.path }
                : null
        case "trigger":
        case "item":
            return { root: parsed.root, path: parsed.path }
        case "lead":
        case "workflows":
        case "out":
            return null
    }
}

/** Whether a fixed value is a literal a fact may name. */
const isLiteral = (value: unknown): value is Literal =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"

/**
 * Whether a test ref reads what the step's ref reads when its source is absent: no `default`, or `default: null` (what an `if`'s refs
 * carry). A ref with another default reads that default in place of nothing, so a test that holds on it proves nothing of the source.
 */
const readsNullWhenAbsent = (ref: StoredRef): boolean => ref.default === undefined || ref.default === null

/** Whether the values of an `eq` / `ne` leaf are equal when its truth is `holds`; null for any other operator (it proves no equality). */
const equalityHolds = (op: string, holds: boolean): boolean | null => {
    if (op === "eq") return holds
    if (op === "ne") return !holds
    return null
}

/** The facts one leaf proves when its truth is `holds` (exactly true, or exactly false). */
const leafFacts = (leaf: StoredLeaf, holds: boolean): ReadonlyArray<RefFact> => {
    const place = factPlaceOf(leaf.ref)
    if (place === null) return []
    if (isStoredPresence(leaf)) {
        // `present` true / `absent` false: the value is not null (nor empty). Its other truth proves nothing (absent may be a run without it).
        const present = (leaf.op === "present") === holds
        return present && readsNullWhenAbsent(leaf.ref) ? [{ ...place, test: { kind: "present" } }] : []
    }
    if (isParamRef(leaf.value) || !isLiteral(leaf.value)) return []
    const equal = equalityHolds(leaf.op, holds)
    if (equal === null) return []
    if (equal) return readsNullWhenAbsent(leaf.ref) ? [{ ...place, test: { kind: "in", values: [leaf.value] } }] : []
    return [{ ...place, test: { kind: "notIn", values: [leaf.value] } }]
}

/**
 * The facts an expression proves when its truth is exactly `holds` (Kleene: never `unknown`). `and` true: each part true; `or` false:
 * each part false; `not`: its part with the other truth; a leaf: `leafFacts`. `and` false and `or` true prove nothing (one of the parts).
 */
const factsWhen = (expr: StoredExpr, holds: boolean): ReadonlyArray<RefFact> => {
    if ("and" in expr) return holds ? expr.and.flatMap((part) => factsWhen(part, true)) : []
    if ("or" in expr) return holds ? [] : expr.or.flatMap((part) => factsWhen(part, false))
    if ("not" in expr) return factsWhen(expr.not, !holds)
    return leafFacts(expr, holds)
}

/** Whether an expression is never `unknown`: it has no order comparison (`eq` / `ne` and presence tests are always true or false). */
const twoValued = (expr: StoredExpr): boolean => {
    if ("and" in expr) return expr.and.every((part) => twoValued(part))
    if ("or" in expr) return expr.or.every((part) => twoValued(part))
    if ("not" in expr) return twoValued(expr.not)
    return isStoredPresence(expr) || expr.op === "eq" || expr.op === "ne"
}

/**
 * The facts an `if` proves on one side. `yes` runs exactly when `when` is true, so its facts are `factsWhen(when, true)`. `no` runs when
 * it is false OR unknown: its facts are `factsWhen(when, false)` only when `when` can never be unknown; else none.
 */
export const ifFacts = (when: StoredExpr, side: "yes" | "no"): ReadonlyArray<RefFact> => {
    if (side === "yes") return factsWhen(when, true)
    return twoValued(when) ? factsWhen(when, false) : []
}

/** The fact a route proves: the routing member of the node's output is one of the route names that lead to the target. */
export const routeFact = (stepKey: string, by: string, names: ReadonlyArray<string>): RefFact => ({
    root: `steps.${stepKey}`,
    path: [by],
    test: { kind: "in", values: names },
})

/** Whether a JSON Schema node admits null: a `null` type, a null branch, a null constant or enum value. */
export const admitsNull = (schema: Json): boolean => {
    const type = schema["type"]
    if (type === "null" || (Array.isArray(type) && type.includes("null"))) return true
    if (schema["const"] === null) return true
    const values = schema["enum"]
    if (Array.isArray(values) && values.includes(null)) return true
    const options = schema["anyOf"] ?? schema["oneOf"]
    return Array.isArray(options) && options.filter(isRecord).some((option) => admitsNull(option))
}

/** Whether a path starts with a prefix. */
const startsWith = (path: ReadonlyArray<string>, prefix: ReadonlyArray<string>): boolean =>
    prefix.length <= path.length && prefix.every((name, index) => path[index] === name)

/** Whether a fact proves its value present (`present`, `in`: the value equals a literal, so it is there and not null). */
const provesPresent = (test: FactTest): boolean => test.kind !== "notIn"

/** Whether the facts prove the value at `prefix` present: some fact proves a value at or below it present (its parents are then too). */
export const presentAt = (facts: ReadonlyArray<RefFact>, prefix: ReadonlyArray<string>): boolean =>
    facts.some((fact) => provesPresent(fact.test) && startsWith(fact.path, prefix))

/** Whether a schema holds only null. */
const nullOnly = (schema: Json): boolean => {
    if (schema["type"] === "null" || schema["const"] === null) return true
    const values = schema["enum"]
    return Array.isArray(values) && values.length > 0 && values.every((value) => value === null)
}

/** The literal values a schema allows (a `const`, an `enum`, a union of those; null for a null branch), or null when not all literal. */
const literalValuesOf = (schema: Json): ReadonlyArray<unknown> | null => {
    if ("const" in schema) return [schema["const"]]
    const values = schema["enum"]
    if (Array.isArray(values)) return values.map((value: unknown) => value)
    if (schema["type"] === "null") return [null]
    const options = schema["anyOf"] ?? schema["oneOf"]
    if (!Array.isArray(options)) return null
    const each = options.filter(isRecord).map((option) => literalValuesOf(option))
    return each.every((one): one is ReadonlyArray<unknown> => one !== null) && each.length > 0 ? each.flat() : null
}

/**
 * The literal values a variant fixes at `rest` (one object on the way, no list), and whether the member is always there (required at every
 * level and never null on the way); null when the variant does not fix it to literals.
 */
const literalsAt = (
    variant: Json,
    rest: ReadonlyArray<string>,
): { readonly values: ReadonlyArray<unknown>; readonly always: boolean } | null => {
    let current: Json = variant
    let always = true
    for (const name of rest) {
        const [only, ...others] = branchesOf(current)
        if (only === undefined || others.length > 0 || only["type"] === "array") return null
        if (admitsNull(current)) always = false
        const required = only["required"]
        if (!(Array.isArray(required) && required.includes(name))) always = false
        current = schemaAt(only, [name])
        if (current === MISSING || current === UNTYPED) return null
    }
    const values = literalValuesOf(current)
    return values === null ? null : { values, always }
}

/** Whether a variant can never hold a value at `rest`: a member its closed object lacks, or null on the way or at the end. */
const neverHolds = (variant: Json, rest: ReadonlyArray<string>): boolean => {
    let current: Json = variant
    for (const name of rest) {
        if (nullOnly(current)) return true
        const [only, ...others] = branchesOf(current)
        if (only === undefined || others.length > 0) return false
        current = schemaAt(only, [name])
        if (current === MISSING) return true
        if (current === UNTYPED) return false
    }
    return nullOnly(current)
}

/**
 * The variants of a union at `here` the facts leave: a `present` fact drops the variants that never hold its value; an `in` / `notIn`
 * fact drops by the literal each variant fixes its member to, ONLY when every variant fixes it (a discriminant: else no narrowing).
 * `notIn` drops a variant only when its member is always there and every literal it allows is excluded. Never empty: a contradiction
 * keeps every variant (nothing is invented).
 */
const narrowVariants = (all: ReadonlyArray<Json>, facts: ReadonlyArray<RefFact>, here: ReadonlyArray<string>): ReadonlyArray<Json> => {
    let kept = all
    for (const fact of facts) {
        if (fact.path.length <= here.length || !startsWith(fact.path, here)) continue
        const rest = fact.path.slice(here.length)
        if (provesPresent(fact.test)) kept = kept.filter((variant) => !neverHolds(variant, rest))
        const test = fact.test
        if (test.kind === "present") continue
        const literals = all.map((variant) => literalsAt(variant, rest))
        if (literals.includes(null)) continue
        kept = kept.filter((variant) => {
            const fixed = literals[all.indexOf(variant)]
            if (fixed === null || fixed === undefined) return true
            const named = (value: unknown): boolean => test.values.some((candidate) => candidate === value)
            return test.kind === "in"
                ? fixed.values.some((value) => named(value))
                : !(fixed.always && fixed.values.every((value) => named(value)))
        })
    }
    return kept.length === 0 ? all : kept
}

/** What a ref finds at its path: the schema of the value (`MISSING`, `UNTYPED`), and whether it may find nothing there. */
export interface MemberRead {
    /** The schema of the member (`MISSING` or `UNTYPED` when there is none to give). */
    readonly schema: Json
    /** Whether the read may find nothing at run time. */
    readonly nothing: boolean
}

/** What `readAt` reads below a value that is only ever null (never returned: read as untyped, may read nothing). */
const NULL_BELOW: Json = Object.freeze({ "x-null-below": true })

/** One schema of the members several variants hold: the one, or a union of them. */
const unionOf = (schemas: ReadonlyArray<Json>): Json => {
    const [only, ...others] = schemas
    if (only !== undefined && others.length === 0) return only
    return { anyOf: schemas.flatMap((schema) => (Array.isArray(schema["anyOf"]) ? schema["anyOf"].filter(isRecord) : [schema])) }
}

/**
 * What reading `path` inside `schema` finds, given the facts the road to the step proves (each about this root). One object on the way
 * reads as `schemaAt` does (its member, `MISSING`, `UNTYPED`); a UNION reads each variant the facts leave (`narrowVariants`) and joins
 * them: the member's schema is the union of its schema in each, `UNTYPED` when any says nothing, `MISSING` when every closed one lacks
 * it. It may find nothing (as `mayFindNothing` judges: a null on the way or at the end, a member not required, an index of a list, a key
 * of a free record) in ANY variant left, or where a variant lacks it while another has it; a value the facts prove present never is.
 */
export const readAt = (schema: Json, path: ReadonlyArray<string>, facts: ReadonlyArray<RefFact>): MemberRead => {
    const at = (current: Json, depth: number): MemberRead => {
        if (current === UNTYPED || current === MISSING) return { schema: current, nothing: false }
        const here = path.slice(0, depth)
        const nullHere = !presentAt(facts, here) && admitsNull(current)
        if (depth === path.length) return { schema: current, nothing: nullHere }
        // Below a value that is only ever null nothing is read: in a union that variant holds nothing there (alone: untyped, nothing).
        if (nullOnly(current)) return { schema: NULL_BELOW, nothing: true }
        const all = branchesOf(current)
        if (all.length === 0) return { schema: UNTYPED, nothing: nullHere }
        const reads = narrowVariants(all, facts, here).map((variant) => stepInto(variant, depth))
        const absent = reads.filter((read) => read.schema === MISSING || read.schema === NULL_BELOW)
        const missing = reads.filter((read) => read.schema === MISSING).length
        const nothing = nullHere || reads.some((read) => read.nothing) || (missing > 0 && missing < reads.length)
        if (reads.some((read) => read.schema === UNTYPED)) return { schema: UNTYPED, nothing }
        if (missing === reads.length) return { schema: MISSING, nothing: false }
        if (absent.length === reads.length) return { schema: NULL_BELOW, nothing: true }
        return { schema: unionOf(reads.flatMap((read) => (absent.includes(read) ? [] : [read.schema]))), nothing }
    }
    const stepInto = (variant: Json, depth: number): MemberRead => {
        // A variant that is itself a union (a union nested in a union) is read as one.
        if (Array.isArray(variant["anyOf"] ?? variant["oneOf"])) return at(variant, depth)
        const name = path[depth]
        if (name === undefined) return { schema: variant, nothing: false }
        const next = schemaAt(variant, [name])
        if (next === MISSING || next === UNTYPED) return { schema: next, nothing: false }
        const required = variant["required"]
        const optional = variant["type"] === "array" || !(Array.isArray(required) && required.includes(name))
        const read = at(next, depth + 1)
        return { schema: read.schema, nothing: (optional && !presentAt(facts, path.slice(0, depth + 1))) || read.nothing }
    }
    // A source that is itself missing reads as untyped below it (as `schemaAt` reads it: its own problem is reported where it is).
    if (schema === MISSING && path.length > 0) return { schema: UNTYPED, nothing: false }
    const read = at(schema, 0)
    return read.schema === NULL_BELOW ? { schema: UNTYPED, nothing: true } : read
}
