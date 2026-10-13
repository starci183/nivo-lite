import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetPlatformHealthRequest, GetPlatformHealthResult } from "./get-platform-health.contracts"

/** Answers the platform health page: engine, queue, failures, sign-ups, billing events and errors. */
export class GetPlatformHealthQuery extends Query<GetPlatformHealthResult> {
    constructor(readonly params: ExecuteParams<GetPlatformHealthRequest>) {
        super()
    }
}
