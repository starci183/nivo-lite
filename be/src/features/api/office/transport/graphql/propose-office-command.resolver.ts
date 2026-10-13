import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ProposeCommandCommand } from "../../application/propose-command.command"
import { OfficeProposeOutcomeType } from "./dto/office-propose-outcome.type"
import { ProposeOfficeCommandInput } from "./dto/propose-office-command.input"
import { toOfficeProposeOutcomeType, toProposeCommandRequest } from "./office.mapper"

@Resolver()
/** GraphQL door that proposes a command card for an owner message. */
export class ProposeOfficeCommandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Proposes a command card (or a NIVO reply) for an owner message. */
    @Mutation(() => OfficeProposeOutcomeType, { name: "proposeOfficeCommand" })
    async proposeOfficeCommand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ProposeOfficeCommandInput,
    ): Promise<OfficeProposeOutcomeType> {
        const result = await this.commandBus.execute(
            new ProposeCommandCommand({ request: toProposeCommandRequest(workspaceId, input, locale), principal }),
        )
        return toOfficeProposeOutcomeType(result)
    }
}
