import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, type RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedIntakeService, BankFeedReceiptsService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"

/** The provider this door speaks for: the key of its webhook in the registry. */
const PROVIDER = "sepay"

/** The fixed response SePay requires for an accepted delivery. */
export const PROVIDER_ACK = { success: true } as const

@Controller("api/connections/sepay")
/**
 * POST /api/connections/sepay/:connectionId, a workspace's OWN SePay bank feed (not NIVO's billing). The wizard shows the owner
 * this url and the generated API key to paste into SePay: `Authorization: Apikey <key>` is proven against the connection's stored
 * digest, then the delivery goes to one feed intake that books the credit once per SePay transaction id.
 */
export class SepayFeedWebhook {
    constructor(
        private readonly feed: BankFeedReceiptsService,
        private readonly intake: BankFeedIntakeService,
    ) {}

    /** Answers `{"success": true}` for every accepted, repeated or ignored delivery, so SePay stops retrying it. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param("connectionId") connectionId: string,
        @Headers("authorization") authorization: string | undefined,
    ): Promise<typeof PROVIDER_ACK> {
        await this.feed.verifyFeedDelivery(authorization, connectionId, request.rawBody, PROVIDER)
        await this.intake.acceptDelivery(request.rawBody, connectionId, PROVIDER)
        return PROVIDER_ACK
    }
}
