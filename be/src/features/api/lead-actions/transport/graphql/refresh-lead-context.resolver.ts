import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { RefreshLeadContextCommand } from "../../application/refresh-lead-context.command"
import { RefreshLeadContextInput } from "./dto/refresh-lead-context.input"
import { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toRefreshLeadContextRequest, toRefreshLeadContextType } from "./refresh-lead-context.mapper"

@Resolver()
/** GraphQL door for the queued refresh-context lead operation. */
export class RefreshLeadContextResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the refresh of the lead's sales context. */
    @Mutation(() => LeadActionQueuedType, { name: "refreshLeadContext" })
    async refreshLeadContext(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RefreshLeadContextInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadActionQueuedType> {
        const result = await this.commandBus.execute(
            new RefreshLeadContextCommand({
                request: toRefreshLeadContextRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toRefreshLeadContextType(result)
    }
}
