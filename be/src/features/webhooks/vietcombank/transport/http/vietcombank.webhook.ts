import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { BankFeedService } from "@modules/domain/billing"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"

@Controller("api/bank/vietcombank")
/**
 * POST /api/bank/vietcombank, the SIMULATED bank connection: one credit to the workspace account becomes an inbound payment event
 * stored as simulated money. The caller proves itself with the shared secret in `x-nivo-bank-secret`; the transaction id of the bank
 * is the idempotency key, so the same credit sent again is recorded once.
 * Body: { amount_vnd: number, content: string, sender_name?: string, event_id: string }.
 */
export class VietcombankWebhook {
    constructor(private readonly feed: BankFeedService) {}

    /** Answers HTTP 200 with the event the credit became. */
    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-nivo-bank-secret") secret: string | undefined,
    ): Promise<void> {
        await this.feed.acceptSimulatedCredit({ secret, rawBody: request.rawBody })
    }
}
