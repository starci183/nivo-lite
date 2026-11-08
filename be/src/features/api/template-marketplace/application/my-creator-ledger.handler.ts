import { QueryHandler } from "@nestjs/cqrs"
import { CreatorLedgerService, type CreatorLedgerView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { MyCreatorLedgerQuery } from "./my-creator-ledger.query"

@QueryHandler(MyCreatorLedgerQuery)
/** The ledger of what each sale owes the caller as a creator. Payouts are made by hand. */
export class MyCreatorLedgerHandler extends ICQRSHandler<MyCreatorLedgerQuery, CreatorLedgerView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: CreatorLedgerService,
    ) {
        super(logger)
    }

    protected override process(query: MyCreatorLedgerQuery): Promise<CreatorLedgerView> {
        return this.svc.mine(query.params.principal.id)
    }
}
