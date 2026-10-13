/** The requirements of the agent the workspace does not meet yet, in one notice. */
export interface SetupSideNotice {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
    readonly href: string
}

/** One gate of the checklist in the reader language. */
export interface SetupSideGate {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly status: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "warning" | "success"
    readonly evidence: string
}

/** The checklist, its progress, the apply command and what the last apply said. */
export interface SetupSideGates {
    readonly title: string
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    readonly gates: ReadonlyArray<SetupSideGate>
    readonly isLoading: boolean
    /** The key of the gate being edited; empty when none. */
    readonly editing: string
    readonly editText: string
    readonly evidencePlaceholder: string
    readonly isGating: boolean
    readonly confirmLabel: string
    readonly unconfirmLabel: string
    readonly editLabel: string
    readonly editSaveLabel: string
    readonly editCancelLabel: string
    readonly applyLabel: string
    readonly isApplying: boolean
    readonly canApply: boolean
    readonly applyHint: string
    readonly applyTone: "idle" | "applied"
    readonly applyTitle: string
    readonly applyText: string
}

/** The draft being built in the chat. */
export interface SetupSideDraft {
    readonly title: string
    readonly summary: string
    readonly emptyText: string
    readonly factsTitle: string
    readonly facts: ReadonlyArray<{ readonly key: string; readonly text: string }>
    readonly isLoading: boolean
}

/** The knowledge the module runs on. */
export interface SetupSideKnowledge {
    readonly title: string
    readonly businessLine: string
    readonly publicLine: string
    readonly emptyHint: string
    readonly knowledgeHref: string
    readonly knowledgeLabel: string
    readonly nivoHref: string
    readonly nivoLabel: string
    readonly isLoading: boolean
}

/** The applied versions of the context. */
export interface SetupSideVersions {
    readonly title: string
    readonly emptyText: string
    readonly inUseLabel: string
    readonly versions: ReadonlyArray<{
        readonly id: string
        readonly line: string
        readonly detail: string
        readonly isActive: boolean
    }>
    readonly isLoading: boolean
}

/** Everything the side column of the Setup tab draws once the setup is in. */
export interface SetupSideView {
    readonly unmet: SetupSideNotice | null
    readonly draft: SetupSideDraft
    readonly gates: SetupSideGates
    readonly knowledge: SetupSideKnowledge
    readonly versions: SetupSideVersions
}
