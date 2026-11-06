import type { BadgeTone, Figure } from "@starci/grammar/common"

/** One step of the setup card: what it is, whether it is done, and where it leads. */
export interface OverviewSetupStep {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly done: boolean
    readonly href: string
    readonly cta: string
}

/** One open responsibility of the work list. */
export interface OverviewWorkRow {
    readonly id: string
    readonly title: string
    readonly line: string
    readonly ownerName: string
    readonly ownerKind: "human" | "agent"
    readonly ownerKey: string
    readonly avatarUrl: string | null
    readonly due: string | null
    readonly isOverdue: boolean
    readonly status: { readonly label: string; readonly tone: BadgeTone }
    readonly href: string
}

/** One agent tile of the week. */
export interface OverviewDepartment {
    readonly id: string
    readonly name: string
    readonly done: string
    readonly waiting: string
    readonly last: string
    readonly href: string
}

/** One status row of the results list. */
export interface OverviewResultRow {
    readonly id: string
    readonly label: string
    readonly count: string | null
    readonly value: string
}

/** One decision waiting for the owner. */
export interface OverviewWaitingItem {
    readonly id: string
    readonly title: string
    readonly line: string
}

/** One agent of the side pane. */
export interface OverviewAgentRow {
    readonly id: string
    readonly name: string
    readonly avatarUrl: string | null
    readonly isActive: boolean
    readonly statusLabel: string
    readonly href: string
}

/** One recent event of the side pane. */
export interface OverviewActivityRow {
    readonly id: string
    /** The kind of event, which decides its glyph. */
    readonly kind: string
    readonly actor: string
    readonly summary: string
    readonly time: string
    readonly href: string | null
}

/** The pages the overview sends the reader to, as addresses inside the open workspace. */
export interface OverviewLinks {
    readonly office: string
    readonly newLead: string
    readonly responsibilities: string
    readonly authority: string
    readonly decisions: string
}

/** Everything the overview draws once the dashboard is read, in the words of the reader. */
export interface OverviewPaneReady {
    readonly links: OverviewLinks
    readonly head: { readonly title: string; readonly description: string }
    /** How many decisions wait for the owner: decides which command is the primary one. */
    readonly pending: number
    readonly setup: {
        readonly steps: ReadonlyArray<OverviewSetupStep>
        /** "4/7": how many steps are done of all. */
        readonly progress: string
        readonly done: number
        /** The first step not done, or none when all are. */
        readonly next: OverviewSetupStep | null
        readonly isComplete: boolean
    }
    readonly week: {
        readonly sentence: string
        readonly median: string
        readonly checked: string
        readonly figures: ReadonlyArray<Figure>
    }
    readonly work: {
        readonly count: string
        readonly rows: ReadonlyArray<OverviewWorkRow>
        /** What an empty list says, and the one action that invites the next step. */
        readonly empty: { readonly description: string; readonly actionLabel: string; readonly href: string }
    }
    readonly departments: ReadonlyArray<OverviewDepartment>
    readonly results: {
        readonly rows: ReadonlyArray<OverviewResultRow>
        readonly goals: ReadonlyArray<{ readonly id: string; readonly text: string; readonly isSet: boolean }>
    }
    readonly waiting: { readonly items: ReadonlyArray<OverviewWaitingItem> }
    readonly exceptions: {
        readonly total: string | null
        readonly chips: ReadonlyArray<{
            readonly id: string
            readonly label: string
            readonly tone: "warning" | "danger"
        }>
    }
    readonly agents: ReadonlyArray<OverviewAgentRow>
    readonly activity: ReadonlyArray<OverviewActivityRow>
}

/** The words every region of the overview shares, resolved by the connected block. */
export interface OverviewPaneCopy {
    readonly grid: string
    readonly main: string
    readonly asideTitle: string
    readonly asideOpen: string
    readonly asideClose: string
    readonly errorBody: string
    readonly openOffice: string
    readonly newLead: string
    readonly setupTitle: string
    readonly setupNext: string
    readonly setupAllSet: string
    readonly setupProgressLabel: string
    readonly toggleShow: string
    readonly toggleHide: string
    readonly doneLabel: string
    readonly weekTitle: string
    readonly workTitle: string
    readonly workAll: string
    readonly workEmptyTitle: string
    readonly departmentsTitle: string
    readonly resultsTitle: string
    readonly goalSet: string
    readonly historyAll: string
    readonly waitingTitle: string
    readonly waitingNone: string
    readonly seeInOffice: string
    readonly exceptionsTitle: string
    readonly exceptionsNone: string
    readonly agentsTitle: string
    readonly activityTitle: string
    readonly activityAll: string
}
