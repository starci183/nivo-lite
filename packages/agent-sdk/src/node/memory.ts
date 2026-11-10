import { z } from "../schema/zod-entry"
import { isRecord } from "../schema/is-record"
import type { JsonValue } from "../schema/schema.types"
import { SdkError } from "../sdk-error"
import type { NodeConfusion } from "./node.types"
import { LEAD_FACTS, LOOP_INDEX_MEMBER, PII_FACTS, REF_TEXT_PREFIX } from "./memory.contracts"
import type {
    FileRef,
    LeadFact,
    LeadMemorySnapshot,
    NodeOutcomeDeclaration,
    ParamBinding,
    ParamBindings,
    ParamRef,
    ParsedRef,
    RefScope,
    Sensitivity,
    StepFailure,
    StepMemory,
} from "./memory.contracts"

/** The roots a ref may start with. */
const ROOTS: ReadonlySet<string> = new Set(["trigger", "steps", "lead", "workflows", "item", "out"])

/** The parts of a step's outcome a ref may read. */
const PARTS: ReadonlySet<string> = new Set(["output", "error"])

/** The segments of a namespace: `<moduleKey>.<workflowKey>`. */
const NAMESPACE_SEGMENTS = 2

/** One segment of a ref: a key, a field or a list position. */
const SEGMENT = /^[A-Za-z0-9_$-]+$/

const isObject = isRecord

/** Whether a value is a map of params (the ones a graph node writes). */
export const isBindings = (value: unknown): value is ParamBindings => isObject(value)

/** A JSON object. */
interface JsonObject {
    readonly [key: string]: JsonValue
}

/** Whether a value is a JSON object. */
const isJsonObject = (value: unknown): value is JsonObject => isObject(value)

/** Whether a param is a ref: `{ $ref }`, with `default` at most beside it. */
export const isParamRef = (binding: unknown): binding is ParamRef =>
    isObject(binding) &&
    typeof binding["$ref"] === "string" &&
    Object.keys(binding).every((name) => name === "$ref" || name === "default")

/** The editor's text of a ref: `= steps.order.output.address`. */
export const refTextOf = (ref: ParamRef): string => `${REF_TEXT_PREFIX} ${ref.$ref}`

/** The ref a text names when it starts with `=` (`= lead.address`), else null: any other text is a fixed value. */
export const refOfText = (text: string): ParamRef | null => {
    const trimmed = text.trim()
    if (!trimmed.startsWith(REF_TEXT_PREFIX)) return null
    const path = trimmed.slice(REF_TEXT_PREFIX.length).trim()
    return path === "" ? null : { $ref: path }
}

/** The step part of a `steps.*` or `workflows.*` ref: node key, part, path; null when malformed. */
const stepPartOf = (
    segments: ReadonlyArray<string>,
): { readonly nodeKey: string; readonly part: "output" | "error"; readonly path: ReadonlyArray<string> } | null => {
    const [nodeKey, part, ...path] = segments
    if (nodeKey === undefined || part === undefined || !PARTS.has(part)) return null
    return { nodeKey, part: part === "error" ? "error" : "output", path }
}

/**
 * A ref as parsed, or null when it is malformed: an unknown root, an empty or odd segment, a `steps.*` ref without `output`/`error`, a
 * `lead.*` ref to no fact of `LEAD_FACTS`, a `workflows.*` ref without its two-segment namespace and `steps`.
 */
export const parseRef = (text: string): ParsedRef | null => {
    const segments = text.split(".")
    const [root, ...rest] = segments
    if (root === undefined || !ROOTS.has(root) || !segments.every((segment) => SEGMENT.test(segment))) return null
    if (root === "trigger" || root === "item" || root === "out") return { root, namespace: null, nodeKey: null, part: null, path: rest }
    if (root === "lead") {
        const [fact] = rest
        if (fact === undefined || !new Set<string>(LEAD_FACTS).has(fact)) return null
        return { root, namespace: null, nodeKey: null, part: null, path: rest }
    }
    if (root === "steps") {
        const step = stepPartOf(rest)
        return step === null ? null : { root, namespace: null, ...step }
    }
    const namespace = rest.slice(0, NAMESPACE_SEGMENTS)
    const [steps, ...tail] = rest.slice(NAMESPACE_SEGMENTS)
    const step = steps === "steps" ? stepPartOf(tail) : null
    if (namespace.length !== NAMESPACE_SEGMENTS || step === null) return null
    return { root: "workflows", namespace: namespace.join("."), ...step }
}

