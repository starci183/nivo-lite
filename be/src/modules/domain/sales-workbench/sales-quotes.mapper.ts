import type { WorkItemView } from "./work-item-view.contracts"

/** Keeps the first non-rejected numeric quote for each customer in newest-first input. */
export const quotesByLeadOf = (items: ReadonlyArray<WorkItemView>): ReadonlyMap<string, number> => {
    const quoteByLead = new Map<string, number>()
    for (const item of items) {
        const amount = item.proposal.amount_vnd
        if (
            item.action === "send_quote" &&
            item.lead_id &&
            item.status !== "rejected" &&
            typeof amount === "number" &&
            !quoteByLead.has(item.lead_id)
        ) {
            quoteByLead.set(item.lead_id, amount)
        }
    }
    return quoteByLead
}
