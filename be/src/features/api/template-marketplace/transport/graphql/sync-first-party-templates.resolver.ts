import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SyncFirstPartyTemplatesCommand } from "../../application/sync-first-party-templates.command"
import { FirstPartySyncReportType } from "./dto/first-party-sync-report.type"
import { toSyncFirstPartyTemplatesType } from "./sync-first-party-templates.mapper"

@Resolver()
/** GraphQL door of syncFirstPartyTemplates. */
export class SyncFirstPartyTemplatesResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** A platform admin packages the built-in modules of the catalogue as first-party templates and records the agents that already run. */
    @Mutation(() => FirstPartySyncReportType, { name: "syncFirstPartyTemplates" })
    async syncFirstPartyTemplates(@CurrentPrincipal() principal: Principal): Promise<FirstPartySyncReportType> {
        const result = await this.commandBus.execute(new SyncFirstPartyTemplatesCommand({ request: {}, principal }))
        return toSyncFirstPartyTemplatesType(result)
    }
}
