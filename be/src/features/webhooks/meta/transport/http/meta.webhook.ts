import { Controller, Get, Header, Headers, HttpCode, Param, Post, Query, Req, type RawBodyRequest } from "@nestjs/common"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { MetaConnectionsService } from "@modules/domain/meta-connections"
import { MetaInboxError, MetaInboxErrorCode, MetaInboxService, MetaWebhookVerifierService } from "@modules/domain/meta-inbox"
import { SANDBOX_KEY_HEADER, SandboxWebhookKeyService } from "@modules/domain/provider-sandbox"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { MetaChallengeRequest } from "./dto/meta-challenge.request"
import { SandboxConnectionRequest } from "./dto/sandbox-connection.request"

@Controller("api/connections/meta")
/** The Meta subscription proof and signed delivery door at the path registered on the Meta app. */
export class MetaWebhook {
    constructor(
        private readonly inbox: MetaInboxService,
        private readonly signature: MetaWebhookVerifierService,
        private readonly verifier: MetaConnectionsService,
        private readonly sandboxes: SandboxWebhookKeyService,
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

    /**
     * The sandbox door of the app webhook: Meta's real delivery is app-wide and names no connection, so a SANDBOX account has its own route
     * naming it. The shared sandbox guard proves its key (a wrong key, or the sandbox switched off, is refused); a live, removed or unknown
     * account, or a sandbox account of another provider, is never accepted here (the app signature proof is the live door's alone). The
     * delivery then goes to the same intake as an account's own events, with no Page id to look up.
     */
    @Post("webhook/:connectionId")
    @HttpCode(200)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receiveSandbox(
        @Req() request: RawBodyRequest<Request>,
        @Param() route: SandboxConnectionRequest,
        @Headers(SANDBOX_KEY_HEADER) sandboxKey?: string,
    ): Promise<void> {
        const verdict = await this.sandboxes.verdictOf(route.connectionId, sandboxKey)
        if (verdict.kind !== "sandbox" || verdict.provider !== "meta") {
            throw new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        }
        await this.inbox.acceptSandbox(request.rawBody, { id: route.connectionId, workspaceId: verdict.workspaceId })
    }
}
