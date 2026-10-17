import { Controller, Get, Query, Redirect } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { GoogleCallbackCommand } from "../../application/google-callback.command"
import { GoogleCallbackRequest } from "./dto/google-callback.request"

@Controller("api/connections/google")
/** The Google consent callback: its path is registered on the Google OAuth client and stays byte-identical. */
export class GoogleCallbackController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Google sends the browser here with the signed state; it is sent on to the site with the result. */
    @Get("callback")
    @Redirect()
    @Public({ reason: PublicReason.AuthHandshake })
    @RateLimit(RateTier.Strict)
    async callback(@Query() query: GoogleCallbackRequest): Promise<{ url: string }> {
        const outcome = await this.commandBus.execute(
            new GoogleCallbackCommand({ request: { state: query.state, code: query.code, error: query.error } }),
        )
        return { url: outcome.location }
    }
}
