import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideSetupCardCommand } from "../../application/decide-setup-card.command"
import { SetupCardType } from "./dto/setup-card.type"
import { DecideSetupCardInput } from "./dto/decide-setup-card.input"
import { toDecideSetupCardRequest, toSetupCardType } from "./modules.mapper"

@Resolver()
/** GraphQL door that decides a confirm card. */
export class DecideSetupCardResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Confirms (optionally edited) or rejects one confirm card; confirming writes the fact to the Second Brain or the rule to the Authority. */
    @Mutation(() => SetupCardType, { name: "decideSetupCard" })
    async decideSetupCard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DecideSetupCardInput,
    ): Promise<SetupCardType> {
        const result = await this.commandBus.execute(
            new DecideSetupCardCommand({ request: toDecideSetupCardRequest(workspaceId, input, locale), principal }),
        )
        return toSetupCardType(result)
    }
}
