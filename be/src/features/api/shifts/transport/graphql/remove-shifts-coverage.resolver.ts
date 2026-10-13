import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveShiftsCoverageCommand } from "../../application/remove-shifts-coverage.command"
import { ShiftsCoverageRefInput } from "./dto/shifts-coverage-ref.input"
import { toRemoveShiftsCoverageRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: remove a coverage block. */
export class RemoveShiftsCoverageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Remove a coverage block. */
    @Mutation(() => Boolean, { name: "removeShiftsCoverage" })
    async removeShiftsCoverage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsCoverageRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RemoveShiftsCoverageCommand({ request: toRemoveShiftsCoverageRequest(workspaceId, input), principal }),
        )
        return true
    }
}
