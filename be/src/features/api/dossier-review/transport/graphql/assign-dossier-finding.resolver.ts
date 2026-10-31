import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { AssignDossierFindingCommand } from "../../application/assign-dossier-finding.command"
import { AssignDossierFindingInput } from "./dto/assign-dossier-finding.input"
import { DossierFindingType } from "./dto/dossier-finding.type"
import { toAssignDossierFindingRequest, toAssignDossierFindingType } from "./assign-dossier-finding.mapper"

@Resolver()
/** GraphQL door of assignDossierFinding. */
export class AssignDossierFindingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** assignDossierFinding: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierFindingType, { name: "assignDossierFinding" })
    async assignDossierFinding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: AssignDossierFindingInput,
    ): Promise<DossierFindingType> {
        const result = await this.commandBus.execute(
            new AssignDossierFindingCommand({
                request: toAssignDossierFindingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toAssignDossierFindingType(result)
    }
}
