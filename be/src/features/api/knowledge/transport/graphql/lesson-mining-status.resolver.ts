import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { LessonMiningStatusQuery } from "../../application/lesson-mining-status.query"
import { LessonMiningStatusInput } from "./dto/lesson-mining-status.input"
import { LessonMiningStatusType } from "./dto/lesson-mining-status.type"
import { toLessonMiningStatusRequest, toLessonMiningStatusType } from "./lesson-mining-status.mapper"

@Resolver()
/** GraphQL door of reads where the study of an agent's corrections stands. */
export class LessonMiningStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads where the study of an agent's corrections stands. */
    @Query(() => LessonMiningStatusType, { name: "lessonMiningStatus" })
    async lessonMiningStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: LessonMiningStatusInput,
    ): Promise<LessonMiningStatusType> {
        const result = await this.queryBus.execute(
            new LessonMiningStatusQuery({ request: toLessonMiningStatusRequest(workspaceId, input), principal }),
        )
        return toLessonMiningStatusType(result)
    }
}
