import type { HttpStatus } from "@nestjs/common"
import type { Response } from "express"

/** Adapts a probe or other typed HTTP response to a status while preserving its body. */
export const mapHttpResponse = <TBody>(response: Response, body: TBody, status: HttpStatus): TBody => {
    response.status(status)
    return body
}
