import type {
    AccountingMeasure,
    AccountingQuestionCardData,
    AccountingQuestionsView,
    AccountingWorkbenchData,
} from "@/modules/types"
import type { AccountingTranslator } from "./accounting"

const MEASURE: AccountingMeasure = { vnd: 0, count: 0 }
const STAMP = "2026-01-01T00:00:00.000Z"

/** One placeholder period: the same fields as a read one, with a week bar per week the overview draws. */
const placeholderPeriodOf = (key: "this" | "last") => ({
    key,
    fromIso: "2026-01-01",
    toIso: "2026-01-31",
    income: MEASURE,
    receivable: MEASURE,
    unmatched: MEASURE,
    weeks: ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"].map((startIso) => ({ startIso, vnd: 0 })),
})

/**
 * Fake accounting read model of the same shape as a read one: while the read is in flight the panels run their hooks over it, so the
 * skeleton is the ready tree (rows, bars, figures) drawn with isSkeleton, never a second layout. Its words are the panel's own, so the
 * skeleton lines have a believable width.
 */
export const accountingPlaceholderOf = (t: AccountingTranslator): AccountingWorkbenchData => ({
    now: STAMP,
    periods: { this: placeholderPeriodOf("this"), last: placeholderPeriodOf("last") },
    ageing: { d0: MEASURE, d30: MEASURE, d60: MEASURE },
    waiting: { count: 0, knownVnd: 0, unknownAmount: 0 },
    credits: [1, 2, 3].map((n) => ({
        id: `credit-${n}`,
        occurredAt: STAMP,
        amount: 0,
        payer: t("payerUnknown"),
        reference: t("noReference"),
        match: "matched" as const,
        invoiceNo: null,
        sourceKind: "other" as const,
    })),
    creditsSource: t("mUnmatched"),
    payablesSource: t("mUnmatched"),
    upcoming: [1, 2].map((n) => ({
        source: "supplier" as const,
        kind: "supplier_payment",
        ref: String(n),
        dueOn: STAMP.slice(0, 10),
        daysLeft: 0,
        amountVnd: 0,
        note: t("noReference"),
    })),
    reminderDays: 0,
    invoices: [1, 2, 3].map((n) => ({
        id: `invoice-${n}`,
        invoiceNo: String(n),
        amount: 0,
        status: "paid" as const,
        customer: t("payerUnknown"),
        issuedAt: STAMP,
        paidAt: STAMP,
        dueAt: null,
        createdAt: STAMP,
        orderNo: null,
    })),
    ordersWithoutInvoice: [1, 2].map((n) => ({
        id: `order-${n}`,
        orderNo: String(n),
        items: t("noReference"),
        amount: 0,
        customer: t("payerUnknown"),
        createdAt: STAMP,
    })),
    questions: [],
    staff: [],
    ownerName: "",
    ledger: [1, 2, 3].map((n) => ({
        id: `inv:ledger-${n}`,
        targetType: "invoice" as const,
        targetId: `ledger-${n}`,
        at: STAMP,
        description: t("noReference"),
        kind: "income" as const,
        amount: 0,
        status: "paid" as const,
        linked: null,
        lineage: [],
        adjustmentCount: 0,
    })),
    canAdjust: false,
    adjustmentsReady: false,
    excludedTest: 0,
})

/** One fake question card: every word is one the panel already owns, every decision is withheld. */
const placeholderCardOf = (id: string, words: string): AccountingQuestionCardData => ({
    id,
    title: words,
    status: words,
    statusTone: "warning",
    explanation: words,
    proposalLabel: words,
    summary: words,
    footer: words,
    isOpen: true,
    isFailed: false,
    canAct: true,
    isBusy: true,
    isEditing: false,
    waitingLabel: words,
    draft: null,
    draftLabel: "",
    amount: null,
    amountLabel: "",
    missingLabel: "",
    fields: [],
    candidateId: "",
    candidateLabel: "",
    candidates: [],
    reconcileCredit: null,
    reconcileWarning: "",
    basis: null,
    basisLabel: "",
    basisHint: "",
    basisPlaceholder: "",
    approveLabel: words,
    rejectLabel: words,
    editLabel: words,
    error: null,
    leadHref: null,
    leadLabel: "",
})

/** Fake question groups of the same shape: two groups of two cards, drawn as skeleton while the questions are read. */
export const accountingQuestionsPlaceholderOf = (t: AccountingTranslator): AccountingQuestionsView["props"] => ({
    intro: t("questionsIntro"),
    empty: t("questionsEmpty"),
    emptyBody: t("questionsEmptyBody"),
    groups: ["placeholder-a", "placeholder-b"].map((id) => ({
        id,
        title: t("group_unclear_payment"),
        hint: t("groupHint_unclear_payment"),
        items: [
            placeholderCardOf(`${id}-1`, t("groupHint_unclear_payment")),
            placeholderCardOf(`${id}-2`, t("groupHint_unclear_payment")),
        ],
    })),
})
