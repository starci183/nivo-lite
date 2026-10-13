import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { StartMoneyConnectionCommand } from "../../application/start-money-connection.command"
import { StartMoneyConnectionInput } from "./dto/start-money-connection.input"
import { WizardConnectionType } from "./dto/wizard-connection.type"
import { toStartMoneyConnectionRequest, toStartMoneyConnectionType } from "./start-money-connection.mapper"

@Resolver()
/** GraphQL door of startMoneyConnection. */
export class StartMoneyConnectionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Starts a bank or payment feed as pending. */
    @Mutation(() => WizardConnectionType, { name: "startMoneyConnection" })
    async startMoneyConnection(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: StartMoneyConnectionInput,
    ): Promise<WizardConnectionType> {
        const result = await this.commandBus.execute(
            new StartMoneyConnectionCommand({ request: toStartMoneyConnectionRequest(workspaceId, input), principal }),
        )
        return toStartMoneyConnectionType(result)
    }
}
