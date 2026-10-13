import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestHiringInterviewCommand } from "../../application/request-hiring-interview.command"
import { HiringOutcomeType } from "./dto/hiring-outcome.type"
import { RequestHiringInterviewInput } from "./dto/request-hiring-interview.input"
import { toRequestHiringInterviewRequest, toHiringOutcomeType } from "./hiring-interviews.mapper"

@Resolver()
/** GraphQL door: arrange an interview for a candidate. */
export class RequestHiringInterviewResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Arrange an interview for a candidate. */
    @Mutation(() => HiringOutcomeType, { name: "requestHiringInterview" })
    async requestHiringInterview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestHiringInterviewInput,
    ): Promise<HiringOutcomeType> {
        const result = await this.commandBus.execute(
            new RequestHiringInterviewCommand({
                request: toRequestHiringInterviewRequest(workspaceId, input),
                principal,
            }),
        )
        return toHiringOutcomeType(result)
    }
}
