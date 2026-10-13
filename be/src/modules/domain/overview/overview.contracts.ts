/** The lead a responsibility belongs to, as far as the dashboard shows it. */
export interface OverviewResponsibilityLead {
    /** The lead id. */
    readonly id: string
    /** The customer name. */
    readonly contactName: string
    /** The customer company. */
    readonly company: string
    /** The pipeline stage. */
    readonly stage: string
}

/** One responsibility with its lead. */
export interface OverviewResponsibility {
    /** The responsibility id. */
    readonly id: string
    /** The lead it is about. */
    readonly leadId: string
    /** What it is. */
    readonly title: string
    /** `human` or `agent`. */
    readonly ownerKind: string
    /** The owning agent, when an agent owns it. */
    readonly ownerAgentId: string | null
    /** The owner name. */
    readonly ownerName: string
    /** The next action. */
    readonly nextAction: string
    /** When it is due, ISO 8601, or null. */
    readonly dueAt: string | null
    /** `open`, `waiting_approval` or `done`. */
    readonly status: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The lead behind it. */
    readonly lead: OverviewResponsibilityLead
}

/** One AI employee of the workspace. */
export interface OverviewAgent {
    /** The agent id. */
    readonly id: string
    /** The module key of its type. */
    readonly module: string
    /** The display name. */
    readonly name: string
    /** The mention handle. */
    readonly handle: string
    /** The role line. */
    readonly role: string
    /** The standing instructions. */
    readonly instructions: string
    /** The knowledge text. */
    readonly knowledge: string
    /** The greeting. */
    readonly greeting: string
    /** The approval rule text. */
    readonly approvalRule: string
    /** `active` or `paused`. */
    readonly status: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
}

/** One line of the evidence log. */
export interface OverviewEvent {
    /** The event id. */
    readonly id: string
    /** The lead it is about, or null. */
    readonly leadId: string | null
    /** The dotted kind. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** The short sentence. */
    readonly summary: string
    /** The evidence behind it, or null. */
    readonly evidence: string | null
    /** When it happened, ISO 8601. */
    readonly createdAt: string
}

/** One lead as far as the overview figures read it. */
export interface OverviewLead {
    /** The lead id. */
    readonly id: string
    /** The pipeline stage. */
    readonly stage: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The customer name, or null. */
    readonly contactName: string | null
    /** The customer company, or null. */
    readonly company: string | null
}

/** One draft waiting for a decision. */
export interface OverviewPending {
    /** The execution id. */
    readonly id: string
    /** The responsibility it belongs to. */
    readonly responsibilityId: string
    /** When it was drafted, ISO 8601. */
    readonly createdAt: string
    /** The lead behind it, or null. */
    readonly leadId: string | null
}

/** The Chatbot agent behind the onboarding checklist. */
export interface OverviewPromoChatbot {
    /** The agent id. */
    readonly id: string
    /** Its knowledge text. */
    readonly knowledge: string
}

/** A website lead behind the onboarding checklist. */
export interface OverviewWebsiteLead {
    /** The lead id. */
    readonly id: string
    /** When it came in, ISO 8601. */
    readonly createdAt: string
}

/** The first response event of a website lead. */
export interface OverviewFirstEvent {
    /** The lead id. */
    readonly leadId: string
    /** When the first response happened, ISO 8601. */
    readonly at: string
}

/** The facts behind the onboarding checklist. */
export interface OverviewPromo {
    /** The first Chatbot agent, or null. */
    readonly chatbot: OverviewPromoChatbot | null
    /** Whether the workspace bought a module inside the founding window. */
    readonly isFoundingMember: boolean
    /** The leads that came from the website. */
    readonly websiteLeads: Array<OverviewWebsiteLead>
    /** The first response event per website lead. */
    readonly firstEvents: Array<OverviewFirstEvent>
    /** Whether a customer talked to an agent. */
    readonly hasCustomerConversation: boolean
    /** Whether a conversation is tied to a lead. */
    readonly hasLeadConversation: boolean
    /** How many drafts were approved. */
    readonly approvedCount: number
    /** Whether a won lead has a recorded outcome. */
    readonly hasWon: boolean
    /** Whether an invoice draft was approved. */
    readonly invoiceApproved: boolean
}

