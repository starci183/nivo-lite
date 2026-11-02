import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PublicDocumentsQuery } from "../../application/public-documents.query"
import { PublicDocumentType } from "./dto/public-document.type"
import { toPublicDocumentsRequest, toPublicDocumentsType } from "./public-documents.mapper"

@Resolver()
/** GraphQL door of publicDocuments. */
export class PublicDocumentsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the public documents of the workspace that are not archived, with their sources and what was left out. */
    @Query(() => [PublicDocumentType], { name: "publicDocuments" })
    async publicDocuments(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<PublicDocumentType>> {
        const result = await this.queryBus.execute(
            new PublicDocumentsQuery({ request: toPublicDocumentsRequest(workspaceId), principal }),
        )
        return toPublicDocumentsType(result)
    }
}
