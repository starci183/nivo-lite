import type {
    AgentGraphApproverData,
    AgentGraphBranchData,
    AgentGraphData,
    AgentGraphFactData,
    AgentGraphLine,
    AgentGraphMemberData,
    AgentGraphNodeData,
    AgentGraphProposalData,
    AgentGraphRunData,
    AgentGraphSourceData,
    AgentGraphWords,
} from "@/modules/types"
import type {
    AgentGraphWire,
    AgentGraphWireApprover,
    AgentGraphWireBranch,
    AgentGraphWireNode,
    AgentGraphWireSource,
    AgentGraphWireStep,
} from "./agent-graph-wire"
import { termsOfWhen, termsWords } from "./agent-graph-condition"
import type { AgentGraphConditionWords } from "./agent-graph-condition"
import { roleWordOf } from "./agent-graph-words"
import type { AgentGraphT } from "./agent-graph-words"

/** One version of the history as the contract lists it. */
export interface AgentGraphWireVersion {
    readonly id: string
    readonly version: number
    readonly note: string
    readonly changeKind: string
    readonly publishedAt: string
}

/** Who a request would go to at one branch or step, and who was left out. */
export interface AgentGraphCoverageRow {
    readonly nodeKey: string
    readonly branchKey?: string | null | undefined
    readonly covered: boolean
    readonly top?: number | null | undefined
    readonly approvers: ReadonlyArray<string>
    readonly excluded: ReadonlyArray<{ readonly name: string; readonly reason: string }>
}

/** A run read by its work item, with the nodes it went through. */
export interface AgentGraphRunRead {
    readonly id: string
    readonly version: number
    readonly outcome: string
    readonly closedAs?: string | null | undefined
    readonly steps: ReadonlyArray<AgentGraphWireStep>
}

/** Everything the graph is made of once it was read. */
export interface AgentGraphWireInput {
    readonly wire: AgentGraphWire
    readonly mode: string
    readonly activeVersionId: string | null
    readonly versions: ReadonlyArray<AgentGraphWireVersion>
    readonly members: ReadonlyArray<AgentGraphMemberData>
    readonly coverage: ReadonlyArray<AgentGraphCoverageRow>
    readonly run: AgentGraphRunRead | null
    /** The changes saved to the draft on this screen since it was read. */
    readonly changes: number
    /** True when the draft differs from the version that decides, as the back end read it. */
    readonly isDraftChanged: boolean
}

/** The words the mapping needs beyond the catalogue. */
export interface AgentGraphWireWords extends AgentGraphWords {
    readonly t: AgentGraphT
    readonly date: (iso: string) => string
}

const nameOf = (members: ReadonlyArray<AgentGraphMemberData>, id: string): string =>
    members.find((member) => member.id === id)?.name ?? id

/** Why a person is left out of a group, in words. */
const reasonOf = (reason: string, t: AgentGraphT): string => {
    if (reason === "inactive") return t("reasonInactive")
    return reason === "no_grant" ? t("reasonNoGrant") : t("reasonOverLimit")
}

/** What the coverage of a step says: who a request would go to, and who is left out and why. */
const coverageWordsOf = (row: AgentGraphCoverageRow | undefined, t: AgentGraphT): string => {
    if (row === undefined) return ""
    const left = row.excluded.map((entry) => `${entry.name} (${reasonOf(entry.reason, t)})`).join(", ")
    const names = row.approvers.join(", ")
    if (!row.covered) return t("coverageNobody", { left })
    return left === "" ? t("coverageOk", { names }) : t("coverageSome", { names, left })
}

const approverOf = (
    wire: AgentGraphWireApprover | null,
    members: ReadonlyArray<AgentGraphMemberData>,
    t: AgentGraphT,
    coverage = "",
): AgentGraphApproverData | null => {
    if (wire === null) return null
    const backupId = wire.onTimeout.group?.members[0] ?? ""
    return {
        memberId: wire.group.members[0] ?? "",
        name:
            wire.group.members.map((id) => nameOf(members, id)).join(", ") ||
            wire.group.rooms.join(", ") ||
            wire.group.roles.map((role) => roleWordOf(t, role)).join(", "),
        coverage,
        timeoutMinutes: wire.timeoutMinutes,
        onTimeout: wire.onTimeout.kind,
        backupId,
        backupName: backupId === "" ? "" : nameOf(members, backupId),
    }
}

/** The name of an action in the owner's words: the title of the step that performs it, never its key. */
const actionTitleOf = (input: AgentGraphWireInput, action: string): string =>
    input.wire.document.nodes.find((node) => node.step === "write" && node.action === action)?.title ?? action

