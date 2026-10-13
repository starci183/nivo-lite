import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideSalesWorkItemCommand } from "../../application/decide-sales-work-item.command"
import { toDecideSalesWorkItemRequest, toDecideSalesWorkItemType } from "./decide-sales-work-item.mapper"
import { DecideSalesWorkItemInput } from "./dto/decide-sales-work-item.input"
import { SalesActionType } from "./dto/sales-action.type"

@Resolver()
/** The GraphQL door of decideSalesWorkItem. */
export class DecideSalesWorkItemResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a person's decision on a Sales proposal. */
    @Mutation(() => SalesActionType, { name: "decideSalesWorkItem" })
    async decideSalesWorkItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideSalesWorkItemInput,
    ): Promise<SalesActionType> {
        const result = await this.commandBus.execute(
            new DecideSalesWorkItemCommand({
                request: toDecideSalesWorkItemRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toDecideSalesWorkItemType(result)
    }
}
