import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestContentQuickDraftCommand } from "../../application/request-content-quick-draft.command"
import { toRequestContentQuickDraftRequest, toRequestContentQuickDraftType } from "./request-content-quick-draft.mapper"
import { RequestContentQuickDraftInput } from "./dto/request-content-quick-draft.input"
import { ContentAiRequestedType } from "./dto/content-ai-requested.type"

@Resolver()
/** GraphQL door to queued content work. */
export class RequestContentQuickDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Returns immediately after the job is queued. */
    @Mutation(() => ContentAiRequestedType, { name: "requestContentQuickDraft" })
    async requestContentQuickDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestContentQuickDraftInput,
    ): Promise<ContentAiRequestedType> {
        const result = await this.commandBus.execute(
            new RequestContentQuickDraftCommand({
                request: toRequestContentQuickDraftRequest(workspaceId, input),
                principal,
            }),
        )
        return toRequestContentQuickDraftType(result)
    }
}
