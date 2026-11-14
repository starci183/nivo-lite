import { QueryHandler } from "@nestjs/cqrs"
import { ContactBlocksService, type ContactModuleAgentView } from "@modules/domain/workbench-door"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ContactModuleBlocksQuery } from "./contacts.queries"

@QueryHandler(ContactModuleBlocksQuery)
/** `nivo.api.nivo.contact.block.list`: what each installed agent's module knows about one person, through the workbench door as the caller. */
export class ContactModuleBlocksHandler extends ICQRSHandler<ContactModuleBlocksQuery, ReadonlyArray<ContactModuleAgentView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly blocks: ContactBlocksService,
    ) {
        super(logger)
    }

    protected override process(query: ContactModuleBlocksQuery): Promise<ReadonlyArray<ContactModuleAgentView>> {
        return this.blocks.list(query.params.principal.id, query.params.request)
    }
}
