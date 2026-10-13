import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAutomationsQuery } from "../../application/get-automations.query"
import { toAutomationsOverviewType } from "./automations.mapper"
import { AutomationsOverviewType } from "./dto/automations-overview.type"

@Resolver()
/** GraphQL door of the automations gallery. */
export class GetAutomationsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the gallery, the history and the shop for previews. */
    @Query(() => AutomationsOverviewType, { name: "automations" })
    async automations(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AutomationsOverviewType> {
        const result = await this.queryBus.execute(new GetAutomationsQuery({ request: { workspaceId }, principal }))
        return toAutomationsOverviewType(result)
    }
}