const sourceOf = (
    source: AgentGraphWireSource,
    words: AgentGraphWireWords,
    input: AgentGraphWireInput,
): AgentGraphSourceData => {
    const { t } = words
    const { members } = input
    if (source.kind === "template")
        return {
            kind: "template",
            quote: t("srcTemplate", { key: source.key ?? "", version: source.version ?? 0 }),
            place: "",
        }
    if (source.kind === "learned") return { kind: "learned", quote: t("srcLearned"), place: "" }
    if (source.kind === "owner")
        return { kind: "owner", quote: t("srcOwner", { name: nameOf(members, source.memberId ?? "") }), place: "" }
    if (source.kind === "rule") return { kind: "rule", quote: t("srcRule", { action: actionTitleOf(input, source.action ?? "") }), place: "" }
    return {
        kind: source.kind,
        quote: source.kind === "brain" ? (source.passage ?? "") : (source.quote ?? ""),
        place: "",
    }
}

/** The condition node a branch belongs to, with the graph it was read in. */
interface BranchContext {
    readonly nodeKey: string
    readonly input: AgentGraphWireInput
    /** True when the decision point reads one fact only, so its edges need not name it. */
    readonly isOneFact?: boolean
}

/** What the words of a condition need, from the graph that was read. */
const conditionWordsOf = (input: AgentGraphWireInput, words: AgentGraphWireWords): AgentGraphConditionWords => ({
    t: words.t,
    facts: input.wire.facts,
    amount: words.amount,
})

const branchOf = (
    branch: AgentGraphWireBranch,
    ctx: BranchContext,
    words: AgentGraphWireWords,
): AgentGraphBranchData => {
    const members = ctx.input.members
    const row = ctx.input.coverage.find((entry) => entry.nodeKey === ctx.nodeKey && entry.branchKey === branch.key)
    const terms = branch.when === "else" ? [] : termsOfWhen(branch.when)
    const conditionWords = conditionWordsOf(ctx.input, words)
    const sentence = (withLabel: boolean): string => {
        if (branch.when === "else") return words.t("whenAny")
        return terms === null ? words.t("whenOther") : termsWords(terms, conditionWords, withLabel)
    }
    return {
        key: branch.key,
        when: sentence(ctx.isOneFact !== true),
        whenFull: sentence(true),
        then: branch.then,
        next: branch.next,
        approver: approverOf(branch.approver, members, words.t, coverageWordsOf(row, words.t)),
        sources: branch.sources.map((source) => sourceOf(source, words, ctx.input)),
        selfCorrected: branch.selfCorrected === true,
    }
}

const linesOf = (
    items: ReadonlyArray<{ readonly label: string; readonly note: string }>,
): ReadonlyArray<AgentGraphLine> => items

const cardOf = (card: AgentGraphWire["cards"][number] | undefined): AgentGraphNodeData["card"] => ({
    description: card?.description ?? "",
    tone: card?.tone ?? "neutral",
    shape: card?.shape ?? "rect",
    count: card?.count ?? "",
    isPlaceholder: card?.isPlaceholder ?? false,
})

const nodeOf = (
    node: AgentGraphWireNode,
    input: AgentGraphWireInput,
    words: AgentGraphWireWords,
): AgentGraphNodeData => ({
    key: node.key,
    kind: node.kind,
    title: node.title,
    doneBy: node.doneBy,
    card: cardOf(input.wire.cards.find((entry) => entry.id === node.key)),
    knows: linesOf(node.knows.map((item) => ({ label: item.label, note: item.ref ?? "" }))),
    does: node.does,
    uses: linesOf(
        node.uses.map((use) => ({
            label: use.label,
            note: `${use.tool ?? ""} · ${use.scope === "read" ? words.t("noteRead") : words.t("noteWrite")}`,
        })),
    ),
    reads: linesOf(node.reads.map((item) => ({ label: item.label, note: item.place }))),
    writes: linesOf(node.writes.map((item) => ({ label: item.label, note: item.place }))),
    approver: approverOf(
        node.approver,
        input.members,
        words.t,
        coverageWordsOf(
            input.coverage.find((entry) => entry.nodeKey === node.key && (entry.branchKey ?? null) === null),
            words.t,
        ),
    ),
    sources: node.sources.map((source) => sourceOf(source, words, input)),
    next: node.next,
    intent: node.decide?.intent ?? "",
    branches: (node.decide?.branches ?? []).map((branch) =>
        branchOf(branch, { nodeKey: node.key, input, isOneFact: (node.decide?.facts.length ?? 0) <= 1 }, words),
    ),
})

