import { Controller, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeApiKeyCommand } from "../../application/revoke-api-key.command"
import { ApiKeyResponse } from "./dto/api-key.response"
import { RevokeApiKeyRequest } from "./dto/revoke-api-key.request"
import { toRevokeApiKeyRequest, toRevokeApiKeyResponse } from "./revoke-api-key.mapper"

@Controller("workspaces/:workspaceId/api-keys/:keyId")
/** HTTP door of revoking an API key. */
export class RevokeApiKeyController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Revokes the key: it stops working at once. */
    @Post("revoke")
    async revokeApiKey(
        @CurrentPrincipal() principal: Principal,
        @Param() input: RevokeApiKeyRequest,
    ): Promise<ApiKeyResponse> {
        const result = await this.commandBus.execute(
            new RevokeApiKeyCommand({ request: toRevokeApiKeyRequest(input), principal }),
        )
        return toRevokeApiKeyResponse(result)
    }
}
