import { Body, Controller, Get, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GetLoyaltyPageQuery } from "../../application/get-loyalty-page.query"
import { toGetLoyaltyPageRequest, toGetLoyaltyPageResponse } from "./get-loyalty-page.mapper"
import { GetLoyaltyPageParamsRequest } from "./dto/get-loyalty-page.request"
import type { GetLoyaltyPageResponse } from "./dto/get-loyalty-page.response"
import { RequestLoyaltyCodeCommand } from "../../application/request-loyalty-code.command"
import { toRequestLoyaltyCodeRequest, toRequestLoyaltyCodeResponse } from "./request-loyalty-code.mapper"
import { RequestLoyaltyCodeParamsRequest, RequestLoyaltyCodeBodyRequest } from "./dto/request-loyalty-code.request"
import type { RequestLoyaltyCodeResponse } from "./dto/request-loyalty-code.response"
import { VerifyLoyaltyCodeCommand } from "../../application/verify-loyalty-code.command"
import { toVerifyLoyaltyCodeRequest, toVerifyLoyaltyCodeResponse } from "./verify-loyalty-code.mapper"
import { VerifyLoyaltyCodeParamsRequest, VerifyLoyaltyCodeBodyRequest } from "./dto/verify-loyalty-code.request"
import type { VerifyLoyaltyCodeResponse } from "./dto/verify-loyalty-code.response"

@Controller("public/loyalty")
/** The public points check of a shop. */
export class PublicLoyaltyController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Shows the name of the shop for the points page. */
    @Get(":slug")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async getLoyaltyPage(@Param() params: GetLoyaltyPageParamsRequest): Promise<GetLoyaltyPageResponse> {
        const result = await this.queryBus.execute(
            new GetLoyaltyPageQuery({ request: toGetLoyaltyPageRequest(params) }),
        )
        return toGetLoyaltyPageResponse(result)
    }

    /** Asks for a code in the customer chat. */
    @Post(":slug/code")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async requestLoyaltyCode(
        @Param() params: RequestLoyaltyCodeParamsRequest,
        @Body() body: RequestLoyaltyCodeBodyRequest,
    ): Promise<RequestLoyaltyCodeResponse> {
        const result = await this.commandBus.execute(
            new RequestLoyaltyCodeCommand({ request: toRequestLoyaltyCodeRequest(params, body) }),
        )
        return toRequestLoyaltyCodeResponse(result)
    }

    /** Shows the points once the code is right. */
    @Post(":slug/verify")
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    async verifyLoyaltyCode(
        @Param() params: VerifyLoyaltyCodeParamsRequest,
        @Body() body: VerifyLoyaltyCodeBodyRequest,
    ): Promise<VerifyLoyaltyCodeResponse> {
        const result = await this.commandBus.execute(
            new VerifyLoyaltyCodeCommand({ request: toVerifyLoyaltyCodeRequest(params, body) }),
        )
        return toVerifyLoyaltyCodeResponse(result)
    }
}
