import type { SalesDecision, WorkbenchRowView } from "@/modules/types"

/** How many pending decisions the card lists; the rest stay in the Decisions tab. */
export const SALES_WAITING_SHOWN = 3

/** The longest line the row description keeps. */
const LINE_MAX = 140

/** What a person may do with a pending decision, as the hook that owns the mutations offers it. */
export interface SalesWaitingCommands {
    /** True while another command of this desk is in flight. */
    readonly isBusy: boolean
    readonly approve: (decision: SalesDecision) => void
    readonly reject: (decision: SalesDecision) => void
    /** Opens the decision in the Decisions tab, where its fields are edited. */
    readonly edit: (decision: SalesDecision) => void
}

/** The words a row needs from the catalogue. */
export interface SalesWaitingWords {
    readonly approve: string
    readonly reject: string
    readonly edit: string
    readonly needsAnswer: string
    readonly needsDecision: string
    readonly incomplete: string
    readonly unknownCustomer: string
}

const oneLine = (text: string): string => {
    const flat = text.replace(/\s+/g, " ").trim()
    return flat.length > LINE_MAX ? flat.slice(0, LINE_MAX - 1).trimEnd() + "..." : flat
}

/** Whether the decision still lacks what approving it needs: a field the agent is missing, or the amount of a quote or an order. */
export const isIncomplete = (decision: SalesDecision): boolean =>
    decision.missing.length > 0 || (decision.hasAmount && decision.amountVnd === null)

/**
 * One pending decision as a row: the customer, the proposal, the amount, Approve as the visible command and Edit and Reject in the
 * menu. A decision that is not complete cannot be approved from here; Edit opens it where its fields are filled.
 */
export const salesWaitingRowOf = (
    words: SalesWaitingWords,
    decision: SalesDecision,
    commands: SalesWaitingCommands,
    amount: string | null,
): WorkbenchRowView => {
    const incomplete = isIncomplete(decision)
    return {
        id: decision.id,
        title: decision.customer === "" ? words.unknownCustomer : decision.customer,
        description: oneLine(decision.summary),
        badges: [
            incomplete
                ? { label: words.needsAnswer, tone: "warning" }
                : { label: words.needsDecision, tone: "neutral" },
        ],
        amount,
        proposal: decision.draft,
        trace: null,
        expiry: null,
        primary: {
            id: "approve",
            label: words.approve,
            isPending: commands.isBusy,
            isDisabled: incomplete,
            ...(incomplete ? { disabledReason: words.incomplete } : {}),
            onPress: () => commands.approve(decision),
        },
        menu: [
            { id: "edit", label: words.edit, onPress: () => commands.edit(decision) },
            { id: "reject", label: words.reject, isDanger: true, onPress: () => commands.reject(decision) },
        ],
        waitingFor: null,
    }
}
