import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DossierFindingsQuery } from "../../application/dossier-findings.query"
import { DossierFindingsInput } from "./dto/dossier-findings.input"
import { DossierFindingConnectionType } from "./dto/dossier-finding-connection.type"
import { toDossierFindingsRequest, toDossierFindingsType } from "./dossier-findings.mapper"

@Resolver()
/** GraphQL door of dossierFindings. */
export class DossierFindingsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** dossierFindings: any member reads, every change needs an owner or manager. */
    @Query(() => DossierFindingConnectionType, { name: "dossierFindings" })
    async dossierFindings(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input", { defaultValue: {} }) input: DossierFindingsInput,
    ): Promise<DossierFindingConnectionType> {
        const result = await this.queryBus.execute(
            new DossierFindingsQuery({ request: toDossierFindingsRequest(workspaceId, locale, input), principal }),
        )
        return toDossierFindingsType(result)
    }
}
