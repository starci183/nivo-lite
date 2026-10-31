import { z } from "zod"
import type {
    AgentGraphApproverData,
    AgentGraphBranchData,
    AgentGraphCardData,
    AgentGraphData,
    AgentGraphLine,
    AgentGraphMemberData,
    AgentGraphNodeData,
    AgentGraphProposalData,
    AgentGraphSourceData,
    AgentGraphVersionData,
    AgentGraphWords,
} from "@/modules/types"
import type {
    AgentGraphWire,
    AgentGraphWireApprover,
    AgentGraphWireBranch,
    AgentGraphWireNode,
    AgentGraphWireSource,
} from "./agent-graph-wire"
import type { AgentGraphT } from "./agent-graph-words"

const termSchema = z.object({ fact: z.string(), op: z.enum(["lt", "lte", "gt", "gte"]), value: z.number() })
const allSchema = z.object({ all: z.array(termSchema) })

/** Where an amount condition starts and ends: read from one comparison or from an `all` of them; null for any other condition. */
export const boundsOf = (when: unknown): { readonly fromVnd: number | null; readonly toVnd: number | null } | null => {
    const single = termSchema.safeParse(when)
    const terms = single.success ? [single.data] : allSchema.safeParse(when).data?.all
    if (terms === undefined) return null
    const upper = terms.find((term) => term.op === "lt" || term.op === "lte")
    const lower = terms.find((term) => term.op === "gt" || term.op === "gte")
    return { fromVnd: lower?.value ?? null, toVnd: upper?.value ?? null }
}

/** One version of the history as the contract lists it. */
export interface AgentGraphWireVersion {
    readonly id: string
    readonly version: number
    readonly note: string
    readonly changeKind: string
    readonly publishedAt: string
}

/** Everything the graph is made of once it was read. */
export interface AgentGraphWireInput {
    readonly wire: AgentGraphWire
    readonly mode: string
    readonly activeVersionId: string | null
    readonly versions: ReadonlyArray<AgentGraphWireVersion>
    readonly members: ReadonlyArray<AgentGraphMemberData>
    /** The changes saved to the draft on this screen since it was read. */
    readonly changes: number
}

/** The words the mapping needs beyond the catalogue. */
export interface AgentGraphWireWords extends AgentGraphWords {
    readonly t: AgentGraphT
    readonly date: (iso: string) => string
}

const nameOf = (members: ReadonlyArray<AgentGraphMemberData>, id: string): string =>
    members.find((member) => member.id === id)?.name ?? id

const approverOf = (
    wire: AgentGraphWireApprover | null,
    members: ReadonlyArray<AgentGraphMemberData>,
): AgentGraphApproverData | null => {
    if (wire === null) return null
    const backupId = wire.onTimeout.group?.members[0] ?? ""
    return {
        memberId: wire.group.members[0] ?? "",
        name:
            wire.group.members.map((id) => nameOf(members, id)).join(", ") ||
            wire.group.rooms.join(", ") ||
            wire.group.roles.join(", "),
        coverage: "",
        timeoutMinutes: wire.timeoutMinutes,
        onTimeout: wire.onTimeout.kind,
        backupId,
        backupName: backupId === "" ? "" : nameOf(members, backupId),
    }
}

const sourceOf = (
    source: AgentGraphWireSource,
    words: AgentGraphWireWords,
    members: ReadonlyArray<AgentGraphMemberData>,
): AgentGraphSourceData => {
    const { t } = words
    if (source.kind === "template")
        return {
            kind: "template",
            quote: t("srcTemplate", { key: source.key ?? "", version: source.version ?? 0 }),
            place: "",
        }
    if (source.kind === "learned") return { kind: "learned", quote: t("srcLearned"), place: "" }
    if (source.kind === "owner")
        return { kind: "owner", quote: t("srcOwner", { name: nameOf(members, source.memberId ?? "") }), place: "" }
    if (source.kind === "rule") return { kind: "rule", quote: t("srcRule", { action: source.action ?? "" }), place: "" }
    return {
        kind: source.kind,
        quote: source.kind === "brain" ? (source.passage ?? "") : (source.quote ?? ""),
        place: "",
    }
}

