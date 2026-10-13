import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { HandoffToAccountingCommand } from "../../application/handoff-to-accounting.command"
import { toHandoffToAccountingRequest, toHandoffToAccountingType } from "./handoff-to-accounting.mapper"
import { HandoffToAccountingInput } from "./dto/handoff-to-accounting.input"
import { SalesActionType } from "./dto/sales-action.type"

@Resolver()
/** The GraphQL door of handoffToAccounting. */
export class HandoffToAccountingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a Sales handoff to Accounting. */
    @Mutation(() => SalesActionType, { name: "handoffToAccounting" })
    async handoffToAccounting(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: HandoffToAccountingInput,
    ): Promise<SalesActionType> {
        const result = await this.commandBus.execute(
            new HandoffToAccountingCommand({
                request: toHandoffToAccountingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toHandoffToAccountingType(result)
    }
}
