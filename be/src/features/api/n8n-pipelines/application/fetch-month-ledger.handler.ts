import { QueryHandler } from "@nestjs/cqrs"
import { N8nDoorService } from "@modules/domain/n8n-runs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MonthLedger } from "@modules/domain/n8n-runs"
import { FetchMonthLedgerQuery } from "./fetch-month-ledger.query"

@QueryHandler(FetchMonthLedgerQuery)
/** Reads a month of the ledger for the accountant workflow. */
export class FetchMonthLedgerHandler extends ICQRSHandler<FetchMonthLedgerQuery, MonthLedger> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: N8nDoorService,
    ) {
        super(logger)
    }

    protected override process(message: FetchMonthLedgerQuery): Promise<MonthLedger> {
        return this.door.monthLedger(message.params.request.authorization, message.params.request.period)
    }
}
