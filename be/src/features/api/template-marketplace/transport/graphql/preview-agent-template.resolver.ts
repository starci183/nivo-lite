import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PreviewAgentTemplateQuery } from "../../application/preview-agent-template.query"
import { PackagePreviewType } from "./dto/package-preview.type"
import { PackageAgentTemplateInput } from "./dto/package-agent-template.input"
import { toPreviewAgentTemplateRequest, toPreviewAgentTemplateType } from "./preview-agent-template.mapper"

@Resolver()
/** GraphQL door of agentTemplatePreview. */
export class PreviewAgentTemplateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Shows what packaging a version of an agent would keep and leave out, writing nothing. */
    @Query(() => PackagePreviewType, { name: "agentTemplatePreview" })
    async agentTemplatePreview(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PackageAgentTemplateInput,
    ): Promise<PackagePreviewType> {
        const result = await this.queryBus.execute(
            new PreviewAgentTemplateQuery({ request: toPreviewAgentTemplateRequest(workspaceId, input), principal }),
        )
        return toPreviewAgentTemplateType(result)
    }
}
