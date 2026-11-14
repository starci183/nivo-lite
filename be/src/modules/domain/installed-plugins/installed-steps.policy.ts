import { CALL_WORKFLOW_STEP, type ModelChoice } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { LOOP_STEP, OUTCOME_STEP, type LeadFact, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"

/** Which declaration a step is: a template node (`defineTemplateNode`, every business step since the flip) or a `defineNode` node. */
export type InstalledStepForm = "template" | "node"

/**
 * One installed step as every per-step decision reads it, WHICHEVER form declares it: the ONE view a title, the right to speak, a grant,
 * the boot check of the agent-loop flag (and every other reader that decides by step) goes through, so no reader sees only one form.
 */
export interface InstalledStep {
    /** The step id a graph places (`sales.consult-turn`, `core.call-workflow`). */
    readonly id: string
    /** The declaration it is. */
    readonly form: InstalledStepForm
    /**
     * True for a CONTROL step of the engine (the hand-off `core.call-workflow`, the outcome `core.outcome`, the list loop `core.for-each`):
     * its own effects (the hand-off's tag) are the engine's, granted by the step itself, never a member an agent must declare.
     */
    readonly control: boolean
    /** The words the editor and the owner's pages show for it. */
    readonly title: SpecText
    /**
     * Every call the step may make, each once, in its declaration's order: a `defineNode` node's effects then its tools; a template node's
     * tools (each call of a template node is a tool call, an effect id included).
     */
    readonly tools: ReadonlyArray<string>
    /** The calls among `tools` that are installed EFFECTS (the effect road): a `defineNode` node's `effects`; a template node's tools that name one. */
    readonly effects: ReadonlyArray<string>
    /** True when the step may send to the customer (it holds the customer send): it needs the right to speak in the conversation. */
    readonly sends: boolean
    /** The model the declaration itself names (a template node that calls `ctx.agent.run`), or null (a `defineNode` node names none here). */
    readonly model: ModelChoice | null
    /** The declaration's `blocking` (false: a side step that never blocks the customer's path), or undefined when it says none. */
    readonly blocking: boolean | undefined
    /** The lead facts its output proves, by fact then the dotted output path; empty when it proves none. */
    readonly facts: Readonly<Partial<Record<LeadFact, string>>>
}

/** A step id's installed step, or null for an id no installed declaration is. */
export type OptionalInstalledStep = InstalledStep | null

/** What the reader looks a step up in: both forms, and which call ids are installed effects. */
export interface InstalledStepLookups {
    /** The `defineNode` node of an id, or undefined. */
    readonly legacyNodeOf: (id: string) => NodeDefinition | undefined
    /** The template node of an id, or undefined (or null). */
    readonly templateNodeOf: (id: string) => AnyTemplateNode | null | undefined
    /** True for a call id that is an installed effect. */
    readonly isEffect: (id: string) => boolean
}

/** The engine's control steps (`defineNode` nodes the @2 adapter places for `callWorkflow`, `outcome` and `loop`). */
const CONTROL_STEPS: ReadonlySet<string> = new Set([CALL_WORKFLOW_STEP, OUTCOME_STEP, LOOP_STEP])

/** The customer send: the call that needs the right to speak. */
const CUSTOMER_SEND: string = TOOL.customerMessageSend

const NO_FACTS: Readonly<Partial<Record<LeadFact, string>>> = {}

/** A template node as the view. */
const ofTemplate = (node: AnyTemplateNode, isEffect: (id: string) => boolean): InstalledStep => {
    const tools: ReadonlyArray<string> = [...new Set<string>(node.tools)]
    return {
        id: node.id,
        form: "template",
        control: false,
        title: node.title,
        tools,
        effects: tools.filter((tool) => isEffect(tool)),
        sends: tools.includes(CUSTOMER_SEND),
        model: node.model ?? null,
        blocking: node.blocking,
        facts: node.facts ?? NO_FACTS,
    }
}

/**
 * A `defineNode` node as the view. Its calls are read when a reader asks for them (getters), so a reader of the title alone reads nothing
 * else of the declaration.
 */
const ofLegacy = (node: NodeDefinition): InstalledStep => {
    const callsOf = (): ReadonlyArray<string> => [...new Set<string>([...node.effects, ...(node.tools ?? [])])]
    return {
        id: node.id,
        form: "node",
        control: CONTROL_STEPS.has(node.id),
        title: node.title,
        get tools(): ReadonlyArray<string> {
            return callsOf()
        },
        get effects(): ReadonlyArray<string> {
            return [...node.effects]
        },
        get sends(): boolean {
            return callsOf().includes(CUSTOMER_SEND)
        },
        model: null,
        blocking: node.blocking,
        facts: node.facts ?? NO_FACTS,
    }
}

/**
 * The installed step of an id, or null when neither form declares it. The two forms never share an id in an installation (the control
 * steps are `defineNode` nodes, every business step a template node: `installed-steps.policy.spec.ts` proves it), so the `defineNode`
 * node the caller's index holds is read first (an index may add a test's fixture nodes), then the template node. Pure.
 */
export const installedStepOf = (id: string, lookups: InstalledStepLookups): OptionalInstalledStep => {
    const legacy = lookups.legacyNodeOf(id)
    if (legacy !== undefined) return ofLegacy(legacy)
    const template = lookups.templateNodeOf(id)
    return template === null || template === undefined ? null : ofTemplate(template, lookups.isEffect)
}

/** The effects the engine's control steps run themselves (the hand-off's tag), from their installed declarations. */
export const controlEffectsOf = (legacyNodeOf: (id: string) => NodeDefinition | undefined): ReadonlySet<string> =>
    new Set([...CONTROL_STEPS].flatMap((id) => legacyNodeOf(id)?.effects ?? []))
