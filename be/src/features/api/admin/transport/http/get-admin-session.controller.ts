import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAdminSessionQuery } from "../../application/get-admin-session.query"
import { toGetAdminSessionRequest, toGetAdminSessionResponse } from "./get-admin-session.mapper"
import { GetAdminSessionResponse } from "./dto/get-admin-session.response"

@Controller("admin")
/** HTTP door of getAdminSession. */
export class GetAdminSessionController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers who the signed-in platform admin is; anyone else gets a not-found. */
    @Get("session")
    async getAdminSession(@CurrentPrincipal() principal: Principal): Promise<GetAdminSessionResponse> {
        const result = await this.queryBus.execute(
            new GetAdminSessionQuery({ request: toGetAdminSessionRequest(), principal }),
        )
        return toGetAdminSessionResponse(result)
    }
}
