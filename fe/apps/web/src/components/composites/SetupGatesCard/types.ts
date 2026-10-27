/** The tone of the badge of a gate. */
export type GateTone = "neutral" | "warning" | "success"

/** One gate of the checklist in the reader language. */
export type SetupGate = {
    readonly key: string
    readonly label: string
    readonly hint: string
    readonly status: string
    readonly statusLabel: string
    readonly statusTone: GateTone
    readonly evidence: string
}

/** The checklist, its progress, the apply command and what the last actions said. */
export type SetupGatesCardProps = {
    readonly title: string
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    readonly gates: ReadonlyArray<SetupGate>
    readonly isSkeleton: boolean
    /** The key of the gate being edited; empty when none. */
    readonly editing: string
    readonly editText: string
    readonly evidencePlaceholder: string
    readonly isGating: boolean
    readonly gateFailureTitle: string
    readonly gateFailure: string
    readonly confirmLabel: string
    readonly unconfirmLabel: string
    readonly editLabel: string
    readonly editSaveLabel: string
    readonly editCancelLabel: string
    readonly applyLabel: string
    readonly isApplying: boolean
    readonly canApply: boolean
    readonly applyHint: string
    readonly applyTone: "idle" | "applied" | "refused"
    readonly applyTitle: string
    readonly applyText: string
    readonly onEditText: (value: string) => void
    readonly onGate: (gateKey: string, action: "confirm" | "reopen" | "edit", evidence?: string) => void
    readonly onStartEdit: (gateKey: string, evidence: string) => void
    readonly onStopEdit: () => void
    readonly onApply: () => void
}
