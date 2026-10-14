import { QueryHandler } from "@nestjs/cqrs"
import { ReadinessService } from "@modules/domain/readiness"
import type { ReadinessReport } from "@modules/domain/readiness"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckReadinessQuery } from "./check-readiness.query"

@QueryHandler(CheckReadinessQuery)
/** Answers the readiness probe from the capability that checks the required primary database. */
export class CheckReadinessHandler extends ICQRSHandler<CheckReadinessQuery, ReadinessReport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly readiness: ReadinessService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadinessReport> {
        return this.readiness.check()
    }
}
