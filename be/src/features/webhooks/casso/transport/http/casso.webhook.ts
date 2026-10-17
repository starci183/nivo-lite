import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"

@Controller("api/connections/casso")
/**
 * POST /api/connections/casso/:connectionId, the bank-feed webhook of Casso for one connection. Webhook V2 carries
 * `X-Casso-Signature: t=<ms>,v1=<hex>` (HMAC-SHA512 of the sorted body under the integration key); webhook V1 carries the key as
 * `secure-token`. The proven delivery goes to one feed intake that books each positive transaction once per Casso transaction id.
 */
export class CassoWebhook {
    constructor(
        private readonly signature: ScopedWebhookVerifier,
        private readonly feed: BankFeedService,
    ) {}

    /** Proves the delivery before intake and acknowledges accepted deliveries with HTTP 200 and an empty body. */
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
        await this.signature.verify({
            provider: "casso",
            scope: connectionId,
            rawBody: request.rawBody,
            signature,
            // The V1 token rides the timestamp slot because the proof request has no second header slot.
            timestamp: secureToken,
        })
        await this.feed.acceptCassoDelivery(request.rawBody, connectionId)
    }
}
