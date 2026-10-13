import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBrainLessonCommand } from "../../application/save-brain-lesson.command"
import { SaveBrainLessonInput } from "./dto/save-brain-lesson.input"
import { BrainLessonType } from "./dto/brain-lesson.type"
import { toSaveBrainLessonRequest, toSaveBrainLessonType } from "./save-brain-lesson.mapper"

@Resolver()
/** GraphQL door of writes a lesson by hand; it is applied at once. */
export class SaveBrainLessonResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Writes a lesson by hand; it is applied at once. */
    @Mutation(() => BrainLessonType, { name: "saveBrainLesson" })
    async saveBrainLesson(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBrainLessonInput,
    ): Promise<BrainLessonType> {
        const result = await this.commandBus.execute(
            new SaveBrainLessonCommand({ request: toSaveBrainLessonRequest(workspaceId, input), principal }),
        )
        return toSaveBrainLessonType(result)
    }
}
