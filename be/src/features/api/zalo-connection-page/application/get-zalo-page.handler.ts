import { QueryHandler } from "@nestjs/cqrs"
import { ZaloPageService } from "@modules/domain/channels"
import type { ZaloPageView } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetZaloPageQuery } from "./get-zalo-page.query"

@QueryHandler(GetZaloPageQuery)
/** Answers the page of a Zalo OA connection through the ZaloPageService. */
export class GetZaloPageHandler extends ICQRSHandler<GetZaloPageQuery, ZaloPageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ZaloPageService,
    ) {
        super(logger)
    }

    protected override process(query: GetZaloPageQuery): Promise<ZaloPageView> {
        return this.page.view(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
