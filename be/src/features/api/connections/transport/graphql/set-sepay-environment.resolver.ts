import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetSepayEnvironmentCommand } from "../../application/set-sepay-environment.command"
import { SetSepayEnvironmentInput } from "./dto/set-sepay-environment.input"
import { SepayConnectionType } from "./dto/sepay-connection.type"
import { toSepayConnectionType } from "./get-sepay-connection.mapper"
import { toSetSepayEnvironmentRequest } from "./set-sepay-environment.mapper"

@Resolver()
/** GraphQL door of setSepayEnvironment. */
export class SetSepayEnvironmentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Switches a SePay connection between test and live. */
    @Mutation(() => SepayConnectionType, { name: "setSepayEnvironment" })
    async setSepayEnvironment(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetSepayEnvironmentInput,
    ): Promise<SepayConnectionType> {
        const result = await this.commandBus.execute(
            new SetSepayEnvironmentCommand({ request: toSetSepayEnvironmentRequest(workspaceId, input), principal }),
        )
        return toSepayConnectionType(result)
    }
}
