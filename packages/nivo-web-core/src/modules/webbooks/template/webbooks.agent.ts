import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { webbooksText } from "../copy"
import { WEBBOOKS_PROVIDERS } from "../webbooks.accounts"
import { debtRoundGraph } from "./debt-round.graph"
import { invoiceGraph } from "./invoice.graph"
import { paymentGraph } from "./payment.graph"
import { supplierInvoicesGraph } from "./supplier-invoices.graph"
import { teamChatGraph } from "./team-chat.graph"

/**
 * The Accounting agent template. It works with the CRM, the bank feeds (SePay, then Casso) and the sending
 * mailbox, in that order; no customer channel (the Renewal and Sales agents talk to the customer). Its graphs, in catalogue
 * order: the invoice after a renewal (primary), money in, the receivable round, the supplier invoices and the team chat.
 * Readiness (contract C3): `payment` hides without a bank feed or the CRM; every other graph hides only without the CRM
 * (`notice-draft` and `invoice-mail` are side nodes). `nivo` (NIVO's own tools, the invoice issue among them) is always of the agent
 * and is not listed.
 */
export const webbooksAgent: TemplateAgent = defineTemplateAgent({
    key: "webbooks",
    label: webbooksText("agent.label"),
    accounts: WEBBOOKS_PROVIDERS,
    graphs: [invoiceGraph, paymentGraph, debtRoundGraph, supplierInvoicesGraph, teamChatGraph],
    primary: invoiceGraph.key,
})
