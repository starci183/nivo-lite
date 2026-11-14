import {
    graphRefProblems,
    graphSpecProblems,
    isContractProblem,
    refProblemText,
    specRefContextOf,
    triggerProblems,
    type GraphNodeAccountMode,
    type GraphSpec,
    type GraphSpecV2,
} from "@nivo-lite/agent-sdk/graph"
import { CONTRACT_VIEWS } from "./contract-views.policy"
import type { NodeIndex } from "@nivo-lite/agent-sdk/node"
import {
    type TemplateAgent,
    VERB_SHARED_REFUSED,
    sharedVerbProblems,
    templateGraphProblems,
} from "@nivo-lite/agent-sdk/template"
import { INSTALLED, TEMPLATE_IF_STEP, TEMPLATE_UNTIL_STEP, TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"
import { providerTriggerLookup } from "@modules/domain/provider-triggers"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import type { GraphDocument } from "../agent-graphs.contracts"
import { AGENT_GRAPHS_MESSAGES } from "../messages/agent-graphs.messages"
import { toolsOutsideAgent, withDefaultReads } from "./agent-tools.policy"
import { graphLoopProblemsOf } from "./graph-loops.policy"
import { nodeAccountLookup } from "./node-accounts.policy"
import { askCalledWritesProblems, templateToolLookupOf, templateTriggerLookup } from "./template-lookups.policy"

/** The text of a value with the keys of every object in order: the database keeps a document with its keys in its own order, so equal content must compare equal. */
const canonicalText = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalText(item)).join(",")}]`
    if (value === null || typeof value !== "object") return String(JSON.stringify(value))
    const entries = Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
    const members = entries.map(([key, member]) => JSON.stringify(key) + ":" + canonicalText(member))
    return "{" + members.join(",") + "}"
}

/** True when a graph already runs this flow, whatever the order of the keys of either. */
export const sameFlow = (held: GraphSpec | undefined, wanted: GraphSpec): boolean =>
    held !== undefined && canonicalText(held) === canonicalText(wanted)

/** True when a graph's flow changes: one is added, dropped, or holds other content. */
export const flowChanged = (held: GraphSpec | undefined, wanted: GraphSpec | undefined): boolean =>
    wanted === undefined ? held !== undefined : !sameFlow(held, wanted)

/** The tool set the module of a flow declares for its agent, or null when the module declares no agent. */
export const agentToolsOf = (moduleKey: string): ReadonlyArray<string> | null => INSTALLED.agentToolsOf(moduleKey)

/**
 * The trigger problems of a flow read from a @2 graph that its DERIVED registrations raise: a condition (the graph's `where`, carried onto
 * every derived source, or the verb's own meaning on a source) naming a member that source does not supply (`TRIGGER_CONDITION_UNKNOWN`),
 * or one a provider does not let a registration filter on (`TRIGGER_FILTER_INVALID`). The @2 checks judge the rest of a trigger.
 */
const DERIVED_CONDITION_CODES: ReadonlySet<string> = new Set(["TRIGGER_CONDITION_UNKNOWN", "TRIGGER_FILTER_INVALID"])

/** One problem of a flow, whichever checks found it. */
export interface FlowProblem {
    readonly code: string
    readonly at: string
}

/**
 * The problem of a stored flow read from a template graph that is no installed template graph's copy any longer: a template graph's steps
 * are edited in its package, never here (the shop's own settings on its copy aside, `isCopyOf`).
 */
export const GRAPH_TEMPLATE_EDITED = "GRAPH_TEMPLATE_EDITED"

/** True for a word that is one node mode (`GraphSpecNode.mode`). */
const isMode = (mode: unknown): mode is GraphNodeAccountMode => mode === "auto" || mode === "ask"

/**
 * True when a stored flow is the copy of a template graph's flow (`template`, the graph as the install reads it): equal content for content
 * in everything but what the shop SETS on its own copy (nivo-frame `rights` rule 5): the ONE mode of a step whose template step states one
 * (a node step), set to `auto` or `ask`. A changed step, route, param, trigger or a mode on a step the template gives none is an edit.
 */
const isCopyOf = (template: GraphSpec, flow: GraphSpec): boolean => {
    const settable = new Set(template.nodes.filter((node) => node.mode !== undefined).map((node) => node.key))
    const settingsCleared = (graph: GraphSpec): GraphSpec => ({
        ...graph,
        nodes: graph.nodes.map((node) => (settable.has(node.key) && isMode(node.mode) ? { ...node, mode: undefined } : node)),
    })
    return sameFlow(settingsCleared(template), settingsCleared(flow))
}

/** The template graph with the shop's settings of its stored copy applied: each node step's mode as the copy states it. */
const withSettingsOf = (spec: GraphSpecV2, flow: GraphSpec): GraphSpecV2 => {
    const modes = new Map(flow.nodes.flatMap((node) => (isMode(node.mode) ? [[node.key, node.mode] as const] : [])))
    const [first, ...rest] = spec.nodes.map((step) =>
        step.kind === "node" ? { ...step, mode: modes.get(step.key) ?? step.mode } : step,
    )
    return first === undefined ? spec : { ...spec, nodes: [first, ...rest] }
}

/** True for a flow read from a @2 graph (`graphOfSpecV2`): one of its steps is a template node or the engine's `if`. */
export const isTemplateFlow = (flow: GraphSpec): boolean =>
    flow.nodes.some(
        (node) =>
            node.step === TEMPLATE_IF_STEP ||
            node.step === TEMPLATE_UNTIL_STEP ||
            node.step === TEMPLATE_WAIT_STEP ||
            INSTALLED.templateNodeOf(node.step) !== null,
    )

/**
 * The problems of a flow read from a @2 graph, or null for a flow of `defineNode` nodes (the `@1` checks judge it). The flow must be the
 * COPY of the one an installed template graph of its module reads as (`isCopyOf`: content for content, the shop's own node modes aside;
 * else `GRAPH_TEMPLATE_EDITED`); that graph, with the copy's modes (`withSettingsOf`), is then judged by the SDK's `templateGraphProblems`
 * with the engine's lookups (known tools, provider owners, money tools, what each verb supplies) and
 * its agent's providers, every tool of its nodes must be in what its module's agent may call (`GRAPH_TOOL_OUTSIDE_AGENT`) when the
 * module declares an agent, every condition its derived registrations carry must read a member its source supplies, and a trigger verb
 * it shares with another graph of its agent must be keyed apart by disjoint exact conditions (`TRIGGER_VERB_SHARED`, judged on the
 * installed template agent while `VERB_SHARED_REFUSED`: install, seed and every publish of a template flow pass here), and a step on
 * `ask` calls at most one write, the default tools its node's examples call counted (`askCalledWritesProblems`, `NODE_ASK_WRITES_MANY`).
 */
export const templateFlowProblems = (flow: GraphSpec): ReadonlyArray<FlowProblem> | null => {
    if (!isTemplateFlow(flow)) return null
    const held = INSTALLED.templatesOf(flow.moduleKey).find(
        (template) =>
            INSTALLED.templateGraphOf(template.id) !== null && template.versions.some((version) => isCopyOf(version.graph, flow)),
    )
    const found = held === undefined ? null : INSTALLED.templateGraphOf(held.id)
    if (found === null) return [{ code: GRAPH_TEMPLATE_EDITED, at: flow.moduleKey }]
    const { agent } = found
    const graph = { ...found.graph, spec: withSettingsOf(found.graph.spec, flow) }
    const declared = agentToolsOf(flow.moduleKey)
    // What the agent may call is the set the run-time grant bounds every run by (`withDefaultReads`: the declared set and the default
    // reads every agent holds); a control step's own effect is the engine's and no template node's tool, so it is not judged here.
    const allowed = declared === null ? null : new Set(withDefaultReads(declared))
    const outside =
        allowed === null
            ? []
            : [...graph.nodes.values()].flatMap((node) =>
                  node.tools
                      .filter((tool) => !allowed.has(tool))
                      .map((tool): FlowProblem => ({ code: "GRAPH_TOOL_OUTSIDE_AGENT", at: `${node.id}.tools.${tool}` })),
              )
    const conditions = triggerProblems(flow.triggers, flow.contract, providerTriggerLookup).filter((problem) =>
        DERIVED_CONDITION_CODES.has(problem.code),
    )
    return [
        ...templateGraphProblems(graph.spec, {
            nodes: graph.nodes,
            agentAccounts: agent.accounts,
            tools: templateToolLookupOf(),
            triggers: templateTriggerLookup,
        }),
        // A step on `ask` whose node CALLS more than one write (its declared tools and the default record / file tools its examples call).
        ...askCalledWritesProblems(graph.spec, graph.nodes),
        ...outside,
        ...conditions,
        ...sharedVerbsOf(agent, graph.key),
    ]
}

/** The `TRIGGER_VERB_SHARED` problems of one graph of a template agent, the verb, the graphs and why carried in `at`. */
const sharedVerbsOf = (agent: Pick<TemplateAgent, "key" | "graphs">, graphKey: string): ReadonlyArray<FlowProblem> =>
    VERB_SHARED_REFUSED
        ? sharedVerbProblems(agent)
              .filter((problem) => problem.at.startsWith(`${agent.key}.graphs.${graphKey}.triggers.`))
              .map((problem) => ({ code: problem.code, at: `${problem.at} (${problem.detail ?? ""})` }))
        : []

/**
 * The mode problems of a stored flow (nivo-frame `rights`: every node declares ONE mode `auto | ask`; the engine has no default): a node
 * that carries the node contract (`accounts`) and states no mode (its `mode`, or on a stored legacy node its accounts' `operations`), or a word
 * that is neither, is `NODE_MODE_UNSTATED` at `<key>.mode`.
 */
export const modeProblemsOf = (flow: GraphSpec): ReadonlyArray<FlowProblem> =>
    flow.nodes.flatMap((node): ReadonlyArray<FlowProblem> => {
        if (node.accounts === undefined) return []
        const own: unknown = node.mode
        const carried: ReadonlyArray<unknown> = node.accounts.flatMap((account) => Object.values(account.operations ?? {}))
        const stated =
            own === undefined
                ? carried.length > 0 && carried.every((mode) => mode === "auto" || mode === "ask")
                : own === "auto" || own === "ask"
        return stated ? [] : [{ code: NODE_MODE_UNSTATED, at: `${node.key}.mode` }]
    })

/** The problem of a node that states no mode. */
export const NODE_MODE_UNSTATED = "NODE_MODE_UNSTATED"

/** The problems a flow is refused for at a seed's check: the @2 checks for a flow read from a template graph, else the `@1` ones. */
export const flowProblemsOf = (flow: GraphSpec, installed: NodeIndex): ReadonlyArray<FlowProblem> => [
    ...(templateFlowProblems(flow) ?? graphSpecProblems(flow, installed, undefined, nodeAccountLookup)),
    ...modeProblemsOf(flow),
    // The engine's own loop and cycle checks, on every form: a cycle only through a loop, an until loop's cap, branch and condition.
    ...graphLoopProblemsOf(flow),
]

/**
 * Refuses a flow the installed nodes do not take, or whose steps reach a tool outside the tool set of its module's agent
 * (`GRAPH_TOOL_OUTSIDE_AGENT`), naming every problem, with nothing written: the one judgement every road that publishes a flow passes
 * (a member's publish and the seed alike).
 */
export const requireSoundFlow = (flow: GraphSpec, installed: NodeIndex): void => {
    // A flow read from a @2 graph is judged by the @2 checks alone: the `@1` ones know no template node.
    const template = templateFlowProblems(flow)
    // The engine's own loop and cycle checks judge every form, a raw document the SDK never saw included.
    const loops = [...graphLoopProblemsOf(flow), ...modeProblemsOf(flow)]
    if (template !== null || loops.length > 0) {
        const found = [...(template ?? []), ...loops]
        if (found.length === 0) return
        const listed = found.map((problem) => `${problem.code} ${problem.at}`).join(", ")
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.PublishRefused, params: { problems: listed } })
    }
    const all = graphSpecProblems(flow, installed, providerTriggerLookup, nodeAccountLookup)
    // The contract problems are the owner's to fix in the editor: refused with their own words, each one named.
    const contract = all.filter(isContractProblem)
    const [first] = contract
    if (first !== undefined) {
        throw new AgentGraphsError({
            code: AgentGraphsErrorCode.ContractRefused,
            params: {
                count: String(contract.length),
                first: CONTRACT_VIEWS.contractProblemText(first, "vi"),
                problems: JSON.stringify(contract),
            },
        })
    }
    const problems = [...all, ...toolsOutsideAgent(flow, installed, agentToolsOf(flow.moduleKey))]
    if (problems.length > 0) {
        const listed = problems.map((problem) => `${problem.code} ${problem.at}`).join(", ")
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.PublishRefused, params: { problems: listed } })
    }
    requireSoundRefs(flow, installed)
}

/**
 * Refuses a version whose params or refs are broken, by `graphRefProblems`: every problem in `problems` as JSON (code, node, field, ref,
 * i18n key and its fill-ins) for the editor to word in place, the first one worded in Vietnamese in `first`.
 */
export const requireSoundRefs = (flow: GraphSpec, installed: NodeIndex): void => {
    const problems = graphRefProblems(flow, specRefContextOf(flow, installed))
    const [first] = problems
    if (first === undefined) return
    throw new AgentGraphsError({
        code: AgentGraphsErrorCode.RefsRefused,
        params: { count: String(problems.length), first: refProblemText(first, AGENT_GRAPHS_MESSAGES.vi), problems: JSON.stringify(problems) },
    })
}
/** True for a graph that holds a flow and none of the old nodes: the flow runs the agent, so the old walk has nothing to judge and must not answer for it. */
export const isFlowOnly = (document: GraphDocument): boolean =>
    document.flow !== undefined && document.nodes.length === 0
