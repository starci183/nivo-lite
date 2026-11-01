import type { Locale } from "@modules/platform/i18n"
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
}

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
})
