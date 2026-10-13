import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateMoneyConnectionCommand } from "../../application/update-money-connection.command"
import { UpdateMoneyConnectionInput } from "./dto/update-money-connection.input"
import { WizardConnectionType } from "./dto/wizard-connection.type"
import { toUpdateMoneyConnectionRequest, toUpdateMoneyConnectionType } from "./update-money-connection.mapper"

@Resolver()
/** GraphQL door of updateMoneyConnection. */
export class UpdateMoneyConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Edits a bank or payment feed. */
    @Mutation(() => WizardConnectionType, { name: "updateMoneyConnection" })
    async updateMoneyConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateMoneyConnectionInput,
    ): Promise<WizardConnectionType> {
        const result = await this.commandBus.execute(
            new UpdateMoneyConnectionCommand({
                request: toUpdateMoneyConnectionRequest(workspaceId, input),
                principal,
            }),
        )
        return toUpdateMoneyConnectionType(result)
    }
}
