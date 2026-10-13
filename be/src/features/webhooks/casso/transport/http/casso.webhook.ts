import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"

@Controller("api/connections/casso")
/**
 * POST /api/connections/casso/:connectionId, the bank-feed webhook of Casso for one connection. Webhook V2 carries
 * `X-Casso-Signature: t=<ms>,v1=<hex>` (HMAC-SHA512 of the sorted body under the integration key); webhook V1 carries the key as
 * `secure-token`. The proven delivery goes to one feed intake that books each positive transaction once per Casso transaction id.
 */
export class CassoWebhook {
    constructor(private readonly feed: BankFeedService) {}

    /** Answers HTTP 200 with `{"success": true, "accepted": n}`. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param("connectionId") connectionId: string,
        @Headers("x-casso-signature") signature: string | undefined,
        @Headers("secure-token") secureToken: string | undefined,
    ): Promise<void> {
        await this.feed.acceptCassoDelivery({ connectionId, rawBody: request.rawBody, signature, secureToken })
    }
}
