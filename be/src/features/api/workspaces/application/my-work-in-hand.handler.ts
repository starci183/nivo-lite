import { QueryHandler } from "@nestjs/cqrs"
import { WorkInHandService } from "@modules/domain/work-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MyWorkInHandQuery } from "./my-work-in-hand.query"

@QueryHandler(MyWorkInHandQuery)
/** Answers the caller's open work items from the work-in-hand service. */
export class MyWorkInHandHandler extends ICQRSHandler<MyWorkInHandQuery, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly work: WorkInHandService,
    ) {
        super(logger)
    }

    protected override process(query: MyWorkInHandQuery): Promise<number> {
        return this.work.openCountOf(query.params.principal.id, query.params.request.workspaceId)
    }
}
