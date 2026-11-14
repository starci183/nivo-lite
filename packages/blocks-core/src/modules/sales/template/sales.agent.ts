import { type TemplateAgent, defineTemplateAgent } from "@nivo-lite/agent-sdk/template"
import { bilingualOf } from "../../../messages/catalog"
// Slice A's builder of the three blocks-core team-chat graphs (`modules/team-chat.graph.ts`), as the staging tree has it.
import { teamChatGraphOf } from "../../team-chat.graph"
import { BANK_FEED_PROVIDERS } from "../../../nodes/sales/credit-read.node"
import { SALES_CONSULT_PROVIDERS } from "../sales.accounts"
import { salesAfterSaleGraph } from "./after-sale.graph"
// Slice B's draft (`consult.graph.ts` exporting `salesConsultGraph`), as the staging tree has it.
import { salesConsultGraph } from "./consult.graph"
import { salesDeliveryCheckGraph } from "./delivery-check.graph"
import { salesOccasionGraph } from "./occasion.graph"
import { salesPaymentGraph } from "./payment.graph"
import { salesWebOrderGraph } from "./web-order.graph"

/**
 * The Sales agent template: the customer channels (Zalo OA, Telegram, Facebook) it works with, in the order they are attached, and the bank
 * feeds whose credits it reads (SePay, Casso, payOS); its graphs are the consult (primary), the money in (`sales.payment`), the payment reminder, the care
 * that follows a sale (thank-you, check-in, occasions), the website order and the team chat.
 */
export const salesAgent: TemplateAgent = defineTemplateAgent({
    key: "sales",
    label: bilingualOf("contractAgentSales"),
    // `nivo` (NIVO's own tools that need a mode) is always the agent's and always bound: never listed here.
    // The bank feeds in priority order: the money in reads whichever of them the workspace attached.
    accounts: [...SALES_CONSULT_PROVIDERS, ...BANK_FEED_PROVIDERS],
    graphs: [
        salesConsultGraph,
        salesPaymentGraph,
        salesAfterSaleGraph,
        salesDeliveryCheckGraph,
        salesOccasionGraph,
        salesWebOrderGraph,
        teamChatGraphOf("sales"),
    ],
    primary: salesConsultGraph.key,
})
