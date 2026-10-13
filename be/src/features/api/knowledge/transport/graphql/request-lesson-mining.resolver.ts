import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestLessonMiningCommand } from "../../application/request-lesson-mining.command"
import { RequestLessonMiningInput } from "./dto/request-lesson-mining.input"
import { BrainCommandRefType } from "./dto/brain-command-ref.type"
import { toRequestLessonMiningRequest, toRequestLessonMiningType } from "./request-lesson-mining.mapper"

@Resolver()
/** GraphQL door of asks the brain to study the corrections of one agent and propose lessons. */
export class RequestLessonMiningResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks the brain to study the corrections of one agent and propose lessons. */
    @Mutation(() => BrainCommandRefType, { name: "requestLessonMining" })
    async requestLessonMining(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestLessonMiningInput,
    ): Promise<BrainCommandRefType> {
        const result = await this.commandBus.execute(new RequestLessonMiningCommand({ request: toRequestLessonMiningRequest(workspaceId, input), principal }))
        return toRequestLessonMiningType(result)
    }
}
