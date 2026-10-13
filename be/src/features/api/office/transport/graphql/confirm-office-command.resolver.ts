import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ConfirmCommandCommand } from "../../application/confirm-command.command"
import { OfficeConfirmResultType } from "./dto/office-confirm-result.type"
import { OfficeCandidateIdInput } from "./dto/office-candidate-id.input"
import { toConfirmCommandRequest, toOfficeConfirmResultType } from "./office.mapper"

@Resolver()
/** GraphQL door that sends the command of a card. */
export class ConfirmOfficeCommandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends the command of a card to the receiving agent. */
    @Mutation(() => OfficeConfirmResultType, { name: "confirmOfficeCommand" })
    async confirmOfficeCommand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: OfficeCandidateIdInput,
    ): Promise<OfficeConfirmResultType> {
        const result = await this.commandBus.execute(
            new ConfirmCommandCommand({ request: toConfirmCommandRequest(workspaceId, input, locale), principal }),
        )
        return toOfficeConfirmResultType(result)
    }
}
