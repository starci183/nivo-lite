import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MyAgentTemplatesQuery } from "../../application/my-agent-templates.query"
import { TemplateType } from "./dto/template.type"
import { toMyAgentTemplatesType } from "./my-agent-templates.mapper"

@Resolver()
/** GraphQL door of myAgentTemplates. */
export class MyAgentTemplatesResolver {
    constructor(@InjectQueryBus() private readonly bus: QueryBus) {}

    /** Lists the templates of the caller with their versions. */
    @Query(() => [TemplateType], { name: "myAgentTemplates" })
    async myAgentTemplates(@CurrentPrincipal() principal: Principal): Promise<Array<TemplateType>> {
        const result = await this.bus.execute(new MyAgentTemplatesQuery({ request: {}, principal }))
        return toMyAgentTemplatesType(result)
    }
}
