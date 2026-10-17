import { Controller, Get, Header, Headers, HttpCode, Post, Query, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { MetaInboxService, MetaWebhookVerifierService } from "@modules/domain/meta-inbox"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { MetaChallengeRequest } from "./dto/meta-challenge.request"

@Controller("api/connections/meta")
/** The Meta subscription proof and signed delivery door at the path registered on the Meta app. */
export class MetaWebhook {
    constructor(
        private readonly inbox: MetaInboxService,
        private readonly signature: MetaWebhookVerifierService,
        private readonly verifier: MetaConnectionsService,
    ) {}

    /** Echoes the verified challenge unchanged as plain text. */
    @Get("webhook")
    @Header("content-type", "text/plain")
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async challenge(@Query() query: MetaChallengeRequest): Promise<string> {
        const challenge = await this.verifier.respondToChallenge(query)
        return challenge
    }

    /** Verifies and records the raw delivery, then acknowledges with HTTP 200 and an empty body. */
    @Post("webhook")
    @HttpCode(200)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-hub-signature-256") signature: string | undefined,
    ): Promise<void> {
        this.signature.verify(request.rawBody, signature)
        await this.inbox.accept(request.rawBody, signature)
    }
}
