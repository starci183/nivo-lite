import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetHiringJobStatusCommand } from "../../application/set-hiring-job-status.command"
import { HiringStatusType } from "./dto/hiring-status.type"
import { SetHiringJobStatusInput } from "./dto/set-hiring-job-status.input"
import { toSetHiringJobStatusRequest, toHiringStatusType } from "./hiring-jobs.mapper"

@Resolver()
/** GraphQL door: open, pause or close a job. */
export class SetHiringJobStatusResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Open, pause or close a job. */
    @Mutation(() => HiringStatusType, { name: "setHiringJobStatus" })
    async setHiringJobStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetHiringJobStatusInput,
    ): Promise<HiringStatusType> {
        const result = await this.commandBus.execute(
            new SetHiringJobStatusCommand({ request: toSetHiringJobStatusRequest(workspaceId, input), principal }),
        )
        return toHiringStatusType(result)
    }
}
