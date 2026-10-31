import type { Locale } from "@modules/platform/i18n"
import { MAX_DOES_LENGTH, MAX_TITLE_LENGTH, kindOfStep } from "../agent-graphs.contracts"
import type { GraphDocument, GraphNode, GraphSource, NodeAnswerKey, Say, ToolUse } from "../agent-graphs.contracts"
import type { SeedAction, SeedModule, SeedRule, SeedTemplate } from "../agent-graphs-seed.contracts"
import { approverOfRule, branchesFromRule } from "./seed-from-rules.policy"

const PROVIDERS: ReadonlyArray<ToolUse["provider"]> = ["brain", "drive", "sepay", "zalo", "telegram", "office", "mcp"]

/** The language of the graph being written: the locale that picks a name from the catalogue data and the lookup of the wording. */
export interface Voice {
    /** The language of the workspace. */
    readonly locale: Locale
    /** Looks a sentence of the message catalog up in that language. */
    readonly say: Say
}

const wordsOf = (voice: Voice) => (key: string): string => voice.say(`agentGraphs.base.${key}`)

const ANSWERS: ReadonlyArray<NodeAnswerKey> = ["knows", "uses", "reads", "writes", "sources"]

const clipped = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text

/** A node with every answer present: what is empty is marked "None" on purpose, so a seed is never blank. */
const nodeOf = (
    key: string,
    step: GraphNode["step"],
    title: string,
    does: string,
    extra: Partial<GraphNode>,
): GraphNode => {
    const base: GraphNode = {
        key,
        kind: kindOfStep(step),
        step,
        title: clipped(title, MAX_TITLE_LENGTH),
        doneBy: step === "call" ? "agent" : "nivo",
        knows: [],
        does: clipped(does, MAX_DOES_LENGTH),
        uses: [],
        reads: [],
        writes: [],
        approver: null,
        sources: [],
        none: [],
        next: [],
        ...extra,
    }
    return { ...base, none: ANSWERS.filter((answer) => base[answer].length === 0) }
}

const toolsOf = (module: SeedModule): ReadonlyArray<ToolUse> =>
    module.connectionProviders.flatMap((provider) => {
        const known = PROVIDERS.find((entry) => entry === provider)
        return known === undefined ? [] : [{ provider: known, tool: null, scope: "read" as const, label: provider }]
    })

const factOf = (action: SeedAction): string => action.graphFacts?.[0] ?? `${action.action}.amount_vnd`

/** True when the rule leaves the action to run alone with no condition at all, so no person is ever asked. */
const runsAlone = (rule: SeedRule | undefined): boolean =>
    rule?.mode === "auto" && rule.auto_max === null && rule.ask_max === null && rule.limit_vnd === null

/** The nodes of one action, the first being where its work enters: the decide point, or the approval, or the act itself. */
const nodesOfAction = (
    action: SeedAction,
    rule: SeedRule | undefined,
    voice: Voice,
    end: string,
): ReadonlyArray<GraphNode> => {
    const w = wordsOf(voice)
    const label = action.label[voice.locale]
    const sources: ReadonlyArray<GraphSource> = [{ kind: "rule", action: action.action }]
    const act = nodeOf(`act:${action.action}`, "write", label, label, { action: action.action, sources, next: [end] })
    const approve = nodeOf(`ask:${action.action}`, "approval", w("ask"), w("askDoes"), {
        doneBy: "person",
        approver: rule === undefined ? null : approverOfRule(rule),
        sources,
        next: [act.key],
    })
    const stop = nodeOf(`stop:${action.action}`, "stop", w("stop"), w("stopDoes"), { sources })
    const amountLimited = action.amountLimit && rule?.unit === "vnd" && action.maxMode === null
    if (amountLimited) {
        const targets = { auto: act.key, ask: approve.key, stop: stop.key }
        const decide = nodeOf(`decide:${action.action}`, "evaluate", w("decide"), w("decideDoes"), {
            sources,
            decide: {
                intent: action.action,
                facts: [factOf(action)],
                branches: branchesFromRule(rule, factOf(action), targets),
            },
        })
        return [decide, approve, act, stop]
    }
    if (rule?.mode === "never") return [stop]
    return runsAlone(rule) && action.maxMode === null ? [act] : [approve, act]
}

