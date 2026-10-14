import { Controller, Get, Res } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import type { Response } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import type { LivenessReport } from "@modules/domain/liveness"
import type { ReadinessReport } from "@modules/domain/readiness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckLivenessQuery } from "../../application/check-liveness.query"
import { CheckReadinessQuery } from "../../application/check-readiness.query"
import { mapHttpResponse, READINESS_HTTP_STATUS } from "./readiness.mapper"

@Controller()
/** The existing probe paths: process-local liveness at `/healthz`, required-dependency readiness at `/readyz`. */
export class ProbeAliasController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process alive using the same dependency-free report as `/health/live`. */
    @Get("healthz")
    @Public({ reason: PublicReason.Health })
    probe(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }

    /** Answers whether this instance can receive work, preserving the dependency report on HTTP 503. */
    @Get("readyz")
    @Public({ reason: PublicReason.Health })
    async ready(@Res({ passthrough: true }) response: Response): Promise<ReadinessReport> {
        const report = await this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
        return mapHttpResponse(response, report, READINESS_HTTP_STATUS[report.status])
    }
}
