import { QueryHandler } from "@nestjs/cqrs"
import { ReadinessService } from "@modules/domain/liveness"
import type { ReadinessReport } from "@modules/domain/liveness"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckReadinessQuery } from "./check-readiness.query"

@QueryHandler(CheckReadinessQuery)
/** Answers the readiness probe after the readiness service checks the required dependencies. */
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
