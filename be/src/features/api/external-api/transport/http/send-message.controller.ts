import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { SendMessageCommand } from "../../application/send-message.command"
import { SendMessageRequest } from "./dto/send-message.request"
import { SendMessageResponse } from "./dto/send-message.response"
import { toSendMessageRequest, toSendMessageResponse } from "./send-message.mapper"

@Controller("api/v1/messages")
/** HTTP door of messaging a customer: the public API, authenticated by the bearer API key inside the operation. */
export class SendMessageController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a message to a customer conversation: 202, never an instant send. */
    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    @Public({ reason: PublicReason.SignedWebhook })
    @RateLimit(RateTier.Strict)
    async sendMessage(
        @Headers("authorization") authorization: string | undefined,
        @Headers("idempotency-key") idempotencyKey: string | undefined,
        @Body() input: SendMessageRequest,
    ): Promise<SendMessageResponse> {
        const result = await this.commandBus.execute(
            new SendMessageCommand({ request: toSendMessageRequest(authorization, idempotencyKey, input) }),
        )
        return toSendMessageResponse(result)
    }
}
