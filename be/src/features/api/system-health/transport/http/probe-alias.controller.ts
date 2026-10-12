import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import type { LivenessReport } from "@modules/domain/liveness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckLivenessQuery } from "../../application/check-liveness.query"

@Controller()
/** The probe paths the VPS stack and the edge already use (`/healthz`, `/readyz`), answered with the liveness report of `/health/live`. */
export class ProbeAliasController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process alive; the deploy health check and the watchdog call these paths since the engine era. */
    @Get(["healthz", "readyz"])
    @Public({ reason: PublicReason.Health })
    probe(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }
}
