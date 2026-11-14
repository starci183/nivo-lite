import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SaveCrmConnectionCommand } from "../../application/save-crm-connection.command"
import { CrmConnectionType } from "./dto/crm-connection.type"
import { SaveCrmConnectionInput } from "./dto/save-crm-connection.input"
import { toCrmConnectionType, toSaveCrmConnectionRequest } from "./save-crm-connection.mapper"

@Resolver()
/** GraphQL door of saveCrmConnection. */
export class SaveCrmConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Connects or updates a CRM provider via OpenAPI: fetches and pins the live document; never returns a secret. */
    @Mutation(() => CrmConnectionType, { name: "saveCrmConnection" })
    async saveCrmConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveCrmConnectionInput,
    ): Promise<CrmConnectionType> {
        const result = await this.commandBus.execute(
            new SaveCrmConnectionCommand({ request: toSaveCrmConnectionRequest(workspaceId, input), principal }),
        )
        return toCrmConnectionType(result)
    }
}
