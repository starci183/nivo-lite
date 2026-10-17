import { Body, Controller, Get, Headers, HttpCode, Post, Query } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ListTillMembersQuery } from "../../application/list-till-members.query"
import { toListTillMembersRequest, toListTillMembersResponse } from "./list-till-members.mapper"
import { ListTillMembersSearchRequest } from "./dto/list-till-members.request"
import type { ListTillMembersResponse } from "./dto/list-till-members.response"
import { AwardTillPointsCommand } from "../../application/award-till-points.command"
import { toAwardTillPointsRequest, toAwardTillPointsResponse } from "./award-till-points.mapper"
import { AwardTillPointsBodyRequest } from "./dto/award-till-points.request"
import type { AwardTillPointsResponse } from "./dto/award-till-points.response"
import { RedeemTillRewardCommand } from "../../application/redeem-till-reward.command"
import { toRedeemTillRewardRequest, toRedeemTillRewardResponse } from "./redeem-till-reward.mapper"
import { RedeemTillRewardBodyRequest } from "./dto/redeem-till-reward.request"
import type { RedeemTillRewardResponse } from "./dto/redeem-till-reward.response"
import { DraftTillPromoCommand } from "../../application/draft-till-promo.command"
import { toDraftTillPromoRequest, toDraftTillPromoResponse } from "./draft-till-promo.mapper"
import { DraftTillPromoBodyRequest } from "./dto/draft-till-promo.request"
import type { DraftTillPromoResponse } from "./dto/draft-till-promo.response"

@Controller("api/v1/loyalty")
/** The loyalty endpoints for a till, called with an API key. */
export class LoyaltyTillController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Lists customers or finds one by phone. */
    @Get("members")
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async listTillMembers(
        @Query() query: ListTillMembersSearchRequest,
        @Headers("authorization") authorization: string = "",
    ): Promise<ListTillMembersResponse> {
        const result = await this.queryBus.execute(
            new ListTillMembersQuery({ request: toListTillMembersRequest(query, authorization) }),
        )
        return toListTillMembersResponse(result)
    }

    /** Earns the points of a sale made outside NIVO. */
    @Post("award")
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async awardTillPoints(
        @Body() body: AwardTillPointsBodyRequest,
        @Headers("authorization") authorization: string = "",
    ): Promise<AwardTillPointsResponse> {
        const result = await this.commandBus.execute(
            new AwardTillPointsCommand({ request: toAwardTillPointsRequest(body, authorization) }),
        )
        return toAwardTillPointsResponse(result)
    }

    /** Redeems a reward for a customer. */
    @Post("redeem")
    @HttpCode(200)
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async redeemTillReward(
        @Body() body: RedeemTillRewardBodyRequest,
        @Headers("authorization") authorization: string = "",
    ): Promise<RedeemTillRewardResponse> {
        const result = await this.commandBus.execute(
            new RedeemTillRewardCommand({ request: toRedeemTillRewardRequest(body, authorization) }),
        )
        return toRedeemTillRewardResponse(result)
    }

    /** Writes the draft of a promotion for the owner to approve. */
    @Post("promo")
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async draftTillPromo(
        @Body() body: DraftTillPromoBodyRequest,
        @Headers("authorization") authorization: string = "",
    ): Promise<DraftTillPromoResponse> {
        const result = await this.commandBus.execute(
            new DraftTillPromoCommand({ request: toDraftTillPromoRequest(body, authorization) }),
        )
        return toDraftTillPromoResponse(result)
    }
}
