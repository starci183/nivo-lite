import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { AssignBrainDossierCommand } from "../../application/assign-brain-dossier.command"
import { toAssignBrainDossierRequest, toAssignBrainDossierType } from "./assign-brain-dossier.mapper"
import { AssignBrainDossierInput } from "./dto/assign-brain-dossier.input"
import { BrainDossierOwnerType } from "./dto/brain-dossier-owner.type"

@Resolver()
/** GraphQL door of assignBrainDossier. */
export class AssignBrainDossierResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** assignBrainDossier: gives a dossier to a member with a due date, or takes both back; owners and managers only. */
    @Mutation(() => BrainDossierOwnerType, { name: "assignBrainDossier" })
    async assignBrainDossier(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AssignBrainDossierInput,
    ): Promise<BrainDossierOwnerType> {
        const result = await this.commandBus.execute(
            new AssignBrainDossierCommand({ request: toAssignBrainDossierRequest(workspaceId, input), principal }),
        )
        return toAssignBrainDossierType(result)
    }
}
