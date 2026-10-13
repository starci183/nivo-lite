import { QueryHandler } from "@nestjs/cqrs"
import { N8nDoorService } from "@modules/domain/n8n-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { OverdueInvoices } from "@modules/domain/n8n-runs"
import { FetchOverdueInvoicesQuery } from "./fetch-overdue-invoices.query"

@QueryHandler(FetchOverdueInvoicesQuery)
/** Reads the overdue invoices for the debt reminder workflow. */
export class FetchOverdueInvoicesHandler extends ICQRSHandler<FetchOverdueInvoicesQuery, OverdueInvoices> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: N8nDoorService,
    ) {
        super(logger)
    }

    protected override process(message: FetchOverdueInvoicesQuery): Promise<OverdueInvoices> {
        return this.door.overdueInvoices(message.params.request.authorization)
    }
}
