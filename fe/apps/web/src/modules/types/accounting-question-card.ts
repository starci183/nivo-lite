/** The editable inputs of one accounting proposal. */
export interface AccountingQuestionValues {
    fields: Record<string, string>
    draft: string
    amount: string
    candidateId: string
    basis: string
}

/** Atom-only display data for a proposal and its decision form. */
export interface AccountingQuestionCardData {
    readonly id: string
    readonly title: string
    readonly status: string
    readonly statusTone: "danger" | "success" | "warning"
    readonly explanation: string | null
    readonly proposalLabel: string
    readonly summary: string
    readonly footer: string | null
    readonly isOpen: boolean
    readonly isFailed: boolean
    readonly canAct: boolean
    readonly isBusy: boolean
    readonly isEditing: boolean
    readonly waitingLabel: string
    readonly draft: string | null
    readonly draftLabel: string
    readonly amount: string | null
    readonly amountLabel: string
    readonly missingLabel: string
    readonly fields: ReadonlyArray<{ readonly name: string; readonly label: string; readonly value: string }>
    readonly candidateId: string
    readonly candidateLabel: string
    readonly candidates: ReadonlyArray<{ readonly value: string; readonly label: string; readonly description: string }>
    readonly reconcileCredit: string | null
    readonly reconcileWarning: string
    readonly basis: string | null
    readonly basisLabel: string
    readonly basisHint: string
    readonly basisPlaceholder: string
    readonly approveLabel: string
    readonly rejectLabel: string
    readonly editLabel: string
    readonly error: string | null
    readonly leadHref: string | null
    readonly leadLabel: string
}

/** Actions of a single card after the parent binds its work item id. */
export interface AccountingQuestionCardActions {
    readonly approve: () => void
    readonly reject: () => void
    readonly toggleEdit: () => void
    readonly changeDraft: (value: string) => void
    readonly changeAmount: (value: string) => void
    readonly changeBasis: (value: string) => void
    readonly changeCandidate: (value: string | null) => void
    readonly changeField: (name: string, value: string) => void
}

/** Pure contract of one accounting decision card. */
export interface AccountingQuestionCardView {
    readonly props: AccountingQuestionCardData
    readonly on: AccountingQuestionCardActions
}

/** Validated actions addressed to one of the accounting questions. */
export interface AccountingQuestionsActions {
    readonly approve: (id: string) => void
    readonly reject: (id: string) => void
    readonly toggleEdit: (id: string) => void
    readonly changeDraft: (id: string, value: string) => void
    readonly changeAmount: (id: string, value: string) => void
    readonly changeBasis: (id: string, value: string) => void
    readonly changeCandidate: (id: string, value: string | null) => void
    readonly changeField: (id: string, name: string, value: string) => void
}

/** Atom-only groups of question cards and their addressed actions. */
export interface AccountingQuestionsView {
    readonly props: {
        readonly intro: string
        readonly empty: string
        readonly emptyBody: string
        readonly groups: ReadonlyArray<{
            readonly id: string
            readonly title: string
            readonly hint: string
            readonly items: ReadonlyArray<AccountingQuestionCardData>
        }>
    }
    readonly on: AccountingQuestionsActions
}
