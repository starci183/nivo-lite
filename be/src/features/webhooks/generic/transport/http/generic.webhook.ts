import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, type RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { GENERIC_WEBHOOK, GenericWebhookIntakeService } from "@modules/domain/agent-inbound"
import { Public, PublicReason } from "@modules/domain/identity"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { EndpointRequest } from "./dto/endpoint.request"

@Controller("api/inbound")
/**
 * POST /api/inbound/<connectionId>, the signed door of one generic webhook endpoint. The HMAC of the raw body under the endpoint own secret
 * is proven first; the verified delivery becomes one inbound event, written as a wake and its run in one transaction, and the sender gets
 * 202 at once: the agent works on it in the background. A redelivery is acknowledged the same way and writes nothing.
 */
export class GenericWebhook {
    constructor(
        private readonly signature: ScopedWebhookVerifier,
        private readonly intake: GenericWebhookIntakeService,
    ) {}

    /** Acknowledges with 202 and no body. */
    @Post(":connectionId")
    @HttpCode(HttpStatus.ACCEPTED)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param() route: EndpointRequest,
        @Headers("x-signature") signature?: string,
        @Headers("x-event-type") eventType?: string,
        @Headers("x-idempotency-key") deliveryKey?: string,
    ): Promise<void> {
        await this.signature.verify({
            provider: GENERIC_WEBHOOK,
            scope: route.connectionId,
            rawBody: request.rawBody,
            signature,
            timestamp: undefined,
        })
        await this.intake.accept({
            endpoint: route.connectionId,
            rawBody: request.rawBody,
            signature,
            eventType,
            deliveryKey,
        })
    }
}
