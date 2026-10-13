import { Controller, Get, Header, Query, Redirect } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { MetaCallbackCommand } from "../../application/meta-callback.command"
import { MetaChallengeQuery } from "../../application/meta-challenge.query"
import { MetaCallbackRequest, MetaChallengeRequest } from "./dto/meta-callback.request"

@Controller("api/connections/meta")
/** The Meta login callback and the webhook verification: their paths are registered on the Meta app and stay byte-identical. */
export class MetaCallbackController {
    constructor(
        @InjectCommandBus() private readonly commandBus: CommandBus,
        @InjectQueryBus() private readonly queryBus: QueryBus,
    ) {}

    /** Meta sends the browser here with the signed state; it is sent on to the site with the result. */
    @Get("callback")
    @Redirect()
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async callback(@Query() query: MetaCallbackRequest): Promise<{ url: string }> {
        const outcome = await this.commandBus.execute(
            new MetaCallbackCommand({ request: { state: query.state, code: query.code, error: query.error } }),
        )
        return { url: outcome.location }
    }

    /** Meta verifies the webhook address with the hub query and expects the challenge back as text. */
    @Get("webhook")
    @Header("content-type", "text/plain")
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    challenge(@Query() query: MetaChallengeRequest): Promise<string> {
        return this.queryBus.execute(
            new MetaChallengeQuery({
                request: {
                    mode: query["hub.mode"],
                    verifyToken: query["hub.verify_token"],
                    challenge: query["hub.challenge"],
                },
            }),
        )
    }
}
