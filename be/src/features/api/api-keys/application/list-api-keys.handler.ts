import { QueryHandler } from "@nestjs/cqrs"
import { ApiKeysService } from "@modules/domain/api-keys"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListApiKeysResult } from "./list-api-keys.contracts"
import { ListApiKeysQuery } from "./list-api-keys.query"

@QueryHandler(ListApiKeysQuery)
/** Lists the workspace API keys through one domain-service call that checks the caller manages the workspace. */
export class ListApiKeysHandler extends ICQRSHandler<ListApiKeysQuery, ListApiKeysResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly apiKeys: ApiKeysService,
    ) {
        super(logger)
    }

    protected override process(query: ListApiKeysQuery): Promise<ListApiKeysResult> {
        return this.apiKeys.listKeys(query.params.principal.id, query.params.request.workspaceId)
    }
}
