/** The part of a customer conversation the workbench needs to open a customer's thread. */
export interface ThreadOwnerRow {
    /** The conversation id. */
    readonly id: string
    /** The customer the conversation belongs to, when one is known. */
    readonly lead_id: string | null
}

/** The newest conversation of each customer; the rows arrive newest first, so the first one seen wins. */
export const conversationByLeadOf = (rows: ReadonlyArray<ThreadOwnerRow>): ReadonlyMap<string, string> => {
    const byLead = new Map<string, string>()
    for (const row of rows) if (row.lead_id && !byLead.has(row.lead_id)) byLead.set(row.lead_id, row.id)
    return byLead
}

/** The conversation a row of the customer opens: their newest, null while the customer never wrote. */
export const conversationOf = (byLead: ReadonlyMap<string, string>, leadId: string | null): string | null =>
    leadId === null ? null : (byLead.get(leadId) ?? null)
