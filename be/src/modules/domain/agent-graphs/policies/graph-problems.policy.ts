import { dataKindOfTool } from "@modules/domain/mcp-gateway"
import { MAX_DOES_LENGTH, MAX_GRAPH_NODES, MAX_TITLE_LENGTH, STEPS_OF_KIND } from "../agent-graphs.contracts"
import type {
    CeilingRule,
    DecidePoint,
    GraphBranch,
    GraphContext,
    GraphDocument,
    GraphNode,
    GraphProblem,
    NodeAnswerKey,
} from "../agent-graphs.contracts"
import { conditionProblems } from "./condition.policy"
import { boundaryFindings, intervalOf, numericFactsOf, topOf } from "./interval.policy"
import type { Interval } from "./interval.policy"

const problem = (
    code: GraphProblem["code"],
    nodeKey: string,
    branchKey: string | null = null,
    detail = "",
): GraphProblem => ({ code, nodeKey, branchKey, detail })

/** The keys a node leads to. */
export const successorsOf = (node: GraphNode): ReadonlyArray<string> => {
    if (node.decide !== undefined) return node.decide.branches.map((branch) => branch.next)
    return node.next
}

const LIST_ANSWERS: ReadonlyArray<NodeAnswerKey> = ["knows", "uses", "reads", "writes", "sources"]

/** The answers of a node left blank: an empty list not marked "None", or empty words. */
export const blankAnswers = (node: GraphNode): ReadonlyArray<string> => [
    ...(node.title.trim() === "" || node.title.length > MAX_TITLE_LENGTH ? ["title"] : []),
    ...(node.does.trim() === "" || node.does.length > MAX_DOES_LENGTH ? ["does"] : []),
    ...LIST_ANSWERS.filter((key) => node[key].length === 0 && !node.none.includes(key)),
    ...(node.step === "approval" && node.approver === null ? ["approver"] : []),
]

const structure = (graph: GraphDocument): ReadonlyArray<GraphProblem> => {
    const byKey = new Map(graph.nodes.map((node) => [node.key, node]))
    const limit =
        graph.nodes.length > MAX_GRAPH_NODES
            ? graph.nodes.slice(0, 1).map((node) => problem("node_limit", node.key))
            : []
    const deadEnds = graph.nodes.flatMap((node) => {
        const next = successorsOf(node)
        const open = node.kind !== "output" && (next.length === 0 || next.some((key) => !byKey.has(key)))
        return open ? [problem("dead_end", node.key)] : []
    })
    return [...limit, ...deadEnds, ...cycles(graph, byKey), ...entryProblems(graph)]
}

/**
 * A graph starts at a trigger and every path ends at an output: no trigger at all, a node nothing leads to that is not a trigger, and a
 * step that does not belong to its kind are each a problem. A node that is not an output and leads nowhere is a dead end.
 */
/** The keys from which an output can be reached, walking back from the outputs. */
const reachOutput = (graph: GraphDocument): ReadonlySet<string> => {
    const reaching = new Set(graph.nodes.filter((node) => node.kind === "output").map((node) => node.key))
    for (let grew = true; grew;) {
        const before = reaching.size
        for (const node of graph.nodes)
            if (successorsOf(node).some((next) => reaching.has(next))) reaching.add(node.key)
        grew = reaching.size > before
    }
    return reaching
}

/** A condition holds the decide point and nothing else does; each of its branches must reach an output. */
const branchProblems = (graph: GraphDocument): ReadonlyArray<GraphProblem> => {
    const reaching = reachOutput(graph)
    return graph.nodes.flatMap((node) => {
        const misplaced = (node.decide !== undefined) !== (node.kind === "condition")
        const lost = (node.decide?.branches ?? []).filter((branch) => !reaching.has(branch.next))
        return [
            ...(misplaced ? [problem("bad_step", node.key, null, "decide")] : []),
            ...lost.map((branch) => problem("branch_no_output", node.key, branch.key)),
        ]
    })
}

const entryProblems = (graph: GraphDocument): ReadonlyArray<GraphProblem> => {
    const reached = new Set(graph.nodes.flatMap(successorsOf))
    const first = graph.nodes[0]
    const noTrigger = first !== undefined && !graph.nodes.some((node) => node.kind === "trigger")
    return [
        ...branchProblems(graph),
        ...(noTrigger ? [problem("no_trigger", first.key)] : []),
        ...graph.nodes
            .filter((node) => node.kind !== "trigger" && !reached.has(node.key))
            .map((node) => problem("not_from_trigger", node.key)),
        ...graph.nodes
            .filter((node) => !STEPS_OF_KIND[node.kind].includes(node.step))
            .map((node) => problem("bad_step", node.key, null, node.step)),
    ]
}

/** True when walking forward from the node leads back to it. */
const reachesItself = (start: GraphNode, byKey: ReadonlyMap<string, GraphNode>): boolean => {
    const seen = new Set<string>()
    const queue = [...successorsOf(start)]
    for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        if (key === start.key) return true
        const node = byKey.get(key)
        if (node !== undefined && !seen.has(key)) {
            seen.add(key)
            queue.push(...successorsOf(node))
        }
    }
    return false
}

/** One problem for each node that can reach itself. */
const cycles = (graph: GraphDocument, byKey: ReadonlyMap<string, GraphNode>): ReadonlyArray<GraphProblem> =>
    graph.nodes.filter((node) => reachesItself(node, byKey)).map((node) => problem("cycle", node.key))

const elseProblems = (nodeKey: string, decide: DecidePoint): ReadonlyArray<GraphProblem> => {
    const last = decide.branches.at(-1)
    if (last?.when !== "else") return [problem("no_else", nodeKey)]
    return last.then === "auto" ? [problem("else_auto", nodeKey, last.key)] : []
}

