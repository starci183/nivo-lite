import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { HiringCandidateDetailQuery } from "../../application/hiring-candidate-detail.query"
import { HiringCandidateDetailType } from "./dto/hiring-candidate-detail.type"
import { HiringCandidateRefInput } from "./dto/hiring-candidate-ref.input"
import { toHiringCandidateDetailRequest, toHiringCandidateDetailType } from "./hiring-workbench.mapper"

@Resolver()
/** GraphQL door: the timeline and CV link of one candidate. */
export class HiringCandidateDetailResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The timeline and CV link of one candidate. */
    @Query(() => HiringCandidateDetailType, { name: "hiringCandidateDetail" })
    async hiringCandidateDetail(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: HiringCandidateRefInput,
    ): Promise<HiringCandidateDetailType> {
        const result = await this.queryBus.execute(
            new HiringCandidateDetailQuery({ request: toHiringCandidateDetailRequest(workspaceId, input), principal }),
        )
        return toHiringCandidateDetailType(result)
    }
}
