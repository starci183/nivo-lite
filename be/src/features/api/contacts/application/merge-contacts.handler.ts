import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService, type ContactView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { MergeContactsCommand } from "./contacts.commands"

@CommandHandler(MergeContactsCommand)
/** `nivo.api.nivo.contact.merge`. */
export class MergeContactsHandler extends ICQRSHandler<MergeContactsCommand, ContactView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: MergeContactsCommand): Promise<ContactView> {
        return this.page.merge(command.params.principal.id, command.params.request)
    }
}
