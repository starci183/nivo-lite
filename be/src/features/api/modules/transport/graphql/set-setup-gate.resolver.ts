import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetSetupGateCommand } from "../../application/set-setup-gate.command"
import { SetupSessionType } from "./dto/setup-session.type"
import { SetSetupGateInput } from "./dto/set-setup-gate.input"
import { toSetSetupGateRequest, toSetupSessionType } from "./modules.mapper"

@Resolver()
/** GraphQL door that confirms, reopens or edits a gate. */
export class SetSetupGateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Confirms, reopens or edits one gate of the open draft; editing sets the own wording of the owner and confirms it. */
    @Mutation(() => SetupSessionType, { name: "setSetupGate" })
    async setSetupGate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetSetupGateInput,
    ): Promise<SetupSessionType> {
        const result = await this.commandBus.execute(
            new SetSetupGateCommand({ request: toSetSetupGateRequest(workspaceId, input), principal }),
        )
        return toSetupSessionType(result)
    }
}
