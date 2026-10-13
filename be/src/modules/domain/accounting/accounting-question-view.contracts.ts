/** Accounting Proposal Field returned by GraphQL. */
export interface AccountingProposalFieldView {
    /** name. */
    readonly name: string

    /** text. */
    readonly text: string | null

    /** number. */
    readonly number: number | null
}

/** Accounting Candidate returned by GraphQL. */
export interface AccountingCandidateView {
    /** id. */
    readonly id: string

    /** label. */
    readonly label: string

    /** amount Vnd. */
    readonly amountVnd: number
}

/** Accounting Proposal returned by GraphQL. */
export interface AccountingProposalView {
    /** summary. */
    readonly summary: string

    /** draft. */
    readonly draft: string | null

    /** amount Vnd. */
    readonly amountVnd: number | null

    /** confidence. */
    readonly confidence: number | null

    /** outcome. */
    readonly outcome: string | null

    /** fields. */
    readonly fields: ReadonlyArray<AccountingProposalFieldView>

    /** candidates. */
    readonly candidates: ReadonlyArray<AccountingCandidateView>
}

/** Accounting Work Result returned by GraphQL. */
export interface AccountingWorkResultView {
    /** summary. */
    readonly summary: string

    /** href. */
    readonly href: string | null
}

/** Accounting Question Lead returned by GraphQL. */
export interface AccountingQuestionLeadView {
    /** id. */
    readonly id: string

    /** contact Name. */
    readonly contactName: string

    /** company. */
    readonly company: string

    /** channel. */
    readonly channel: string
}

/** Accounting Question Work returned by GraphQL. */
export interface AccountingQuestionWorkView {
    /** id. */
    readonly id: string

    /** workspace Id. */
    readonly workspaceId: string

    /** department. */
    readonly department: string

    /** action. */
    readonly action: string

    /** subject Type. */
    readonly subjectType: string

    /** subject Id. */
    readonly subjectId: string | null

    /** lead Id. */
    readonly leadId: string | null

    /** inbound Event Id. */
    readonly inboundEventId: string | null

    /** parent Id. */
    readonly parentId: string | null

    /** chain Id. */
    readonly chainId: string | null

    /** depth. */
    readonly depth: number

    /** status. */
    readonly status: string

    /** decided Path. */
    readonly decidedPath: string | null

    /** reason. */
    readonly reason: string | null

    /** reasons. */
    readonly reasons: ReadonlyArray<string>

    /** missing Fields. */
    readonly missingFields: ReadonlyArray<string>

    /** proposal. */
    readonly proposal: AccountingProposalView

    /** result. */
    readonly result: AccountingWorkResultView | null

    /** error. */
    readonly error: string | null

    /** evidence State. */
    readonly evidenceState: string

    /** assigned Staff Id. */
    readonly assignedStaffId: string | null

    /** assigned Staff Name. */
    readonly assignedStaffName: string | null

    /** execution Id. */
    readonly executionId: string | null

    /** origin. */
    readonly origin: string

    /** created At. */
    readonly createdAt: string

    /** updated At. */
    readonly updatedAt: string

    /** completed At. */
    readonly completedAt: string | null

    /** installation Id. */
    readonly installationId: string | null

    /** lead. */
    readonly lead: AccountingQuestionLeadView | null
}

/** Accounting Staff returned by GraphQL. */
export interface AccountingStaffView {
    /** id. */
    readonly id: string

    /** workspace Id. */
    readonly workspaceId: string

    /** name. */
    readonly name: string

    /** role. */
    readonly role: string

    /** email. */
    readonly email: string | null

    /** active. */
    readonly active: boolean

    /** created At. */
    readonly createdAt: string
}
