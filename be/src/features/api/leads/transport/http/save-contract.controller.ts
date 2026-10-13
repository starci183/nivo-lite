import { Body, Controller, Headers, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveContractCommand } from "../../application/save-contract.command"
import { SaveContractRequest } from "./dto/save-contract.request"
import { SaveContractResponse } from "./dto/save-contract.response"
import { toSaveContractRequest, toSaveContractResponse } from "./save-contract.mapper"

@Controller("sales-contracts")
/** HTTP door of save-contract. */
export class SaveContractController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds or edits a recurring sales contract, for any active member of the workspace. */
    @Post()
    async saveContract(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveContractRequest,
        @Headers("accept-language") acceptLanguage: string | undefined,
    ): Promise<SaveContractResponse> {
        const result = await this.commandBus.execute(
            new SaveContractCommand({
                request: toSaveContractRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toSaveContractResponse(result)
    }
}
