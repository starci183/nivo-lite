import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { AnswerBrainCritiqueCommand } from "../../application/answer-brain-critique.command"
import { ReleaseBrainCritiqueCommand } from "../../application/release-brain-critique.command"
import { RetryBrainCritiqueCommand } from "../../application/retry-brain-critique.command"
import { SkipBrainCritiqueCommand } from "../../application/skip-brain-critique.command"
import { AnswerBrainCritiqueInput, BrainCritiqueSourceInput, SkipBrainCritiqueInput } from "./dto/brain-critique.input"
import { BrainCritiquePointType, BrainCritiqueReviewType, BrainCritiqueServingType } from "./dto/brain-critique.type"

@Resolver()
/** GraphQL doors of the founder's decisions on the document critique; none of them puts a truth in force. */
export class BrainCritiqueDecisionsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Answers a point (founder only): the value becomes a waiting proposal, competing proposals are turned down. */
    @Mutation(() => BrainCritiquePointType, { name: "answerBrainCritique" })
    answerBrainCritique(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AnswerBrainCritiqueInput,
    ): Promise<BrainCritiquePointType> {
        return this.commandBus.execute(
            new AnswerBrainCritiqueCommand({
                request: {
                    workspaceId,
                    findingId: input.findingId,
                    choiceId: input.choiceId,
                    value: input.value,
                    answer: input.answer,
                    note: input.note,
                },
                principal,
            }),
        )
    }

    /** Skips a point (founder and managers). */
    @Mutation(() => BrainCritiquePointType, { name: "skipBrainCritique" })
    skipBrainCritique(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SkipBrainCritiqueInput,
    ): Promise<BrainCritiquePointType> {
        return this.commandBus.execute(
            new SkipBrainCritiqueCommand({ request: { workspaceId, findingId: input.findingId, reason: input.reason }, principal }),
        )
    }

    /** Asks for the critique of a document again (founder and managers; it may call the model). */
    @Mutation(() => BrainCritiqueReviewType, { name: "retryBrainCritique" })
    retryBrainCritique(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BrainCritiqueSourceInput,
    ): Promise<BrainCritiqueReviewType> {
        return this.commandBus.execute(
            new RetryBrainCritiqueCommand({ request: { workspaceId, sourceId: input.sourceId }, principal }),
        )
    }

    /** Lets customers read a document whose critique could not finish (founder only; this version only). */
    @Mutation(() => BrainCritiqueServingType, { name: "releaseBrainCritique" })
    releaseBrainCritique(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BrainCritiqueSourceInput,
    ): Promise<BrainCritiqueServingType> {
        return this.commandBus.execute(
            new ReleaseBrainCritiqueCommand({ request: { workspaceId, sourceId: input.sourceId }, principal }),
        )
    }
}
