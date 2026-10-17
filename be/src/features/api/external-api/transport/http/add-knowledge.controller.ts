import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { Credential } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { AddKnowledgeCommand } from "../../application/add-knowledge.command"
import { toAddKnowledgeRequest, toAddKnowledgeResponse } from "./add-knowledge.mapper"
import { AddKnowledgeRequest } from "./dto/add-knowledge.request"
import { AddKnowledgeResponse } from "./dto/add-knowledge.response"

@Controller("api/v1/knowledge")
/**
 * HTTP door of adding knowledge: the public API, authenticated by an API-key guard; the operation checks scope and rate
 * budget.
 */
export class AddKnowledgeController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds a text source: 202 once it is queued for indexing. */
    @Post()
    @HttpCode(HttpStatus.ACCEPTED)
    @Credential({ kind: "api-key" })
    @RateLimit(RateTier.Strict)
    async addKnowledge(
        @Headers("authorization") authorization: string | undefined,
        @Body() input: AddKnowledgeRequest,
    ): Promise<AddKnowledgeResponse> {
        const result = await this.commandBus.execute(
            new AddKnowledgeCommand({ request: toAddKnowledgeRequest(authorization, input) }),
        )
        return toAddKnowledgeResponse(result)
    }
}
