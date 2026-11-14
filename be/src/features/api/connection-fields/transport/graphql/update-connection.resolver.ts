import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { UpdateConnectionCommand } from "../../application/update-connection.command"
import { ConnectionFieldsType } from "./dto/get-connection-fields.type"
import { UpdateConnectionInput } from "./dto/update-connection.input"
import { toConnectionFieldsType } from "./get-connection-fields.mapper"
import { toUpdateConnectionRequest } from "./update-connection.mapper"

@Resolver()
/** GraphQL door of updateConnection. */
export class UpdateConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Renames an account and changes its declared fields through the writer of its provider; answers the form again. */
    @Mutation(() => ConnectionFieldsType, { name: "updateConnection" })
    async updateConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateConnectionInput,
    ): Promise<ConnectionFieldsType> {
        const result = await this.commandBus.execute(
            new UpdateConnectionCommand({ request: toUpdateConnectionRequest(workspaceId, input), principal }),
        )
        return toConnectionFieldsType(result)
    }
}
