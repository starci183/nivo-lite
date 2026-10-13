import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { OverdueInvoices } from "@modules/domain/n8n-runs"
import type { FetchOverdueInvoicesRequest } from "./fetch-overdue-invoices.contracts"

/** Reads the overdue invoices for the debt reminder workflow. */
export class FetchOverdueInvoicesQuery extends Query<OverdueInvoices> {
    constructor(readonly params: PublicExecuteParams<FetchOverdueInvoicesRequest>) {
        super()
    }
}
