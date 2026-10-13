import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MoveHiringCandidateCommand } from "../../application/move-hiring-candidate.command"
import { MoveCandidateType } from "./dto/move-candidate.type"
import { MoveHiringCandidateInput } from "./dto/move-hiring-candidate.input"
import { toMoveHiringCandidateRequest, toMoveCandidateType } from "./hiring-candidates.mapper"

@Resolver()
/** GraphQL door: move a candidate to another stage. */
export class MoveHiringCandidateResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Move a candidate to another stage. */
    @Mutation(() => MoveCandidateType, { name: "moveHiringCandidate" })
    async moveHiringCandidate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MoveHiringCandidateInput,
    ): Promise<MoveCandidateType> {
        const result = await this.commandBus.execute(
            new MoveHiringCandidateCommand({ request: toMoveHiringCandidateRequest(workspaceId, input), principal }),
        )
        return toMoveCandidateType(result)
    }
}
