import { QueryHandler } from "@nestjs/cqrs"
import { HiringPublicService } from "@modules/domain/hiring"
import type { PublicJobOutput } from "@modules/domain/hiring"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicHiringJobQuery } from "./public-hiring-job.query"

@QueryHandler(PublicHiringJobQuery)
/** Read a published job for the apply page. */
export class PublicHiringJobHandler extends ICQRSHandler<PublicHiringJobQuery, PublicJobOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicService: HiringPublicService,
    ) {
        super(logger)
    }

    protected override process(query: PublicHiringJobQuery): Promise<PublicJobOutput> {
        return this.publicService.job(query.params.request)
    }
}
