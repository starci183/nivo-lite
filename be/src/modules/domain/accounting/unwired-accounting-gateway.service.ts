import { Injectable } from "@nestjs/common"
import type { DeskConnections, GatewayPayable, OptionalConnectorName } from "./accounting-desk.contracts"
import type {
    AccountingGateway,
    GatewayEinvoice,
    OptionalReceivable,
    PaymentCredit,
    RoleAnswer,
} from "./accounting-gateway.port"

@Injectable()
/** The accounting gateway before the MCP gateway is bound: no tool answers, so no invoice, no credit, no receivable, nothing recorded. */
export class UnwiredAccountingGatewayService implements AccountingGateway {
    /** No invoice is received. */
    listEinvoices(): Promise<RoleAnswer<ReadonlyArray<GatewayEinvoice>>> {
        return Promise.resolve({ tool: null, value: [] })
    }

    /** No invoice is waiting for payment. */
    listOpenPayables(): Promise<ReadonlyArray<GatewayPayable>> {
        return Promise.resolve([])
    }

    /** No outgoing payment is known. */
    listPaymentDebits(): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>> {
        return Promise.resolve({ tool: null, value: [] })
    }

    /** No credit is known. */
    listPaymentCredits(): Promise<RoleAnswer<ReadonlyArray<PaymentCredit>>> {
        return Promise.resolve({ tool: null, value: [] })
    }

    /** No receivable is known. */
    findReceivable(): Promise<RoleAnswer<OptionalReceivable>> {
        return Promise.resolve({ tool: null, value: null })
    }

    /** Nothing is recorded. */
    recordPayment(): Promise<boolean> {
        return Promise.resolve(false)
    }

    /** No connector feeds payment credits. */
    creditsSource(): Promise<OptionalConnectorName> {
        return Promise.resolve(null)
    }

    /** No optional feature is connected. */
    connections(): Promise<DeskConnections> {
        return Promise.resolve({ invoices: false, receivables: false })
    }
}
