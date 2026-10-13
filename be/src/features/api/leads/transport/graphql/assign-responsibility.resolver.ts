import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { AssignResponsibilityCommand } from "../../application/assign-responsibility.command"
import { toAssignResponsibilityRequest, toAssignResponsibilityType } from "./assign-responsibility.mapper"
import { AssignResponsibilityInput } from "./dto/assign-responsibility.input"
import { LeadResponsibilityType } from "./dto/lead-responsibility.type"

@Resolver()
/** GraphQL door for reassigning a lead responsibility. */
export class AssignResponsibilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes a responsibility for an active member of the workspace. */
    @Mutation(() => LeadResponsibilityType, { name: "assignResponsibility" })
    async assignResponsibility(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AssignResponsibilityInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadResponsibilityType> {
        const result = await this.commandBus.execute(
            new AssignResponsibilityCommand({
                request: toAssignResponsibilityRequest(workspaceId, input, acceptLanguage),
                principal,
            }),
        )
        return toAssignResponsibilityType(result)
    }
}
