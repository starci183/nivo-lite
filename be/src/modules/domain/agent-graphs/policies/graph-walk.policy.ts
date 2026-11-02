import type {
    BranchApprover,
    DecidePoint,
    FactRegistry,
    FactValues,
    GraphDocument,
    GraphNode,
} from "../agent-graphs.contracts"
import type { GraphWalk, WalkOutcome, WalkUnjudged } from "../agent-graphs-walk.contracts"
import { successorsOf } from "./graph-problems.policy"
import { reaches } from "./run-trace.policy"
import { pickBranch } from "./strictest.policy"

/** The action a `reply` output is, whatever the node names. */
const REPLY_ACTION = "reply_customer"

/** How the walk reads the graph. */
export interface WalkOptions {
    /** True on a road only a decide point judges: a seeded approval of a write tool is what a held call does after its grant. */
    readonly decideOnly?: boolean
}

/** What the walk carries from node to node. */
interface Walking {
    readonly path: ReadonlyArray<string>
    readonly branchKey: string
    readonly approver: BranchApprover | null
    readonly asked: boolean
    readonly unread: ReadonlyArray<string>
    readonly unjudged: WalkUnjudged | null
}

/** The result of a road that cannot continue. */
interface Ending {
    readonly ended: GraphWalk
}

/** What one node does to the walk: it ends here, or goes on to a node. */
type Step = Ending | { readonly walking: Walking; readonly next: string | null }

/** Everything the walk needs to read a node. */
interface WalkScope {
    readonly action: string
    readonly byKey: ReadonlyMap<string, GraphNode>
    readonly facts: FactValues
    readonly registry: FactRegistry
}

const UNHELD: GraphWalk = {
    outcome: "unheld",
    path: [],
    branchKey: "",
    approver: null,
    divert: null,
    unread: [],
    unjudged: "not_in_graph",
}

const actionOf = (node: GraphNode): string | undefined =>
    node.action ?? (node.step === "reply" ? REPLY_ACTION : undefined)

const isAct = (node: GraphNode): boolean => node.step === "write" || node.step === "reply"

const citesAction = (node: GraphNode, action: string): boolean =>
    node.sources.some((source) => source.kind === "rule" && source.action === action)

/**
 * Where the work of an action enters the graph: its decide point, else the approval that leads to its act, else its act, else the stop
 * a closed rule seeded for it. Null when no node holds the action.
 */
const entryOf = (document: GraphDocument, action: string, options: WalkOptions): GraphNode | null => {
    const decided = document.nodes.find((node) => node.decide?.intent === action)
    if (decided !== undefined) return decided
    if (options.decideOnly === true) return null
    const acts = new Set(
        document.nodes.filter((node) => isAct(node) && actionOf(node) === action).map((node) => node.key),
    )
    const approval = document.nodes.find((node) => node.step === "approval" && node.next.some((key) => acts.has(key)))
    const act = document.nodes.find((node) => acts.has(node.key))
    const stop = document.nodes.find((node) => node.step === "stop" && citesAction(node, action))
    return approval ?? act ?? stop ?? null
}

/** The facts the walk of an action may read: those of every decide point it can reach. */
export const factsOfWalk = (
    document: GraphDocument,
    action: string,
    options: WalkOptions = {},
): ReadonlyArray<string> => {
    const byKey = new Map(document.nodes.map((node) => [node.key, node]))
    const entry = entryOf(document, action, options)
    const seen = new Set<string>()
    const queue = entry === null ? [] : [entry.key]
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        const node = byKey.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            queue.push(...successorsOf(node))
        }
    }
    const facts = [...seen].flatMap((key) => byKey.get(key)?.decide?.facts ?? [])
    return [...new Set(facts)]
}

const ended = (walking: Walking, outcome: WalkOutcome, divert: GraphWalk["divert"] = null): Step => ({
    ended: { ...walking, outcome, divert },
})

