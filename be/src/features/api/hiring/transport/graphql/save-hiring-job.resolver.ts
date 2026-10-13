import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveHiringJobCommand } from "../../application/save-hiring-job.command"
import { SaveJobType } from "./dto/save-job.type"
import { SaveHiringJobInput } from "./dto/save-hiring-job.input"
import { toSaveHiringJobRequest, toSaveJobType } from "./hiring-jobs.mapper"

@Resolver()
/** GraphQL door: create or update one job post. */
export class SaveHiringJobResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one job post. */
    @Mutation(() => SaveJobType, { name: "saveHiringJob" })
    async saveHiringJob(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveHiringJobInput,
    ): Promise<SaveJobType> {
        const result = await this.commandBus.execute(
            new SaveHiringJobCommand({ request: toSaveHiringJobRequest(workspaceId, input), principal }),
        )
        return toSaveJobType(result)
    }
}
