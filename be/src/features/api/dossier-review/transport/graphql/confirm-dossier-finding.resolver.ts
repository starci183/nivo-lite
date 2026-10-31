import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ConfirmDossierFindingCommand } from "../../application/confirm-dossier-finding.command"
import { DossierFindingNoteInput } from "./dto/dossier-finding-note.input"
import { DossierFindingType } from "./dto/dossier-finding.type"
import { toConfirmDossierFindingRequest, toConfirmDossierFindingType } from "./confirm-dossier-finding.mapper"

@Resolver()
/** GraphQL door of confirmDossierFinding. */
export class ConfirmDossierFindingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** confirmDossierFinding: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierFindingType, { name: "confirmDossierFinding" })
    async confirmDossierFinding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DossierFindingNoteInput,
    ): Promise<DossierFindingType> {
        const result = await this.commandBus.execute(
            new ConfirmDossierFindingCommand({
                request: toConfirmDossierFindingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toConfirmDossierFindingType(result)
    }
}