/** The owner goals. */
export interface OverviewAuthority {
    /** The revenue goal in VND, or null. */
    readonly goalRevenueVnd: number | null
    /** The new customers goal, or null. */
    readonly goalNewCustomers: number | null
    /** The first reply goal in minutes, or null. */
    readonly goalFirstReplyMinutes: number | null
}

/** A lead row behind the governance figures. */
export interface OverviewGovernanceLead {
    /** The lead id. */
    readonly id: string
    /** The customer name, or null. */
    readonly contactName: string | null
    /** The customer company, or null. */
    readonly company: string | null
    /** `live`, `simulated` or null. */
    readonly origin: string | null
    /** The pipeline stage. */
    readonly stage: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
}

/** An order row behind the governance figures. */
export interface OverviewGovernanceOrder {
    /** The order id. */
    readonly id: string
    /** The lead, or null. */
    readonly leadId: string | null
    /** The order number, or null. */
    readonly orderNo: string | null
    /** The item text, or null. */
    readonly items: string | null
    /** The amount in VND, or null. */
    readonly amountVnd: number | null
    /** The order status. */
    readonly status: string
    /** `live`, `simulated` or null. */
    readonly origin: string | null
}

/** An invoice row behind the governance figures. */
export interface OverviewGovernanceInvoice {
    /** The invoice id. */
    readonly id: string
    /** The order, or null. */
    readonly orderId: string | null
    /** The lead, or null. */
    readonly leadId: string | null
    /** The invoice number, or null. */
    readonly invoiceNo: string | null
    /** The amount in VND, or null. */
    readonly amountVnd: number | null
    /** The invoice status. */
    readonly status: string
    /** `live`, `simulated` or null. */
    readonly origin: string | null
}

/** A payment row behind the governance figures. */
export interface OverviewGovernanceTransaction {
    /** The transaction id. */
    readonly id: string
    /** The invoice it matched, or null. */
    readonly invoiceId: string | null
    /** Who paid, or null. */
    readonly payer: string | null
    /** The payment reference, or null. */
    readonly reference: string | null
    /** The amount in VND, or null. */
    readonly amountVnd: number | null
    /** The transaction status. */
    readonly status: string
    /** `live`, `simulated` or null. */
    readonly origin: string | null
}

/** A work item row behind the governance figures. */
export interface OverviewGovernanceWork {
    /** The work item id. */
    readonly id: string
    /** The lead, or null. */
    readonly leadId: string | null
    /** The department. */
    readonly department: string
    /** The work status. */
    readonly status: string
    /** The reason code, or null. */
    readonly reason: string | null
    /** `auto`, `human` or null. */
    readonly decidedPath: string | null
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** When it last changed, ISO 8601. */
    readonly updatedAt: string
    /** When it finished, ISO 8601, or null. */
    readonly completedAt: string | null
    /** The proposal summary, or null. */
    readonly summary: string | null
    /** The proposal contact name, or null. */
    readonly contact: string | null
    /** The proposal customer, or null. */
    readonly customer: string | null
}

/** A decision row of the last 7 days. */
export interface OverviewGovernanceDecision {
    /** The work item decided, or null. */
    readonly workItemId: string | null
    /** The lead, or null. */
    readonly leadId: string | null
    /** `policy`, `owner` or `staff`. */
    readonly deciderKind: string
    /** The outcome. */
    readonly outcome: string
    /** When it was decided, ISO 8601. */
    readonly createdAt: string
}

