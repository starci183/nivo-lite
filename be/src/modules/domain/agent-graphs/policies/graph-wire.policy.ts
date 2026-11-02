import type { Locale } from "@modules/platform/i18n"
import type { RunEntry } from "../agent-graph-decisions.service"
import type { AgentGraphView } from "../agent-graphs.contracts"

/** The graph of one agent as the editor receives it: the structured parts travel as JSON text, and the revision, mode and version as they are. */
export interface AgentGraphWire {
    /** The agent. */
    readonly agentId: string
    /** The installation the agent runs as. */
    readonly installationId: string
    /** `shadow` records only, `enforced` decides. */
    readonly mode: string
    /** The revision of the draft; a save names the revision it read. */
    readonly draftRev: number
    /** True when the draft differs from the version that decides, so there is something to publish. */
    readonly isDraftChanged: boolean
    /** The version that decides, or null before the first. */
    readonly activeVersionId: string | null
    /** The draft graph as JSON text: nodes and rights. */
    readonly draftJson: string
    /** What is still vague, in the order the setup chat asks, as JSON text. */
    readonly gapsJson: string
    /** What the owner must fix before publishing, as JSON text. */
    readonly problemsJson: string
    /** Each node as a card, as JSON text. */
    readonly cardsJson: string
    /** The proposals waiting for a person, as JSON text. */
    readonly proposalsJson: string
    /** The facts a condition may be written on, with their type, unit and words, as JSON text. */
    readonly factsJson: string
    /** The sums the setup text states as a rule that the graph does not hold, as JSON text. */
    readonly unheldRulesJson: string
}

/** One run of a graph as the owner lists it; the facts and the path travel as JSON text. */
export interface AgentGraphRunEntryWire {
    /** The run. */
    readonly id: string
    /** The road it left by: work, reply, tool or handover. */
    readonly road: string
    /** The mode the graph ran in. */
    readonly mode: string
    /** The action key. */
    readonly action: string
    /** The number of the version it ran on, or null when it is past the listing. */
    readonly version: number | null
    /** The branch that matched, or the node the walk entered at; empty when no node holds the action. */
    readonly branchKey: string
    /** What the graph did: auto, ask, stop or divert. */
    readonly outcome: string
    /** What the gate answered, or null on a road no gate judges. */
    readonly gateVerdict: string | null
    /** How the work ended, or null while it is open. */
    readonly closedAs: string | null
    /** True when the graph answered differently from the gate alone. */
    readonly differs: boolean
    /** Why the graph could not judge it, or null. */
    readonly unjudged: string | null
    /** The facts it could not read, as JSON text. */
    readonly unreadJson: string
    /** The facts as read, as JSON text. */
    readonly factsJson: string
    /** The nodes the walk went through, as JSON text. */
    readonly pathJson: string
    /** The work item, or null on a run that left none. */
    readonly workItemId: string | null
    /** The type of the subject, or null. */
    readonly subjectType: string | null
    /** The id of the subject, or null. */
    readonly subjectId: string | null
    /** When it ran. */
    readonly createdAt: string
}

/** A run as the owner lists it. */
export const runEntryWireOf = (run: RunEntry, version: number | null): AgentGraphRunEntryWire => ({
    id: run.id,
    road: run.road,
    mode: run.mode,
    action: run.action,
    version,
    branchKey: run.branchKey,
    outcome: run.outcome,
    gateVerdict: run.gateVerdict,
    closedAs: run.closedAs,
    differs: run.differs,
    unjudged: run.unjudged,
    unreadJson: JSON.stringify(run.unread),
    factsJson: JSON.stringify(run.facts),
    pathJson: JSON.stringify(run.path),
    workItemId: run.workItemId,
    subjectType: run.subjectType,
    subjectId: run.subjectId,
    createdAt: run.createdAt,
})

/** One run of the graph over a work item: which trigger, which branch, the version and the nodes, the structured parts as JSON text. */
export interface AgentGraphRunWire {
    /** The decision. */
    readonly decisionId: string
    /** The agent. */
    readonly agentId: string
    /** The version that decided. */
    readonly versionId: string
    /** The number of that version. */
    readonly version: number
    /** The trigger that woke the agent, or null when the wake is gone. */
    readonly trigger: string | null
    /** The branch the condition took. */
    readonly branchKey: string
    /** What the branch did: auto, ask or stop. */
    readonly outcome: string
    /** How the work ended, or null while it is open. */
    readonly closedAs: string | null
    /** True when the graph, in shadow, answered differently from the gate. */
    readonly shadowDiff: boolean
    /** The request that is open for it, or null. */
    readonly approvalRequestId: string | null
    /** The facts as they were read, as JSON text. */
    readonly factsJson: string
    /** The nodes the work went through, as JSON text. */
    readonly traceJson: string
}

/** The language a request names, when it names one. */
export type OptionalLanguage = string | null | undefined

/** The language asked for: Vietnamese unless English is named. */
export const localeOf = (text: OptionalLanguage): Locale => (text === "en" ? "en" : "vi")

/** The view of a graph as the editor receives it. */
export const wireOfView = (view: AgentGraphView): AgentGraphWire => ({
    agentId: view.agentId,
    installationId: view.installationId,
    mode: view.mode,
    draftRev: view.draftRev,
    isDraftChanged: view.isDraftChanged,
    activeVersionId: view.activeVersionId,
    draftJson: JSON.stringify(view.draft),
    gapsJson: JSON.stringify(view.gaps),
    problemsJson: JSON.stringify(view.problems),
    cardsJson: JSON.stringify(view.cards),
    proposalsJson: JSON.stringify(view.proposals),
    factsJson: JSON.stringify(view.facts),
    unheldRulesJson: JSON.stringify(view.unheldRules),
})