/** The member at a path, or undefined when any step is missing. */
export const valueAt = (value: unknown, path: ReadonlyArray<string>): unknown =>
    path.reduce<unknown>((current, name) => {
        if (Array.isArray(current)) return /^\d+$/.test(name) ? current[Number(name)] : undefined
        return isObject(current) ? current[name] : undefined
    }, value)

/** The part of a step's outcome a ref reads: its output when done, its failure when it failed. */
const partOf = (memory: StepMemory | undefined, part: "output" | "error" | null): unknown => {
    if (memory === undefined) return undefined
    if (part === "error") return memory.error ?? undefined
    return memory.status === "done" ? memory.output : undefined
}

/** The value a parsed ref reads from the scope; undefined when its source has not run or holds nothing there. */
export const resolveRef = (ref: ParsedRef, scope: RefScope): unknown => {
    switch (ref.root) {
        case "trigger":
            return valueAt(scope.trigger, ref.path)
        case "lead":
            return valueAt(scope.memory?.lead, ref.path)
        case "out":
            return valueAt(scope.out, ref.path)
        case "item":
            if (scope.item === undefined) return undefined
            return ref.path[0] === LOOP_INDEX_MEMBER && ref.path.length === 1
                ? scope.item.index
                : valueAt(scope.item.value, ref.path)
        case "steps":
            return valueAt(partOf(scope.steps[ref.nodeKey ?? ""], ref.part), ref.path)
        case "workflows": {
            const entries = scope.memory?.workflows[ref.namespace ?? ""]
            return valueAt(partOf(entries?.[ref.nodeKey ?? ""], ref.part), ref.path)
        }
    }
}

/** A sentinel for a param the scope did not fill and that has no default: the key is left out so the node's own default applies. */
const ABSENT: unique symbol = Symbol("absent")

const resolvedBinding = (binding: ParamBinding, scope: RefScope): unknown => {
    if (isParamRef(binding)) {
        const parsed = parseRef(binding.$ref)
        const value = parsed === null ? undefined : resolveRef(parsed, scope)
        if (value !== undefined && value !== null) return value
        return binding.default === undefined ? ABSENT : binding.default
    }
    if (Array.isArray(binding))
        return binding.map((member: ParamBinding) => {
            const value = resolvedBinding(member, scope)
            return value === ABSENT ? null : value
        })
    if (isBindings(binding)) return resolvedRecord(binding, scope)
    return binding
}

const resolvedRecord = (bindings: ParamBindings, scope: RefScope): Readonly<Record<string, unknown>> =>
    Object.fromEntries(
        Object.entries(bindings).flatMap(([name, binding]) => {
            const value = resolvedBinding(binding, scope)
            return value === ABSENT ? [] : [[name, value]]
        }),
    )

/**
 * The params a node runs with: each fixed value as written, each ref read from the scope at any depth. A ref that finds nothing takes its
 * `default`; without one, the param is left out (the node's schema default applies) or, inside a list, is null.
 */
export const resolveParams = (bindings: ParamBindings, scope: RefScope): Readonly<Record<string, unknown>> =>
    resolvedRecord(bindings, scope)

/** Every ref inside params, at any depth, with the top-level field it sits under. */
export const paramRefsOf = (
    bindings: ParamBindings,
): ReadonlyArray<{ readonly field: string; readonly ref: ParamRef }> => {
    const inside = (binding: unknown): ReadonlyArray<ParamRef> => {
        if (isParamRef(binding)) return [binding]
        if (Array.isArray(binding)) return binding.flatMap(inside)
        return isObject(binding) ? Object.values(binding).flatMap(inside) : []
    }
    return Object.entries(bindings).flatMap(([field, binding]) => inside(binding).map((ref) => ({ field, ref })))
}

