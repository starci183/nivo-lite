import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"

@Controller("api/bank/vietcombank")
/**
 * POST /api/bank/vietcombank, the SIMULATED bank connection: one credit to the workspace account becomes an inbound payment event
 * stored as simulated money. The caller proves itself with the shared secret in `x-nivo-bank-secret`; the transaction id of the bank
 * is the idempotency key, so the same credit sent again is recorded once.
 * Body: { amount_vnd: number, content: string, sender_name?: string, event_id: string }.
 */
export class VietcombankWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly feed: BankFeedService,
    ) {}

    /** Proves the shared secret before intake and acknowledges accepted credits with HTTP 200 and an empty body. */
    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-nivo-bank-secret") secret: string | undefined,
    ): Promise<void> {
        await this.signature.verify({
            provider: "vietcombank",
            scope: "platform",
            rawBody: request.rawBody,
            signature: secret,
            timestamp: undefined,
        })
        await this.feed.acceptSimulatedCredit({ secret, rawBody: request.rawBody })
    }
}
