import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MaintainBrainCommand } from "../../application/maintain-brain.command"
import { toMaintainBrainRequest } from "./maintain-brain.mapper"

@Resolver()
/** GraphQL door of keeps the brain current: scheduled values take over and ended values expire. */
export class MaintainBrainResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Keeps the brain current: scheduled values take over and ended values expire. */
    @Mutation(() => Boolean, { name: "maintainBrain" })
    async maintainBrain(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new MaintainBrainCommand({ request: toMaintainBrainRequest(workspaceId), principal }),
        )
        return true
    }
}
