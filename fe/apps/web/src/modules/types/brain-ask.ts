import type { BrainPageHeaderView } from "./brain-page"
import type { DocChipView } from "./knowledge-docs"
import type { PaneGridLayout } from "./panes"
import type { DataSlot, SlotLabels } from "./slot"

/** One agent the question may be asked as. */
export interface AskAgentOption {
    readonly id: string
    readonly label: string
}

/** One passage the agent would read: its words, where it was read from, who may read it and how well it matches. */
export interface AskPassageView {
    readonly id: string
    readonly text: string
    readonly citation: string
    readonly href: string | null
    readonly chips: ReadonlyArray<DocChipView>
}

/** What one audience reads of one kind of knowledge: open or not, and how many items when it is counted. */
export interface AskSeesCell {
    readonly isOpen: boolean
    readonly count: number | null
}

/** One kind of knowledge and what each audience reads of it. */
export interface AskSeesLane {
    readonly id: string
    readonly label: string
    readonly cells: Readonly<Record<string, AskSeesCell>>
}

/** The comparison of the side pane: the customer and the chosen agent against every kind of knowledge. */
export interface AskSeesView {
    readonly audiences: ReadonlyArray<{ readonly id: string; readonly name: string }>
    readonly lanes: ReadonlyArray<AskSeesLane>
}

/** The words of the try-it screen that belong to no data. */
export interface BrainAskCopy {
    readonly grid: string
    readonly back: string
    readonly headTitle: string
    readonly headLine: string
    readonly agentLabel: string
    readonly agentPlaceholder: string
    readonly audienceLabel: string
    readonly questionLabel: string
    readonly questionPlaceholder: string
    readonly submitLabel: string
    readonly failTitle: string
    readonly resultsTitle: string
    readonly resultsCount: (count: number) => string
    readonly resultsEmpty: string
    readonly seesTitle: string
    readonly seesTable: string
    readonly seesLane: string
    readonly seesOpen: string
    readonly seesHint: string
    readonly closeAside: string
}

/** What the try-it screen draws. */
export interface BrainAskView {
    readonly props: {
        readonly header: BrainPageHeaderView
        readonly panelId: string
        readonly copy: BrainAskCopy
        readonly grid: PaneGridLayout
        /** The agents installed: the form is drawn from them, and none says so in place of the form. */
        readonly agents: DataSlot<ReadonlyArray<AskAgentOption>>
        readonly agentsLabels: SlotLabels
        readonly audienceOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly agentId: string | null
        readonly audience: string
        readonly question: string
        readonly isPending: boolean
        /** The passages found; null until a question was asked. */
        readonly results: ReadonlyArray<AskPassageView> | null
        readonly error: string | undefined
        readonly sees: DataSlot<AskSeesView>
        readonly seesLabels: SlotLabels
        /** The side pane's line under its title: which agent is compared with the customer. */
        readonly isWaiting: boolean
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly setQuestion: (value: string) => void
        readonly setAgent: (value: string | null) => void
        readonly setAudience: (value: string) => void
        readonly ask: () => void
        readonly retry: () => void
    }
}
