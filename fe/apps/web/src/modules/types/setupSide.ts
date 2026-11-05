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
    /** The key of the gate being edited; empty when none. */
    readonly editing: string
    readonly editText: string
    readonly evidencePlaceholder: string
    readonly isGating: boolean
    readonly confirmLabel: string
    readonly editLabel: string
    readonly editSaveLabel: string
    readonly editCancelLabel: string
    readonly isApplying: boolean
    readonly canApply: boolean
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
}

/** Everything the side column of the Setup tab draws once the setup is in. */
export interface SetupSideView {
    readonly unmet: SetupSideNotice | null
    readonly draft: SetupSideDraft
    readonly gates: SetupSideGates
    readonly knowledge: SetupSideKnowledge
    readonly versions: SetupSideVersions
}

/** What the gates card draws and does: the checklist, its skeleton, the last gate failure and the commands. */
export interface SetupGatesCardProps extends Omit<SetupSideGates, "applyTone"> {
    readonly isLoading: boolean
    readonly gateFailureTitle: string
    readonly gateFailure: string
    readonly applyTone: "idle" | "applied" | "refused"
    readonly onEditText: (value: string) => void
    readonly onGate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly onStartEdit: (gateKey: string, evidence: string) => void
    readonly onStopEdit: () => void
    readonly onApply: () => void
}

/** The words of the panes that do not come from a slot. */
export interface AgentSetupCopy {
    readonly paneLabel: string
    readonly checklistLabel: string
    readonly feedNote: string
    readonly chatLabel: string
    readonly chatTitle: string
    readonly proposalsLabel: string
    readonly proposalsEmpty: string
    readonly confirmLabel: string
    readonly proposalEditLabel: string
    readonly suggestionsLabel: string
    /** "NIVO is asking in the chat", under the current gate. */
    readonly askingLabel: string
}
