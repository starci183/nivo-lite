import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RescreenHiringCandidateCommand } from "../../application/rescreen-hiring-candidate.command"
import { HiringOutcomeType } from "./dto/hiring-outcome.type"
import { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import { toRescreenHiringCandidateRequest, toHiringOutcomeType } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: screen a candidate again. */
export class RescreenHiringCandidateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Screen a candidate again. */
    @Mutation(() => HiringOutcomeType, { name: "rescreenHiringCandidate" })
    async rescreenHiringCandidate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringCandidateRefInput,
    ): Promise<HiringOutcomeType> {
        const result = await this.commandBus.execute(
            new RescreenHiringCandidateCommand({
                request: toRescreenHiringCandidateRequest(workspaceId, input),
                principal,
            }),
        )
        return toHiringOutcomeType(result)
    }
}
