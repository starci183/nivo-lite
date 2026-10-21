/** Accounting Book Lead returned by GraphQL. */
export interface AccountingBookLeadView {
    /** contact Name. */
    readonly contactName: string | null

    /** company. */
    readonly company: string | null
}

/** Accounting Book Order Brief returned by GraphQL. */
export interface AccountingBookOrderBriefView {
    /** order No. */
    readonly orderNo: string

    /** items. */
    readonly items: string

    /** amount Vnd. */
    readonly amountVnd: number | null

    /** status. */
    readonly status: string
}

/** Accounting Book Invoice returned by GraphQL. */
export interface AccountingBookInvoiceView {
    /** id. */
    readonly id: string

    /** workspace Id. */
    readonly workspaceId: string

    /** order Id. */
    readonly orderId: string | null

    /** lead Id. */
    readonly leadId: string | null

    /** invoice No. */
    readonly invoiceNo: string

    /** amount Vnd. */
    readonly amountVnd: number

    /** status. */
    readonly status: string

    /** issued By. */
    readonly issuedBy: string | null

    /** paid At. */
    readonly paidAt: string | null

    /** issued At. */
    readonly issuedAt: string | null

    /** due At. */
    readonly dueAt: string | null

    /** created At. */
    readonly createdAt: string

    /** order. */
    readonly order: AccountingBookOrderBriefView | null

    /** lead. */
    readonly lead: AccountingBookLeadView | null
}

/** Accounting Book Inbound returned by GraphQL. */
export interface AccountingBookInboundView {
    /** channel. */
    readonly channel: string

    /** event Id. */
    readonly eventId: string | null

    /** body. */
    readonly body: string

    /** sender Name. */
    readonly senderName: string | null
}

/** Accounting Book Transaction returned by GraphQL. */
export interface AccountingBookTransactionView {
    /** id. */
    readonly id: string

    /** workspace Id. */
    readonly workspaceId: string

    /** inbound Event Id. */
    readonly inboundEventId: string | null

    /** amount Vnd. */
    readonly amountVnd: number

    /** reference. */
    readonly reference: string | null

    /** payer. */
    readonly payer: string | null

    /** invoice Id. */
    readonly invoiceId: string | null

    /** status. */
    readonly status: string

    /** channel. */
    readonly channel: string

    /** occurred At. */
    readonly occurredAt: string

    /** created At. */
    readonly createdAt: string

    /** inbound. */
    readonly inbound: AccountingBookInboundView | null
}

/** Accounting Book Order returned by GraphQL. */
export interface AccountingBookOrderView {
    /** id. */
    readonly id: string

    /** workspace Id. */
    readonly workspaceId: string

    /** lead Id. */
    readonly leadId: string | null

    /** inbound Event Id. */
    readonly inboundEventId: string | null

    /** order No. */
    readonly orderNo: string

    /** items. */
    readonly items: string

    /** amount Vnd. */
    readonly amountVnd: number | null

    /** status. */
    readonly status: string

    /** confirmed By. */
    readonly confirmedBy: string | null

    /** confirmed At. */
    readonly confirmedAt: string | null

    /** created At. */
    readonly createdAt: string

    /** shipped At. */
    readonly shippedAt: string | null

    /** carrier. */
    readonly carrier: string | null

    /** tracking Code. */
    readonly trackingCode: string | null

    /** lead. */
    readonly lead: AccountingBookLeadView | null
}

/** Accounting Book Work returned by GraphQL. */
export interface AccountingBookWorkView {
    /** id. */
    readonly id: string

    /** action. */
    readonly action: string

    /** status. */
    readonly status: string

    /** subject Type. */
    readonly subjectType: string

    /** subject Id. */
    readonly subjectId: string | null

    /** created At. */
    readonly createdAt: string
}

/** Accounting Book Decision returned by GraphQL. */
export interface AccountingBookDecisionView {
    /** id. */
    readonly id: string

    /** work Item Id. */
    readonly workItemId: string | null

    /** action. */
    readonly action: string

    /** decided By. */
    readonly decidedBy: string

    /** decider Kind. */
    readonly deciderKind: string

    /** outcome. */
    readonly outcome: string

    /** note. */
    readonly note: string | null

    /** created At. */
    readonly createdAt: string
}

/** Accounting Book Adjustment returned by GraphQL. */
export interface AccountingBookAdjustmentView {
    /** id. */
    readonly id: string

    /** target Type. */
    readonly targetType: string

    /** target Id. */
    readonly targetId: string

    /** note. */
    readonly note: string

    /** corrected Amount. */
    readonly correctedAmount: number | null

    /** created By. */
    readonly createdBy: string

    /** created At. */
    readonly createdAt: string
}

/** Accounting Book returned by GraphQL. */
export interface AccountingBookView {
    /** invoices. */
    readonly invoices: ReadonlyArray<AccountingBookInvoiceView>

    /** transactions. */
    readonly transactions: ReadonlyArray<AccountingBookTransactionView>

    /** orders. */
    readonly orders: ReadonlyArray<AccountingBookOrderView>

    /** works. */
    readonly works: ReadonlyArray<AccountingBookWorkView>

    /** decisions. */
    readonly decisions: ReadonlyArray<AccountingBookDecisionView>

    /** adjustments. */
    readonly adjustments: ReadonlyArray<AccountingBookAdjustmentView>

    /** adjustments Ready. */
    readonly adjustmentsReady: boolean
}
