import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyApiService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListTillMembersResult } from "./list-till-members.contracts"
import { ListTillMembersQuery } from "./list-till-members.query"

@QueryHandler(ListTillMembersQuery)
/** Runs list-till-members through one call of the LoyaltyApiService. */
export class ListTillMembersHandler extends ICQRSHandler<ListTillMembersQuery, ListTillMembersResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tillApi: LoyaltyApiService,
    ) {
        super(logger)
    }

    protected override process(command: ListTillMembersQuery): Promise<ListTillMembersResult> {
        return this.tillApi.members(command.params.request)
    }
}