/** One decision of the history with its customer name. */
export interface OverviewDecision {
    /** The decision id. */
    readonly id: string
    /** The work item, or null. */
    readonly workItemId: string | null
    /** The lead, or null. */
    readonly leadId: string | null
    /** The customer name, or null. */
    readonly leadName: string | null
    /** The department. */
    readonly department: string
    /** The flow action. */
    readonly action: string
    /** Who decided. */
    readonly decidedBy: string
    /** `policy`, `owner` or `staff`. */
    readonly deciderKind: string
    /** The outcome. */
    readonly outcome: string
    /** The reason code, or null. */
    readonly reason: string | null
    /** The note, or null. */
    readonly note: string | null
    /** When it was decided, ISO 8601. */
    readonly createdAt: string
}

/** The rows behind the governance figures. */
export interface OverviewGovernance {
    /** The owner goals, or null when none are set. */
    readonly authority: OverviewAuthority | null
    /** The leads. */
    readonly leads: Array<OverviewGovernanceLead>
    /** The confirmed, invoiced or paid orders. */
    readonly orders: Array<OverviewGovernanceOrder>
    /** The issued or paid invoices. */
    readonly invoices: Array<OverviewGovernanceInvoice>
    /** The matched, unmatched or review payments. */
    readonly transactions: Array<OverviewGovernanceTransaction>
    /** The newest work items. */
    readonly work: Array<OverviewGovernanceWork>
    /** Pending approvals with no work item. */
    readonly pendingWithoutWork: number
    /** The decisions of the last 7 days. */
    readonly decisions7: Array<OverviewGovernanceDecision>
    /** The latest decisions of the history. */
    readonly recent: Array<OverviewDecision>
}

/** The customer behind a work item exception. */
export interface OverviewExceptionLead {
    /** The lead id. */
    readonly id: string
    /** The customer name. */
    readonly contactName: string
    /** The customer company. */
    readonly company: string
    /** The channel the customer came from. */
    readonly channel: string
}

/** A work item waiting for a decision or failed. */
export interface OverviewException {
    /** The work item id. */
    readonly id: string
    /** The lead, or null. */
    readonly leadId: string | null
    /** The department. */
    readonly department: string
    /** The flow action. */
    readonly action: string
    /** `waiting_decision` or `failed`. */
    readonly status: string
    /** The reason code, or null. */
    readonly reason: string | null
    /** `live`, `simulated` or null. */
    readonly origin: string | null
    /** The failure text, or null. */
    readonly error: string | null
    /** The approval card behind it, or null. */
    readonly executionId: string | null
    /** The assigned staff name, or null. */
    readonly assignedStaffName: string | null
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The proposal summary, or null. */
    readonly summary: string | null
    /** The proposal contact name, or null. */
    readonly contact: string | null
    /** The proposal customer, or null. */
    readonly customer: string | null
    /** The customer it is about, or null. */
    readonly lead: OverviewExceptionLead | null
}

/** Everything the executive dashboard reads. */
export interface OverviewSnapshot {
    /** The start of the 7-day window the figures were read with, ISO 8601. */
    readonly since7: string
    /** Every responsibility, due soonest first. */
    readonly responsibilities: Array<OverviewResponsibility>
    /** The agents, oldest first. */
    readonly agents: Array<OverviewAgent>
    /** The newest evidence lines, newest first. */
    readonly events: Array<OverviewEvent>
    /** The leads. */
    readonly leads: Array<OverviewLead>
    /** The drafts waiting for a decision, newest first. */
    readonly pending: Array<OverviewPending>
    /** The onboarding facts. */
    readonly promo: OverviewPromo
    /** The rows behind the governance figures. */
    readonly governance: OverviewGovernance
    /** The work items waiting for a decision or failed. */
    readonly exceptions: Array<OverviewException>
}

/** The window the dashboard asks about. */
export interface OverviewWindow {
    /** The start of the recent window, ISO 8601. */
    readonly since7: string
    /** The start of the founding offer, ISO 8601. */
    readonly foundingFrom: string
    /** The end of the founding offer, ISO 8601. */
    readonly foundingTo: string
}
