import { Controller, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"

@Controller("api/connections/payos")
/**
 * POST /api/connections/payos/:connectionId, the webhook of payOS for one connection. The body signature is HMAC-SHA256 under the
 * channel checksum key over the sorted `data` fields; the confirmation ping of payOS (a sample order) is acknowledged without being
 * booked. The proven delivery goes to one feed intake that books a paid order once per payOS reference.
 */
export class PayosWebhook {
    constructor(private readonly feed: BankFeedService) {}

    /** Answers HTTP 200 with `{"success": true}` and what the delivery came to. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(@Req() request: RawBodyRequest<Request>, @Param("connectionId") connectionId: string): Promise<void> {
        await this.feed.acceptPayosDelivery({ connectionId, rawBody: request.rawBody })
    }
}