const branchOf = (
    branch: AgentGraphWireBranch,
    words: AgentGraphWireWords,
    members: ReadonlyArray<AgentGraphMemberData>,
): AgentGraphBranchData => {
    const bounds = branch.when === "else" ? { fromVnd: null, toVnd: null } : boundsOf(branch.when)
    const isOther = branch.when !== "else" && bounds === null
    return {
        key: branch.key,
        when: isOther ? words.t("whenOther") : words.when(bounds?.fromVnd ?? null, bounds?.toVnd ?? null),
        fromVnd: bounds?.fromVnd ?? null,
        toVnd: bounds?.toVnd ?? null,
        then: branch.then,
        next: branch.next,
        approver: approverOf(branch.approver, members),
        sources: branch.sources.map((source) => sourceOf(source, words, members)),
        selfCorrected: branch.selfCorrected === true,
    }
}

const linesOf = (
    items: ReadonlyArray<{ readonly label: string; readonly note: string }>,
): ReadonlyArray<AgentGraphLine> => items

const cardOf = (card: AgentGraphWire["cards"][number] | undefined): AgentGraphCardData => ({
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
    approver: approverOf(node.approver, input.members),
    sources: node.sources.map((source) => sourceOf(source, words, input.members)),
    next: node.next,
    intent: node.decide?.intent ?? "",
    branches: (node.decide?.branches ?? []).map((branch) => branchOf(branch, words, input.members)),
})

const proposalOf = (
    proposal: AgentGraphWire["proposals"][number],
    words: AgentGraphWireWords,
): AgentGraphProposalData => {
    const { t } = words
    return {
        id: proposal.id,
        kind: proposal.kind,
        title: t("proposalTitleWire", { kind: proposal.kind }),
        why: t("proposalWhyWire", { count: proposal.evidence.length }),
        widens: proposal.widens,
        nodeKey: proposal.nodeKey ?? "",
        branchKey: proposal.branchKey ?? "",
        evidence: proposal.evidence.map((line, index) => ({ id: `${proposal.id}-${index}`, line, outcome: "" })),
        before: null,
        after: null,
        effects: [],
        confirmLabel: t("proposalConfirmWire"),
        keepLabel: t("proposalDecline"),
        boundaryVnd: null,
    }
}

const versionOf = (
    version: AgentGraphWireVersion,
    input: AgentGraphWireInput,
    words: AgentGraphWireWords,
): AgentGraphVersionData => ({
    id: version.id,
    version: version.version,
    note: version.note,
    byLine: words.t("versionByWire", { kind: version.changeKind, date: words.date(version.publishedAt) }),
    runs: 0,
    isActive: version.id === input.activeVersionId,
})

/** The graph the panes draw, made of what the contract carries and the people of the workspace. */
export const agentGraphOfWire = (input: AgentGraphWireInput, words: AgentGraphWireWords): AgentGraphData => ({
    mode: input.mode === "enforced" ? "enforced" : "shadow",
    activeVersion: input.versions.find((version) => version.id === input.activeVersionId)?.version ?? 0,
    changes: input.changes,
    gaps: input.wire.gaps.length,
    problems: input.wire.problems.map((problem) => ({
        code: problem.code,
        nodeKey: problem.nodeKey,
        text: problem.detail,
    })),
    nodes: input.wire.document.nodes.map((node) => nodeOf(node, input, words)),
    versions: input.versions.map((version) => versionOf(version, input, words)),
    proposals: input.wire.proposals
        .filter((proposal) => proposal.status === "open")
        .map((proposal) => proposalOf(proposal, words)),
    runs: [],
    members: input.members,
})
