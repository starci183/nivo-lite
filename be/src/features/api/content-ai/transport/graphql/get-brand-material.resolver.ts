import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetBrandMaterialQuery } from "../../application/get-brand-material.query"
import { ContentBrandMaterialType } from "./dto/content-brand-material.type"
import { toBrandMaterialType } from "./get-brand-material.mapper"

@Resolver()
/** GraphQL door for public content brand material. */
export class GetBrandMaterialResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Returns the public business knowledge used to ground marketing posts. */
    @Query(() => ContentBrandMaterialType, { name: "contentBrandMaterial" })
    async contentBrandMaterial(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ContentBrandMaterialType> {
        const result = await this.queryBus.execute(new GetBrandMaterialQuery({ request: { workspaceId }, principal }))
        return toBrandMaterialType(result)
    }
}
