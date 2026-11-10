/**
 * The id of every action a step's agent may call, by a stable name. Nodes, templates and executors write `TOOL.orderRecord`, never the
 * string, so an id is renamed here and nowhere else. Every NIVO tool reads `nivo.<domain>.<object>.<verb>`, the object left out when it
 * is the domain: NIVO's own actions are named by the business they do, never by a channel or by how they are built (a provider-only
 * ability would start with the provider's name: `sepay.`, `zalo.`). There is no alias: an old name resolves to nothing.
 */
export const TOOL = {
    /** Says something to a customer in their conversation. */
    customerMessageSend: "nivo.lead.message.send",
    /** Arms a care step for a later moment. */
    careSchedule: "nivo.lead.care.schedule",
    /** Finds or creates the customer of a conversation. */
    leadEnsure: "nivo.lead.ensure",
    /** Updates what the consult knows of a customer. */
    leadUpdate: "nivo.lead.update",
    /** Moves a customer's deal to a stage of the pipeline (won, lost, ...). */
    leadStageUpdate: "nivo.lead.stage.update",
    /** Creates the order of a customer, priced from the catalogue. */
    orderRecord: "nivo.order.create",
    /** Confirms a draft order. */
    orderConfirm: "nivo.order.confirm",
    /** Undoes a recorded order. */
    orderVoid: "nivo.order.cancel",
    /**
     * Sends the customer the bank details and the QR of a confirmed order and looks for a credit that already arrived: an effect, given
     * the order id alone. It arms no reminder: the step does, from the policy.
     */
    paymentQrCreate: "nivo.payment.qr.create",
    /** Marks an order paid by a bank credit. */
    paymentMarkPaid: "nivo.payment.order.settle",
    /** Looks again for a credit that arrived before the order had a payment code. */
    paymentRematch: "nivo.payment.credit.rematch",
    /** Records what a customer said they paid. */
    paymentClaimRecord: "nivo.payment.claim.record",
    /** Undoes a recorded claim. */
    paymentClaimWithdraw: "nivo.payment.claim.cancel",
    /** Says something to the team in the chat. */
    teamMessagePost: "nivo.team.message.post",
    /** Hands a conversation or a record to another agent. */
    agentTag: "nivo.agent.tag",
    /** Asks a person to decide. */
    workItemRaise: "nivo.work.item.create",
    /** Undoes a raised work item. */
    workItemWithdraw: "nivo.work.item.cancel",
    /** Closes the day: computes the day's figures from the records and posts the report card. An effect. */
    reportDailyClose: "nivo.report.daily.close",
    /** Adds one entry to the business ledger: a NIVO MCP tool. */
    ledgerAppend: "nivo.ledger.entry.append",
    /** Takes a ledger entry back: a NIVO MCP tool. */
    ledgerVoid: "nivo.ledger.entry.void",
    /** Whether a ledger is connected: a NIVO MCP tool. */
    ledgerStatus: "nivo.ledger.status.get",
    /** The bank's own list of movements: a NIVO MCP tool. */
    bankTransactions: "nivo.bank.transaction.list",
    /** Searches what the business knows for a question: the facts in force and the passages of its documents the caller may read: a NIVO MCP tool. */
    brainSearch: "nivo.brain.search",
    /** One truth in force of the truth graph with its evidence, validity and version: a NIVO MCP tool. */
    brainFactGet: "nivo.brain.fact.get",
    /** The truths in force the truth graph links to one truth, with the relation: a NIVO MCP tool. */
    brainFactRelated: "nivo.brain.fact.related",
    /** Files a change to a truth said in a private or the common chat, for the founder; never puts anything in force: a NIVO MCP tool. */
    brainChangePropose: "nivo.brain.change.propose",
    /**
     * The thread of the conversation the run serves, newest lines first: a NIVO context read, born with its final name. It takes no
     * conversation id: the door fills the run's own and refuses any other.
     */
    conversationMessageList: "nivo.conversation.message.list",
    /** The customer the run serves: the record and what the shop's workflows remember of them. A context read locked to the run's customer. */
    leadProfileGet: "nivo.lead.profile.get",
    /** The latest orders of the customer the run serves, newest first. A context read locked to the run's customer. */
    leadOrderList: "nivo.lead.order.list",
    /** What the shop's workflows wrote down about the customer the run serves, newest first. A context read locked to the run's customer. */
    leadNoteList: "nivo.lead.note.list",
} as const

/** The id of one action a step's agent may call. */
export type ToolId = (typeof TOOL)[keyof typeof TOOL]
