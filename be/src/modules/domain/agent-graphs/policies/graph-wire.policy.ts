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
    activeVersionId: view.activeVersionId,
    draftJson: JSON.stringify(view.draft),
    gapsJson: JSON.stringify(view.gaps),
    problemsJson: JSON.stringify(view.problems),
    cardsJson: JSON.stringify(view.cards),
    proposalsJson: JSON.stringify(view.proposals),
})
