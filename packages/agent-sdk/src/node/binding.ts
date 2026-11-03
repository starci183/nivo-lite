import type { JsonValue } from "../schema/schema.types"

/** The source every graph may reference: what woke the run. Any other source is the key of an upstream graph node. */
export const TRIGGER_SOURCE = "trigger"

/** A reference to a value: `trigger.<path>` or `<nodeKey>.<path>`; the bare source is the whole value. */
export interface NodeInputRef {
    readonly $ref: string
}

/** How a graph node fills one input field: a literal, or a reference. */
export type NodeInputBinding = JsonValue | NodeInputRef

/** The input bindings of a graph node, by field. */
export type NodeInputBindings = Readonly<Record<string, NodeInputBinding>>

/** What references resolve against: the trigger and the outputs of the nodes done before, by node key. */
export interface NodeInputScope {
    readonly trigger: unknown
    readonly steps: Readonly<Record<string, unknown>>
}

/** Whether a binding is a reference. */
export const isInputRef = (binding: NodeInputBinding): binding is NodeInputRef =>
    typeof binding === "object" && binding !== null && !Array.isArray(binding) && "$ref" in binding

/** The member at a dotted path, or undefined when any step is missing. */
const at = (value: unknown, path: ReadonlyArray<string>): unknown =>
    path.reduce<unknown>(
        (current, name) =>
            typeof current === "object" && current !== null ? (current as Record<string, unknown>)[name] : undefined,
        value,
    )

/** The source a reference names: `trigger` or a node key. */
export const sourceOfRef = (ref: NodeInputRef): string => ref.$ref.split(".", 1).join("")

/** The sources the bindings reference, once each. */
export const inputSourcesOf = (bindings: NodeInputBindings): ReadonlyArray<string> => [
    ...new Set(Object.values(bindings).flatMap((binding) => (isInputRef(binding) ? [sourceOfRef(binding)] : []))),
]

/** The value of one reference; undefined when its source or path is missing. */
const valueOf = (ref: NodeInputRef, scope: NodeInputScope): unknown => {
    const [source = "", ...path] = ref.$ref.split(".")
    const root = source === TRIGGER_SOURCE ? scope.trigger : scope.steps[source]
    return at(root, path)
}

/** The input a node receives: each literal as written, each reference read from the scope. A missing value is left out. */
export const resolveInput = (
    bindings: NodeInputBindings,
    scope: NodeInputScope,
): Readonly<Record<string, unknown>> =>
    Object.fromEntries(
        Object.entries(bindings).flatMap(([field, binding]) => {
            const value = isInputRef(binding) ? valueOf(binding, scope) : binding
            return value === undefined ? [] : [[field, value]]
        }),
    )
