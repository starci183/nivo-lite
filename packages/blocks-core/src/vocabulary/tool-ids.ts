/**
 * The id of every action a step's agent may call, by a stable name. Nodes, templates and executors write `TOOL.orderRecord`, never the
 * string, so an id is renamed here and nowhere else. An id reads `<domain>.<object>.<verb>`, the object left out when it is the domain:
 * NIVO's own actions are named by the business they do, never by a channel or by how they are built. The NIVO MCP tools at the end keep
 * the name of their connector and tool.
 */
export const TOOL = {
    /** Says something to a customer in their conversation. */
    customerMessageSend: "customer.message.send",
    /** Arms a care step for a later moment. */
    careSchedule: "customer.care.schedule",
    /** Finds or creates the customer of a conversation. */
    leadEnsure: "lead.ensure",
    /** Updates what the consult knows of a customer. */
    leadUpdate: "lead.update",
    /** Moves a customer's deal to a stage of the pipeline (won, lost, ...). */
    leadStageUpdate: "lead.stage.update",
    /** Creates the order of a customer, priced from the catalogue. */
    orderRecord: "order.create",
    /** Confirms a draft order. */
    orderConfirm: "order.confirm",
    /** Undoes a recorded order. */
    orderVoid: "order.cancel",
    /**
     * Sends the customer the bank details and the QR of a confirmed order and looks for a credit that already arrived: an effect, given
     * the order id alone. It arms no reminder: the step does, from the policy.
     */
    paymentQrCreate: "payment.qr.create",
    /** Marks an order paid by a bank credit. */
    paymentMarkPaid: "payment.order.settle",
    /** Looks again for a credit that arrived before the order had a payment code. */
    paymentRematch: "payment.credit.rematch",
    /** Records what a customer said they paid. */
    paymentClaimRecord: "payment.claim.record",
    /** Undoes a recorded claim. */
    paymentClaimWithdraw: "payment.claim.cancel",
    /** Says something to the team in the chat. */
    teamMessagePost: "team.message.post",
    /** Hands a conversation or a record to another agent. */
    agentTag: "agent.tag",
    /** Asks a person to decide. */
    workItemRaise: "work.item.create",
    /** Undoes a raised work item. */
    workItemWithdraw: "work.item.cancel",
    /** Closes the day: computes the day's figures from the records and posts the report card. An effect. */
    reportDailyClose: "report.daily.close",
    /** Adds one entry to the business ledger: a NIVO MCP tool. */
    ledgerAppend: "ledger.append",
    /** Takes a ledger entry back: a NIVO MCP tool. */
    ledgerVoid: "ledger.void",
    /** Whether a ledger is connected: a NIVO MCP tool. */
    ledgerStatus: "ledger.status",
    /** The bank's own list of movements: a NIVO MCP tool. */
    bankTransactions: "bank.transactions",
    /** Searches what the business knows for a question: the facts in force and the passages of its documents the caller may read: a NIVO MCP tool. */
    brainSearch: "brain.search",
} as const

/** The id of one action a step's agent may call. */
export type ToolId = (typeof TOOL)[keyof typeof TOOL]
