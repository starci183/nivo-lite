import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteHiringCandidateCommand } from "../../application/delete-hiring-candidate.command"
import { DeleteCandidateType } from "./dto/delete-candidate.type"
import { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import { toDeleteHiringCandidateRequest, toDeleteCandidateType } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: delete a candidate with every trace. */
export class DeleteHiringCandidateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delete a candidate with every trace. */
    @Mutation(() => DeleteCandidateType, { name: "deleteHiringCandidate" })
    async deleteHiringCandidate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringCandidateRefInput,
    ): Promise<DeleteCandidateType> {
        const result = await this.commandBus.execute(
            new DeleteHiringCandidateCommand({
                request: toDeleteHiringCandidateRequest(workspaceId, input),
                principal,
            }),
        )
        return toDeleteCandidateType(result)
    }
}
