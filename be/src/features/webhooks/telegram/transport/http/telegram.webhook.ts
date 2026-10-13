import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { TelegramInboxService } from "@modules/domain/telegram-inbox"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { ConnectionRequest } from "./dto/connection.request"

@Controller("api/telegram")
/**
 * POST /api/telegram/<connectionId>, the signed intake door of one Telegram bot. The connection own secret token is proven first; the verified update goes
 * to one domain intake that claims its inbox row and stores the message in one transaction. Telegram retries anything but a 200.
 */
export class TelegramWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly deliveries: TelegramInboxService,
    ) {}

    /** Acknowledges with 200 and no body: a duplicate receives the same acknowledgement without being processed again. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param() route: ConnectionRequest,
        @Headers("x-telegram-bot-api-secret-token") token?: string,
    ): Promise<void> {
        await this.signature.verify({
            provider: "telegram",
            scope: route.connectionId,
            rawBody: request.rawBody,
            signature: token,
            timestamp: undefined,
        })
        await this.deliveries.acceptTelegramDelivery(route.connectionId, request.rawBody)
    }
}
