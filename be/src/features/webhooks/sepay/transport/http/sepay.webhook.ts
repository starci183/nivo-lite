import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { SepayTransactionsService } from "@modules/domain/sepay-transactions"
import { Public, PublicReason } from "@modules/domain/identity"
import { RateLimit, RateTier } from "@modules/platform/http-security"

@Controller("api/sepay/webhook")
/**
 * POST /api/sepay/webhook, SePay's bank webhook for NIVO's own billing (https://docs.sepay.vn). SePay proves itself with
 * `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`; the verified delivery goes to one settlement intake that claims the SePay
 * transaction id, settles the order it names and records the outcome in one transaction.
 */
export class SepayWebhook {
    constructor(private readonly settlement: SepayTransactionsService) {}

    /** Answers HTTP 200 with `{"success": true}`; a repeated delivery gets the same answer without being applied again. */
    @Post()
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("authorization") authorization: string | undefined,
    ): Promise<{ readonly success: true }> {
        await this.settlement.acceptSepayDelivery({ authorization, rawBody: request.rawBody })
        return { success: true }
    }
}
