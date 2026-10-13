import { Controller, Headers, HttpCode, Post, Req } from "@nestjs/common"
import type { RawBodyRequest } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import type { Request } from "express"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { AcceptMetaDeliveryCommand } from "../../application/accept-meta-delivery.command"

@Controller("api/connections/meta")
/** The one Meta webhook of the app (Facebook Pages and Instagram): its path is registered on the Meta app and stays byte-identical. */
export class MetaEventsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Acknowledges a signed delivery with 200 and no body; the proof is the HMAC of the raw body under the app secret. */
    @Post("webhook")
    @HttpCode(200)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async receive(
        @Req() request: RawBodyRequest<Request>,
        @Headers("x-hub-signature-256") signature: string | undefined,
    ): Promise<void> {
        await this.commandBus.execute(
            new AcceptMetaDeliveryCommand({ request: { rawBody: request.rawBody, signature } }),
        )
    }
}
