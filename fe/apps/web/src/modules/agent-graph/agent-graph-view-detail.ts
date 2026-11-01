import type {
    AgentGraphAnswerView,
    AgentGraphApproverData,
    AgentGraphData,
    AgentGraphDetailView,
    AgentGraphLine,
    AgentGraphNodeData,
    AgentGraphSourceData,
} from "@/modules/types"
import { branchHitOf } from "./agent-graph-flow"
import { problemLinesOf } from "./agent-graph-problems"
import { kindWordOf, sourceWordOf, thenWordOf, timeoutLineOf } from "./agent-graph-words"
import type { AgentGraphContext, AgentGraphT } from "./agent-graph-words"

/** What a list answer says when the node has nothing to list: "None" is an answer, a blank is not. */
const linesAnswerOf = (
    t: AgentGraphT,
    id: string,
    term: string,
    lines: ReadonlyArray<AgentGraphLine>,
): AgentGraphAnswerView =>
    lines.length === 0 ? { id, term, kind: "text", text: t("answerNone") } : { id, term, kind: "lines", lines }

const approverAnswerOf = (t: AgentGraphT, approver: AgentGraphApproverData | null): AgentGraphAnswerView =>
    approver === null
        ? { id: "approver", term: t("q_approver"), kind: "text", text: t("answerNoApprover") }
        : {
              id: "approver",
              term: t("q_approver"),
              kind: "approver",
              name: approver.name,
              coverage: approver.coverage,
              timeout: timeoutLineOf(t, approver),
          }

const sourcesAnswerOf = (t: AgentGraphT, sources: ReadonlyArray<AgentGraphSourceData>): AgentGraphAnswerView =>
    sources.length === 0
        ? { id: "sources", term: t("q_sources"), kind: "text", text: t("answerNone") }
        : {
              id: "sources",
              term: t("q_sources"),
              kind: "sources",
              sources: sources.map((source, index) => ({
                  id: `${source.kind}-${index}`,
                  kindLabel: sourceWordOf(t, source.kind),
                  quote: source.quote,
                  place: source.place,
              })),
          }

/** The word under the title: who works the step. */
const doneByWordOf = (t: AgentGraphT, node: AgentGraphNodeData): string => {
    if (node.doneBy === "agent") return t("doneBy_agent")
    return node.doneBy === "person" ? t("doneBy_person") : t("doneBy_nivo")
}

/** The branches of a condition in plain words, each with where it goes and what it does; none for the other kinds. */
const branchesAnswerOf = (
    t: AgentGraphT,
    node: AgentGraphNodeData,
    nodes: ReadonlyArray<AgentGraphNodeData>,
): ReadonlyArray<AgentGraphAnswerView> =>
    node.branches.length === 0
        ? []
        : [
              {
                  id: "branches",
                  term: t("q_branches"),
                  kind: "lines",
                  lines: node.branches.map((branch) => ({
                      label: branch.when,
                      note: `${thenWordOf(t, branch.then)} · ${nodes.find((entry) => entry.key === branch.next)?.title ?? ""}`,
                  })),
              },
          ]

/** The seven answers of a node, none of them blank, in the order the owner reads them. */
const answersOf = (
    t: AgentGraphT,
    node: AgentGraphNodeData,
    nodes: ReadonlyArray<AgentGraphNodeData>,
    approver: AgentGraphApproverData | null,
    sources: ReadonlyArray<AgentGraphSourceData>,
): ReadonlyArray<AgentGraphAnswerView> => [
    ...branchesAnswerOf(t, node, nodes),
    linesAnswerOf(t, "knows", t("q_knows"), node.knows),
    { id: "does", term: t("q_does"), kind: "text", text: node.does },
    linesAnswerOf(t, "uses", t("q_uses"), node.uses),
    linesAnswerOf(t, "reads", t("q_reads"), node.reads),
    linesAnswerOf(t, "writes", t("q_writes"), node.writes),
    approverAnswerOf(t, approver),
    sourcesAnswerOf(t, sources),
]

/**
 * A node with all seven answers. A node a branch leads to also says when the branch is taken, takes the branch's approver and
 * sources, and offers to edit the branch; the problem the checks found on the node is read first.
 */
export const detailViewOf = (data: AgentGraphData, nodeKey: string, ctx: AgentGraphContext): AgentGraphDetailView => {
    const { t } = ctx
    const node = data.nodes.find((entry) => entry.key === nodeKey) ?? data.nodes[0]
    if (node === undefined) {
        return {
            title: "",
            badge: "",
            subtitle: "",
            problemTitle: "",
            problems: [],
            answers: [],
            editLabel: "",
            editNodeKey: "",
            runsLabel: "",
        }
    }
    const hit = branchHitOf(data.nodes, node.key)
    const problems = problemLinesOf(data, t).filter(
        (line) =>
            line.nodeKey === node.key ||
            (hit !== null && line.nodeKey === hit.parent.key && line.branchKey === hit.branch.key),
    )
    const when: AgentGraphAnswerView | null =
        hit === null ? null : { id: "when", term: t("q_when"), kind: "text", text: hit.branch.whenFull }
    const editNodeKey = (() => {
        if (node.branches.length > 0) return node.key
        return hit === null ? "" : hit.parent.key
    })()
    const answers = answersOf(
        t,
        node,
        data.nodes,
        hit?.branch.approver ?? node.approver,
        hit?.branch.sources ?? node.sources,
    )
    return {
        title: node.title,
        badge: kindWordOf(t, node.kind),
        subtitle:
            hit === null
                ? doneByWordOf(t, node)
                : t("branchOf", { position: hit.position + 1, intent: ctx.actionWord(hit.parent.intent) }),
        problemTitle: problems.length === 0 ? "" : t("problemTitle"),
        problems: problems.map((line) => line.text),
        answers: when === null ? answers : [when, ...answers],
        editLabel: editNodeKey !== "" && ctx.canEdit ? t("editBranches") : "",
        editNodeKey,
        runsLabel: hit !== null && data.runs.length > 0 ? t("viewRuns") : "",
    }
}
