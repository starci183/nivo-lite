import {
    CALL_WORKFLOW_STEP,
    LATEST_VERSION,
    TRIGGER_SOURCE_KINDS,
    contractProblems,
    entryProblems,
    outcomeEndsOf,
    outcomeProblems,
    triggerProblems,
    wakesOfTriggers,
} from "@nivo-lite/agent-sdk/graph"
import type { ContractProblem, GraphSpec, GraphSpecNode, TriggerSourceKind } from "@nivo-lite/agent-sdk/graph"
import { coreNodes } from "@nivo-lite/blocks-core"
import type { StepBinding } from "@/modules/types"

/*
 * The structural edits of the step drawer, pure: a new step, a param binding, an input's source, a hand-off's target.
 * Each answers a new graph; the drawer saves the whole graph as the workflow's next version, which the back end judges again.
 */

/** The key of the pseudo step that stands for the workflow's inputs on the map. */
export const TRIGGER_KEY = "trigger"

/** The members of a node's params whose own members are the bindings: a hand-off's `inputs`, an outcome's `outputs`. */
export const NESTED_MEMBERS: ReadonlyArray<string> = ["inputs", "outputs"]

const ROLES: ReadonlyMap<string, GraphSpecNode["kind"]> = new Map(coreNodes.map((node) => [node.id, node.role]))

/** The node role of a step id; an unknown step is an output. */
const roleOf = (step: string): GraphSpecNode["kind"] => ROLES.get(step) ?? "output"

/** A key for a new node of `step` that the graph does not hold yet: the last word of the step id, numbered when taken. */
export const newKeyOf = (spec: GraphSpec, step: string): string => {
    const base = (step.split(".").at(-1) ?? "step").replace(/[^a-z0-9-]/g, "-").replace(/^[^a-z]+/, "") || "step"
    const taken = new Set(spec.nodes.map((node) => node.key))
    if (!taken.has(base)) return base
    for (let number = 2; ; number += 1) if (!taken.has(`${base}-${number}`)) return `${base}-${number}`
}

/** The fresh params of a new step: a hand-off starts with an empty mapping, an outcome with no outputs, anything else with none. */
const freshParamsOf = (step: string): GraphSpecNode["params"] => {
    if (step === CALL_WORKFLOW_STEP) return { agent: "sales", workflow: "consult", version: LATEST_VERSION, inputs: {} }
    if (step === "core.outcome") return { outcome: "", outputs: {} }
    return {}
}

/** A new node of `step` under `key`. */
const nodeOf = (key: string, step: string): GraphSpecNode => ({ key, kind: roleOf(step), step, params: freshParamsOf(step) })

/**
 * The graph with a new step after `afterKey`: the new step takes the next of the one before and that one points at it. After the
 * trigger, it becomes the first step. After a condition (whose ways are its routes), it is added unlinked, for a branch to point at.
 */
export const withStepAfter = (spec: GraphSpec, afterKey: string, step: string): { readonly spec: GraphSpec; readonly key: string } => {
    const key = newKeyOf(spec, step)
    if (afterKey === TRIGGER_KEY) {
        const first = spec.nodes[0]
        const added = { ...nodeOf(key, step), ...(first === undefined ? {} : { next: first.key }) }
        return { spec: { ...spec, nodes: [added, ...spec.nodes] }, key }
    }
    const after = spec.nodes.find((node) => node.key === afterKey)
    if (after === undefined || after.kind === "condition") return { spec: { ...spec, nodes: [...spec.nodes, nodeOf(key, step)] }, key }
    const added = { ...nodeOf(key, step), ...(after.next === undefined ? {} : { next: after.next }) }
    const nodes = spec.nodes.flatMap((node) => (node.key === afterKey ? [{ ...node, next: key }, added] : [node]))
    return { spec: { ...spec, nodes }, key }
}

/** A binding as the graph stores it: a ref `{ $ref }`, or the fixed value (a number when it reads as one). */
const storedOf = (binding: StepBinding): unknown => {
    if (binding.kind === "ref") return { $ref: binding.ref }
    const number = Number(binding.value)
    return binding.value.trim() !== "" && Number.isFinite(number) ? number : binding.value
}

/** The graph with one param of a node bound: `name`, or `inputs.<name>` / `outputs.<name>` inside a hand-off or an outcome. */
export const withBinding = (spec: GraphSpec, nodeKey: string, name: string, binding: StepBinding): GraphSpec => {
    const [head = "", ...rest] = name.split(".")
    const nested = rest.length > 0 && NESTED_MEMBERS.includes(head)
    return {
        ...spec,
        nodes: spec.nodes.map((node) => {
            if (node.key !== nodeKey) return node
            const params: Readonly<Record<string, unknown>> = node.params ?? {}
            if (!nested) return { ...node, params: { ...params, [name]: storedOf(binding) } as GraphSpecNode["params"] }
            const inner: unknown = params[head]
            const members = typeof inner === "object" && inner !== null && !Array.isArray(inner) ? inner : {}
            return {
                ...node,
                params: { ...params, [head]: { ...members, [rest.join(".")]: storedOf(binding) } } as GraphSpecNode["params"],
            }
        }),
    }
}

const isSourceKind = (text: string): text is TriggerSourceKind => TRIGGER_SOURCE_KINDS.some((kind) => kind === text)

/** The graph with the source of one input changed (any connection of the kind); the wake envelope follows the inputs. */
export const withSource = (spec: GraphSpec, triggerKey: string, source: string): GraphSpec => {
    if (!isSourceKind(source) || spec.triggers === undefined) return spec
    const triggers = spec.triggers.map((trigger) =>
        trigger.key === triggerKey ? { ...trigger, source: { kind: source, connectionId: null } } : trigger,
    )
    return { ...spec, triggers, trigger: { ...spec.trigger, sources: wakesOfTriggers(triggers) } }
}

/** The graph with the open hand-off calling `<agent>.<workflow>` at its latest version; the mapping is kept. */
export const withCallTarget = (spec: GraphSpec, nodeKey: string, target: string): GraphSpec => {
    const [agent = "", workflow = ""] = target.split(".")
    return {
        ...spec,
        nodes: spec.nodes.map((node) =>
            node.key === nodeKey
                ? { ...node, params: { ...node.params, agent, workflow, version: LATEST_VERSION } as GraphSpecNode["params"] }
                : node,
        ),
    }
}

/** The contract problems of a graph the drawer can name before the back end does: its inputs, triggers, outcomes and entry rule. */
export const localContractProblems = (spec: GraphSpec | null | undefined): ReadonlyArray<ContractProblem> =>
    spec === null || spec === undefined
        ? []
        : [
              ...contractProblems(spec.contract),
              ...triggerProblems(spec.triggers, spec.trigger?.sources ?? [], spec.contract),
              ...outcomeProblems(spec.outcomes, outcomeEndsOf(spec.nodes ?? [])),
              ...entryProblems(spec.entry, spec.contract),
          ]
