/** The source every graph may reference: what woke the run. Any other source is the key of an upstream graph node. */
export const TRIGGER_SOURCE = "trigger"

/** A reference to a value: `trigger.<path>` or `<nodeKey>.<path>`; the bare source is the whole value, a number steps into a list. */
export interface NodeInputRef {
    /** The reference path, `trigger.<path>` or `<nodeKey>.<path>`. */
    readonly $ref: string
}

/** How a graph node fills one input value: a literal, a reference, or a list or object of either, at any depth. */
export type NodeInputBinding =
    | string
    | number
    | boolean
    | null
    | NodeInputRef
    | ReadonlyArray<NodeInputBinding>
    | { readonly [key: string]: NodeInputBinding }

/** The input bindings of a graph node, by field. */
export type NodeInputBindings = Readonly<Record<string, NodeInputBinding>>

/** What references resolve against: the trigger and the outputs of the nodes done before, by node key. */
export interface NodeInputScope {
    /** What woke the run; the value that `trigger.<path>` references read from. */
    readonly trigger: unknown
    /** The outputs of the nodes already done, by node key. */
    readonly steps: Readonly<Record<string, unknown>>
}

/** Whether a binding is a reference. */
export const isInputRef = (binding: NodeInputBinding): binding is NodeInputRef =>
    typeof binding === "object" && binding !== null && !Array.isArray(binding) && "$ref" in binding

/** The member at a dotted path, or undefined when any step is missing. */
const at = (value: unknown, path: ReadonlyArray<string>): unknown =>
    path.reduce<unknown>(
        (current, name) => (typeof current === "object" && current !== null ? Reflect.get(current, name) : undefined),
        value,
    )

/** The source a reference names: `trigger` or a node key. */
export const sourceOfRef = (ref: NodeInputRef): string => ref.$ref.split(".", 1).join("")

/** Every reference inside a binding, at any depth. */
const refsOf = (binding: NodeInputBinding): ReadonlyArray<NodeInputRef> => {
    if (isInputRef(binding)) return [binding]
    if (typeof binding !== "object" || binding === null) return []
    return Object.values(binding).flatMap((entry) => refsOf(entry))
}

/** The sources the bindings reference, at any depth, once each. */
export const inputSourcesOf = (bindings: NodeInputBindings): ReadonlyArray<string> => [
    ...new Set(Object.values(bindings).flatMap((entry) => refsOf(entry)).map((entry) => sourceOfRef(entry))),
]

/** The value of one reference: null when its source or path is missing, so a run never stops on an absent value. */
const valueOf = (ref: NodeInputRef, scope: NodeInputScope): unknown => {
    const [source = "", ...path] = ref.$ref.split(".")
    const root = source === TRIGGER_SOURCE ? scope.trigger : scope.steps[source]
    return at(root, path) ?? null
}

/** One binding resolved: a reference read from the scope, a list or object resolved member by member, a literal as written. */
const resolved = (binding: NodeInputBinding, scope: NodeInputScope): unknown => {
    if (isInputRef(binding)) return valueOf(binding, scope)
    if (Array.isArray(binding)) return binding.map((member: NodeInputBinding) => resolved(member, scope))
    if (typeof binding !== "object" || binding === null) return binding
    return Object.fromEntries(Object.entries(binding).map(([name, member]) => [name, resolved(member, scope)]))
}

/** The input a node receives: every reference, at any depth, read from the scope; a missing value is null. */
export const resolveInput = (bindings: NodeInputBindings, scope: NodeInputScope): Readonly<Record<string, unknown>> =>
    Object.fromEntries(Object.entries(bindings).map(([field, binding]) => [field, resolved(binding, scope)]))
