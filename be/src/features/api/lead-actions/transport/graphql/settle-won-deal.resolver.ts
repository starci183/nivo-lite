import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { SettleWonDealCommand } from "../../application/settle-won-deal.command"
import { SettleWonDealInput } from "./dto/settle-won-deal.input"
import { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toSettleWonDealRequest, toSettleWonDealType } from "./settle-won-deal.mapper"

@Resolver()
/** GraphQL door for the queued settle-won lead operation. */
export class SettleWonDealResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the accounting handoff of a won deal. */
    @Mutation(() => LeadActionQueuedType, { name: "settleWonDeal" })
    async settleWonDeal(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SettleWonDealInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadActionQueuedType> {
        const result = await this.commandBus.execute(
            new SettleWonDealCommand({
                request: toSettleWonDealRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toSettleWonDealType(result)
    }
}
