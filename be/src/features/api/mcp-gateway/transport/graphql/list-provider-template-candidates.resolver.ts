import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListProviderTemplateCandidatesQuery } from "../../application/list-provider-template-candidates.query"
import { ProviderTemplateCandidatesInput } from "./dto/provider-template-candidates.input"
import { ProviderTemplateCandidateType } from "./dto/provider-rights.type"
import { toProviderTemplateCandidateTypes } from "./provider-rights.mapper"

@Resolver()
/** GraphQL door of providerTemplateCandidates. */
export class ListProviderTemplateCandidatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The agents a template would attach to a provider connected after they were created. */
    @Query(() => [ProviderTemplateCandidateType], { name: "providerTemplateCandidates" })
    async providerTemplateCandidates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ProviderTemplateCandidatesInput,
    ): Promise<Array<ProviderTemplateCandidateType>> {
        const result = await this.queryBus.execute(
            new ListProviderTemplateCandidatesQuery({ request: { workspaceId, provider: input.provider }, principal }),
        )
        return toProviderTemplateCandidateTypes(result)
    }
}
