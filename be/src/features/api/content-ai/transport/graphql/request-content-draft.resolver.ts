import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestContentDraftCommand } from "../../application/request-content-draft.command"
import { toRequestContentDraftRequest, toRequestContentDraftType } from "./request-content-draft.mapper"
import { RequestContentDraftInput } from "./dto/request-content-draft.input"
import { ContentAiRequestedType } from "./dto/content-ai-requested.type"

@Resolver()
/** GraphQL door to queued content work. */
export class RequestContentDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Returns immediately after the job is queued. */
    @Mutation(() => ContentAiRequestedType, { name: "requestContentDraft" })
    async requestContentDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestContentDraftInput,
    ): Promise<ContentAiRequestedType> {
        const result = await this.commandBus.execute(
            new RequestContentDraftCommand({ request: toRequestContentDraftRequest(workspaceId, input), principal }),
        )
        return toRequestContentDraftType(result)
    }
}
