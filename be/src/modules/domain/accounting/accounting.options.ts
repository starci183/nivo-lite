import type { Type } from "@nestjs/common"
import type { AccountingGateway } from "./accounting-gateway.port"

/** The options of the accounting capability: the MCP gateway adapter the app root binds (the unwired one when absent). */
export interface AccountingOptions {
    /** The class that reads the accounting sources (e-invoices, payment credits, receivables) by capability role of the MCP gateway. */
    readonly gateway?: Type<AccountingGateway>
}
