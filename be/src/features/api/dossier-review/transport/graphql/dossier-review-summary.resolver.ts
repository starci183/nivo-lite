import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DossierReviewSummaryQuery } from "../../application/dossier-review-summary.query"
import { DossierReviewSummaryType } from "./dto/dossier-review-summary.type"
import { toDossierReviewSummaryRequest, toDossierReviewSummaryType } from "./dossier-review-summary.mapper"

@Resolver()
/** GraphQL door of dossierReviewSummary. */
export class DossierReviewSummaryResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** dossierReviewSummary: any member reads, every change needs an owner or manager. */
    @Query(() => DossierReviewSummaryType, { name: "dossierReviewSummary" })
    async dossierReviewSummary(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DossierReviewSummaryType> {
        const result = await this.queryBus.execute(
            new DossierReviewSummaryQuery({ request: toDossierReviewSummaryRequest(workspaceId), principal }),
        )
        return toDossierReviewSummaryType(result)
    }
}
