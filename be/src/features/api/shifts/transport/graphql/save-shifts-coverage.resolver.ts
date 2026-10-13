import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveShiftsCoverageCommand } from "../../application/save-shifts-coverage.command"
import { SaveShiftsCoverageInput } from "./dto/save-shifts-coverage.input"
import { toSaveShiftsCoverageRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: create or update one coverage block. */
export class SaveShiftsCoverageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one coverage block. */
    @Mutation(() => Boolean, { name: "saveShiftsCoverage" })
    async saveShiftsCoverage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsCoverageInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SaveShiftsCoverageCommand({ request: toSaveShiftsCoverageRequest(workspaceId, input), principal }),
        )
        return true
    }
}
