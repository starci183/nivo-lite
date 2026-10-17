import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { SubmitLeadCommand } from "../../application/submit-lead.command"
import { SubmitLeadRequest } from "./dto/submit-lead.request"
import { SubmitLeadResponse } from "./dto/submit-lead.response"
import { toSubmitLeadRequest, toSubmitLeadResponse } from "./submit-lead.mapper"

@Controller("api/v1/leads")
/**
 * HTTP door of handing a customer over: the public API, authenticated by an API-key guard; the operation checks scope
 * and rate budget.
 */
export class SubmitLeadController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Accepts a customer for the sales flow: 202 once the hand-off is queued. */
    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async submitLead(
        @Headers("authorization") authorization: string | undefined,
        @Body() input: SubmitLeadRequest,
    ): Promise<SubmitLeadResponse> {
        const result = await this.commandBus.execute(
            new SubmitLeadCommand({ request: toSubmitLeadRequest(authorization, input) }),
        )
        return toSubmitLeadResponse(result)
    }
}
