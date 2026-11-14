import { QueryHandler } from "@nestjs/cqrs"
import { ContactsPageService, type ContactsPageView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadContactsQuery } from "./contacts.queries"

@QueryHandler(ReadContactsQuery)
/** `nivo.api.nivo.contact.list` / `.search`. */
export class ReadContactsHandler extends ICQRSHandler<ReadContactsQuery, ContactsPageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(query: ReadContactsQuery): Promise<ContactsPageView> {
        return this.page.list(query.params.principal.id, query.params.request)
    }
}
