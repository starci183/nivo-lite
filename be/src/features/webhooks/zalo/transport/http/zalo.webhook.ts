import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, type RawBodyRequest } from "@nestjs/common"
import { SANDBOX_KEY_HEADER } from "@modules/domain/provider-sandbox"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { ZaloDeliveryIntakeService } from "@modules/domain/zalo-inbox"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { ConnectionRequest } from "./dto/connection.request"

@Controller("api/connections/zalo")
/**
 * POST /api/connections/zalo/<connectionId>, the signed intake door of one Zalo OA. The mac made with the OA secret key of the connection is proven first;
 * the verified event goes to one domain intake that claims its inbox row and queues its consumer in one transaction, then tells the poll schedule the webhook delivers. Zalo retries anything but a 200.
 */
export class ZaloWebhook {
    constructor(
        private readonly signature: ScopedWebhookVerifier,
        private readonly deliveries: ZaloDeliveryIntakeService,
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
        @Headers(SANDBOX_KEY_HEADER) sandboxKey?: string,
    ): Promise<void> {
        await this.signature.verify({
            provider: "zalo",
            scope: route.connectionId,
            rawBody: request.rawBody,
            signature: mac,
            timestamp: undefined,
            sandboxKey,
        })
        await this.deliveries.accept(request.rawBody, route.connectionId)
    }
}
