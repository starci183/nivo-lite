import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { viewNodeOf, withAgentDesk, type DeskOfModule } from "../../../../shared/platform/specs/agent-desk"
import data from "./sales.workbench.json"

/**
 * The desk of the Sales agent: block 6 lists its own data, the customers by stage and the orders, each opening the module's own view
 * of it as a page. ONE counts read counts the sets: the orders' (`blocks-core.sales.api.order.counts`); the customers show no count (their count is
 * another read, `blocks-core.sales.api.lead.counts`, and a desk card reads one).
 */
export const SALES_DESK: DeskOfModule = {
    dataSets: [
        { set: "leads", label: { vi: "Kh\u00e1ch h\u00e0ng", en: "Customers" } },
        { set: "orders", label: { vi: "\u0110\u01a1n h\u00e0ng", en: "Orders" }, countPath: "total" },
        { set: "entries", label: { vi: "S\u1ed5 ghi ch\u00e9p", en: "Book entries" } },
    ],
    counts: { read: "blocks-core.sales.api.order.counts" },
    pages: {
        leads: viewNodeOf(data, "lead-pipeline"),
        orders: viewNodeOf(data, "order-pane"),
        entries: viewNodeOf(data, "book-book"),
    },
}

/** The seed spec of the Sales workbench: the agent's desk first, then the customers by stage and the orders with the owner's wait, parsed once. */
export const SALES_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(withAgentDesk(data, SALES_DESK))
