import type { SavingLine } from "../workspace-dashboard.contracts"

/**
 * The definition of "hours saved", in the open. Every item an agent finished is worth the minutes a person would have spent doing the
 * same thing by hand (reading, deciding, typing, sending). The numbers are estimates a small shop agrees with, not measurements: they
 * are shown on hover beside the figure and are the one place to change them. An action not listed is worth DEFAULT_MINUTES.
 */
export const SAVED_MINUTES: Readonly<Record<string, number>> = {
    reply_customer: 2,
    greet_prospect: 1,
    ask_qualifying: 2,
    capture_lead: 3,
    classify_lead: 2,
    score_lead: 3,
    handoff_lead: 2,
    handoff_to_sales: 2,
    follow_up: 3,
    follow_up_lead: 3,
    send_follow_up: 3,
    send_care: 3,
    close_lead: 2,
    reply_comment_public: 2,
    private_reply_comment: 2,
    send_lead_offer: 5,
    quote_custom_price: 8,
    send_quote: 8,
    confirm_order: 5,
    give_discount: 2,
    issue_invoice: 6,
    review_einvoice: 4,
    reconcile_payment: 4,
    record_receivable_payment: 4,
    confirm_supplier_payment: 5,
    send_email: 3,
    confirm_booking: 3,
    reschedule: 3,
    cancel_booking: 2,
    remind_booking: 1,
    remind_shift: 1,
    publish_schedule: 10,
    draft_purchase_order: 8,
    send_purchase_order: 4,
    adjust_stock: 3,
    award_points: 1,
    redeem_reward: 2,
    send_promo: 3,
    draft_post: 15,
    publish_post: 5,
    screen_candidate: 6,
    schedule_interview: 5,
    send_offer: 6,
}

/** What an action that is not listed is worth, minutes. */
export const DEFAULT_MINUTES = 2

/** The most lines of the definition the dashboard returns. */
const LINES_MAX = 8

/** The minutes one finished item of this action is worth. */
export const minutesOf = (action: string): number => SAVED_MINUTES[action] ?? DEFAULT_MINUTES

/** One action and how many of it were finished. */
export interface FinishedAction {
    /** The action key. */
    readonly action: string
    /** How many were finished. */
    readonly count: number
}

/** The minutes saved by finishing these actions. */
export const minutesSavedBy = (finished: ReadonlyArray<FinishedAction>): number =>
    finished.reduce((sum, item) => sum + item.count * minutesOf(item.action), 0)

/** The lines of the definition: each action once, its count summed, the one worth the most minutes first. */
export const savingLinesOf = (finished: ReadonlyArray<FinishedAction>): ReadonlyArray<SavingLine> => {
    const counts = new Map<string, number>()
    for (const item of finished) counts.set(item.action, (counts.get(item.action) ?? 0) + item.count)
    return [...counts]
        .filter(([, count]) => count > 0)
        .map(([action, count]) => ({ action, count, minutesEach: minutesOf(action) }))
        .sort(
            (left, right) =>
                right.count * right.minutesEach - left.count * left.minutesEach ||
                left.action.localeCompare(right.action),
        )
        .slice(0, LINES_MAX)
}
