import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { SuggestLeadOwnerCommand } from "../../application/suggest-lead-owner.command"
import { SuggestLeadOwnerInput } from "./dto/suggest-lead-owner.input"
import { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toSuggestLeadOwnerRequest, toSuggestLeadOwnerType } from "./suggest-lead-owner.mapper"

@Resolver()
/** GraphQL door for the queued suggest-owner lead operation. */
export class SuggestLeadOwnerResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a suggested owner for the lead. */
    @Mutation(() => LeadActionQueuedType, { name: "suggestLeadOwner" })
    async suggestLeadOwner(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SuggestLeadOwnerInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadActionQueuedType> {
        const result = await this.commandBus.execute(
            new SuggestLeadOwnerCommand({
                request: toSuggestLeadOwnerRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toSuggestLeadOwnerType(result)
    }
}
