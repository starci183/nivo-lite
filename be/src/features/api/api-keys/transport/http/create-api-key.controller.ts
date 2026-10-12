import { Body, Controller, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateApiKeyCommand } from "../../application/create-api-key.command"
import { toCreateApiKeyRequest, toCreateApiKeyResponse } from "./create-api-key.mapper"
import { CreateApiKeyRequest } from "./dto/create-api-key.request"
import { CreateApiKeyResponse } from "./dto/create-api-key.response"
import { ListApiKeysRequest } from "./dto/list-api-keys.request"

@Controller("workspaces/:workspaceId/api-keys")
/** HTTP door of creating an API key. */
export class CreateApiKeyController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a key for the workspace; the secret is in this response only. */
    @Post()
    async createApiKey(
        @CurrentPrincipal() principal: Principal,
        @Param() path: ListApiKeysRequest,
        @Body() input: CreateApiKeyRequest,
    ): Promise<CreateApiKeyResponse> {
        const result = await this.commandBus.execute(
            new CreateApiKeyCommand({ request: toCreateApiKeyRequest(path, input), principal }),
        )
        return toCreateApiKeyResponse(result)
    }
}
