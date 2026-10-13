import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { AddResponsibilityCommand } from "../../application/add-responsibility.command"
import { toAddResponsibilityRequest, toAddResponsibilityType } from "./add-responsibility.mapper"
import { AddResponsibilityInput } from "./dto/add-responsibility.input"
import { LeadResponsibilityType } from "./dto/lead-responsibility.type"

@Resolver()
/** GraphQL door for adding the next responsibility of a lead. */
export class AddResponsibilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds a responsibility for an active member of the workspace. */
    @Mutation(() => LeadResponsibilityType, { name: "addResponsibility" })
    async addResponsibility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AddResponsibilityInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadResponsibilityType> {
        const result = await this.commandBus.execute(
            new AddResponsibilityCommand({
                request: toAddResponsibilityRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toAddResponsibilityType(result)
    }
}
