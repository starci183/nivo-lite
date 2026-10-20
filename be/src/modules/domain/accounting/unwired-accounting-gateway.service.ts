import { Injectable } from "@nestjs/common"
import type { GatewayPayable } from "./accounting-desk.contracts"
import type { AccountingGateway, GatewayBankCredit, GatewayEinvoice, OptionalFolio } from "./accounting-gateway.port"

@Injectable()
/** The accounting gateway before the MCP gateway is bound: no invoice, no credit, no folio, nothing recorded. */
export class UnwiredAccountingGatewayService implements AccountingGateway {
    /** No invoice is received. */
    listEinvoices(): Promise<ReadonlyArray<GatewayEinvoice>> {
        return Promise.resolve([])
    }

    /** No invoice is waiting for payment. */
    listOpenPayables(): Promise<ReadonlyArray<GatewayPayable>> {
        return Promise.resolve([])
    }

    /** No credit is known. */
    listBankCredits(): Promise<ReadonlyArray<GatewayBankCredit>> {
        return Promise.resolve([])
    }

    /** No folio is known. */
    findByTransferRef(): Promise<OptionalFolio> {
        return Promise.resolve(null)
    }

    /** Nothing is recorded. */
    recordPayment(): Promise<boolean> {
        return Promise.resolve(false)
    }
}
