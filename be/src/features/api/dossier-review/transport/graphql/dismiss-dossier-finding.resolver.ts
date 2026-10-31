import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DismissDossierFindingCommand } from "../../application/dismiss-dossier-finding.command"
import { DismissDossierFindingInput } from "./dto/dismiss-dossier-finding.input"
import { DossierFindingType } from "./dto/dossier-finding.type"
import { toDismissDossierFindingRequest, toDismissDossierFindingType } from "./dismiss-dossier-finding.mapper"

@Resolver()
/** GraphQL door of dismissDossierFinding. */
export class DismissDossierFindingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** dismissDossierFinding: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierFindingType, { name: "dismissDossierFinding" })
    async dismissDossierFinding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DismissDossierFindingInput,
    ): Promise<DossierFindingType> {
        const result = await this.commandBus.execute(
            new DismissDossierFindingCommand({
                request: toDismissDossierFindingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toDismissDossierFindingType(result)
    }
}