const finished = (walking: Walking): Step => ended(walking, walking.asked ? "ask" : "run")

/** The walk cannot go on: it asks, because a graph that holds the action never hands it back to the gate. */
const lost = (walking: Walking, unjudged: WalkUnjudged): Ending => ({
    ended: { ...walking, outcome: "ask", unjudged: walking.unjudged ?? unjudged, divert: null },
})

/** The node after this one: the only one, or the one that can still reach the act of the action; null when neither says. */
const nextOf = (node: GraphNode, scope: WalkScope): string | null => {
    const [first, ...others] = node.next
    if (others.length === 0) return first ?? null
    const acts = [...scope.byKey.values()].filter((entry) => actionOf(entry) === scope.action)
    return node.next.find((key) => acts.some((act) => reaches(scope.byKey, key, act.key))) ?? null
}

const stepDecide = (decide: DecidePoint, walking: Walking, scope: WalkScope): Step => {
    const unread = decide.facts.filter((fact) => scope.facts[fact] === undefined)
    const seen = {
        ...walking,
        unread: [...new Set([...walking.unread, ...unread])],
        unjudged: unread.length > 0 ? "fact_unread" : walking.unjudged,
    } satisfies Walking
    const branch = pickBranch(decide, scope.facts, scope.registry)
    if (branch === null) return lost(seen, "no_else")
    const taken = { ...seen, branchKey: branch.key }
    if (branch.then === "stop") return ended(taken, "stop")
    if (branch.then === "auto") return { walking: taken, next: branch.next }
    return {
        walking: { ...taken, asked: true, approver: branch.approver ?? taken.approver },
        next: branch.next,
    }
}

const stepAct = (node: GraphNode, walking: Walking, scope: WalkScope): Step => {
    const action = actionOf(node)
    if (action === scope.action || node.pipeline !== undefined) return finished(walking)
    if (action === undefined) return { walking, next: nextOf(node, scope) }
    return ended(walking, "divert", { action, handoverTo: node.handoverTo ?? null, asks: walking.asked })
}

const stepOf = (node: GraphNode, walking: Walking, scope: WalkScope): Step => {
    if (node.decide !== undefined) return stepDecide(node.decide, walking, scope)
    if (node.step === "stop") return ended(walking, "stop")
    if (isAct(node)) return stepAct(node, walking, scope)
    if (node.step !== "approval") return { walking, next: nextOf(node, scope) }
    return {
        walking: { ...walking, asked: true, approver: walking.approver ?? node.approver },
        next: nextOf(node, scope),
    }
}

/**
 * Walks the graph for one action on the facts as read, the way the owner reads it: first match at each decide point, a fact that
 * could not be read falls to the `else`, and an `else` never runs alone. It ends at the act of the action (`run`, or `ask` when the path
 * went through an approval), at a stop (`stop`), or at the act of another action (`divert`, the hand-over the graph names). A path that
 * goes nowhere asks. An action no node holds is `unheld`: the graph says nothing, so there is no branch to skip.
 */
export const walkGraph = (
    document: GraphDocument,
    action: string,
    facts: FactValues,
    registry: FactRegistry,
    options: WalkOptions = {},
): GraphWalk => {
    const entry = entryOf(document, action, options)
    if (entry === null) return UNHELD
    const scope: WalkScope = { action, byKey: new Map(document.nodes.map((node) => [node.key, node])), facts, registry }
    let walking: Walking = {
        path: [],
        branchKey: entry.key,
        approver: null,
        asked: false,
        unread: [],
        unjudged: null,
    }
    for (let node: GraphNode | undefined = entry; node !== undefined;) {
        if (walking.path.includes(node.key)) break
        const key: string = node.key
        const step: Step = stepOf(node, { ...walking, path: [...walking.path, key] }, scope)
        if ("ended" in step) return step.ended
        walking = step.walking
        node = step.next === null ? undefined : scope.byKey.get(step.next)
    }
    return lost(walking, "no_route").ended
}
