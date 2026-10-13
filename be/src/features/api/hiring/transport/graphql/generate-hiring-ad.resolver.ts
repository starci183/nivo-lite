import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GenerateHiringAdCommand } from "../../application/generate-hiring-ad.command"
import { GenerateAdType } from "./dto/generate-ad.type"
import { HiringJobRefInput } from "./dto/hiring-job-ref.input"
import { toGenerateHiringAdRequest, toGenerateAdType } from "./hiring-jobs.mapper"

@Resolver()
/** GraphQL door: draft the copy-ready ads of a job. */
export class GenerateHiringAdResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Draft the copy-ready ads of a job. */
    @Mutation(() => GenerateAdType, { name: "generateHiringAd" })
    async generateHiringAd(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringJobRefInput,
    ): Promise<GenerateAdType> {
        const result = await this.commandBus.execute(
            new GenerateHiringAdCommand({ request: toGenerateHiringAdRequest(workspaceId, input), principal }),
        )
        return toGenerateAdType(result)
    }
}
