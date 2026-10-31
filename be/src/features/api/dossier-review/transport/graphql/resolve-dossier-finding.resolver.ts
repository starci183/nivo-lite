import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ResolveDossierFindingCommand } from "../../application/resolve-dossier-finding.command"
import { ResolveDossierFindingInput } from "./dto/resolve-dossier-finding.input"
import { DossierFindingType } from "./dto/dossier-finding.type"
import { toResolveDossierFindingRequest, toResolveDossierFindingType } from "./resolve-dossier-finding.mapper"

@Resolver()
/** GraphQL door of resolveDossierFinding. */
export class ResolveDossierFindingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** resolveDossierFinding: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierFindingType, { name: "resolveDossierFinding" })
    async resolveDossierFinding(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: ResolveDossierFindingInput,
    ): Promise<DossierFindingType> {
        const result = await this.commandBus.execute(
            new ResolveDossierFindingCommand({
                request: toResolveDossierFindingRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toResolveDossierFindingType(result)
    }
}
