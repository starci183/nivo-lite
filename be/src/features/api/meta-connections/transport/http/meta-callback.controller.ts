import { Controller, Get, Query, Redirect } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { MetaCallbackCommand } from "../../application/meta-callback.command"
import { MetaCallbackRequest } from "./dto/meta-callback.request"

@Controller("api/connections/meta")
/** The Meta login callback at the path registered on the Meta app. */
export class MetaCallbackController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Meta sends the browser here with the signed state; it is sent on to the site with the result. */
    @Get("callback")
    @Redirect()
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async callback(@Query() query: MetaCallbackRequest): Promise<{ url: string }> {
        const outcome = await this.commandBus.execute(
            new MetaCallbackCommand({ request: { state: query.state, code: query.code, error: query.error } }),
        )
        return { url: outcome.location }
    }
}
