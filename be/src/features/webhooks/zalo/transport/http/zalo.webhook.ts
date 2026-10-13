import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { ZaloInboxService } from "@modules/domain/zalo-inbox"
import { InjectWebhookSignature, RateLimit, RateTier } from "@modules/platform/http-security"
import type { WebhookSignatureService } from "@modules/platform/http-security"
import { ConnectionRequest } from "./dto/connection.request"

@Controller("api/connections/zalo")
/**
 * POST /api/connections/zalo/<connectionId>, the signed intake door of one Zalo OA. The mac made with the OA secret key of the connection is proven first;
 * the verified event goes to one domain intake that claims its inbox row and stores the message in one transaction. Zalo retries anything but a 200.
 */
export class ZaloWebhook {
    constructor(
        @InjectWebhookSignature() private readonly signature: WebhookSignatureService,
        private readonly deliveries: ZaloInboxService,
    ) {}

    /** Acknowledges with 200 and no body: a duplicate receives the same acknowledgement without being processed again. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param() route: ConnectionRequest,
        @Headers("x-zevent-signature") mac?: string,
    ): Promise<void> {
        await this.signature.verify({
            provider: "zalo",
            scope: route.connectionId,
            rawBody: request.rawBody,
            signature: mac,
            timestamp: undefined,
        })
        await this.deliveries.acceptZaloDelivery(route.connectionId, request.rawBody)
    }
}
