import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideBrainLessonCommand } from "../../application/decide-brain-lesson.command"
import { DecideBrainLessonInput } from "./dto/decide-brain-lesson.input"
import { BrainLessonType } from "./dto/brain-lesson.type"
import { toDecideBrainLessonRequest, toDecideBrainLessonType } from "./decide-brain-lesson.mapper"

@Resolver()
/** GraphQL door of approves or turns down a proposed lesson, or retires one in force. */
export class DecideBrainLessonResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves or turns down a proposed lesson, or retires one in force. */
    @Mutation(() => BrainLessonType, { name: "decideBrainLesson" })
    async decideBrainLesson(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideBrainLessonInput,
    ): Promise<BrainLessonType> {
        const result = await this.commandBus.execute(new DecideBrainLessonCommand({ request: toDecideBrainLessonRequest(workspaceId, input), principal }))
        return toDecideBrainLessonType(result)
    }
}