/** The params with every ref replaced by its default, and a top-level ref without one left out: what the params schema judges at save. */
export const fixedParamsOf = (bindings: ParamBindings): Readonly<Record<string, unknown>> => {
    const fixed = (binding: unknown): unknown => {
        if (isParamRef(binding)) return binding.default === undefined ? ABSENT : binding.default
        if (Array.isArray(binding)) return binding.map((member) => (fixed(member) === ABSENT ? null : fixed(member)))
        if (!isObject(binding)) return binding
        return Object.fromEntries(
            Object.entries(binding).flatMap(([name, member]) => {
                const value = fixed(member)
                return value === ABSENT ? [] : [[name, value]]
            }),
        )
    }
    return Object.fromEntries(
        Object.entries(bindings).flatMap(([name, binding]) => {
            const value = fixed(binding)
            return value === ABSENT ? [] : [[name, value]]
        }),
    )
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Business failures
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * What a node throws to end its step in a business failure (an address missing, the stock gone, a transfer that does not match): the
 * step is recorded as failed with this typed outcome, and the run takes the node's `failed` route when it has one, else ends there.
 * Never for a technical failure: those are thrown as they are and the engine retries them.
 */
export class NodeBusinessFailure extends SdkError<"NODE_BUSINESS_FAILURE"> {
    /** The failure as memory keeps it. */
    readonly failure: StepFailure

    constructor(failure: StepFailure) {
        super("NODE_BUSINESS_FAILURE", failure.code)
        this.failure = failure
    }
}

/** Whether a thrown value is a business failure of a node. */
export const isBusinessFailure = (cause: unknown): cause is NodeBusinessFailure => cause instanceof NodeBusinessFailure

/**
 * What a node throws (through `context.confused`) when its AI cannot decide: the confusion in the AI's own words. Never a business
 * failure and never a technical one: the engine hands it to its AI core like every step that could not complete.
 */
export class NodeConfused extends SdkError<"NODE_CONFUSED"> {
    /** What the AI said: why it cannot decide and what it needs answered. */
    readonly confusion: NodeConfusion

    constructor(confusion: NodeConfusion) {
        super("NODE_CONFUSED", confusion.reason)
        this.confusion = confusion
    }
}

/** Whether a thrown value is the confusion of a node's AI. */
export const isNodeConfused = (cause: unknown): cause is NodeConfused => cause instanceof NodeConfused

// ---------------------------------------------------------------------------------------------------------------------------------
// Facts, files and masking
// ---------------------------------------------------------------------------------------------------------------------------------

const isJson = (value: unknown): value is JsonValue =>
    value === null || ["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) || isObject(value)

/** The lead facts an output proves, by the node's `facts`: each present, non-empty member under its fact. */
export const factsOf = (
    declaration: Pick<NodeOutcomeDeclaration, "facts"> | undefined,
    output: unknown,
): Readonly<Partial<Record<LeadFact, JsonValue>>> =>
    Object.fromEntries(
        Object.entries(declaration?.facts ?? {}).flatMap(([fact, path]) => {
            const value = valueAt(output, (path ?? "").split("."))
            return value === undefined || value === null || value === "" || !isJson(value) ? [] : [[fact, value]]
        }),
    )

/** Whether a stored value is a file ref. */
export const isFileRef = (value: unknown): value is FileRef =>
    isObject(value) && (value["$file"] === "image" || value["$file"] === "file") && typeof value["id"] === "string"

/** The mask of a secret. */
export const SECRET_MASK = "••••"

/** Member names that hold a secret wherever they are, whatever the node declared. */
const SECRET_NAMES = /(secret|token|password|passcode|apikey|api_key|otp|pin)$/i

/** Member names that hold personal data wherever they are. */
const PII_NAMES = /(phone|email|address|recipient|contactname|fullname|idnumber|cccd)$/i

/** A text masked for display, keeping only its first and last two characters. */
const maskText = (value: string): string => {
    if (value.length <= 4) return "•".repeat(value.length)
    return `${value.slice(0, 2)}${"•".repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`
}

/** A value masked for display: a secret entirely, personal data keeping only its first and last two characters. */
export const maskValue = (value: JsonValue, sensitivity: Sensitivity): JsonValue => {
    const personal = sensitivity !== "secret"
    let masked: JsonValue = SECRET_MASK
    if (personal && value === null) masked = null
    else if (personal && typeof value === "string") masked = maskText(value)
    return masked
}

/** The lead facts that are personal data. */
const PII_SET: ReadonlySet<string> = new Set(PII_FACTS)

const sensitivityOfName = (name: string): Sensitivity | null => {
    if (SECRET_NAMES.test(name)) return "secret"
    return PII_NAMES.test(name) ? "pii" : null
}

const maskedRecord = (
    record: JsonObject,
    declared: Readonly<Record<string, Sensitivity>>,
    prefix: string,
): JsonValue =>
    Object.fromEntries(
        Object.entries(record).map(([name, member]) => {
            const path = prefix === "" ? name : `${prefix}.${name}`
            const sensitivity = declared[path] ?? sensitivityOfName(name)
            return [name, sensitivity === null ? maskJson(member, declared, path) : maskValue(member, sensitivity)]
        }),
    )

/** A JSON value masked for display, by the declared sensitive paths and by the names of its members; file refs stay as they are. */
export const maskJson = (
    value: JsonValue,
    declared: Readonly<Record<string, Sensitivity>> = {},
    prefix: string = "",
): JsonValue => {
    let masked: JsonValue = value
    if (Array.isArray(value)) masked = value.map((member: JsonValue) => maskJson(member, declared, prefix))
    else if (isJsonObject(value) && !isFileRef(value)) masked = maskedRecord(value, declared, prefix)
    return masked
}

/** A snapshot as display reads it: personal lead facts and every sensitive member of an outcome masked. */
export const maskSnapshot = (
    snapshot: LeadMemorySnapshot,
    sensitiveOf: (namespace: string, nodeKey: string) => Readonly<Record<string, Sensitivity>> = () => ({}),
): LeadMemorySnapshot => ({
    subject: snapshot.subject,
    lead: Object.fromEntries(
        Object.entries(snapshot.lead).map(([fact, value]) => [
            fact,
            PII_SET.has(fact) ? maskValue(value, "pii") : value,
        ]),
    ),
    workflows: Object.fromEntries(
        Object.entries(snapshot.workflows).map(([namespace, steps]) => [
            namespace,
            Object.fromEntries(
                Object.entries(steps).map(([nodeKey, memory]) => [
                    nodeKey,
                    { ...memory, output: maskJson(memory.output, sensitiveOf(namespace, nodeKey)) },
                ]),
            ),
        ]),
    ),
})

// ---------------------------------------------------------------------------------------------------------------------------------
// One binding place: a graph node's params feed both schemas of its node
// ---------------------------------------------------------------------------------------------------------------------------------

/** The keys of an object schema, or null for a schema that is not an object (it takes whatever it is given). */
export const schemaKeysOf = (schema: z.ZodType): ReadonlySet<string> | null =>
    schema instanceof z.ZodObject ? new Set(Object.keys(schema.shape)) : null

/** The two schemas of a node that bindings are split between. */
export interface BindingTarget {
    /** The schema of the node's settings. */
    readonly params: z.ZodType
    /** The schema of the node's data. */
    readonly input: z.ZodType
}

/** Resolved bindings split into the node's settings and its data. */
export interface SplitBindings {
    /** The members that are settings. */
    readonly params: Readonly<Record<string, unknown>>
    /** The members that are data. */
    readonly input: Readonly<Record<string, unknown>>
}

/**
 * A graph node's resolved bindings split between its node's two schemas: the members its `params` schema has are settings, the members its
 * `input` schema has are data; a member both have goes to both. The legacy `input` bindings, resolved apart, are laid under the data
 * (`params` wins on a clash). A schema that is not an object takes every member.
 */
export const splitBindings = (
    node: BindingTarget,
    resolved: Readonly<Record<string, unknown>>,
    legacyInput: Readonly<Record<string, unknown>> = {},
): SplitBindings => {
    const settings = schemaKeysOf(node.params)
    const data = schemaKeysOf(node.input)
    const pick = (keys: ReadonlySet<string> | null): Readonly<Record<string, unknown>> =>
        Object.fromEntries(Object.entries(resolved).filter(([name]) => keys === null || keys.has(name)))
    return { params: pick(settings), input: { ...legacyInput, ...pick(data) } }
}
