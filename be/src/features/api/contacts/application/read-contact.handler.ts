import { QueryHandler } from "@nestjs/cqrs"
import { ContactsPageService, type ContactDetailView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadContactQuery } from "./contacts.queries"

@QueryHandler(ReadContactQuery)
/** `nivo.api.nivo.contact.get` with `.memory.list`. */
export class ReadContactHandler extends ICQRSHandler<ReadContactQuery, ContactDetailView | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(query: ReadContactQuery): Promise<ContactDetailView | null> {
        return this.page.detail(query.params.principal.id, query.params.request)
    }
}
