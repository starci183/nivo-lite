import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import type { LivenessReport, ReadinessReport } from "@modules/domain/liveness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckLivenessQuery } from "../../application/check-liveness.query"
import { CheckReadinessQuery } from "../../application/check-readiness.query"

@Controller()
/** The probe paths used by the stack and edge: `/healthz` checks liveness and `/readyz` checks readiness. */
export class ProbeAliasController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process alive from process-local state without touching a dependency. */
    @Get("healthz")
    @Public({ reason: PublicReason.Health })
    healthz(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }

    /** Reports readiness only when the primary database and job statistics can answer. */
    @Get("readyz")
    @Public({ reason: PublicReason.Health })
    readyz(): Promise<ReadinessReport> {
        return this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
    }
}
