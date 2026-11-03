import { QueryHandler } from "@nestjs/cqrs"
import { CreatorLedgerService } from "@modules/domain/template-marketplace"
import type { CreatorLedgerView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
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
        const p = query.params.principal.id
        return this.svc.mine(p)
    }
}