const approverProblems = (
    nodeKey: string,
    action: string,
    branch: GraphBranch,
    context: GraphContext,
): ReadonlyArray<GraphProblem> => {
    if (branch.then !== "ask") return []
    if (branch.approver === null) return [problem("approver_missing", nodeKey, branch.key)]
    const covered = context.approverCovers(action, branch.approver.group, topOfBranch(branch, context))
    return [
        ...(branch.approver.onTimeout.kind === "unset" ? [problem("on_timeout_unset", nodeKey, branch.key)] : []),
        ...(covered ? [] : [problem("approver_no_grant", nodeKey, branch.key)]),
    ]
}

/** The top of the amounts a branch covers, null when it has none. */
const topOfBranch = (branch: GraphBranch, context: GraphContext): number | null => {
    const fact = Object.values(context.facts).find((spec) => spec.unit === "vnd")
    const interval = fact === undefined ? null : intervalOf(branch.when, fact.key)
    return interval === null ? null : topOf(interval)
}

const boundaryProblems = (nodeKey: string, decide: DecidePoint, context: GraphContext): ReadonlyArray<GraphProblem> =>
    numericFactsOf(decide, context.facts).flatMap((fact) =>
        boundaryFindings(decide, fact).map((finding) => problem(finding.kind, nodeKey, finding.after.key, fact)),
    )

const conditionIssues = (nodeKey: string, decide: DecidePoint, context: GraphContext): ReadonlyArray<GraphProblem> =>
    decide.branches.flatMap((branch) =>
        branch.when === "else"
            ? []
            : conditionProblems(branch.when, context.facts).map((detail) =>
                  problem("bad_condition", nodeKey, branch.key, detail),
              ),
    )

const decideProblems = (node: GraphNode, context: GraphContext): ReadonlyArray<GraphProblem> => {
    const { decide } = node
    if (decide === undefined) return []
    return [
        ...elseProblems(node.key, decide),
        ...conditionIssues(node.key, decide, context),
        ...boundaryProblems(node.key, decide, context),
        ...decide.branches.flatMap((branch) => approverProblems(node.key, decide.intent, branch, context)),
    ]
}

/** True when the branch lets an amount run alone that the rule does not: the branch's stretch reaches past the rule's own. */
const exceedsRule = (branch: GraphBranch, interval: Interval | null, rule: CeilingRule): boolean => {
    if (branch.then !== "auto") return false
    if (rule.mode !== "auto" || rule.maxMode !== null) return true
    const top = interval === null ? null : topOf(interval)
    if (rule.autoMax !== null) return top === null || top > rule.autoMax
    if (rule.limitVnd === null) return false
    return top === null || top > rule.limitVnd || (top === rule.limitVnd && interval?.hiOpen === false)
}

/**
 * A branch `auto` where the workspace rule or its `max_mode` caps the action: the graph decides inside the ceiling, never above it.
 * The branch's stretch of the amount is read against the rule's bounds, with the code's two meanings kept apart: `limit_vnd`
 * is strictly below, `auto_max` is inclusive.
 */
export const ceilingProblems = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphProblem> =>
    graph.nodes.flatMap((node) => {
        const decide = node.decide
        const rule = context.ceilings.find((entry) => entry.action === decide?.intent)
        const fact = Object.values(context.facts).find((spec) => spec.unit === "vnd")
        if (decide === undefined || rule === undefined) return []
        return decide.branches.flatMap((branch) => {
            const interval = fact === undefined || branch.when === "else" ? null : intervalOf(branch.when, fact.key)
            return exceedsRule(branch, interval, rule) ? [problem("ceiling", node.key, branch.key, rule.action)] : []
        })
    })

/** The tools a node uses that the agent holds no grant on, those that do not exist yet but are drawn live, and the data it reads without a right. */
export const rightsProblems = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphProblem> =>
    graph.nodes.flatMap((node) => [
        ...node.uses.flatMap((use) => {
            if (use.placeholder === true) return [problem("placeholder_live", node.key, null, use.tool ?? use.label)]
            if (use.tool === null) return []
            return context.isGranted(use.tool) ? [] : [problem("no_right", node.key, null, use.tool)]
        }),
        ...node.uses.flatMap((use) => {
            const kind = use.tool === null ? null : dataKindOfTool(use.tool)
            return kind === null || graph.rights.some((right) => right.kind === kind)
                ? []
                : [problem("no_data_right", node.key, null, kind)]
        }),
    ])

/** An agent that faces outsiders is always narrow: a customer can talk it into repeating what it can read. */
const outsiderProblems = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphProblem> =>
    context.facesCustomers
        ? graph.rights
              .filter((right) => right.scope === "workspace")
              .map((right) => problem("outsider_wide", "", null, right.kind))
        : []

const blankProblems = (graph: GraphDocument): ReadonlyArray<GraphProblem> =>
    graph.nodes.flatMap((node) => blankAnswers(node).map((answer) => problem("blank_answer", node.key, null, answer)))

/**
 * Everything the owner must fix before a graph is published, run on every save: shape (cycle, dead end, size), the `else`, the
 * conditions, gaps and overlaps, the ceiling of the rules, rights, the approvers' grants, the outsider limit and blank answers.
 */
export const graphProblems = (graph: GraphDocument, context: GraphContext): ReadonlyArray<GraphProblem> => [
    ...structure(graph),
    ...graph.nodes.flatMap((node) => decideProblems(node, context)),
    ...ceilingProblems(graph, context),
    ...rightsProblems(graph, context),
    ...outsiderProblems(graph, context),
    ...blankProblems(graph),
]
