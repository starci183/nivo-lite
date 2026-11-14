import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetKnowledgeSourceNatureCommand } from "../../application/set-knowledge-source-nature.command"
import { KnowledgeSourceNatureAnswerType } from "./dto/knowledge-source-nature-answer.type"
import { SetKnowledgeSourceNatureInput } from "./dto/set-knowledge-source-nature.input"
import { toKnowledgeSourceNatureAnswerType, toSetKnowledgeSourceNatureRequest } from "./set-knowledge-source-nature.mapper"

@Resolver()
/** GraphQL door of the founder's answer on what a document is. */
export class SetKnowledgeSourceNatureResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** The founder says what a document is (rules, records, log, reference) over the model's reading, or takes his answer back. */
    @Mutation(() => KnowledgeSourceNatureAnswerType, { name: "setKnowledgeSourceNature" })
    async setKnowledgeSourceNature(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetKnowledgeSourceNatureInput,
    ): Promise<KnowledgeSourceNatureAnswerType> {
        const result = await this.commandBus.execute(
            new SetKnowledgeSourceNatureCommand({ request: toSetKnowledgeSourceNatureRequest(workspaceId, input), principal }),
        )
        return toKnowledgeSourceNatureAnswerType(result)
    }
}
