import type { Message } from "../../rows/message-text"
import type { DecisionQueueView, DecisionRowView } from "../../views/views.types"
import type { Measure } from "./figures"
import type { UnmatchedPayment } from "./decisions"
import { ASSIGN_COMMAND, OTHER_INCOME_COMMAND } from "./decisions"
import type { QuestionLine } from "./questions"
import { ANSWER_COMMAND } from "./questions"
import { DAY_MS, SHOP_OFFSET_MS } from "./shop-time"

/** The message keys of the hint lines under the figures of today. */
export const TODAY_HINT_KEYS: Readonly<Record<"received" | "matched" | "unmatched" | "waiting", string>> = {
    received: "today_received_hint",
    matched: "today_matched_hint",
    unmatched: "today_unmatched_hint",
    waiting: "today_waiting_hint",
}

/** A day of the shop as two instants. */
export interface DayInstants {
    /** The first instant of the day, ISO text. */
    readonly fromIso: string
    /** The first instant after the day, ISO text. */
    readonly toIso: string
}

/** The shop's calendar day holding `now`, as the first instant of the day and the first instant after it. */
export const todayRangeOf = (now: Date): DayInstants => {
    const shifted = now.getTime() + SHOP_OFFSET_MS
    const from = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS) - SHOP_OFFSET_MS
    return { fromIso: new Date(from).toISOString(), toIso: new Date(from + DAY_MS).toISOString() }
}

/** What today adds up to. */
export interface TodayInput {
    /** The payments received today and the matched ones. */
    readonly received: Measure
    /** The matched payments of today. */
    readonly matched: Measure
    /** The payments of today nobody tied to an order. */
    readonly unmatched: Measure
    /** How many questions wait for the owner. */
    readonly waitingQuestions: number
}

/** The figures of the "today" view, each with the hint line under it. */
export interface TodayFigures {
    /** The money received today, VND. */
    readonly receivedVnd: number
    /** The payments received today and tied to an order. */
    readonly matchedCount: number
    /** The payments received today nobody tied to an order. */
    readonly unmatchedCount: number
    /** Everything that waits for the owner: unmatched payments and questions. */
    readonly waitingCount: number
    /** The line under the money received: how many transactions. */
    readonly receivedHint: Message
    /** The line under the matched count: what they add up to. */
    readonly matchedHint: Message
    /** The line under the unmatched count: what they add up to. */
    readonly unmatchedHint: Message
    /** The line under the waiting count: how many are questions. */
    readonly waitingHint: Message
}

const VND = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 })

const moneyOf = (vnd: number): string => VND.format(Math.round(vnd))

/** The figures of today: money in, matched, unmatched and what waits for the owner. */
export const todayFiguresOf = (input: TodayInput): TodayFigures => ({
    receivedVnd: input.received.vnd,
    matchedCount: input.matched.count,
    unmatchedCount: input.unmatched.count,
    waitingCount: input.unmatched.count + input.waitingQuestions,
    receivedHint: { key: TODAY_HINT_KEYS.received, values: { count: input.received.count } },
    matchedHint: { key: TODAY_HINT_KEYS.matched, values: { amount: moneyOf(input.matched.vnd) } },
    unmatchedHint: { key: TODAY_HINT_KEYS.unmatched, values: { amount: moneyOf(input.unmatched.vnd) } },
    waitingHint: { key: TODAY_HINT_KEYS.waiting, values: { questions: input.waitingQuestions } },
})

/** The words of the queue rows, which leave the read as text: the status badges and the lines. */
export interface OwnerQueueWords {
    /** The status of a payment nobody tied to an order. */
    readonly unmatched: string
    /** The status of a question. */
    readonly question: string
    /** The words of the link to the Inbox, where the same items also stand. */
    readonly inbox: string
    /** The title of a payment row, with its amount filled in. */
    readonly paymentTitle: (amount: string) => string
}

const paymentRow = (payment: UnmatchedPayment, words: OwnerQueueWords, logo: string): DecisionRowView => ({
    ...(logo === "" ? {} : { logo }),
    id: payment.id,
    title: words.paymentTitle(moneyOf(payment.amountVnd)),
    description: [payment.payer, payment.reference].filter((part) => part !== null && part !== "").join(" · "),
    badges: [{ label: words.unmatched, tone: "warning" }],
    reason: null,
    amount: null,
    amountValue: payment.amountVnd,
    proposal: "",
    trace: null,
    expiry: null,
    primary: { id: ASSIGN_COMMAND, label: ASSIGN_COMMAND, intent: "commit" },
    edit: null,
    menu: [{ id: OTHER_INCOME_COMMAND, label: OTHER_INCOME_COMMAND }],
    waitingFor: null,
    askedAt: payment.occurredAt,
})

const questionRow = (question: QuestionLine, words: OwnerQueueWords): DecisionRowView => ({
    id: question.id,
    title: question.text,
    description: question.source,
    badges: [{ label: words.question, tone: "neutral" }],
    reason: null,
    amount: null,
    proposal: "",
    trace: null,
    expiry: null,
    primary: null,
    edit: { id: ANSWER_COMMAND, label: ANSWER_COMMAND },
    menu: [],
    draft: { answer: "" },
    waitingFor: null,
    askedAt: question.askedAt,
})

/** Where the Inbox lives, in the workspace. */
export const INBOX_PATH = "/inbox"

/** The queue of what waits for the owner: the payments nobody tied to an order (led by the logo of their connection), then the questions, counted in all. */
export const ownerQueueOf = (
    payments: ReadonlyArray<UnmatchedPayment>,
    questions: ReadonlyArray<QuestionLine>,
    total: number,
    words: OwnerQueueWords,
    logo = "",
): DecisionQueueView => ({
    count: total === 0 ? null : String(total),
    more: total === 0 ? null : { label: words.inbox, href: INBOX_PATH },
    rows: [
        ...payments.map((payment) => paymentRow(payment, words, logo)),
        ...questions.map((question) => questionRow(question, words)),
    ],
})
