import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import { CreateLeadCommand } from "../../application/create-lead.command"
import { CreateLeadInput } from "./dto/create-lead.input"
import { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toCreateLeadRequest, toCreateLeadType } from "./create-lead.mapper"

@Resolver()
/** GraphQL door for the queued create lead operation. */
export class CreateLeadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Creates a lead through the existing queued lead flow. */
    @Mutation(() => LeadActionQueuedType, { name: "createLead" })
    async createLead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateLeadInput,
        @AcceptedLocale() acceptLanguage: string,
    ): Promise<LeadActionQueuedType> {
        const result = await this.commandBus.execute(
            new CreateLeadCommand({ request: toCreateLeadRequest(workspaceId, input, acceptLanguage), principal }),
        )
        return toCreateLeadType(result)
    }
}
