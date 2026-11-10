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
    /** What the agent does about this item: on its own, only after asking, or never. */
    readonly group: "auto" | "ask" | "never"
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
    /** "NIVO understood:", before what NIVO took from the chat for an item. */
    readonly understoodLabel: string
    readonly isApplying: boolean
    readonly canApply: boolean
    readonly applyTone: "idle" | "applied"
    readonly applyTitle: string
    readonly applyText: string
}

/** Everything the side column of the Setup tab draws once the setup is in; the versions are the ones of the graph, the one source of the running version. */
export interface SetupSideView {
    readonly unmet: SetupSideNotice | null
    readonly gates: SetupSideGates
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

/** One item NIVO filled and the owner did not confirm yet, as the chat proposes it ("Item 4 - ..."). */
export interface AgentSetupProposal {
    readonly key: string
    readonly title: string
    readonly evidence: string
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
    readonly sideTitle: string
    readonly understandingTitle: string
    readonly groupLabels: Readonly<Record<"auto" | "ask" | "never", string>>
    readonly understandingEmpty: string
    readonly versionNone: string
    readonly mapTitle: string
    readonly mapNote: string
    readonly nivoName: string
    readonly mapModeLabel: string
    readonly mapOpen: string
    readonly mapClose: string
    readonly chatSubtitle: string
    readonly versionsTitle: string
    readonly versionsEmpty: string
    readonly inUseLabel: string
    readonly mapEmptyTitle: string
    readonly mapEmptyBody: string
    readonly proposalFrom: string
    readonly applyLabel: string
    readonly cancelLabel: string
    readonly proposedLabel: string
    readonly confirmedLabel: string
}