/** The trigger of a template, or of a customer message when no template starts the flow. */
const startOf = (template: SeedTemplate | undefined, voice: Voice, next: string): GraphNode => {
    const w = wordsOf(voice)
    const sources: ReadonlyArray<GraphSource> =
        template === undefined ? [] : [{ kind: "template", key: template.key, version: template.version }]
    const title = template === undefined ? w("request") : template.trigger.line[voice.locale]
    const step = template === undefined ? "customer_message" : template.trigger.kind
    return nodeOf(template === undefined ? "start" : `start:${template.key}`, step, title, w("startDoes"), {
        next: [next],
        sources,
    })
}

/** The tag of the agent in Office is a trigger of the graph like any other, not a separate path. */
const tagOf = (voice: Voice, next: string): GraphNode => {
    const w = wordsOf(voice)
    return nodeOf("tag", "tag", w("tagged"), w("taggedDoes"), { next: [next] })
}

/** A pipeline the engine keeps running: a map entry only, so the engine stays the one executor. */
const pipelineOf = (template: SeedTemplate, voice: Voice, end: string): GraphNode =>
    nodeOf(`pipeline:${template.key}`, "write", template.name[voice.locale], wordsOf(voice)("pipeline"), {
        pipeline: template.key,
        sources: [{ kind: "template", key: template.key, version: template.version }],
        next: [end],
    })

/** A template whose message the owner always decides: an approval whose branch can never become `auto`. */
const alwaysAskOf = (template: SeedTemplate, rule: SeedRule | undefined, voice: Voice, next: string): ReadonlyArray<GraphNode> => {
    if (template.authority.alwaysAsk !== true) return []
    const w = wordsOf(voice)
    return [
        nodeOf(`always:${template.key}`, "approval", w("ask"), w("askDoes"), {
            doneBy: "person",
            approver: rule === undefined ? null : approverOfRule(rule),
            sources: [{ kind: "template", key: template.key, version: template.version }],
            next: [next],
        }),
    ]
}

/** What a template does after its trigger: the approval it always asks, then the pipeline the engine runs; the engine stays the one executor. */
const chainOf = (template: SeedTemplate, rule: SeedRule | undefined, voice: Voice, end: string): ReadonlyArray<GraphNode> => {
    const pipeline = template.executor === "definition" ? [] : [pipelineOf(template, voice, end)]
    return [...alwaysAskOf(template, rule, voice, pipeline[0]?.key ?? end), ...pipeline]
}

/**
 * The base graph of a module for a workspace, derived and never a stored copy: a start node for each template trigger, one
 * understand node, then for each authority action its decide point (when an amount limit applies), its approval and its act, all
 * ending in one done node. A template whose message always asks adds an approval that cannot become `auto`, and a template the
 * engine runs becomes an act node with a `pipeline`. Rights start empty: a new agent reads nothing until the owner turns a right on.
 */
export const baseGraphOf = (
    module: SeedModule,
    templates: ReadonlyArray<SeedTemplate>,
    rules: ReadonlyArray<SeedRule>,
    voice: Voice,
): GraphDocument => {
    const w = wordsOf(voice)
    const end = nodeOf("end", "stop", w("end"), w("endDoes"), {})
    const actions = module.authorityActions.map((action) =>
        nodesOfAction(action, rules.find((rule) => rule.action === action.action), voice, end.key),
    )
    const understand = nodeOf("understand", "call", w("understand"), w("understandDoes"), {
        uses: toolsOf(module),
        next: actions.flatMap((nodes) => (nodes[0] === undefined ? [] : [nodes[0].key])),
    })
    const chains = templates.map((template) =>
        chainOf(template, rules.find((rule) => rule.action === template.authority.action), voice, end.key),
    )
    const starts =
        templates.length === 0
            ? [startOf(undefined, voice, understand.key)]
            : templates.map((template, index) => startOf(template, voice, chains[index]?.[0]?.key ?? understand.key))
    const nodes = [...starts, tagOf(voice, understand.key), understand, ...actions.flat(), ...chains.flat(), end]
    return { nodes, rights: [] }
}
