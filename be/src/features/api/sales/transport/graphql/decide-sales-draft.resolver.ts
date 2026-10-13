import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideSalesDraftCommand } from "../../application/decide-sales-draft.command"
import { toDecideSalesDraftRequest, toDecideSalesDraftType } from "./decide-sales-draft.mapper"
import { DecideSalesDraftInput } from "./dto/decide-sales-draft.input"
import { SalesActionType } from "./dto/sales-action.type"

@Resolver()
/** The GraphQL door of decideSalesDraft. */
export class DecideSalesDraftResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues a person's decision on a Sales draft. */
    @Mutation(() => SalesActionType, { name: "decideSalesDraft" })
    async decideSalesDraft(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideSalesDraftInput,
    ): Promise<SalesActionType> {
        const result = await this.commandBus.execute(
            new DecideSalesDraftCommand({ request: toDecideSalesDraftRequest(workspaceId, locale, input), principal }),
        )
        return toDecideSalesDraftType(result)
    }
}
