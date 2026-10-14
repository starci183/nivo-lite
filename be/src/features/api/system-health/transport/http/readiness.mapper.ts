import { HttpStatus } from "@nestjs/common"
import type { ReadinessReport } from "@modules/domain/readiness"

export { mapHttpResponse } from "@modules/platform/http"

/** The HTTP status of each readiness report, preserving its probe body. */
export const READINESS_HTTP_STATUS: Readonly<Record<ReadinessReport["status"], HttpStatus>> = {
    ok: HttpStatus.OK,
    unready: HttpStatus.SERVICE_UNAVAILABLE,
}
