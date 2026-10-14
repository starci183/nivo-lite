import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import type { LivenessReport, ReadinessReport } from "@modules/domain/liveness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckLivenessQuery } from "../../application/check-liveness.query"
import { CheckReadinessQuery } from "../../application/check-readiness.query"

@Controller("health")
/** Health probes: process-local liveness and readiness after checking the required dependencies. */
export class LiveController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process alive while its event loop still answers requests. */
    @Get("live")
    @Public({ reason: PublicReason.Health })
    live(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }

    /** Reports readiness only when the primary database and job statistics can answer. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    ready(): Promise<ReadinessReport> {
        return this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
    }
}