/** A conflict reads the two passages and what switching does; the other kinds read their evidence. */
const proposalOf = (
    proposal: AgentGraphWire["proposals"][number],
    words: AgentGraphWireWords,
): AgentGraphProposalData => {
    const { t } = words
    const isConflict = proposal.kind === "conflict"
    const passage = (text: string | null | undefined): AgentGraphSourceData | null =>
        isConflict && text !== undefined && text !== null ? { kind: "brain", quote: text, place: "" } : null
    return {
        id: proposal.id,
        kind: proposal.kind,
        title: t("proposalTitleWire", { kind: proposal.kind }),
        why: isConflict ? t("conflictWhy") : t("proposalWhyWire", { count: proposal.evidence.length }),
        widens: proposal.widens,
        nodeKey: proposal.nodeKey ?? "",
        branchKey: proposal.branchKey ?? "",
        evidence: isConflict
            ? []
            : proposal.evidence.map((line, index) => ({ id: `${proposal.id}-${index}`, line, outcome: "" })),
        before: passage(proposal.before),
        after: passage(proposal.after),
        effects: isConflict ? [t("conflictEffectRule"), t("conflictEffectKept"), t("conflictEffectNow")] : [],
        confirmLabel: isConflict ? t("conflictConfirm") : t("proposalConfirmWire"),
        keepLabel: isConflict ? t("conflictKeep") : t("proposalDecline"),
        boundaryVnd: null,
    }
}

/** The actions the agent performs, each with whether a decision point already stands in front of it. */
const actionsOf = (wire: AgentGraphWire): AgentGraphData["actions"] =>
    wire.document.nodes.flatMap((node) =>
        node.step === "write" && typeof node.action === "string"
            ? [
                  {
                      action: node.action,
                      title: node.title,
                      isGuarded: wire.document.nodes.some((other) => other.decide?.intent === node.action),
                  },
              ]
            : [],
    )

const factsOf = (wire: AgentGraphWire): ReadonlyArray<AgentGraphFactData> => wire.facts

const versionOf = (
    version: AgentGraphWireVersion,
    input: AgentGraphWireInput,
    words: AgentGraphWireWords,
): AgentGraphData["versions"][number] => ({
    id: version.id,
    version: version.version,
    note: version.note,
    byLine: words.t("versionByWire", { kind: version.changeKind, date: words.date(version.publishedAt) }),
    runs: 0,
    isActive: version.id === input.activeVersionId,
})

/** A traced run: the nodes it went through in order, and the branch it took at each condition. */
const runOf = (run: AgentGraphRunRead, input: AgentGraphWireInput, words: AgentGraphWireWords): AgentGraphRunData => {
    const { t } = words
    const branchWords = (step: AgentGraphWireStep): string => {
        const taken = input.wire.document.nodes
            .find((node) => node.key === step.key)
            ?.decide?.branches.find((branch) => branch.key === step.branchKey)
        return taken === undefined
            ? ""
            : t("runTookBranch", { branch: branchOf(taken, { nodeKey: step.key, input }, words).when })
    }
    return {
        id: run.id,
        title: t("runTitleWire", { version: run.version }),
        summary: t("runSummaryWire", { version: run.version }),
        outcome: run.closedAs ?? run.outcome,
        mismatch: "",
        steps: run.steps.map((step) => ({ id: step.key, time: "", text: step.title, note: branchWords(step) })),
        path: run.steps.map((step) => step.key),
        skipped: "",
    }
}

/** The graph the panes draw, made of what the contract carries and the people of the workspace. */
export const agentGraphOfWire = (input: AgentGraphWireInput, words: AgentGraphWireWords): AgentGraphData => ({
    mode: input.mode === "enforced" ? "enforced" : "shadow",
    activeVersion: input.versions.find((version) => version.id === input.activeVersionId)?.version ?? 0,
    changes: input.isDraftChanged ? Math.max(1, input.changes) : 0,
    gaps: input.wire.gaps.map((gap) => ({ code: gap.code, nodeKey: gap.nodeKey, branchKey: gap.branchKey ?? "" })),
    problems: input.wire.problems.map((problem) => ({
        code: problem.code,
        nodeKey: problem.nodeKey,
        branchKey: problem.branchKey ?? "",
        detail: problem.detail,
    })),
    nodes: input.wire.document.nodes.map((node) => nodeOf(node, input, words)),
    versions: input.versions.map((version) => versionOf(version, input, words)),
    proposals: input.wire.proposals
        .filter((proposal) => proposal.status === "open")
        .map((proposal) => proposalOf(proposal, words)),
    runs: input.run === null ? [] : [runOf(input.run, input, words)],
    members: input.members,
    facts: factsOf(input.wire),
    actions: actionsOf(input.wire),
})
