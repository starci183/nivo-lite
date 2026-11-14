import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, type RawBodyRequest } from "@nestjs/common"
import { SANDBOX_KEY_HEADER } from "@modules/domain/provider-sandbox"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { RENDER_DOOR_PATH, VideoRenderIntakeService, type RenderDoorHeaders } from "@modules/domain/video-compose"
import { ScopedWebhookVerifier } from "@modules/domain/webhook-proofs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { RenderDoorRequest } from "./dto/render-door.request"

@Controller(RENDER_DOOR_PATH)
/**
 * POST /api/connections/video-render/:provider/:connectionId/:token, the render webhook of every compose provider for one connection
 * (the address `nivo.tool.video.compose` handed the provider). The path's token is proven first against the connection's own webhook
 * secret (the proof `VideoRenderProofsService` registered for the provider); the delivery then goes to the one render intake, which
 * holds a signing provider to its signature, keeps a finished render once and fires `render.completed`. Acknowledged with HTTP 200 and
 * an empty body, a repeat too.
 */
export class VideoRenderWebhook {
    constructor(
        private readonly signature: ScopedWebhookVerifier,
        private readonly intake: VideoRenderIntakeService,
    ) {}

    /** Proves the path's token before intake and acknowledges with HTTP 200 and an empty body. */
    @Post(":provider/:connectionId/:token")
    @HttpCode(HttpStatus.OK)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Param() route: RenderDoorRequest,
        @Headers() headers: RenderDoorHeaders,
    ): Promise<void> {
        await this.signature.verify({
            provider: route.provider,
            scope: route.connectionId,
            rawBody: request.rawBody,
            signature: route.token,
            timestamp: undefined,
            sandboxKey: typeof headers[SANDBOX_KEY_HEADER] === "string" ? headers[SANDBOX_KEY_HEADER] : undefined,
        })
        await this.intake.accept({ provider: route.provider, connectionId: route.connectionId, rawBody: request.rawBody, headers })
    }
}
