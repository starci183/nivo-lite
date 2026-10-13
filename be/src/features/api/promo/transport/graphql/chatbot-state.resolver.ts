import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PromoChatbotStateQuery } from "../../application/chatbot-state.query"
import { toPromoChatbotStateRequest, toPromoChatbotStateType } from "./chatbot-state.mapper"
import { PromoChatbotStateType } from "./dto/chatbot-state.type"

@Resolver()
/** GraphQL read door for promoChatbotState. */
export class PromoChatbotStateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads promoChatbotState from the caller's selected workspace. */
    @Query(() => PromoChatbotStateType, { name: "promoChatbotState" })
    async promoChatbotState(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<PromoChatbotStateType> {
        const result = await this.queryBus.execute(
            new PromoChatbotStateQuery({ request: toPromoChatbotStateRequest(workspaceId), principal }),
        )
        return toPromoChatbotStateType(result)
    }
}
