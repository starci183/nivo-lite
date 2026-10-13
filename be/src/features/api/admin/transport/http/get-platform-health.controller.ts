import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetPlatformHealthQuery } from "../../application/get-platform-health.query"
import { toGetPlatformHealthRequest, toGetPlatformHealthResponse } from "./get-platform-health.mapper"
import { GetPlatformHealthResponse } from "./dto/get-platform-health.response"

@Controller("admin")
/** HTTP door of getPlatformHealth. */
export class GetPlatformHealthController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the platform health page: engine, queue, failures, sign-ups, billing events and errors. */
    @Get("health")
    async getPlatformHealth(@CurrentPrincipal() principal: Principal): Promise<GetPlatformHealthResponse> {
        const result = await this.queryBus.execute(
            new GetPlatformHealthQuery({ request: toGetPlatformHealthRequest(), principal }),
        )
        return toGetPlatformHealthResponse(result)
    }
}
