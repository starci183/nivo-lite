import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestDossierReviewCommand } from "../../application/request-dossier-review.command"
import { RequestDossierReviewInput } from "./dto/request-dossier-review.input"
import { DossierReviewRunType } from "./dto/dossier-review-run.type"
import { toRequestDossierReviewRequest, toRequestDossierReviewType } from "./request-dossier-review.mapper"

@Resolver()
/** GraphQL door of requestDossierReview. */
export class RequestDossierReviewResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** requestDossierReview: any member reads, every change needs an owner or manager. */
    @Mutation(() => DossierReviewRunType, { name: "requestDossierReview" })
    async requestDossierReview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestDossierReviewInput,
    ): Promise<DossierReviewRunType> {
        const result = await this.commandBus.execute(
            new RequestDossierReviewCommand({ request: toRequestDossierReviewRequest(workspaceId, input), principal }),
        )
        return toRequestDossierReviewType(result)
    }
}
