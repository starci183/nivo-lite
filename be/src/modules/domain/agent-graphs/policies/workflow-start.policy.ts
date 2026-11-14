import { z } from "zod"
import { CONTRACT_TYPES, callInputsOf, workflowContractSchema, type ContractType, type WorkflowContract } from "@nivo-lite/agent-sdk/graph"

/** The trigger source kind of a workflow's `workflow.called` trigger (the engine road a hand-off, and a person's start, wakes it on). */
const CALLED_SOURCE = "workflow"

/**
 * The most JSON text a person's start may hand its workflow as inputs (they ride in the queued job and then on the wake's context); a
 * larger object is refused before anything is written.
 */
export const WORKFLOW_START_INPUTS_MAX = 8000

/** Why a person may not start a workflow. */
export type WorkflowStartRefusal = "not_active" | "not_callable" | "agent_only" | "graph_unreadable"

/** Whether a person may start a workflow, with its declared contract when they may. */
export type WorkflowRunnable =
    | { readonly runnable: true; readonly contract: WorkflowContract }
    | { readonly runnable: false; readonly refusal: WorkflowStartRefusal }

/** One problem of the inputs a run was given: the input's name and what is wrong with it. */
export interface WorkflowInputIssue {
    /** The input's name. */
    readonly at: string
    /** `required` (missing), `unknown` (not declared), `type` (another JSON type). */
    readonly code: "required" | "unknown" | "type"
}

/** What a start reads of the stored graph: its contract, its triggers' source kinds and who may call it. */
const startableGraph = z.looseObject({
    contract: z
        .looseObject({
            inputs: z.array(z.looseObject({ name: z.string(), type: z.enum(CONTRACT_TYPES), required: z.boolean() })),
        })
        .optional(),
    triggers: z.array(z.looseObject({ source: z.looseObject({ kind: z.string() }) })).optional(),
    entry: z.looseObject({ openTo: z.enum(["any", "agent"]) }).optional(),
})

/** The stored graph JSON as JSON, or undefined when it is none. */
const jsonOf = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

/**
 * Whether a person may start the workflow whose running graph this is (its JSON text) and status: only an ACTIVE workflow, through
 * its own `workflow.called` trigger (a graph that registers none is never started by hand), and only one open to any caller (a
 * workflow open to its own agent's workflows only is called by none but them). A graph with no contract takes no input.
 */
export const runnableOf = (graphJson: string, status: string): WorkflowRunnable => {
    const parsed = startableGraph.safeParse(jsonOf(graphJson))
    if (!parsed.success) return { runnable: false, refusal: "graph_unreadable" }
    if (status !== "active") return { runnable: false, refusal: "not_active" }
    const graph = parsed.data
    if (!(graph.triggers ?? []).some((trigger) => trigger.source.kind === CALLED_SOURCE))
        return { runnable: false, refusal: "not_callable" }
    if (graph.entry?.openTo === "agent") return { runnable: false, refusal: "agent_only" }
    // The inputs a caller maps: the `data` input's members of a callee whose scope is generic (the SDK's `callInputsOf`), else its inputs.
    const declared = workflowContractSchema.safeParse(graph.contract)
    const given = declared.success ? callInputsOf(declared.data) : (graph.contract?.inputs ?? [])
    const inputs = given.map(({ name, type, required }) => ({ name, type, required }))
    return { runnable: true, contract: { inputs } }
}

/** The JSON Schema of a declared input contract: each input with its JSON type, the required ones required, nothing else taken. */
export const workflowInputSchemaOf = (contract: WorkflowContract): Readonly<Record<string, unknown>> => ({
    type: "object",
    properties: Object.fromEntries(contract.inputs.map((input) => [input.name, { type: input.type }])),
    required: contract.inputs.filter((input) => input.required).map((input) => input.name),
    additionalProperties: false,
})

/** True when a JSON value is of the contract type (an integer fills a number). */
const fits = (type: ContractType, value: unknown): boolean => {
    switch (type) {
        case "string":
            return typeof value === "string"
        case "number":
            return typeof value === "number" && Number.isFinite(value)
        case "integer":
            return typeof value === "number" && Number.isSafeInteger(value)
        case "boolean":
            return typeof value === "boolean"
        case "object":
            return typeof value === "object" && value !== null && !Array.isArray(value)
        case "array":
            return Array.isArray(value)
    }
}

/**
 * The problems of the inputs a run is given against the declared contract, in contract order then the undeclared names: a required
 * input missing (null reads as not given), one of another JSON type, a name the contract does not declare. Empty when they fit.
 */
export const workflowInputIssuesOf = (
    contract: WorkflowContract,
    inputs: Readonly<Record<string, unknown>>,
): ReadonlyArray<WorkflowInputIssue> => {
    const declared = new Set(contract.inputs.map((input) => input.name))
    const own = contract.inputs.flatMap((input): ReadonlyArray<WorkflowInputIssue> => {
        const value = inputs[input.name]
        if (value === undefined || value === null) return input.required ? [{ at: input.name, code: "required" }] : []
        return fits(input.type, value) ? [] : [{ at: input.name, code: "type" }]
    })
    const unknown = Object.keys(inputs)
        .filter((name) => !declared.has(name))
        .map((name): WorkflowInputIssue => ({ at: name, code: "unknown" }))
    return [...own, ...unknown]
}
