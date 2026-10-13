import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetWorkspaceStatusCommand } from "../../application/set-workspace-status.command"
import { AdminSetWorkspaceStatusInput } from "./dto/admin-set-workspace-status.input"
import { AdminStatusSetType } from "./dto/admin-status-set.type"
import { toAdminSetWorkspaceStatusRequest, toAdminStatusSetType } from "./admin-set-workspace-status.mapper"

@Resolver()
/** GraphQL door of adminSetWorkspaceStatus. */
export class AdminSetWorkspaceStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Marks a workspace active or past due. */
    @Mutation(() => AdminStatusSetType, { name: "adminSetWorkspaceStatus" })
    async adminSetWorkspaceStatus(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminSetWorkspaceStatusInput,
    ): Promise<AdminStatusSetType> {
        const result = await this.commandBus.execute(
            new SetWorkspaceStatusCommand({ request: toAdminSetWorkspaceStatusRequest(input), principal }),
        )
        return toAdminStatusSetType(result)
    }
}
