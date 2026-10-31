import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ReopenDossierFindingCommand } from "../../application/reopen-dossier-finding.command"
import { DossierFindingRefInput } from "./dto/dossier-finding-ref.input"
import { DossierFindingType } from "./dto/dossier-finding.type"
import { toReopenDossierFindingRequest, toReopenDossierFindingType } from "./reopen-dossier-finding.mapper"

@Resolver()
/** GraphQL door of reopenDossierFinding. */
export class ReopenDossierFindingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** reopenDossierFinding: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierFindingType, { name: "reopenDossierFinding" })
    async reopenDossierFinding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: DossierFindingRefInput,
    ): Promise<DossierFindingType> {
        const result = await this.commandBus.execute(
            new ReopenDossierFindingCommand({
                request: toReopenDossierFindingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toReopenDossierFindingType(result)
    }
}
