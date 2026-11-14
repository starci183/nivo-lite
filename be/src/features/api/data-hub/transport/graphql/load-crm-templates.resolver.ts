import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { LoadCrmTemplatesQuery } from "../../application/load-crm-templates.query"
import { CrmTemplateType } from "./dto/crm-template.type"
import { toCrmTemplateTypes, toLoadCrmTemplatesRequest } from "./load-crm-templates.mapper"

@Resolver()
/** GraphQL door of crmTemplates. */
export class LoadCrmTemplatesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The CRMs the installed packages declare, for the connect wizard. */
    @Query(() => [CrmTemplateType], { name: "crmTemplates" })
    async crmTemplates(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<CrmTemplateType>> {
        const result = await this.queryBus.execute(
            new LoadCrmTemplatesQuery({ request: toLoadCrmTemplatesRequest(workspaceId), principal }),
        )
        return toCrmTemplateTypes(result)
    }
}
