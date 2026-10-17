import { Controller, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"

@Controller("api/connections/payos")
/**
 * POST /api/connections/payos/:connectionId, the webhook of payOS for one connection. The body signature is HMAC-SHA256 under the
 * channel checksum key over the sorted `data` fields; the confirmation ping of payOS (a sample order) is acknowledged without being
 * booked. The proven delivery goes to one feed intake that books a paid order once per payOS reference.
 */
export class PayosWebhook {
    constructor(
        private readonly signature: ScopedWebhookVerifier,
        private readonly feed: BankFeedService,
    ) {}

    /** Proves the body signature before intake and acknowledges accepted deliveries with HTTP 200 and an empty body. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(@Req() request: RawBodyRequest<Request>, @Param("connectionId") connectionId: string): Promise<void> {
        await this.signature.verify({
            provider: "payos",
            scope: connectionId,
            rawBody: request.rawBody,
            signature: undefined,
            timestamp: undefined,
        })
        await this.feed.acceptPayosDelivery(request.rawBody, connectionId)
    }
}
