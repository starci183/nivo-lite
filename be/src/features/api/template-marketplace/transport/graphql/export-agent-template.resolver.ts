import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ExportAgentTemplateQuery } from "../../application/export-agent-template.query"
import { TemplateVersionRefInput } from "./dto/template-version-ref.input"
import { toExportAgentTemplateRequest, toExportAgentTemplateType } from "./export-agent-template.mapper"

@Resolver()
/** GraphQL door of exportAgentTemplate. */
export class ExportAgentTemplateResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Exports one version of a template of the caller as a file of canonical JSON. */
    @Query(() => String, { name: "exportAgentTemplate" })
    async exportAgentTemplate(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: TemplateVersionRefInput,
    ): Promise<string> {
        const result = await this.queryBus.execute(
            new ExportAgentTemplateQuery({ request: toExportAgentTemplateRequest(input), principal }),
        )
        return toExportAgentTemplateType(result)
    }
}
